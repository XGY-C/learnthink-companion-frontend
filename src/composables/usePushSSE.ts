import { onUnmounted, ref } from 'vue'
import { usePushStore } from '@/stores/push'
import { ensureValidToken } from '@/utils/api'
import type { PushEvent } from '@/types'

/**
 * 推送 SSE 监听 composable
 *
 * 监听服务端 SSE push 事件，更新通知红点计数。
 * 不弹窗、不刷新页面、不中断用户操作。
 *
 * 用法：在 LayoutPC.vue 的 onMounted 中调用 `usePushSSE().connect(courseId)`
 */
export function usePushSSE() {
  const pushStore = usePushStore()
  const status = ref<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  const retryCount = ref(0)

  let eventSource: EventSource | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  async function connect(courseId: string) {
    if (eventSource) return

    const tokenValid = await ensureValidToken()
    if (!tokenValid) {
      console.warn('[PushSSE] No valid token, skipping push SSE connection')
      return
    }

    const token = localStorage.getItem('token')
    status.value = 'connecting'

    // 通过现有任务 SSE 通道复用监听；push 事件也会通过该通道广播
    // 实际项目中使用系统级通知 SSE 端点，此处提供占位符
    const url = `/api/resources/recommendations/notifications?course_id=${encodeURIComponent(courseId)}`
    eventSource = new EventSource(url)

    eventSource.onopen = () => {
      status.value = 'connected'
      retryCount.value = 0
    }

    eventSource.addEventListener('push', (event: MessageEvent) => {
      try {
        const pushEvent = JSON.parse(event.data) as PushEvent
        pushStore.onPushEvent(pushEvent)
      } catch (e) {
        console.warn('[PushSSE] Failed to parse push event:', e)
      }
    })

    eventSource.onerror = () => {
      status.value = 'error'
      eventSource?.close()
      eventSource = null

      const delay = Math.min(1000 * Math.pow(2, retryCount.value), 30000)
      retryCount.value++
      reconnectTimer = setTimeout(() => connect(courseId), delay)
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
