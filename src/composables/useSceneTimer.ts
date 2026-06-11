import { ref, watch, onBeforeUnmount } from 'vue'

/**
 * Pausable scene animation timer.
 * Tracks virtual playback time that respects isPlaying and speed.
 * Used by all scene components to replace bare setTimeout.
 */
export function useSceneTimer(
  isPlaying: () => boolean,
  speed: () => number,
  totalDuration: number,
  onComplete: () => void,
) {
  const virtualTime = ref(0)
  let intervalId: ReturnType<typeof setInterval> | null = null
  let lastTickReal = 0
  let _completed = false

  function startTicking() {
    if (intervalId || _completed) return
    lastTickReal = Date.now()
    intervalId = setInterval(() => {
      if (isPlaying()) {
        const now = Date.now()
        virtualTime.value += (now - lastTickReal) * speed()
        lastTickReal = now
        if (virtualTime.value >= totalDuration) {
          stopTicking()
          _completed = true
          onComplete()
        }
      } else {
        lastTickReal = Date.now()
      }
    }, 50)
  }

  function stopTicking() {
    if (intervalId) { clearInterval(intervalId); intervalId = null }
  }

  watch(() => isPlaying(), (playing) => {
    if (playing) startTicking()
    else stopTicking()
  }, { immediate: true })

  onBeforeUnmount(() => stopTicking())

  return { virtualTime, stopTicking }
}
