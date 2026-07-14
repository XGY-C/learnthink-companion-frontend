<script setup lang="ts">
import { computed, watch, ref, onMounted, onBeforeUnmount } from 'vue'
import { useVideoLectureStore } from '@/stores/videoLecture'
import DarkOverlay from './DarkOverlay.vue'
import PlayerTopBar from './PlayerTopBar.vue'
import SceneCanvas from './SceneCanvas.vue'
import ControlBar from './ControlBar.vue'
import ProgressBar from './ProgressBar.vue'

const store = useVideoLectureStore()

const playerRef = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)
const loadError = ref(false)

// Phase 过渡动画定时器
let phaseTimer: ReturnType<typeof setTimeout> | null = null

watch(() => store.phase, (phase) => {
  if (phaseTimer) { clearTimeout(phaseTimer); phaseTimer = null }
  if (phase === 'darkening') {
    phaseTimer = setTimeout(() => store.onDarkComplete(), 400)
  } else if (phase === 'expanding') {
    phaseTimer = setTimeout(() => store.onExpandComplete(), 300)
  } else if (phase === 'closing') {
    phaseTimer = setTimeout(() => { store.phase = 'idle' }, 300)
  }
}, { immediate: true })

// 控制栏自动隐藏
const showControls = ref(true)
let hideTimer: ReturnType<typeof setTimeout> | null = null

function resetHideTimer() {
  showControls.value = true
  if (hideTimer) clearTimeout(hideTimer)
  if (store.isPlaying) {
    hideTimer = setTimeout(() => { showControls.value = false }, 3000)
  }
}

function onMouseMove() { resetHideTimer() }
function onMouseLeave() {
  if (store.isPlaying && hideTimer) clearTimeout(hideTimer)
  if (store.isPlaying) hideTimer = setTimeout(() => { showControls.value = false }, 1500)
}

watch(() => store.isPlaying, (playing) => {
  if (playing) resetHideTimer()
  else showControls.value = true
})

watch(() => store.phase, (p) => {
  if (p === 'playing') resetHideTimer()
})

// 键盘快捷键
function onKeyDown(e: KeyboardEvent) {
  if (store.phase === 'idle' || store.phase === 'closing') return
  switch (e.key) {
    case ' ':
      e.preventDefault(); store.togglePlay(); break
    case 'ArrowRight':
        e.preventDefault()
        if (e.shiftKey) store.nextScene()
        else store.skipTime(5000)
        break
    case 'ArrowLeft':
        e.preventDefault()
        if (e.shiftKey) store.prevScene()
        else store.skipTime(-5000)
        break
    case 'Escape': e.preventDefault(); handleClose(); break
    case 'f': case 'F': toggleFullscreen(); break
  }
}

function toggleFullscreen() {
  if (!playerRef.value) return
  if (!document.fullscreenElement) {
    playerRef.value.requestFullscreen().then(() => { isFullscreen.value = true })
  } else {
    document.exitFullscreen().then(() => { isFullscreen.value = false })
  }
}

function handleClose() {
  if (store.phase === 'idle' || store.phase === 'closing') return
  store.close()
}

function handleRetry() {
  loadError.value = false
  store.replay()
}

// Watch for buffering timeout
watch(() => store.phase, (p) => {
  if (p === 'buffering') {
    const timeout = setTimeout(() => {
      if (store.phase === 'buffering') {
        loadError.value = true
      }
    }, 15000)
    return () => clearTimeout(timeout)
  }
  if (p !== 'buffering') loadError.value = false
})

onMounted(() => { document.addEventListener('keydown', onKeyDown) })
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeyDown)
  if (hideTimer) clearTimeout(hideTimer)
  if (phaseTimer) clearTimeout(phaseTimer)
})

const showCloseEnding = computed(() =>
  store.isStreamEnded && !store.hasNextScene &&
  store.currentScene && store.currentScene.type === 'ending'
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="store.phase !== 'idle'"
      ref="playerRef"
      class="video-lecture-player"
      :class="{
        'is-darkening': store.phase === 'darkening',
        'is-expanding': store.phase === 'expanding',
        'is-active': store.phase === 'playing' || store.phase === 'paused' || store.phase === 'buffering',
        'is-closing': store.phase === 'closing',
        'is-fullscreen': isFullscreen,
      }"
      @mousemove="onMouseMove"
      @mouseleave="onMouseLeave"
    >
      <DarkOverlay />

      <div class="player-container" :class="{ 'controls-hidden': !showControls && store.phase === 'playing' }">
        <PlayerTopBar @close="handleClose" />

        <SceneCanvas
          :scene="store.currentScene"
          :is-playing="store.isPlaying"
          :speed="store.speed"
          @complete="store.onSceneComplete()"
        />

        <!-- Load error overlay -->
        <div v-if="loadError" class="player-error-overlay">
          <p class="player-error-text">场景加载超时，可能是网络不稳定或生成中断</p>
          <p class="player-error-hint">可重播已生成的内容，或关闭后重新提问</p>
          <div class="player-error-actions">
            <button class="player-retry-btn" @click="handleRetry">重新播放</button>
            <button class="player-close-btn" @click="handleClose">关闭</button>
          </div>
        </div>

        <ProgressBar />

        <ControlBar
          :show="showControls || store.phase !== 'playing'"
          :is-playing="store.isPlaying"
          :speed="store.speed"
          :has-prev="store.hasPrevScene"
          :has-next="store.hasNextScene"
          @toggle-play="store.togglePlay()"
          @prev="store.prevScene()"
          @next="store.nextScene()"
          @skip-back="store.skipTime(-5000)"
          @skip-forward="store.skipTime(5000)"
          @set-speed="store.setSpeed($event)"
          @fullscreen="toggleFullscreen"
        />

        <!-- 结束画面操作按钮 -->
        <div v-if="showCloseEnding" class="ending-actions">
          <button class="ending-btn" @click="store.replay()">再看一遍</button>
          <button class="ending-btn ending-btn-close" @click="handleClose">关闭</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.video-lecture-player {
  position: fixed;
  inset: 0;
  z-index: 1000;
  pointer-events: none;
  opacity: 0;
}

.video-lecture-player.is-darkening {
  pointer-events: all;
  animation: darken-in 400ms cubic-bezier(0.2, 0, 0, 1) forwards;
}

.video-lecture-player.is-expanding {
  pointer-events: all;
  opacity: 1;
}

.video-lecture-player.is-active {
  pointer-events: all;
  opacity: 1;
}

.video-lecture-player.is-closing {
  pointer-events: none;
  animation: darken-out 300ms ease-out forwards;
}

@keyframes darken-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes darken-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

.player-container {
  position: relative;
  z-index: 1001;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #0f0f13;
}

.player-container.controls-hidden {
  cursor: none;
}

/* 展开动画 */
.is-expanding .player-container {
  animation: player-expand 300ms cubic-bezier(0.2, 0, 0, 1);
}

@keyframes player-expand {
  from { transform: scale(0.95); opacity: 0.8; }
  to { transform: scale(1); opacity: 1; }
}

/* 桌面端最大尺寸 */
@media (min-width: 1024px) {
  .video-lecture-player:not(.is-fullscreen) .player-container {
    max-width: 900px;
    max-height: 680px;
    margin: auto;
    border-radius: 16px;
    box-shadow: 0 0 80px rgba(0, 0, 0, 0.6);
  }
  .is-darkening:not(.is-fullscreen) .player-container {
    position: absolute;
    inset: 0;
    margin: auto;
  }
}

/* 移动端全屏 */
@media (max-width: 1023px) {
  .player-container {
    border-radius: 0;
  }
}

.ending-actions {
  position: absolute;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 16px;
  z-index: 10;
  animation: fade-in-up 500ms 500ms cubic-bezier(0.2, 0, 0, 1) both;
}

.ending-btn {
  padding: 10px 28px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.2s;
}
.ending-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}
.ending-btn-close {
  background: var(--lt-brand);
  border-color: var(--lt-brand);
}
.ending-btn-close:hover {
  background: var(--lt-brand-dark);
  border-color: var(--lt-brand-dark);
}

@keyframes fade-in-up {
  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* Error overlay */
.player-error-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: rgba(0, 0, 0, 0.8);
  z-index: 5;
}
.player-error-text {
  color: rgba(255, 255, 255, 0.8);
  font-size: 15px;
  margin: 0;
}
.player-error-hint {
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
  margin: 0;
}
.player-error-actions {
  display: flex;
  gap: 12px;
}
.player-retry-btn {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  background: var(--lt-brand);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}
.player-retry-btn:hover {
  background: var(--lt-brand-dark);
}
.player-close-btn {
  padding: 10px 24px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.player-close-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}
</style>
