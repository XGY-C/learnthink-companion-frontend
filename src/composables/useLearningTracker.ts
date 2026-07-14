import { ref, onMounted, onUnmounted } from 'vue'
import { apiFetch } from '@/utils/api'

interface TrackerOptions {
  courseId: string
  /** 心跳间隔（毫秒），默认 30000 */
  interval?: number
  /** 最大空闲轮次，默认 20 轮 = 10 分钟 */
  maxIdleRounds?: number
}

export function useLearningTracker(options: TrackerOptions) {
  const { courseId, interval = 30000, maxIdleRounds = 20 } = options

  const isTracking = ref(false)
  const isAway = ref(false)
  const todaySeconds = ref(0)
  const sessionSeconds = ref(0)

  let timer: ReturnType<typeof setInterval> | null = null
  let lastActiveTime = Date.now()
  let idleRoundCount = 0
  let activityListeners: Array<{ event: string; target: EventTarget; handler: EventListener }> = []

  /** 注册活跃事件监听 */
  function registerListeners() {
    const events: Array<{ event: string; target: EventTarget }> = [
      { event: 'mousemove', target: document },
      { event: 'scroll', target: document },
      { event: 'keydown', target: document },
    ]
    const videos = document.querySelectorAll('video')
    videos.forEach(v => events.push({ event: 'timeupdate', target: v }))

    events.forEach(({ event, target }) => {
      const handler = (() => { lastActiveTime = Date.now() }) as EventListener
      target.addEventListener(event, handler, { passive: true })
      activityListeners.push({ event, target, handler })
    })
  }

  /** 注销活跃事件监听 */
  function unregisterListeners() {
    activityListeners.forEach(({ event, target, handler }) => {
      target.removeEventListener(event, handler)
    })
    activityListeners = []
  }

  /** 发送心跳 */
  async function sendHeartbeat(delta: number) {
    try {
      await apiFetch('/user/me/learning-heartbeat', {
        method: 'POST',
        body: { courseId, deltaSeconds: delta },
      })
      todaySeconds.value += delta
      sessionSeconds.value += delta
    } catch {
      // 网络失败静默丢弃本次 delta，不影响后续心跳
    }
  }

  /** 心跳轮次 */
  function tick() {
    const idleMs = Date.now() - lastActiveTime

    if (idleMs < interval) {
      sendHeartbeat(Math.floor(interval / 1000))
      idleRoundCount = 0
    } else {
      idleRoundCount++
      if (idleRoundCount >= maxIdleRounds) {
        stopTracking()
        isAway.value = true
      }
    }
  }

  /** 页面可见性变化 */
  function handleVisibilityChange() {
    if (document.hidden) {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    } else {
      if (isTracking.value && !isAway.value) {
        lastActiveTime = Date.now()
        timer = setInterval(tick, interval)
      }
    }
  }

  /** 页面关闭前最后上报（用 fetch keepalive 替代 sendBeacon，可携带 Auth 头） */
  function handleBeforeUnload() {
    if (sessionSeconds.value > 0) {
      const token = localStorage.getItem('token') || ''
      fetch('/api/user/me/learning-heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ courseId, deltaSeconds: sessionSeconds.value }),
        keepalive: true,
      }).catch(() => {})
    }
  }

  /** 开始追踪 */
  function startTracking() {
    if (isTracking.value) return
    isTracking.value = true
    isAway.value = false
    idleRoundCount = 0
    lastActiveTime = Date.now()
    sessionSeconds.value = 0

    registerListeners()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    timer = setInterval(tick, interval)
  }

  /** 停止追踪 */
  function stopTracking() {
    isTracking.value = false
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    unregisterListeners()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('beforeunload', handleBeforeUnload)
  }

  /** 用户从"已离开"恢复，重新启动追踪 */
  function resumeTracking() {
    isAway.value = false
    startTracking()
  }

  onMounted(() => startTracking())
  onUnmounted(() => stopTracking())

  return {
    isTracking,
    isAway,
    todaySeconds,
    sessionSeconds,
    startTracking,
    stopTracking,
    resumeTracking,
  }
}
