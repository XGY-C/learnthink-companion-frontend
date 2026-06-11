<script setup lang="ts">
import { computed, ref } from 'vue'
import { useVideoLectureStore } from '@/stores/videoLecture'
import type { Scene } from '@/types/scene'

const store = useVideoLectureStore()

/** 与各场景组件内部的 calcDuration 保持一致的时长计算 */
function calcSceneDuration(s: Scene): number {
  if (s.duration > 0) return s.duration
  const narrationLen = (s.narration || '').length
  switch (s.type) {
    case 'title': return 3000
    case 'ending': return 3000
    case 'text': return Math.max(narrationLen * 240, 5000)
    case 'code': {
      const codeLines = (s.content?.code || '').split('\n').length
      const textBased = Math.max(narrationLen * 240, 4000)
      const codeBased = codeLines * 400 + (s.content?.output ? 2000 : 0) + 1000
      return Math.max(textBased, codeBased, 5000)
    }
    case 'diagram': return Math.max(narrationLen * 240, 6000)
    case 'comparison': {
      const leftItems = (s.content as any)?.left?.items?.length || 0
      const rightItems = (s.content as any)?.right?.items?.length || 0
      const maxItems = Math.max(leftItems, rightItems)
      return 400 + 280 * maxItems + 500 + ((s.content as any)?.conclusion ? 900 : 300)
    }
    case 'summary': {
      const cp = (s.content as any)?.checkpoints?.length || 0
      return 400 + 400 * cp + 600 + ((s.content as any)?.nextHint ? 1000 : 300)
    }
    default: return 5000
  }
}

const validScenes = computed(() => store.scenes.filter(s => s !== null))
const sceneCount = computed(() => store.sceneCount)
const isStreaming = computed(() => !store.isStreamEnded)

const totalDuration = computed(() => {
  if (isStreaming.value) return null
  return validScenes.value.reduce((sum, s) => sum + calcSceneDuration(s!), 0)
})

const currentGlobalTime = computed(() => {
  let t = 0
  for (let i = 0; i < store.currentSceneIndex; i++) {
    const s = store.scenes[i]
    if (s) t += calcSceneDuration(s)
  }
  return t + store.currentSceneTime
})

const progressPct = computed(() => {
  if (!totalDuration.value) {
    if (sceneCount.value === 0) return 0
    return ((store.currentSceneIndex) / Math.max(sceneCount.value + 1, 1)) * 100
  }
  return (currentGlobalTime.value / totalDuration.value) * 100
})

/** 每个场景在进度条上的位置（基于累计时长占比） */
const sceneMarkers = computed(() => {
  const markers: { index: number; leftPct: number; label: string; type: string }[] = []
  if (!totalDuration.value || validScenes.value.length < 2) {
    // fallback: evenly spaced
    return validScenes.value.map((s, i) => {
      const leftPct = validScenes.value.length > 1
        ? (i / (validScenes.value.length - 1)) * 100
        : 50
      return { index: i, leftPct, label: sceneLabel(s!), type: s!.type }
    })
  }
  let accumulated = 0
  const total = totalDuration.value
  for (let i = 0; i < store.scenes.length; i++) {
    const s = store.scenes[i]
    if (!s) continue
    const halfDuration = calcSceneDuration(s) / 2
    markers.push({
      index: i,
      leftPct: ((accumulated + halfDuration) / total) * 100,
      label: sceneLabel(s),
      type: s.type,
    })
    accumulated += calcSceneDuration(s)
  }
  return markers
})

const hoveredMarker = ref<number | null>(null)

function sceneLabel(scene: any): string {
  const typeLabels: Record<string, string> = {
    title: '标题', text: '讲解', code: '代码', diagram: '图表',
    comparison: '对比', summary: '总结', ending: '结束',
  }
  const typeLabel = typeLabels[scene.type] || scene.type
  const heading = scene.content?.heading || scene.content?.title || ''
  return heading ? `${typeLabel}: ${heading}` : typeLabel
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function handleMarkerClick(index: number) {
  store.seekTo(index)
}
</script>

<template>
  <div class="progress-bar-wrapper">
    <div class="progress-track">
      <div class="progress-fill" :style="{ width: progressPct + '%' }" />
      <div
        v-for="m in sceneMarkers"
        :key="m.index"
        class="progress-marker"
        :class="{ 'is-active': m.index <= store.currentSceneIndex, 'is-hovered': hoveredMarker === m.index }"
        :style="{ left: m.leftPct + '%' }"
        @mouseenter="hoveredMarker = m.index"
        @mouseleave="hoveredMarker = null"
        @click.stop="handleMarkerClick(m.index)"
      >
        <span v-if="hoveredMarker === m.index" class="marker-tooltip">{{ m.label }}</span>
      </div>
      <div v-if="isStreaming" class="progress-waiting" />
    </div>
    <div class="progress-time">
      <span>{{ formatTime(currentGlobalTime) }}</span>
      <span v-if="totalDuration">/ {{ formatTime(totalDuration) }}</span>
      <span v-else class="time-unknown">/ ??:??</span>
    </div>
    <div v-if="isStreaming && store.currentSceneIndex >= validScenes.length - 1" class="streaming-hint">
      等待中...
    </div>
  </div>
</template>

<style scoped>
.progress-bar-wrapper {
  padding: 0 20px 4px;
  flex-shrink: 0;
}
.progress-track {
  position: relative;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: visible;
  cursor: pointer;
}
.progress-track:hover .progress-fill {
  background: linear-gradient(90deg, var(--lt-brand-lighter, #5a9fff), var(--lt-accent, #FF8C42));
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--lt-brand), var(--lt-accent, #FF8C42));
  border-radius: 3px;
  transition: width 0.3s ease;
}
.progress-marker {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s;
  cursor: pointer;
  z-index: 2;
}
.progress-marker:hover {
  transform: translate(-50%, -50%) scale(1.5);
  background: #fff;
  border-color: #fff;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.4);
}
.progress-marker.is-active {
  background: var(--lt-brand);
  border-color: var(--lt-brand);
  box-shadow: 0 0 6px rgba(43, 111, 255, 0.5);
}
.progress-marker.is-active:hover {
  background: #fff;
  border-color: #fff;
  box-shadow: 0 0 12px rgba(255, 255, 255, 0.5);
}

.marker-tooltip {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 10px;
  background: rgba(20, 20, 30, 0.92);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  font-size: 12px;
  color: #fff;
  white-space: nowrap;
  pointer-events: none;
  animation: tooltip-in 0.12s ease-out;
}

@keyframes tooltip-in {
  from { opacity: 0; transform: translateX(-50%) translateY(4px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

.progress-waiting {
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  width: 30%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05));
  pointer-events: none;
}
.progress-time {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}
.time-unknown { opacity: 0.5; }
.streaming-hint {
  text-align: right;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
  margin-top: 2px;
}
</style>
