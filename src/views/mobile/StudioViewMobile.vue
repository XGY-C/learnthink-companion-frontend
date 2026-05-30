<template>
  <div class="m-studio-detail">
    <!-- Loading -->
    <div v-if="!stream.taskId.value && !stream.packId.value" class="m-studio-loading">
      <div class="m-loading-spinner" />
      <p>加载中...</p>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="m-studio-detail-header">
        <button class="m-studio-back" @click="$router.push('/studio')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="m-studio-detail-info">
          <h2 class="m-studio-detail-title">{{ pageTitle }}</h2>
          <span class="m-studio-detail-subtitle">{{ pageSubtitle }}</span>
        </div>
        <div class="m-studio-detail-badges">
          <span v-if="stream.sseStatusText.value === 'connected'" class="m-badge success">SSE</span>
          <span v-else-if="stream.sseStatusText.value === 'done'" class="m-badge done">完成</span>
          <span v-else-if="stream.sseError.value" class="m-badge error">断开</span>
        </div>
      </div>

      <!-- Summary (when done) -->
      <div v-if="stream.isComplete.value" class="m-summary-bar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--lt-success)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        已生成 {{ stream.resourceReadyCount.value }} 份资源 · 平均质量 {{ stream.avgQuality.value }} 分
      </div>

      <!-- PipelineStepper (in progress) -->
      <div v-if="stream.hasStarted.value && !stream.isComplete.value" class="m-pipeline-section">
        <PipelineStepper
          :task-id="stream.taskId.value"
          :stage="stream.currentStage.value"
          :percent="stream.currentPercent.value"
          :message="stream.currentMessage.value"
        />
        <!-- Agent traces toggle -->
        <button class="m-trace-toggle" @click="showTraces = !showTraces">
          <span>🧠 Agent 思考链 ({{ stream.displayedTraces.value.length }})</span>
          <svg :class="{ open: showTraces }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div v-if="showTraces" class="m-trace-list">
          <div v-for="trace in stream.displayedTraces.value" :key="trace.traceId" class="m-trace-item">
            <div class="m-trace-agent">{{ trace.agentName }}</div>
            <div class="m-trace-detail">{{ trace.decision || trace.observation || trace.thought }}</div>
            <div class="m-trace-time">{{ formatTime(trace.timestamp) }}</div>
          </div>
          <div v-if="stream.displayedTraces.value.length === 0" class="m-trace-empty">等待 Agent 开始推理...</div>
        </div>
      </div>

      <!-- Resources -->
      <div v-if="stream.resources.value.length > 0" class="m-resources-list">
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
    </template>

    <!-- Bottom Sheet: Resource Preview -->
    <Teleport to="body">
      <Transition name="btt-sheet">
        <div v-if="previewVisible" class="m-preview-scrim" @click.self="closePreview">
          <div class="m-preview-sheet">
            <div class="m-preview-handle" />
            <div class="m-preview-header">
              <h3 class="m-preview-title">{{ currentPreview?.title || '预览' }}</h3>
              <button class="m-preview-close" @click="closePreview">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="m-preview-body">
              <div v-if="currentPreview?.type === 'mindmap'" style="min-height: 300px;">
                <MindmapViewer :content="currentPreview.deepContent || currentPreview.brief || ''" :is-json="true" />
              </div>
              <div v-else-if="currentPreview?.type === 'video'" class="bg-black rounded-lg overflow-hidden">
                <video v-if="videoPreviewUrl" :src="videoPreviewUrl" controls class="w-full" style="max-height: 400px;" />
                <div v-else class="flex items-center justify-center py-12" style="color: var(--lt-text-auxiliary);">
                  <span>视频正在生成或 URL 暂不可用</span>
                </div>
              </div>
              <div v-else>
                <MarkdownViewer :content="previewContent" :show-toc="false" />
              </div>
            </div>
            <div class="m-preview-actions">
              <button class="m-preview-source-btn" @click="viewSources(currentPreview)">
                📚 引用证据
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <EvidenceDrawer ref="evidenceDrawerRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import PipelineStepper from '@/components/PipelineStepper.vue'
import EvidenceDrawer from '@/components/EvidenceDrawer.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import MindmapViewer from '@/components/MindmapViewer.vue'
import { useTaskStream, typeLabel } from '@/composables/useTaskStream'

const route = useRoute()
const stream = useTaskStream()

const previewVisible = ref(false)
const currentPreview = ref<any>(null)
const showTraces = ref(false)
const evidenceDrawerRef = ref<any>(null)

function formatTime(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
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
  if (stream.isComplete.value) return '个性化资源已就绪'
  if (stream.hasStarted.value) return 'Agent 正在协同工作'
  return ''
})

const previewContent = computed(() => {
  if (!currentPreview.value) return ''
  return currentPreview.value.deepContent || currentPreview.value.brief || '暂无内容'
})

const videoPreviewUrl = computed(() => {
  if (currentPreview.value?.type !== 'video') return null
  try {
    const raw = currentPreview.value?.content || currentPreview.value?.brief || currentPreview.value?.deepContent
    if (!raw) return null
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw)
    try {
      const parsed = JSON.parse(text)
      if (parsed?.videoUrl) return parsed.videoUrl
    } catch { /* JSON 损坏，走正则回退 */ }
    const m = text.match(/"videoUrl"\s*:\s*(https?:\/\/[^"]+)/)
    return m ? m[1] : null
  } catch {
    return null
  }
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

onUnmounted(() => { stream.cleanup() })
</script>

<style scoped>
.m-studio-detail {
  padding: 0 0 24px;
  min-height: 100%;
  background: var(--lt-bg-page);
}

.m-studio-loading {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 80px 16px; gap: 12px;
  color: var(--lt-text-auxiliary); font-size: 14px;
}
.m-loading-spinner {
  width: 28px; height: 28px;
  border: 3px solid var(--lt-border); border-top-color: var(--lt-brand);
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Header */
.m-studio-detail-header {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 16px; background: var(--lt-bg-card);
  border-bottom: 0.5px solid var(--lt-border);
  position: sticky; top: 0; z-index: 10;
}

.m-studio-back {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border: none; background: transparent;
  color: var(--lt-text-secondary); cursor: pointer; border-radius: 8px;
  flex-shrink: 0; touch-action: manipulation;
}
.m-studio-back:active { background: var(--mobile-active-bg); }

.m-studio-detail-info { flex: 1; min-width: 0; }
.m-studio-detail-title { font-size: 16px; font-weight: 600; color: var(--lt-text-primary); margin: 0; }
.m-studio-detail-subtitle { font-size: 11px; color: var(--lt-text-auxiliary); }

.m-studio-detail-badges { display: flex; gap: 4px; flex-shrink: 0; }
.m-badge {
  font-size: 10px; padding: 2px 8px; border-radius: 8px;
  font-weight: 500;
}
.m-badge.success { background: rgba(52,199,89,0.1); color: var(--lt-success); }
.m-badge.done { background: var(--lt-bg-page); color: var(--lt-text-auxiliary); }
.m-badge.error { background: rgba(255,59,48,0.1); color: var(--lt-danger); }

/* Summary */
.m-summary-bar {
  display: flex; align-items: center; gap: 8px;
  margin: 12px 16px; padding: 10px 14px;
  background: #ECFDF3; border: 0.5px solid #BBF7D0;
  border-radius: 10px; font-size: 13px; color: #166534;
}

/* Pipeline section */
.m-pipeline-section { margin: 12px 16px; }

.m-trace-toggle {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; padding: 10px 14px; margin-top: 10px;
  border: 0.5px solid var(--lt-border); border-radius: 10px;
  background: var(--lt-bg-card); font-size: 13px; color: var(--lt-text-secondary);
  cursor: pointer; touch-action: manipulation;
}
.m-trace-toggle svg { transition: transform 0.2s; }
.m-trace-toggle svg.open { transform: rotate(180deg); }

.m-trace-list {
  margin-top: 8px; display: flex; flex-direction: column; gap: 6px;
}
.m-trace-item {
  padding: 10px 12px; background: var(--lt-bg-card);
  border-radius: 8px; border: 0.5px solid var(--lt-border);
  border-left: 3px solid var(--lt-brand);
}
.m-trace-agent { font-size: 12px; font-weight: 600; color: var(--lt-text-primary); margin-bottom: 4px; }
.m-trace-detail { font-size: 12px; color: var(--lt-text-secondary); line-height: 1.4; }
.m-trace-time { font-size: 10px; color: var(--lt-text-placeholder); margin-top: 4px; }
.m-trace-empty { text-align: center; padding: 16px; font-size: 12px; color: var(--lt-text-placeholder); }

/* Resource cards */
.m-resources-list { margin: 12px 16px; display: flex; flex-direction: column; gap: 10px; }

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

/* Preview Bottom Sheet */
.m-preview-scrim {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.4);
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
  width: 32px; height: 32px; border: none; background: transparent;
  color: var(--lt-text-auxiliary); cursor: pointer; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
.m-preview-body { flex: 1; overflow-y: auto; padding: 0 16px 16px; }
.m-preview-actions {
  padding: 12px 16px; border-top: 0.5px solid var(--lt-border);
  flex-shrink: 0;
}
.m-preview-source-btn {
  width: 100%; padding: 12px; border-radius: 10px;
  border: 0.5px solid var(--lt-border); background: var(--lt-bg-page);
  font-size: 14px; color: var(--lt-text-secondary); cursor: pointer;
  touch-action: manipulation;
}

.btt-sheet-enter-active { transition: all 0.25s ease-out; }
.btt-sheet-leave-active { transition: all 0.2s ease-in; }
.btt-sheet-enter-from { opacity: 0; }
.btt-sheet-leave-to { opacity: 0; }
.btt-sheet-enter-from .m-preview-sheet { transform: translateY(100%); }
.btt-sheet-leave-to .m-preview-sheet { transform: translateY(100%); }
</style>
