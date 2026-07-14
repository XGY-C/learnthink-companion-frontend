<script setup lang="ts">
defineProps<{ content: string; streaming?: boolean }>()
</script>

<template>
  <div class="problem-analysis" :class="{ streaming }">
    <div class="pa-content markdown-body" v-html="content || '等待生成...'" />
  </div>
</template>

<style scoped>
.problem-analysis :deep(.markdown-body) {
  color: #cbd5e1;
  line-height: 1.75;
  font-size: 14px;
}
.problem-analysis :deep(h3) { color: #e2e8f0; font-size: 15px; margin: 12px 0 8px; }
.problem-analysis :deep(ul), .problem-analysis :deep(ol) { padding-left: 20px; }
.problem-analysis :deep(li) { margin: 4px 0; }
.problem-analysis :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
  font-size: 13px;
}
.problem-analysis :deep(th) {
  text-align: left;
  padding: 8px 12px;
  background: rgba(99, 102, 241, 0.1);
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  color: #a5b4fc;
  font-weight: 600;
}
.problem-analysis :deep(td) {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.08);
}
.problem-analysis :deep(code) {
  background: rgba(148, 163, 184, 0.12);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
}
</style>
