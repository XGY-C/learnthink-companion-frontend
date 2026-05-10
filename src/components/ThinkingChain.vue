<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'

export interface ThinkingStepDef {
  key: string
  icon: string
  label: string
  description: string
}

const STEPS: ThinkingStepDef[] = [
  { key: 'understand', icon: '💡', label: '理解意图',        description: '' },
  { key: 'retrieve',  icon: '🔗', label: '检索知识',        description: '' },
  { key: 'profile',   icon: '🎯', label: '匹配画像',        description: '' },
  { key: 'generate',  icon: '✦',  label: '组织回复',        description: '' },
  { key: 'review',    icon: '🛡️', label: '安全审校',        description: '' },
]

const props = withDefaults(defineProps<{
  active?: boolean
  step?: number
  /** 当前步骤的描述文本 */
  description?: string
  /** 所有步骤的描述缓存（完成后可展开回顾） */
  stepDescriptions?: Record<number, string>
}>(), {
  active: false,
  step: 0,
  description: '',
  stepDescriptions: () => ({}),
})

const emit = defineEmits<{
  (e: 'done'): void
}>()

const expanded = ref(true)       // 进行中默认展开，完成后自动折叠
const visible = ref(props.active)
const allDone = ref(false)        // 是否全部完成

const completed = computed(() => Math.min(props.step, STEPS.length))

// 描述缓存：当前步的描述存入 stepDescriptions
const descriptions = computed(() => {
  const map: Record<number, string> = { ...props.stepDescriptions }
  if (props.description && props.step > 0) {
    map[props.step] = props.description
  }
  return map
})

let doneTimer: ReturnType<typeof setTimeout> | undefined

watch(() => props.active, (val) => {
  if (val) {
    visible.value = true
    allDone.value = false
    expanded.value = true
  }
})

watch(completed, (val) => {
  if (val >= STEPS.length && props.active) {
    allDone.value = true
    expanded.value = false     // 完成后自动折叠
    doneTimer = setTimeout(() => {
      emit('done')
    }, 400)
  }
})

onUnmounted(() => {
  if (doneTimer) clearTimeout(doneTimer)
})

function stepStatus(index: number): 'done' | 'active' | 'pending' {
  if (index < completed.value) return 'done'
  if (index === completed.value && props.active) return 'active'
  return 'pending'
}

function stepDesc(index: number): string {
  const key = index + 1  // step 序号从 1 开始
  return descriptions.value[key] || ''
}
</script>

<template>
  <Transition name="think-fade">
    <div v-if="visible" class="thinking-card" :class="{ 'is-done': allDone }">
      <!-- 头部：状态 + 折叠按钮 -->
      <button class="tc-header" @click="expanded = !expanded">
        <span class="tc-header-left">
          <span v-if="!allDone" class="tc-dot-pulse" />
          <span v-else class="tc-check">✓</span>
          <span class="tc-header-title">
            {{ allDone ? `思考过程 · ${completed}/${STEPS.length} 完成` : '思考中...' }}
          </span>
        </span>
        <span class="tc-header-arrow" :class="{ rotated: expanded }">▾</span>
      </button>

      <!-- 步骤列表（纵向） -->
      <Transition name="think-expand">
        <div v-if="expanded" class="tc-step-list">
          <div
            v-for="(s, i) in STEPS"
            :key="s.key"
            class="tc-step-row"
            :class="`step-${stepStatus(i)}`"
          >
            <!-- 左侧：时间轴节点 -->
            <div class="tc-step-marker">
              <div class="tc-step-dot">
                <span v-if="stepStatus(i) === 'done'" class="tc-step-icon">✓</span>
                <span v-else class="tc-step-icon">{{ s.icon }}</span>
                <span v-if="stepStatus(i) === 'active'" class="tc-pulse-ring" />
              </div>
              <div v-if="i < STEPS.length - 1" class="tc-step-line" :class="{ 'line-done': stepStatus(i) === 'done' }" />
            </div>
            <!-- 右侧：内容 -->
            <div class="tc-step-body">
              <span class="tc-step-label">{{ s.label }}</span>
              <p v-if="stepDesc(i)" class="tc-step-desc" v-html="stepDesc(i)" />
              <p v-else-if="stepStatus(i) === 'pending'" class="tc-step-waiting">等待中...</p>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
.thinking-card {
  margin: 0 20px 8px;
  border-radius: 14px;
  background-color: var(--lt-bg-page);
  border: 1px solid var(--lt-border);
  overflow: hidden;
  user-select: none;
  transition: border-color 0.3s;
}
.thinking-card.is-done {
  border-color: rgba(52, 199, 89, 0.15);
  background-color: rgba(52, 199, 89, 0.03);
}

/* 头部 */
.tc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
}
.tc-header:hover {
  background-color: rgba(0,0,0,0.02);
}
.tc-header-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.tc-dot-pulse {
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
.tc-check {
  font-size: 12px;
  font-weight: 700;
  color: var(--lt-success);
}
.tc-header-title {
  font-weight: 600;
  color: var(--lt-text-secondary);
  letter-spacing: 0.2px;
}
.is-done .tc-header-title {
  color: var(--lt-text-auxiliary);
}
.tc-header-arrow {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  transition: transform 0.25s ease;
}
.tc-header-arrow.rotated {
  transform: rotate(180deg);
}

/* 步骤列表 */
.tc-step-list {
  padding: 0 16px 12px;
  display: flex;
  flex-direction: column;
}

/* 每行 */
.tc-step-row {
  display: flex;
  gap: 12px;
}
.tc-step-row:last-child .tc-step-marker {
  padding-bottom: 0;
}

/* 左侧：标记 */
.tc-step-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 28px;
  flex-shrink: 0;
  padding-bottom: 4px;
}
.tc-step-dot {
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
.tc-step-icon {
  font-size: 13px;
  line-height: 1;
  position: relative;
  z-index: 1;
  transition: transform 0.3s ease;
}
.tc-step-line {
  width: 2px;
  flex: 1;
  min-height: 20px;
  border-radius: 2px;
  margin-top: 4px;
  background-color: var(--lt-border);
  transition: background-color 0.35s;
}
.tc-step-line.line-done {
  background-color: rgba(52, 199, 89, 0.2);
}

/* 右侧：内容 */
.tc-step-body {
  flex: 1;
  min-width: 0;
  padding-top: 3px;
  padding-bottom: 12px;
}
.tc-step-label {
  font-size: 13px;
  font-weight: 500;
  display: block;
  transition: color 0.3s;
}
.tc-step-desc {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--lt-text-secondary);
  transition: color 0.3s;
}
.tc-step-desc :deep(b) {
  color: var(--lt-text-primary);
  font-weight: 600;
}
.tc-step-waiting {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--lt-text-disabled);
}

/* === 状态：pending === */
.step-pending .tc-step-dot {
  background-color: var(--lt-bg-page);
}
.step-pending .tc-step-icon {
  opacity: 0.35;
  filter: grayscale(1);
}
.step-pending .tc-step-label {
  color: var(--lt-text-placeholder);
}

/* === 状态：active === */
.step-active .tc-step-dot {
  background-color: var(--lt-brand-lightest);
  box-shadow: 0 0 0 4px rgba(43, 111, 255, 0.12);
}
.step-active .tc-step-icon {
  transform: scale(1.15);
}
.step-active .tc-step-label {
  color: var(--lt-brand);
  font-weight: 600;
}
.step-active .tc-pulse-ring {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  opacity: 1;
  animation: ring-pulse 1.5s ease-out infinite;
}
@keyframes ring-pulse {
  0% { box-shadow: 0 0 0 0 rgba(43, 111, 255, 0.2); }
  100% { box-shadow: 0 0 0 10px rgba(43, 111, 255, 0); }
}

/* === 状态：done === */
.step-done .tc-step-dot {
  background-color: rgba(52, 199, 89, 0.08);
}
.step-done .tc-step-icon {
  filter: none;
  opacity: 1;
  font-weight: 700;
  color: var(--lt-success);
}
.step-done .tc-step-label {
  color: var(--lt-text-auxiliary);
}
.step-done .tc-step-desc {
  color: var(--lt-text-auxiliary);
}

/* === 过渡动画 === */
.think-fade-enter-active { transition: all 0.3s ease; }
.think-fade-leave-active { transition: all 0.3s ease; }
.think-fade-enter-from { opacity: 0; transform: translateY(-8px); }
.think-fade-leave-to { opacity: 0; transform: translateY(-6px); }

.think-expand-enter-active,
.think-expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}
.think-expand-enter-from,
.think-expand-leave-to {
  opacity: 0;
  max-height: 0;
}
.think-expand-enter-to,
.think-expand-leave-from {
  opacity: 1;
  max-height: 400px;
}
</style>
