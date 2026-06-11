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
          class="w-7 h-7 rounded-lg flex items-center justify-center"
          :style="{
            background: isAiStep
              ? 'linear-gradient(135deg, var(--lt-ai), var(--lt-ai-dark-2))'
              : 'linear-gradient(135deg, var(--lt-orange), var(--color-secondary-light-3, #E67A30))'
          }"
        >
          <el-icon size="14" color="white"><Connection /></el-icon>
        </div>
        <h3 class="text-base font-semibold" style="color: var(--lt-text-primary);">多智能体协同流水线</h3>
      </div>
      <span
        v-if="taskId"
        class="text-xs px-3 py-1 rounded-full border font-mono"
        :style="{
          color: 'var(--lt-text-auxiliary)',
          backgroundColor: 'var(--lt-bg-page)',
          borderColor: 'var(--lt-border)'
        }"
      >
        #{{ taskId }}
      </span>
    </div>

    <el-steps
      :active="activeStep"
      finish-status="success"
      class="mb-6"
      :style="{
        '--el-step-title-font-size': '13px',
        '--el-color-primary': isAiStep ? 'var(--lt-ai)' : 'var(--lt-orange)'
      }"
    >
      <el-step
        v-for="(step, index) in steps"
        :key="step.key"
        :title="step.label"
        :style="{ '--el-step-main-font-size': '13px' }"
      >
        <template #description>
          <!-- 进行中 -->
          <div
            v-if="activeStep === index"
            class="mt-2 font-medium text-sm"
            :style="{ color: 'var(--step-color)' }"
          >
            <span class="inline-flex items-center gap-1.5">
              <span
                class="w-1.5 h-1.5 rounded-full"
                :class="isAiStep ? 'ai-pulse' : 'cursor-pulse'"
                :style="{ backgroundColor: 'var(--step-color)' }"
              ></span>
              {{ message || '进行中...' }}
            </span>
            <el-progress
              v-if="percent > 0"
              :percentage="percent"
              :show-text="false"
              class="mt-2"
              :color="isAiStep ? 'var(--lt-ai)' : 'var(--lt-orange)'"
            />
          </div>
          <!-- 已完成 -->
          <div
            v-else-if="activeStep > index"
            class="text-xs mt-2 flex items-center gap-1"
            style="color: var(--el-color-success);"
          >
            <el-icon size="12"><CircleCheckFilled /></el-icon>
            已完成
          </div>
          <!-- 等待中 -->
          <div v-else class="text-xs mt-2" style="color: var(--lt-text-placeholder);">
            等待中
          </div>
        </template>
      </el-step>
    </el-steps>

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