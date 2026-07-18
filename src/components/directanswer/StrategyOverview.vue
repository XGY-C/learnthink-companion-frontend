<script setup lang="ts">
defineProps<{ content: string; streaming?: boolean }>()
</script>

<template>
  <div class="strategy-overview" :class="{ streaming }">
    <div class="so-content markdown-body" v-html="content || '等待生成...'" />
  </div>
</template>

<style scoped>
.strategy-overview :deep(.markdown-body) {
  color: #cbd5e1;
  line-height: 1.75;
  font-size: 14px;
}
.strategy-overview :deep(h3) { color: #e2e8f0; font-size: 15px; margin: 12px 0 8px; }
.strategy-overview :deep(blockquote) {
  border-left: 3px solid #6366f1;
  padding: 8px 16px;
  margin: 12px 0;
  background: rgba(99, 102, 241, 0.05);
  color: #a5b4fc;
  border-radius: 0 8px 8px 0;
}
.strategy-overview :deep(ul), .strategy-overview :deep(ol) { padding-left: 20px; }
.strategy-overview :deep(li) { margin: 4px 0; }
.strategy-overview :deep(code) {
  background: rgba(148, 163, 184, 0.12);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
}
.strategy-overview :deep(strong) { color: #e2e8f0; }
</style>
