<script setup lang="ts">
import { computed, watch } from 'vue'
import type { ThinkingStep } from '@/types'
import MarkdownViewer from '@/components/MarkdownViewer.vue'

const props = withDefaults(defineProps<{
  steps: ThinkingStep[]
  isStreaming?: boolean
  expanded?: boolean
}>(), {
  isStreaming: false,
  expanded: false,
})

const emit = defineEmits<{
  (e: 'update:expanded', val: boolean): void
  (e: 'done'): void
}>()

// ── 步骤分类 ──
const REASONING_PHASES = new Set(['CONTEXT', 'DECISION', 'PLANNING'])
const TOOL_CALL_PHASES = new Set(['RETRIEVE', 'REFLECT', 'RAG'])
const ERROR_PHASES = new Set(['ERROR'])

function stepCategory(step: ThinkingStep): 'reasoning' | 'tool_call' | 'error' | 'unknown' {
  if (step.phase && ERROR_PHASES.has(step.phase)) return 'error'
  if (step.phase && REASONING_PHASES.has(step.phase)) return 'reasoning'
  if (step.phase && TOOL_CALL_PHASES.has(step.phase)) return 'tool_call'
  if (step.observation || step.thought || step.decision) return 'reasoning'
  return 'unknown'
}

function confidenceLabel(level: string): string {
  if (level === 'high') return '确信度高'
  if (level === 'medium') return '确信度中'
  if (level === 'low') return '确信度低'
  return level
}

// ── 衍生状态 ──
const completedCount = computed(() => props.steps.filter(s => s.done).length)
const totalCount = computed(() => props.steps.length)
const allDone = computed(() => totalCount.value > 0 && completedCount.value >= totalCount.value && !props.isStreaming)
const progressPercent = computed(() =>
  totalCount.value === 0 ? 0 : Math.round((completedCount.value / totalCount.value) * 100)
)

const headerText = computed(() => {
  if (totalCount.value === 0) return '正在思考...'
  if (props.isStreaming) return `思考中 · ${completedCount.value}/${totalCount.value} 步`
  return `思考完成 · ${completedCount.value}/${totalCount.value} 步`
})

function stepStatus(index: number): 'done' | 'active' | 'pending' {
  const step = props.steps[index]
  if (step.done) return 'done'
  const firstIncomplete = props.steps.findIndex(s => !s.done)
  if (index === firstIncomplete) return 'active'
  return 'pending'
}

// ── 自动折叠 ──
watch(allDone, (val) => {
  if (val) {
    setTimeout(() => {
      if (!props.expanded) return
      emit('update:expanded', false)
      emit('done')
    }, 600)
  }
})

function toggleExpanded() {
  emit('update:expanded', !props.expanded)
}
</script>

<template>
  <div class="tct" :class="{ 'tct-done': allDone }">
    <!-- 头部：状态 + 进度条 + 折叠 -->
    <button class="tct-header" @click="toggleExpanded">
      <span class="tct-h-left">
        <span v-if="allDone" class="tct-h-check">✓</span>
        <span v-else-if="props.isStreaming" class="tct-h-pulse" />
        <span v-else class="tct-h-pulse" />
        <span class="tct-h-title">{{ headerText }}</span>
      </span>
      <span v-if="totalCount > 0" class="tct-h-progress">
        <span class="tct-h-track">
          <span class="tct-h-fill" :style="{ width: progressPercent + '%' }" />
        </span>
      </span>
      <span class="tct-h-arrow" :class="{ rotated: props.expanded }">▾</span>
    </button>

    <!-- 时间线体 -->
    <Transition name="tct-slide">
      <div v-if="props.expanded && totalCount > 0" class="tct-body">
        <div
          v-for="(step, i) in props.steps"
          :key="i"
          class="tct-row"
          :class="[
            'tct-' + stepStatus(i),
            'tct-cat-' + stepCategory(step),
          ]"
        >
          <!-- 左侧标记列 -->
          <div class="tct-marker">
            <div class="tct-dot" :class="{ 'tct-dot-green': step.done }">
              <span class="tct-dot-icon">{{ step.icon }}</span>
              <span v-if="step.done" class="tct-dot-badge">✓</span>
              <span v-if="stepStatus(i) === 'active'" class="tct-ring" />
            </div>
            <div v-if="i < totalCount - 1" class="tct-line" :class="{ 'tct-line-done': step.done }" />
          </div>

          <!-- 右侧内容 -->
          <div class="tct-content">
            <div class="tct-label-row">
              <span class="tct-label">{{ step.label }}</span>
              <span
                v-if="step.done && step.confidenceLevel"
                class="tct-badge"
                :class="'badge-' + step.confidenceLevel"
              >{{ confidenceLabel(step.confidenceLevel) }}</span>
            </div>

            <!-- 推理卡片（reasoning 类型步骤 + 有 details） -->
            <div
              v-if="step.done && stepCategory(step) === 'reasoning' && (step.observation || step.thought || step.decision)"
              class="tct-card"
            >
              <div v-if="step.observation" class="tct-r-line">
                <span class="tct-r-key">观察</span>
                <MarkdownViewer :content="step.observation" :showToc="false" />
              </div>
              <div v-if="step.thought" class="tct-r-line">
                <span class="tct-r-key">思考</span>
                <MarkdownViewer :content="step.thought" :showToc="false" />
              </div>
              <div v-if="step.decision" class="tct-r-line">
                <span class="tct-r-key">决策</span>
                <MarkdownViewer :content="step.decision" :showToc="false" />
              </div>
            </div>

            <!-- 工具步骤详情 -->
            <p v-else-if="step.done && step.detail" class="tct-detail">{{ step.detail }}</p>

            <!-- 等待中 -->
            <p v-else-if="stepStatus(i) === 'pending'" class="tct-waiting">等待中...</p>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ===== 容器 ===== */
.tct {
  border-radius: 12px;
  border: 1px solid var(--lt-border);
  background-color: var(--lt-bg-card);
  overflow: hidden;
  user-select: none;
  transition: border-color 0.3s;
}
.tct.tct-done {
  border-color: rgba(52, 199, 89, 0.15);
  background-color: rgba(52, 199, 89, 0.03);
}

/* ===== 头部 ===== */
.tct-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 14px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
}
.tct-header:hover {
  background-color: rgba(0,0,0,0.02);
}
.tct-h-left {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.tct-h-check {
  font-size: 12px;
  font-weight: 700;
  color: var(--lt-success);
}
.tct-h-pulse {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: var(--lt-brand);
  animation: dot-pulse 1.2s ease-in-out infinite;
}
@keyframes dot-pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.25); }
}
.tct-h-title {
  font-weight: 600;
  color: var(--lt-text-secondary);
  white-space: nowrap;
}
.tct-done .tct-h-title {
  color: var(--lt-text-auxiliary);
}
.tct-h-progress {
  flex: 1;
  min-width: 40px;
}
.tct-h-track {
  display: block;
  height: 3px;
  border-radius: 4px;
  background-color: var(--lt-border);
  overflow: hidden;
}
.tct-h-fill {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--lt-brand), var(--lt-brand-light-2));
  transition: width 0.5s ease;
}
.tct-h-arrow {
  font-size: 12px;
  color: var(--lt-text-placeholder);
  transition: transform 0.25s ease;
  flex-shrink: 0;
}
.tct-h-arrow.rotated {
  transform: rotate(180deg);
}

/* ===== 时间线体 ===== */
.tct-body {
  padding: 0 14px 10px;
  display: flex;
  flex-direction: column;
}

/* ===== 行 ===== */
.tct-row {
  display: flex;
  gap: 10px;
}

/* ===== 标记列 ===== */
.tct-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 28px;
  flex-shrink: 0;
}
.tct-row:last-child .tct-marker {
  /* last row — no padding needed after line */
}
.tct-dot {
  position: relative;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}
.tct-dot-icon {
  font-size: 13px;
  line-height: 1;
  position: relative;
  z-index: 1;
  transition: transform 0.3s ease;
}
.tct-dot-green {
  background-color: rgba(52, 199, 89, 0.12) !important;
}
.tct-dot-badge {
  position: absolute;
  bottom: -2px;
  right: -3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: var(--lt-success);
  color: #fff;
  font-size: 8px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  z-index: 2;
  box-shadow: 0 0 0 2px var(--lt-bg-card);
}
.tct-line {
  width: 2px;
  flex: 1;
  min-height: 20px;
  border-radius: 2px;
  margin-top: 4px;
  background-color: var(--lt-border);
  transition: background-color 0.35s;
}
.tct-line.tct-line-done {
  background-color: rgba(52, 199, 89, 0.2);
}
.tct-ring {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  animation: ring-pulse 1.5s ease-out infinite;
}
@keyframes ring-pulse {
  0% { box-shadow: 0 0 0 0 rgba(43, 111, 255, 0.2); }
  100% { box-shadow: 0 0 0 10px rgba(43, 111, 255, 0); }
}

/* ===== 内容列 ===== */
.tct-content {
  flex: 1;
  min-width: 0;
  padding-top: 3px;
  padding-bottom: 10px;
}
.tct-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.tct-label {
  font-size: 13px;
  font-weight: 500;
  transition: color 0.3s;
}

/* ===== 确信度徽章 ===== */
.tct-badge {
  flex-shrink: 0;
  font-size: 10px;
  padding: 0 6px;
  border-radius: 4px;
  line-height: 1.6;
}
.badge-high {
  background-color: rgba(52, 199, 89, 0.12);
  color: var(--lt-success);
}
.badge-medium {
  background-color: rgba(255, 159, 10, 0.12);
  color: var(--lt-warning);
}
.badge-low {
  background-color: rgba(245, 108, 108, 0.12);
  color: var(--lt-danger);
}

/* ===== 推理卡片 ===== */
.tct-card {
  margin-top: 6px;
  background-color: var(--lt-bg-page);
  border: 1px solid var(--lt-border);
  border-radius: 8px;
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.tct-r-line {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  font-size: 12px;
  line-height: 1.5;
}
.tct-r-key {
  flex-shrink: 0;
  font-weight: 600;
  font-size: 10px;
  padding: 0 4px;
  border-radius: 3px;
  line-height: 1.6;
  background-color: rgba(43, 111, 255, 0.08);
  color: var(--lt-brand);
}
.tct-r-line :deep(.markdown-content) {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--lt-text-secondary);
}
.tct-r-line :deep(.markdown-content p) {
  margin: 4px 0;
}
.tct-r-line :deep(.markdown-content code) {
  font-size: 11px;
}
.tct-r-line :deep(.markdown-content pre) {
  font-size: 11px;
  padding: 8px;
  margin: 6px 0;
}

/* ===== 工具步骤详情 ===== */
.tct-detail {
  margin-top: 4px;
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  line-height: 1.5;
}

/* ===== 等待中 ===== */
.tct-waiting {
  margin-top: 4px;
  font-size: 11px;
  color: var(--lt-text-disabled);
}

/* ===== 步骤状态样式 ===== */
/* pending */
.tct-pending .tct-dot {
  background-color: var(--lt-bg-page);
}
.tct-pending .tct-dot-icon {
  opacity: 0.35;
  filter: grayscale(1);
}
.tct-pending .tct-label {
  color: var(--lt-text-placeholder);
}

/* active — 推理步骤（蓝色） */
.tct-cat-reasoning.tct-active .tct-dot {
  background-color: var(--lt-brand-light-9);
  box-shadow: 0 0 0 4px rgba(43, 111, 255, 0.12);
}
.tct-cat-reasoning.tct-active .tct-dot-icon {
  transform: scale(1.15);
}
.tct-cat-reasoning.tct-active .tct-label {
  color: var(--lt-brand);
  font-weight: 600;
}

/* active — 工具步骤（紫色） */
.tct-cat-tool_call.tct-active .tct-dot {
  background-color: var(--lt-ai-light-9, rgba(124, 92, 252, 0.08));
  box-shadow: 0 0 0 4px rgba(124, 92, 252, 0.15);
}
.tct-cat-tool_call.tct-active .tct-dot-icon {
  transform: scale(1.15);
}
.tct-cat-tool_call.tct-active .tct-label {
  color: var(--lt-ai, #7C5CFC);
  font-weight: 600;
}

/* error — 红色（done 状态覆盖） */
.tct-cat-error .tct-dot {
  background-color: rgba(245, 108, 108, 0.12);
}
.tct-cat-error .tct-dot-icon {
  color: var(--lt-danger);
}
.tct-cat-error .tct-label {
  color: var(--lt-danger);
  font-weight: 600;
}
.tct-cat-error .tct-detail {
  color: var(--lt-danger);
}

/* done */
.tct-done .tct-dot {
  background-color: rgba(52, 199, 89, 0.08);
}
.tct-done .tct-dot-icon {
  filter: none;
  opacity: 1;
}
.tct-done .tct-label {
  color: var(--lt-text-auxiliary);
}

/* ===== 过渡动画 ===== */
.tct-slide-enter-active,
.tct-slide-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}
.tct-slide-enter-from,
.tct-slide-leave-to {
  opacity: 0;
  max-height: 0;
}
.tct-slide-enter-to,
.tct-slide-leave-from {
  opacity: 1;
  max-height: 600px;
}
</style>
