import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { QBankQuestion, QuestionPage, KpAccuracy, BatchCreateQBankQuestionsRequest, BatchCreateQBankQuestionsResult } from '@/types'
import { apiFetch } from '@/utils/api'

export const useQuestionBankStore = defineStore('questionBank', () => {
  const questions = ref<QBankQuestion[]>([])
  const total = ref(0)
  const loading = ref(false)
  const detailLoading = ref(false)
  const currentQuestion = ref<QBankQuestion | null>(null)
  const kpAccuracyList = ref<KpAccuracy[]>([])

  async function fetchQuestions(
    courseId: string,
    options: {
      questionType?: string
      difficulty?: number
      kpId?: string
      sort?: string
      page?: number
      size?: number
    } = {}
  ) {
    loading.value = true
    try {
      const params = new URLSearchParams({ courseId })
      if (options.questionType) params.set('questionType', options.questionType)
      if (options.difficulty !== undefined) params.set('difficulty', String(options.difficulty))
      if (options.kpId) params.set('kpId', options.kpId)
      if (options.sort) params.set('sort', options.sort)
      params.set('page', String(options.page ?? 1))
      params.set('size', String(options.size ?? 50))

      const res = await apiFetch<QuestionPage>(`/questions?${params}`)
      if (res.data) {
        questions.value = res.data.items || []
        total.value = res.data.total || 0
      }
    } catch (e) {
      console.error('[QuestionBankStore] fetchQuestions failed:', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchQuestionDetail(id: string) {
    detailLoading.value = true
    try {
      const res = await apiFetch<QBankQuestion>(`/questions/${id}`)
      if (res.data) currentQuestion.value = res.data
    } catch (e) {
      console.error('[QuestionBankStore] fetchQuestionDetail failed:', e)
    } finally {
      detailLoading.value = false
    }
  }

  async function batchCreateFromResource(req: BatchCreateQBankQuestionsRequest): Promise<BatchCreateQBankQuestionsResult | null> {
    try {
      const res = await apiFetch<BatchCreateQBankQuestionsResult>('/questions/batch', { method: 'POST', body: req })
      return res.data || null
    } catch (e) {
      console.error('[QuestionBankStore] batchCreateFromResource failed:', e)
      return null
    }
  }

  async function deleteQuestion(id: string): Promise<boolean> {
    try {
      await apiFetch(`/questions/${id}`, { method: 'DELETE' })
      questions.value = questions.value.filter(q => q.id !== id)
      total.value--
      return true
    } catch {
      return false
    }
  }

  async function fetchKpAccuracy(courseId: string) {
    try {
      const res = await apiFetch<KpAccuracy[]>(`/questions/stats/kp-accuracy?courseId=${encodeURIComponent(courseId)}`)
      if (res.data) kpAccuracyList.value = res.data
    } catch (e) {
      console.error('[QuestionBankStore] fetchKpAccuracy failed:', e)
    }
  }

  async function fetchWrongQuestions(courseId: string, page = 1, size = 50) {
    loading.value = true
    try {
      const res = await apiFetch<QuestionPage>(`/questions/wrong?courseId=${encodeURIComponent(courseId)}&page=${page}&size=${size}`)
      if (res.data) {
        questions.value = res.data.items || []
        total.value = res.data.total || 0
      }
    } catch (e) {
      console.error('[QuestionBankStore] fetchWrongQuestions failed:', e)
    } finally {
      loading.value = false
    }
  }

  return {
    questions,
    total,
    loading,
    detailLoading,
    currentQuestion,
    kpAccuracyList,
    fetchQuestions,
    fetchQuestionDetail,
    batchCreateFromResource,
    deleteQuestion,
    fetchKpAccuracy,
    fetchWrongQuestions,
  }
})
