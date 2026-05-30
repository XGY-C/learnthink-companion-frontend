import { ref, onUnmounted } from 'vue'
import { useUserStore } from '@/stores/user'
import type { SSEEventType } from '@/types'

export interface SSECallbacks {
  onStage?: (data: { stage: string; percent: number; message: string }) => void
  onResourceReady?: (data: { type: string; title: string; content: string; confidence: string; sources: number; resourceId: string }) => void
  onReviewFlag?: (data: { type: string; action: string; message: string }) => void
  onAgentThought?: (data: any) => void
  onAgentMessage?: (data: any) => void
  onTaskDone?: (data: { packId: string; topic: string; resourceTypes: string[]; plannerRationale: string }) => void
  onTaskFailed?: (data: { error: string; message: string }) => void
  onSubTopicStarted?: (data: { index: number; total: number; title: string; description: string; itemCount: number }) => void
  onSubTopicCompleted?: (data: { index: number; total: number; title: string; publishedItems: string[] }) => void
  onChecklistCreated?: (data: any) => void
  onChecklistUpdated?: (data: any) => void
  onAgentGenerationStarted?: (data: any) => void
  onAgentGenerationDone?: (data: any) => void
  onAgentGenerationFailed?: (data: any) => void
  onGapTasks?: (data: { tasks: { task_id: string; module_title: string; module_id: string; resource_types: string[] }[] }) => void
}

export function useSSE() {
  const status = ref<'connected' | 'connecting' | 'disconnected' | 'reconnecting'>('disconnected')
  const error = ref<string | null>(null)
  const retryCount = ref(0)
  let eventSource: EventSource | null = null
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempts = 0
  const MAX_RECONNECT_MS = 30000

  function connect(taskId: string, callbacks: SSECallbacks) {
    disconnect()

    const userStore = useUserStore()
    const token = userStore.token
    if (!token) {
      error.value = '未登录'
      return
    }

    status.value = 'connecting'
    const url = `/api/tasks/${taskId}/events?token=${encodeURIComponent(token)}`

    eventSource = new EventSource(url)

    eventSource.onopen = () => {
      status.value = 'connected'
      reconnectAttempts = 0
      retryCount.value = 0
      error.value = null
    }

    eventSource.onerror = () => {
      status.value = 'reconnecting'
      retryCount.value = reconnectAttempts + 1
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_MS)
      reconnectAttempts++
      reconnectTimeout = setTimeout(() => connect(taskId, callbacks), delay)
    }

    const handlers: Record<SSEEventType, ((data: any) => void) | undefined> = {
      'task.stage': callbacks.onStage,
      'resource.ready': callbacks.onResourceReady,
      'review.flag': callbacks.onReviewFlag,
      'agent.thought': callbacks.onAgentThought,
      'agent.message': callbacks.onAgentMessage,
      'task.done': callbacks.onTaskDone,
      'task.failed': callbacks.onTaskFailed,
      'task.accepted': undefined,
      'subtopic.started': callbacks.onSubTopicStarted,
      'subtopic.completed': callbacks.onSubTopicCompleted,
      'checklist.created': callbacks.onChecklistCreated,
      'checklist.updated': callbacks.onChecklistUpdated,
      'agent.generation.started': callbacks.onAgentGenerationStarted,
      'agent.generation.done': callbacks.onAgentGenerationDone,
      'agent.generation.failed': callbacks.onAgentGenerationFailed,
      'plan.gap_tasks': callbacks.onGapTasks,
    }

    Object.entries(handlers).forEach(([event, handler]) => {
      if (!handler) return
      eventSource!.addEventListener(event, (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data)
          handler(parsed)
        } catch {
          // ignore parse errors
        }
      })
    })
  }

  function disconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    status.value = 'disconnected'
    reconnectAttempts = 0
    retryCount.value = 0
  }

  onUnmounted(() => {
    disconnect()
  })

  return { status, error, retryCount, connect, disconnect }
}
