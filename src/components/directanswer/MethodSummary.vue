<script setup lang="ts">
defineProps<{ content: string; streaming?: boolean }>()
</script>

<template>
  <div class="method-summary" :class="{ streaming }">
    <div class="ms-content markdown-body" v-html="content || '等待生成...'" />
  </div>
</template>

<style scoped>
.method-summary :deep(.markdown-body) {
  color: #cbd5e1;
  line-height: 1.75;
  font-size: 14px;
}
.method-summary :deep(h3) { color: #e2e8f0; font-size: 15px; margin: 12px 0 8px; }
.method-summary :deep(blockquote) {
  border-left: 3px solid #8b5cf6;
  padding: 10px 16px;
  margin: 12px 0;
  background: rgba(139, 92, 246, 0.06);
  color: #c4b5fd;
  border-radius: 0 8px 8px 0;
  font-style: italic;
}
.method-summary :deep(ul), .method-summary :deep(ol) { padding-left: 20px; }
.method-summary :deep(li) { margin: 5px 0; }
.method-summary :deep(code) {
  background: rgba(148, 163, 184, 0.12);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
}
.method-summary :deep(strong) { color: #e2e8f0; }
.method-summary :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
}
.method-summary :deep(th) {
  text-align: left;
  padding: 8px 12px;
  background: rgba(139, 92, 246, 0.1);
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  color: #c4b5fd;
}
.method-summary :deep(td) {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.08);
}
</style>
