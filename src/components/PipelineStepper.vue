<template>
  <div
    class="pipeline-stepper p-6 rounded-lg border"
    :class="isAiStep ? 'ai-step-active' : 'orange-step-active'"
    :style="{
      backgroundColor: 'var(--lt-bg-card)',
      borderColor: 'var(--lt-border)',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
      '--step-color': isAiStep ? 'var(--lt-ai)' : 'var(--lt-orange)',
    }"
  >
    <div class="flex items-center justify-between mb-5">
      <div class="flex items-center gap-2.5">
        <div
          class="ps-header-icon"
          :style="{
            background: isAiStep ? 'var(--lt-ai-light-9)' : 'var(--lt-orange-light-9)',
            color: isAiStep ? 'var(--lt-ai)' : 'var(--lt-orange)'
          }"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="16" y="16" width="6" height="6" rx="1"></rect>
            <rect x="2" y="16" width="6" height="6" rx="1"></rect>
            <rect x="9" y="2" width="6" height="6" rx="1"></rect>
            <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"></path>
            <path d="M12 12V8"></path>
          </svg>
        </div>
        <h3 class="text-base font-semibold" style="color: var(--lt-text-primary);">多智能体协同流水线</h3>
      </div>

    </div>

    <div class="ps-steps">
      <div
        v-for="(step, index) in steps"
        :key="step.key"
        class="ps-step"
        :class="[
          index < activeStep ? 'ps-step-done' : index === activeStep ? 'ps-step-active' : 'ps-step-pending',
          isAiStep && index === activeStep ? 'step-ai' : index === activeStep ? 'step-orange' : ''
        ]"
        :style="index === activeStep ? { '--ps-color': 'var(--step-color)' } as any : {}"
      >
        <div class="ps-step-node">
          <div class="ps-step-dot">
            <span v-if="index < activeStep" class="ps-dot-icon">✓</span>
            <span v-else-if="index === activeStep" class="ps-dot-ring"></span>
            <span v-else class="ps-dot-icon">○</span>
          </div>
          <div v-if="index < steps.length - 1" class="ps-step-line" :class="{ 'line-done': index < activeStep }"></div>
        </div>
        <div class="ps-step-content">
          <span class="ps-step-title">{{ step.label }}</span>
          <!-- 进行中 -->
          <div v-if="activeStep === index" class="ps-step-desc">
            <span>{{ message || '进行中...' }}</span>
            <el-progress
              v-if="percent > 0"
              :percentage="percent"
              :show-text="false"
              class="mt-1.5"
              :stroke-width="3"
              :color="isAiStep ? 'var(--lt-ai)' : 'var(--lt-orange)'"
            />
          </div>
          <!-- 已完成 -->
          <div v-else-if="activeStep > index" class="ps-step-desc done">
            <el-icon size="11"><CircleCheckFilled /></el-icon>
            已完成
          </div>
          <!-- 等待中 -->
          <div v-else class="ps-step-desc pending">
            等待中
          </div>
        </div>
      </div>
    </div>

    <!-- 流水线状态条 -->
    <div
      class="flex items-center gap-2 mt-2 pt-4"
      :style="{
        borderTop: '1px solid var(--lt-border)'
      }"
    >
      <div class="flex-1 h-1.5 rounded-full overflow-hidden" style="background-color: #E8ECF0;">
        <div
          class="h-full rounded-full transition-all duration-700 ease-out"
          :style="{
            width: `${Math.round((activeStep + 1) / steps.length * 100)}%`,
            backgroundColor: 'var(--step-color)'
          }"
        ></div>
      </div>
      <span
        class="text-xs font-medium"
        :style="{ color: 'var(--step-color)' }"
      >
        {{ Math.round((activeStep + 1) / steps.length * 100) }}%
      </span>
      <span
        v-if="eta"
        class="text-xs ml-2"
        style="color: var(--lt-text-auxiliary);"
      >
        {{ eta }}
      </span>
    </div>
  </div>
</template>

<style scoped>
/* ── Header icon (matches ChecklistPanel / AgentActivityPanel style) ── */
.ps-header-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.35s, color 0.35s;
}

/* ── Custom step nodes (replaces el-steps for better state control) ── */
.ps-steps {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-bottom: 20px;
  padding: 0 4px;
}
.ps-step {
  display: flex;
  gap: 10px;
  min-height: 44px;
}
.ps-step-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 22px;
  flex-shrink: 0;
}
.ps-step-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  z-index: 1;
}
.ps-step-done .ps-step-dot {
  background: var(--lt-success);
  color: #fff;
}
.ps-step-active .ps-step-dot {
  background: var(--lt-bg-card);
  border: 2.5px solid var(--ps-color, var(--lt-brand));
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--ps-color, var(--lt-brand)) 15%, transparent);
}
.ps-step-pending .ps-step-dot {
  background: var(--lt-bg-page);
  border: 2px solid var(--lt-border);
}
.ps-dot-icon {
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}
.ps-step-pending .ps-dot-icon {
  color: var(--lt-text-placeholder);
  font-size: 8px;
}
.ps-dot-ring {
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ps-color, var(--lt-brand));
  animation: ps-pulse 1.5s ease-in-out infinite;
}
@keyframes ps-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(0.7); opacity: 0.6; }
}
.ps-step-line {
  width: 2px;
  flex: 1;
  min-height: 16px;
  border-radius: 2px;
  background: var(--lt-border);
  margin-top: 2px;
  transition: background 0.35s;
}
.ps-step-line.line-done {
  background: var(--lt-success);
}
.ps-step:last-child .ps-step-line {
  display: none;
}

/* Step content */
.ps-step-content {
  flex: 1;
  min-width: 0;
  padding-top: 1px;
  padding-bottom: 8px;
}
.ps-step-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--lt-text-primary);
  transition: color 0.3s;
}
.ps-step-done .ps-step-title {
  color: var(--lt-text-auxiliary);
}
.ps-step-pending .ps-step-title {
  color: var(--lt-text-placeholder);
}
.ps-step-active .ps-step-title {
  color: var(--ps-color, var(--lt-brand));
  font-weight: 600;
}
.ps-step-desc {
  font-size: 12px;
  margin-top: 4px;
  line-height: 1.4;
}
.ps-step-active .ps-step-desc {
  color: var(--ps-color, var(--lt-brand));
}
.ps-step-desc.done {
  color: var(--lt-success);
  display: flex;
  align-items: center;
  gap: 4px;
}
.ps-step-desc.pending {
  color: var(--lt-text-placeholder);
}

/* ── Mobile adaptation (max-width: 768px) ── */
@media (max-width: 768px) {
  .pipeline-stepper {
    padding: 16px;
  }
  .ps-step-title {
    font-size: 14px;
  }
  .ps-step-desc {
    font-size: 13px;
  }
}
</style>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  stage: string
  percent: number
  message: string
  taskId?: string
}>()

const startTime = ref(Date.now())
watch(() => props.taskId, (tid) => {
  if (tid) startTime.value = Date.now()
}, { immediate: true })

const eta = computed(() => {
  const pct = props.percent || 0
  if (pct <= 0 || pct >= 100) return ''
  const elapsed = (Date.now() - startTime.value) / 1000
  const total = elapsed / (pct / 100)
  const remaining = Math.max(0, total - elapsed)
  if (remaining < 5) return '即将完成'
  if (remaining < 60) return `预计剩余 ${Math.round(remaining)} 秒`
  return `预计剩余 ${Math.round(remaining / 60)} 分钟`
})

const steps = [
  { key: 'profile', label: '建画像' },
  { key: 'retrieve', label: '检索证据' },
  { key: 'plan', label: '规划' },
  { key: 'generate', label: '生成' },
  { key: 'review', label: '审校' },
  { key: 'publish', label: '发布' }
]

// AI 模型阶段（使用紫色）：plan / generate
// 个性化决策阶段（使用橙色）：profile / retrieve / review / publish
const AI_STAGES = new Set(['plan', 'generate'])

// 后端使用 -ING 形式（如 GENERATING），前端 steps 使用名词形式（如 generate）
const STAGE_MAP: Record<string, string> = {
  profiling: 'profile',
  retrieving: 'retrieve',
  planning: 'plan',
  plan_driven: 'plan',
  generating: 'generate',
  reviewing: 'review',
  publishing: 'publish',
  fallback: 'retrieve',
}

const normalizedStage = computed(() => {
  const raw = props.stage.toLowerCase()
  return STAGE_MAP[raw] || raw
})

const isAiStep = computed(() => AI_STAGES.has(normalizedStage.value))

const activeStep = computed(() => {
  const index = steps.findIndex(s => s.key === normalizedStage.value)
  return index >= 0 ? index : 0
})
</script>