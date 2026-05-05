<template>
  <div class="pipeline-stepper bg-white p-6 rounded-lg shadow-sm border border-slate-200">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-medium text-slate-800">多智能体协同流水线</h3>
      <span v-if="taskId" class="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Task ID: {{ taskId }}</span>
    </div>
    
    <el-steps :active="activeStep" finish-status="success" class="mb-6">
      <el-step v-for="(step, index) in steps" :key="step.key" :title="step.label">
        <template #description>
          <div v-if="activeStep === index" class="mt-2 text-primary font-medium">
            {{ message || '进行中...' }}
            <el-progress v-if="percent > 0" :percentage="percent" :show-text="false" class="mt-1" />
          </div>
          <div v-else-if="activeStep > index" class="text-xs text-slate-400 mt-2">
            已完成
          </div>
          <div v-else class="text-xs text-slate-400 mt-2">
            等待中
          </div>
        </template>
      </el-step>
    </el-steps>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  stage: string
  percent: number
  message: string
  taskId?: string
}>()

const steps = [
  { key: 'profile', label: '建画像' },
  { key: 'retrieve', label: '检索证据' },
  { key: 'plan', label: '规划' },
  { key: 'generate', label: '生成' },
  { key: 'review', label: '审校' },
  { key: 'publish', label: '发布' }
]

const activeStep = computed(() => {
  const index = steps.findIndex(s => s.key === props.stage)
  return index >= 0 ? index : 0
})
</script>