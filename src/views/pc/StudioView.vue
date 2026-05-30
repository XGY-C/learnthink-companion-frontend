<template>
  <div class="studio-view p-6" style="height: 100%; overflow-y: auto;">
    <div class="mb-4">
      <el-button link @click="$router.push('/studio')">
        <el-icon class="mr-1"><ArrowLeft /></el-icon>返回任务列表
      </el-button>
    </div>

    <div v-if="stream.taskId.value || stream.packId.value" class="studio-content">
      <div class="flex justify-between items-center mb-6">
        <div>
          <div class="flex items-center gap-3">
            <StudioIcon :size="36" />
            <h2 class="text-2xl font-bold m-0" style="color: var(--lt-text-primary);">{{ pageTitle }}</h2>
          </div>
          <p class="text-sm mt-1 ml-[44px]" style="color: var(--lt-text-auxiliary);">{{ pageSubtitle }}</p>
        </div>
        <div class="flex items-center gap-3">
          <span v-if="stream.taskId.value" class="text-xs px-3 py-1 rounded-full border font-mono" style="background-color: var(--lt-bg-page); color: var(--lt-text-auxiliary); border-color: var(--lt-border);">
            #{{ stream.taskId.value }}
          </span>
          <el-tag v-if="stream.sseStatusText.value === 'connected'" type="success" size="small" effect="plain">SSE 已连接</el-tag>
          <el-tag v-else-if="stream.sseStatusText.value === 'connecting'" type="warning" size="small" effect="plain">SSE 连接中...</el-tag>
          <el-tag v-else-if="stream.sseStatusText.value === 'reconnecting'" type="warning" size="small" effect="plain">SSE 重连中 ({{ stream.sseRetryCount.value }})</el-tag>
          <el-tag v-else-if="stream.sseStatusText.value === 'done'" type="info" size="small" effect="plain">已完成</el-tag>
          <el-tag v-else type="danger" size="small" effect="plain" title="SSE 未连接，仅依赖轮询更新">⚠ SSE 未连接</el-tag>
          <el-button v-if="!stream.isComplete.value" size="small" @click="stream.manualRefresh()" :icon="Refresh" circle title="手动重连 SSE" />
        </div>
      </div>

      <!-- Planner decision -->
      <div v-if="stream.plannerDecision.value" class="mb-6 p-5 rounded-xl border" style="background: linear-gradient(135deg, #F8FAFF, #F0F4FF); border-color: #D6E4FF;">
        <div class="flex items-start gap-3">
          <span class="text-2xl">📋</span>
          <div class="flex-1">
            <h4 class="text-base font-semibold mb-2" style="color: var(--lt-text-primary);">Planner 的决策</h4>
            <p class="text-sm leading-relaxed mb-3" style="color: var(--lt-text-secondary);">"{{ stream.plannerDecision.value.rationale }}"</p>
            <div class="flex flex-wrap items-center gap-2 text-xs">
              <span style="color: var(--lt-text-auxiliary);">优先级：</span>
              <el-tag
                v-for="item in stream.plannerDecision.value.items"
                :key="item.type"
                size="small"
                :type="item.priority === 1 ? 'danger' : item.priority === 2 ? 'warning' : 'info'"
                effect="plain"
              >
                {{ item.priority }}. {{ typeLabel(item.type) }}
              </el-tag>
            </div>
          </div>
        </div>
      </div>

      <!-- Summary bar -->
      <div v-if="stream.isComplete.value" class="mb-6 px-4 py-3 rounded-lg text-sm" style="background-color: #ECFDF3; border: 1px solid #BBF7D0; color: #166534;">
        ✅ 已生成 {{ stream.resourceReadyCount.value }} 份资源 · 引用 {{ stream.totalSources.value }} 条证据 · 平均质量 {{ stream.avgQuality.value }} 分
      </div>

      <!-- Phase 7: Checklist + Agent Activity -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChecklistPanel :checklist="stream.checklist.value" />
        <AgentActivityPanel :agents="stream.activeAgents.value" />
      </div>

      <!-- Agent collaboration + PipelineStepper -->
      <div v-if="stream.hasStarted.value && !stream.isComplete.value" class="mb-6">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PipelineStepper
            :task-id="stream.taskId.value"
            :stage="stream.currentStage.value"
            :percent="stream.currentPercent.value"
            :message="stream.currentMessage.value"
          />
          <div class="p-4 rounded-lg border" style="background-color: var(--lt-bg-card); border-color: var(--lt-border);">
            <div class="flex items-center justify-between mb-4">
              <h4 class="text-sm font-semibold" style="color: var(--lt-text-primary);">🧠 Agent 思考链</h4>
              <el-button link size="small" @click="stream.showAllThoughts.value = !stream.showAllThoughts.value">
                {{ stream.showAllThoughts.value ? '仅看决策' : '展开全部' }}
              </el-button>
            </div>
            <div class="max-h-[400px] overflow-y-auto space-y-3">
              <div v-for="trace in stream.displayedTraces.value" :key="trace.traceId" class="trace-card" :style="{ borderLeftColor: AGENT_COLORS[trace.agentName] || '#2B6FFF' }">
                <div class="trace-header">
                  <span class="trace-agent">{{ trace.agentName }}</span>
                  <span class="trace-phase">{{ trace.phase }}</span>
                  <span class="trace-time">{{ formatTime(trace.timestamp) }}</span>
                  <span v-if="trace.inResponseTo" class="trace-link">← {{ trace.inResponseTo.slice(0, 8) }}</span>
                </div>
                <div v-if="stream.showAllThoughts.value && trace.observation" class="trace-bubble trace-obs">
                  <span class="bubble-label">👁 观察到</span>
                  <span class="bubble-text">{{ trace.observation }}</span>
                </div>
                <div v-if="stream.showAllThoughts.value && trace.thought" class="trace-bubble trace-think">
                  <span class="bubble-label">💭 思考</span>
                  <span class="bubble-text">{{ trace.thought }}</span>
                </div>
                <div v-if="trace.decision" class="trace-bubble trace-decision">
                  <span class="bubble-label">🎯 决定</span>
                  <span class="bubble-text">{{ trace.decision }}</span>
                </div>
              </div>
              <div v-if="stream.displayedTraces.value.length === 0" class="text-center py-8 text-xs" style="color: var(--lt-text-placeholder);">
                等待 Agent 开始推理...
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Resource cards -->
      <div v-if="stream.resources.value.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <ResourceCard
          v-for="res in stream.resources.value"
          :key="res.id"
          v-bind="res"
          @preview="previewResource(res)"
          @view-sources="viewSources(res)"
          @regenerate="stream.regenerateResource(res)"
          @download="downloadResource(res, $event)"
        />
      </div>

      <!-- Preview dialog -->
      <el-dialog
        v-model="previewVisible"
        :title="currentPreview?.title || '预览'"
        width="60%"
        destroy-on-close
      >
        <div v-if="currentPreview" class="min-h-[300px]">
          <div class="flex items-center gap-4 mb-4 border-b border-slate-100 pb-2">
            <el-radio-group v-if="currentPreview.type === 'doc' || currentPreview.type === 'reading' || currentPreview.type === 'video'" v-model="previewMode" size="small">
              <el-radio-button label="brief">速览版 (5分钟)</el-radio-button>
              <el-radio-button label="deep">深入版 (20分钟)</el-radio-button>
            </el-radio-group>
            <span v-else />
            <div class="flex items-center gap-2 ml-auto text-sm">
              <template v-if="currentPreview.type === 'code'">
                <el-button size="small" @click="downloadResource(currentPreview)">下载 .py</el-button>
              </template>
              <el-dropdown v-else-if="currentPreview.type === 'doc' || currentPreview.type === 'reading'" size="small" @command="(cmd: string) => cmd === 'docx' ? downloadResource(currentPreview) : downloadMdResource(currentPreview)">
                <el-button size="small" type="primary">
                  下载 <el-icon class="ml-1"><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="docx">下载 DOCX</el-dropdown-item>
                    <el-dropdown-item command="md">下载 Markdown</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <span class="text-slate-500">质量分 {{ currentPreview.qualityScore }}/100</span>
              <el-button link type="primary" size="small" @click="viewSources(currentPreview)">引用证据</el-button>
            </div>
          </div>
          <div v-if="currentPreview.type === 'mindmap'" class="min-h-[600px] border border-slate-200 rounded-lg">
            <MindmapViewer ref="mindmapViewerRef" :content="currentPreview.deepContent || currentPreview.brief || ''" :isJson="true" />
          </div>
          <div v-if="currentPreview.type === 'mindmap'" class="flex gap-2 mt-3">
            <el-button size="small" @click="mindmapViewerRef?.exportSvg(currentPreview.title + '.svg')">
              <el-icon class="mr-1"><Download /></el-icon>导出 SVG
            </el-button>
            <el-button size="small" @click="mindmapViewerRef?.exportPng(currentPreview.title + '.png')">
              <el-icon class="mr-1"><Download /></el-icon>导出 PNG
            </el-button>
          </div>
          <div v-else-if="currentPreview.type === 'code'" class="bg-slate-50 rounded-lg overflow-hidden">
            <MarkdownViewer :content="currentPreview.deepContent || currentPreview.brief || ''" :showToc="false" />
          </div>
          <div v-else-if="currentPreview.type === 'quiz'">
            <QuizPreview
              :content="currentPreview.deepContent || currentPreview.brief || ''"
              :quality-score="currentPreview.qualityScore"
              @open-practice="() => {}"
            />
          </div>
          <div v-else-if="currentPreview.type === 'video'" class="border border-slate-200 rounded-lg overflow-hidden bg-black">
            <video v-if="videoPreviewUrl" :src="videoPreviewUrl" controls class="w-full" style="max-height: 500px;" />
            <div v-else class="flex items-center justify-center py-16" style="color: var(--lt-text-auxiliary);">
              <span>视频正在生成或 URL 暂不可用</span>
            </div>
          </div>
          <div v-else>
            <MarkdownViewer :content="previewContent" :showToc="previewMode === 'deep'" />
          </div>
        </div>
      </el-dialog>
    </div>

    <EvidenceDrawer ref="evidenceDrawerRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, ArrowDown, Download, Refresh } from '@element-plus/icons-vue'
import StudioIcon from '@/components/icons/StudioIcon.vue'
import PipelineStepper from '@/components/PipelineStepper.vue'
import ChecklistPanel from '@/components/ChecklistPanel.vue'
import AgentActivityPanel from '@/components/AgentActivityPanel.vue'
import ResourceCard from '@/components/ResourceCard.vue'
import EvidenceDrawer from '@/components/EvidenceDrawer.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import MindmapViewer from '@/components/MindmapViewer.vue'
import QuizPreview from '@/components/QuizPreview.vue'
import { useTaskStream, typeLabel } from '@/composables/useTaskStream'
import { markdownToDocxBlob, downloadDocx, preprocessLatexForMarkdown } from '@/utils/docxExport'

const route = useRoute()
const stream = useTaskStream()

const AGENT_COLORS: Record<string, string> = {
  ConversationAgent: '#2B6FFF',
  ProfileAnalyzer: '#7C5CFC',
  EvidenceRetriever: '#2563EB',
  CurriculumPlanner: '#059669',
  ResourceGenerator: '#4B5563',
  ContentReviewer: '#EA580C',
  OrchestratorAgent: '#B45309',
}

function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const previewVisible = ref(false)
const currentPreview = ref<any>(null)
const previewMode = ref('brief')
const evidenceDrawerRef = ref<any>(null)
const mindmapViewerRef = ref<{ exportSvg: (filename?: string) => void; exportPng: (filename?: string) => Promise<void> } | null>(null)

const pageTitle = computed(() => {
  if (stream.isComplete.value) return '资源包详情'
  if (stream.hasStarted.value) return '资源生成中...'
  return '资源生成工作室'
})

const pageSubtitle = computed(() => {
  if (stream.isComplete.value) return 'Planner 为你定制的个性化资源已就绪'
  if (stream.hasStarted.value) return 'Agent 正在协同工作，实时监控生成进度'
  return ''
})

const previewContent = computed(() => {
  if (!currentPreview.value) return ''
  if (previewMode.value === 'brief') return currentPreview.value.brief || '暂无内容'
  return currentPreview.value.deepContent || currentPreview.value.brief || '暂无内容'
})

const videoPreviewUrl = computed(() => {
  if (currentPreview.value?.type !== 'video') return null
  try {
    const raw = currentPreview.value?.content || currentPreview.value?.brief || currentPreview.value?.deepContent
    if (!raw) return null
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw)
    // 优先 JSON 解析
    try {
      const parsed = JSON.parse(text)
      if (parsed?.videoUrl) return parsed.videoUrl
    } catch { /* JSON 损坏，走正则回退 */ }
    // 正则回退：从损坏的 JSON 中直接提取 videoUrl 值
    const m = text.match(/"videoUrl"\s*:\s*(https?:\/\/[^"]+)/)
    return m ? m[1] : null
  } catch {
    return null
  }
})

function extractVideoUrl(res: any): string | null {
  const raw = res.videoUrl || res.content || res.deepContent || res.brief || ''
  if (!raw) return null
  // 如果已经是纯 URL 字符串
  if (typeof raw === 'string' && /^https?:\/\//.test(raw.trim())) return raw.trim()
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw)
  try {
    const parsed = JSON.parse(text)
    if (parsed?.videoUrl) return parsed.videoUrl
  } catch { /* JSON 损坏，走正则回退 */ }
  const m = text.match(/"videoUrl"\s*:\s*(https?:\/\/[^"]+)/)
  return m ? m[1] : null
}

async function downloadResource(res: any, format = 'docx') {
  if (res.type === 'video' || format === 'video') {
    const url = extractVideoUrl(res)
    if (url) {
      window.open(url, '_blank')
    } else {
      ElMessage.warning('视频 URL 暂不可用，请等待视频渲染完成')
    }
    return
  }
  const content = res.deepContent || res.brief || ''
  if (res.type === 'code' || format === 'py') {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${res.title || 'resource'}.py`
    a.click()
  } else if (format === 'md') {
    downloadMdResource(res)
  } else {
    const blob = await markdownToDocxBlob(content, res.title)
    downloadDocx(blob, res.title || 'resource')
  }
}

function downloadMdResource(res: any) {
  const raw = res.deepContent || res.brief || ''
  const content = preprocessLatexForMarkdown(raw)
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${res.title || 'resource'}.md`
  a.click()
}

function previewResource(res: any) {
  currentPreview.value = res
  previewMode.value = 'brief'
  previewVisible.value = true
}

function viewSources(res: any) {
  if (res.sources?.length > 0) {
    evidenceDrawerRef.value?.open(res.sources)
  } else {
    evidenceDrawerRef.value?.open([
      { title: '系统生成', locator: '—', quote: '此内容基于知识库证据与画像偏好生成。', relevance: 'medium' },
    ])
  }
}

onMounted(() => {
  stream.initFromRoute(
    (route.params.taskId as string) || '',
    (route.query.pack_id as string) || null
  )
})

watch(() => route.params.taskId, (newVal) => {
  if (newVal && newVal !== stream.taskId.value) {
    stream.initFromRoute(newVal as string, null)
  }
})

watch(() => route.query.pack_id, (newVal) => {
  if (newVal && newVal !== stream.packId.value) {
    stream.initFromRoute('', newVal as string)
  }
})

onUnmounted(() => {
  stream.cleanup()
})
</script>

<style scoped>
.trace-card {
  font-size: 12px;
  border-radius: 10px;
  padding: 10px 12px;
  border: 1px solid var(--lt-border);
  border-left: 3px solid var(--lt-brand);
  background-color: var(--lt-bg-card);
  transition: box-shadow 0.15s;
}
.trace-card:hover { box-shadow: 0 1px 6px rgba(0,0,0,0.06); }
.trace-header {
  display: flex; align-items: center; gap: 6px;
  margin-bottom: 6px; flex-wrap: wrap;
}
.trace-agent { font-weight: 600; font-size: 12px; color: var(--lt-text-primary); }
.trace-phase {
  font-size: 10px; padding: 0 6px; border-radius: 4px;
  background-color: #E8ECF0; color: #94A3B8;
}
.trace-time { font-size: 10px; color: var(--lt-text-placeholder); margin-left: auto; }
.trace-link { font-size: 10px; color: var(--lt-brand); }
.trace-bubble { margin-top: 4px; padding: 6px 8px; border-radius: 6px; display: flex; flex-direction: column; gap: 2px; }
.trace-obs { background-color: rgba(43, 111, 255, 0.06); border-left: 2px solid rgba(43, 111, 255, 0.3); }
.trace-think { background-color: rgba(180, 83, 9, 0.06); border-left: 2px solid rgba(180, 83, 9, 0.25); }
.trace-decision { background-color: rgba(22, 101, 52, 0.06); border-left: 2px solid rgba(22, 101, 52, 0.3); }
.bubble-label { font-weight: 600; font-size: 10px; opacity: 0.7; }
.bubble-text { color: var(--lt-text-secondary); line-height: 1.5; }
</style>
