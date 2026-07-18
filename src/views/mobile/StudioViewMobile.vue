<template>
  <div ref="studioDetailRef" class="m-studio-detail" @scroll="onStudioScroll">
    <!-- ============== EMPTY STATE ============== -->
    <div v-if="!stream.taskId.value && !stream.packId.value" class="m-studio-empty">
      <div class="m-studio-empty-icon">
        <StudioIcon :size="48" />
      </div>
      <h2 class="m-studio-empty-title">资源生成工作室</h2>
      <p class="m-studio-empty-desc">选择一个生成任务或对话中生成资源后，在这里实时监控 Agent 协同过程</p>
      <button class="m-studio-empty-btn" @click="$router.push('/chat')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        前往对话页
      </button>
    </div>

    <template v-else>
      <!-- ============== HEADER + SSE BADGES ============== -->
      <div class="m-studio-detail-header">
        <button class="m-studio-back" aria-label="返回" @click="$router.push('/studio')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="m-studio-detail-info">
          <h2 class="m-studio-detail-title">{{ pageTitle }}</h2>
          <span class="m-studio-detail-subtitle">{{ pageSubtitle }}</span>
        </div>
        <div class="m-studio-detail-badges">
          <span v-if="stream.sseStatusText.value === 'connected'" class="m-badge success">已连接</span>
          <span v-else-if="stream.sseStatusText.value === 'connecting'" class="m-badge warning">连接中</span>
          <span v-else-if="stream.sseStatusText.value === 'reconnecting'" class="m-badge warning">重连({{ stream.sseRetryCount.value }})</span>
          <span v-else-if="stream.sseStatusText.value === 'done'" class="m-badge done">已完成</span>
          <span v-else class="m-badge error">未连接</span>
          <button v-if="!stream.isComplete.value" class="m-sse-refresh" @click="stream.manualRefresh()" title="手动重连" aria-label="手动重连">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>
      </div>

      <!-- ============== PLANNER DECISION ============== -->
      <div v-if="stream.plannerDecision.value" class="m-planner-decision">
        <div class="m-planner-decision-header">
          <span class="m-planner-emoji">📋</span>
          <span class="m-planner-label">Planner 的决策</span>
        </div>
        <p class="m-planner-rationale">"{{ stream.plannerDecision.value.rationale }}"</p>
        <div class="m-planner-items">
          <span class="m-planner-priority-label">优先级：</span>
          <span
            v-for="item in stream.plannerDecision.value.items"
            :key="item.type"
            class="m-planner-tag"
            :class="item.priority === 1 ? 'p1' : item.priority === 2 ? 'p2' : 'p3'"
          >
            {{ item.priority }}. {{ typeLabel(item.type) }}
          </span>
        </div>
      </div>

      <!-- ============== SUMMARY BAR ============== -->
      <div v-if="stream.isComplete.value" class="m-summary-bar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--lt-success)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        已生成 {{ stream.resourceReadyCount.value }} 份资源 · 引用 {{ stream.totalSources.value }} 条证据 · 平均质量 {{ stream.avgQuality.value }} 分
      </div>

      <!-- ============== MONITOR: CHECKLIST + AGENTS ============== -->
      <div class="m-monitor-section">
        <ChecklistPanel
          :checklist="stream.checklist.value"
          @retry="handleChecklistRetry"
        />
        <AgentActivityPanel :agents="stream.activeAgents.value" />
      </div>

      <!-- ============== PIPELINE + THOUGHT CHAIN ============== -->
      <div v-if="stream.hasStarted.value && !stream.isComplete.value" class="m-pipeline-section">
        <PipelineStepper
          :task-id="stream.taskId.value"
          :stage="stream.currentStage.value"
          :percent="stream.currentPercent.value"
          :message="stream.currentMessage.value"
        />
        <button class="m-trace-toggle" @click="showTraces = !showTraces">
          <span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="m-trace-toggle-icon"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/></svg>
            Agent 思考链 ({{ stream.displayedTraces.value.length }})
          </span>
          <svg :class="{ open: showTraces }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div v-if="showTraces" class="m-trace-list">
          <!-- Filter bar -->
          <div class="m-trace-filter-bar">
            <select v-model="traceAgentFilter" class="m-trace-filter-select">
              <option value="">全部 Agent</option>
              <option v-for="name in agentNames" :key="name" :value="name">{{ name }}</option>
            </select>
            <button class="m-trace-mode-btn" @click="stream.showAllThoughts.value = !stream.showAllThoughts.value">
              {{ stream.showAllThoughts.value ? '仅决策' : '全部' }}
            </button>
          </div>
          <!-- Color-coded trace cards -->
          <div
            v-for="trace in filteredTraces"
            :key="trace.traceId"
            class="m-trace-item"
            :style="{ borderLeftColor: AGENT_COLORS[trace.agentName] || '#2B6FFF' }"
          >
            <div class="m-trace-header">
              <span class="m-trace-agent" :style="{ color: AGENT_COLORS[trace.agentName] || 'var(--lt-text-primary)' }">{{ trace.agentName }}</span>
              <span class="m-trace-phase">{{ trace.phase }}</span>
              <span class="m-trace-time">{{ formatTime(trace.timestamp) }}</span>
              <span v-if="trace.inResponseTo" class="m-trace-link">← {{ trace.inResponseTo.slice(0, 8) }}</span>
            </div>
            <div v-if="stream.showAllThoughts.value && trace.observation" class="m-trace-bubble observation">
              <span class="m-bubble-label">观察到</span>
              <span class="m-bubble-text">{{ trace.observation }}</span>
            </div>
            <div v-if="stream.showAllThoughts.value && trace.thought" class="m-trace-bubble thought">
              <span class="m-bubble-label">思考</span>
              <span class="m-bubble-text">{{ trace.thought }}</span>
            </div>
            <div v-if="trace.decision" class="m-trace-bubble decision">
              <span class="m-bubble-label">决定</span>
              <span class="m-bubble-text">{{ trace.decision }}</span>
            </div>
          </div>
          <div v-if="filteredTraces.length === 0" class="m-trace-empty">
            <span class="m-trace-empty-dot" />
            <span>等待 Agent 开始推理...</span>
          </div>
        </div>
      </div>

      <!-- ============== RESOURCES ============== -->
      <div v-if="stream.resources.value.length > 0" class="m-resources-section">
        <h4 class="m-resources-title">
          <span class="m-resources-dot" />
          生成资源 ({{ stream.resources.value.length }})
        </h4>
        <div class="m-resources-list">
          <div
            v-for="res in stream.resources.value"
            :key="res.id"
            class="m-resource-card"
            :class="{ pending: res.status === 'pending' || res.status === 'rendering', failed: res.status === 'failed' }"
            @click="previewResource(res)"
          >
            <div class="m-resource-icon-wrap">
              <span class="m-resource-icon">{{ resourceIcon(res.type) }}</span>
            </div>
            <div class="m-resource-body">
              <h4 class="m-resource-title">{{ res.title || typeLabel(res.type) }}</h4>
              <div class="m-resource-meta">
                <span class="m-resource-status" :class="res.status">
                  {{ res.status === 'ready' ? '已就绪' : res.status === 'rendering' ? '渲染中' : res.status === 'pending' ? '生成中' : res.status === 'failed' ? '失败' : '已驳回' }}
                </span>
                <span v-if="res.confidence" class="m-resource-confidence" :class="res.confidence">{{ confLabel(res.confidence) }}</span>
                <span v-if="res.qualityScore" class="m-resource-score">{{ res.qualityScore }}分</span>
              </div>
            </div>
            <svg class="m-resource-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>
      </div>
    </template>

    <!-- ============== BOTTOM SHEET PREVIEW ============== -->
    <Teleport to="body">
      <Transition name="btt-sheet">
        <div v-if="previewVisible" class="m-preview-scrim" @click.self="closePreview">
          <div class="m-preview-sheet">
            <div class="m-preview-handle" />
            <div class="m-preview-header">
              <h3 class="m-preview-title">{{ currentPreview?.title || '预览' }}</h3>
              <button class="m-preview-close" aria-label="关闭预览" @click="closePreview">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="m-preview-body">
              <div v-if="currentPreview?.type === 'mindmap'" style="min-height: 300px;">
                <MindmapViewer ref="mindmapViewerRef" :content="currentPreview.deepContent || currentPreview.brief || ''" :is-json="true" />
              </div>
              <div v-else-if="currentPreview?.type === 'video'" class="bg-black rounded-lg overflow-hidden">
                <video v-if="videoPreviewUrl" :src="videoPreviewUrl" controls class="w-full" style="max-height: 400px;" />
                <div v-else class="flex items-center justify-center py-12" style="color: var(--lt-text-auxiliary);">
                  <span>视频正在生成或 URL 暂不可用</span>
                </div>
              </div>
              <div v-else-if="currentPreview?.type === 'quiz'">
                <QuizPreview
                  :content="currentPreview.deepContent || currentPreview.brief || ''"
                  :quality-score="currentPreview.qualityScore"
                  @open-practice="() => {}"
                />
              </div>
              <div v-else-if="currentPreview?.type === 'html'">
                <HtmlSandboxViewer :content="currentPreview.deepContent || currentPreview.brief || ''" :title="currentPreview.title" />
              </div>
              <div v-else>
                <MarkdownViewer :content="previewContent" :show-toc="true" />
              </div>
            </div>
            <div class="m-preview-actions">
              <div class="m-preview-action-row">
                <button class="m-preview-source-btn" @click="viewSources(currentPreview)">
                  📚 引用证据
                </button>
              </div>
              <div v-if="currentPreview?.type === 'doc' || currentPreview?.type === 'reading'" class="m-preview-dl-row">
                <button class="m-dl-btn" @click="downloadDocxResource(currentPreview)">📥 DOCX</button>
                <button class="m-dl-btn" @click="downloadMdResource(currentPreview)">📥 MD</button>
              </div>
              <div v-else-if="currentPreview?.type === 'code'" class="m-preview-dl-row">
                <button class="m-dl-btn" @click="downloadCodeResource(currentPreview)">📥 下载 .py</button>
              </div>
              <div v-else-if="currentPreview?.type === 'video'" class="m-preview-dl-row">
                <button class="m-dl-btn" @click="downloadVideoResource(currentPreview)">📥 打开视频</button>
              </div>
              <div v-else-if="currentPreview?.type === 'quiz'" class="m-preview-dl-row">
                <button class="m-dl-btn" @click="downloadQuizResource(currentPreview, 'docx')">📥 DOCX</button>
                <button class="m-dl-btn" @click="downloadQuizResource(currentPreview, 'md')">📥 MD</button>
              </div>
              <div v-else-if="currentPreview?.type === 'mindmap'" class="m-preview-dl-row">
                <button class="m-dl-btn" @click="mindmapViewerRef?.exportSvg(currentPreview.title + '.svg')">📥 SVG</button>
                <button class="m-dl-btn" @click="mindmapViewerRef?.exportPng(currentPreview.title + '.png')">📥 PNG</button>
              </div>
              <div v-else-if="currentPreview?.type === 'html'" class="m-preview-dl-row">
                <button class="m-dl-btn" @click="downloadHtmlResource(currentPreview)">📥 HTML</button>
              </div>
              <div v-else class="m-preview-dl-row">
                <button class="m-dl-btn" @click="downloadMdResource(currentPreview)">📥 下载 MD</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <EvidenceSheet ref="evidenceSheetRef" />

    <!-- ============== BACK TO TOP ============== -->
    <button v-show="showBackToTop" class="m-b2t" @click="scrollTop" title="回到顶部" aria-label="回到顶部">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m18 15-6-6-6 6"/></svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import StudioIcon from '@/components/icons/StudioIcon.vue'
import PipelineStepper from '@/components/PipelineStepper.vue'
import ChecklistPanel from '@/components/ChecklistPanel.vue'
import type { ChecklistItemData } from '@/components/ChecklistPanel.vue'
import AgentActivityPanel from '@/components/AgentActivityPanel.vue'
import EvidenceSheet from '@/components/mobile/EvidenceSheet.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import MindmapViewer from '@/components/MindmapViewer.vue'
import QuizPreview from '@/components/QuizPreview.vue'
import HtmlSandboxViewer from '@/components/HtmlSandboxViewer.vue'
import { useTaskStream, typeLabel } from '@/composables/useTaskStream'
import { extractVideoUrl } from '@/utils/media'
import { markdownToDocxBlob, downloadDocx, preprocessLatexForMarkdown } from '@/utils/docxExport'
import { quizToMarkdown } from '@/utils/quizExport'
import { downloadHtml } from '@/utils/htmlExport'

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

const previewVisible = ref(false)
const currentPreview = ref<any>(null)
const showTraces = ref(false)
const evidenceSheetRef = ref<any>(null)
const mindmapViewerRef = ref<{ exportSvg: (filename?: string) => void; exportPng: (filename?: string) => Promise<void> } | null>(null)

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
const studioDetailRef = ref<HTMLElement | null>(null)

function onStudioScroll() {
  showBackToTop.value = (studioDetailRef.value?.scrollTop ?? 0) > 600
}

function scrollTop() {
  studioDetailRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

// ── Retry handler ──
function handleChecklistRetry(item: ChecklistItemData) {
  ElMessage.info(`重新提交: ${item.title}`)
}

// ── Time formatting ──
function formatTime(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function resourceIcon(type: string): string {
  const map: Record<string, string> = { doc: '📄', mindmap: '🧠', quiz: '📝', reading: '📖', code: '💻', video: '🎬' }
  return map[type] || '📄'
}

function confLabel(conf: string): string {
  const map: Record<string, string> = { high: '高置信', medium: '中置信', low: '低置信' }
  return map[conf] || conf
}

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
  return currentPreview.value.deepContent || currentPreview.value.brief || '暂无内容'
})

const videoPreviewUrl = computed(() => {
  if (currentPreview.value?.type !== 'video') return null
  return extractVideoUrl(currentPreview.value)
})

function previewResource(res: any) {
  currentPreview.value = res
  previewVisible.value = true
}

function closePreview() {
  previewVisible.value = false
}

function viewSources(res: any) {
  if (res.sources?.length > 0) {
    evidenceSheetRef.value?.open(res.sources)
  } else {
    evidenceSheetRef.value?.open([
      { title: '系统生成', locator: '—', quote: '此内容基于知识库证据与画像偏好生成。', relevance: 'medium' },
    ])
  }
}

async function downloadDocxResource(res: any) {
  const content = res.deepContent || res.brief || ''
  const blob = await markdownToDocxBlob(content, res.title)
  downloadDocx(blob, res.title || 'resource')
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

function downloadCodeResource(res: any) {
  const content = res.deepContent || res.brief || ''
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${res.title || 'resource'}.py`
  a.click()
}

function downloadVideoResource(res: any) {
  const url = extractVideoUrl(res)
  if (url) {
    window.open(url, '_blank')
  } else {
    ElMessage.warning('视频 URL 暂不可用，请等待视频渲染完成')
  }
}

function downloadHtmlResource(res: any) {
  const raw = res.deepContent || res.brief || ''
  downloadHtml(raw, res.title || 'resource')
}

async function downloadQuizResource(res: any, format: string) {
  const md = quizToMarkdown(res.deepContent || res.brief || '', res.title)
  if (!md) {
    ElMessage.warning('题目内容解析失败，无法导出')
    return
  }
  if (format === 'md') {
    const blob = new Blob([preprocessLatexForMarkdown(md)], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${res.title || 'resource'}.md`
    a.click()
  } else {
    const blob = await markdownToDocxBlob(md, res.title)
    downloadDocx(blob, res.title || 'resource')
  }
}

let cleanupReconnect: (() => void) | undefined

onMounted(() => {
  stream.initFromRoute(
    (route.params.taskId as string) || '',
    (route.query.pack_id as string) || null
  )
  studioDetailRef.value?.addEventListener('scroll', onStudioScroll, { passive: true })
  cleanupReconnect = stream.setupMobileReconnection()
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
  cleanupReconnect?.()
  studioDetailRef.value?.removeEventListener('scroll', onStudioScroll)
})
</script>

<style scoped>
/* ── Container ── */
.m-studio-detail {
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 0 24px;
  background: var(--lt-bg-page);
}

/* ── Empty state ── */
.m-studio-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 60vh;
  padding: 40px 24px;
  gap: 12px;
}
.m-studio-empty-icon { opacity: 0.6; margin-bottom: 4px; }
.m-studio-empty-title { font-size: 18px; font-weight: 700; color: var(--lt-text-primary); margin: 0; }
.m-studio-empty-desc { font-size: 13px; color: var(--lt-text-placeholder); max-width: 300px; line-height: 1.5; margin: 0; }
.m-studio-empty-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 10px;
  background: var(--lt-brand);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  touch-action: manipulation;
}
.m-studio-empty-btn:active { opacity: 0.85; }

/* ── Header ── */
.m-studio-detail-header {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 16px; background: var(--lt-bg-card);
  border-bottom: 0.5px solid var(--lt-border);
  position: sticky; top: 0; z-index: 10;
}
.m-studio-back {
  display: flex; align-items: center; justify-content: center;
  width: 44px; height: 44px; border: none; background: transparent;
  color: var(--lt-text-secondary); cursor: pointer; border-radius: 8px;
  flex-shrink: 0; touch-action: manipulation;
}
.m-studio-back:active { background: var(--mobile-active-bg); }
.m-studio-detail-info { flex: 1; min-width: 0; }
.m-studio-detail-title { font-size: 16px; font-weight: 600; color: var(--lt-text-primary); margin: 0; }
.m-studio-detail-subtitle { font-size: 11px; color: var(--lt-text-auxiliary); }
.m-studio-detail-badges { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }

.m-badge {
  font-size: 10px; padding: 2px 8px; border-radius: 8px;
  font-weight: 500; white-space: nowrap;
}
.m-badge.success { background: rgba(52,199,89,0.1); color: var(--lt-success); }
.m-badge.warning { background: rgba(255,159,10,0.12); color: var(--lt-warning); }
.m-badge.done { background: var(--lt-bg-page); color: var(--lt-text-auxiliary); }
.m-badge.error { background: rgba(255,59,48,0.1); color: var(--lt-danger); }

.m-sse-refresh {
  display: flex; align-items: center; justify-content: center;
  width: 44px; height: 44px; border: none; border-radius: 50%;
  background: transparent; color: var(--lt-text-auxiliary);
  cursor: pointer; touch-action: manipulation; flex-shrink: 0;
}
.m-sse-refresh:active { background: var(--mobile-active-bg); }

/* ── Planner decision ── */
.m-planner-decision {
  margin: 12px 16px; padding: 14px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--lt-brand-lightest), var(--lt-brand-light-9));
  border: 0.5px solid var(--lt-brand-lighter);
}
.m-planner-decision-header {
  display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
}
.m-planner-emoji { font-size: 18px; }
.m-planner-label { font-size: 14px; font-weight: 600; color: var(--lt-text-primary); }
.m-planner-rationale {
  font-size: 13px; line-height: 1.5; color: var(--lt-text-secondary);
  margin: 0 0 10px; font-style: italic;
}
.m-planner-items { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.m-planner-priority-label { font-size: 11px; color: var(--lt-text-auxiliary); }
.m-planner-tag {
  font-size: 11px; padding: 2px 8px; border-radius: 6px;
  font-weight: 500;
}
.m-planner-tag.p1 { background: rgba(255,59,48,0.1); color: var(--lt-danger); }
.m-planner-tag.p2 { background: rgba(255,159,10,0.12); color: var(--lt-warning); }
.m-planner-tag.p3 { background: rgba(0,0,0,0.05); color: var(--lt-text-auxiliary); }

/* ── Summary ── */
.m-summary-bar {
  display: flex; align-items: center; gap: 8px;
  margin: 12px 16px; padding: 10px 14px;
  background: rgba(52,199,89,0.08); border: 0.5px solid rgba(52,199,89,0.2);
  border-radius: 10px; font-size: 13px; color: var(--lt-success);
}

/* ── Monitor section ── */
.m-monitor-section {
  margin: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ── Pipeline + Traces ── */
.m-pipeline-section { margin: 12px 16px; }

.m-trace-toggle {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; min-height: 44px; padding: 10px 14px; margin-top: 10px;
  border: 0.5px solid var(--lt-border); border-radius: 10px;
  background: var(--lt-bg-card); font-size: 13px; color: var(--lt-text-secondary);
  cursor: pointer; touch-action: manipulation;
}
.m-trace-toggle:active { background: var(--mobile-active-bg); }
.m-trace-toggle-icon { flex-shrink: 0; color: var(--lt-ai); }
.m-trace-toggle span { display: flex; align-items: center; gap: 6px; }
.m-trace-toggle svg { transition: transform 0.2s; }
.m-trace-toggle svg.open { transform: rotate(180deg); }

.m-trace-list {
  margin-top: 8px; display: flex; flex-direction: column; gap: 6px;
}

/* ── Trace filter bar ── */
.m-trace-filter-bar {
  display: flex; align-items: center; gap: 6px; margin-bottom: 4px;
}
.m-trace-filter-select {
  flex: 1; min-height: 44px; height: 44px; padding: 0 8px; font-size: 13px;
  border: 0.5px solid var(--lt-border); border-radius: 8px;
  background: var(--lt-bg-card); color: var(--lt-text-primary);
  appearance: auto; outline: none;
}
.m-trace-mode-btn {
  padding: 5px 14px; min-height: 44px; font-size: 12px; border-radius: 8px;
  border: 0.5px solid var(--lt-border); background: var(--lt-bg-card);
  color: var(--lt-text-secondary); cursor: pointer; white-space: nowrap;
  touch-action: manipulation;
}
.m-trace-mode-btn:active { background: var(--mobile-active-bg); }

/* ── Trace item with color-coded bubbles ── */
.m-trace-item {
  padding: 10px 12px; background: var(--lt-bg-card);
  border-radius: 8px; border: 0.5px solid var(--lt-border);
  border-left: 3px solid var(--lt-brand);
}
.m-trace-header {
  display: flex; align-items: center; gap: 6px;
  flex-wrap: wrap; margin-bottom: 4px;
}
.m-trace-agent { font-size: 12px; font-weight: 600; color: var(--lt-text-primary); }
.m-trace-phase {
  font-size: 10px; padding: 0 6px; border-radius: 4px;
  background: var(--lt-bg-page); color: var(--lt-text-auxiliary); font-weight: 500;
}
.m-trace-time { font-size: 10px; color: var(--lt-text-placeholder); margin-left: auto; }
.m-trace-link { font-size: 10px; color: var(--lt-brand); }

.m-trace-bubble {
  margin-top: 4px; padding: 6px 8px; border-radius: 6px;
  display: flex; flex-direction: column; gap: 2px;
}
.m-trace-bubble.observation { background: rgba(43,111,255,0.08); border-left: 2px solid rgba(43,111,255,0.35); }
.m-trace-bubble.thought { background: rgba(180,83,9,0.08); border-left: 2px solid rgba(180,83,9,0.3); }
.m-trace-bubble.decision { background: rgba(22,101,52,0.08); border-left: 2px solid rgba(22,101,52,0.35); }

.m-bubble-label { font-weight: 600; font-size: 10px; opacity: 0.75; }
.m-bubble-text { color: var(--lt-text-secondary); line-height: 1.5; font-size: 12px; }

.m-trace-empty {
  display: flex; align-items: center; justify-content: center;
  gap: 8px; padding: 24px 0; font-size: 12px; color: var(--lt-text-placeholder);
}
.m-trace-empty-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--lt-brand);
  animation: m-dot-pulse 1.5s ease-in-out infinite;
}
@keyframes m-dot-pulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.3); }
}

/* ── Resources section ── */
.m-resources-section { margin: 12px 16px; }
.m-resources-title {
  font-size: 13px; font-weight: 600; margin: 0 0 10px;
  display: flex; align-items: center; gap: 6px;
  color: var(--lt-text-primary);
}
.m-resources-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--lt-brand);
}

.m-resources-list { display: flex; flex-direction: column; gap: 10px; }

.m-resource-card {
  display: flex; align-items: center; gap: 12px;
  padding: 14px; background: var(--lt-bg-card);
  border-radius: 12px; border: 0.5px solid var(--lt-border);
  cursor: pointer; touch-action: manipulation;
  position: relative; transition: box-shadow 0.15s;
}
.m-resource-card:active { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.m-resource-card.pending { opacity: 0.6; }
.m-resource-card.failed { border-color: rgba(255,59,48,0.3); }

.m-resource-icon-wrap {
  width: 40px; height: 40px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  background: var(--lt-brand-lightest); flex-shrink: 0;
}
.m-resource-icon { font-size: 20px; }

.m-resource-body { flex: 1; min-width: 0; }
.m-resource-title { font-size: 14px; font-weight: 600; color: var(--lt-text-primary); margin: 0 0 4px; }
.m-resource-meta { display: flex; align-items: center; gap: 8px; font-size: 11px; }
.m-resource-status { color: var(--lt-text-placeholder); }
.m-resource-status.ready { color: var(--lt-success); }
.m-resource-status.failed { color: var(--lt-danger); }
.m-resource-confidence { padding: 1px 6px; border-radius: 6px; }
.m-resource-confidence.high { background: rgba(52,199,89,0.1); color: var(--lt-success); }
.m-resource-confidence.medium { background: rgba(255,159,10,0.1); color: var(--lt-warning); }
.m-resource-confidence.low { background: rgba(255,59,48,0.1); color: var(--lt-danger); }
.m-resource-score { color: var(--lt-text-auxiliary); }
.m-resource-arrow { color: var(--lt-text-placeholder); flex-shrink: 0; }

/* ── Preview Bottom Sheet ── */
.m-preview-scrim {
  position: fixed; inset: 0; z-index: 1000;
  background: var(--mobile-sheet-scrim);
  display: flex; align-items: flex-end;
}
.m-preview-sheet {
  width: 100%; max-height: 85vh;
  background: var(--lt-bg-card);
  border-radius: 12px 12px 0 0;
  display: flex; flex-direction: column;
}
.m-preview-handle {
  width: 36px; height: 4px; border-radius: 2px;
  background: var(--lt-border); margin: 8px auto 4px;
}
.m-preview-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 16px 12px; flex-shrink: 0;
}
.m-preview-title { font-size: 16px; font-weight: 600; color: var(--lt-text-primary); margin: 0; }
.m-preview-close {
  width: 44px; height: 44px; border: none; background: transparent;
  color: var(--lt-text-auxiliary); cursor: pointer; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  touch-action: manipulation;
}
.m-preview-body { flex: 1; overflow-y: auto; padding: 0 16px 16px; }
.m-preview-actions {
  padding: 12px 16px; border-top: 0.5px solid var(--lt-border);
  flex-shrink: 0;
}
.m-preview-source-btn {
  width: 100%; min-height: 44px; padding: 12px; border-radius: 10px;
  border: 0.5px solid var(--lt-border); background: var(--lt-bg-page);
  font-size: 14px; color: var(--lt-text-secondary); cursor: pointer;
  touch-action: manipulation;
  display: flex; align-items: center; justify-content: center;
}
.m-preview-action-row { margin-bottom: 6px; }
.m-preview-dl-row {
  display: flex; gap: 8px; margin-top: 8px;
}
.m-dl-btn {
  flex: 1; min-height: 44px; padding: 10px 12px; border-radius: 10px;
  border: 0.5px solid var(--lt-brand-lighter); background: var(--lt-brand-lightest);
  color: var(--lt-brand); font-size: 13px; cursor: pointer; touch-action: manipulation;
  display: flex; align-items: center; justify-content: center;
}
.m-dl-btn:active { background: var(--lt-brand-lighter); }

/* ── Back to top ── */
.m-b2t {
  position: fixed;
  bottom: 28px;
  right: 20px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 0.5px solid var(--lt-border);
  background: var(--lt-bg-card);
  color: var(--lt-text-auxiliary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  touch-action: manipulation;
}
.m-b2t:active {
  color: var(--lt-brand);
  border-color: var(--lt-brand);
  box-shadow: 0 2px 12px rgba(43,111,255,0.15);
}

/* ── Transition ── */
.btt-sheet-enter-active { transition: all 0.25s ease-out; }
.btt-sheet-leave-active { transition: all 0.2s ease-in; }
.btt-sheet-enter-from { opacity: 0; }
.btt-sheet-leave-to { opacity: 0; }
.btt-sheet-enter-from .m-preview-sheet { transform: translateY(100%); }
.btt-sheet-leave-to .m-preview-sheet { transform: translateY(100%); }
</style>
