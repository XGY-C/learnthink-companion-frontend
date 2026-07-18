<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { PlayerQuestion, PlayerResult, PlayerQuestionFeedback } from '@/types'
import MarkdownViewer from '@/components/MarkdownViewer.vue'

const props = withDefaults(defineProps<{
  questions: PlayerQuestion[]
  answers: Record<string, string>
  currentIndex: number
  phase: 'loading' | 'answering' | 'submitting' | 'result' | 'review'
  result: PlayerResult | null
  timerSeconds: number
  questionFeedback?: Record<string, PlayerQuestionFeedback | null>
  markedQuestions?: Set<number>
  submittedAnswerIds?: Set<string>
  submitMode?: 'instant' | 'batch'
  showSidebar?: boolean
  showKeyboardHints?: boolean
  showTimer?: boolean
  showMarkFeature?: boolean
  showBackground?: boolean
  showFAB?: boolean
  showProgressTrack?: boolean
  showProgressZone?: boolean
  showResultActions?: boolean
  showAskAiFeature?: boolean
  fullWidth?: boolean
  evaluationText?: string
  evaluationLoading?: boolean
  evaluationError?: string
  confettiEnabled?: boolean
  autoAdvanceOnSelect?: boolean
}>(), {
  questionFeedback: () => ({}),
  markedQuestions: () => new Set(),
  submittedAnswerIds: () => new Set(),
  submitMode: 'batch',
  showSidebar: true,
  showKeyboardHints: true,
  showTimer: true,
  showMarkFeature: true,
  showBackground: true,
  showFAB: true,
  showProgressTrack: true,
  showProgressZone: true,
  showResultActions: true,
  showAskAiFeature: true,
  fullWidth: false,
  evaluationText: '',
  evaluationLoading: false,
  evaluationError: '',
  confettiEnabled: true,
  autoAdvanceOnSelect: true,
})

const emit = defineEmits<{
  'update:currentIndex': [index: number]
  'update:fullWidth': [val: boolean]
  'selectAnswer': [questionId: string, answer: string]
  'submit': []
  'retry': []
  'review': []
  'complete': []
  'toggleMark': [index: number]
  'nextQuestion': []
  'askAi': [questionId: string, questionData: { questionId: string; type: string; typeLabel: string; content: string; options: string[]; userAnswer?: string; difficulty: number; difficultyLabel: string; knowledgeTags?: string[] }]
  'triggerEval': []
}>()

// ========== Internal State ==========
const slideDirection = ref<'left' | 'right'>('left')
const isTransitioning = ref(false)
const prefersReducedMotion = ref(false)
const animatedScore = ref(0)
const scoreAnimationProgress = ref(0)
let scoreAnimFrameId: number | null = null

// ========== Computed ==========
const answeredCount = computed(() => {
  if (props.submitMode === 'instant') return props.submittedAnswerIds?.size ?? 0
  return Object.keys(props.answers).length
})
// 简答题同样需要有答案才能提交（与 answeredCount、进度条圆点 is-answered 逻辑保持一致，
// 避免"FAB 显示 4/5 但按钮变绿"的矛盾）
const allAnswered = computed(() =>
  props.questions.every((q) => props.answers[q.id] != null)
)

const progressPercent = computed(() =>
  props.questions.length ? Math.round((answeredCount.value / props.questions.length) * 100) : 0
)

const currentQuestion = computed(() => props.questions[props.currentIndex])
const reviewQuestion = computed(() => props.questions[props.currentIndex])

const formattedTime = computed(() => {
  const min = Math.floor(props.timerSeconds / 60)
  const sec = props.timerSeconds % 60
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
})

const avgTimePerQ = computed(() => {
  if (answeredCount.value === 0) return 0
  return Math.round(props.timerSeconds / answeredCount.value)
})

const resultLabel = computed(() => {
  const score = props.result?.score ?? 0
  if (score >= 0.9) return '优秀！'
  if (score >= 0.7) return '达标 ✓'
  if (score >= 0.35) return '还差一点'
  return '建议回顾'
})

const passed = computed(() => (props.result?.score ?? 0) >= 0.7)
const scorePercent = computed(() => Math.round((props.result?.score ?? 0) * 100))

const starRating = computed(() => {
  const score = props.result?.score ?? 0
  if (score >= 0.9) return 3
  if (score >= 0.6) return 2
  if (score >= 0.4) return 1
  return 0
})

const correctCount = computed(() => {
  if (!props.result) return 0
  return props.result.questionResults.filter(r => r.result === 'correct').length
})

const correctRatio = computed(() =>
  props.questions.length > 0 ? correctCount.value / props.questions.length : 0
)

const scoreColor = computed(() => {
  const score = props.result?.score ?? 0
  if (score >= 0.7) return 'var(--lt-success)'
  if (score >= 0.35) return 'var(--lt-orange)'
  return 'var(--lt-danger)'
})

const scoreRingStyle = computed(() => {
  const score = props.result?.score ?? 0
  const color = score >= 0.7 ? 'var(--lt-success)' : score >= 0.35 ? 'var(--lt-orange)' : 'var(--lt-danger)'
  const degrees = Math.round(scoreAnimationProgress.value * score * 360)
  return { background: `conic-gradient(${color} ${degrees}deg, var(--lt-border) ${degrees}deg)` }
})

// ========== Difficulty / Type helpers ==========
const difficultyConfig: Record<number, { label: string; color: string; bgColor: string }> = {
  1: { label: '基础', color: 'var(--lt-success)', bgColor: 'rgba(52, 199, 89, 0.12)' },
  2: { label: '简单', color: '#34C759', bgColor: 'rgba(52, 199, 89, 0.08)' },
  3: { label: '中等', color: 'var(--lt-warning)', bgColor: 'rgba(255, 159, 10, 0.12)' },
  4: { label: '困难', color: 'var(--lt-orange)', bgColor: 'rgba(255, 140, 66, 0.12)' },
  5: { label: '挑战', color: 'var(--lt-danger)', bgColor: 'rgba(255, 59, 48, 0.12)' },
}

function getDifficultyConfig(d: number) {
  return difficultyConfig[d] || difficultyConfig[3]
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

function getOptionDelay(index: number): string {
  return prefersReducedMotion.value ? '0ms' : `${60 + index * 50}ms`
}

// ========== Question Feedback (instant mode) ==========
function getQuestionFeedback(questionId: string): PlayerQuestionFeedback | null {
  return props.questionFeedback?.[questionId] ?? null
}

function isQuestionSubmitted(questionId: string): boolean {
  return props.submittedAnswerIds?.has(questionId) ?? false
}

function isQuestionCorrect(questionId: string): boolean {
  return getQuestionFeedback(questionId)?.isCorrect ?? false
}

// ========== Review helpers ==========
function getQuestionResult(q: PlayerQuestion): string | undefined {
  return props.result?.questionResults?.find(r => r.questionId === q.id)?.result
}

function isAnswerCorrect(q: PlayerQuestion): boolean {
  return getQuestionResult(q) === 'correct'
}

function isAnswerPartial(q: PlayerQuestion): boolean {
  return getQuestionResult(q) === 'partial'
}

function reviewOptionClass(q: PlayerQuestion, _opt: string, oi: number): Record<string, boolean> {
  const letter = String.fromCharCode(65 + Number(oi))
  const correctLetter = q.answer.trim().toUpperCase()
  const userLetter = (props.answers[q.id] || '').trim().toUpperCase()
  return {
    'is-correct-answer': letter === correctLetter,
    'is-wrong-choice': letter === userLetter && letter !== correctLetter,
  }
}

function reviewOptionLetterStyle(q: PlayerQuestion, _opt: string, oi: number) {
  const letter = String.fromCharCode(65 + Number(oi))
  const correctLetter = q.answer.trim().toUpperCase()
  if (letter === correctLetter) {
    return { borderColor: 'var(--lt-success)', background: 'rgba(52,199,89,0.12)', color: 'var(--lt-success)' }
  }
  return {}
}

// ========== Option rendering helpers ==========
function isOptionSelected(questionId: string, letter: string): boolean {
  const answer = props.answers[questionId] || ''
  return answer.includes(letter)
}

function isSubmittedQuestion(questionId: string): boolean {
  return props.submitMode === 'instant' && isQuestionSubmitted(questionId)
}

function isOptionCorrect(letter: string, questionId: string): boolean {
  const fb = getQuestionFeedback(questionId)
  return fb?.correctAnswer?.includes(letter) ?? false
}

function isOptionWrongSelected(letter: string, questionId: string): boolean {
  const fb = getQuestionFeedback(questionId)
  if (!fb) return false
  return isOptionSelected(questionId, letter) && !fb.isCorrect && fb.correctAnswer !== letter
}

// ========== Navigation ==========
function goToQuestion(index: number) {
  if (index === props.currentIndex || isTransitioning.value) return
  slideDirection.value = index > props.currentIndex ? 'left' : 'right'
  isTransitioning.value = true
  emit('update:currentIndex', index)
  setTimeout(() => { isTransitioning.value = false }, 250)
}

function handleAskAi() {
  const q = currentQuestion.value
  if (!q) return
  emit('askAi', q.id, {
    questionId: q.id,
    type: q.type,
    typeLabel: typeLabel(q.type),
    content: q.content,
    options: q.options || [],
    userAnswer: props.answers[q.id] || undefined,
    difficulty: q.difficulty || 3,
    difficultyLabel: getDifficultyConfig(q.difficulty || 3).label,
    knowledgeTags: q.knowledgeTags,
  })
}

// ========== Select Answer ==========
function handleSelectAnswer(questionId: string, answer: string) {
  const q = props.questions.find(x => x.id === questionId)
  if (!q) return

  if (props.submitMode === 'instant' && isSubmittedQuestion(questionId)) return

  if (q.type === 'MULTIPLE_CHOICE') {
    const current = props.answers[questionId] || ''
    if (current.includes(answer)) {
      const next = current.replace(answer, '').split('').sort().join('')
      emit('selectAnswer', questionId, next)
    } else {
      emit('selectAnswer', questionId, (current + answer).split('').sort().join(''))
    }
  } else {
    emit('selectAnswer', questionId, answer)
  }
}

// ========== Watchers ==========
watch(() => props.currentIndex, (newVal, oldVal) => {
  if (oldVal !== undefined && newVal !== oldVal) {
    slideDirection.value = newVal > oldVal ? 'left' : 'right'
  }
})

watch(() => props.phase, (newState) => {
  if (newState === 'result') {
    startScoreAnimation()
  }
}, { immediate: true })

watch(() => props.result, (r) => {
  if (props.phase === 'result' && r) {
    startScoreAnimation()
  }
})

function startScoreAnimation() {
  if (scoreAnimFrameId !== null) cancelAnimationFrame(scoreAnimFrameId)
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
}

// ========== Keyboard Shortcuts ==========
function handleKeydown(e: KeyboardEvent) {
  if (props.phase !== 'answering' && props.phase !== 'review') return

  if (props.phase === 'answering') {
    if (e.key >= '1' && e.key <= '4') {
      const optIndex = parseInt(e.key) - 1
      const q = props.questions[props.currentIndex]
      if (q?.options?.[optIndex]) {
        e.preventDefault()
        handleSelectAnswer(q.id, String.fromCharCode(65 + optIndex))
      }
    }
    if (e.key === 'ArrowLeft' && props.currentIndex > 0) {
      e.preventDefault()
      goToQuestion(props.currentIndex - 1)
    }
    if (e.key === 'ArrowRight' && props.currentIndex < props.questions.length - 1) {
      e.preventDefault()
      goToQuestion(props.currentIndex + 1)
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (props.submitMode === 'batch') emit('submit')
    }
    if ((e.key === 'm' || e.key === 'M') && props.showMarkFeature) {
      e.preventDefault()
      emit('toggleMark', props.currentIndex)
    }
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault()
      emit('update:fullWidth', !props.fullWidth)
    }
  }

  if (props.phase === 'review') {
    if (e.key === 'ArrowLeft' && props.currentIndex > 0) {
      e.preventDefault()
      emit('update:currentIndex', props.currentIndex - 1)
    }
    if (e.key === 'ArrowRight' && props.currentIndex < props.questions.length - 1) {
      e.preventDefault()
      emit('update:currentIndex', props.currentIndex + 1)
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
  if (scoreAnimFrameId !== null) cancelAnimationFrame(scoreAnimFrameId)
})

// ========== Expose ==========
defineExpose({ goToQuestion })
</script>

<template>
  <div class="quiz-fullscreen-root">
    <!-- Background decoration -->
    <div v-if="showBackground" class="quiz-bg-layer" aria-hidden="true">
      <div class="quiz-bg-orb quiz-bg-orb-1"></div>
      <div class="quiz-bg-orb quiz-bg-orb-2"></div>
      <div class="quiz-bg-orb quiz-bg-orb-3"></div>
    </div>

    <!-- ===== Progress Track ===== -->
    <div v-if="showProgressTrack && phase === 'answering'" class="quiz-progress-track" role="progressbar" :aria-valuenow="progressPercent" aria-valuemin="0" aria-valuemax="100">
      <div class="quiz-progress-track-fill" :style="{ width: progressPercent + '%' }"></div>
    </div>

    <!-- ===== Progress Zone ===== -->
    <div v-if="showProgressZone && (phase === 'answering' || phase === 'review')" class="quiz-progress-zone">
      <div class="quiz-progress-zone-inner">
        <span class="quiz-progress-zone-label">
          <template v-if="phase === 'review'">错题回顾</template>
          <template v-else>答题进度</template>
        </span>
        <div class="quiz-progress-bar" role="tablist" :aria-label="'共' + questions.length + '题'">
          <button
            v-for="(q, qi) in questions"
            :key="qi"
            class="quiz-progress-dot"
            :class="{
              'is-current': qi === currentIndex,
              'is-answered': submitMode === 'batch' ? !!answers[q.id] : isQuestionSubmitted(q.id),
              'is-marked': showMarkFeature && markedQuestions.has(qi),
              'is-correct': phase === 'review' && isAnswerCorrect(q),
              'is-partial': phase === 'review' && isAnswerPartial(q),
              'is-wrong': phase === 'review' && !isAnswerCorrect(q) && !isAnswerPartial(q) && (submitMode === 'batch' ? !!answers[q.id] : isQuestionSubmitted(q.id)),
            }"
            :aria-label="'第' + (qi + 1) + '题' + ((submitMode === 'batch' ? answers[q.id] : isQuestionSubmitted(q.id)) ? '，已作答' : '，未作答')"
            :aria-selected="qi === currentIndex"
            role="tab"
            @click="phase === 'review' ? emit('update:currentIndex', qi) : goToQuestion(qi)"
          >
            <span v-if="phase === 'review'">{{ isAnswerCorrect(q) ? '✓' : isAnswerPartial(q) ? '~' : (submitMode === 'batch' ? answers[q.id] : isQuestionSubmitted(q.id)) ? '✗' : (qi + 1) }}</span>
            <span v-else-if="showMarkFeature && markedQuestions.has(qi)" class="mark-icon">⚑</span>
            <span v-else>{{ qi + 1 }}</span>
          </button>
        </div>
        <span class="quiz-progress-zone-count">
          <template v-if="phase === 'review'">
            {{ correctCount }}/{{ questions.length }} 正确
          </template>
          <template v-else>
            {{ answeredCount }}/{{ questions.length }} 已答
          </template>
        </span>
        <div v-if="showTimer && phase === 'answering'" class="quiz-timer" aria-live="polite">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="quiz-timer-icon">
            <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.2"/>
            <path d="M7 4v3.5l2.5 1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          <span class="quiz-timer-text">{{ formattedTime }}</span>
        </div>
        <button
          class="quiz-fullwidth-toggle"
          :title="fullWidth ? '显示侧栏' : '隐藏侧栏'"
          @click="emit('update:fullWidth', !fullWidth)"
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

    <!-- ===== Main Content ===== -->
    <main class="quiz-main">
      <!-- LOADING -->
      <template v-if="phase === 'loading'">
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
      <template v-else-if="questions.length === 0">
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
          <button class="quiz-empty-btn" @click="emit('complete')">继续学习</button>
        </div>
      </template>

      <!-- ANSWERING -->
      <template v-else-if="phase === 'answering'">
        <div class="quiz-content-layout" :class="{ 'is-fullwidth': fullWidth }">
          <div class="quiz-content-left">
            <Transition :name="slideDirection === 'left' ? 'slide-left' : 'slide-right'" mode="out-in">
              <div v-if="currentQuestion" :key="currentIndex" class="quiz-question-section">
                <!-- Question Header -->
                <div class="quiz-question-header">
                  <div class="quiz-question-title-row">
                    <span class="quiz-question-num" aria-hidden="true">{{ String(currentIndex + 1).padStart(2, '0') }}</span>
                    <span class="quiz-difficulty-badge" :style="{
                      color: getDifficultyConfig(currentQuestion.difficulty).color,
                      backgroundColor: getDifficultyConfig(currentQuestion.difficulty).bgColor,
                    }">
                      {{ getDifficultyConfig(currentQuestion.difficulty).label }}
                    </span>
                    <span class="quiz-question-type-tag">
                      {{ typeLabel(currentQuestion.type) }}
                    </span>
                    <span v-if="currentQuestion.kpName" class="quiz-kp-tag">{{ currentQuestion.kpName }}</span>
                  </div>
                  <div class="quiz-header-actions">
                    <button
                      v-if="showAskAiFeature"
                      class="quiz-ask-ai-btn"
                      @click.stop="handleAskAi"
                      title="向 AI 提问此题"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 2a8 8 0 0 0-8 8c0 2.5 1.2 4.8 3 6.3V22l3.5-2.3c.5.2 1 .3 1.5.3a8 8 0 1 0 0-16z"/>
                        <path d="M8 9h.01M12 9h.01M16 9h.01"/>
                      </svg>
                      <span class="quiz-ask-ai-label">问AI</span>
                    </button>
                    <button
                      v-if="showMarkFeature"
                      class="quiz-mark-btn"
                      :class="{ 'is-marked': markedQuestions.has(currentIndex) }"
                      @click="emit('toggleMark', currentIndex)"
                      :aria-label="markedQuestions.has(currentIndex) ? '取消标记' : '标记此题'"
                      :title="markedQuestions.has(currentIndex) ? '取消标记' : '标记此题'"
                    >
                      <span :class="{ 'is-marked': markedQuestions.has(currentIndex) }" style="font-size:22px;line-height:1;">⚑</span>
                    </button>
                  </div>
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
                    :class="{
                      'is-selected': isOptionSelected(currentQuestion.id, opt.charAt(0)),
                      'is-correct-answer': submitMode === 'instant' && isSubmittedQuestion(currentQuestion.id) && isOptionCorrect(opt.charAt(0), currentQuestion.id),
                      'is-wrong-choice': submitMode === 'instant' && isSubmittedQuestion(currentQuestion.id) && isOptionWrongSelected(opt.charAt(0), currentQuestion.id),
                    }"
                    :style="{ animationDelay: getOptionDelay(oi) }"
                    role="radio"
                    :aria-checked="isOptionSelected(currentQuestion.id, opt.charAt(0))"
                    :tabindex="oi === 0 ? 0 : -1"
                    @click="handleSelectAnswer(currentQuestion.id, opt.charAt(0))"
                  >
                    <span class="quiz-option-letter" :class="{ 'is-checked': isOptionSelected(currentQuestion.id, opt.charAt(0)) }">
                      <span v-if="isOptionSelected(currentQuestion.id, opt.charAt(0))" class="quiz-option-check">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M3 7l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                      </span>
                      <span v-else>{{ String.fromCharCode(65 + Number(oi)) }}</span>
                    </span>
                    <span class="quiz-option-text"><MarkdownViewer :content="opt.replace(/^[A-Z][.、]\s*/, '')" :show-toc="false" /></span>
                    <span v-if="isOptionSelected(currentQuestion.id, opt.charAt(0))" class="quiz-option-ring"></span>
                  </div>
                </div>

                <!-- Options: Multiple Choice -->
                <div v-if="currentQuestion.options && currentQuestion.type === 'MULTIPLE_CHOICE'" class="quiz-options quiz-options--multi">
                  <div class="quiz-multi-hint">可多选，请选择所有正确答案</div>
                  <div
                    v-for="(opt, oi) in currentQuestion.options"
                    :key="oi"
                    class="quiz-option quiz-option--multi"
                    :class="{
                      'is-selected': isOptionSelected(currentQuestion.id, opt.charAt(0)),
                      'is-correct-answer': submitMode === 'instant' && isSubmittedQuestion(currentQuestion.id) && isOptionCorrect(opt.charAt(0), currentQuestion.id),
                      'is-wrong-choice': submitMode === 'instant' && isSubmittedQuestion(currentQuestion.id) && isOptionWrongSelected(opt.charAt(0), currentQuestion.id),
                    }"
                    :style="{ animationDelay: getOptionDelay(oi) }"
                    role="checkbox"
                    :aria-checked="isOptionSelected(currentQuestion.id, opt.charAt(0))"
                    :tabindex="oi === 0 ? 0 : -1"
                    @click="handleSelectAnswer(currentQuestion.id, opt.charAt(0))"
                  >
                    <span class="quiz-option-letter quiz-option-letter--multi" :class="{ 'is-checked': isOptionSelected(currentQuestion.id, opt.charAt(0)) }">
                      <span v-if="isOptionSelected(currentQuestion.id, opt.charAt(0))" class="quiz-option-check">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M3 7l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
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
                  <input
                    id="quiz-fill-input"
                    :value="answers[currentQuestion.id] || ''"
                    @input="emit('selectAnswer', currentQuestion.id, ($event.target as HTMLInputElement).value)"
                    placeholder="输入你的答案..."
                    class="quiz-fill-text-input"
                    :disabled="submitMode === 'instant' && isSubmittedQuestion(currentQuestion.id)"
                  />
                </div>

                <!-- Short Answer -->
                <div v-if="currentQuestion.type === 'SHORT_ANSWER'" class="quiz-short-answer">
                  <label class="quiz-fill-label" for="quiz-short-input">请写出你的解答思路：</label>
                  <textarea
                    id="quiz-short-input"
                    :value="answers[currentQuestion.id] || ''"
                    @input="emit('selectAnswer', currentQuestion.id, ($event.target as HTMLTextAreaElement).value)"
                    rows="6"
                    maxlength="2000"
                    placeholder="写出你的解答过程..."
                    class="quiz-short-textarea"
                    :disabled="submitMode === 'instant' && isSubmittedQuestion(currentQuestion.id)"
                  ></textarea>
                  <div class="quiz-short-hint">简答题提交后将由 AI 进行评估</div>
                </div>

                <!-- Keyboard Hint -->
                <div v-if="showKeyboardHints" class="quiz-keyboard-hint">
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
                  <template v-if="submitMode === 'batch'">
                    <span class="kbd-divider" aria-hidden="true">|</span>
                    <span class="kbd-group">
                      <kbd tabindex="-1">⌘</kbd>+<kbd tabindex="-1">↵</kbd>
                      <span class="kbd-label">提交</span>
                    </span>
                  </template>
                </div>

                <!-- Instant feedback (per-question mode) -->
                <div v-if="submitMode === 'instant' && isSubmittedQuestion(currentQuestion.id) && getQuestionFeedback(currentQuestion.id)" class="quiz-instant-feedback" :class="isQuestionCorrect(currentQuestion.id) ? 'quiz-instant-feedback--correct' : 'quiz-instant-feedback--wrong'">
                  <div class="quiz-instant-feedback__result">
                    <svg v-if="isQuestionCorrect(currentQuestion.id)" width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="9" stroke="var(--lt-success)" stroke-width="1.5" fill="rgba(52,199,89,0.12)"/>
                      <path d="M6 10l3 3 5-5" stroke="var(--lt-success)" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <svg v-else width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="9" stroke="var(--lt-danger)" stroke-width="1.5" fill="rgba(255,59,48,0.12)"/>
                      <path d="M7 7l6 6M13 7l-6 6" stroke="var(--lt-danger)" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <span>{{ isQuestionCorrect(currentQuestion.id) ? '回答正确' : '回答错误' }}</span>
                  </div>
                  <div v-if="getQuestionFeedback(currentQuestion.id)?.explanation" class="quiz-instant-feedback__explanation">
                    <div class="quiz-instant-feedback__explanation-title">解析</div>
                    <MarkdownViewer :content="getQuestionFeedback(currentQuestion.id)!.explanation" :show-toc="false" />
                  </div>
                  <div v-if="!isQuestionCorrect(currentQuestion.id)" class="quiz-instant-feedback__answer">
                    正确答案：<strong>{{ formatCorrectAnswer(getQuestionFeedback(currentQuestion.id)?.correctAnswer ?? '') }}</strong>
                  </div>
                </div>

                <!-- Next/Complete buttons (instant mode) -->
                <div v-if="submitMode === 'instant' && isSubmittedQuestion(currentQuestion.id)" class="quiz-question-actions-bottom">
                  <button v-if="currentIndex < questions.length - 1" class="quiz-next-btn" @click="emit('nextQuestion')">
                    下一题
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                  </button>
                  <button v-else class="quiz-next-btn quiz-next-btn--primary" @click="emit('submit')">
                    完成练习
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M4 8l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Right Sidebar -->
          <aside v-if="showSidebar && !fullWidth" class="quiz-content-right" aria-label="题目信息">
            <div v-if="currentQuestion?.knowledgeTags?.length" class="quiz-info-card glass-effect">
              <h4 class="quiz-info-title">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="quiz-info-icon">
                  <circle cx="5" cy="5" r="4.5" stroke="var(--lt-brand)" stroke-width="1.2"/>
                  <path d="M8 8l5 5" stroke="var(--lt-brand)" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
                相关知识点
              </h4>
              <div class="quiz-knowledge-tags">
                <span v-for="tag in currentQuestion.knowledgeTags" :key="tag" class="quiz-knowledge-tag">{{ tag }}</span>
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
                  <span class="quiz-info-value" :class="{ 'is-answered': !!answers[currentQuestion?.id] }">
                    <template v-if="currentQuestion?.type === 'MULTIPLE_CHOICE' && answers[currentQuestion?.id]">
                      已选 {{ (answers[currentQuestion.id] || '').length }} 项
                    </template>
                    <template v-else>
                      {{ answers[currentQuestion?.id] ? '已作答' : '未作答' }}
                    </template>
                  </span>
                </div>
                <div v-if="showMarkFeature" class="quiz-info-item">
                  <span class="quiz-info-label">标记</span>
                  <span class="quiz-info-value" :class="{ 'is-marked': markedQuestions.has(currentIndex) }">
                    {{ markedQuestions.has(currentIndex) ? '已标记' : '-' }}
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
                  <span class="quiz-info-value" style="font-weight:700;color:var(--lt-brand);">{{ answeredCount }} / {{ questions.length }}</span>
                </div>
                <div v-if="showTimer" class="quiz-info-item">
                  <span class="quiz-info-label">用时</span>
                  <span class="quiz-info-value">{{ formattedTime }}</span>
                </div>
                <div v-if="showTimer" class="quiz-info-item">
                  <span class="quiz-info-label">平均</span>
                  <span class="quiz-info-value">{{ avgTimePerQ }}s/题</span>
                </div>
              </div>
            </div>

            <div v-if="showMarkFeature && markedQuestions.size > 0" class="quiz-info-card glass-effect">
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
                  :class="{ 'is-current': qi === currentIndex }"
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
      <template v-else-if="phase === 'submitting'">
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
      <template v-else-if="phase === 'result' && result">
        <div class="quiz-result">
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
              <span class="quiz-stat-value">{{ correctCount }}/{{ questions.length }}</span>
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
              <span class="quiz-stat-value" :style="{ color: scoreColor }">{{ correctRatio >= 0.7 ? '达标' : correctRatio >= 0.35 ? '继续加油' : '需复习' }}</span>
              <span class="quiz-stat-label">评级</span>
            </div>
          </div>

          <!-- Weak Tags -->
          <div v-if="result.weakTags?.length" class="quiz-weak-section">
            <h4 class="quiz-weak-title">需要加强的知识点</h4>
            <div class="quiz-weak-tags">
              <span v-for="tag in result.weakTags" :key="tag" class="quiz-weak-tag">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="quiz-weak-tag-icon">
                  <circle cx="6" cy="6" r="5" stroke="var(--lt-orange)" stroke-width="1.2"/>
                  <path d="M6 4v2M6 8v.01" stroke="var(--lt-orange)" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                {{ tag }}
              </span>
            </div>
          </div>

          <!-- AI Evaluation Section -->
          <div v-if="phase === 'result' || phase === 'review'" class="quiz-eval-section">
            <div class="quiz-eval-header">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="quiz-eval-icon">
                <path d="M8 1l1.6 3.8L13.5 6 9.6 8.2 8 12l-1.6-3.8L2.5 6l3.9-1.2L8 1z" fill="var(--lt-ai)"/>
              </svg>
              <h4 class="quiz-eval-title">AI 智能评估分析</h4>
              <span v-if="evaluationLoading" class="quiz-eval-status">分析中…</span>
              <button
                v-if="!evaluationLoading && !evaluationText"
                class="quiz-eval-trigger-btn"
                @click="emit('triggerEval')"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1l1.6 3.8L13.5 6 9.6 8.2 8 12l-1.6-3.8L2.5 6l3.9-1.2L8 1z" fill="currentColor"/>
                </svg>
                开始评估
              </button>
            </div>
            <div v-if="evaluationError" class="quiz-eval-error">
              {{ evaluationError }}
              <button class="quiz-eval-retry-btn" @click="emit('triggerEval')">重试</button>
            </div>
            <div v-else-if="evaluationText || evaluationLoading" class="quiz-eval-body">
              <MarkdownViewer :content="evaluationText" :show-toc="false" themed />
              <span v-if="evaluationLoading" class="quiz-eval-cursor" />
            </div>
          </div>

          <!-- Actions -->
          <div v-if="showResultActions" class="quiz-result-actions">
            <button class="quiz-action-btn quiz-action-btn--secondary" @click="emit('review')">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.3"/>
                <path d="M8 5v3.5l2.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
              查看错题解析
            </button>
            <button
              v-if="!passed"
              class="quiz-action-btn quiz-action-btn--ghost"
              @click="emit('retry')"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 8a6 6 0 0111.3-3M14 8a6 6 0 01-11.3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                <path d="M14 2v4h-4M2 14v-4h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
              重新作答
            </button>
            <button
              class="quiz-action-btn quiz-action-btn--primary"
              @click="emit('complete')"
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
      <template v-else-if="phase === 'review'">
        <div class="quiz-content-layout" :class="{ 'is-fullwidth': fullWidth }">
          <div class="quiz-content-left">
            <div v-if="reviewQuestion" class="quiz-question-section">
              <div class="quiz-question-header">
                <div class="quiz-question-title-row">
                  <span class="quiz-question-num" aria-hidden="true">{{ String(currentIndex + 1).padStart(2, '0') }}</span>
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
                <div v-if="showAskAiFeature" class="quiz-header-actions">
                  <button
                    class="quiz-ask-ai-btn"
                    @click.stop="handleAskAi"
                    title="向 AI 提问此题"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 2a8 8 0 0 0-8 8c0 2.5 1.2 4.8 3 6.3V22l3.5-2.3c.5.2 1 .3 1.5.3a8 8 0 1 0 0-16z"/>
                      <path d="M8 9h.01M12 9h.01M16 9h.01"/>
                    </svg>
                    <span class="quiz-ask-ai-label">问AI</span>
                  </button>
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

              <!-- Fill/Short Answer review -->
              <div v-if="reviewQuestion.type === 'FILL_IN_BLANK' || reviewQuestion.type === 'SHORT_ANSWER'" class="quiz-review-text-answer">
                <div class="quiz-review-text-answer-item">
                  <span class="quiz-review-text-answer-label">你的答案：</span>
                  <span class="quiz-review-text-answer-value" :class="{ 'is-correct': reviewQuestion.type === 'FILL_IN_BLANK' && isAnswerCorrect(reviewQuestion), 'is-wrong': reviewQuestion.type === 'FILL_IN_BLANK' && !isAnswerCorrect(reviewQuestion) && answers[reviewQuestion.id] }">
                    {{ answers[reviewQuestion.id] || '（未作答）' }}
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
                <div v-if="reviewQuestion.mistakeTags?.length" class="quiz-analysis-mistakes">
                  <span class="quiz-analysis-mistakes-label">常见错误：</span>
                  <span v-for="mistake in reviewQuestion.mistakeTags" :key="mistake" class="quiz-analysis-mistake-tag">{{ mistake }}</span>
                </div>
              </div>
            </div>

            <div style="display:flex;justify-content:center;padding-top:16px;">
              <button class="quiz-back-btn" @click="emit('complete')">
                返回结果
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          <aside v-if="showSidebar && !fullWidth" class="quiz-content-right" aria-label="解析信息">
            <div v-if="reviewQuestion?.knowledgeTags?.length" class="quiz-info-card glass-effect">
              <h4 class="quiz-info-title">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="quiz-info-icon">
                  <circle cx="5" cy="5" r="4.5" stroke="var(--lt-brand)" stroke-width="1.2"/>
                  <path d="M8 8l5 5" stroke="var(--lt-brand)" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
                相关知识点
              </h4>
              <div class="quiz-knowledge-tags">
                <span v-for="tag in reviewQuestion.knowledgeTags" :key="tag" class="quiz-knowledge-tag">{{ tag }}</span>
              </div>
            </div>

            <div class="quiz-info-card glass-effect">
              <h4 class="quiz-info-title">正确率</h4>
              <div class="quiz-review-accuracy">
                <div class="quiz-review-accuracy-bar">
                  <div class="quiz-review-accuracy-fill" :style="{ width: (correctCount / questions.length * 100) + '%' }"></div>
                </div>
                <span class="quiz-review-accuracy-text">{{ correctCount }}/{{ questions.length }}</span>
              </div>
            </div>
          </aside>
        </div>
      </template>
    </main>

    <!-- ===== FAB Submit (batch mode only) ===== -->
    <button
      v-if="showFAB && phase === 'answering' && submitMode === 'batch'"
      class="quiz-fab-submit"
      @click="emit('submit')"
      :class="{ 'is-all-answered': allAnswered }"
      :aria-label="'提交答案，已答' + answeredCount + '/' + questions.length"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" class="quiz-fab-icon">
        <path d="M4 10l4 4 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span class="quiz-fab-text">提交</span>
      <span class="quiz-fab-badge">{{ answeredCount }}/{{ questions.length }}</span>
    </button>
  </div>
</template>

<style scoped>
/* ===================================================================
   QuizPlayer — 共享做题组件
   =================================================================== */
.quiz-fullscreen-root {
  width: 100%;
  display: flex;
  flex-direction: column;
  background: var(--lt-bg-page);
  --quiz-bg-brand-fade: rgba(43, 111, 255, 0.03);
  position: relative;
  min-height: 100%;
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
  width: 400px; height: 400px;
  background: var(--lt-brand-lightest);
  top: -120px; right: -80px;
  animation: orb-float 20s ease-in-out infinite;
}
.quiz-bg-orb-2 {
  width: 300px; height: 300px;
  background: var(--lt-ai-light-9);
  bottom: -60px; left: -60px;
  animation: orb-float 25s ease-in-out infinite reverse;
}
.quiz-bg-orb-3 {
  width: 200px; height: 200px;
  background: rgba(255, 140, 66, 0.06);
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  animation: orb-float 30s ease-in-out infinite;
}
@keyframes orb-float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -20px) scale(1.05); }
  66% { transform: translate(-20px, 15px) scale(0.95); }
}

/* Timer */
.quiz-timer {
  display: flex; align-items: center; gap: 5px;
  font-size: 13px; color: var(--lt-text-secondary);
  padding: 3px 11px; border-radius: var(--lt-radius-full);
  background: color-mix(in srgb, var(--lt-bg-page) 80%, transparent);
  border: 1px solid var(--lt-border); flex-shrink: 0; margin-left: auto;
}
.quiz-timer-icon { color: var(--lt-brand); animation: timer-pulse 2s ease-in-out infinite; }
@keyframes timer-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.quiz-timer-text { font-weight: 700; font-variant-numeric: tabular-nums; color: var(--lt-text-primary); font-size: 14px; letter-spacing: 0.02em; }

/* Progress Zone */
.quiz-progress-zone {
  position: relative; z-index: 10;
  background: var(--lt-bg-card); border-bottom: 1px solid var(--lt-border);
  flex-shrink: 0; padding: 10px 28px;
}
.quiz-progress-zone-inner { display: flex; align-items: center; gap: 14px; }
.quiz-progress-zone-label {
  font-size: 12px; font-weight: 600; color: var(--lt-text-auxiliary);
  white-space: nowrap; flex-shrink: 0; letter-spacing: 0.04em; text-transform: uppercase;
}
.quiz-progress-zone-count {
  font-size: 12px; font-weight: 700; color: var(--lt-brand); white-space: nowrap; flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  background: color-mix(in srgb, var(--lt-brand) 10%, transparent);
  padding: 3px 12px; border-radius: var(--lt-radius-full); line-height: 1.4;
}

/* Progress Track */
.quiz-progress-track {
  position: relative; z-index: 1; height: 3px;
  background: color-mix(in srgb, var(--lt-border) 60%, transparent);
  flex-shrink: 0; overflow: hidden;
}
.quiz-progress-track-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--lt-brand), var(--lt-ai), var(--lt-brand));
  background-size: 200% 100%; border-radius: 0 2px 2px 0;
  transition: width 500ms cubic-bezier(0.22, 1, 0.36, 1);
  animation: progress-shimmer 3s linear infinite;
}
@keyframes progress-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* Main */
.quiz-main {
  position: relative; z-index: 1; flex: 1;
  overflow-y: auto; padding: 20px 12px; padding-bottom: 80px;
}
.quiz-main::-webkit-scrollbar { width: 4px; }
.quiz-main::-webkit-scrollbar-thumb { background: var(--lt-border); border-radius: 2px; }

/* Skeleton */
.quiz-skeleton { max-width: 800px; margin: 0 auto; }
.quiz-skeleton-card {
  background: var(--lt-bg-card); border-radius: var(--lt-radius-lg);
  padding: 28px; box-shadow: var(--lt-shadow-card);
}
.quiz-skeleton-line {
  height: 14px; border-radius: 7px;
  background: linear-gradient(90deg, var(--lt-border) 25%, var(--lt-bg-page) 50%, var(--lt-border) 75%);
  background-size: 200% 100%; animation: skeleton-shimmer 1.5s ease-in-out infinite; margin-bottom: 16px;
}
.quiz-skeleton-line--short { width: 30%; }
.quiz-skeleton-line--long { width: 80%; }
.quiz-skeleton-line--medium { width: 55%; }
.quiz-skeleton-block-group { display: flex; flex-direction: column; gap: 12px; margin-top: 24px; }
.quiz-skeleton-block {
  height: 48px; border-radius: var(--lt-radius-md);
  background: linear-gradient(90deg, var(--lt-border) 25%, var(--lt-bg-page) 50%, var(--lt-border) 75%);
  background-size: 200% 100%; animation: skeleton-shimmer 1.5s ease-in-out infinite;
}
.quiz-skeleton-block:nth-child(2) { width: 85%; }
.quiz-skeleton-block:nth-child(3) { width: 70%; }
.quiz-skeleton-block:nth-child(4) { width: 90%; }
@keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* Empty */
.quiz-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 12px; text-align: center; }
.quiz-empty-icon { margin-bottom: 8px; opacity: 0.5; }
.quiz-empty-text { font-size: 18px; font-weight: 600; color: var(--lt-text-primary); margin: 0; }
.quiz-empty-hint { font-size: 14px; color: var(--lt-text-auxiliary); margin: 0; }
.quiz-empty-btn {
  margin-top: 8px; padding: 10px 24px; border: none; border-radius: var(--lt-radius-md);
  background: var(--lt-brand); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
  transition: all var(--lt-transition-smooth); font-family: var(--lt-font-body);
}
.quiz-empty-btn:hover { background: var(--lt-brand-dark); transform: translateY(-1px); box-shadow: var(--lt-shadow-hover); }

/* Content Layout */
.quiz-content-layout {
  display: grid; grid-template-columns: 1fr 300px; gap: 20px;
  max-width: 100%; margin: 0 auto; min-height: 100%; align-items: start;
}
.quiz-content-left { min-width: 0; }
.quiz-content-right { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 0; }

/* Question Section */
.quiz-question-section {
  background: var(--lt-bg-card); border-radius: var(--lt-radius-lg);
  padding: 36px 40px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.04);
  position: relative; border: 1px solid var(--lt-border);
  transition: box-shadow 0.3s ease;
}
.quiz-question-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 24px; }
.quiz-question-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.quiz-question-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: 50%;
  background: color-mix(in srgb, var(--lt-brand) 10%, transparent);
  font-size: 14px; font-weight: 700; color: var(--lt-brand);
  font-variant-numeric: tabular-nums; letter-spacing: 0.05em;
}
.quiz-difficulty-badge {
  display: inline-flex; align-items: center; padding: 3px 10px;
  border-radius: var(--lt-radius-full); font-size: 12px; font-weight: 600; line-height: 1.4;
}
.quiz-question-type-tag {
  display: inline-flex; align-items: center; padding: 3px 10px;
  border-radius: var(--lt-radius-full); font-size: 12px; font-weight: 500;
  color: var(--lt-text-auxiliary); background: var(--lt-bg-page);
  border: 1px solid var(--lt-border); line-height: 1.4;
}
.quiz-kp-tag {
  font-size: 12px; color: var(--lt-text-secondary);
  background: var(--lt-bg-page); padding: 2px 8px; border-radius: var(--lt-radius-sm);
}
.quiz-question-text {
  font-size: 21px; font-weight: 500; color: var(--lt-text-primary);
  margin-bottom: 28px; line-height: 1.7; letter-spacing: -0.01em;
}
.quiz-question-text :deep(.markdown-content) { font-size: inherit; line-height: inherit; }
.quiz-question-text :deep(.markdown-content > p) { margin: 0; }

/* Options */
.quiz-options { display: flex; flex-direction: column; gap: 14px; }
.quiz-option {
  display: flex; align-items: center; gap: 14px;
  padding: 20px 24px; border-radius: 12px;
  border: 1.5px solid var(--lt-border); cursor: pointer;
  color: var(--lt-text-primary); font-size: 17px; position: relative; overflow: hidden;
  animation: option-enter 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
  background: var(--lt-bg-card);
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  -webkit-tap-highlight-color: transparent;
}
.quiz-option::before {
  content: ''; position: absolute; inset: 0; opacity: 0;
  background: linear-gradient(135deg, color-mix(in srgb, var(--lt-brand) 4%, transparent) 0%, transparent 100%);
  transition: opacity 0.3s ease; pointer-events: none;
}
@keyframes option-enter { from { opacity: 0; transform: translateY(16px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
@media (hover: hover) {
  .quiz-option:hover { border-color: var(--lt-brand-light); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(43, 111, 255, 0.08); }
  .quiz-option:hover::before { opacity: 1; }
}
.quiz-option:active { transform: scale(0.98); transition: transform 60ms ease-out; }
.quiz-option.is-selected {
  border-color: var(--lt-brand);
  background: color-mix(in srgb, var(--lt-brand) 6%, var(--lt-bg-card));
  box-shadow: 0 0 0 3px rgba(43, 111, 255, 0.08), 0 4px 20px rgba(43, 111, 255, 0.12);
}
.quiz-option-letter {
  width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 700; border: 1.5px solid var(--lt-border);
  flex-shrink: 0; color: var(--lt-text-secondary);
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1); position: relative; z-index: 1;
}
.quiz-option.is-selected .quiz-option-letter {
  border-color: var(--lt-brand);
  background: linear-gradient(135deg, var(--lt-brand), var(--lt-brand-dark));
  color: #fff; transform: scale(1.08);
  box-shadow: 0 2px 8px rgba(43, 111, 255, 0.3);
}
.quiz-option-check {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  animation: check-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes check-pop { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.quiz-option-text { flex: 1; line-height: 1.5; position: relative; z-index: 1; }
.quiz-option-text :deep(.markdown-content) { font-size: inherit; }
.quiz-option-text :deep(.markdown-content > p) { margin: 0; }
.quiz-option-ring {
  position: absolute; inset: -2px; border-radius: inherit;
  border: 2px solid var(--lt-brand); opacity: 0;
  animation: ring-expand 0.5s ease-out forwards; pointer-events: none;
}
@keyframes ring-expand { from { opacity: 0.5; transform: scale(1); } to { opacity: 0; transform: scale(1.04); } }

/* Review options */
.quiz-option.is-correct-answer {
  border-color: var(--lt-success); background: color-mix(in srgb, var(--lt-success) 12%, transparent);
}
.quiz-option.is-wrong-choice {
  border-color: var(--lt-danger); background: color-mix(in srgb, var(--lt-danger) 12%, transparent);
  animation: shake 0.4s ease-out;
}
@keyframes shake {
  0%, 100% { transform: translateX(0); } 20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(3px); }
}

/* Keyboard Hint */
.quiz-keyboard-hint { margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--lt-border); font-size: 12px; color: var(--lt-text-auxiliary); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.quiz-keyboard-hint-label { font-weight: 600; color: var(--lt-text-auxiliary); margin-right: 4px; }
.kbd-group { display: inline-flex; align-items: center; gap: 2px; }
.kbd-label { margin-left: 3px; font-size: 11px; color: var(--lt-text-placeholder); }
.kbd-divider { color: var(--lt-border); margin: 0 4px; }
.quiz-keyboard-hint kbd {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 22px; height: 20px; padding: 0 5px; font-size: 11px;
  font-family: var(--lt-font-mono); background: var(--lt-bg-page);
  border: 1px solid var(--lt-border); border-radius: 4px;
  box-shadow: 0 1px 0 var(--lt-border); color: var(--lt-text-secondary); line-height: 1;
}

/* Mark Button */
.quiz-mark-btn {
  background: none; border: none; cursor: pointer; padding: 6px; line-height: 1;
  color: var(--lt-text-disabled); transition: all var(--lt-transition-bounce);
  flex-shrink: 0; border-radius: var(--lt-radius-sm);
}
@media (hover: hover) { .quiz-mark-btn:hover { color: var(--lt-orange); background: rgba(255, 140, 66, 0.08); } }
.quiz-mark-btn.is-marked { color: var(--lt-orange); }

/* Header Actions */
.quiz-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

/* Ask AI Button */
.quiz-ask-ai-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  background: var(--lt-brand-lightest);
  border: 1px solid transparent;
  border-radius: var(--lt-radius-md);
  cursor: pointer;
  color: var(--lt-brand);
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
  flex-shrink: 0;
  white-space: nowrap;
}
.quiz-ask-ai-btn svg {
  flex-shrink: 0;
}
.quiz-ask-ai-label {
  line-height: 1;
}
@media (hover: hover) {
  .quiz-ask-ai-btn:hover {
    background: var(--lt-brand);
    color: #fff;
    border-color: var(--lt-brand);
    box-shadow: 0 2px 8px rgba(43, 111, 255, 0.2);
    transform: translateY(-1px);
  }
}
.quiz-ask-ai-btn:active {
  transform: translateY(0);
}

/* Info Cards */
.quiz-info-card {
  background: var(--lt-bg-card); border-radius: var(--lt-radius-lg); padding: 18px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.03);
  border: 1px solid var(--lt-border); transition: box-shadow 0.3s ease, transform 0.3s ease;
}
@media (hover: hover) { .quiz-info-card:hover { box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 6px 24px rgba(0,0,0,0.04); transform: translateY(-1px); } }
.quiz-info-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--lt-text-primary); margin: 0 0 14px 0; }
.quiz-info-icon { flex-shrink: 0; }
.quiz-knowledge-tags { display: flex; flex-wrap: wrap; gap: 8px; }
.quiz-knowledge-tag {
  display: inline-flex; align-items: center; padding: 4px 12px;
  background: var(--lt-brand-lightest); border-radius: var(--lt-radius-full);
  font-size: 13px; color: var(--lt-brand); font-weight: 500;
  border: 1px solid transparent; transition: all var(--lt-transition-smooth);
}
@media (hover: hover) { .quiz-knowledge-tag:hover { border-color: var(--lt-brand-lighter); transform: translateY(-1px); } }
.quiz-info-list { display: flex; flex-direction: column; gap: 12px; }
.quiz-info-item { display: flex; justify-content: space-between; align-items: center; }
.quiz-info-label { font-size: 13px; color: var(--lt-text-auxiliary); }
.quiz-info-value { font-size: 13px; font-weight: 600; color: var(--lt-text-secondary); }
.quiz-info-value.is-answered { color: var(--lt-success); }
.quiz-info-value.is-marked { color: var(--lt-orange); }
.quiz-marked-list { display: flex; flex-wrap: wrap; gap: 8px; }
.quiz-marked-item {
  padding: 5px 12px; border: 1px solid var(--lt-border); border-radius: var(--lt-radius-md);
  background: var(--lt-bg-card); font-size: 12px; color: var(--lt-text-secondary);
  cursor: pointer; transition: all var(--lt-transition-smooth); font-family: var(--lt-font-body);
}
@media (hover: hover) { .quiz-marked-item:hover { border-color: var(--lt-brand-lighter); color: var(--lt-brand); background: var(--lt-brand-lightest); } }
.quiz-marked-item.is-current { border-color: var(--lt-brand); background: var(--lt-brand-lightest); color: var(--lt-brand); font-weight: 600; }

/* Submitting */
.quiz-submitting { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 16px; text-align: center; }
.quiz-submitting-spinner { margin-bottom: 4px; }
.quiz-spinner-circle { animation: spinner-rotate 1.2s linear infinite; transform-origin: center; }
@keyframes spinner-rotate { to { transform: rotate(360deg); } }
.quiz-submitting-text { font-size: 18px; font-weight: 600; color: var(--lt-text-primary); margin: 0; }
.quiz-submitting-hint { font-size: 14px; color: var(--lt-text-auxiliary); margin: 0; }

/* Result */
.quiz-result {
  text-align: center; padding: 32px 24px 24px; position: relative;
  max-width: 640px; margin: 0 auto; width: 100%;
  animation: result-enter 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes result-enter { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.quiz-result-hero { position: relative; z-index: 1; margin-bottom: 24px; }
.quiz-score-ring-wrapper { margin-bottom: 16px; display: inline-block; }
.quiz-score-ring {
  width: 140px; height: 140px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center; transition: background 0.3s ease;
}
.quiz-score-inner {
  width: 116px; height: 116px; border-radius: 50%;
  background: var(--lt-bg-card); display: flex; align-items: center; justify-content: center;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.04);
}
.quiz-score-text { font-size: 34px; font-weight: 800; color: var(--lt-text-primary); font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.quiz-result-meta { position: relative; z-index: 1; }
.quiz-stars { display: flex; justify-content: center; gap: 12px; margin-bottom: 12px; }
.quiz-star { font-size: 40px; color: var(--lt-border); opacity: 0; transform: scale(0); animation: star-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
.quiz-star.active { color: #FFD700; text-shadow: 0 0 16px rgba(255, 215, 0, 0.4); }
@keyframes star-pop { from { opacity: 0; transform: scale(0) rotate(-30deg); } to { opacity: 1; transform: scale(1) rotate(0deg); } }
.quiz-result-label { font-size: 24px; font-weight: 800; color: var(--lt-text-primary); margin: 0 0 6px 0; }
.quiz-result-subtitle { font-size: 14px; color: var(--lt-text-auxiliary); margin: 0; }

/* Result Stats */
.quiz-result-stats {
  display: flex; align-items: center; justify-content: center; gap: 0;
  margin-bottom: 28px; padding: 24px 0;
  background: var(--lt-bg-card); border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.04);
  border: 1px solid var(--lt-border); position: relative; z-index: 1;
}
.quiz-stat-item { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
.quiz-stat-value { font-size: 22px; font-weight: 700; color: var(--lt-text-primary); font-variant-numeric: tabular-nums; }
.quiz-stat-label { font-size: 13px; color: var(--lt-text-auxiliary); font-weight: 500; }
.quiz-stat-divider { width: 1px; height: 36px; background: var(--lt-border); flex-shrink: 0; }

/* Weak Tags */
.quiz-weak-section { margin-bottom: 32px; position: relative; z-index: 1; }
.quiz-weak-title { font-size: 14px; font-weight: 600; color: var(--lt-text-secondary); margin: 0 0 12px 0; }
.quiz-weak-tags { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.quiz-weak-tag {
  display: inline-flex; align-items: center; gap: 6px; font-size: 13px;
  padding: 6px 16px; border-radius: var(--lt-radius-full);
  background: var(--lt-orange-light-9); color: var(--lt-orange-text);
  font-weight: 500; border: 1px solid rgba(255, 140, 66, 0.15);
}
.quiz-weak-tag-icon { flex-shrink: 0; }

/* Result Actions */
.quiz-result-actions { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 28px; position: relative; z-index: 1; flex-wrap: wrap; }
.quiz-action-btn {
  display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px;
  border-radius: var(--lt-radius-md); font-size: 14px; font-weight: 600; cursor: pointer;
  transition: all var(--lt-transition-smooth); font-family: var(--lt-font-body); border: none; outline: none;
}
.quiz-action-btn:focus-visible { box-shadow: 0 0 0 3px var(--lt-brand-lighter); }
.quiz-action-btn--primary { background: var(--lt-brand); color: #fff; box-shadow: 0 2px 8px rgba(43, 111, 255, 0.25); }
@media (hover: hover) { .quiz-action-btn--primary:hover { background: var(--lt-brand-dark); transform: translateY(-1px); box-shadow: var(--lt-shadow-elevated); } }
.quiz-action-btn--secondary { background: var(--lt-bg-card); color: var(--lt-text-secondary); border: 1px solid var(--lt-border); }
@media (hover: hover) { .quiz-action-btn--secondary:hover { border-color: var(--lt-brand-lighter); color: var(--lt-brand); background: var(--lt-brand-lightest); } }
.quiz-action-btn--ghost { background: transparent; color: var(--lt-text-auxiliary); }
@media (hover: hover) { .quiz-action-btn--ghost:hover { color: var(--lt-text-secondary); background: var(--lt-bg-page); } }

/* Review Analysis */
.quiz-review-analysis { margin-top: 24px; padding: 20px; background: var(--lt-bg-page); border-radius: var(--lt-radius-lg); border: 1px solid var(--lt-border); }
.quiz-review-analysis-header { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: var(--lt-text-primary); margin-bottom: 14px; }
.quiz-analysis-correct { font-size: 15px; color: var(--lt-success); font-weight: 600; margin-bottom: 12px; }
.quiz-analysis-text { font-size: 14px; color: var(--lt-text-secondary); line-height: 1.7; margin: 0 0 12px 0; }
.quiz-analysis-text :deep(.markdown-content) { font-size: inherit; }
.quiz-analysis-mistakes { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 12px; border-top: 1px dashed var(--lt-border); }
.quiz-analysis-mistakes-label { font-size: 13px; color: var(--lt-text-auxiliary); font-weight: 500; }
.quiz-analysis-mistake-tag {
  display: inline-flex; align-items: center; padding: 3px 10px;
  background: color-mix(in srgb, var(--lt-danger) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--lt-danger) 20%, transparent);
  border-radius: var(--lt-radius-full); font-size: 12px; color: var(--lt-danger); font-weight: 500;
}
.quiz-review-accuracy { display: flex; align-items: center; gap: 12px; }
.quiz-review-accuracy-bar { flex: 1; height: 8px; background: var(--lt-border); border-radius: 4px; overflow: hidden; }
.quiz-review-accuracy-fill { height: 100%; background: linear-gradient(90deg, var(--lt-brand), var(--lt-ai)); border-radius: 4px; transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
.quiz-review-accuracy-text { font-size: 14px; font-weight: 700; color: var(--lt-text-primary); flex-shrink: 0; }

/* Progress Bar */
.quiz-progress-bar {
  display: flex; gap: 6px; justify-content: center; flex: 1;
  overflow-x: auto; padding: 2px 0; scrollbar-width: none;
}
.quiz-progress-bar::-webkit-scrollbar { display: none; }
.quiz-progress-dot {
  width: 34px; height: 34px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; cursor: pointer; border: 2px solid var(--lt-border);
  color: var(--lt-text-auxiliary); font-weight: 500; background: var(--lt-bg-card);
  transition: all 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
  font-family: var(--lt-font-body); padding: 0; position: relative; z-index: 1;
}
.quiz-progress-dot::after { content: ''; position: absolute; inset: -3px; border-radius: 50%; opacity: 0; transition: opacity 0.3s ease; }
@media (hover: hover) { .quiz-progress-dot:hover { transform: scale(1.12); border-color: var(--lt-brand-lighter); color: var(--lt-brand); } }
.quiz-progress-dot.is-current { font-weight: 700; color: var(--lt-brand); border-color: var(--lt-brand); box-shadow: 0 0 0 4px rgba(43, 111, 255, 0.1); animation: dot-glow 2s ease-in-out infinite; background: color-mix(in srgb, var(--lt-brand) 6%, var(--lt-bg-card)); }
.quiz-progress-dot.is-answered { color: #fff; background: var(--lt-brand); border-color: var(--lt-brand); box-shadow: 0 2px 8px rgba(43, 111, 255, 0.3); animation: dot-fill 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
.quiz-progress-dot.is-answered.is-current { box-shadow: 0 0 0 4px rgba(43, 111, 255, 0.15), 0 2px 8px rgba(43, 111, 255, 0.3); }
@keyframes dot-glow { 0%, 100% { box-shadow: 0 0 0 4px rgba(43, 111, 255, 0.12); } 50% { box-shadow: 0 0 0 7px rgba(43, 111, 255, 0.06); } }
@keyframes dot-fill { from { transform: scale(0.6); opacity: 0; } 50% { transform: scale(1.25); } to { transform: scale(1); opacity: 1; } }
.quiz-progress-dot.is-correct { background: var(--lt-success) !important; border-color: var(--lt-success) !important; color: #fff !important; }
.quiz-progress-dot.is-partial { background: var(--lt-warning) !important; border-color: var(--lt-warning) !important; color: #fff !important; }
.quiz-progress-dot.is-wrong { background: var(--lt-danger) !important; border-color: var(--lt-danger) !important; color: #fff !important; }

/* FAB Submit */
.quiz-fab-submit {
  position: fixed; bottom: 72px; right: 24px; z-index: 65;
  display: inline-flex; align-items: center; gap: 8px;
  padding: 14px 24px 14px 22px; border: none; border-radius: 16px;
  background: linear-gradient(135deg, var(--lt-brand), color-mix(in srgb, var(--lt-brand) 80%, var(--lt-ai)));
  color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  font-family: var(--lt-font-body);
  box-shadow: 0 4px 20px rgba(43, 111, 255, 0.3), 0 1px 3px rgba(43, 111, 255, 0.15);
  opacity: 0.85; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
@media (hover: hover) {
  .quiz-fab-submit:hover { opacity: 1; transform: translateY(-2px) scale(1.02); box-shadow: 0 8px 30px rgba(43, 111, 255, 0.4), 0 2px 6px rgba(43, 111, 255, 0.2); }
}
.quiz-fab-submit:active { transform: scale(0.96); transition: transform 60ms ease-out; }
.quiz-fab-submit.is-all-answered { opacity: 1; animation: fab-pulse 2s ease-in-out infinite; }
@keyframes fab-pulse { 0%, 100% { box-shadow: 0 4px 20px rgba(43, 111, 255, 0.3); } 50% { box-shadow: 0 4px 28px rgba(43, 111, 255, 0.5); } }
.quiz-fab-icon { flex-shrink: 0; }
.quiz-fab-text { flex-shrink: 0; }
.quiz-fab-badge { display: inline-flex; align-items: center; justify-content: center; padding: 2px 8px; background: rgba(255, 255, 255, 0.2); border-radius: var(--lt-radius-full); font-size: 12px; font-weight: 700; line-height: 1.4; flex-shrink: 0; }

/* Back Button */
.quiz-back-btn {
  display: inline-flex; align-items: center; gap: 8px; padding: 10px 22px;
  border: none; border-radius: var(--lt-radius-md); background: var(--lt-bg-card);
  color: var(--lt-text-secondary); font-size: 14px; font-weight: 600; cursor: pointer;
  transition: all var(--lt-transition-smooth); font-family: var(--lt-font-body);
  border: 1px solid var(--lt-border); flex-shrink: 0;
}
@media (hover: hover) { .quiz-back-btn:hover { border-color: var(--lt-brand-lighter); color: var(--lt-brand); background: var(--lt-brand-lightest); } }

/* Slide transitions */
.slide-left-enter-active, .slide-left-leave-active, .slide-right-enter-active, .slide-right-leave-active { transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1); }
.slide-left-enter-from { opacity: 0; transform: translateX(24px); }
.slide-left-leave-to { opacity: 0; transform: translateX(-24px); }
.slide-right-enter-from { opacity: 0; transform: translateX(-24px); }
.slide-right-leave-to { opacity: 0; transform: translateX(24px); }

/* Full-width Toggle */
.quiz-fullwidth-toggle {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-md); background: transparent; cursor: pointer;
  color: var(--lt-text-auxiliary); transition: all var(--lt-transition-smooth); flex-shrink: 0;
}
@media (hover: hover) { .quiz-fullwidth-toggle:hover { border-color: var(--lt-brand-lighter); color: var(--lt-brand); background: color-mix(in srgb, var(--lt-brand) 6%, transparent); } }
.quiz-content-layout.is-fullwidth { grid-template-columns: 1fr; }
.quiz-content-layout.is-fullwidth .quiz-content-right { display: none; }

/* Multiple Choice */
.quiz-multi-hint { font-size: 13px; color: var(--lt-text-auxiliary); margin-bottom: 8px; font-weight: 500; }
.quiz-option-letter--multi { border-radius: 6px; width: 32px; height: 32px; font-size: 13px; border-width: 2px; transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1); }
.quiz-option--multi.is-selected .quiz-option-letter--multi { border-color: var(--lt-brand); background: color-mix(in srgb, var(--lt-brand) 10%, transparent); color: var(--lt-brand); transform: scale(1); box-shadow: none; }
.quiz-option--multi.is-selected .quiz-option-letter--multi .quiz-option-check { display: flex; animation: check-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.quiz-option--multi.is-selected .quiz-option-letter--multi .quiz-option-check svg path { stroke: var(--lt-brand); }

/* Fill-in & Short Answer */
.quiz-fill-blank { margin-top: 8px; }
.quiz-fill-label { display: block; font-size: 14px; font-weight: 600; color: var(--lt-text-secondary); margin-bottom: 10px; }
.quiz-fill-text-input {
  width: 100%; font-size: 16px; padding: 10px 14px; height: 44px;
  border-radius: 12px; border: 1.5px solid var(--lt-border);
  background: var(--lt-bg-card); color: var(--lt-text-primary);
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  outline: none; box-sizing: border-box; font-family: var(--lt-font-body, inherit);
}
.quiz-fill-text-input:hover { border-color: var(--lt-brand-lighter); }
.quiz-fill-text-input:focus { border-color: var(--lt-brand); box-shadow: 0 0 0 3px rgba(43, 111, 255, 0.08), 0 4px 16px rgba(43, 111, 255, 0.08); }
.quiz-fill-text-input:disabled { opacity: 0.6; background: var(--lt-bg-page); cursor: not-allowed; }
.quiz-short-answer { margin-top: 8px; }
.quiz-short-textarea {
  width: 100%; font-size: 15px; line-height: 1.7; padding: 14px; min-height: 140px;
  border-radius: 12px; border: 1.5px solid var(--lt-border);
  background: var(--lt-bg-card); color: var(--lt-text-primary);
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  outline: none; resize: vertical; box-sizing: border-box; font-family: var(--lt-font-body, inherit);
}
.quiz-short-textarea:hover { border-color: var(--lt-brand-lighter); }
.quiz-short-textarea:focus { border-color: var(--lt-brand); box-shadow: 0 0 0 3px rgba(43, 111, 255, 0.08), 0 4px 16px rgba(43, 111, 255, 0.08); }
.quiz-short-textarea:disabled { opacity: 0.6; background: var(--lt-bg-page); cursor: not-allowed; }
.quiz-short-hint { font-size: 12px; color: var(--lt-text-auxiliary); margin-top: 8px; font-style: italic; }

/* Review Text Answer */
.quiz-review-text-answer { margin-top: 20px; padding: 16px 20px; background: var(--lt-bg-page); border-radius: var(--lt-radius-lg); border: 1px solid var(--lt-border); display: flex; flex-direction: column; gap: 10px; }
.quiz-review-text-answer-item { display: flex; align-items: baseline; gap: 8px; }
.quiz-review-text-answer-label { font-size: 13px; font-weight: 600; color: var(--lt-text-auxiliary); flex-shrink: 0; }
.quiz-review-text-answer-value { font-size: 15px; color: var(--lt-text-primary); word-break: break-all; }
.quiz-review-text-answer-value.is-correct { color: var(--lt-success); }
.quiz-review-text-answer-value.is-partial { color: var(--lt-warning); }
.quiz-review-text-answer-value.is-wrong { color: var(--lt-danger); }
.quiz-review-text-answer-value.is-correct-answer { color: var(--lt-success); font-weight: 700; }

/* Review Status Badge */
.quiz-review-status { font-size: 13px; font-weight: 600; padding: 2px 10px; border-radius: 20px; }
.quiz-review-status.correct { color: var(--lt-success); background: rgba(52, 199, 89, 0.12); }
.quiz-review-status.partial { color: var(--lt-warning); background: rgba(255, 159, 10, 0.12); }
.quiz-review-status.wrong { color: var(--lt-danger); background: rgba(255, 59, 48, 0.12); }

/* Celebration Badges */
.quiz-congrats-badge { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; padding: 6px 18px; border-radius: var(--lt-radius-full); font-size: 14px; font-weight: 700; animation: badge-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.quiz-congrats-badge--gold { background: linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 180, 0, 0.1)); color: #B8860B; border: 1px solid rgba(255, 215, 0, 0.3); }
.quiz-congrats-badge--pass { background: color-mix(in srgb, var(--lt-success) 10%, transparent); color: var(--lt-success); border: 1px solid color-mix(in srgb, var(--lt-success) 20%, transparent); }
.quiz-congrats-badge--encourage { background: color-mix(in srgb, var(--lt-orange) 10%, transparent); color: var(--lt-orange); border: 1px solid color-mix(in srgb, var(--lt-orange) 20%, transparent); }
.quiz-congrats-badge--review { background: color-mix(in srgb, var(--lt-danger) 8%, transparent); color: var(--lt-danger); border: 1px solid color-mix(in srgb, var(--lt-danger) 15%, transparent); }
@keyframes badge-pop { from { opacity: 0; transform: scale(0.8) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }

/* Evaluation Section */
.quiz-eval-section { margin-top: 20px; padding: 16px 18px; background: linear-gradient(135deg, rgba(124, 92, 252, 0.05), rgba(43, 111, 255, 0.04)); border: 1px solid rgba(124, 92, 252, 0.18); border-radius: 14px; }
.quiz-eval-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.quiz-eval-icon { flex-shrink: 0; }
.quiz-eval-title { font-size: 14px; font-weight: 600; color: var(--lt-ai); margin: 0; }
.quiz-eval-status { font-size: 12px; color: var(--lt-text-auxiliary); margin-left: auto; }
.quiz-eval-body { font-size: 13.5px; line-height: 1.7; color: var(--lt-text-primary); }
.quiz-eval-body :deep(.markdown-viewer) { padding: 0; }
.quiz-eval-body :deep(h2) { font-size: 14px; margin: 12px 0 6px; color: var(--lt-text-primary); }
.quiz-eval-body :deep(h3), .quiz-eval-body :deep(h4) { font-size: 13px; margin: 8px 0 4px; }
.quiz-eval-body :deep(p) { margin: 4px 0; }
.quiz-eval-body :deep(ul), .quiz-eval-body :deep(ol) { margin: 4px 0; padding-left: 20px; }
.quiz-eval-cursor { display: inline-block; width: 7px; height: 15px; background: var(--lt-ai); vertical-align: text-bottom; margin-left: 2px; border-radius: 1px; animation: quiz-eval-blink 1s steps(2) infinite; }
@keyframes quiz-eval-blink { to { opacity: 0; } }
.quiz-eval-error { font-size: 13px; color: var(--lt-danger); padding: 8px 0; }
.quiz-eval-trigger-btn {
  display: inline-flex; align-items: center; gap: 5px; margin-left: auto;
  padding: 5px 14px; font-size: 12px; font-weight: 600;
  color: var(--lt-ai); background: rgba(124, 92, 252, 0.1);
  border: 1px solid rgba(124, 92, 252, 0.25); border-radius: 8px;
  cursor: pointer; transition: all 0.2s; font-family: inherit;
}
.quiz-eval-trigger-btn:hover { background: rgba(124, 92, 252, 0.18); border-color: rgba(124, 92, 252, 0.4); }
.quiz-eval-retry-btn {
  display: inline-block; margin-left: 8px; font-size: 12px; font-weight: 500;
  color: var(--lt-brand); background: none; border: none; cursor: pointer; text-decoration: underline;
  padding: 0; font-family: inherit;
}

/* Instant feedback (per-question mode) */
.quiz-instant-feedback { margin-top: 24px; padding: 20px; border-radius: var(--lt-radius-md); border-left: 4px solid; }
.quiz-instant-feedback--correct { background: var(--lt-success-bg); border-left-color: var(--lt-success); }
.quiz-instant-feedback--wrong { background: var(--lt-danger-bg); border-left-color: var(--lt-danger); }
.quiz-instant-feedback__result { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; margin-bottom: 12px; }
.quiz-instant-feedback--correct .quiz-instant-feedback__result { color: var(--lt-success-text); }
.quiz-instant-feedback--wrong .quiz-instant-feedback__result { color: var(--lt-danger-text); }
.quiz-instant-feedback__explanation { margin-top: 12px; }
.quiz-instant-feedback__explanation-title { font-size: 13px; font-weight: 600; color: var(--lt-text-secondary); margin-bottom: 8px; }
.quiz-instant-feedback__answer { margin-top: 12px; font-size: 14px; color: var(--lt-text-primary); }
.quiz-instant-feedback__explanation :deep(.markdown-content) { font-size: inherit; }

/* Question actions bottom (instant mode) */
.quiz-question-actions-bottom { margin-top: 24px; display: flex; justify-content: flex-end; gap: 12px; }
.quiz-next-btn {
  display: inline-flex; align-items: center; gap: 8px; padding: 10px 22px;
  border: none; border-radius: var(--lt-radius-md); background: var(--lt-bg-card);
  color: var(--lt-text-secondary); font-size: 14px; font-weight: 600; cursor: pointer;
  transition: all var(--lt-transition-smooth); font-family: var(--lt-font-body);
  border: 1px solid var(--lt-border);
}
.quiz-next-btn:hover { border-color: var(--lt-brand-lighter); color: var(--lt-brand); background: var(--lt-brand-lightest); }
.quiz-next-btn--primary { background: var(--lt-brand); color: #fff; border-color: var(--lt-brand); }
.quiz-next-btn--primary:hover { background: var(--lt-brand-dark); color: #fff; }

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .slide-left-enter-active, .slide-left-leave-active, .slide-right-enter-active, .slide-right-leave-active { transition: none; }
  .quiz-option { animation: none; }
  .quiz-star { animation: none; opacity: 1; }
  .quiz-progress-dot.is-current { animation: none; box-shadow: 0 0 0 4px rgba(43, 111, 255, 0.1); }
  .quiz-bg-orb { animation: none; }
  .quiz-skeleton-line, .quiz-skeleton-block { animation: none; background: var(--lt-border); }
  .quiz-progress-track-fill { transition: none; }
}

/* Responsive */
@media (max-width: 1023px) {
  .quiz-content-layout { grid-template-columns: 1fr; }
  .quiz-content-right { display: none; }
  .quiz-keyboard-hint { display: none; }
  .quiz-main { padding: 16px; padding-bottom: 72px; }
  .quiz-progress-zone { padding: 8px 20px; }
}
@media (max-width: 767px) {
  .quiz-main { padding: 12px; padding-bottom: 64px; }
  .quiz-progress-zone { padding: 6px 16px; }
  .quiz-progress-zone-label { display: none; }
  .quiz-progress-zone-count { font-size: 11px; }
  .quiz-question-section { padding: 16px; }
  .quiz-question-text { font-size: 16px; }
  .quiz-option { padding: 14px 16px; font-size: 15px; }
  .quiz-option-letter { width: 32px; height: 32px; font-size: 14px; }
  .quiz-result { padding: 32px 16px 24px; }
  .quiz-score-ring { width: 120px; height: 120px; }
  .quiz-score-inner { width: 100px; height: 100px; }
  .quiz-score-text { font-size: 28px; }
  .quiz-star { font-size: 32px; }
  .quiz-result-stats { padding: 16px 12px; flex-wrap: wrap; gap: 8px; }
  .quiz-stat-divider { display: none; }
  .quiz-stat-item { min-width: 60px; }
  .quiz-stat-value { font-size: 18px; }
  .quiz-progress-dot { width: 30px; height: 30px; font-size: 11px; }
  .quiz-fab-submit { bottom: 64px; right: 16px; padding: 10px 16px; font-size: 13px; }
  .quiz-fab-badge { display: none; }
  .quiz-result-actions { flex-direction: column; gap: 10px; }
  .quiz-action-btn { width: 100%; justify-content: center; }
}

/* Dark mode */
html[data-theme="dark"] .quiz-fullscreen-root { --quiz-bg-brand-fade: rgba(43, 111, 255, 0.06); }
html[data-theme="dark"] .quiz-bg-orb-1 { opacity: 0.25; }
html[data-theme="dark"] .quiz-bg-orb-2 { opacity: 0.2; }
html[data-theme="dark"] .quiz-bg-orb-3 { opacity: 0.15; }
html[data-theme="dark"] .quiz-fill-text-input,
html[data-theme="dark"] .quiz-short-textarea { background: var(--lt-bg-page); color: var(--lt-text-primary); }
html[data-theme="dark"] .quiz-congrats-badge--gold { color: #FFD700; background: rgba(255, 215, 0, 0.1); }

/* Helper to format correct answer for display */
.js-format-answer-text { white-space: pre-wrap; }
</style>

<!-- Script helper used in template -->
<script lang="ts">
// Format correct answer for display (used in inline template expression)
function formatCorrectAnswer(ans: string): string {
  if (!ans) return ''
  try {
    const arr = JSON.parse(ans)
    if (Array.isArray(arr)) return arr.join(', ')
  } catch { /* not JSON */ }
  return ans
}
</script>
