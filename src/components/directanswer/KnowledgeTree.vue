<script setup lang="ts">
defineProps<{ content: string; streaming?: boolean }>()
</script>

<template>
  <div class="knowledge-tree" :class="{ streaming }">
    <div class="kt-content markdown-body" v-html="content || '等待生成...'" />
  </div>
</template>

<style scoped>
.knowledge-tree :deep(.markdown-body) {
  color: #cbd5e1;
  line-height: 1.75;
  font-size: 14px;
}
.knowledge-tree :deep(h3) { color: #e2e8f0; font-size: 15px; margin: 12px 0 8px; }
.knowledge-tree :deep(ul) {
  padding-left: 16px;
  list-style: none;
}
.knowledge-tree :deep(ul li) {
  position: relative;
  padding: 6px 0 6px 20px;
  border-left: 2px solid rgba(34, 197, 94, 0.25);
}
.knowledge-tree :deep(ul li::before) {
  content: '📘';
  position: absolute;
  left: -12px;
  top: 4px;
  font-size: 14px;
}
.knowledge-tree :deep(ul ul li::before) { content: '📄'; }
.knowledge-tree :deep(ul ul ul li::before) { content: '📝'; }
.knowledge-tree :deep(code) {
  background: rgba(148, 163, 184, 0.12);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
}
.knowledge-tree :deep(strong) { color: #e2e8f0; }
.knowledge-tree :deep(em) { color: #94a3b8; }
</style>
