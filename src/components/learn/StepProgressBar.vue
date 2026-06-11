<script setup lang="ts">
defineProps<{
  total: number
  completed: number
  activeIndex: number
  isCompleting: boolean
}>()

function markerClass(index: number, total: number, completed: number, activeIndex: number, isCompleting: boolean) {
  const classes = ['spb-marker']
  if (index < completed) classes.push('is-done')
  else if (index === activeIndex) classes.push(isCompleting ? 'is-completing' : 'is-active')
  return classes.join(' ')
}
</script>

<template>
  <div v-if="total > 1" class="spb-root">
    <div class="spb-track">
      <template v-for="i in total" :key="i">
        <div
          v-if="i > 1"
          class="spb-connector"
          :class="{ 'is-filled': i - 1 <= completed }"
        >
          <div class="spb-connector-fill" :class="{ 'is-running': i - 1 === completed && isCompleting }" />
          <div class="spb-connector-glow" v-if="i - 1 === completed && isCompleting" />
        </div>
        <div :class="markerClass(i - 1, total, completed, activeIndex, isCompleting)">
          <span v-if="i - 1 < completed" class="spb-check">✓</span>
          <span v-else-if="i - 1 === activeIndex && isCompleting" class="spb-star">✦</span>
          <span v-else class="spb-num">{{ i }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.spb-root {
  flex-shrink: 0;
  padding: 14px 24px 12px;
  background: linear-gradient(180deg, rgba(255,255,255,0.6) 0%, transparent 100%);
  position: relative;
  z-index: 1;
}

.spb-track {
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 640px;
  margin: 0 auto;
}

.spb-marker {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  border: 2px solid var(--lt-border);
  background: var(--lt-bg-card);
  color: var(--lt-text-auxiliary);
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}

.spb-marker.is-done {
  border-color: var(--lt-success);
  background: linear-gradient(135deg, #34C759, #30B350);
  color: #fff;
  box-shadow: 0 2px 8px rgba(52, 199, 89, 0.25);
}

.spb-marker.is-active {
  border-color: var(--lt-brand);
  background: linear-gradient(135deg, var(--lt-brand), #3D7AFF);
  color: #fff;
  box-shadow: 0 0 0 6px rgba(43, 111, 255, 0.15), 0 4px 12px rgba(43, 111, 255, 0.25);
  animation: marker-active-pulse 2.4s ease-in-out infinite;
}

.spb-marker.is-completing {
  border-color: var(--lt-brand);
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
  box-shadow: 0 0 0 6px rgba(43, 111, 255, 0.10), 0 2px 8px rgba(43, 111, 255, 0.15);
  animation: marker-completing 1.2s ease-in-out infinite;
}

@keyframes marker-active-pulse {
  0%, 100% {
    box-shadow: 0 0 0 6px rgba(43, 111, 255, 0.15), 0 4px 12px rgba(43, 111, 255, 0.25);
  }
  50% {
    box-shadow: 0 0 0 14px rgba(43, 111, 255, 0.04), 0 4px 12px rgba(43, 111, 255, 0.30);
  }
}

@keyframes marker-completing {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

.spb-check {
  font-size: 15px;
  line-height: 1;
}

.spb-num {
  font-size: 12px;
  line-height: 1;
}

.spb-star {
  font-size: 16px;
  line-height: 1;
  animation: star-spin 2s linear infinite;
}

@keyframes star-spin {
  to { transform: rotate(180deg); }
}

/* Connector */
.spb-connector {
  flex: 1;
  height: 3px;
  background: var(--lt-border);
  border-radius: 2px;
  min-width: 20px;
  max-width: 80px;
  position: relative;
  overflow: visible;
}

.spb-connector-fill {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, var(--lt-success), #30B350);
  border-radius: 2px;
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.spb-connector.is-filled .spb-connector-fill {
  transform: scaleX(1);
}

.spb-connector-fill.is-running {
  background: linear-gradient(90deg, var(--lt-success), var(--lt-brand), var(--lt-brand-light));
  background-size: 200% 100%;
  animation: connector-flow 1.8s ease-in-out infinite;
}

@keyframes connector-flow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.spb-connector-glow {
  position: absolute;
  right: -4px;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--lt-brand);
  box-shadow: 0 0 8px rgba(43, 111, 255, 0.5);
  animation: glow-pulse 1.2s ease-in-out infinite;
}

@keyframes glow-pulse {
  0%, 100% { opacity: 0.4; transform: translateY(-50%) scale(0.8); }
  50% { opacity: 1; transform: translateY(-50%) scale(1.2); }
}

@media (max-width: 767px) {
  .spb-root {
    padding: 10px 16px 8px;
  }
  .spb-marker {
    width: 26px;
    height: 26px;
    font-size: 10px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  }
  .spb-marker.is-active {
    box-shadow: 0 0 0 4px rgba(43, 111, 255, 0.15);
  }
  .spb-marker.is-completing {
    box-shadow: 0 0 0 4px rgba(43, 111, 255, 0.10);
  }
  .spb-connector {
    max-width: 48px;
  }
}
</style>
