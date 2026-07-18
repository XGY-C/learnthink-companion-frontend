<template>
  <div class="agent-panel" v-if="hasActivity">
    <div class="ap-header">
      <div class="ap-header-left">
        <div class="ap-header-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="4" r="2.5" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="3.5" cy="11" r="2.5" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="12.5" cy="11" r="2.5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M8 6.5v2M5.5 10l1.5-1.5M10.5 10l-1.5-1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        </div>
        <h3 class="ap-title">Agent 活动</h3>
        <span v-if="activeCount > 0" class="ap-count-badge">{{ activeCount }} 进行中</span>
      </div>
      <span v-if="doneHistory.length > 0" class="ap-history-toggle" @click="showHistory = !showHistory">
        {{ showHistory ? '收起' : `${doneHistory.length} 已完成` }}
        <span class="ap-arrow" :class="{ rotated: showHistory }">▾</span>
      </span>
    </div>

    <div class="ap-timeline">
      <!-- Active + failed agents -->
      <div
        v-for="agent in activeDisplay"
        :key="agent.jobId"
        class="ap-row"
        :class="'ap-row-' + agent.status"
      >
        <div class="ap-marker">
          <div class="ap-dot" :class="'dot-' + agent.status">
            <span v-if="agent.status === 'generating'" class="ap-spinner-dot"></span>
            <span v-else-if="agent.status === 'done'" class="ap-dot-icon">✓</span>
            <span v-else-if="agent.status === 'failed'" class="ap-dot-icon">✗</span>
          </div>
        </div>
        <div class="ap-content">
          <span class="ap-type-badge" :class="'ap-type-' + agent.type">{{ typeLabel(agent.type) }}</span>
          <span class="ap-agent-title">{{ agent.title }}</span>
          <span class="ap-status-label" :class="'label-' + agent.status">
            {{ agent.status === 'generating' ? '生成中' : agent.status === 'done' ? '已完成' : '失败' }}
          </span>
        </div>
      </div>

      <!-- Recently completed (collapsed) -->
      <Transition name="ap-collapse">
        <div v-if="showHistory && doneHistory.length > 0" class="ap-done-section">
          <div class="ap-done-divider">
            <span class="ap-done-divider-text">已完成</span>
          </div>
          <div
            v-for="agent in doneHistory"
            :key="agent.jobId"
            class="ap-row ap-row-done"
          >
            <div class="ap-marker">
              <div class="ap-dot dot-done">
                <span class="ap-dot-icon">✓</span>
              </div>
            </div>
            <div class="ap-content">
              <span class="ap-type-badge" :class="'ap-type-' + agent.type">{{ typeLabel(agent.type) }}</span>
              <span class="ap-agent-title">{{ agent.title }}</span>
              <span class="ap-time">{{ agent.doneAt }}</span>
            </div>
          </div>
        </div>
      </Transition>

      <div v-if="!hasActivity" class="ap-empty">
        <div class="ap-empty-line"></div>
        <div class="ap-empty-line"></div>
        <div class="ap-empty-line ap-empty-short"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

interface AgentActivity {
  jobId: string
  type: string
  title: string
  status: 'started' | 'generating' | 'done' | 'failed'
  doneAt?: string
}

const props = defineProps<{ agents: AgentActivity[] }>()

const showHistory = ref(false)

const activeDisplay = computed(() =>
  props.agents.filter(a => a.status === 'generating' || a.status === 'started' || a.status === 'failed')
)

const activeCount = computed(() =>
  props.agents.filter(a => a.status === 'generating' || a.status === 'started').length
)

const doneHistory = computed(() =>
  props.agents.filter(a => a.status === 'done')
)

const hasActivity = computed(() => props.agents.length > 0)

const typeLabel = (t: string) => {
  const m: Record<string, string> = { doc: '文档', quiz: '习题', reading: '阅读', code: '代码', mindmap: '思维导图', video: '视频', html: '交互文档' }
  return m[t] || t
}
</script>

<style scoped>
.agent-panel {
  border-radius: 12px;
  border: 1px solid var(--lt-border);
  background: var(--lt-bg-card);
  overflow: hidden;
  transition: box-shadow 0.2s;
}
.agent-panel:hover {
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
}

/* Header */
.ap-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 0;
}
.ap-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ap-header-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--lt-ai-light-9);
  color: var(--lt-ai);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ap-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--lt-text-primary);
}
.ap-count-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 20px;
  background: var(--lt-ai-light-9);
  color: var(--lt-ai);
  line-height: 1.6;
  animation: ap-pulse-badge 2s ease-in-out infinite;
}
@keyframes ap-pulse-badge {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
.ap-history-toggle {
  font-size: 11px;
  color: var(--lt-text-auxiliary);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 6px;
  transition: background 0.15s;
  user-select: none;
}
.ap-history-toggle:hover {
  background: var(--lt-bg-page);
  color: var(--lt-text-secondary);
}
.ap-arrow {
  font-size: 10px;
  transition: transform 0.2s;
}
.ap-arrow.rotated {
  transform: rotate(180deg);
}

/* Timeline */
.ap-timeline {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Row */
.ap-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 8px;
  transition: background 0.2s, opacity 0.3s;
}
.ap-row:hover {
  background: var(--lt-bg-page);
}
.ap-row-generating {
  background: rgba(124, 92, 252, 0.04);
}
.ap-row-failed {
  background: rgba(255, 59, 48, 0.04);
}
.ap-row-done {
  opacity: 0.7;
}
.ap-row-done:hover {
  opacity: 1;
}

/* Marker dot */
.ap-marker {
  width: 20px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ap-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.3s;
}
.dot-generating {
  background: var(--lt-ai-light-9);
  border: 2px solid var(--lt-ai);
}
.dot-done {
  background: rgba(52, 199, 89, 0.1);
  border: 2px solid var(--lt-success);
}
.dot-started, .dot-generating {
  background: var(--lt-ai-light-9);
  border: 2px solid var(--lt-ai);
}
.dot-failed {
  background: rgba(255, 59, 48, 0.1);
  border: 2px solid var(--lt-danger);
}
.ap-spinner-dot {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--lt-ai);
  border-top-color: transparent;
  animation: ap-spin 0.7s linear infinite;
}
.ap-dot-icon {
  font-size: 9px;
  font-weight: 700;
}
.dot-done .ap-dot-icon { color: var(--lt-success); }
.dot-failed .ap-dot-icon { color: var(--lt-danger); }
@keyframes ap-spin { to { transform: rotate(360deg); } }

/* Content */
.ap-content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.ap-type-badge {
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 4px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
  line-height: 1.6;
}
.ap-type-doc { background: #2B6FFF; }
.ap-type-quiz { background: #FF8C42; }
.ap-type-reading { background: #7C5CFC; }
.ap-type-code { background: #2F855A; }
.ap-type-mindmap { background: #E53E3E; }
.ap-type-video { background: #D53F8C; }

.ap-agent-title {
  font-size: 13px;
  color: var(--lt-text-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}
.ap-row-done .ap-agent-title {
  color: var(--lt-text-auxiliary);
}
.ap-status-label {
  font-size: 10px;
  font-weight: 500;
  flex-shrink: 0;
}
.label-generating { color: var(--lt-ai); }
.label-done { color: var(--lt-success); }
.label-failed { color: var(--lt-danger); }
.ap-time {
  font-size: 10px;
  color: var(--lt-text-placeholder);
  flex-shrink: 0;
}

/* Done section */
.ap-done-section {
  margin-top: 4px;
}
.ap-done-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  margin-bottom: 4px;
}
.ap-done-divider::before,
.ap-done-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--lt-border);
}
.ap-done-divider-text {
  font-size: 10px;
  color: var(--lt-text-placeholder);
  font-weight: 500;
  white-space: nowrap;
}

/* Empty skeleton */
.ap-empty {
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ap-empty-line {
  height: 8px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--lt-bg-page) 0%, var(--lt-brand-lightest) 50%, var(--lt-bg-page) 100%);
  background-size: 200% 100%;
  animation: ap-shimmer 1.5s ease-in-out infinite;
}
.ap-empty-short {
  width: 60%;
}
@keyframes ap-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Collapse transition */
.ap-collapse-enter-active,
.ap-collapse-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}
.ap-collapse-enter-from,
.ap-collapse-leave-to {
  opacity: 0;
  max-height: 0;
}
.ap-collapse-enter-to,
.ap-collapse-leave-from {
  opacity: 1;
  max-height: 500px;
}

/* ── Mobile adaptation (max-width: 768px) ── */
@media (max-width: 768px) {
  .ap-history-toggle {
    min-height: 44px;
    padding: 10px 12px;
    font-size: 12px;
  }
  .ap-title {
    font-size: 15px;
  }
  .ap-type-badge {
    font-size: 11px;
    padding: 2px 8px;
  }
  .ap-agent-title {
    font-size: 14px;
  }
  .ap-status-label {
    font-size: 11px;
  }
  .ap-time {
    font-size: 11px;
  }
  .ap-row {
    padding: 8px 10px;
    min-height: 44px;
  }
  .ap-count-badge {
    font-size: 11px;
    padding: 2px 10px;
  }
}
</style>
