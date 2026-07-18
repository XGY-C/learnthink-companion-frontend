<template>
  <div
    class="task-card rounded-xl border cursor-pointer card-elevated"
    :style="cardStyle"
    @click="$emit('click')"
  >
    <!-- 顶部：状态 + 时间 -->
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <span
          class="w-2 h-2 rounded-full flex-shrink-0"
          :style="{ backgroundColor: statusConfig.color }"
        />
        <span class="text-xs font-medium" :style="{ color: statusConfig.color }">
          {{ statusConfig.label }}
        </span>
      </div>
      <span class="text-[11px]" style="color: var(--lt-text-placeholder);">
        {{ relativeTime }}
      </span>
    </div>

    <!-- 标题 -->
    <h4 class="text-[15px] font-semibold mb-1 truncate" style="color: var(--lt-text-primary);">
      {{ topic }}
    </h4>
    <p v-if="courseName" class="text-[11px] mb-3 truncate" style="color: var(--lt-text-auxiliary);">
      {{ courseName }}
    </p>

    <!-- 进行中：进度条 -->
    <div v-if="status === 'RUNNING'" class="mb-2">
      <div class="flex justify-between text-[11px] mb-1" style="color: var(--lt-text-auxiliary);">
        <span>{{ stageLabel }}</span>
        <span>{{ percent }}%</span>
      </div>
      <div class="h-1.5 rounded-full w-full" style="background-color: var(--lt-bg-page);">
        <div
          class="h-1.5 rounded-full transition-all duration-500"
          :style="{ width: percent + '%', backgroundColor: statusConfig.color }"
        />
      </div>
    </div>

    <!-- 已完成：资源信息 -->
    <div v-if="status === 'SUCCEEDED'" class="flex items-center gap-4 text-[11px]" style="color: var(--lt-text-auxiliary);">
      <span>{{ resourceCount }} 项资源</span>
      <span v-if="resourceTypes.length > 0">{{ resourceTypes.length }} 类</span>
    </div>

    <!-- 失败：错误信息 -->
    <div v-if="status === 'FAILED' && errorMessage" class="text-[11px] truncate" style="color: var(--lt-danger);">
      {{ errorMessage }}
    </div>

    <!-- 资源类型标签 -->
    <div v-if="resourceTypes.length > 0" class="flex flex-wrap gap-1 mt-3">
      <span
        v-for="t in resourceTypes"
        :key="t"
        class="text-[10px] px-1.5 py-0.5 rounded"
        :style="{ backgroundColor: typeTagBg(t), color: typeTagColor(t) }"
      >{{ typeLabel(t) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TaskSummary } from '@/types'
import { TASK_STATUS_CONFIG, TASK_STAGE_LABEL, RESOURCE_TYPE_LABEL, formatRelativeTime } from '@/constants'

const props = defineProps<{
  task: TaskSummary
  courseName?: string
}>()

defineEmits<{
  click: []
}>()

const status = computed(() => props.task.status)
const topic = computed(() => props.task.topic || '未命名任务')
const percent = computed(() => props.task.percent ?? 0)
const resourceTypes = computed(() => props.task.resourceTypes ?? [])
const resourceCount = computed(() => props.task.resourceCount ?? 0)
const errorMessage = computed(() => props.task.errorMessage)

const statusConfig = computed(() => TASK_STATUS_CONFIG[status.value] ?? TASK_STATUS_CONFIG.PENDING)
const stageLabel = computed(() => {
  const s = props.task.stage
  return s ? (TASK_STAGE_LABEL[s] || s) : ''
})
const relativeTime = computed(() => formatRelativeTime(props.task.createdAt) || '')

const cardStyle = computed(() => ({
  backgroundColor: 'var(--lt-bg-card)',
  borderColor: 'var(--lt-border)',
}))

function typeLabel(t: string): string {
  return RESOURCE_TYPE_LABEL[t] || t
}

function typeTagBg(t: string): string {
  const map: Record<string, string> = {
    doc: 'rgba(43,111,255,0.08)',
    quiz: 'rgba(34,197,94,0.08)',
    code: 'rgba(239,68,68,0.08)',
    mindmap: 'rgba(245,158,11,0.08)',
    reading: 'rgba(139,92,246,0.08)',
    html: 'rgba(124,92,252,0.08)',
  }
  return map[t] || 'var(--lt-bg-page)'
}

function typeTagColor(t: string): string {
  const map: Record<string, string> = {
    doc: 'var(--lt-brand)',
    quiz: 'var(--lt-success)',
    code: 'var(--lt-danger)',
    mindmap: 'var(--lt-warning)',
    reading: 'var(--lt-ai)',
    html: 'var(--lt-ai)',
  }
  return map[t] || 'var(--lt-text-auxiliary)'
}
</script>

<style scoped>
.task-card {
  padding: 16px;
}
</style>
