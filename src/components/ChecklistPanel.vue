<template>
  <div class="checklist-panel" v-if="checklist">
    <div class="panel-header">
      <h3>资源生成清单</h3>
      <span class="progress-text">{{ doneCount + failedCount }}/{{ totalCount }} 完成</span>
    </div>

    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: percent + '%' }"></div>
    </div>

    <div class="checklist-items">
      <div
        v-for="item in items"
        :key="item.title"
        class="checklist-item"
        :class="'status-' + item.status"
      >
        <span class="status-icon">
          <span v-if="item.status === 'pending'" class="icon-pending"></span>
          <span v-else-if="item.status === 'generating'" class="icon-generating"></span>
          <span v-else-if="item.status === 'done'" class="icon-done">&#10003;</span>
          <span v-else-if="item.status === 'failed'" class="icon-failed">&#10007;</span>
        </span>
        <div class="item-info">
          <span class="item-type" :class="'type-' + item.type">{{ typeLabel(item.type) }}</span>
          <span class="item-title">{{ item.title }}</span>
          <span class="item-meta">{{ item.difficulty }} &middot; ~{{ item.estimatedMinutes }}min</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface ChecklistItem {
  type: string
  title: string
  description?: string
  difficulty: string
  estimatedMinutes: number
  status: 'pending' | 'generating' | 'done' | 'failed'
}

const props = defineProps<{
  checklist: {
    items: ChecklistItem[]
    totalCount: number
    doneCount: number
    failedCount: number
    generatingCount: number
  } | null
}>()

const items = computed(() => props.checklist?.items ?? [])
const doneCount = computed(() => props.checklist?.doneCount ?? 0)
const failedCount = computed(() => props.checklist?.failedCount ?? 0)
const totalCount = computed(() => props.checklist?.totalCount ?? 0)

const percent = computed(() => {
  if (totalCount.value === 0) return 0
  return Math.round(((doneCount.value + failedCount.value) / totalCount.value) * 100)
})

const typeLabel = (type: string) => {
  const map: Record<string, string> = {
    doc: '文档', quiz: '习题', reading: '阅读材料',
    code: '代码', mindmap: '思维导图', video: '视频',
  }
  return map[type] || type
}
</script>

<style scoped>
.checklist-panel {
  background: var(--el-bg-color);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  border: 1px solid var(--el-border-color-light);
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.panel-header h3 { margin: 0; font-size: 15px; font-weight: 600; }
.progress-text { font-size: 13px; color: var(--el-text-color-secondary); }
.progress-bar {
  height: 4px;
  background: var(--el-fill-color);
  border-radius: 2px;
  margin-bottom: 16px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--lt-brand, #2B6FFF);
  border-radius: 2px;
  transition: width 0.3s ease;
}
.checklist-items { display: flex; flex-direction: column; gap: 8px; }
.checklist-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
  transition: background 0.2s;
}
.checklist-item.status-generating { background: rgba(124, 92, 252, 0.08); }
.checklist-item.status-done { background: rgba(103, 194, 58, 0.06); }
.checklist-item.status-failed { background: rgba(245, 108, 108, 0.06); }
.status-icon { width: 20px; text-align: center; font-size: 14px; }
.icon-pending { display: inline-block; width: 8px; height: 8px; border-radius: 50%; border: 2px solid #ccc; }
.icon-generating { display: inline-block; width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--lt-brand); border-top-color: transparent; animation: spin 0.8s linear infinite; }
.icon-done { color: #67c23a; font-weight: bold; }
.icon-failed { color: #f56c6c; font-weight: bold; }
.item-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; flex: 1; }
.item-type {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
  color: #fff;
}
.type-doc { background: #2B6FFF; }
.type-quiz { background: #FF8C42; }
.type-reading { background: #7C5CFC; }
.type-code { background: #2F855A; }
.type-mindmap { background: #E53E3E; }
.type-video { background: #D53F8C; }
.item-title { font-size: 13px; color: var(--el-text-color-primary); }
.item-meta { font-size: 11px; color: var(--el-text-color-placeholder); margin-left: auto; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
