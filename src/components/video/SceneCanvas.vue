<script setup lang="ts">
import { ref, watch, computed, onBeforeUnmount } from 'vue'
import type { Scene, PlaybackSpeed } from '@/types/scene'
import { useVideoLectureStore } from '@/stores/videoLecture'
import TitleScene from './TitleScene.vue'
import TextScene from './TextScene.vue'
import CodeScene from './CodeScene.vue'
import DiagramScene from './DiagramScene.vue'
import ComparisonScene from './ComparisonScene.vue'
import SummaryScene from './SummaryScene.vue'
import EndingScene from './EndingScene.vue'

const props = defineProps<{
  scene: Scene | null
  isPlaying: boolean
  speed: PlaybackSpeed
}>()

const emit = defineEmits<{ complete: [] }>()
const store = useVideoLectureStore()

const transitionState = ref<'entering' | 'active' | 'exiting'>('active')
const sceneKey = ref(0)
const autoplayBlocked = ref(false)
let tickTimer: ReturnType<typeof setInterval> | null = null

// ===== Audio playback =====
let audioEl: HTMLAudioElement | null = null

function stopAudio() {
  if (audioEl) {
    audioEl.pause()
    audioEl.currentTime = 0
    audioEl.src = ''
    audioEl = null
  }
}

function loadAndPlayAudio(url: string) {
  stopAudio()
  autoplayBlocked.value = false
  audioEl = new Audio(url)
  audioEl.playbackRate = props.speed
  if (props.isPlaying) {
    audioEl.play().catch(() => { autoplayBlocked.value = true })
  }
}

function retryAudio() {
  if (audioEl && autoplayBlocked.value) {
    autoplayBlocked.value = false
    audioEl.play().catch(() => { autoplayBlocked.value = true })
  }
}

watch(() => props.isPlaying, (playing) => {
  if (!audioEl) return
  if (playing) {
    audioEl.play().catch(() => {})
  } else {
    audioEl.pause()
  }
})

watch(() => props.speed, (s) => {
  if (audioEl) audioEl.playbackRate = s
})

// Load audio when scene changes
watch(() => props.scene, (newScene) => {
  if (newScene?.audioUrl) {
    loadAndPlayAudio(newScene.audioUrl)
  } else {
    stopAudio()
  }
})

onBeforeUnmount(() => stopAudio())

// ===== Tick timer for ProgressBar and subtitle =====
function startTimer() {
  stopTimer()
  tickTimer = setInterval(() => {
    if (props.isPlaying) {
      store.currentSceneTime += 50 * props.speed
    }
  }, 50)
}

function stopTimer() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null }
}

// ===== Subtitle from TTS steps =====
const currentSubtitle = computed(() => {
  const s = props.scene?.steps
  if (!s || s.length === 0) return ''
  const t = store.currentSceneTime
  let text = ''
  for (const step of s) {
    if (t >= step.at) {
      text = (step.payload as any)?.text || ''
    }
  }
  return text
})

// ===== Scene transitions =====
watch(() => props.scene, (newScene, oldScene) => {
  stopTimer()
  store.currentSceneTime = 0
  if (!oldScene) { transitionState.value = 'active'; sceneKey.value++; startTimer(); return }

  const transition = newScene?.transition || 'fade'
  if (transition === 'none') {
    sceneKey.value++
    transitionState.value = 'active'
    startTimer()
    return
  }

  transitionState.value = 'exiting'
  setTimeout(() => {
    sceneKey.value++
    // 新场景组件此时已挂载，useSceneTimer 已开始计时 → 启动同步的 tick timer
    startTimer()
    transitionState.value = 'entering'
    setTimeout(() => { transitionState.value = 'active' }, 30)
  }, 200)
})

watch(() => props.isPlaying, (playing) => {
  if (!playing) stopTimer()
  else startTimer()
})

function onSceneComplete() {
  stopTimer()
  stopAudio()
  emit('complete')
}

const sceneComponent = computed(() => {
  if (!props.scene) return null
  const map: Record<string, any> = {
    title: TitleScene, text: TextScene, code: CodeScene,
    diagram: DiagramScene, comparison: ComparisonScene,
    summary: SummaryScene, ending: EndingScene,
  }
  return map[props.scene.type] || TextScene
})

const transitionClass = computed(() => {
  const type = props.scene?.transition || 'fade'
  if (transitionState.value === 'exiting') return `scene-exit-${type}`
  if (transitionState.value === 'entering') return `scene-enter-${type}`
  return ''
})

onBeforeUnmount(() => { stopTimer(); stopAudio() })
</script>

<template>
  <div class="scene-canvas" @click="retryAudio">
    <div class="scene-wrapper" :class="transitionClass">
      <component
        v-if="scene && sceneComponent"
        :is="sceneComponent"
        :key="sceneKey"
        :content="scene.content"
        :is-playing="isPlaying"
        :speed="speed"
        :duration="scene.duration"
        :narration="scene.narration"
        :steps="scene.steps"
        @complete="onSceneComplete"
      />
      <div v-else class="scene-empty">
        <div class="buffering-indicator" v-if="!scene">
          <div class="buffering-dots"><span></span><span></span><span></span></div>
          <p>下一节正在生成...</p>
        </div>
      </div>
    </div>

    <!-- TTS 字幕 -->
    <div v-if="currentSubtitle" class="scene-subtitle">{{ currentSubtitle }}</div>

    <!-- 自动播放被阻止提示 -->
    <div v-if="autoplayBlocked" class="autoplay-hint" @click.stop="retryAudio">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
      点击播放音频
    </div>

    <div v-if="!isPlaying && scene" class="pause-indicator">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" stroke="none" opacity="0.5">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.scene-canvas {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  min-height: 0;
}

.scene-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Subtitle bar */
.scene-subtitle {
  position: absolute;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 600px;
  padding: 8px 20px;
  background: rgba(0, 0, 0, 0.65);
  border-radius: 8px;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
  line-height: 1.5;
  pointer-events: none;
  z-index: 10;
  backdrop-filter: blur(6px);
  transition: opacity 0.3s;
}

/* 转场动画 */
.scene-exit-fade { animation: exit-fade 200ms ease-in forwards; }
.scene-enter-fade { animation: enter-fade 250ms 50ms ease-out forwards; }
.scene-exit-slide-left { animation: exit-left 250ms ease-in forwards; }
.scene-enter-slide-left { animation: enter-right 250ms ease-out forwards; }
.scene-exit-slide-up { animation: exit-up 250ms ease-in forwards; }
.scene-enter-slide-up { animation: enter-up 250ms ease-out forwards; }
.scene-exit-zoom { animation: exit-zoom 250ms ease-in forwards; }
.scene-enter-zoom { animation: enter-zoom 300ms ease-out forwards; }

@keyframes exit-fade { to { opacity: 0; } }
@keyframes enter-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes exit-left { to { opacity: 0; transform: translateX(-30px); } }
@keyframes enter-right { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
@keyframes exit-up { to { opacity: 0; transform: translateY(-20px); } }
@keyframes enter-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes exit-zoom { to { opacity: 0; transform: scale(0.9); } }
@keyframes enter-zoom { from { opacity: 0; transform: scale(1.1); } to { opacity: 1; transform: scale(1); } }

.scene-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
}

.buffering-indicator {
  text-align: center;
}
.buffering-dots {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.buffering-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  animation: dot-pulse 1.2s infinite;
}
.buffering-dots span:nth-child(2) { animation-delay: 0.2s; }
.buffering-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes dot-pulse {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}
.buffering-indicator p {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.4);
  margin: 0;
}

.pause-indicator {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  animation: pause-fade 2s ease-out forwards;
  color: rgba(255, 255, 255, 0.8);
}
@keyframes pause-fade {
  0% { opacity: 1; }
  70% { opacity: 1; }
  100% { opacity: 0; }
}

/* Autoplay blocked hint */
.autoplay-hint {
  position: absolute;
  bottom: 96px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  background: rgba(255, 140, 66, 0.15);
  border: 1px solid rgba(255, 140, 66, 0.25);
  border-radius: 8px;
  color: #FF8C42;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  z-index: 10;
  backdrop-filter: blur(8px);
  animation: hint-in 0.3s ease-out;
}
.autoplay-hint:hover {
  background: rgba(255, 140, 66, 0.25);
}
@keyframes hint-in {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>
