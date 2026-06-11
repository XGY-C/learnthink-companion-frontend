<template>
  <div class="code-file-tabs">
    <button
      v-for="(file, index) in files"
      :key="file.filename"
      class="code-file-tab"
      :class="{ active: index === activeIndex, dirty: edited?.has(file.filename) }"
      @click="$emit('select', index)"
    >
      <span class="code-file-tab-name">{{ file.filename }}</span>
      <span v-if="file.isEntry" class="code-file-tab-entry">entry</span>
      <span v-if="edited?.has(file.filename)" class="code-file-tab-dot" />
    </button>
  </div>
</template>

<script setup lang="ts">
import type { CodeFile } from './CodeLearningViewer.vue'

defineProps<{
  files: CodeFile[]
  activeIndex: number
  edited: Map<string, string> | null
}>()

defineEmits<{
  (e: 'select', index: number): void
}>()
</script>

<style scoped>
.code-file-tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--lt-border);
  margin-bottom: 0;
  overflow-x: auto;
}
.code-file-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 13px;
  font-family: var(--lt-font-mono);
  color: var(--lt-text-auxiliary);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.code-file-tab:hover {
  color: var(--lt-text-secondary);
}
.code-file-tab.active {
  color: var(--lt-brand);
  border-bottom-color: var(--lt-brand);
  font-weight: 500;
}
.code-file-tab-entry {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--lt-brand-lighter);
  color: var(--lt-brand-dark);
  font-family: var(--lt-font-body);
}
.code-file-tab-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lt-warning);
  flex-shrink: 0;
}
</style>
