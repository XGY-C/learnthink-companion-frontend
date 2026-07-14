<script setup lang="ts">
defineProps<{ content: string; streaming?: boolean }>()
</script>

<template>
  <div class="reasoning-timeline" :class="{ streaming }">
    <div class="rt-content markdown-body" v-html="content || '等待生成...'" />
  </div>
</template>

<style scoped>
.reasoning-timeline :deep(.markdown-body) {
  color: #cbd5e1;
  line-height: 1.75;
  font-size: 14px;
}
.reasoning-timeline :deep(h3) { color: #e2e8f0; font-size: 15px; margin: 12px 0 8px; }
.reasoning-timeline :deep(ol) {
  padding-left: 24px;
  list-style: none;
}
.reasoning-timeline :deep(ol li) {
  position: relative;
  padding: 8px 0 8px 20px;
  border-left: 2px solid rgba(99, 102, 241, 0.3);
  margin: 0;
}
.reasoning-timeline :deep(ol li::before) {
  content: '';
  position: absolute;
  left: -5px;
  top: 14px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6366f1;
}
.reasoning-timeline :deep(ol li:last-child) { border-left-color: transparent; }
.reasoning-timeline :deep(pre) {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 8px;
  padding: 12px 16px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
  margin: 8px 0;
}
.reasoning-timeline :deep(code) {
  background: rgba(148, 163, 184, 0.12);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
}
.reasoning-timeline :deep(strong) { color: #e2e8f0; }
</style>
