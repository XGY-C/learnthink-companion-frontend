<template>
  <div class="checklist-panel" v-if="checklist">
    <div class="cp-header">
      <div class="cp-header-left">
        <div class="cp-header-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="14" height="14" rx="3" stroke="currentColor" stroke-width="1.5"/>
            <path d="M4.5 8l2.5 2.5 4.5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h3 class="cp-title">资源生成清单</h3>
      </div>
      <div class="cp-summary-badge" :class="badgeClass">
        {{ doneCount + failedCount }}/{{ totalCount }}
        <span class="cp-badge-label">完成</span>
      </div>
    </div>

    <div class="cp-progress">
      <div class="cp-progress-track">
        <div class="cp-progress-fill" :style="{ width: percent + '%' }"></div>
      </div>
      <div class="cp-progress-stats">
        <span v-if="generatingCount > 0" class="cp-stat generating">生成中 {{ generatingCount }}</span>
        <span v-if="renderingCount > 0" class="cp-stat rendering">渲染中 {{ renderingCount }}</span>
        <span v-if="doneCount > 0" class="cp-stat done">✓ {{ doneCount }}</span>
        <span v-if="failedCount > 0" class="cp-stat failed">✗ {{ failedCount }}</span>
      </div>
    </div>

    <div class="cp-items">
      <div
        v-for="item in items"
        :key="item.title"
        class="cp-item"
        :class="'cp-item-' + item.status"
      >
        <el-tooltip
          :content="statusTooltip(item.status)"
          placement="top"
          :show-after="300"
        >
          <span class="cp-status">
            <span v-if="item.status === 'pending'" class="cp-dot pending"></span>
            <span v-else-if="item.status === 'generating'" class="cp-spinner"></span>
            <span v-else-if="item.status === 'rendering'" class="cp-spinner rendering"></span>
            <span v-else-if="item.status === 'done'" class="cp-check">✓</span>
            <span v-else-if="item.status === 'failed'" class="cp-cross">✗</span>
          </span>
        </el-tooltip>

        <span class="cp-type-badge" :class="'cp-type-' + item.type">{{ typeLabel(item.type) }}</span>

        <span class="cp-item-title" :title="item.title">{{ item.title }}</span>

        <div class="cp-item-meta">
          <span class="cp-difficulty">{{ item.difficulty }}</span>
          <span class="cp-sep">·</span>
          <span>~{{ item.estimatedMinutes }}min</span>
        </div>

        <button
          v-if="item.status === 'failed'"
          class="cp-retry-btn"
          title="重新生成"
          @click="$emit('retry', item)"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6a4 4 0 117 2.5L7 7.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface ChecklistItemData {
  type: string
  title: string
  description?: string
  difficulty: string
  estimatedMinutes: number
  status: 'pending' | 'generating' | 'rendering' | 'done' | 'failed'
}

const props = defineProps<{
  checklist: {
    items: ChecklistItemData[]
    totalCount: number
    doneCount: number
    failedCount: number
    generatingCount: number
  } | null
}>()

defineEmits<{
  retry: [item: ChecklistItemData]
}>()

const items = computed(() => props.checklist?.items ?? [])
const doneCount = computed(() => props.checklist?.doneCount ?? 0)
const failedCount = computed(() => props.checklist?.failedCount ?? 0)
const generatingCount = computed(() => props.checklist?.generatingCount ?? 0)
const renderingCount = computed(() => (props.checklist as any)?.renderingCount ?? 0)
const totalCount = computed(() => props.checklist?.totalCount ?? 0)

const percent = computed(() => {
  if (totalCount.value === 0) return 0
  return Math.round(((doneCount.value + failedCount.value) / totalCount.value) * 100)
})

const badgeClass = computed(() => {
  const p = percent.value
  if (p >= 100) return 'badge-done'
  if (failedCount.value > 0) return 'badge-has-errors'
  if (generatingCount.value > 0 || renderingCount.value > 0) return 'badge-running'
  return 'badge-pending'
})

const typeLabel = (type: string) => {
  const map: Record<string, string> = {
    doc: '文档', quiz: '习题', reading: '阅读材料',
    code: '代码', mindmap: '思维导图', video: '视频', html: '交互文档',
  }
  return map[type] || type
}

const statusTooltip = (status: string) => {
  const map: Record<string, string> = {
    pending: '等待生成',
    generating: '正在生成中',
    rendering: '视频渲染中',
    done: '已完成',
    failed: '生成失败',
  }
  return map[status] || status
}
</script>

<style scoped>
.checklist-panel {
  border-radius: 12px;
  border: 1px solid var(--lt-border);
  background: var(--lt-bg-card);
  overflow: hidden;
  transition: box-shadow 0.2s;
}
.checklist-panel:hover {
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
}

/* Header */
.cp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 0;
}
.cp-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cp-header-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.cp-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--lt-text-primary);
}
.cp-summary-badge {
  font-size: 13px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 20px;
  line-height: 1.6;
  transition: all 0.3s;
}
.cp-badge-label {
  font-weight: 400;
  font-size: 11px;
  margin-left: 2px;
}
.badge-pending { background: var(--lt-bg-page); color: var(--lt-text-auxiliary); }
.badge-running { background: var(--lt-brand-lightest); color: var(--lt-brand); }
.badge-has-errors { background: rgba(255,59,48,0.08); color: var(--lt-danger); }
.badge-done { background: rgba(52,199,89,0.1); color: var(--lt-success); }

/* Progress */
.cp-progress {
  padding: 10px 16px 4px;
}
.cp-progress-track {
  height: 4px;
  background: var(--lt-bg-page);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 6px;
}
.cp-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--lt-brand), var(--lt-brand-light));
  border-radius: 2px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
.cp-progress-stats {
  display: flex;
  gap: 10px;
  font-size: 11px;
}
.cp-stat { font-weight: 500; }
.cp-stat.generating { color: var(--lt-brand); }
.cp-stat.rendering { color: var(--lt-warm); }
.cp-stat.done { color: var(--lt-success); }
.cp-stat.failed { color: var(--lt-danger); }

/* Items */
.cp-items {
  padding: 6px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cp-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  background: var(--lt-bg-page);
  transition: background 0.2s, opacity 0.3s;
  position: relative;
}
.cp-item:hover {
  background: var(--lt-brand-lightest);
}
.cp-item-done {
  opacity: 0.75;
}
.cp-item-done:hover {
  opacity: 1;
}
.cp-item-failed {
  background: rgba(255,59,48,0.06);
  border-left: 3px solid rgba(255,59,48,0.4);
  padding-left: 7px;
}
.cp-item-failed:hover {
  background: rgba(255,59,48,0.12);
}
.cp-item-generating {
  background: rgba(124,92,252,0.06);
  border-left: 3px solid rgba(124,92,252,0.3);
  padding-left: 7px;
}
.cp-item-rendering {
  background: rgba(255,140,66,0.06);
  border-left: 3px solid rgba(255,140,66,0.3);
  padding-left: 7px;
}

/* Status indicators */
.cp-status {
  width: 18px;
  text-align: center;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cp-dot.pending {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: 1.5px solid var(--lt-text-placeholder);
  transition: all 0.3s;
}
.cp-spinner {
  display: inline-block;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  border: 2px solid var(--lt-brand);
  border-top-color: transparent;
  animation: cp-spin 0.7s linear infinite;
}
.cp-spinner.rendering {
  border-color: var(--lt-warm);
  border-top-color: transparent;
}
.cp-check {
  font-size: 13px;
  font-weight: 700;
  color: var(--lt-success);
  animation: cp-pop 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.cp-cross {
  font-size: 13px;
  font-weight: 700;
  color: var(--lt-danger);
  animation: cp-pop 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes cp-spin { to { transform: rotate(360deg); } }
@keyframes cp-pop {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}

/* Type badge */
.cp-type-badge {
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 4px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
  line-height: 1.6;
}
.cp-type-doc { background: #2B6FFF; }
.cp-type-quiz { background: #FF8C42; }
.cp-type-reading { background: #7C5CFC; }
.cp-type-code { background: #2F855A; }
.cp-type-mindmap { background: #E53E3E; }
.cp-type-video { background: #D53F8C; }

/* Title */
.cp-item-title {
  font-size: 13px;
  color: var(--lt-text-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}
.cp-item-done .cp-item-title {
  color: var(--lt-text-auxiliary);
}

/* Meta */
.cp-item-meta {
  font-size: 11px;
  color: var(--lt-text-placeholder);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 3px;
}
.cp-difficulty {
  color: var(--lt-text-auxiliary);
}
.cp-sep {
  opacity: 0.5;
}

/* Retry button */
.cp-retry-btn {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid var(--lt-border);
  background: var(--lt-bg-card);
  color: var(--lt-text-auxiliary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s, border-color 0.15s;
}
.cp-item-failed:hover .cp-retry-btn {
  opacity: 1;
}
.cp-retry-btn:hover {
  color: var(--lt-brand);
  border-color: var(--lt-brand);
}

/* ── Mobile adaptation (max-width: 768px) ── */
@media (max-width: 768px) {
  .cp-item {
    padding: 8px 12px;
    min-height: 48px;
  }
  .cp-retry-btn {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    opacity: 1;
  }
  .cp-type-badge {
    font-size: 11px;
    padding: 2px 8px;
  }
  .cp-item-title {
    font-size: 14px;
  }
  .cp-item-meta {
    font-size: 12px;
  }
  .cp-title {
    font-size: 15px;
  }
  .cp-summary-badge {
    font-size: 14px;
    padding: 4px 12px;
  }
}
</style>
