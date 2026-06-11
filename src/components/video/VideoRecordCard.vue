<script setup lang="ts">
defineProps<{
  topic: string
  sceneCount: number
  completed: boolean
}>()

const emit = defineEmits<{ replay: [] }>()
</script>

<template>
  <div class="record-card">
    <div class="card-thumb">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
    </div>
    <div class="card-body">
      <div class="card-topic">{{ topic }}</div>
      <div class="card-meta">
        <span>共 {{ sceneCount }} 个场景</span>
        <span class="meta-sep">·</span>
        <span :class="completed ? 'status-done' : 'status-partial'">
          {{ completed ? '已完结' : '未看完' }}
        </span>
      </div>
    </div>
    <button class="replay-btn" @click="emit('replay')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
      回看
    </button>
  </div>
</template>

<style scoped>
.record-card {
  display: flex;
  align-items: center;
  gap: 14px;
  max-width: 500px;
  margin: 0 auto 16px;
  padding: 14px 18px;
  background: var(--lt-fill-light, #f5f7fa);
  border-radius: 14px;
  border: 1px solid var(--lt-border, #e8eaed);
  transition: box-shadow 0.2s;
}
.record-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.card-thumb {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--lt-brand), var(--lt-ai-purple, #7C5CFC));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(43, 111, 255, 0.25);
}

.card-body {
  flex: 1;
  min-width: 0;
}

.card-topic {
  font-size: 14px;
  font-weight: 600;
  color: var(--lt-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--lt-text-secondary);
}

.meta-sep {
  color: var(--lt-border, #d0d5dd);
}

.status-done {
  color: #22c55e;
  font-weight: 500;
}

.status-partial {
  color: var(--lt-warm-orange, #FF8C42);
  font-weight: 500;
}

.replay-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border: none;
  background: var(--lt-brand);
  color: #fff;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}
.replay-btn:hover {
  background: var(--lt-brand-dark, #1a5ce4);
  transform: scale(1.03);
}
.replay-btn:active {
  transform: scale(0.97);
}
</style>
