<script setup lang="ts">
defineProps<{ content: string; streaming?: boolean }>()
</script>

<template>
  <div class="error-warning" :class="{ streaming }">
    <div class="ew-content markdown-body" v-html="content || '等待生成...'" />
  </div>
</template>

<style scoped>
.error-warning :deep(.markdown-body) {
  color: #cbd5e1;
  line-height: 1.75;
  font-size: 14px;
}
.error-warning :deep(h3) { color: #e2e8f0; font-size: 15px; margin: 12px 0 8px; }
.error-warning :deep(.markdown-body > p:first-of-type) {
  padding: 10px 14px;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 8px;
  color: #fbbf24;
}
.error-warning :deep(ul), .error-warning :deep(ol) { padding-left: 20px; }
.error-warning :deep(li) { margin: 5px 0; }
.error-warning :deep(blockquote) {
  border-left: 3px solid #ef4444;
  padding: 8px 14px;
  margin: 10px 0;
  background: rgba(239, 68, 68, 0.05);
  color: #fca5a5;
  border-radius: 0 8px 8px 0;
}
.error-warning :deep(code) {
  background: rgba(148, 163, 184, 0.12);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
}
.error-warning :deep(strong) { color: #e2e8f0; }
</style>
