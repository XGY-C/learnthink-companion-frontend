import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  PracticeSession,
  PracticeSessionSummary,
  AnswerResult,
  PracticeStats,
} from '@/types'
import { apiFetch, getToken, ensureValidToken } from '@/utils/api'

export const usePracticeStore = defineStore('practice', () => {
  const currentSession = ref<PracticeSession | null>(null)
  const sessions = ref<PracticeSessionSummary[]>([])
  const sessionsTotal = ref(0)
  const loading = ref(false)
  const creating = ref(false)
  const stats = ref<PracticeStats | null>(null)
  const statsLoading = ref(false)

  /** 自己选题：创建会话 */
  async function createSession(courseId: string, opts: {
    sessionType: string
    kpIds?: string[]
    difficulty?: number
    questionCount?: number
    questionTypes?: string[]
    questionIds?: string[]
    typeCounts?: Record<string, number>
  }) {
    creating.value = true
    try {
      const res = await apiFetch<PracticeSession>('/practice/sessions', {
        method: 'POST',
        body: { courseId, ...opts },
      })
      if (res.data) {
        currentSession.value = res.data
      }
      return res.data
    } finally {
      creating.value = false
    }
  }

  /** AI 智能组卷：创建会话 */
  async function aiGenerate(courseId: string, opts: {
    count?: number
    focus?: string
    kpIds?: string[]
  }) {
    creating.value = true
    try {
      const res = await apiFetch<PracticeSession>('/practice/sessions/ai-generate', {
        method: 'POST',
        body: { courseId, ...opts },
      })
      if (res.data) {
        currentSession.value = res.data
      }
      return res.data
    } finally {
      creating.value = false
    }
  }

  /** 会话列表 */
  async function fetchSessions(courseId: string, page = 1, size = 20) {
    loading.value = true
    try {
      const res = await apiFetch<{ records: PracticeSessionSummary[]; total: number }>(
        `/practice/sessions?courseId=${encodeURIComponent(courseId)}&page=${page}&size=${size}`
      )
      if (res.data) {
        sessions.value = res.data.records || []
        sessionsTotal.value = res.data.total || 0
      }
    } catch (e) {
      console.error('[PracticeStore] fetchSessions failed:', e)
    } finally {
      loading.value = false
    }
  }

  /** 会话详情 */
  async function fetchSession(id: string) {
    loading.value = true
    try {
      const res = await apiFetch<PracticeSession>(`/practice/sessions/${id}`)
      if (res.data) {
        currentSession.value = res.data
      }
      return res.data
    } catch (e) {
      console.error('[PracticeStore] fetchSession failed:', e)
      return null
    } finally {
      loading.value = false
    }
  }

  /** 练习核心统计 */
  async function fetchStats(courseId: string) {
    statsLoading.value = true
    try {
      const res = await apiFetch<PracticeStats>(`/practice/stats?courseId=${encodeURIComponent(courseId)}`)
      if (res.data) {
        stats.value = res.data
      }
    } catch (e) {
      console.error('[PracticeStore] fetchStats failed:', e)
    } finally {
      statsLoading.value = false
    }
  }

  /** 结束会话 */
  async function completeSession(id: string) {
    const res = await apiFetch(`/practice/sessions/${id}/complete`, { method: 'PUT' })
    if (res.code !== 0) {
      throw new Error(res.message || '结束练习失败')
    }
  }

  /**
   * 两步法答题：
   * ① POST /questions/answer -> 拿 attemptId + correct
   * ② POST /practice/sessions/{sid}/items/{itemId}/answer -> 记录到会话题项
   */
  async function answerQuestion(
    sessionId: string,
    itemId: string,
    courseId: string,
    questionId: string,
    selectedAnswer: any,
    durationSeconds?: number
  ): Promise<AnswerResult | null> {
    // 第一步：判分 + 写 attempts
    const res = await apiFetch<AnswerResult>('/questions/answer', {
      method: 'POST',
      body: { courseId, questionId, selectedAnswer, durationSeconds },
    })
    if (!res.data) {
      throw new Error(res.message || '判分失败')
    }

    // 第二步：记录到会话题项
    const itemRes = await apiFetch(`/practice/sessions/${sessionId}/items/${itemId}/answer`, {
      method: 'POST',
      body: {
        attemptId: res.data.attemptId,
        isCorrect: res.data.correct,
        durationSeconds: durationSeconds ?? 0,
      },
    })
    if (itemRes.code !== 0) {
      throw new Error(itemRes.message || '记录答题失败')
    }

    // 更新本地 session 状态
    if (currentSession.value) {
      const q = currentSession.value.questions.find(q => q.itemId === itemId)
      if (q) {
        q.answered = true
        q.isCorrect = res.data.correct
      }
    }

    return res.data
  }

  /** 流式评估：fetch + ReadableStream 解析 chunk/done */
  async function streamEvaluation(
    sessionId: string,
    onChunk: (text: string) => void,
    onError?: (msg: string) => void,
    onPersistFailed?: (msg: string) => void,
  ) {
    await ensureValidToken()
    const token = getToken()
    let full = ''
    let persistFailed = false

    try {
      const resp = await fetch(`/api/practice/sessions/${sessionId}/evaluation`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
        },
      })
      if (!resp.ok || !resp.body) {
        onError?.(`评估请求失败 (${resp.status})`)
        return
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''
        for (const block of events) {
          if (!block.trim()) continue
          let evt = ''
          const dataParts: string[] = []
          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) {
              evt = line.slice(6).trim()
            } else if (line.startsWith('data:')) {
              dataParts.push(line.slice(5).replace(/^ /, ''))
            }
          }
          const data = dataParts.join('\n')
          if (evt === 'chunk') {
            full += data
            onChunk(data)
          } else if (evt === 'persist_failed') {
            persistFailed = true
            onPersistFailed?.(data || '评估保存失败')
          } else if (evt === 'error') {
            onError?.(data || '评估失败')
          }
        }
      }
    } catch (e) {
      onError?.('网络异常，评估中断')
    }

    // 持久化成功时同步本地 session.evaluation，避免本地状态与后端不一致
    if (!persistFailed && currentSession.value && currentSession.value.id === sessionId) {
      currentSession.value.evaluation = full
    }
  }

  return {
    currentSession,
    sessions,
    sessionsTotal,
    loading,
    creating,
    stats,
    statsLoading,
    createSession,
    aiGenerate,
    fetchSessions,
    fetchSession,
    fetchStats,
    completeSession,
    answerQuestion,
    streamEvaluation,
  }
})
