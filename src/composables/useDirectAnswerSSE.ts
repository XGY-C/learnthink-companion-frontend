import { ref } from 'vue'
import { useDirectAnswerStore } from '@/stores/directAnswer'
import { useRouter } from 'vue-router'
import { getToken } from '@/api/tutoring'
import type { DirectAnswerMode } from '@/types/directAnswer'

/** 最大重试次数 */
const MAX_RETRIES = 2
/** 重试间隔基数（ms），指数退避：delay * 2^retry） */
const RETRY_BASE_DELAY = 2000

export function useDirectAnswerSSE() {
  const store = useDirectAnswerStore()
  const router = useRouter()
  let abortController: AbortController | null = null
  let retryCount = 0
  /** 重试时保留的已生成 section 计数，用于恢复进度 */
  let savedSectionCount = 0

  const isStreaming = ref(false)
  const error = ref<{ code: string; message: string; retryable: boolean } | null>(null)

  /**
   * 创建 DirectAnswer 会话并跳转到 DirectAnswerView。
   * 对应入口 B：TutoringInput 选 direct → 创建 → 跳转
   */
  async function createAndNavigate(question: string, courseId: string, mode: DirectAnswerMode) {
    store.reset()
    const resp = await fetch('/api/direct-answer/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify({ question, courseId, mode }),
    })
    const json = await resp.json()
    const { sessionId } = json.data
    store.setSessionId(sessionId)
    router.push(`/answer/${sessionId}?q=${encodeURIComponent(question)}&courseId=${encodeURIComponent(courseId)}&mode=${mode}`)
  }

  /**
   * 启动 DirectAnswer SSE 流式生成（含自动重试）。
   * @param isRetry 是否为重试调用（内部使用）
   */
  async function startAnswer(
    sessionId: string,
    question: string,
    courseId: string,
    mode: string,
    isRetry = false,
  ) {
    if (!isRetry) {
      store.reset()
      store.setSessionId(sessionId)
      store.setStatus('analyzing')
      retryCount = 0
      savedSectionCount = 0
      error.value = null
    }
    isStreaming.value = true

    abortController = new AbortController()

    try {
      const response = await fetch('/api/direct-answer/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ sessionId, question, courseId, mode }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''
      let currentEvent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.substring(6).trim()
          } else if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.substring(5).trim()
            try {
              const data = JSON.parse(dataStr)
              handleEvent(currentEvent, data)
            } catch {
              // data 可能是纯字符串
              handleEvent(currentEvent, dataStr)
            }
            currentEvent = ''
          }
        }
      }
      // 流正常结束，重置重试计数
      retryCount = 0
    } catch (e: any) {
      if (e.name === 'AbortError') {
        // 用户主动取消，不重试
        return
      }

      // 保存已完成的 section 数量用于重试恢复
      savedSectionCount = Array.from(store.sections.values())
        .filter(s => s.status === 'done').length

      // 自动重试逻辑：仅在未完成且有重试配额时执行
      if (retryCount < MAX_RETRIES && store.status !== 'done') {
        retryCount++
        const delay = RETRY_BASE_DELAY * Math.pow(2, retryCount - 1)
        console.warn(
          `[DirectAnswer SSE] 连接中断，${delay / 1000}s 后第 ${retryCount}/${MAX_RETRIES} 次重试...`,
          e.message,
        )
        await new Promise(resolve => setTimeout(resolve, delay))

        // 重试前恢复已完成的 section 进度
        if (isRetry) {
          store.setStatus('generating')
        }
        try {
          await startAnswer(sessionId, question, courseId, mode, true)
        } catch {
          // 重试内部已处理错误
        }
        return
      }

      // 超过重试次数或已完成，设置最终错误
      error.value = {
        code: 'NETWORK_ERROR',
        message: retryCount >= MAX_RETRIES
          ? `连接失败，已重试 ${MAX_RETRIES} 次：${e.message}`
          : e.message,
        retryable: store.status !== 'done',
      }
      store.setStatus('error')
    } finally {
      isStreaming.value = false
    }
  }

  function cancelAnswer() {
    abortController?.abort()
    isStreaming.value = false
    retryCount = MAX_RETRIES // 阻止后续自动重试
    store.setStatus('idle')
  }

  // ===== SSE 事件处理 =====

  function handleEvent(event: string, data: any) {
    switch (event) {
      case 'direct.mode':
        store.setStatus('analyzing')
        break

      case 'direct.section_analysis':
        store.setStatus('planning')
        break

      case 'direct.section_plan':
        store.setStatus('generating')
        // 预初始化所有 section 为 pending
        if (data.sections) {
          for (const s of data.sections) {
            store.startSection(s.id, s.title)
          }
        }
        break

      case 'direct.thought':
        if (typeof data === 'string') {
          store.appendThought(data)
        } else if (data.chunk) {
          store.appendThought(data.chunk)
        }
        break

      case 'direct.section_start':
        store.startSection(data.sectionId, data.title)
        break

      case 'direct.section_chunk':
        store.appendSectionChunk(data.sectionId, typeof data === 'string' ? data : data.chunk)
        break

      case 'direct.section_done':
        store.completeSection(data.sectionId)
        break

      case 'direct.done':
        store.setStatus('done')
        if (data.metadata) {
          store.setMetadata(data.metadata)
        }
        break

      case 'direct.error':
        error.value = {
          code: data.code || 'UNKNOWN',
          message: data.message || '未知错误',
          retryable: data.retryable ?? true,
        }
        store.setStatus('error')
        break
    }
  }

  return {
    isStreaming,
    error,
    createAndNavigate,
    startAnswer,
    cancelAnswer,
    progress: store.progress,
    thoughtContent: store.thoughtContent,
    status: store.status,
  }
}
