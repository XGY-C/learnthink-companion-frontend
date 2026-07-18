<script setup lang="ts">
import { computed } from 'vue'
import type { PlaybackSpeed, SummaryContent } from '@/types/scene'
import { useSceneTimer } from '@/composables/useSceneTimer'

const props = defineProps<{
  content: Record<string, any>
  isPlaying: boolean
  speed: PlaybackSpeed
  duration: number
  narration: string
}>()

const emit = defineEmits<{ complete: [] }>()

const data = props.content as unknown as SummaryContent
const checkpoints: string[] = data.checkpoints || []

const totalTime = props.duration > 0
  ? props.duration
  : 400 + 400 * checkpoints.length + 600 + (data.nextHint ? 1000 : 300)

const { virtualTime } = useSceneTimer(
  () => props.isPlaying,
  () => props.speed,
  totalTime,
  () => emit('complete'),
)

const showHead = computed(() => virtualTime.value >= 200)

const showCheckpointsArr = computed(() =>
  checkpoints.map((_, i) => virtualTime.value >= 400 + 400 * i),
)

const completedCount = computed(() => {
  let count = 0
  for (let i = 0; i < checkpoints.length; i++) {
    if (showCheckpointsArr.value[i]) count++
  }
  return count
})

const showNext = computed(() =>
  data.nextHint && virtualTime.value >= 400 + 400 * checkpoints.length + 600,
)

// Checkmark path length for stroke-dasharray animation
const CHECK_PATH_LEN = 28
</script>

<template>
  <div class="summary-scene">
    <div v-if="data.heading" class="summary-head" :class="{ visible: showHead }">
      <h3 class="summary-heading">{{ data.heading }}</h3>
      <div class="summary-progress">
        <span class="progress-count">{{ completedCount }}</span>
        <span class="progress-sep">/</span>
        <span class="progress-total">{{ checkpoints.length }}</span>
      </div>
    </div>

    <div class="summary-list">
      <div
        v-for="(cp, i) in checkpoints"
        :key="i"
        class="summary-item"
        :class="{ visible: showCheckpointsArr[i] }"
      >
        <span class="check-icon" :class="{ done: showCheckpointsArr[i] }">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" class="check-path"
              :style="showCheckpointsArr[i] ? {} : { strokeDasharray: CHECK_PATH_LEN, strokeDashoffset: CHECK_PATH_LEN }" />
          </svg>
        </span>
        <span class="check-text">{{ cp }}</span>
      </div>
    </div>

    <div v-if="data.nextHint && showNext" class="summary-next">
      <span class="next-arrow">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
        </svg>
      </span>
      {{ data.nextHint }}
    </div>
  </div>
</template>

<style scoped>
.summary-scene {
  width: 100%; height: 100%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: linear-gradient(180deg, #0d0d12 0%, #1a1a2e 100%);
  padding: 60px;
}

/* Header with progress */
.summary-head {
  display: flex; align-items: baseline; gap: 16px; margin-bottom: 32px;
  opacity: 0; transform: translateY(-8px);
  transition: all 0.5s cubic-bezier(0.2, 0, 0, 1);
}
.summary-head.visible { opacity: 1; transform: translateY(0); }
.summary-heading {
  font-size: 24px; font-weight: 700; color: #fff; margin: 0;
}
.summary-progress {
  display: flex; align-items: baseline; gap: 2px;
  font-variant-numeric: tabular-nums;
}
.progress-count {
  font-size: 20px; font-weight: 700; color: var(--lt-success, #22c55e);
  transition: all 0.3s;
}
.progress-sep {
  font-size: 16px; color: rgba(255,255,255,0.25); margin: 0 2px;
}
.progress-total {
  font-size: 16px; color: rgba(255,255,255,0.35); font-weight: 500;
}

/* Checklist */
.summary-list {
  display: flex; flex-direction: column; gap: 16px; max-width: 500px; width: 100%;
}
.summary-item {
  display: flex; align-items: center; gap: 14px;
  font-size: 16px; color: rgba(255,255,255,0.75);
  opacity: 0; transform: translateX(-10px);
  transition: all 0.4s cubic-bezier(0.2, 0, 0, 1);
}
.summary-item.visible { opacity: 1; transform: translateX(0); }

.check-icon {
  width: 28px; height: 28px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.2);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: all 0.4s;
}
.check-icon.done {
  background: rgba(34, 197, 94, 0.15);
  color: var(--lt-success, #22c55e);
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.15);
}

.check-path {
  stroke-dasharray: 28;
  stroke-dashoffset: 0;
  transition: stroke-dashoffset 0.35s 0.1s cubic-bezier(0.2, 0, 0, 1);
}

.check-text { line-height: 1.4; }

/* Next hint */
.summary-next {
  margin-top: 36px; font-size: 15px; color: rgba(255,255,255,0.5);
  display: flex; align-items: center; gap: 8px;
  animation: next-in 0.5s 0.2s cubic-bezier(0.2, 0, 0, 1) both;
}
@keyframes next-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.next-arrow {
  color: var(--lt-brand);
  display: flex; align-items: center;
  animation: arrow-bounce 1.5s ease-in-out infinite;
}
@keyframes arrow-bounce {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(4px); }
}
</style>
