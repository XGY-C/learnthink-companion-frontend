<script setup lang="ts">
import type { ForumResource } from '@/types/forum'
import { Document, Reading, List, Monitor } from '@element-plus/icons-vue'

const props = defineProps<{ resource: ForumResource }>()

const typeMeta: Record<string, { icon: any; label: string; color: string }> = {
  document: { icon: Document, label: '文档', color: 'var(--lt-brand)' },
  exercise: { icon: List, label: '习题', color: 'var(--lt-orange)' },
  reading: { icon: Reading, label: '阅读', color: 'var(--lt-ai)' },
  code: { icon: Monitor, label: '代码', color: 'var(--lt-success)' },
  mindmap: { icon: Document, label: '思维导图', color: 'var(--lt-brand)' },
}

const meta = typeMeta[props.resource.type] || { icon: Document, label: props.resource.type, color: 'var(--lt-text-secondary)' }
</script>

<template>
  <div class="resource-embed">
    <div class="flex items-center gap-3">
      <div
        class="resource-icon flex items-center justify-center rounded-lg w-10 h-10 flex-shrink-0"
        :style="{ background: meta.color + '15', color: meta.color }"
      >
        <el-icon :size="20"><component :is="meta.icon" /></el-icon>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium truncate m-0" style="color: var(--lt-text-primary);">{{ resource.title }}</p>
        <p class="text-xs m-0" style="color: var(--lt-text-auxiliary);">{{ meta.label }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.resource-embed {
  padding: 12px 16px;
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-md);
  background: var(--lt-bg-card);
  transition: all var(--lt-transition-base);
  cursor: pointer;
}
.resource-embed:hover {
  border-color: var(--lt-brand-lighter);
  box-shadow: var(--lt-shadow-hover);
}
</style>
