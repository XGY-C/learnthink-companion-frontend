<template>
  <div ref="studioViewRef" class="studio-view p-6" style="height: 100%; overflow-y: auto; overscroll-behavior: contain;">
    <!-- Back -->
    <div class="mb-4">
      <el-button link @click="$router.push('/studio')">
        <el-icon class="mr-1"><ArrowLeft /></el-icon>返回任务列表
      </el-button>
    </div>

    <!-- ============== EMPTY STATE ============== -->
    <div v-if="!stream.taskId.value && !stream.packId.value" class="studio-empty">
      <div class="studio-empty-icon">
        <StudioIcon :size="64" />
      </div>
      <h2 class="text-xl font-bold mb-2" style="color: var(--lt-text-primary);">资源生成工作室</h2>
      <p class="text-sm mb-6" style="color: var(--lt-text-placeholder); max-width: 360px;">
        选择一个生成任务或对话中生成资源后，在这里实时监控 Agent 协同过程
      </p>
      <el-button type="primary" @click="$router.push('/chat')" :icon="ChatLineRound">
        前往对话页
      </el-button>
    </div>

    <!-- ============== MAIN CONTENT ============== -->
    <div v-else class="studio-content">
      <!-- Header -->
      <div class="flex justify-between items-center mb-4">
        <div>
          <div class="flex items-center gap-3">
            <StudioIcon :size="36" />
            <h2 class="text-2xl font-bold m-0" style="color: var(--lt-text-primary);">{{ pageTitle }}</h2>
          </div>
          <p class="text-sm mt-1 ml-[44px]" style="color: var(--lt-text-auxiliary);">{{ pageSubtitle }}</p>
        </div>
        <div class="flex items-center gap-3">

          <el-tag v-if="stream.sseStatusText.value === 'connected'" type="success" size="small" effect="plain">SSE 已连接</el-tag>
          <el-tag v-else-if="stream.sseStatusText.value === 'connecting'" type="warning" size="small" effect="plain">SSE 连接中...</el-tag>
          <el-tag v-else-if="stream.sseStatusText.value === 'reconnecting'" type="warning" size="small" effect="plain">SSE ({{ stream.sseRetryCount.value }})</el-tag>
          <el-tag v-else-if="stream.sseStatusText.value === 'done'" type="info" size="small" effect="plain">已完成</el-tag>
          <el-tag v-else type="danger" size="small" effect="plain">⚠ 未连接</el-tag>
          <el-button v-if="!stream.isComplete.value" size="small" @click="stream.manualRefresh()" :icon="Refresh" circle title="手动重连" />
        </div>
      </div>

      <!-- Planner decision -->
      <div v-if="stream.plannerDecision.value" id="sec-planner" class="mb-5 p-5 rounded-xl border" style="background: linear-gradient(135deg, #F8FAFF, #F0F4FF); border-color: #D6E4FF;">
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
      <div v-if="stream.isComplete.value" class="mb-5 px-4 py-3 rounded-lg text-sm flex items-center gap-2" style="background-color: #ECFDF3; border: 1px solid #BBF7D0; color: #166534;">
        <span class="text-base">✅</span>
        <span>已生成 {{ stream.resourceReadyCount.value }} 份资源 · 引用 {{ stream.totalSources.value }} 条证据 · 平均质量 {{ stream.avgQuality.value }} 分</span>
      </div>

      <!-- Pipeline monitor (high-density: checklist + agents side by side) -->
      <div id="sec-monitor" class="scroll-mt-20 mb-5">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ChecklistPanel
            :checklist="stream.checklist.value"
            @retry="handleChecklistRetry"
          />
          <AgentActivityPanel :agents="stream.activeAgents.value" />
        </div>
      </div>

      <!-- Pipeline stepper + Thought chain -->
      <div v-if="stream.hasStarted.value && !stream.isComplete.value" id="sec-pipeline" class="scroll-mt-20 mb-5">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <PipelineStepper
            :task-id="stream.taskId.value"
            :stage="stream.currentStage.value"
            :percent="stream.currentPercent.value"
            :message="stream.currentMessage.value"
          />
          <div class="thought-chain-panel">
            <div class="tc-header">
              <h4 class="tc-title">
                <span class="orbit-container">
                  <span class="orbit-core">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/>
                    </svg>
                  </span>
                  <span class="orbit-line"></span>
                </span>
                Agent 思考链
              </h4>
              <div class="tc-header-actions">
                <el-select
                  v-model="traceAgentFilter"
                  size="small"
                  placeholder="全部 Agent"
                  clearable
                  class="tc-filter"
                  @change="stream.showAllThoughts.value = true"
                >
                  <el-option
                    v-for="name in agentNames"
                    :key="name"
                    :label="name"
                    :value="name"
                  />
                </el-select>
                <el-button link size="small" @click="stream.showAllThoughts.value = !stream.showAllThoughts.value">
                  {{ stream.showAllThoughts.value ? '仅看决策' : '展开全部' }}
                </el-button>
              </div>
            </div>
            <div class="tc-traces">
              <div v-for="trace in filteredTraces" :key="trace.traceId" class="trace-card" :style="{ borderLeftColor: AGENT_COLORS[trace.agentName] || '#2B6FFF' }">
                <div class="trace-header">
                  <span class="trace-agent" :style="{ color: AGENT_COLORS[trace.agentName] || 'var(--lt-text-primary)' }">{{ trace.agentName }}</span>
                  <span class="trace-phase">{{ trace.phase }}</span>
                  <span class="trace-time">{{ formatTime(trace.timestamp) }}</span>
                  <span v-if="trace.inResponseTo" class="trace-link">← {{ trace.inResponseTo.slice(0, 8) }}</span>
                </div>
                <div v-if="stream.showAllThoughts.value && trace.observation" class="trace-bubble trace-obs">
                  <span class="bubble-label">观察到</span>
                  <span class="bubble-text">{{ trace.observation }}</span>
                </div>
                <div v-if="stream.showAllThoughts.value && trace.thought" class="trace-bubble trace-think">
                  <span class="bubble-label">思考</span>
                  <span class="bubble-text">{{ trace.thought }}</span>
                </div>
                <div v-if="trace.decision" class="trace-bubble trace-decision">
                  <span class="bubble-label">决定</span>
                  <span class="bubble-text">{{ trace.decision }}</span>
                </div>
              </div>
              <div v-if="filteredTraces.length === 0" class="tc-empty">
                <div class="tc-empty-dot"></div>
                <span>等待 Agent 开始推理...</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Resource cards -->
      <div v-if="stream.resources.value.length > 0" id="sec-resources" class="scroll-mt-20">
        <h4 class="text-sm font-semibold mb-4 flex items-center gap-2" style="color: var(--lt-text-primary);">
          <span class="w-1.5 h-1.5 rounded-full" style="background: var(--lt-brand);"></span>
          生成资源 ({{ stream.resources.value.length }})
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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
      </div>

      <!-- Preview dialog -->
      <el-dialog
        v-model="previewVisible"
        :title="currentPreview?.title || '预览'"
        width="60%"
        destroy-on-close
        class="studio-preview-dialog"
      >
        <div v-if="currentPreview" class="min-h-[300px] h-full flex flex-col">
          <div class="flex items-center gap-4 mb-3 border-b border-slate-100 pb-1 flex-shrink-0">
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
          <div v-else-if="currentPreview.type === 'code'">
            <CodeLearningViewer
              :content="currentPreview.deepContent || currentPreview.brief || ''"
              :title="currentPreview.title"
              :quality-score="currentPreview.qualityScore"
              :sources-count="currentPreview.sourcesCount"
            />
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
          <div v-else class="flex-1 min-h-0">
            <MarkdownViewer :content="currentPreview.deepContent || currentPreview.brief || '暂无内容'" :showToc="true" />
          </div>
        </div>
      </el-dialog>
    </div>

    <EvidenceDrawer ref="evidenceDrawerRef" />

    <!-- Back to top -->
    <button v-show="showBackToTop" class="studio-b2t" @click="scrollStudioTop" title="回到顶部">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m18 15-6-6-6 6"/></svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, ArrowDown, Download, Refresh, ChatLineRound } from '@element-plus/icons-vue'
import StudioIcon from '@/components/icons/StudioIcon.vue'
import PipelineStepper from '@/components/PipelineStepper.vue'
import ChecklistPanel from '@/components/ChecklistPanel.vue'
import type { ChecklistItemData } from '@/components/ChecklistPanel.vue'
import AgentActivityPanel from '@/components/AgentActivityPanel.vue'
import ResourceCard from '@/components/ResourceCard.vue'
import EvidenceDrawer from '@/components/EvidenceDrawer.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import MindmapViewer from '@/components/MindmapViewer.vue'
import QuizPreview from '@/components/QuizPreview.vue'
import CodeLearningViewer from '@/components/code/CodeLearningViewer.vue'
import { useTaskStream, typeLabel } from '@/composables/useTaskStream'
import { markdownToDocxBlob, downloadDocx, preprocessLatexForMarkdown } from '@/utils/docxExport'
import { extractVideoUrl } from '@/utils/media'

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

// ── Trace filtering ──
const traceAgentFilter = ref('')

const agentNames = computed(() => {
  const names = new Set(stream.thinkingTraces.value.map(t => t.agentName))
  return [...names].sort()
})

const filteredTraces = computed(() => {
  if (!traceAgentFilter.value) return stream.displayedTraces.value
  return stream.displayedTraces.value.filter(t => t.agentName === traceAgentFilter.value)
})

// ── Back to top ──
const showBackToTop = ref(false)
const studioViewRef = ref<HTMLElement | null>(null)

function onStudioScroll() {
  showBackToTop.value = (studioViewRef.value?.scrollTop ?? 0) > 600
}
function scrollStudioTop() {
  studioViewRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  studioViewRef.value?.addEventListener('scroll', onStudioScroll, { passive: true })
})
onUnmounted(() => {
  studioViewRef.value?.removeEventListener('scroll', onStudioScroll)
})

// ── Retry handler ──
function handleChecklistRetry(item: ChecklistItemData) {
  ElMessage.info(`重新提交: ${item.title}`)
}

// ── Preview state ──
function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const previewVisible = ref(false)
const currentPreview = ref<any>(null)
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

const videoPreviewUrl = computed(() => {
  if (currentPreview.value?.type !== 'video') return null
  return extractVideoUrl(currentPreview.value)
})

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
/* ── Empty state ── */
.studio-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 400px;
  padding: 40px;
  border-radius: 16px;
  border: 1px dashed var(--lt-border);
  background: var(--lt-bg-card);
}
.studio-empty-icon {
  margin-bottom: 16px;
  opacity: 0.6;
}

/* ── Back to top ── */
.studio-b2t {
  position: fixed;
  bottom: 32px;
  right: 32px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--lt-border);
  background: var(--lt-bg-card);
  color: var(--lt-text-auxiliary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.studio-b2t:hover {
  color: var(--lt-brand);
  border-color: var(--lt-brand);
  box-shadow: 0 2px 12px rgba(43,111,255,0.15);
}

/* ── Thought chain panel ── */
.thought-chain-panel {
  padding: 14px;
  border-radius: 12px;
  border: 1px solid var(--lt-border);
  background-color: var(--lt-bg-card);
}
.tc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  gap: 8px;
}
.tc-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--lt-text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}
.tc-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.tc-filter {
  width: 130px;
  :deep(.el-select__wrapper) {
    min-height: 28px;
    padding: 0 8px;
    font-size: 12px;
  }
}
.tc-traces {
  max-height: 420px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tc-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 0;
  font-size: 12px;
  color: var(--lt-text-placeholder);
}
.tc-empty-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lt-brand);
  animation: tc-pulse 1.5s ease-in-out infinite;
}
@keyframes tc-pulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.3); }
}

/* ── Trace cards ── */
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
  background-color: #E8ECF0; color: var(--lt-text-auxiliary);
  font-weight: 500;
}
.trace-time { font-size: 10px; color: var(--lt-text-placeholder); margin-left: auto; }
.trace-link { font-size: 10px; color: var(--lt-brand); }
.trace-bubble { margin-top: 4px; padding: 6px 8px; border-radius: 6px; display: flex; flex-direction: column; gap: 2px; }
.trace-obs { background-color: rgba(43, 111, 255, 0.08); border-left: 2px solid rgba(43, 111, 255, 0.35); }
.trace-think { background-color: rgba(180, 83, 9, 0.08); border-left: 2px solid rgba(180, 83, 9, 0.3); }
.trace-decision { background-color: rgba(22, 101, 52, 0.08); border-left: 2px solid rgba(22, 101, 52, 0.35); }
.bubble-label { font-weight: 600; font-size: 10px; opacity: 0.75; }
.bubble-text { color: var(--lt-text-secondary); line-height: 1.5; }

/* ── Orbit icon ── */
.orbit-container {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 20px;
  height: 20px;
}
.orbit-core {
  color: var(--lt-ai);
  display: flex;
  z-index: 1;
}
.orbit-core svg {
  filter: drop-shadow(0 0 4px rgba(124, 92, 252, 0.3));
}
.orbit-line {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1.5px solid color-mix(in srgb, var(--lt-ai) 20%, transparent);
  border-top-color: var(--lt-ai);
  animation: orbit-rotate 1.2s linear infinite;
}
@keyframes orbit-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>

<style>
.el-overlay:has(.studio-preview-dialog) {
  overflow: hidden;
}
.studio-preview-dialog {
  --el-dialog-padding-primary: 20px;
}
.studio-preview-dialog .el-dialog {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 80px);
  overflow: hidden;
}
.studio-preview-dialog .el-dialog__header {
  flex-shrink: 0;
  padding-bottom: 16px;
}
.studio-preview-dialog .el-dialog__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.studio-preview-dialog .el-dialog__title {
  font-size: 15px;
}
</style>
