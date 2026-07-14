<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { usePlanStore } from '@/stores/plan'
import { useActivityStore } from '@/stores/activity'
import type { ActivitySubmitResponse, QuizQuestion } from '@/types'
import { ElMessage, ElMessageBox } from 'element-plus'
import confetti from 'canvas-confetti'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import { useSoundEffect } from '@/composables/useSoundEffect'
import { useTheme } from '@/composables/useTheme'
import { useProfileStore } from '@/stores/profile'
import { useLearningTracker } from '@/composables/useLearningTracker'

const props = defineProps<{
  questions: QuizQuestion[]
  resourceIdx: number
  activityId: string
  teleportBar?: boolean
}>()

const emit = defineEmits<{
  complete: [result: ActivitySubmitResponse]
  backToPath: []
}>()

const planStore = usePlanStore()
const actStore = useActivityStore()
const profileStore = useProfileStore()

// 学习心跳追踪
const { isAway: isLearningAway, resumeTracking } = useLearningTracker({
  courseId: profileStore.activeCourseId,
})

// ========== Core State ==========
const quizAnswers = ref<Record<string, string>>({})

let questionIdCounter = 0
const safeQuestions = computed(() =>
  props.questions.map((q, i) => ({ ...q, questionId: String(q.questionId ?? q.id ?? `q_${i}`) }))
)
function resetQuestionIdCounter() { questionIdCounter = 0 }
const quizCurrentQ = ref(0)
const quizState = ref<'loading' | 'answering' | 'submitting' | 'result' | 'review'>('loading')
const quizResult = ref<ActivitySubmitResponse | null>(null)
const reviewCurrentQ = ref(0)
const slideDirection = ref<'left' | 'right'>('left')
const isTransitioning = ref(false)
const entrancePhase = ref<'entering' | 'entered'>('entered')

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
const { theme } = useTheme()

// ========== Reduced Motion ==========
const prefersReducedMotion = ref(false)

// ========== Computed ==========
const sessionKey = computed(() => `quiz_${props.activityId}_${props.resourceIdx}`)

const formattedTime = computed(() => {
  const min = Math.floor(elapsedTime.value / 60)
  const sec = elapsedTime.value % 60
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
})

const avgTimePerQ = computed(() => {
  if (quizAnsweredCount.value === 0) return 0
  return Math.round(elapsedTime.value / quizAnsweredCount.value)
})

const quizAllAnswered = computed(() =>
  safeQuestions.value.every((q) =>
    q.type === 'SHORT_ANSWER' || quizAnswers.value[q.questionId] != null
  )
)
const quizAnsweredCount = computed(() => Object.keys(quizAnswers.value).length)
const progressPercent = computed(() =>
  safeQuestions.value.length ? Math.round((quizAnsweredCount.value / safeQuestions.value.length) * 100) : 0
)

const resultLabel = computed(() => {
  const score = quizResult.value?.score ?? 0
  if (score >= 0.9) return '优秀！'
  if (score >= 0.7) return '达标 ✓'
  if (score >= 0.35) return '还差一点'
  return '建议回顾'
})

const passed = computed(() => (quizResult.value?.score ?? 0) >= 0.7)
const scorePercent = computed(() => Math.round((quizResult.value?.score ?? 0) * 100))

const starRating = computed(() => {
  const score = quizResult.value?.score ?? 0
  if (score >= 0.9) return 3
  if (score >= 0.7) return 2
  if (score >= 0.5) return 1
  return 0
})

const currentQuestion = computed(() => safeQuestions.value[quizCurrentQ.value])
const reviewQuestion = computed(() => safeQuestions.value[reviewCurrentQ.value])

function getOptionDelay(index: number): string {
  return prefersReducedMotion.value ? '0ms' : `${60 + index * 50}ms`
}

const difficultyConfig: Record<number, { label: string; color: string; bgColor: string }> = {
  1: { label: '基础', color: 'var(--lt-success)', bgColor: 'rgba(52, 199, 89, 0.12)' },
  2: { label: '简单', color: '#34C759', bgColor: 'rgba(52, 199, 89, 0.08)' },
  3: { label: '中等', color: 'var(--lt-warning)', bgColor: 'rgba(255, 159, 10, 0.12)' },
  4: { label: '困难', color: 'var(--lt-orange)', bgColor: 'rgba(255, 140, 66, 0.12)' },
  5: { label: '挑战', color: 'var(--lt-danger)', bgColor: 'rgba(255, 59, 48, 0.12)' },
}

function getDifficultyConfig(difficulty: number) {
  return difficultyConfig[difficulty] || difficultyConfig[3]
}

function typeLabel(type: string): string {
  switch (type) {
    case 'SINGLE_CHOICE': return '单选题'
    case 'MULTIPLE_CHOICE': return '多选题'
    case 'TRUE_FALSE': return '判断题'
    case 'FILL_IN_BLANK': return '填空题'
    case 'SHORT_ANSWER': return '简答题'
    default: return type
  }
}

// ========== Animated Score Ring ==========
const animatedScore = ref(0)
const scoreAnimationProgress = ref(0)
let scoreAnimFrameId: number | null = null

const scoreRingStyle = computed(() => {
  const score = quizResult.value?.score ?? 0
  const color = score >= 0.7 ? 'var(--lt-success)' : score >= 0.35 ? 'var(--lt-orange)' : 'var(--lt-danger)'
  const degrees = Math.round(scoreAnimationProgress.value * score * 360)
  return {
    background: `conic-gradient(${color} ${degrees}deg, var(--lt-border) ${degrees}deg)`,
  }
})

const scoreColor = computed(() => {
  const score = quizResult.value?.score ?? 0
  if (score >= 0.7) return 'var(--lt-success)'
  if (score >= 0.35) return 'var(--lt-orange)'
  return 'var(--lt-danger)'
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

// ========== Skeleton ==========
const skeletonRows = computed(() =>
  Array.from({ length: 3 + Math.floor(Math.random() * 2) }, (_, i) => ({
    id: i,
    width: 70 + Math.random() * 30 + '%',
  }))
)

// ========== Watchers ==========
watch(quizState, (newState) => {
  if (newState === 'result') {
    animatedScore.value = 0
    scoreAnimationProgress.value = 0
    const target = scorePercent.value
    const startTime = Date.now()
    const duration = prefersReducedMotion.value ? 100 : 1400
    function animate() {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      animatedScore.value = Math.round(eased * target)
      scoreAnimationProgress.value = eased
      if (progress < 1) scoreAnimFrameId = requestAnimationFrame(animate)
    }
    scoreAnimFrameId = requestAnimationFrame(animate)

    if (!prefersReducedMotion.value) {
      if (scorePercent.value >= 90) {
        sound.playCelebration()
        nextTick(() => fireConfetti())
      } else if (scorePercent.value >= 70) {
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

onMounted(() => {
  entrancePhase.value = 'entered'
  restoreAnswers()
  quizState.value = safeQuestions.value.length > 0 ? 'answering' : 'loading'
  quizCurrentQ.value = 0
  quizResult.value = null
  elapsedTime.value = 0
  markedQuestions.value.clear()
  startTimer()
})

watch(() => props.questions, (q) => {
  if (safeQuestions.value.length > 0 && quizState.value === 'loading') {
    quizState.value = 'answering'
  }
}, { immediate: true })

// ========== Keyboard Shortcuts ==========
function handleKeydown(e: KeyboardEvent) {
  if (quizState.value !== 'answering' && quizState.value !== 'review') return

  if (quizState.value === 'answering') {
    if (e.key >= '1' && e.key <= '4') {
      const optIndex = parseInt(e.key) - 1
      const q = safeQuestions.value[quizCurrentQ.value]
      if (q?.options?.[optIndex]) {
        e.preventDefault()
        selectAnswer(q.questionId, String.fromCharCode(65 + optIndex))
      }
    }
    if (e.key === 'ArrowLeft' && quizCurrentQ.value > 0) {
      e.preventDefault()
      goToQuestion(quizCurrentQ.value - 1)
    }
    if (e.key === 'ArrowRight' && quizCurrentQ.value < safeQuestions.value.length - 1) {
      e.preventDefault()
      goToQuestion(quizCurrentQ.value + 1)
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'm' || e.key === 'M') {
      e.preventDefault()
      toggleMark(quizCurrentQ.value)
    }
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault()
      fullWidth.value = !fullWidth.value
    }
  }

  if (quizState.value === 'review') {
    if (e.key === 'ArrowLeft' && reviewCurrentQ.value > 0) {
      e.preventDefault()
      reviewCurrentQ.value--
    }
    if (e.key === 'ArrowRight' && reviewCurrentQ.value < safeQuestions.value.length - 1) {
      e.preventDefault()
      reviewCurrentQ.value++
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  prefersReducedMotion.value = mq.matches
  mq.addEventListener('change', (ev) => { prefersReducedMotion.value = ev.matches })
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  stopTimer()
  if (scoreAnimFrameId !== null) cancelAnimationFrame(scoreAnimFrameId)
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer)
  if (submitAbortController) submitAbortController.abort()
  confetti.reset()
})

// ========== Answer Persistence ==========
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null

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

// ========== Answer Selection ==========
function toggleMultipleChoice(questionId: string, letter: string) {
  const current = quizAnswers.value[questionId] || ''
  if (current.includes(letter)) {
    const next = current.replace(letter, '').split('').sort().join('')
    if (next) quizAnswers.value[questionId] = next
    else delete quizAnswers.value[questionId]
  } else {
    quizAnswers.value[questionId] = (current + letter).split('').sort().join('')
  }
  saveAnswers()
}

function selectAnswer(questionId: string, answer: string) {
  const q = safeQuestions.value[quizCurrentQ.value]
  if (!q) return

  if (q.type === 'MULTIPLE_CHOICE') {
    toggleMultipleChoice(questionId, answer)
    sound.playSelect()
    return
  }

  quizAnswers.value[questionId] = answer
  saveAnswers()
  sound.playSelect()

  if (q.type !== 'FILL_IN_BLANK' && q.type !== 'SHORT_ANSWER') {
    if (quizCurrentQ.value < safeQuestions.value.length - 1) {
      const totalOptLen = q.options?.reduce((sum, o) => sum + o.length, 0) || 0
      const delay = prefersReducedMotion.value ? 100 : (totalOptLen > 120 ? 380 : totalOptLen > 60 ? 300 : 200)
      setTimeout(() => goToQuestion(quizCurrentQ.value + 1), delay)
    }
  }
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

function goToQuestion(index: number) {
  if (index === quizCurrentQ.value || isTransitioning.value) return
  slideDirection.value = index > quizCurrentQ.value ? 'left' : 'right'
  isTransitioning.value = true
  quizCurrentQ.value = index
  setTimeout(() => { isTransitioning.value = false }, 300)
}

// ========== Submit ==========
let submitAbortController: AbortController | null = null

async function handleSubmit() {
  if (!quizAllAnswered.value && quizAnsweredCount.value < safeQuestions.value.length) {
    const hasShortAnswer = safeQuestions.value.some(q => q.type === 'SHORT_ANSWER' && !quizAnswers.value[q.questionId])
    if (!hasShortAnswer) {
      const confirmed = await ElMessageBox.confirm(
        `还有 ${safeQuestions.value.length - quizAnsweredCount.value} 题未作答，确定提交？`,
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
  reviewCurrentQ.value = 0
}

// ========== Answer Check ==========
function getQuestionResult(q: QuizQuestion): string | undefined {
  return quizResult.value?.questionResults?.find(
    r => r.questionId === (q.questionId || q.id?.toString())
  )?.result
}

function isAnswerCorrect(q: QuizQuestion): boolean {
  return getQuestionResult(q) === 'correct'
}

function isAnswerPartial(q: QuizQuestion): boolean {
  return getQuestionResult(q) === 'partial'
}

function correctCount(): number {
  return safeQuestions.value.filter(q => isAnswerCorrect(q)).length
}

function correctRatio(): number {
  return safeQuestions.value.length > 0 ? correctCount() / safeQuestions.value.length : 0
}

function reviewOptionClass(q: QuizQuestion, opt: string, oi: number): Record<string, boolean> {
  const letter = String.fromCharCode(65 + Number(oi))
  const correctLetter = q.answer.trim().toUpperCase()
  const userLetter = (quizAnswers.value[q.questionId] || '').trim().toUpperCase()
  return {
    'is-correct-answer': letter === correctLetter,
    'is-wrong-choice': letter === userLetter && letter !== correctLetter,
  }
}

function reviewOptionLetterStyle(q: QuizQuestion, opt: string, oi: number) {
  const letter = String.fromCharCode(65 + Number(oi))
  const correctLetter = q.answer.trim().toUpperCase()
  if (letter === correctLetter) {
    return { borderColor: 'var(--lt-success)', background: 'rgba(52,199,89,0.12)', color: 'var(--lt-success)' }
  }
  return {}
}

function reviewDotStyle(q: QuizQuestion, qi: number) {
  if (qi === reviewCurrentQ.value) {
    return { borderColor: 'var(--lt-brand)' }
  }
  return {}
}
</script>

<template>
  <div class="quiz-fullscreen-root">
    <!-- Background decoration -->
    <div class="quiz-bg-layer" aria-hidden="true">
      <div class="quiz-bg-orb quiz-bg-orb-1"></div>
      <div class="quiz-bg-orb quiz-bg-orb-2"></div>
      <div class="quiz-bg-orb quiz-bg-orb-3"></div>
    </div>

    <Teleport to="#quiz-progress-outlet" :disabled="!props.teleportBar">
      <!-- ===== Progress Track ===== -->
      <div v-if="quizState === 'answering'" class="quiz-progress-track" role="progressbar" :aria-valuenow="progressPercent" aria-valuemin="0" aria-valuemax="100">
        <div class="quiz-progress-track-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>

      <!-- ===== Progress Zone (dots + counters + timer) ===== -->
      <div v-if="quizState === 'answering' || quizState === 'review'" class="quiz-progress-zone">
        <div class="quiz-progress-zone-inner">
          <span class="quiz-progress-zone-label">
            <template v-if="quizState === 'review'">错题回顾</template>
            <template v-else>答题进度</template>
          </span>
          <div class="quiz-progress-bar" role="tablist" :aria-label="'共' + safeQuestions.length + '题'">
            <button
              v-for="(q, qi) in safeQuestions"
              :key="qi"
              class="quiz-progress-dot"
              :class="{
                'is-current': quizState === 'review' ? qi === reviewCurrentQ : qi === quizCurrentQ,
                'is-answered': quizAnswers[q.questionId],
                'is-marked': markedQuestions.has(qi),
                'is-correct': quizState === 'review' && isAnswerCorrect(q),
                'is-partial': quizState === 'review' && isAnswerPartial(q),
                'is-wrong': quizState === 'review' && !isAnswerCorrect(q) && !isAnswerPartial(q) && quizAnswers[q.questionId],
              }"
              :aria-label="'第' + (qi + 1) + '题' + (quizAnswers[q.questionId] ? '，已作答' : '，未作答')"
              :aria-selected="quizState === 'review' ? qi === reviewCurrentQ : qi === quizCurrentQ"
              role="tab"
              @click="quizState === 'review' ? reviewCurrentQ = qi : goToQuestion(qi)"
            >
              <span v-if="quizState === 'review'">{{ isAnswerCorrect(q) ? '✓' : isAnswerPartial(q) ? '~' : quizAnswers[q.questionId] ? '✗' : (qi + 1) }}</span>
              <span v-else-if="markedQuestions.has(qi)" class="mark-icon">⚑</span>
              <span v-else>{{ qi + 1 }}</span>
            </button>
          </div>
          <span class="quiz-progress-zone-count">
            <template v-if="quizState === 'review'">
              {{ correctCount() }}/{{ safeQuestions.length }} 正确
            </template>
            <template v-else>
              {{ quizAnsweredCount }}/{{ safeQuestions.length }} 已答
            </template>
          </span>
          <div v-if="quizState === 'answering'" class="quiz-timer" aria-live="polite">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="quiz-timer-icon">
              <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.2"/>
              <path d="M7 4v3.5l2.5 1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
            <span class="quiz-timer-text">{{ formattedTime }}</span>
          </div>
          <button
            class="quiz-fullwidth-toggle"
            :title="fullWidth ? '显示侧栏' : '隐藏侧栏'"
            @click="fullWidth = !fullWidth"
            aria-label="切换全宽模式"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <template v-if="fullWidth">
                <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
                <path d="M6 6v4M10 6v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </template>
              <template v-else>
                <rect x="2" y="3" width="5" height="10" rx="1" stroke="currentColor" stroke-width="1.3"/>
                <rect x="9" y="3" width="5" height="10" rx="1" stroke="currentColor" stroke-width="1.3"/>
              </template>
            </svg>
          </button>
        </div>
      </div>
    </Teleport>

      <!-- ===== Main Content ===== -->
      <main class="quiz-main">
        <!-- LOADING -->
        <template v-if="quizState === 'loading'">
          <div class="quiz-skeleton">
            <div class="quiz-skeleton-card">
              <div class="quiz-skeleton-line quiz-skeleton-line--short"></div>
              <div class="quiz-skeleton-line quiz-skeleton-line--long"></div>
              <div class="quiz-skeleton-line quiz-skeleton-line--medium"></div>
              <div class="quiz-skeleton-block-group">
                <div v-for="i in 4" :key="i" class="quiz-skeleton-block"></div>
              </div>
            </div>
          </div>
        </template>

        <!-- EMPTY -->
        <template v-else-if="safeQuestions.length === 0">
          <div class="quiz-empty">
            <div class="quiz-empty-icon">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <rect x="8" y="12" width="48" height="40" rx="6" stroke="var(--lt-border)" stroke-width="2" fill="var(--lt-bg-card)"/>
                <circle cx="32" cy="32" r="8" stroke="var(--lt-text-placeholder)" stroke-width="2" stroke-dasharray="4 4"/>
                <path d="M29 31l3 3 5-5" stroke="var(--lt-text-placeholder)" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <p class="quiz-empty-text">暂无题目</p>
            <p class="quiz-empty-hint">请先完成学习内容再尝试</p>
            <button class="quiz-empty-btn" @click="emit('complete', {} as any)">
              继续学习
            </button>
          </div>
        </template>

        <!-- ANSWERING -->
        <template v-else-if="quizState === 'answering'">
          <div class="quiz-content-layout" :class="{ 'is-fullwidth': fullWidth }">
            <div class="quiz-content-left">
              <Transition :name="slideDirection === 'left' ? 'slide-left' : 'slide-right'" mode="out-in">
                <div v-if="currentQuestion" :key="quizCurrentQ" class="quiz-question-section">
                  <!-- Question Header -->
                  <div class="quiz-question-header">
                    <div class="quiz-question-title-row">
                      <span class="quiz-question-num" aria-hidden="true">{{ String(quizCurrentQ + 1).padStart(2, '0') }}</span>
                      <span class="quiz-difficulty-badge" :style="{
                        color: getDifficultyConfig(currentQuestion.difficulty).color,
                        backgroundColor: getDifficultyConfig(currentQuestion.difficulty).bgColor,
                      }">
                        {{ getDifficultyConfig(currentQuestion.difficulty).label }}
                      </span>
                      <span class="quiz-question-type-tag">
                        {{ typeLabel(currentQuestion.type) }}
                      </span>
                    </div>
                    <button
                      class="quiz-mark-btn"
                      :class="{ 'is-marked': markedQuestions.has(quizCurrentQ) }"
                      @click="toggleMark(quizCurrentQ)"
                      :aria-label="markedQuestions.has(quizCurrentQ) ? '取消标记' : '标记此题'"
                      :title="markedQuestions.has(quizCurrentQ) ? '取消标记' : '标记此题'"
                    >
                      <span :class="{ 'is-marked': markedQuestions.has(quizCurrentQ) }" style="font-size:22px;line-height:1;">⚑</span>
                    </button>
                  </div>

                  <!-- Question Text -->
                  <div class="quiz-question-text">
                    <MarkdownViewer :content="currentQuestion.content" :show-toc="false" />
                  </div>

                  <!-- Options: Single Choice / True-False -->
                  <div v-if="currentQuestion.options && currentQuestion.type !== 'MULTIPLE_CHOICE'" class="quiz-options">
                    <div
                      v-for="(opt, oi) in currentQuestion.options"
                      :key="oi"
                      class="quiz-option"
                      :class="{ 'is-selected': quizAnswers[currentQuestion.questionId] === opt.charAt(0) }"
                      :style="{ animationDelay: getOptionDelay(oi) }"
                      role="radio"
                      :aria-checked="quizAnswers[currentQuestion.questionId] === opt.charAt(0)"
                      :tabindex="oi === 0 ? 0 : -1"
                      @click="selectAnswer(currentQuestion.questionId, opt.charAt(0))"
                    >
                      <span class="quiz-option-letter" :class="{ 'is-checked': quizAnswers[currentQuestion.questionId] === opt.charAt(0) }">
                        <span v-if="quizAnswers[currentQuestion.questionId] === opt.charAt(0)" class="quiz-option-check">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M3 7l3 3 5-5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
                          </svg>
                        </span>
                        <span v-else>{{ String.fromCharCode(65 + Number(oi)) }}</span>
                      </span>
                      <span class="quiz-option-text"><MarkdownViewer :content="opt.replace(/^[A-Z][.、]\s*/, '')" :show-toc="false" /></span>
                      <span v-if="quizAnswers[currentQuestion.questionId] === opt.charAt(0)" class="quiz-option-ring"></span>
                    </div>
                  </div>

                  <!-- Options: Multiple Choice -->
                  <div v-if="currentQuestion.options && currentQuestion.type === 'MULTIPLE_CHOICE'" class="quiz-options quiz-options--multi">
                    <div class="quiz-multi-hint">可多选，请选择所有正确答案</div>
                    <div
                      v-for="(opt, oi) in currentQuestion.options"
                      :key="oi"
                      class="quiz-option quiz-option--multi"
                      :class="{ 'is-selected': quizAnswers[currentQuestion.questionId]?.includes(opt.charAt(0)) }"
                      :style="{ animationDelay: getOptionDelay(oi) }"
                      role="checkbox"
                      :aria-checked="quizAnswers[currentQuestion.questionId]?.includes(opt.charAt(0)) || false"
                      :tabindex="oi === 0 ? 0 : -1"
                      @click="selectAnswer(currentQuestion.questionId, opt.charAt(0))"
                    >
                      <span class="quiz-option-letter quiz-option-letter--multi" :class="{ 'is-checked': quizAnswers[currentQuestion.questionId]?.includes(opt.charAt(0)) }">
                        <span v-if="quizAnswers[currentQuestion.questionId]?.includes(opt.charAt(0))" class="quiz-option-check">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M3 7l3 3 5-5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
                          </svg>
                        </span>
                        <span v-else>{{ String.fromCharCode(65 + Number(oi)) }}</span>
                      </span>
                      <span class="quiz-option-text"><MarkdownViewer :content="opt.replace(/^[A-Z][.、]\s*/, '')" :show-toc="false" /></span>
                    </div>
                  </div>

                  <!-- Fill in the Blank -->
                  <div v-if="currentQuestion.type === 'FILL_IN_BLANK'" class="quiz-fill-blank">
                    <label class="quiz-fill-label" for="quiz-fill-input">请输入答案：</label>
                    <el-input
                      id="quiz-fill-input"
                      :model-value="quizAnswers[currentQuestion.questionId] || ''"
                      @update:model-value="val => { quizAnswers[currentQuestion.questionId] = val; saveAnswers() }"
                      placeholder="输入你的答案..."
                      class="quiz-fill-input"
                      clearable
                      @keydown.enter="handleSubmit"
                    />
                  </div>

                  <!-- Short Answer -->
                  <div v-if="currentQuestion.type === 'SHORT_ANSWER'" class="quiz-short-answer">
                    <label class="quiz-fill-label" for="quiz-short-input">请写出你的解答思路：</label>
                    <el-input
                      id="quiz-short-input"
                      :model-value="quizAnswers[currentQuestion.questionId] || ''"
                      @update:model-value="val => { quizAnswers[currentQuestion.questionId] = val; saveAnswers() }"
                      type="textarea"
                      :rows="6"
                      maxlength="2000"
                      show-word-limit
                      placeholder="写出你的解答过程..."
                      class="quiz-short-input"
                    />
                    <div class="quiz-short-hint">简答题提交后将由 AI 进行评估</div>
                  </div>

                  <!-- Keyboard Hint -->
                  <div class="quiz-keyboard-hint">
                    <span class="quiz-keyboard-hint-label">快捷键</span>
                    <template v-if="currentQuestion.type !== 'FILL_IN_BLANK' && currentQuestion.type !== 'SHORT_ANSWER'">
                      <span class="kbd-group">
                        <kbd tabindex="-1">1</kbd>-<kbd tabindex="-1">4</kbd>
                        <span class="kbd-label">选择</span>
                      </span>
                      <span class="kbd-divider" aria-hidden="true">|</span>
                    </template>
                    <span class="kbd-group">
                      <kbd tabindex="-1">←</kbd><kbd tabindex="-1">→</kbd>
                      <span class="kbd-label">切换</span>
                    </span>
                    <span class="kbd-divider" aria-hidden="true">|</span>
                    <span class="kbd-group">
                      <kbd tabindex="-1">M</kbd>
                      <span class="kbd-label">标记</span>
                    </span>
                    <span class="kbd-divider" aria-hidden="true">|</span>
                    <span class="kbd-group">
                      <kbd tabindex="-1">F</kbd>
                      <span class="kbd-label">全宽</span>
                    </span>
                    <span class="kbd-divider" aria-hidden="true">|</span>
                    <span class="kbd-group">
                      <kbd tabindex="-1">⌘</kbd>+<kbd tabindex="-1">↵</kbd>
                      <span class="kbd-label">提交</span>
                    </span>
                  </div>
                </div>
              </Transition>
            </div>

            <!-- Right Sidebar -->
            <aside class="quiz-content-right" aria-label="题目信息">
              <div v-if="currentQuestion?.tags?.knowledge?.length" class="quiz-info-card glass-effect">
                <h4 class="quiz-info-title">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="quiz-info-icon">
                    <circle cx="5" cy="5" r="4.5" stroke="var(--lt-brand)" stroke-width="1.2"/>
                    <path d="M8 8l5 5" stroke="var(--lt-brand)" stroke-width="1.2" stroke-linecap="round"/>
                  </svg>
                  相关知识点
                </h4>
                <div class="quiz-knowledge-tags">
                  <span
                    v-for="tag in currentQuestion.tags.knowledge"
                    :key="tag"
                    class="quiz-knowledge-tag"
                  >{{ tag }}</span>
                </div>
              </div>

              <div class="quiz-info-card glass-effect">
                <h4 class="quiz-info-title">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="quiz-info-icon">
                    <circle cx="7" cy="7" r="6" stroke="var(--lt-text-auxiliary)" stroke-width="1.2"/>
                    <path d="M7 4v4l3 1.5" stroke="var(--lt-text-auxiliary)" stroke-width="1.2" stroke-linecap="round"/>
                  </svg>
                  题目信息
                </h4>
                <div class="quiz-info-list">
                  <div class="quiz-info-item">
                    <span class="quiz-info-label">难度</span>
                    <span class="quiz-info-value" :style="{ color: getDifficultyConfig(currentQuestion?.difficulty || 3).color }">
                      {{ getDifficultyConfig(currentQuestion?.difficulty || 3).label }}
                    </span>
                  </div>
                  <div class="quiz-info-item">
                    <span class="quiz-info-label">题型</span>
                    <span class="quiz-info-value">{{ typeLabel(currentQuestion?.type || 'SINGLE_CHOICE') }}</span>
                  </div>
                  <div class="quiz-info-item">
                    <span class="quiz-info-label">状态</span>
                    <span class="quiz-info-value" :class="{ 'is-answered': currentQuestion && quizAnswers[currentQuestion.questionId] }">
                      <template v-if="currentQuestion?.type === 'MULTIPLE_CHOICE' && currentQuestion && quizAnswers[currentQuestion.questionId]">
                        已选 {{ (quizAnswers[currentQuestion.questionId] || '').length }} 项
                      </template>
                      <template v-else>
                        {{ currentQuestion && quizAnswers[currentQuestion.questionId] ? '已作答' : '未作答' }}
                      </template>
                    </span>
                  </div>
                  <div class="quiz-info-item">
                    <span class="quiz-info-label">标记</span>
                    <span class="quiz-info-value" :class="{ 'is-marked': markedQuestions.has(quizCurrentQ) }">
                      {{ markedQuestions.has(quizCurrentQ) ? '已标记' : '-' }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="quiz-info-card glass-effect">
                <h4 class="quiz-info-title">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="quiz-info-icon">
                    <circle cx="7" cy="7" r="6" stroke="var(--lt-brand)" stroke-width="1.2" fill="var(--lt-brand)" fill-opacity="0.12"/>
                    <path d="M7 4v4l2 1.5" stroke="var(--lt-brand)" stroke-width="1.3" stroke-linecap="round"/>
                  </svg>
                  答题统计
                </h4>
                <div class="quiz-info-list">
                  <div class="quiz-info-item">
                    <span class="quiz-info-label">已答</span>
                    <span class="quiz-info-value" style="font-weight:700;color:var(--lt-brand);">{{ quizAnsweredCount }} / {{ safeQuestions.length }}</span>
                  </div>
                  <div class="quiz-info-item">
                    <span class="quiz-info-label">用时</span>
                    <span class="quiz-info-value">{{ formattedTime }}</span>
                  </div>
                  <div class="quiz-info-item">
                    <span class="quiz-info-label">平均</span>
                    <span class="quiz-info-value">{{ avgTimePerQ }}s/题</span>
                  </div>
                </div>
              </div>

              <div v-if="markedQuestions.size > 0" class="quiz-info-card glass-effect">
                <h4 class="quiz-info-title">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="quiz-info-icon">
                    <path d="M3 1v12l4-3 4 3V1z" stroke="var(--lt-orange)" stroke-width="1.2" fill="var(--lt-orange)" fill-opacity="0.15"/>
                  </svg>
                  标记的题目 ({{ markedQuestions.size }})
                </h4>
                <div class="quiz-marked-list">
                  <button
                    v-for="qi in Array.from(markedQuestions).sort((a, b) => a - b)"
                    :key="qi"
                    class="quiz-marked-item"
                    :class="{ 'is-current': qi === quizCurrentQ }"
                    @click="goToQuestion(qi)"
                  >
                    第 {{ qi + 1 }} 题
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </template>

        <!-- SUBMITTING -->
        <template v-else-if="quizState === 'submitting'">
          <div class="quiz-submitting">
            <div class="quiz-submitting-spinner" aria-hidden="true">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="20" stroke="var(--lt-border)" stroke-width="3"/>
                <circle cx="24" cy="24" r="20" stroke="var(--lt-brand)" stroke-width="3" stroke-dasharray="126" stroke-dashoffset="80" stroke-linecap="round" class="quiz-spinner-circle"/>
              </svg>
            </div>
            <p class="quiz-submitting-text">正在提交答案...</p>
            <p class="quiz-submitting-hint">请稍候，正在评估学习成果</p>
          </div>
        </template>

        <!-- RESULT -->
        <template v-else-if="quizState === 'result' && quizResult">
          <div class="quiz-result">
            <!-- Result Hero -->
            <div class="quiz-result-hero">
              <div class="quiz-score-ring-wrapper">
                <div class="quiz-score-ring" :style="scoreRingStyle">
                  <div class="quiz-score-inner">
                    <span class="quiz-score-text" aria-live="polite">{{ animatedScore }}%</span>
                  </div>
                </div>
              </div>

              <div class="quiz-result-meta">
                <div class="quiz-stars">
                  <span
                    v-for="i in 3"
                    :key="i"
                    class="quiz-star"
                    :class="{ 'active': i <= starRating }"
                    :style="{ animationDelay: `${i * 0.15}s` }"
                    aria-hidden="true"
                  >★</span>
                </div>
                <h2 class="quiz-result-label">{{ resultLabel }}</h2>
                <p class="quiz-result-subtitle">
                  {{ passed ? '恭喜你通过了本次测验！' : '继续加油，再来一次吧！' }}
                </p>
                <div v-if="scorePercent >= 90" class="quiz-congrats-badge quiz-congrats-badge--gold">
                  <span>🏆</span> 卓越表现
                </div>
                <div v-else-if="scorePercent >= 70" class="quiz-congrats-badge quiz-congrats-badge--pass">
                  <span>🎉</span> 达标过关
                </div>
                <div v-else-if="scorePercent >= 35" class="quiz-congrats-badge quiz-congrats-badge--encourage">
                  <span>💪</span> 继续加油
                </div>
                <div v-else class="quiz-congrats-badge quiz-congrats-badge--review">
                  <span>📖</span> 建议回顾知识点
                </div>
              </div>
            </div>

            <!-- Stats -->
            <div class="quiz-result-stats">
              <div class="quiz-stat-item">
                <span class="quiz-stat-value">{{ correctCount() }}/{{ safeQuestions.length }}</span>
                <span class="quiz-stat-label">正确</span>
              </div>
              <div class="quiz-stat-divider" aria-hidden="true"></div>
              <div class="quiz-stat-item">
                <span class="quiz-stat-value">{{ formattedTime }}</span>
                <span class="quiz-stat-label">用时</span>
              </div>
              <div class="quiz-stat-divider" aria-hidden="true"></div>
              <div class="quiz-stat-item">
                <span class="quiz-stat-value">{{ avgTimePerQ }}s</span>
                <span class="quiz-stat-label">平均每题</span>
              </div>
              <div class="quiz-stat-divider" aria-hidden="true"></div>
              <div class="quiz-stat-item">
                <span class="quiz-stat-value" :style="{ color: scoreColor }">{{ correctRatio() >= 0.7 ? '达标' : correctRatio() >= 0.35 ? '待提升' : '需复习' }}</span>
                <span class="quiz-stat-label">评级</span>
              </div>
            </div>

            <!-- Weak Tags -->
            <div v-if="quizResult.weakTags?.length" class="quiz-weak-section">
              <h4 class="quiz-weak-title">需要加强的知识点</h4>
              <div class="quiz-weak-tags">
                <span
                  v-for="tag in quizResult.weakTags"
                  :key="tag"
                  class="quiz-weak-tag"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="quiz-weak-tag-icon">
                    <circle cx="6" cy="6" r="5" stroke="var(--lt-orange)" stroke-width="1.2"/>
                    <path d="M6 4v2M6 8v.01" stroke="var(--lt-orange)" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                  {{ tag }}
                </span>
              </div>
            </div>

            <!-- Actions -->
            <div class="quiz-result-actions">
              <button class="quiz-action-btn quiz-action-btn--secondary" @click="handleReview">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.3"/>
                  <path d="M8 5v3.5l2.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                </svg>
                查看错题解析
              </button>
              <button
                v-if="!passed"
                class="quiz-action-btn quiz-action-btn--ghost"
                @click="handleRetry"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 8a6 6 0 0111.3-3M14 8a6 6 0 01-11.3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                  <path d="M14 2v4h-4M2 14v-4h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                </svg>
                重新作答
              </button>
              <button
                class="quiz-action-btn"
                :class="passed ? 'quiz-action-btn--primary' : 'quiz-action-btn--primary'"
                @click="emit('complete', quizResult!)"
              >
                {{ passed ? '继续学习' : '跳过继续' }}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>
        </template>

        <!-- REVIEW -->
        <template v-else-if="quizState === 'review'">
          <div class="quiz-content-layout" :class="{ 'is-fullwidth': fullWidth }">
            <div class="quiz-content-left">
              <div v-if="reviewQuestion" class="quiz-question-section">
                <div class="quiz-question-header">
                  <div class="quiz-question-title-row">
                    <span class="quiz-question-num" aria-hidden="true">{{ String(reviewCurrentQ + 1).padStart(2, '0') }}</span>
                    <span class="quiz-difficulty-badge" :style="{
                      color: getDifficultyConfig(reviewQuestion.difficulty).color,
                      backgroundColor: getDifficultyConfig(reviewQuestion.difficulty).bgColor,
                    }">
                      {{ getDifficultyConfig(reviewQuestion.difficulty).label }}
                    </span>
                    <span
                      class="quiz-review-status"
                      :class="isAnswerCorrect(reviewQuestion) ? 'correct' : isAnswerPartial(reviewQuestion) ? 'partial' : 'wrong'"
                    >
                      {{ isAnswerCorrect(reviewQuestion) ? '✓ 回答正确' : isAnswerPartial(reviewQuestion) ? '~ 部分正确' : '✗ 回答错误' }}
                    </span>
                  </div>
                </div>

                <div class="quiz-question-text">{{ reviewQuestion.content }}</div>

                  <!-- Options review: Choice types -->
                  <div v-if="reviewQuestion.options && reviewQuestion.type !== 'MULTIPLE_CHOICE'" class="quiz-options quiz-options--review">
                    <div
                      v-for="(opt, oi) in reviewQuestion.options"
                      :key="oi"
                      class="quiz-option"
                      :class="reviewOptionClass(reviewQuestion, opt, oi)"
                    >
                      <span class="quiz-option-letter" :style="reviewOptionLetterStyle(reviewQuestion, opt, oi)">
                        {{ String.fromCharCode(65 + Number(oi)) }}
                        <span v-if="reviewOptionClass(reviewQuestion, opt, oi)['is-correct-answer']" class="quiz-option-check">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                          </svg>
                        </span>
                      </span>
                      <span class="quiz-option-text"><MarkdownViewer :content="opt.replace(/^[A-Z][.、]\s*/, '')" :show-toc="false" /></span>
                    </div>
                  </div>

                  <!-- Options review: Multiple Choice -->
                  <div v-if="reviewQuestion.options && reviewQuestion.type === 'MULTIPLE_CHOICE'" class="quiz-options quiz-options--review">
                    <div
                      v-for="(opt, oi) in reviewQuestion.options"
                      :key="oi"
                      class="quiz-option"
                      :class="reviewOptionClass(reviewQuestion, opt, oi)"
                    >
                      <span class="quiz-option-letter quiz-option-letter--multi" :style="reviewOptionLetterStyle(reviewQuestion, opt, oi)">
                        {{ String.fromCharCode(65 + Number(oi)) }}
                        <span v-if="reviewOptionClass(reviewQuestion, opt, oi)['is-correct-answer']" class="quiz-option-check">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                          </svg>
                        </span>
                      </span>
                      <span class="quiz-option-text"><MarkdownViewer :content="opt.replace(/^[A-Z][.、]\s*/, '')" :show-toc="false" /></span>
                    </div>
                  </div>

                  <!-- Answer display for Fill-in / Short Answer -->
                  <div v-if="reviewQuestion.type === 'FILL_IN_BLANK' || reviewQuestion.type === 'SHORT_ANSWER'" class="quiz-review-text-answer">
                    <div class="quiz-review-text-answer-item">
                      <span class="quiz-review-text-answer-label">你的答案：</span>
                      <span class="quiz-review-text-answer-value" :class="{ 'is-correct': reviewQuestion.type === 'FILL_IN_BLANK' && isAnswerCorrect(reviewQuestion), 'is-wrong': reviewQuestion.type === 'FILL_IN_BLANK' && !isAnswerCorrect(reviewQuestion) && quizAnswers[reviewQuestion.questionId] }">
                        {{ quizAnswers[reviewQuestion.questionId] || '（未作答）' }}
                      </span>
                    </div>
                    <div v-if="reviewQuestion.type === 'FILL_IN_BLANK'" class="quiz-review-text-answer-item">
                      <span class="quiz-review-text-answer-label">正确答案：</span>
                      <span class="quiz-review-text-answer-value is-correct-answer">{{ reviewQuestion.answer }}</span>
                    </div>
                    <div v-if="reviewQuestion.type === 'SHORT_ANSWER'" class="quiz-review-text-answer-item">
                      <span class="quiz-review-text-answer-label">状态：</span>
                      <span class="quiz-review-text-answer-value"
                        :class="isAnswerCorrect(reviewQuestion) ? 'is-correct' : isAnswerPartial(reviewQuestion) ? 'is-partial' : 'is-wrong'">
                        {{ isAnswerCorrect(reviewQuestion) ? '正确' : isAnswerPartial(reviewQuestion) ? '部分正确' : '不正确' }}
                      </span>
                    </div>
                  </div>

                  <!-- Analysis -->
                  <div class="quiz-review-analysis">
                  <div class="quiz-review-analysis-header">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6" stroke="var(--lt-brand)" stroke-width="1.3"/>
                      <path d="M8 5v4M8 11v.01" stroke="var(--lt-brand)" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    <span>答案解析</span>
                  </div>
                  <div class="quiz-analysis-correct">
                    正确答案: <strong>{{ reviewQuestion.answer }}</strong>
                  </div>
                  <div v-if="reviewQuestion.analysis" class="quiz-analysis-text">
                    <MarkdownViewer :content="reviewQuestion.analysis" :show-toc="false" />
                  </div>
                  <div v-if="reviewQuestion?.tags?.mistakes?.length" class="quiz-analysis-mistakes">
                    <span class="quiz-analysis-mistakes-label">常见错误：</span>
                    <span
                      v-for="mistake in reviewQuestion.tags.mistakes"
                      :key="mistake"
                      class="quiz-analysis-mistake-tag"
                    >{{ mistake }}</span>
                  </div>
                </div>
              </div>

              <div style="display:flex;justify-content:center;padding-top:16px;">
                <button
                  class="quiz-back-btn"
                  @click="quizState = 'result'"
                >
                  返回结果
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
            </div>

            <aside class="quiz-content-right" aria-label="解析信息">
              <div v-if="reviewQuestion?.tags?.knowledge?.length" class="quiz-info-card glass-effect">
                <h4 class="quiz-info-title">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="quiz-info-icon">
                    <circle cx="5" cy="5" r="4.5" stroke="var(--lt-brand)" stroke-width="1.2"/>
                    <path d="M8 8l5 5" stroke="var(--lt-brand)" stroke-width="1.2" stroke-linecap="round"/>
                  </svg>
                  相关知识点
                </h4>
                <div class="quiz-knowledge-tags">
                  <span
                    v-for="tag in reviewQuestion.tags.knowledge"
                    :key="tag"
                    class="quiz-knowledge-tag"
                  >{{ tag }}</span>
                </div>
              </div>

              <div class="quiz-info-card glass-effect">
                <h4 class="quiz-info-title">正确率</h4>
                <div class="quiz-review-accuracy">
                  <div class="quiz-review-accuracy-bar">
                    <div
                      class="quiz-review-accuracy-fill"
                      :style="{ width: (correctCount() / safeQuestions.length * 100) + '%' }"
                    ></div>
                  </div>
                  <span class="quiz-review-accuracy-text">{{ correctCount() }}/{{ safeQuestions.length }}</span>
                </div>
              </div>
            </aside>
          </div>
        </template>
      </main>

      <!-- ===== FAB Submit ===== -->
      <button
        v-if="quizState === 'answering'"
        class="quiz-fab-submit"
        @click="handleSubmit"
        :class="{ 'is-all-answered': quizAllAnswered }"
        :aria-label="'提交答案，已答' + quizAnsweredCount + '/' + safeQuestions.length"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" class="quiz-fab-icon">
          <path d="M4 10l4 4 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span class="quiz-fab-text">提交</span>
        <span class="quiz-fab-badge">{{ quizAnsweredCount }}/{{ safeQuestions.length }}</span>
      </button>

      <!-- 离开提示遮罩 -->
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
/* ===================================================================
   QuizFocusModal — 顶级 quiz 体验
   设计原则: 弹性微交互 · 品牌渐变视觉 · 即时反馈 · 可及性
   令牌: 仅使用项目现有 CSS 变量 (--lt-*)
   =================================================================== */

/* ==================== Root ==================== */
.quiz-fullscreen-root {
  width: 100%;
  display: flex;
  flex-direction: column;
  background: var(--lt-bg-page);
  --quiz-bg-brand-fade: rgba(43, 111, 255, 0.03);
}

/* Background Orbs */
.quiz-bg-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
}

.quiz-bg-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.4;
}

.quiz-bg-orb-1 {
  width: 400px;
  height: 400px;
  background: var(--lt-brand-lightest);
  top: -120px;
  right: -80px;
  animation: orb-float 20s ease-in-out infinite;
}

.quiz-bg-orb-2 {
  width: 300px;
  height: 300px;
  background: var(--lt-ai-light-9);
  bottom: -60px;
  left: -60px;
  animation: orb-float 25s ease-in-out infinite reverse;
}

.quiz-bg-orb-3 {
  width: 200px;
  height: 200px;
  background: rgba(255, 140, 66, 0.06);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: orb-float 30s ease-in-out infinite;
}

@keyframes orb-float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -20px) scale(1.05); }
  66% { transform: translate(-20px, 15px) scale(0.95); }
}

/* ==================== Timer (in progress zone) ==================== */
.quiz-timer {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: var(--lt-text-secondary);
  padding: 3px 11px;
  border-radius: var(--lt-radius-full);
  background: color-mix(in srgb, var(--lt-bg-page) 80%, transparent);
  border: 1px solid var(--lt-border);
  flex-shrink: 0;
  margin-left: auto;
}

.quiz-timer-icon {
  color: var(--lt-brand);
  animation: timer-pulse 2s ease-in-out infinite;
}

@keyframes timer-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.quiz-timer-text {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--lt-text-primary);
  font-size: 14px;
  letter-spacing: 0.02em;
}



.quiz-progress-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lt-brand);
  animation: badge-dot-pulse 2s ease-in-out infinite;
}

@keyframes badge-dot-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* ==================== Progress Zone ==================== */
.quiz-progress-zone {
  position: relative;
  z-index: 10;
  background: var(--lt-bg-card);
  border-bottom: 1px solid var(--lt-border);
  flex-shrink: 0;
  padding: 10px 28px;
}

.quiz-progress-zone-inner {
  display: flex;
  align-items: center;
  gap: 14px;
}

.quiz-progress-zone-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--lt-text-auxiliary);
  white-space: nowrap;
  flex-shrink: 0;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.quiz-progress-zone-count {
  font-size: 12px;
  font-weight: 700;
  color: var(--lt-brand);
  white-space: nowrap;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  background: color-mix(in srgb, var(--lt-brand) 10%, transparent);
  padding: 3px 12px;
  border-radius: var(--lt-radius-full);
  line-height: 1.4;
}

/* ==================== Progress Track ==================== */
.quiz-progress-track {
  position: relative;
  z-index: 1;
  height: 3px;
  background: color-mix(in srgb, var(--lt-border) 60%, transparent);
  flex-shrink: 0;
  overflow: hidden;
}

.quiz-progress-track-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--lt-brand), var(--lt-ai), var(--lt-brand));
  background-size: 200% 100%;
  border-radius: 0 2px 2px 0;
  transition: width 500ms cubic-bezier(0.22, 1, 0.36, 1);
  animation: progress-shimmer 3s linear infinite;
}

@keyframes progress-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ==================== Main ==================== */
.quiz-main {
  position: relative;
  z-index: 1;
  flex: 1;
  overflow-y: auto;
  padding: 20px 12px;
  padding-bottom: 80px;
}

.quiz-main::-webkit-scrollbar {
  width: 4px;
}

.quiz-main::-webkit-scrollbar-thumb {
  background: var(--lt-border);
  border-radius: 2px;
}

/* ==================== Skeleton ==================== */
.quiz-skeleton {
  max-width: 800px;
  margin: 0 auto;
}

.quiz-skeleton-card {
  background: var(--lt-bg-card);
  border-radius: var(--lt-radius-lg);
  padding: 28px;
  box-shadow: var(--lt-shadow-card);
}

.quiz-skeleton-line {
  height: 14px;
  border-radius: 7px;
  background: linear-gradient(90deg, var(--lt-border) 25%, var(--lt-bg-page) 50%, var(--lt-border) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  margin-bottom: 16px;
}

.quiz-skeleton-line--short { width: 30%; }
.quiz-skeleton-line--long { width: 80%; }
.quiz-skeleton-line--medium { width: 55%; }

.quiz-skeleton-block-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
}

.quiz-skeleton-block {
  height: 48px;
  border-radius: var(--lt-radius-md);
  background: linear-gradient(90deg, var(--lt-border) 25%, var(--lt-bg-page) 50%, var(--lt-border) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.quiz-skeleton-block:nth-child(2) { width: 85%; }
.quiz-skeleton-block:nth-child(3) { width: 70%; }
.quiz-skeleton-block:nth-child(4) { width: 90%; }

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ==================== Empty ==================== */
.quiz-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  text-align: center;
}

.quiz-empty-icon {
  margin-bottom: 8px;
  opacity: 0.5;
}

.quiz-empty-text {
  font-size: 18px;
  font-weight: 600;
  color: var(--lt-text-primary);
  margin: 0;
}

.quiz-empty-hint {
  font-size: 14px;
  color: var(--lt-text-auxiliary);
  margin: 0;
}

.quiz-empty-btn {
  margin-top: 8px;
  padding: 10px 24px;
  border: none;
  border-radius: var(--lt-radius-md);
  background: var(--lt-brand);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--lt-transition-smooth);
  font-family: var(--lt-font-body);
}

.quiz-empty-btn:hover {
  background: var(--lt-brand-dark);
  transform: translateY(-1px);
  box-shadow: var(--lt-shadow-hover);
}

/* ==================== Content Layout ==================== */
.quiz-content-layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 20px;
  max-width: 100%;
  margin: 0 auto;
  min-height: 100%;
  align-items: start;
}

.quiz-content-left {
  min-width: 0;
}

.quiz-content-right {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: sticky;
  top: 0;
}

/* ==================== Question Section ==================== */
.quiz-question-section {
  background: var(--lt-bg-card);
  border-radius: var(--lt-radius-lg);
  padding: 36px 40px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.04);
  position: relative;
  border: 1px solid var(--lt-border);
  transition: box-shadow 0.3s ease;
}

.quiz-question-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 24px;
}

.quiz-question-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.quiz-question-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--lt-brand) 10%, transparent);
  font-size: 14px;
  font-weight: 700;
  color: var(--lt-brand);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.05em;
}

.quiz-difficulty-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--lt-radius-full);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
}

.quiz-question-type-tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--lt-radius-full);
  font-size: 12px;
  font-weight: 500;
  color: var(--lt-text-auxiliary);
  background: var(--lt-bg-page);
  border: 1px solid var(--lt-border);
  line-height: 1.4;
}

.quiz-question-text {
  font-size: 21px;
  font-weight: 500;
  color: var(--lt-text-primary);
  margin-bottom: 28px;
  line-height: 1.7;
  letter-spacing: -0.01em;
}

/* ==================== Feedback Banner ==================== */
/* ==================== Options ==================== */
.quiz-options {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.quiz-option {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 24px;
  border-radius: 12px;
  border: 1.5px solid var(--lt-border);
  cursor: pointer;
  color: var(--lt-text-primary);
  font-size: 17px;
  position: relative;
  overflow: hidden;
  animation: option-enter 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
  background: var(--lt-bg-card);
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  -webkit-tap-highlight-color: transparent;
}

.quiz-option::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0;
  background: linear-gradient(135deg, color-mix(in srgb, var(--lt-brand) 4%, transparent) 0%, transparent 100%);
  transition: opacity 0.3s ease;
  pointer-events: none;
}

@keyframes option-enter {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (hover: hover) {
  .quiz-option:hover {
    border-color: var(--lt-brand-light);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(43, 111, 255, 0.08);
  }

  .quiz-option:hover::before {
    opacity: 1;
  }
}

.quiz-option:active {
  transform: scale(0.98);
  transition: transform 60ms ease-out;
}

.quiz-option.is-selected {
  border-color: var(--lt-brand);
  background: color-mix(in srgb, var(--lt-brand) 6%, var(--lt-bg-card));
  box-shadow: 0 0 0 3px rgba(43, 111, 255, 0.08), 0 4px 20px rgba(43, 111, 255, 0.12);
}

.quiz-option-letter {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  border: 1.5px solid var(--lt-border);
  flex-shrink: 0;
  color: var(--lt-text-secondary);
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  position: relative;
  z-index: 1;
}

.quiz-option.is-selected .quiz-option-letter {
  border-color: var(--lt-brand);
  background: linear-gradient(135deg, var(--lt-brand), var(--lt-brand-dark));
  color: #fff;
  transform: scale(1.08);
  box-shadow: 0 2px 8px rgba(43, 111, 255, 0.3);
}

.quiz-option-check {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: check-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes check-pop {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.quiz-option-text {
  flex: 1;
  line-height: 1.5;
  position: relative;
  z-index: 1;
}

.quiz-option-ring {
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  border: 2px solid var(--lt-brand);
  opacity: 0;
  animation: ring-expand 0.5s ease-out forwards;
  pointer-events: none;
}

@keyframes ring-expand {
  from { opacity: 0.5; transform: scale(1); }
  to { opacity: 0; transform: scale(1.04); }
}

/* Review options */
.quiz-option.is-correct-answer {
  border-color: var(--lt-success);
  background: color-mix(in srgb, var(--lt-success) 12%, transparent);
}

.quiz-option.is-wrong-choice {
  border-color: var(--lt-danger);
  background: color-mix(in srgb, var(--lt-danger) 12%, transparent);
  animation: shake 0.4s ease-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(3px); }
}

/* ==================== Keyboard Hint ==================== */
.quiz-keyboard-hint {
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid var(--lt-border);
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.quiz-keyboard-hint-label {
  font-weight: 600;
  color: var(--lt-text-auxiliary);
  margin-right: 4px;
}

.kbd-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.kbd-label {
  margin-left: 3px;
  font-size: 11px;
  color: var(--lt-text-placeholder);
}

.kbd-divider {
  color: var(--lt-border);
  margin: 0 4px;
}

.quiz-keyboard-hint kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 20px;
  padding: 0 5px;
  font-size: 11px;
  font-family: var(--lt-font-mono);
  background: var(--lt-bg-page);
  border: 1px solid var(--lt-border);
  border-radius: 4px;
  box-shadow: 0 1px 0 var(--lt-border);
  color: var(--lt-text-secondary);
  line-height: 1;
}

/* ==================== Mark Button ==================== */
.quiz-mark-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  line-height: 1;
  color: var(--lt-text-disabled);
  transition: all var(--lt-transition-bounce);
  flex-shrink: 0;
  border-radius: var(--lt-radius-sm);
}

@media (hover: hover) {
  .quiz-mark-btn:hover {
    color: var(--lt-orange);
    background: rgba(255, 140, 66, 0.08);
  }
}

.quiz-mark-btn.is-marked {
  color: var(--lt-orange);
}

/* ==================== Info Cards ==================== */
.quiz-info-card {
  background: var(--lt-bg-card);
  border-radius: var(--lt-radius-lg);
  padding: 18px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.03);
  border: 1px solid var(--lt-border);
  transition: box-shadow 0.3s ease, transform 0.3s ease;
}

@media (hover: hover) {
  .quiz-info-card:hover {
    box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 6px 24px rgba(0,0,0,0.04);
    transform: translateY(-1px);
  }
}

.quiz-info-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--lt-text-primary);
  margin: 0 0 14px 0;
}

.quiz-info-icon {
  flex-shrink: 0;
}

.quiz-knowledge-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quiz-knowledge-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  background: var(--lt-brand-lightest);
  border-radius: var(--lt-radius-full);
  font-size: 13px;
  color: var(--lt-brand);
  font-weight: 500;
  border: 1px solid transparent;
  transition: all var(--lt-transition-smooth);
}

@media (hover: hover) {
  .quiz-knowledge-tag:hover {
    border-color: var(--lt-brand-lighter);
    transform: translateY(-1px);
  }
}

.quiz-info-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quiz-info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.quiz-info-label {
  font-size: 13px;
  color: var(--lt-text-auxiliary);
}

.quiz-info-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--lt-text-secondary);
}

.quiz-info-value.is-answered {
  color: var(--lt-success);
}

.quiz-info-value.is-marked {
  color: var(--lt-orange);
}

.quiz-marked-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quiz-marked-item {
  padding: 5px 12px;
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-md);
  background: var(--lt-bg-card);
  font-size: 12px;
  color: var(--lt-text-secondary);
  cursor: pointer;
  transition: all var(--lt-transition-smooth);
  font-family: var(--lt-font-body);
}

@media (hover: hover) {
  .quiz-marked-item:hover {
    border-color: var(--lt-brand-lighter);
    color: var(--lt-brand);
    background: var(--lt-brand-lightest);
  }
}

.quiz-marked-item.is-current {
  border-color: var(--lt-brand);
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
  font-weight: 600;
}

/* ==================== Submitting ==================== */
.quiz-submitting {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  text-align: center;
}

.quiz-submitting-spinner {
  margin-bottom: 4px;
}

.quiz-spinner-circle {
  animation: spinner-rotate 1.2s linear infinite;
  transform-origin: center;
}

@keyframes spinner-rotate {
  to { transform: rotate(360deg); }
}

.quiz-submitting-text {
  font-size: 18px;
  font-weight: 600;
  color: var(--lt-text-primary);
  margin: 0;
}

.quiz-submitting-hint {
  font-size: 14px;
  color: var(--lt-text-auxiliary);
  margin: 0;
}

/* ==================== Result ==================== */
.quiz-result {
  text-align: center;
  padding: 32px 24px 24px;
  position: relative;
  max-width: 640px;
  margin: 0 auto;
  width: 100%;
  animation: result-enter 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes result-enter {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Result Hero */
.quiz-result-hero {
  position: relative;
  z-index: 1;
  margin-bottom: 24px;
}

.quiz-score-ring-wrapper {
  margin-bottom: 16px;
  display: inline-block;
}

.quiz-score-ring {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.3s ease;
}

.quiz-score-inner {
  width: 116px;
  height: 116px;
  border-radius: 50%;
  background: var(--lt-bg-card);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.04);
}

.quiz-score-text {
  font-size: 34px;
  font-weight: 800;
  color: var(--lt-text-primary);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.quiz-result-meta {
  position: relative;
  z-index: 1;
}

.quiz-stars {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 12px;
}

.quiz-star {
  font-size: 40px;
  color: var(--lt-border);
  opacity: 0;
  transform: scale(0);
  animation: star-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.quiz-star.active {
  color: #FFD700;
  text-shadow: 0 0 16px rgba(255, 215, 0, 0.4);
}

@keyframes star-pop {
  from { opacity: 0; transform: scale(0) rotate(-30deg); }
  to { opacity: 1; transform: scale(1) rotate(0deg); }
}

.quiz-result-label {
  font-size: 24px;
  font-weight: 800;
  color: var(--lt-text-primary);
  margin: 0 0 6px 0;
}

.quiz-result-subtitle {
  font-size: 14px;
  color: var(--lt-text-auxiliary);
  margin: 0;
}

/* Result Stats */
.quiz-result-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  margin-bottom: 28px;
  padding: 24px 0;
  background: var(--lt-bg-card);
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.04);
  border: 1px solid var(--lt-border);
  position: relative;
  z-index: 1;
}

.quiz-stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.quiz-stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--lt-text-primary);
  font-variant-numeric: tabular-nums;
}

.quiz-stat-label {
  font-size: 13px;
  color: var(--lt-text-auxiliary);
  font-weight: 500;
}

.quiz-stat-divider {
  width: 1px;
  height: 36px;
  background: var(--lt-border);
  flex-shrink: 0;
}

/* Weak Tags */
.quiz-weak-section {
  margin-bottom: 32px;
  position: relative;
  z-index: 1;
}

.quiz-weak-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--lt-text-secondary);
  margin: 0 0 12px 0;
}

.quiz-weak-tags {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

.quiz-weak-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  padding: 6px 16px;
  border-radius: var(--lt-radius-full);
  background: var(--lt-orange-light-9);
  color: var(--lt-orange-text);
  font-weight: 500;
  border: 1px solid rgba(255, 140, 66, 0.15);
}

.quiz-weak-tag-icon {
  flex-shrink: 0;
}

/* Result Actions */
.quiz-result-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  position: relative;
  z-index: 1;
  flex-wrap: wrap;
}

.quiz-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: var(--lt-radius-md);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--lt-transition-smooth);
  font-family: var(--lt-font-body);
  border: none;
  outline: none;
}

.quiz-action-btn:focus-visible {
  box-shadow: 0 0 0 3px var(--lt-brand-lighter);
}

.quiz-action-btn--primary {
  background: var(--lt-brand);
  color: #fff;
  box-shadow: 0 2px 8px rgba(43, 111, 255, 0.25);
}

@media (hover: hover) {
  .quiz-action-btn--primary:hover {
    background: var(--lt-brand-dark);
    transform: translateY(-1px);
    box-shadow: var(--lt-shadow-elevated);
  }
}

.quiz-action-btn--secondary {
  background: var(--lt-bg-card);
  color: var(--lt-text-secondary);
  border: 1px solid var(--lt-border);
}

@media (hover: hover) {
  .quiz-action-btn--secondary:hover {
    border-color: var(--lt-brand-lighter);
    color: var(--lt-brand);
    background: var(--lt-brand-lightest);
  }
}

.quiz-action-btn--ghost {
  background: transparent;
  color: var(--lt-text-auxiliary);
}

@media (hover: hover) {
  .quiz-action-btn--ghost:hover {
    color: var(--lt-text-secondary);
    background: var(--lt-bg-page);
  }
}

/* ==================== Review Analysis ==================== */
.quiz-review-analysis {
  margin-top: 24px;
  padding: 20px;
  background: var(--lt-bg-page);
  border-radius: var(--lt-radius-lg);
  border: 1px solid var(--lt-border);
}

.quiz-review-analysis-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--lt-text-primary);
  margin-bottom: 14px;
}

.quiz-analysis-correct {
  font-size: 15px;
  color: var(--lt-success);
  font-weight: 600;
  margin-bottom: 12px;
}

.quiz-analysis-text {
  font-size: 14px;
  color: var(--lt-text-secondary);
  line-height: 1.7;
  margin: 0 0 12px 0;
}

.quiz-analysis-mistakes {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding-top: 12px;
  border-top: 1px dashed var(--lt-border);
}

.quiz-analysis-mistakes-label {
  font-size: 13px;
  color: var(--lt-text-auxiliary);
  font-weight: 500;
}

.quiz-analysis-mistake-tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  background: color-mix(in srgb, var(--lt-danger) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--lt-danger) 20%, transparent);
  border-radius: var(--lt-radius-full);
  font-size: 12px;
  color: var(--lt-danger);
  font-weight: 500;
}

/* Review Accuracy */
.quiz-review-accuracy {
  display: flex;
  align-items: center;
  gap: 12px;
}

.quiz-review-accuracy-bar {
  flex: 1;
  height: 8px;
  background: var(--lt-border);
  border-radius: 4px;
  overflow: hidden;
}

.quiz-review-accuracy-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--lt-brand), var(--lt-ai));
  border-radius: 4px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.quiz-review-accuracy-text {
  font-size: 14px;
  font-weight: 700;
  color: var(--lt-text-primary);
  flex-shrink: 0;
}

/* ==================== Footer ==================== */
.quiz-footer {
  position: relative;
  z-index: 1;
  background: var(--lt-bg-card);
  border-top: 1px solid var(--lt-border);
  padding: 8px 28px;
  flex-shrink: 0;
}

.quiz-progress-bar {
  display: flex;
  gap: 6px;
  justify-content: center;
  flex: 1;
  overflow-x: auto;
  padding: 2px 0;
  scrollbar-width: none;
}

.quiz-progress-bar::-webkit-scrollbar {
  display: none;
}

.quiz-progress-dot {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  cursor: pointer;
  border: 2px solid var(--lt-border);
  color: var(--lt-text-auxiliary);
  font-weight: 500;
  background: var(--lt-bg-card);
  transition: all 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
  font-family: var(--lt-font-body);
  padding: 0;
  position: relative;
  z-index: 1;
}

.quiz-progress-dot::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.3s ease;
}

@media (hover: hover) {
  .quiz-progress-dot:hover {
    transform: scale(1.12);
    border-color: var(--lt-brand-lighter);
    color: var(--lt-brand);
  }
}

.quiz-progress-dot.is-current {
  font-weight: 700;
  color: var(--lt-brand);
  border-color: var(--lt-brand);
  box-shadow: 0 0 0 4px rgba(43, 111, 255, 0.1);
  animation: dot-glow 2s ease-in-out infinite;
  background: color-mix(in srgb, var(--lt-brand) 6%, var(--lt-bg-card));
}

.quiz-progress-dot.is-answered {
  color: #fff;
  background: var(--lt-brand);
  border-color: var(--lt-brand);
  box-shadow: 0 2px 8px rgba(43, 111, 255, 0.3);
  animation: dot-fill 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.quiz-progress-dot.is-answered.is-current {
  box-shadow: 0 0 0 4px rgba(43, 111, 255, 0.15), 0 2px 8px rgba(43, 111, 255, 0.3);
}

@keyframes dot-glow {
  0%, 100% { box-shadow: 0 0 0 4px rgba(43, 111, 255, 0.12); }
  50% { box-shadow: 0 0 0 7px rgba(43, 111, 255, 0.06); }
}

@keyframes dot-fill {
  from { transform: scale(0.6); opacity: 0; }
  50% { transform: scale(1.25); }
  to { transform: scale(1); opacity: 1; }
}

.quiz-progress-dot.is-correct {
  background: var(--lt-success) !important;
  border-color: var(--lt-success) !important;
  color: #fff !important;
}

.quiz-progress-dot.is-partial {
  background: var(--lt-warning) !important;
  border-color: var(--lt-warning) !important;
  color: #fff !important;
}

.quiz-progress-dot.is-wrong {
  background: var(--lt-danger) !important;
  border-color: var(--lt-danger) !important;
  color: #fff !important;
}

/* ==================== FAB Submit Button ==================== */
.quiz-fab-submit {
  position: fixed;
  bottom: 72px;
  right: 24px;
  z-index: 65;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 14px 24px 14px 22px;
  border: none;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--lt-brand), color-mix(in srgb, var(--lt-brand) 80%, var(--lt-ai)));
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  font-family: var(--lt-font-body);
  box-shadow: 0 4px 20px rgba(43, 111, 255, 0.3), 0 1px 3px rgba(43, 111, 255, 0.15);
  opacity: 0.85;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

@media (hover: hover) {
  .quiz-fab-submit:hover {
    opacity: 1;
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 8px 30px rgba(43, 111, 255, 0.4), 0 2px 6px rgba(43, 111, 255, 0.2);
  }
}

.quiz-fab-submit:active {
  transform: scale(0.96);
  transition: transform 60ms ease-out;
}

.quiz-fab-submit.is-all-answered {
  opacity: 1;
  animation: fab-pulse 2s ease-in-out infinite;
}

@keyframes fab-pulse {
  0%, 100% { box-shadow: 0 4px 20px rgba(43, 111, 255, 0.3); }
  50% { box-shadow: 0 4px 28px rgba(43, 111, 255, 0.5); }
}

.quiz-fab-icon {
  flex-shrink: 0;
}

.quiz-fab-text {
  flex-shrink: 0;
}

.quiz-fab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: var(--lt-radius-full);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
  flex-shrink: 0;
}

/* Back Button (review state) */
.quiz-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  border: none;
  border-radius: var(--lt-radius-md);
  background: var(--lt-bg-card);
  color: var(--lt-text-secondary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--lt-transition-smooth);
  font-family: var(--lt-font-body);
  border: 1px solid var(--lt-border);
  flex-shrink: 0;
}

@media (hover: hover) {
  .quiz-back-btn:hover {
    border-color: var(--lt-brand-lighter);
    color: var(--lt-brand);
    background: var(--lt-brand-lightest);
  }
}

/* ==================== Transitions ==================== */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-left-enter-from { opacity: 0; transform: translateX(24px); }
.slide-left-leave-to { opacity: 0; transform: translateX(-24px); }
.slide-right-enter-from { opacity: 0; transform: translateX(-24px); }
.slide-right-leave-to { opacity: 0; transform: translateX(24px); }

/* ==================== Reduced Motion ==================== */
@media (prefers-reduced-motion: reduce) {
  .slide-left-enter-active,
  .slide-left-leave-active,
  .slide-right-enter-active,
  .slide-right-leave-active {
    transition: none;
  }

  .quiz-option { animation: none; }
  .quiz-star { animation: none; opacity: 1; }

  .quiz-progress-dot.is-current {
    animation: none;
    box-shadow: 0 0 0 4px rgba(43, 111, 255, 0.1);
  }

  .quiz-bg-orb { animation: none; }
  .quiz-skeleton-line,
  .quiz-skeleton-block { animation: none; background: var(--lt-border); }

  .quiz-progress-track-fill { transition: none; }
}

/* ==================== Responsive ==================== */
@media (max-width: 1023px) {
  .quiz-content-layout {
    grid-template-columns: 1fr;
  }

  .quiz-content-right {
    display: none;
  }

  .quiz-keyboard-hint {
    display: none;
  }

  .quiz-main {
    padding: 16px;
    padding-bottom: 72px;
  }

  .quiz-progress-zone {
    padding: 8px 20px;
  }
}

@media (max-width: 767px) {
  .quiz-timer-text {
    font-size: 14px;
  }

  .quiz-main {
    padding: 12px;
    padding-bottom: 64px;
  }

  .quiz-progress-zone {
    padding: 6px 16px;
  }

  .quiz-progress-zone-label {
    display: none;
  }

  .quiz-progress-zone-count {
    font-size: 11px;
  }

  .quiz-question-section {
    padding: 16px;
  }

  .quiz-question-text {
    font-size: 16px;
  }

  .quiz-option {
    padding: 14px 16px;
    font-size: 15px;
  }

  .quiz-option-letter {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }

  .quiz-result {
    padding: 32px 16px 24px;
  }

  .quiz-score-ring {
    width: 120px;
    height: 120px;
  }

  .quiz-score-inner {
    width: 100px;
    height: 100px;
  }

  .quiz-score-text {
    font-size: 28px;
  }

  .quiz-star {
    font-size: 32px;
  }

  .quiz-result-stats {
    padding: 16px 12px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .quiz-stat-divider {
    display: none;
  }

  .quiz-stat-item {
    min-width: 60px;
  }

  .quiz-stat-value {
    font-size: 18px;
  }

  .quiz-progress-dot {
    width: 30px;
    height: 30px;
    font-size: 11px;
  }

  .quiz-fab-submit {
    bottom: 64px;
    right: 16px;
    padding: 10px 16px;
    font-size: 13px;
  }

  .quiz-fab-badge {
    display: none;
  }

  .quiz-result-actions {
    flex-direction: column;
    gap: 10px;
  }

  .quiz-action-btn {
    width: 100%;
    justify-content: center;
  }

  .quiz-nav-row {
    flex-wrap: wrap;
    justify-content: center;
  }
}



/* ==================== Full-width Toggle ==================== */
.quiz-fullwidth-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-md);
  background: transparent;
  cursor: pointer;
  color: var(--lt-text-auxiliary);
  transition: all var(--lt-transition-smooth);
  flex-shrink: 0;
}
@media (hover: hover) {
  .quiz-fullwidth-toggle:hover {
    border-color: var(--lt-brand-lighter);
    color: var(--lt-brand);
    background: color-mix(in srgb, var(--lt-brand) 6%, transparent);
  }
}
.quiz-content-layout.is-fullwidth {
  grid-template-columns: 1fr;
}
.quiz-content-layout.is-fullwidth .quiz-content-right {
  display: none;
}

/* ==================== Multiple Choice ==================== */
.quiz-multi-hint {
  font-size: 13px;
  color: var(--lt-text-auxiliary);
  margin-bottom: 8px;
  font-weight: 500;
}
.quiz-option-letter--multi {
  border-radius: 6px;
  width: 32px;
  height: 32px;
  font-size: 13px;
  border-width: 2px;
  transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}
.quiz-option--multi.is-selected .quiz-option-letter--multi {
  border-color: var(--lt-brand);
  background: color-mix(in srgb, var(--lt-brand) 10%, transparent);
  color: var(--lt-brand);
  transform: scale(1);
  box-shadow: none;
}
.quiz-option--multi.is-selected .quiz-option-letter--multi .quiz-option-check {
  display: flex;
  animation: check-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.quiz-option--multi.is-selected .quiz-option-letter--multi .quiz-option-check svg path {
  stroke: var(--lt-brand);
}

/* ==================== Fill in the Blank ==================== */
.quiz-fill-blank {
  margin-top: 8px;
}
.quiz-fill-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--lt-text-secondary);
  margin-bottom: 10px;
}
.quiz-fill-input {
  width: 100%;
}
.quiz-fill-input :deep(.el-input__wrapper) {
  border-radius: 12px;
  border: 1.5px solid var(--lt-border);
  box-shadow: none;
  padding: 0;
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  background: var(--lt-bg-card);
}
.quiz-fill-input :deep(.el-input__wrapper:hover) {
  border-color: var(--lt-brand-lighter);
}
.quiz-fill-input :deep(.el-input__wrapper.is-focus) {
  border-color: var(--lt-brand);
  box-shadow: 0 0 0 3px rgba(43, 111, 255, 0.08), 0 4px 16px rgba(43, 111, 255, 0.08);
}
.quiz-fill-input :deep(.el-input__inner) {
  font-size: 16px;
  padding: 10px 14px;
  height: 44px;
  border: none;
  background: transparent;
  border-radius: 12px;
}
.quiz-short-answer {
  margin-top: 8px;
}
.quiz-short-input :deep(.el-textarea__inner) {
  font-size: 15px;
  line-height: 1.7;
  padding: 14px;
  min-height: 140px;
  border-radius: 12px;
  border: 1.5px solid var(--lt-border);
  box-shadow: none;
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  background: var(--lt-bg-card);
}
.quiz-short-input :deep(.el-textarea__inner:hover) {
  border-color: var(--lt-brand-lighter);
}
.quiz-short-input :deep(.el-textarea__inner:focus) {
  border-color: var(--lt-brand);
  box-shadow: 0 0 0 3px rgba(43, 111, 255, 0.08), 0 4px 16px rgba(43, 111, 255, 0.08);
}
.quiz-short-hint {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  margin-top: 8px;
  font-style: italic;
}

/* ==================== Review: Text Answer ==================== */
.quiz-review-text-answer {
  margin-top: 20px;
  padding: 16px 20px;
  background: var(--lt-bg-page);
  border-radius: var(--lt-radius-lg);
  border: 1px solid var(--lt-border);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.quiz-review-text-answer-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.quiz-review-text-answer-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--lt-text-auxiliary);
  flex-shrink: 0;
}
.quiz-review-text-answer-value {
  font-size: 15px;
  color: var(--lt-text-primary);
  word-break: break-all;
}
.quiz-review-text-answer-value.is-correct {
  color: var(--lt-success);
}
.quiz-review-text-answer-value.is-partial {
  color: var(--lt-warning);
}
.quiz-review-text-answer-value.is-wrong {
  color: var(--lt-danger);
}
.quiz-review-text-answer-value.is-correct-answer {
  color: var(--lt-success);
  font-weight: 700;
}

/* ==================== Review Status Badge ==================== */
.quiz-review-status {
  font-size: 13px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 20px;
}
.quiz-review-status.correct {
  color: var(--lt-success);
  background: rgba(52, 199, 89, 0.12);
}
.quiz-review-status.partial {
  color: var(--lt-warning);
  background: rgba(255, 159, 10, 0.12);
}
.quiz-review-status.wrong {
  color: var(--lt-danger);
  background: rgba(255, 59, 48, 0.12);
}

/* ==================== Celebration Badges ==================== */
.quiz-congrats-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 6px 18px;
  border-radius: var(--lt-radius-full);
  font-size: 14px;
  font-weight: 700;
  animation: badge-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.quiz-congrats-badge--gold {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 180, 0, 0.1));
  color: #B8860B;
  border: 1px solid rgba(255, 215, 0, 0.3);
}
.quiz-congrats-badge--pass {
  background: color-mix(in srgb, var(--lt-success) 10%, transparent);
  color: var(--lt-success);
  border: 1px solid color-mix(in srgb, var(--lt-success) 20%, transparent);
}
.quiz-congrats-badge--encourage {
  background: color-mix(in srgb, var(--lt-orange) 10%, transparent);
  color: var(--lt-orange);
  border: 1px solid color-mix(in srgb, var(--lt-orange) 20%, transparent);
}
.quiz-congrats-badge--review {
  background: color-mix(in srgb, var(--lt-danger) 8%, transparent);
  color: var(--lt-danger);
  border: 1px solid color-mix(in srgb, var(--lt-danger) 15%, transparent);
}
@keyframes badge-pop {
  from { opacity: 0; transform: scale(0.8) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

/* ==================== Dark mode overrides for QuizFocusModal ==================== */
html[data-theme="dark"] .quiz-fullscreen-root {
  --quiz-bg-brand-fade: rgba(43, 111, 255, 0.06);
}
html[data-theme="dark"] .quiz-bg-orb-1 {
  opacity: 0.25;
}
html[data-theme="dark"] .quiz-bg-orb-2 {
  opacity: 0.2;
}
html[data-theme="dark"] .quiz-bg-orb-3 {
  opacity: 0.15;
}
html[data-theme="dark"] .quiz-fill-input :deep(.el-input__wrapper),
html[data-theme="dark"] .quiz-short-input :deep(.el-textarea__inner) {
  background: var(--lt-bg-page);
  color: var(--lt-text-primary);
}
html[data-theme="dark"] .quiz-fill-input :deep(.el-input__inner) {
  background: transparent;
  color: var(--lt-text-primary);
}
html[data-theme="dark"] .quiz-congrats-badge--gold {
  color: #FFD700;
  background: rgba(255, 215, 0, 0.1);
}

/* 离开提示遮罩 */
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
