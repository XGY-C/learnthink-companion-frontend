import { ref } from 'vue'
import { useDirectAnswerStore } from '@/stores/directAnswer'
import { getToken } from '@/api/tutoring'
import type { DirectAnswerMode } from '@/types/directAnswer'

/** 最大重试次数 */
const MAX_RETRIES = 2
/** 重试间隔基数（ms） */
const RETRY_BASE_DELAY = 2000

/**
 * DirectAnswer 内联 SSE composable。
 * 与 useDirectAnswerSSE 的区别：不跳转到独立页面，数据驱动 directAnswerStore，
 * 供 ChatView 内嵌的 DirectAnswerInline 组件渲染。
 */
export function useDirectAnswerInlineSSE() {
  const store = useDirectAnswerStore()
  let abortController: AbortController | null = null
  let retryCount = 0

  const isStreaming = ref(false)
  const error = ref<{ code: string; message: string; retryable: boolean } | null>(null)
  const sessionId = ref<string | null>(null)

  /** 创建会话并启动 SSE 流 */
  async function start(question: string, courseId: string, mode: DirectAnswerMode, chatId?: string) {
    store.reset()
    error.value = null
    isStreaming.value = true

    try {
      // Step 1: 创建会话
      const createResp = await fetch('/api/direct-answer/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ question, courseId, mode, chatId }),
      })
      const createJson = await createResp.json()
      sessionId.value = createJson.data?.sessionId
      if (!sessionId.value) throw new Error('创建 DirectAnswer 会话失败')

      store.setSessionId(sessionId.value)

      // Step 2: 启动 SSE 流
      await streamAnswer(sessionId.value, question, courseId, mode, chatId)
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        error.value = { code: 'CREATE_ERROR', message: e.message, retryable: false }
        store.setStatus('error')
      }
    } finally {
      isStreaming.value = false
    }
  }

  /** SSE 流式生成（含自动重试） */
  async function streamAnswer(sid: string, question: string, courseId: string, mode: string, chatId?: string) {
    abortController = new AbortController()
    store.setStatus('analyzing')
    retryCount = 0

    try {
      const response = await fetch('/api/direct-answer/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ sessionId: sid, question, courseId, mode, chatId }),
        signal: abortController.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        // SSE 事件以空行（\n\n）分隔，按事件块解析，避免事件串台与多行 data 被截断
        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() || ''

        for (const block of blocks) {
          if (!block.trim()) continue
          const lines = block.split('\n')
          let eventType = ''
          let dataStr = ''

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.slice(6).trim()
            } else if (line.startsWith('data:')) {
              const val = line.slice(5)
              dataStr = dataStr === '' ? val : dataStr + '\n' + val
            }
          }
          if (!dataStr && !eventType) continue

          try {
            handleEvent(eventType, JSON.parse(dataStr))
          } catch {
            handleEvent(eventType, dataStr)
          }
        }
      }
      retryCount = 0
    } catch (e: any) {
      if (e.name === 'AbortError') return
      if (retryCount < MAX_RETRIES && store.status !== 'done') {
        retryCount++
        const delay = RETRY_BASE_DELAY * Math.pow(2, retryCount - 1)
        console.warn(`[DirectAnswer Inline] 重试 ${retryCount}/${MAX_RETRIES}，${delay}ms 后...`)
        await new Promise(r => setTimeout(r, delay))
        store.setStatus('generating')
        await streamAnswer(sid, question, courseId, mode, chatId)
        return
      }
      error.value = {
        code: 'STREAM_ERROR',
        message: e.message,
        retryable: store.status !== 'done',
      }
      store.setStatus('error')
    }
  }

  function cancel() {
    abortController?.abort()
    isStreaming.value = false
    retryCount = MAX_RETRIES
    store.setStatus('idle')
  }

  // ===== SSE 事件处理 =====
  function handleEvent(event: string, data: any) {
    switch (event) {
      case 'direct.mode':
        console.log('[DA SSE] mode:', data)
        store.setStatus('analyzing')
        break
      case 'direct.section_analysis':
        store.setStatus('planning')
        if (data && typeof data === 'object') {
          store.setAnalysis(data)
        }
        break
      case 'direct.section_plan':
        console.log('[DA SSE] section_plan, sections:', data.sections?.length || 0)
        store.setStatus('generating')
        if (data.sections) {
          for (const s of data.sections) {
            store.startSection(s.id, s.title)
          }
        }
        break
      case 'direct.thought':
        store.appendThought(typeof data === 'string' ? data : data.chunk || '')
        break
      case 'direct.section_start':
        console.log('[DA SSE] section_start:', data.sectionId, data.title)
        store.startSection(data.sectionId, data.title)
        break
      case 'direct.section_chunk': {
        const chunk = typeof data === 'string' ? data : data.chunk || ''
        const len = chunk.length
        console.log('[DA SSE] section_chunk:', data.sectionId, len > 20 ? chunk.slice(0, 20) + '...(' + len + ')' : chunk)
        store.appendSectionChunk(data.sectionId, chunk)
        break
      }
      case 'direct.section_done': {
        const s = store.sections.get(data.sectionId)
        const contentLen = s?.content?.length || 0
        console.log('[DA SSE] section_done:', data.sectionId, 'content length:', contentLen)
        store.completeSection(data.sectionId)
        break
      }
      case 'direct.done':
        console.log('[DA SSE] done, sectionCount:', data.sectionCount)
        // 把仍在 streaming/pending 的 section 标记完成（LLM 可能没生成全部7段）
        const pendingSections: string[] = []
        store.sections.forEach((v, k) => {
          if (v.status !== 'done') pendingSections.push(k)
        })
        if (pendingSections.length > 0) {
          console.log('[DA SSE] completing pending sections:', pendingSections)
          for (const id of pendingSections) {
            store.completeSection(id)
          }
        }
        store.setStatus('done')
        if (data.metadata) store.setMetadata(data.metadata)
        break
      case 'direct.error':
        error.value = { code: data.code || 'UNKNOWN', message: data.message || '未知错误', retryable: data.retryable ?? true }
        store.setStatus('error')
        break
    }
  }

  return { isStreaming, error, sessionId, start, cancel, store }
}
