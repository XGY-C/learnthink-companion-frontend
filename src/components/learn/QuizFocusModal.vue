<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { usePlanStore } from '@/stores/plan'
import { useActivityStore } from '@/stores/activity'
import type { ActivitySubmitResponse, QuizQuestion, PlayerQuestion, PlayerResult } from '@/types'
import { ElMessage, ElMessageBox } from 'element-plus'
import confetti from 'canvas-confetti'
import { useSoundEffect } from '@/composables/useSoundEffect'
import { useProfileStore } from '@/stores/profile'
import { useLearningTracker } from '@/composables/useLearningTracker'
import { ensureValidToken, getToken } from '@/utils/api'
import QuizPlayer from '@/components/learn/QuizPlayer.vue'

const props = defineProps<{
  questions: QuizQuestion[]
  resourceIdx: number
  activityId: string
  teleportBar?: boolean
}>()

const emit = defineEmits<{
  complete: [result: ActivitySubmitResponse]
  backToPath: []
  askAi: [questionId: string, questionData: { questionId: string; type: string; typeLabel: string; content: string; options: string[]; userAnswer?: string; difficulty: number; difficultyLabel: string; knowledgeTags?: string[] }]
}>()

const planStore = usePlanStore()
const actStore = useActivityStore()
const profileStore = useProfileStore()

const { isAway: isLearningAway, resumeTracking } = useLearningTracker({
  courseId: profileStore.activeCourseId,
})

// ========== Core State ==========
const safeQuestions = computed(() =>
  props.questions.map((q, i) => ({ ...q, questionId: String(q.id ?? q.question_id ?? q.questionId ?? `q_${i}`) }))
)

const quizAnswers = ref<Record<string, string>>({})
const quizCurrentQ = ref(0)
const quizState = ref<'loading' | 'answering' | 'submitting' | 'result' | 'review'>('loading')
const quizResult = ref<ActivitySubmitResponse | null>(null)

// ========== Timer ==========
const elapsedTime = ref(0)
const timerInterval = ref<number | null>(null)

// ========== Marked Questions ==========
const markedQuestions = ref<Set<number>>(new Set())

// ========== Full-width Mode ==========
const fullWidth = ref(localStorage.getItem('lt-quiz-fullwidth') === 'true')
watch(fullWidth, (v) => localStorage.setItem('lt-quiz-fullwidth', String(v)))

// ========== Sound Effects ==========
const sound = useSoundEffect()

// ========== Reduced Motion ==========
const prefersReducedMotion = ref(false)

// ========== Computed ==========
const sessionKey = computed(() => `quiz_${props.activityId}_${props.resourceIdx}`)

const quizAllAnswered = computed(() =>
  safeQuestions.value.every((q) =>
    quizAnswers.value[q.questionId] != null
  )
)

// ========== PlayerQuestion adapter ==========
const playerQuestions = computed<PlayerQuestion[]>(() =>
  safeQuestions.value.map((q) => ({
    id: q.questionId,
    type: q.type,
    content: q.content,
    options: q.options || [],
    answer: q.answer,
    analysis: q.analysis,
    difficulty: q.difficulty,
    knowledgeTags: q.tags?.knowledge || [],
    mistakeTags: q.tags?.mistakes || [],
  }))
)

// ========== PlayerResult adapter ==========
function getQuestionResult(q: QuizQuestion): string | undefined {
  return quizResult.value?.questionResults?.find(
    r => r.questionId === q.questionId
  )?.result
}

function isAnswerCorrect(q: QuizQuestion): boolean {
  return getQuestionResult(q) === 'correct'
}

const playerResult = computed<PlayerResult | null>(() => {
  if (!quizResult.value) return null
  return {
    score: quizResult.value.score ?? 0,
    totalCount: safeQuestions.value.length,
    correctCount: safeQuestions.value.filter(q => isAnswerCorrect(q)).length,
    durationSeconds: elapsedTime.value,
    weakTags: quizResult.value.weakTags || [],
    questionResults: safeQuestions.value.map(q => ({
      questionId: q.questionId,
      result: (getQuestionResult(q) || 'wrong') as 'correct' | 'wrong' | 'partial',
    })),
  }
})

// ========== AI 智能评估分析 ==========
const evaluationText = ref('')
const evaluationLoading = ref(false)
const evaluationError = ref('')

async function loadEvaluation() {
  if (evaluationLoading.value) return
  evaluationLoading.value = true
  evaluationError.value = ''
  evaluationText.value = ''

  const ok = await ensureValidToken()
  if (!ok) {
    evaluationError.value = '登录已过期，请重新登录'
    evaluationLoading.value = false
    return
  }
  const token = getToken()

  try {
    const resp = await fetch(`/api/plan/activities/${props.activityId}/evaluation`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream',
      },
    })
    if (!resp.ok || !resp.body) {
      evaluationError.value = `评估请求失败 (${resp.status})`
      evaluationLoading.value = false
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
          evaluationText.value += data
        } else if (evt === 'error') {
          evaluationError.value = data || '评估失败'
        }
      }
    }
  } catch (e) {
    evaluationError.value = '网络异常，评估中断'
  } finally {
    evaluationLoading.value = false
  }
}

watch(quizResult, (r) => {
  evaluationText.value = ''
  evaluationError.value = ''
  // 不再自动触发评估，由用户手动点击按钮触发
})

// ========== Confetti ==========
function fireConfetti() {
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 }
  const colors = ['#2B6FFF', '#FF8C42', '#7C5CFC', '#34C759', '#FFD700', '#FF3B30']

  confetti({ ...defaults, particleCount: 80, colors, origin: { x: 0.3, y: 0.6 } })
  confetti({ ...defaults, particleCount: 80, colors, origin: { x: 0.7, y: 0.6 } })

  setTimeout(() => {
    confetti({ ...defaults, particleCount: 40, colors, origin: { x: 0.5, y: 0.3 }, startVelocity: 20 })
    confetti({ ...defaults, particleCount: 30, colors, origin: { x: 0.2, y: 0.5 }, spread: 90 })
    confetti({ ...defaults, particleCount: 30, colors, origin: { x: 0.8, y: 0.5 }, spread: 90 })
  }, 250)

  setTimeout(() => {
    confetti({ ...defaults, particleCount: 50, colors, origin: { x: 0.5, y: 0.4 }, spread: 120 })
  }, 500)
}

// ========== Watchers ==========
watch(quizState, (newState) => {
  if (newState === 'result') {
    if (!prefersReducedMotion.value) {
      const score = quizResult.value?.score ?? 0
      if (score >= 0.9) {
        sound.playCelebration()
        nextTick(() => fireConfetti())
      } else if (score >= 0.7) {
        sound.playCelebration()
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 }
        const colors = ['#2B6FFF', '#FF8C42', '#7C5CFC', '#34C759']
        nextTick(() => confetti({ particleCount: 40, colors, origin: { x: 0.5, y: 0.5 } }))
      } else {
        sound.playSubmit()
      }
    }
  }
})

// ========== Lifecycle ==========
onMounted(() => {
  restoreAnswers()
  quizState.value = safeQuestions.value.length > 0 ? 'answering' : 'loading'
  quizCurrentQ.value = 0
  quizResult.value = null
  elapsedTime.value = 0
  markedQuestions.value.clear()
  startTimer()

  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  prefersReducedMotion.value = mq.matches
  mq.addEventListener('change', (ev) => { prefersReducedMotion.value = ev.matches })
})

watch(() => props.questions, (q) => {
  if (safeQuestions.value.length > 0 && quizState.value === 'loading') {
    quizState.value = 'answering'
  }
}, { immediate: true })

let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null
let submitAbortController: AbortController | null = null

onUnmounted(() => {
  stopTimer()
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer)
  if (submitAbortController) submitAbortController.abort()
  confetti.reset()
})

// ========== Answer Persistence ==========
function restoreAnswers() {
  const saved = sessionStorage.getItem(sessionKey.value)
  if (saved) {
    try { quizAnswers.value = JSON.parse(saved) } catch { /* ignore */ }
  } else {
    quizAnswers.value = {}
  }
}

function persistAnswers() {
  if (Object.keys(quizAnswers.value).length > 0) {
    sessionStorage.setItem(sessionKey.value, JSON.stringify(quizAnswers.value))
  }
}

function saveAnswers() {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer)
  saveDebounceTimer = setTimeout(persistAnswers, 300)
}

// ========== Timer ==========
function startTimer() {
  elapsedTime.value = 0
  timerInterval.value = window.setInterval(() => { elapsedTime.value++ }, 1000)
}

function stopTimer() {
  if (timerInterval.value) {
    clearInterval(timerInterval.value)
    timerInterval.value = null
  }
}

// ========== Question Navigation ==========
function toggleMark(index: number) {
  if (markedQuestions.value.has(index)) {
    markedQuestions.value.delete(index)
  } else {
    markedQuestions.value.add(index)
  }
}

// ========== Answer Selection ==========
function handleSelectAnswer(questionId: string, answer: string) {
  quizAnswers.value[questionId] = answer
  saveAnswers()
  sound.playSelect()

  const q = safeQuestions.value.find(x => x.questionId === questionId)
  if (q && q.type !== 'FILL_IN_BLANK' && q.type !== 'SHORT_ANSWER' && q.type !== 'MULTIPLE_CHOICE') {
    const nextIdx = quizCurrentQ.value + 1
    if (nextIdx < safeQuestions.value.length) {
      const totalOptLen = q.options?.reduce((sum, o) => sum + o.length, 0) || 0
      const delay = prefersReducedMotion.value ? 100 : (totalOptLen > 120 ? 380 : totalOptLen > 60 ? 300 : 200)
      setTimeout(() => {
        quizCurrentQ.value = nextIdx
      }, delay)
    }
  }
}

// ========== Submit ==========
async function handleSubmit() {
  if (!quizAllAnswered.value) {
    const hasShortAnswer = safeQuestions.value.some(q => q.type === 'SHORT_ANSWER' && !quizAnswers.value[q.questionId])
    if (!hasShortAnswer) {
      const confirmed = await ElMessageBox.confirm(
        `还有 ${safeQuestions.value.length - Object.keys(quizAnswers.value).length} 题未作答，确定提交？`,
        '提示',
        { confirmButtonText: '确定提交', cancelButtonText: '继续作答', type: 'warning' }
      ).catch(() => false)
      if (!confirmed) return
    }
  }

  stopTimer()
  quizState.value = 'submitting'
  const submission = Object.entries(quizAnswers.value).map(([questionId, answer]) => ({
    question_id: questionId,
    answer,
  }))

  const durationSeconds = elapsedTime.value || Math.floor((Date.now() - (actStore.learnStartTime || Date.now())) / 1000)
  submitAbortController = new AbortController()
  const timeoutId = setTimeout(() => submitAbortController?.abort(), 15000)

  try {
    const res = await planStore.submitActivity(props.activityId, {
      answers: submission,
      duration_seconds: durationSeconds,
      signal: submitAbortController.signal,
    })

    clearTimeout(timeoutId)

    if (res) {
      quizResult.value = res
      quizState.value = 'result'
      sessionStorage.removeItem(sessionKey.value)
      sound.playSubmit()
      if (res.autoAction) {
        ElMessage.warning(res.autoAction.reason)
      }
    } else {
      ElMessage.error('提交失败，请重试')
      quizState.value = 'answering'
    }
  } catch (err: any) {
    clearTimeout(timeoutId)
    if (err?.name === 'AbortError') {
      ElMessage.warning('提交超时，请检查网络后重试')
    } else {
      ElMessage.error('提交失败，请重试')
    }
    quizState.value = 'answering'
  } finally {
    submitAbortController = null
  }
}

function handleRetry() {
  quizAnswers.value = {}
  quizCurrentQ.value = 0
  quizState.value = 'answering'
  quizResult.value = null
  sessionStorage.removeItem(sessionKey.value)
}

function handleReview() {
  quizState.value = 'review'
  quizCurrentQ.value = 0
}
</script>

<template>
  <div class="quiz-wrapper">
    <QuizPlayer
      :questions="playerQuestions"
      :answers="quizAnswers"
      v-model:currentIndex="quizCurrentQ"
      :phase="quizState"
      :result="playerResult"
      :timerSeconds="elapsedTime"
      :markedQuestions="markedQuestions"
      submitMode="batch"
      :fullWidth="fullWidth"
      :evaluationText="evaluationText"
      :evaluationLoading="evaluationLoading"
      :evaluationError="evaluationError"
      :confettiEnabled="false"
      :autoAdvanceOnSelect="false"
      @update:fullWidth="v => fullWidth = v"
      @select-answer="handleSelectAnswer"
      @submit="handleSubmit"
      @retry="handleRetry"
      @review="handleReview"
      @complete="emit('complete', quizResult!)"
      @toggle-mark="toggleMark"
      @ask-ai="(qid, data) => emit('askAi', qid, data)"
      @trigger-eval="loadEvaluation"
    />

    <!-- Away Overlay -->
    <Transition name="fade">
      <div v-if="isLearningAway" class="learning-away-overlay">
        <div class="learning-away-card">
          <p class="text-lg font-semibold mb-2">你已离开一会儿了</p>
          <p class="text-sm mb-4" style="color: var(--lt-text-auxiliary);">学习计时已暂停</p>
          <el-button type="primary" @click="resumeTracking">继续学习</el-button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.quiz-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
  background: var(--lt-bg-page);
  position: relative;
  min-height: 100%;
}

.learning-away-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 3000; backdrop-filter: blur(4px);
}
.learning-away-card {
  background: var(--lt-bg-card); border-radius: 16px;
  padding: 32px 48px; text-align: center;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
