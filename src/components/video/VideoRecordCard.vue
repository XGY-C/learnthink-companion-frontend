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
    <div class="card-accent" />
    <div class="card-thumb">
      <div class="thumb-glow" />
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <polygon points="7 4 20 12 7 20 7 4"/>
      </svg>
    </div>
    <div class="card-body">
      <div class="card-tag">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <rect x="2" y="5" width="14" height="14" rx="2"/>
          <path d="M22 8l-6 4 6 4V8z"/>
        </svg>
        视频讲解
      </div>
      <div class="card-topic">{{ topic }}</div>
      <div class="card-meta">
        <span class="status-indicator">
          <span :class="['status-dot', completed ? 'dot-done' : 'dot-partial']" />
          {{ completed ? '已完结' : '未看完' }}
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
      <svg class="replay-icon" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <polygon points="7 4 20 12 7 20 7 4"/>
      </svg>
      回看
    </button>
  </div>
</template>

<style scoped>
.record-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  max-width: 480px;
  margin: 0 auto 16px;
  padding: 14px 16px 14px 18px;
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-radius: 12px;
  box-shadow: var(--lt-shadow-card);
  overflow: hidden;
  transition: box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease;
}
.record-card:hover {
  box-shadow: 0 6px 20px rgba(43, 111, 255, 0.1);
  transform: translateY(-2px);
  border-color: rgba(43, 111, 255, 0.2);
}

/* 左侧状态色条 */
.card-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
}
.is-done .card-accent {
  background: linear-gradient(180deg, var(--lt-brand), var(--lt-success));
}
.is-partial .card-accent {
  background: linear-gradient(180deg, var(--lt-brand), var(--lt-orange, #FF8C42));
}

/* 缩略图 */
.card-thumb {
  position: relative;
  width: 52px;
  height: 40px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--lt-brand), var(--lt-ai));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(43, 111, 255, 0.2);
  overflow: hidden;
}
.thumb-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.25), transparent 60%);
}
.card-thumb svg {
  position: relative;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}

/* 主体 */
.card-body {
  flex: 1;
  min-width: 0;
}

.card-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 600;
  color: var(--lt-brand);
  margin-bottom: 3px;
  opacity: 0.8;
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
  gap: 5px;
  margin-top: 4px;
  font-size: 11px;
  color: var(--lt-text-auxiliary);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
}
.is-done .status-indicator { color: var(--lt-success); }
.is-partial .status-indicator { color: var(--lt-orange, #FF8C42); }

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-done { background: var(--lt-success); }
.dot-partial { background: var(--lt-orange, #FF8C42); }

.meta-sep {
  color: var(--lt-border);
}

/* 回看按钮 */
.replay-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 16px;
  border: none;
  background: linear-gradient(135deg, var(--lt-brand), var(--lt-brand-dark, #1a5ad7));
  color: #fff;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(43, 111, 255, 0.25);
  transition: all 0.2s ease;
}
.replay-btn:hover {
  box-shadow: 0 4px 12px rgba(43, 111, 255, 0.35);
  transform: scale(1.04);
}
.replay-btn:active {
  transform: scale(0.96);
}

.replay-icon {
  transition: transform 0.2s ease;
}
.replay-btn:hover .replay-icon {
  transform: translateX(2px);
}
</style>
