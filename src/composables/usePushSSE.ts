import { onUnmounted, ref } from 'vue'
import { usePushStore } from '@/stores/push'
import { useUserStore } from '@/stores/user'
import type { PushEvent } from '@/types'

/**
 * 推送 SSE 监听 composable
 *
 * 连接后端 /notifications/sse 端点，实时接收推送通知。
 * 更新通知红点计数，弹出 Toast 通知。
 *
 * 用法：在 Layout 的 onMounted 中调用 `const { connect } = usePushSSE(); connect()`
 */
export function usePushSSE() {
  const pushStore = usePushStore()
  const userStore = useUserStore()
  const status = ref<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  const retryCount = ref(0)

  let eventSource: EventSource | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  const MAX_RECONNECT_MS = 30000

  function connect() {
    // 防重入：已连接则跳过
    if (eventSource) return

    const token = userStore.token
    if (!token) {
      console.warn('[PushSSE] No token, skipping push SSE connection')
      return
    }

    status.value = 'connecting'

    // EventSource 不支持自定义 Header，通过 query param 传递 token
    const url = `/api/notifications/sse?token=${encodeURIComponent(token)}`
    eventSource = new EventSource(url)

    eventSource.addEventListener('connected', () => {
      status.value = 'connected'
      retryCount.value = 0
    })

    eventSource.addEventListener('push', (event: MessageEvent) => {
      try {
        const pushEvent = JSON.parse(event.data) as PushEvent
        pushStore.onPushEvent(pushEvent)
      } catch (e) {
        console.warn('[PushSSE] Failed to parse push event:', e)
      }
    })

    eventSource.addEventListener('unread-count', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (typeof data.unreadCount === 'number') {
          pushStore.unreadCount = data.unreadCount
        }
      } catch (e) {
        console.warn('[PushSSE] Failed to parse unread-count event:', e)
      }
    })

    eventSource.onerror = () => {
      status.value = 'error'
      eventSource?.close()
      eventSource = null

      // 清除已有的重连定时器，避免多定时器叠加
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }
      const delay = Math.min(1000 * Math.pow(2, retryCount.value), MAX_RECONNECT_MS)
      retryCount.value++
      reconnectTimer = setTimeout(() => connect(), delay)
    }
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    status.value = 'disconnected'
    retryCount.value = 0
  }

  onUnmounted(() => {
    disconnect()
  })

  return { status, connect, disconnect }
}
