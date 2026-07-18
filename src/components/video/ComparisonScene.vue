<script setup lang="ts">
import { computed } from 'vue'
import type { PlaybackSpeed, ComparisonContent } from '@/types/scene'
import { useSceneTimer } from '@/composables/useSceneTimer'

const props = defineProps<{
  content: Record<string, any>
  isPlaying: boolean
  speed: PlaybackSpeed
  duration: number
  narration: string
}>()

const emit = defineEmits<{ complete: [] }>()

const data = props.content as unknown as ComparisonContent
const leftItems: string[] = data.left?.items || []
const rightItems: string[] = data.right?.items || []
const maxItems = Math.max(leftItems.length, rightItems.length)

const totalTime = props.duration > 0
  ? props.duration
  : 400 + 280 * maxItems + 500 + (data.conclusion ? 900 : 300)

const { virtualTime } = useSceneTimer(
  () => props.isPlaying,
  () => props.speed,
  totalTime,
  () => emit('complete'),
)

const showColTitles = computed(() => virtualTime.value >= 200)
const showLeftArr = computed(() =>
  leftItems.map((_, i) => virtualTime.value >= 400 + 280 * i),
)
const showRightArr = computed(() =>
  rightItems.map((_, i) => virtualTime.value >= 400 + 280 * (i + 0.5)),
)
const allItemsShown = computed(() =>
  virtualTime.value >= 400 + 280 * (maxItems + 0.5),
)
const showConclusion = computed(() =>
  data.conclusion && allItemsShown.value && virtualTime.value >= 400 + 280 * maxItems + 500,
)
</script>

<template>
  <div class="comparison-scene">
    <h3 v-if="data.heading" class="comp-heading">{{ data.heading }}</h3>
    <div class="comp-columns" :class="{ active: showColTitles }">
      <div class="comp-col comp-left">
        <h4 class="comp-col-title" :class="{ visible: showColTitles }">{{ data.left?.title }}</h4>
        <div v-for="(item, i) in leftItems" :key="'l'+i" class="comp-item" :class="{ visible: showLeftArr[i] }">
          <span class="comp-bullet" />
          <span class="comp-text">{{ item }}</span>
        </div>
      </div>
      <div class="comp-divider-wrap">
        <div class="comp-divider" :class="{ visible: showColTitles }" />
      </div>
      <div class="comp-col comp-right">
        <h4 class="comp-col-title" :class="{ visible: showColTitles }">{{ data.right?.title }}</h4>
        <div v-for="(item, i) in rightItems" :key="'r'+i" class="comp-item" :class="{ visible: showRightArr[i] }">
          <span class="comp-bullet" />
          <span class="comp-text">{{ item }}</span>
        </div>
      </div>
    </div>
    <div v-if="data.conclusion && showConclusion" class="comp-conclusion">
      <span class="conclusion-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
        </svg>
      </span>
      {{ data.conclusion }}
    </div>
  </div>
</template>

<style scoped>
.comparison-scene {
  width: 100%; height: 100%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: radial-gradient(ellipse at 70% 15%, rgba(43, 111, 255, 0.08), transparent 55%), radial-gradient(ellipse at 20% 85%, rgba(255, 140, 66, 0.05), transparent 55%), radial-gradient(ellipse at 50% 50%, #14141f 0%, #0d0d12 65%, #08080c 100%); padding: 40px 60px;
}
.comp-heading {
  font-size: 20px; font-weight: 600; color: #fff; margin: 0 0 28px;
}
.comp-columns {
  display: flex; gap: 0; align-items: flex-start;
  background: rgba(255,255,255,0.02); border-radius: 14px; overflow: hidden;
  border: 1px solid rgba(255,255,255,0.06);
  transition: border-color 0.4s;
}
.comp-columns.active {
  border-color: rgba(255,255,255,0.1);
}
.comp-col { flex: 1; padding: 28px; min-width: 200px; }
.comp-left { background: rgba(43, 111, 255, 0.04); }
.comp-right { background: rgba(255, 140, 66, 0.04); }

.comp-divider-wrap { display: flex; align-items: center; align-self: stretch; }
.comp-divider {
  width: 1px; height: 0;
  background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.15), transparent);
  transition: height 0.6s cubic-bezier(0.2, 0, 0, 1);
}
.comp-divider.visible { height: 70%; }

.comp-col-title {
  font-size: 16px; font-weight: 600; color: rgba(255,255,255,0.8);
  margin: 0 0 20px; padding-bottom: 14px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  opacity: 0; transform: translateY(-6px);
  transition: all 0.4s cubic-bezier(0.2, 0, 0, 1);
}
.comp-col-title.visible { opacity: 1; transform: translateY(0); }

.comp-item {
  display: flex; align-items: center; gap: 12px;
  font-size: 14px; color: rgba(255,255,255,0.6);
  padding: 7px 0; opacity: 0;
  transition: all 0.35s cubic-bezier(0.2, 0, 0, 1);
}
.comp-left .comp-item { transform: translateX(-12px); }
.comp-right .comp-item { transform: translateX(12px); }
.comp-item.visible { opacity: 1; transform: translateX(0); }

.comp-bullet {
  width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
  transition: all 0.3s;
}
.comp-left .comp-bullet { background: rgba(43, 111, 255, 0.5); }
.comp-right .comp-bullet { background: rgba(255, 140, 66, 0.5); }
.comp-left .comp-item.visible .comp-bullet {
  box-shadow: 0 0 6px rgba(43, 111, 255, 0.6);
}
.comp-right .comp-item.visible .comp-bullet {
  box-shadow: 0 0 6px rgba(255, 140, 66, 0.6);
}

.comp-text { line-height: 1.5; }

.comp-conclusion {
  margin-top: 24px; padding: 14px 24px;
  background: rgba(124, 92, 252, 0.08);
  border-radius: 12px; border-left: 3px solid var(--lt-ai, #7C5CFC);
  font-size: 15px; color: rgba(255,255,255,0.8);
  display: flex; align-items: center; gap: 10px;
  max-width: 560px;
  animation: conclusion-in 0.5s cubic-bezier(0.2, 0, 0, 1) both;
}
@keyframes conclusion-in {
  from { opacity: 0; transform: translateY(10px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.conclusion-icon {
  color: var(--lt-ai, #7C5CFC);
  display: flex; align-items: center; flex-shrink: 0;
  animation: icon-pulse 2s ease-in-out infinite;
}
@keyframes icon-pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}
</style>
