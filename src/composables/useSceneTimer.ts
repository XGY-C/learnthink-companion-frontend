import { ref, watch, onBeforeUnmount } from 'vue'

/**
 * Pausable scene animation timer.
 * Tracks virtual playback time that respects isPlaying and speed.
 * Uses requestAnimationFrame for smooth, tab-aware ticking.
 */
export function useSceneTimer(
  isPlaying: () => boolean,
  speed: () => number,
  totalDuration: number,
  onComplete: () => void,
) {
  const virtualTime = ref(0)
  let rafId: number | null = null
  let lastTickReal = 0
  let _completed = false

  function tick() {
    if (isPlaying()) {
      const now = performance.now()
      const delta = now - lastTickReal
      lastTickReal = now
      // 大间隔（标签页不活跃、GC 暂停等）不推进时间，避免跳跃
      if (delta < 500) {
        virtualTime.value += delta * speed()
      }
      if (virtualTime.value >= totalDuration) {
        stopTicking()
        _completed = true
        onComplete()
        return
      }
    } else {
      lastTickReal = performance.now()
    }
    rafId = requestAnimationFrame(tick)
  }

  function startTicking() {
    if (rafId || _completed) return
    lastTickReal = performance.now()
    rafId = requestAnimationFrame(tick)
  }

  function stopTicking() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null }
  }

  watch(() => isPlaying(), (playing) => {
    if (playing) startTicking()
    else stopTicking()
  }, { immediate: true })

  onBeforeUnmount(() => stopTicking())

  return { virtualTime, stopTicking }
}
