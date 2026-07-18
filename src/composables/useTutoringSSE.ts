import { ref, onUnmounted } from 'vue'
import { useTutoringStore } from '@/stores/tutoring'
import { startTutoringStream, regenerateSection as regenerateSectionApi, guidedAnswerStream, ensureValidToken, getToken } from '@/api/tutoring'
import type { TutoringStartRequest, TutoringSSEEvent, RegenerateSectionRequest, GuidedAnswerRequest } from '@/types/tutoring'

function parseSSEEvent(raw: string): TutoringSSEEvent | null {
  const lines = raw.split('\n')
  let eventType = ''
  let dataStr = ''

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataStr = line.slice(5).trim()
    }
  }

  if (!eventType || !dataStr) return null

  try {
    return { event: eventType as TutoringSSEEvent['event'], data: JSON.parse(dataStr) }
  } catch {
    return null
  }
}

async function readSSEStream(
  response: Response,
  store: ReturnType<typeof useTutoringStore>,
  abortSignal?: AbortSignal
) {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      const events = buffer.split('\n\n')
      buffer = events.pop() || ''

      for (const eventBlock of events) {
        if (!eventBlock.trim()) continue
        if (abortSignal?.aborted) return
        const parsed = parseSSEEvent(eventBlock)
        if (parsed) {
          store.handleSSEEvent(parsed)
        }
      }
    }
    // 流正常结束后，如果 status 仍为中间状态（非 done/error/clarifying/guided/idle），
    // 说明 SSE 被服务端超时断开，需要触发 error 让上层清理
    if (store.status !== 'done' && store.status !== 'error' &&
        store.status !== 'clarifying' && store.status !== 'guided' &&
        store.status !== 'idle') {
      store.handleSSEEvent({
        event: 'tutoring.error',
        data: {
          code: 'STREAM_TIMEOUT',
          message: '辅导连接超时，请重试',
          phase: '3',
          retryable: true,
        },
      })
    }
  } catch (e: unknown) {
    if ((e as Error).name !== 'AbortError') {
      store.handleSSEEvent({
        event: 'tutoring.error',
        data: {
          code: 'STREAM_INTERRUPTED',
          message: '连接中断',
          phase: '3',
          retryable: true,
        },
      })
    }
  }
}

export function useTutoringSSE() {
  const store = useTutoringStore()
  const abortController = ref<AbortController | null>(null)

  async function startTutoring(request: TutoringStartRequest) {
    // 取消上一次未完成的 SSE 连接（如旧澄清连接），避免旧事件污染 store
    abortController.value?.abort()
    abortController.value = null

    // 仅当**新建会话**（没有 sessionId）才整体 init；
    // 澄清回流（带 clarificationResponse）保留 sections / sessionId，只清 clarification 状态
    // 如果 status 已经是 'planning'（sendTutoringMessage 已提前调用 initSession），跳过
    if (!request.sessionId && !request.clarificationResponse && store.status === 'idle') {
      store.initSession(request.question)
    } else if (request.clarificationResponse) {
      store.clarification = null
      store.clarificationDecision = null
      store.clarifyWaitSeconds = 0
      store.error = null
      store.status = 'planning'
    }

    const controller = new AbortController()
    abortController.value = controller

    try {
      const response = await startTutoringStream(request)
      if (!response.ok) {
        store.handleSSEEvent({
          event: 'tutoring.error',
          data: {
            code: 'CONNECTION_FAILED',
            message: `连接失败 (HTTP ${response.status})`,
            phase: 'context',
            retryable: true,
          },
        })
        return
      }
      await readSSEStream(response, store, controller.signal)
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        store.handleSSEEvent({
          event: 'tutoring.error',
          data: {
            code: 'CONNECTION_FAILED',
            message: '网络连接失败',
            phase: 'context',
            retryable: true,
          },
        })
      }
    }
  }

  async function regenerateSection(sessionId: string, request: RegenerateSectionRequest) {
    store.setSectionRegenerating(request.sectionId)

    const controller = new AbortController()
    // Store per-regeneration controller

    try {
      const response = await regenerateSectionApi(sessionId, request)
      if (!response.ok) {
        store.handleSSEEvent({
          event: 'tutoring.error',
          data: {
            code: 'REGENERATE_FAILED',
            message: `局部再生失败 (HTTP ${response.status})`,
            phase: '3',
            retryable: true,
          },
        })
        return
      }
      await readSSEStream(response, store, controller.signal)
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        store.handleSSEEvent({
          event: 'tutoring.error',
          data: {
            code: 'REGENERATE_FAILED',
            message: '局部再生连接失败',
            phase: '3',
            retryable: true,
          },
        })
      }
    }
  }

  async function submitGuidedAnswer(request: GuidedAnswerRequest) {
    const controller = new AbortController()
    try {
      const response = await guidedAnswerStream(request)
      if (!response.ok) {
        store.handleSSEEvent({
          event: 'tutoring.error',
          data: {
            code: 'GUIDED_ANSWER_FAILED',
            message: `提交失败 (HTTP ${response.status})`,
            phase: 'guided',
            retryable: true,
          },
        })
        return
      }
      await readSSEStream(response, store, controller.signal)
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        store.handleSSEEvent({
          event: 'tutoring.error',
          data: {
            code: 'GUIDED_ANSWER_FAILED',
            message: '网络连接失败',
            phase: 'guided',
            retryable: true,
          },
        })
      }
    }
  }

  function cancel() {
    abortController.value?.abort()
    abortController.value = null
  }

  onUnmounted(() => {
    abortController.value?.abort()
    abortController.value = null
  })

  return { startTutoring, regenerateSection, submitGuidedAnswer, cancel, abortController }
}
