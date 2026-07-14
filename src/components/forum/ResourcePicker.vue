<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useForumStore } from '@/stores/forum'
import type { ForumResource } from '@/types/forum'
import { Search, Document, Reading, List, Monitor } from '@element-plus/icons-vue'

const emit = defineEmits<{
  (e: 'select', resources: ForumResource[]): void
  (e: 'close'): void
}>()

const store = useForumStore()
const selected = ref<ForumResource[]>([])
const filterType = ref('all')
const searchQuery = ref('')

const typeMeta: Record<string, { icon: any; label: string }> = {
  document: { icon: Document, label: '文档' },
  exercise: { icon: List, label: '习题' },
  reading: { icon: Reading, label: '阅读' },
  code: { icon: Monitor, label: '代码' },
  mindmap: { icon: Document, label: '思维导图' },
}

const filteredResources = computed(() => {
  let list = store.availableResources
  if (filterType.value !== 'all') {
    list = list.filter(r => r.type === filterType.value)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(r => r.title.toLowerCase().includes(q))
  }
  return list
})

import { computed } from 'vue'

function toggleSelect(r: ForumResource) {
  const idx = selected.value.findIndex(s => s.resourceItemId === r.resourceItemId)
  if (idx >= 0) selected.value.splice(idx, 1)
  else selected.value.push(r)
}

function confirm() {
  emit('select', [...selected.value])
}

onMounted(() => {
  store.fetchAvailableResources()
})
</script>

<template>
  <div class="resource-picker">
    <div class="picker-header">
      <h3 class="text-base font-semibold m-0">关联系统资源</h3>
      <el-button text @click="emit('close')">✕</el-button>
    </div>

    <div class="picker-body">
      <div class="flex items-center gap-2 mb-3">
        <el-input
          v-model="searchQuery"
          placeholder="搜索资源..."
          :prefix-icon="Search"
          size="small"
          class="flex-1"
          clearable
        />
      </div>

      <div class="flex gap-2 mb-3 flex-wrap">
        <button
          class="filter-chip"
          :class="{ active: filterType === 'all' }"
          @click="filterType = 'all'"
        >全部</button>
        <button
          v-for="(meta, key) in typeMeta" :key="key"
          class="filter-chip"
          :class="{ active: filterType === key }"
          @click="filterType = key"
        >{{ meta.label }}</button>
      </div>

      <div class="resource-list">
        <div
          v-for="r in filteredResources" :key="r.resourceItemId"
          class="resource-item"
          :class="{ selected: selected.some(s => s.resourceItemId === r.resourceItemId) }"
          @click="toggleSelect(r)"
        >
          <div class="flex items-center gap-3">
            <el-checkbox
              :model-value="selected.some(s => s.resourceItemId === r.resourceItemId)"
              @click.stop
              @change="toggleSelect(r)"
            />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate m-0">{{ r.title }}</p>
              <p class="text-xs m-0" style="color: var(--lt-text-auxiliary);">{{ typeMeta[r.type]?.label || r.type }}</p>
            </div>
          </div>
        </div>
        <div v-if="filteredResources.length === 0" class="text-center py-6 text-sm" style="color: var(--lt-text-auxiliary);">
          暂无可用资源
        </div>
      </div>
    </div>

    <div class="picker-footer flex items-center justify-between">
      <span class="text-sm" style="color: var(--lt-text-auxiliary);">已选 {{ selected.length }} 项</span>
      <div class="flex gap-2">
        <el-button @click="emit('close')">取消</el-button>
        <el-button type="primary" @click="confirm">确认关联</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.resource-picker {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--lt-border);
}
.picker-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}
.picker-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--lt-border);
  background: var(--lt-bg-card);
}
.filter-chip {
  padding: 3px 12px;
  border-radius: 14px;
  font-size: 12px;
  border: 1px solid var(--lt-border);
  cursor: pointer;
  background: var(--lt-bg-card);
  color: var(--lt-text-secondary);
  transition: all var(--lt-transition-base);
}
.filter-chip:hover, .filter-chip.active {
  border-color: var(--lt-brand);
  color: var(--lt-brand);
  background: var(--lt-brand-lightest);
}
.resource-item {
  padding: 10px 12px;
  border-radius: var(--lt-radius-md);
  cursor: pointer;
  transition: all var(--lt-transition-base);
}
.resource-item:hover {
  background: var(--lt-brand-lightest);
}
.resource-item.selected {
  background: var(--lt-brand-lightest);
  border: 1px solid var(--lt-brand-lighter);
}
</style>
