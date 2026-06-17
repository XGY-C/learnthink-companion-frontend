<script setup lang="ts">
defineProps<{
  courseName?: string
  chapterLabel?: string
}>()

defineEmits<{
  back: []
  history: []
}>()
</script>

<template>
  <div class="topbar">
    <button class="back-btn" @click="$emit('back')">← 返回</button>
    <span class="topbar-title">智能辅导</span>
    <button class="history-btn" @click="$emit('history')">历史</button>
    <span class="topbar-context" v-if="courseName || chapterLabel">
      {{ [courseName, chapterLabel].filter(Boolean).join(' › ') }}
    </span>
    <span v-else class="topbar-context-placeholder"></span>
  </div>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  height: 48px;
  padding: 0 20px;
  background: var(--lt-bg-card);
  border-bottom: 1px solid var(--lt-border);
  flex-shrink: 0;
}

.back-btn {
  font-size: 14px;
  color: var(--lt-text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: color 0.15s;
}
.back-btn:hover { color: var(--lt-brand); }

.topbar-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--lt-text-primary);
  margin: 0 auto;
}

.topbar-context {
  font-size: 13px;
  color: var(--lt-text-secondary);
  white-space: nowrap;
}
.topbar-context-placeholder { width: 120px; }

.history-btn {
  display: none;
  font-size: 13px;
  color: var(--lt-text-secondary);
  background: none;
  border: 1px solid var(--lt-border);
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  transition: all 0.15s;
}
.history-btn:hover { color: var(--lt-brand); border-color: var(--lt-brand); }

@media (max-width: 768px) {
  .topbar {
    padding: 0 12px;
  }
  .topbar-context,
  .topbar-context-placeholder {
    display: none;
  }
  .history-btn {
    display: block;
  }
}
</style>
