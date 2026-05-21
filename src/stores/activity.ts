import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiFetch } from '@/utils/api'
import type { Activity, ActivitySubmitResponse, QuizQuestion } from '@/types'

export const useActivityStore = defineStore('activity', () => {
  const currentActivity = ref<Activity | null>(null)
  const contentMarkdown = ref('')
  const quizQuestions = ref<QuizQuestion[]>([])
  const quizAnswers = ref<Map<string, string>>(new Map())
  const quizCurrentIndex = ref(0)
  const quizState = ref<'idle' | 'answering' | 'submitting' | 'result'>('idle')
  const quizResult = ref<ActivitySubmitResponse | null>(null)
  const learnStartTime = ref(0)
  const interactionDetected = ref(false)
  const scrolledToBottom = ref(false)
  const loading = ref(false)

  const currentQuestion = computed(() =>
    quizQuestions.value[quizCurrentIndex.value] || null
  )

  const answeredCount = computed(() => quizAnswers.value.size)
  const totalCount = computed(() => quizQuestions.value.length)
  const isLastQuestion = computed(() => quizCurrentIndex.value >= quizQuestions.value.length - 1)
  const allQuestionsAnswered = computed(() => answeredCount.value >= totalCount.value)

  // Learn completion
  const elapsedSeconds = computed(() => {
    if (!learnStartTime.value) return 0
    return Math.floor((Date.now() - learnStartTime.value) / 1000)
  })

  const canCompleteLearn = computed(() => {
    if (!currentActivity.value) return false
    const estMin = currentActivity.value.estimatedMinutes || 25
    const timeOk = elapsedSeconds.value >= estMin * 60 * 0.6
    const scrolledOk = scrolledToBottom.value && elapsedSeconds.value >= estMin * 60 * 0.3
    return (timeOk || scrolledOk) && interactionDetected.value
  })

  async function fetchActivity(activityId: string) {
    loading.value = true
    try {
      // Activity details are from the plan store's subPlans
      // This fetches the resource content via resource-packs API
      const res = await apiFetch<any>(`/resource-packs/placeholder`)
      return res.data
    } catch {
      return null
    } finally {
      loading.value = false
    }
  }

  function startQuiz(activity: Activity) {
    currentActivity.value = activity
    quizState.value = 'answering'
    quizAnswers.value = new Map()
    quizCurrentIndex.value = 0
    quizResult.value = null

    // Restore saved answers from sessionStorage
    const saved = sessionStorage.getItem(`quiz_${activity.activityId}`)
    if (saved) {
      try {
        quizAnswers.value = new Map(JSON.parse(saved))
      } catch { /* ignore */ }
    }
  }

  function selectAnswer(questionId: string, answer: string) {
    quizAnswers.value.set(questionId, answer)
    // Persist to sessionStorage
    saveAnswers()
  }

  function saveAnswers() {
    if (currentActivity.value) {
      sessionStorage.setItem(
        `quiz_${currentActivity.value.activityId}`,
        JSON.stringify([...quizAnswers.value])
      )
    }
  }

  function clearSavedAnswers() {
    if (currentActivity.value) {
      sessionStorage.removeItem(`quiz_${currentActivity.value.activityId}`)
    }
  }

  async function submitQuiz(activityId: string): Promise<ActivitySubmitResponse | null> {
    quizState.value = 'submitting'
    try {
      const answers = [...quizAnswers.value].map(([questionId, answer]) => ({
        question_id: questionId,
        answer,
      }))
      const res = await apiFetch<ActivitySubmitResponse>(`/plan/activities/${activityId}/submit`, {
        method: 'POST',
        body: { answers },
      })
      if (res.data) {
        quizResult.value = res.data
        quizState.value = 'result'
        clearSavedAnswers()
        return res.data
      }
    } catch { /* ignore */ }
    quizState.value = 'answering'
    return null
  }

  function startLearn(activity: Activity) {
    currentActivity.value = activity
    learnStartTime.value = Date.now()
    interactionDetected.value = false
    scrolledToBottom.value = false
  }

  function markInteraction() {
    interactionDetected.value = true
  }

  function markScrolledToBottom() {
    scrolledToBottom.value = true
  }

  async function submitLearn(activityId: string): Promise<ActivitySubmitResponse | null> {
    try {
      const duration = elapsedSeconds.value
      const res = await apiFetch<ActivitySubmitResponse>(`/plan/activities/${activityId}/submit`, {
        method: 'POST',
        body: {
          duration_seconds: duration,
          interaction_detected: interactionDetected.value,
        },
      })
      if (res.data) {
        return res.data
      }
    } catch { /* ignore */ }
    return null
  }

  function reset() {
    currentActivity.value = null
    contentMarkdown.value = ''
    quizQuestions.value = []
    quizAnswers.value = new Map()
    quizCurrentIndex.value = 0
    quizState.value = 'idle'
    quizResult.value = null
    learnStartTime.value = 0
    interactionDetected.value = false
    scrolledToBottom.value = false
  }

  return {
    currentActivity, contentMarkdown, quizQuestions, quizAnswers,
    quizCurrentIndex, quizState, quizResult,
    learnStartTime, interactionDetected, scrolledToBottom, loading,
    currentQuestion, answeredCount, totalCount, isLastQuestion,
    allQuestionsAnswered, elapsedSeconds, canCompleteLearn,
    fetchActivity, startQuiz, selectAnswer, submitQuiz,
    startLearn, markInteraction, markScrolledToBottom, submitLearn,
    reset,
  }
})
