<script setup lang="ts">
import { computed } from 'vue'
import type { PlaybackSpeed } from '@/types/scene'
import { useSceneTimer } from '@/composables/useSceneTimer'

const props = defineProps<{
  content: Record<string, any>
  isPlaying: boolean
  speed: PlaybackSpeed
  duration: number
  narration: string
}>()

const emit = defineEmits<{ complete: [] }>()

const title: string = props.content?.title || ''
const subtitle = props.content?.subtitle || ''
const tags: string[] = props.content?.tags || []

const resolvedDuration = props.duration > 0
  ? props.duration
  : 3000

const { virtualTime } = useSceneTimer(
  () => props.isPlaying,
  () => props.speed,
  resolvedDuration,
  () => emit('complete'),
)

const showDecor = computed(() => virtualTime.value >= 50)

// Typewriter: reveal characters from 15% to 45% of duration
const typewriterStart = resolvedDuration * 0.15
const typewriterEnd = resolvedDuration * 0.45
const typewriterWindow = typewriterEnd - typewriterStart

const visibleCharCount = computed(() => {
  if (virtualTime.value < typewriterStart) return 0
  if (virtualTime.value >= typewriterEnd) return title.length
  const progress = (virtualTime.value - typewriterStart) / typewriterWindow
  return Math.floor(progress * title.length)
})

const showTitle = computed(() => visibleCharCount.value > 0)
const titleDone = computed(() => visibleCharCount.value >= title.length)

const showSubtitle = computed(() => subtitle && virtualTime.value >= resolvedDuration * 0.4)
const showTags = computed(() => tags.length && virtualTime.value >= resolvedDuration * 0.55)
</script>

<template>
  <div class="title-scene">
    <div class="title-bg">
      <div class="floating-shape shape-1" />
      <div class="floating-shape shape-2" />
      <div class="floating-shape shape-3" />
    </div>
    <div class="title-content">
      <div class="decor-line" :class="{ visible: showDecor }" />
      <h1 class="title-text" :class="{ visible: showTitle }">
        <span
          v-for="(char, i) in title"
          :key="i"
          class="title-char"
          :class="{ revealed: i < visibleCharCount }"
        >{{ char === ' ' ? '\u00A0' : char }}</span>
        <span class="typewriter-cursor" :class="{ blinking: titleDone }">|</span>
      </h1>
      <p v-if="subtitle" class="subtitle-text" :class="{ visible: showSubtitle }">{{ subtitle }}</p>
      <div v-if="tags.length" class="tags-row" :class="{ visible: showTags }">
        <span v-for="tag in tags" :key="tag" class="tag-pill">{{ tag }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.title-scene { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; position: relative; background: linear-gradient(135deg,#0d0d12 0%,#1a1a2e 50%,#16213e 100%); overflow: hidden; }
.title-bg { position: absolute; inset: 0; }
.floating-shape { position: absolute; border-radius: 50%; opacity: 0.08; }
.shape-1 { width: 300px; height: 300px; background: var(--lt-brand); top: -50px; left: -50px; animation: float-1 20s linear infinite; }
.shape-2 { width: 200px; height: 200px; background: var(--lt-ai,#7C5CFC); bottom: -30px; right: -30px; animation: float-2 25s linear infinite; }
.shape-3 { width: 150px; height: 150px; background: var(--lt-accent,#FF8C42); top: 50%; right: 20%; animation: float-3 18s linear infinite; }
@keyframes float-1 { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(60px,40px) rotate(180deg); } }
@keyframes float-2 { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(-40px,-30px) rotate(-180deg); } }
@keyframes float-3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-30px,20px) scale(1.2); } }
.title-content { text-align: center; z-index: 1; padding: 40px; max-width: 800px; }
.decor-line { width: 0; height: 2px; background: linear-gradient(90deg,transparent,var(--lt-brand),transparent); margin: 0 auto 24px; transition: width 0.8s cubic-bezier(0.2,0,0,1); }
.decor-line.visible { width: 200px; }

/* Typewriter title */
.title-text { font-size: 48px; font-weight: 700; color: #fff; margin: 0 0 8px; opacity: 0; transition: opacity 0.3s; }
.title-text.visible { opacity: 1; }

.title-char { opacity: 0; transition: opacity 0.08s; }
.title-char.revealed { opacity: 1; }

.typewriter-cursor { font-weight: 300; color: var(--lt-brand); opacity: 0; transition: opacity 0.2s; }
.title-text.visible .typewriter-cursor { opacity: 1; }
.typewriter-cursor.blinking { animation: cursor-blink 1s step-end infinite; }
@keyframes cursor-blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }

.subtitle-text { font-size: 20px; color: rgba(255,255,255,0.6); margin: 0 0 24px; opacity: 0; transform: translateY(10px); transition: all 0.5s 0.1s cubic-bezier(0.2,0,0,1); }
.subtitle-text.visible { opacity: 1; transform: translateY(0); }
.tags-row { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; opacity: 0; transform: translateY(8px); transition: all 0.4s 0.1s cubic-bezier(0.2,0,0,1); }
.tags-row.visible { opacity: 1; transform: translateY(0); }
.tag-pill { padding: 4px 16px; border-radius: 20px; font-size: 13px; color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); }
</style>
