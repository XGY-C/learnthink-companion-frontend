<script setup lang="ts">
defineProps<{
  topic: string
  sceneCount: number
  lastSceneIndex?: number
  completed: boolean
}>()

const emit = defineEmits<{ replay: [] }>()
</script>

<template>
  <div class="record-card" :class="completed ? 'is-done' : 'is-partial'">
    <div class="card-thumb">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
    </div>
    <div class="card-body">
      <div class="card-topic">{{ topic }}</div>
      <div class="card-meta">
        <span class="status-indicator">
          <span :class="['status-dot', completed ? 'dot-done' : 'dot-partial']" />
          <span :class="completed ? 'status-done' : 'status-partial'">
            {{ completed ? '已完结' : '未看完' }}
          </span>
        </span>
        <span class="meta-sep">·</span>
        <span>{{ sceneCount }} 个场景</span>
        <template v-if="!completed && lastSceneIndex !== undefined && lastSceneIndex > 0">
          <span class="meta-sep">·</span>
          <span>进度 {{ Math.min(lastSceneIndex + 1, sceneCount) }}/{{ sceneCount }}</span>
        </template>
      </div>
    </div>
    <button class="replay-btn" @click="emit('replay')">
      <svg class="replay-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
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
  max-width: 520px;
  margin: 0 auto 16px;
  padding: 14px 18px;
  background: var(--lt-bg-card);
  border-radius: var(--radius-lt-lg, 12px);
  box-shadow: var(--lt-shadow-card);
  transition: box-shadow var(--lt-transition-smooth), transform var(--lt-transition-smooth);
}
.record-card:hover {
  box-shadow: var(--lt-shadow-hover);
  transform: translateY(-2px);
}

.card-thumb {
  width: 46px;
  height: 46px;
  border-radius: var(--radius-lt-lg, 12px);
  background: linear-gradient(135deg, var(--lt-brand), var(--lt-ai));
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
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--lt-text-auxiliary);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-done {
  background: var(--lt-success);
}
.dot-partial {
  background: var(--lt-orange);
}

.meta-sep {
  color: var(--lt-border);
}

.status-done {
  color: var(--lt-success);
  font-weight: 500;
}

.status-partial {
  color: var(--lt-orange);
  font-weight: 500;
}

.replay-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 16px;
  border: 1px solid var(--lt-brand);
  background: transparent;
  color: var(--lt-brand);
  border-radius: var(--radius-lt-md, 8px);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all var(--lt-transition-base);
}
.replay-btn:hover {
  background: var(--lt-brand);
  color: #fff;
  box-shadow: var(--lt-shadow-blue);
  transform: scale(1.03);
}
.replay-btn:active {
  transform: scale(0.97);
}

.replay-icon {
  transition: transform var(--lt-transition-base);
}
.replay-btn:hover .replay-icon {
  transform: translateX(3px);
}
.replay-btn:active .replay-icon {
  transform: translateX(5px);
}
</style>
