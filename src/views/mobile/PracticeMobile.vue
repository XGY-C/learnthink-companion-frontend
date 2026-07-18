<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MagicStick, Aim, RefreshRight, Edit, Clock, CircleClose, Close, Download } from '@element-plus/icons-vue'
import QuizPlayer from '@/components/learn/QuizPlayer.vue'
import ExportPracticeDialog from '@/components/ExportPracticeDialog.vue'
import FloatingFab from '@/components/tutoring/FloatingFab.vue'
import TutoringDrawer from '@/components/tutoring/TutoringDrawer.vue'
import { usePracticeStore } from '@/stores/practice'
import { useProfileStore } from '@/stores/profile'
import { useQuestionBankStore } from '@/stores/questionBank'
import { useLearningTracker } from '@/composables/useLearningTracker'
import type { SessionQuestion, PlayerQuestion, PlayerResult, KpAccuracy } from '@/types'

const route = useRoute()
const router = useRouter()
const practiceStore = usePracticeStore()
const profileStore = useProfileStore()
const questionBankStore = useQuestionBankStore()

// 学习心跳追踪
const { isAway: isLearningAway, resumeTracking } = useLearningTracker({
  courseId: profileStore.activeCourseId,
})

type Phase = 'select' | 'answering' | 'result'
const phase = ref<Phase>('select')

const modes = [
  { key: 'kp_focus', name: '知识点练习', desc: '按知识点抽题', icon: Aim, color: 'var(--lt-brand)', bg: 'var(--lt-brand-lightest)' },
  { key: 'random', name: '随机练习', desc: '全库随机抽题', icon: RefreshRight, color: 'var(--lt-ai)', bg: 'var(--lt-ai-light-9)' },
  { key: 'wrong_review', name: '错题重做', desc: '重做错题', icon: Edit, color: 'var(--lt-orange)', bg: 'var(--lt-orange-light-9)' },
  { key: 'weak_point', name: 'AI 智能组卷', desc: '基于薄弱点组卷', icon: MagicStick, color: 'var(--lt-ai)', bg: 'var(--lt-ai-light-9)' },
]
const selectedMode = ref('kp_focus')
const questionCount = ref(10)

// 知识点练习：选中的知识点（仅 kp_focus 模式使用）
const selectedKpIds = ref<string[]>([])
const kpAccuracyList = computed<KpAccuracy[]>(() => questionBankStore.kpAccuracyList)

const QUESTION_TYPES = [
  { value: 'single_choice', label: '单选题' },
  { value: 'multiple_choice', label: '多选题' },
  { value: 'true_false', label: '判断题' },
  { value: 'fill_blank', label: '填空题' },
]
const typeCounts = ref<Record<string, number>>({
  single_choice: 3, multiple_choice: 2, true_false: 3, fill_blank: 2,
})
const totalCount = computed(() => Object.values(typeCounts.value).reduce((a, b) => a + (b || 0), 0))
function distributeCount(total: number) {
  const types = QUESTION_TYPES.map(t => t.value)
  const base = Math.floor(total / types.length)
  const remainder = total % types.length
  const result: Record<string, number> = {}
  types.forEach((t, i) => { result[t] = base + (i < remainder ? 1 : 0) })
  typeCounts.value = result
}

const showHistory = ref(false)
const showExportDialog = ref(false)

// 知识点练习：进入 kp_focus 模式或切换课程时加载知识点列表；切换课程清空已选知识点（旧 kpId 不适用）
let lastLoadedKpCid = ''
watch(
  [() => selectedMode.value, () => profileStore.activeCourseId],
  ([mode, cid], oldArr) => {
    if (cid !== oldArr?.[1]) selectedKpIds.value = []
    if (mode === 'kp_focus' && cid && cid !== lastLoadedKpCid) {
      lastLoadedKpCid = cid
      questionBankStore.fetchKpAccuracy(cid)
    }
  },
  { immediate: true },
)

// ===== QuizPlayer state =====
const currentQuestions = ref<SessionQuestion[]>([])
const playerCurrentIdx = ref(0)
const playerAnswers = ref<Record<string, string>>({})
const playerPhase = ref<'loading' | 'answering' | 'submitting' | 'result' | 'review'>('answering')
const playerTimer = ref(0)
let playerTimerHandle: ReturnType<typeof setInterval> | null = null
const playerFullWidth = ref(false)
const markedPlayerQuestions = ref<Set<number>>(new Set())

const evaluationText = ref('')
const evaluationLoading = ref(false)
const evaluationError = ref('')

// ===== 智能辅导 =====
const showTutoringDrawer = ref(false)
// 不在做题时展示智能辅导 FAB：模式选择 / 结果评价 / 查看错题
const showTutoringFab = computed(() => {
  if (phase.value === 'select') return true
  return playerPhase.value === 'result' || playerPhase.value === 'review'
})
function handleFabClick() {
  showTutoringDrawer.value = !showTutoringDrawer.value
}
function handleTutoringClose() {
  showTutoringDrawer.value = false
}

function mapQuestionType(t: string): PlayerQuestion['type'] {
  switch (t) {
    case 'single_choice': return 'SINGLE_CHOICE'
    case 'multiple_choice': return 'MULTIPLE_CHOICE'
    case 'true_false': return 'TRUE_FALSE'
    case 'fill_blank': return 'FILL_IN_BLANK'
    case 'essay': return 'SHORT_ANSWER'
    default: return 'SINGLE_CHOICE'
  }
}

function formatAnswerDisplay(ans: any): string {
  if (ans == null) return ''
  if (Array.isArray(ans)) return ans.join('')
  return String(ans)
}

const playerQuestions = computed<PlayerQuestion[]>(() =>
  currentQuestions.value.map(q => ({
    id: q.itemId,
    type: mapQuestionType(q.questionType),
    content: q.title,
    options: (q.options || []).map(o => `${o.label}. ${o.content}`),
    answer: formatAnswerDisplay(q.correctAnswer),
    analysis: q.explanation || '',
    difficulty: q.difficulty || 3,
    kpName: q.kpName,
    knowledgeTags: q.kpName ? [q.kpName] : [],
  }))
)

const playerResult = computed<PlayerResult | null>(() => {
  const session = practiceStore.currentSession
  const questions = currentQuestions.value
  const answered = questions.filter(q => q.answered)
  const correct = answered.length > 0
    ? answered.filter(q => q.isCorrect).length
    : (session?.correctCount ?? 0)
  const total = questions.length || session?.questionCount || 0

  if (correct === 0 && total === 0) return null
  if (!session?.completed && answered.length === 0) return null

  return {
    score: total > 0 ? correct / total : 0,
    totalCount: total,
    correctCount: correct,
    durationSeconds: session?.totalDurationSeconds || 0,
    questionResults: questions.filter(q => q.answered).map(q => ({
      questionId: q.itemId,
      result: q.isCorrect ? ('correct' as const) : ('wrong' as const),
    })),
  }
})

// ===== QuizPlayer events =====
function handlePlayerSelectAnswer(questionId: string, answer: string) {
  playerAnswers.value[questionId] = answer
}

async function handlePlayerSubmit() {
  if (!practiceStore.currentSession) return
  playerPhase.value = 'submitting'
  stopPlayerTimer()

  try {
    for (const q of currentQuestions.value) {
      if (!q.answered) {
        const answer = playerAnswers.value[q.itemId]
        if (answer != null) {
          const dur = Math.max(1, Math.round(playerTimer.value / currentQuestions.value.length))
          await practiceStore.answerQuestion(
            practiceStore.currentSession.id, q.itemId, profileStore.activeCourseId!,
            q.questionId, answer, dur,
          ).catch(() => {})
        }
      }
    }
    await practiceStore.completeSession(practiceStore.currentSession.id)
    await practiceStore.fetchSession(practiceStore.currentSession.id)
    playerPhase.value = 'result'
    evaluationText.value = practiceStore.currentSession?.evaluation || ''
  } catch (e: any) {
    ElMessage.error(e.message || '提交失败')
    playerPhase.value = 'answering'
  }
}

function triggerEvaluation() {
  if (!practiceStore.currentSession || evaluationLoading.value) return
  evaluationText.value = ''
  evaluationLoading.value = true
  evaluationError.value = ''
  practiceStore.streamEvaluation(
    practiceStore.currentSession.id,
    (chunk) => { evaluationText.value += chunk },
    (msg) => { evaluationError.value = msg; evaluationLoading.value = false },
  ).finally(() => {
    evaluationLoading.value = false
    practiceStore.fetchSession(practiceStore.currentSession!.id).then(session => {
      if (session?.evaluation) {
        evaluationText.value = session.evaluation
      }
    })
  })
}

function handlePlayerRetry() {
  playerAnswers.value = {}
  playerCurrentIdx.value = 0
  playerPhase.value = 'answering'
  playerTimer.value = 0
  markedPlayerQuestions.value = new Set()
  evaluationText.value = ''
  evaluationLoading.value = false
  evaluationError.value = ''
  currentQuestions.value.forEach(q => { q.answered = false; q.isCorrect = undefined; q.userAnswer = undefined })
  startPlayerTimer()
}

function handlePlayerReview() {
  playerPhase.value = 'review'
  playerCurrentIdx.value = 0
}

function handlePlayerComplete() {
  playerPhase.value = 'result'
}

function toggleMarkQuestion(index: number) {
  const s = new Set(markedPlayerQuestions.value)
  if (s.has(index)) s.delete(index)
  else s.add(index)
  markedPlayerQuestions.value = s
}

function startPlayerTimer() {
  playerTimer.value = 0
  playerTimerHandle = setInterval(() => { playerTimer.value++ }, 1000)
}

function stopPlayerTimer() {
  if (playerTimerHandle) { clearInterval(playerTimerHandle); playerTimerHandle = null }
}

// ===== 启动练习 =====
async function startPractice() {
  const courseId = profileStore.activeCourseId
  if (!courseId) { ElMessage.warning('请先选择课程'); return }
  if (selectedMode.value === 'kp_focus' && selectedKpIds.value.length === 0) {
    ElMessage.warning('请至少选择一个知识点'); return
  }
  if (selectedMode.value !== 'weak_point' && totalCount.value === 0) {
    ElMessage.warning('请至少设置一道题'); return
  }
  const isWeakPoint = selectedMode.value === 'weak_point'
  const expectedCount = isWeakPoint ? questionCount.value : totalCount.value
  try {
    const session = isWeakPoint
      ? await practiceStore.aiGenerate(courseId, { count: questionCount.value, focus: 'weak_point' })
      : await practiceStore.createSession(courseId, {
          sessionType: selectedMode.value,
          kpIds: selectedMode.value === 'kp_focus' ? selectedKpIds.value : undefined,
          typeCounts: typeCounts.value,
        })
    if (session && session.questions.length > 0) {
      beginSession(session.questions)
      // 合并提示：题量不足 + AI 新生成数量
      const messages: string[] = []
      if (session.questions.length < expectedCount) {
        if (isWeakPoint) {
          messages.push(`AI 组卷实际生成 ${session.questions.length} 题（期望 ${expectedCount} 题）`)
        } else {
          messages.push(`题库中符合条件的题目不足，本次练习共 ${session.questions.length} 题`)
        }
      } else if (isWeakPoint) {
        messages.push('AI 组卷完成')
      }
      if (session.aiGeneratedCount) messages.push(`其中 AI 新生成 ${session.aiGeneratedCount} 题`)
      if (messages.length > 0) ElMessage.info(messages.join('，'))
    } else {
      ElMessage.warning('没有符合条件的题目')
    }
  } catch (e: any) { ElMessage.error(e.message || '创建练习失败') }
}

function beginSession(questions: SessionQuestion[]) {
  currentQuestions.value = questions
  playerCurrentIdx.value = 0
  playerAnswers.value = {}
  playerPhase.value = 'answering'
  playerTimer.value = 0
  markedPlayerQuestions.value = new Set()
  evaluationText.value = ''
  evaluationLoading.value = false
  evaluationError.value = ''
  phase.value = 'answering'
  startPlayerTimer()
}

async function viewHistorySession(id: string) {
  showHistory.value = false
  stopPlayerTimer()
  const session = await practiceStore.fetchSession(id)
  if (session) {
    currentQuestions.value = session.questions
    const recovered: Record<string, string> = {}
    session.questions.forEach(q => { if (q.userAnswer != null) recovered[q.itemId] = String(q.userAnswer) })
    playerAnswers.value = recovered
    playerCurrentIdx.value = 0
    playerTimer.value = session.totalDurationSeconds || 0
    evaluationLoading.value = false
    evaluationError.value = ''
    if (session.completed) {
      phase.value = 'result'
      playerPhase.value = 'result'
      evaluationText.value = session.evaluation || ''
    } else {
      phase.value = 'answering'
      playerPhase.value = 'answering'
      evaluationText.value = ''
      startPlayerTimer()
    }
  }
}

async function backToSelect() {
  if (phase.value === 'answering') {
    try {
      await ElMessageBox.confirm('当前答题进度将丢失，确定要离开吗？', '离开练习', {
        confirmButtonText: '离开', cancelButtonText: '继续答题', type: 'warning',
        confirmButtonClass: 'el-button--danger',
      })
    } catch { return }
  }
  stopPlayerTimer()
  phase.value = 'select'
  currentQuestions.value = []
  playerAnswers.value = {}
  playerCurrentIdx.value = 0
  playerTimer.value = 0
  evaluationText.value = ''
  evaluationLoading.value = false
  evaluationError.value = ''
  practiceStore.currentSession = null
  playerPhase.value = 'answering'
  if (profileStore.activeCourseId) {
    practiceStore.fetchStats(profileStore.activeCourseId)
    practiceStore.fetchSessions(profileStore.activeCourseId)
  }
}

function sessionTypeLabel(t: string) {
  return { random: '随机', weak_point: 'AI组卷', wrong_review: '错题重做', kp_focus: '知识点', custom: '手动' }[t] || t
}

function startWrongReview() {
  selectedMode.value = 'wrong_review'
  startPractice()
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function accuracyColor(rate?: number) {
  if (rate == null) return ''
  if (rate >= 0.8) return 'pm-stats__value--good'
  if (rate >= 0.6) return 'pm-stats__value--ok'
  return 'pm-stats__value--bad'
}

onMounted(async () => {
  if (route.query.mode) selectedMode.value = route.query.mode as string
  if (profileStore.activeCourseId) {
    practiceStore.fetchSessions(profileStore.activeCourseId)
    practiceStore.fetchStats(profileStore.activeCourseId)
  }
  // 从题库勾选跳转：自动创建 custom 会话并进入做题
  const qIds = route.query.questionIds
  if (typeof qIds === 'string' && qIds.length > 0) {
    const ids = qIds.split(',').filter(Boolean)
    if (ids.length > 0) {
      router.replace({ path: '/practice' })
      await startCustomPractice(ids)
    }
  }
})

async function startCustomPractice(questionIds: string[]) {
  const courseId = profileStore.activeCourseId
  if (!courseId) { ElMessage.warning('请先选择课程'); return }
  try {
    const session = await practiceStore.createSession(courseId, {
      sessionType: 'custom',
      questionIds,
    })
    if (session && session.questions.length > 0) {
      if (session.questions.length < questionIds.length) {
        ElMessage.info(`部分题目不可用，本次练习共 ${session.questions.length} 题`)
      }
      beginSession(session.questions)
    } else {
      ElMessage.warning('所选题目无法创建练习')
    }
  } catch (e: any) { ElMessage.error(e.message || '创建练习失败') }
}

watch(() => profileStore.activeCourseId, (cid) => {
  if (cid) {
    practiceStore.fetchSessions(cid)
    practiceStore.fetchStats(cid)
  }
})
</script>

<template>
  <div class="m-practice">
    <!-- ===== 阶段 1：选择 ===== -->
    <transition name="phase" mode="out-in">
    <div v-if="phase === 'select'" key="select" class="m-phase">
      <div class="m-practice-header">
        <h2>练习中心</h2>
        <el-button text size="small" @click="showHistory = true">
          <el-icon class="mr-1"><Clock /></el-icon>记录
        </el-button>
      </div>

      <div class="pm-stats">
        <div class="pm-stats__item">
          <el-icon :size="20" class="pm-stats__icon"><Edit /></el-icon>
          <div class="pm-stats__value">{{ practiceStore.stats?.totalAnswered ?? '--' }}</div>
          <div class="pm-stats__label">累计刷题</div>
        </div>
        <div class="pm-stats__item">
          <el-icon :size="20" class="pm-stats__icon"><Aim /></el-icon>
          <div class="pm-stats__value" :class="accuracyColor(practiceStore.stats?.avgAccuracy)">
            {{ practiceStore.stats ? (practiceStore.stats.avgAccuracy * 100).toFixed(0) + '%' : '--' }}
          </div>
          <div class="pm-stats__label">平均正确率</div>
        </div>
        <div class="pm-stats__item">
          <el-icon :size="20" class="pm-stats__icon pm-stats__icon--streak"><MagicStick /></el-icon>
          <div class="pm-stats__value" :class="{ 'pm-stats__value--streak': (practiceStore.stats?.currentStreak ?? 0) > 0 }">
            {{ practiceStore.stats?.currentStreak ?? '--' }}
          </div>
          <div class="pm-stats__label">连续天数</div>
        </div>
        <div class="pm-stats__item pm-stats__item--clickable" @click="practiceStore.stats && practiceStore.stats.wrongQuestionCount > 0 && startWrongReview()">
          <el-icon :size="20" class="pm-stats__icon pm-stats__icon--wrong"><CircleClose /></el-icon>
          <div class="pm-stats__value pm-stats__value--wrong">{{ practiceStore.stats?.wrongQuestionCount ?? '--' }}</div>
          <div class="pm-stats__label">待复习</div>
        </div>
      </div>

      <div class="m-modes">
        <button
          v-for="mode in modes"
          :key="mode.key"
          type="button"
          class="m-mode-card"
          :class="{ 'm-mode-card--active': selectedMode === mode.key }"
          :aria-pressed="selectedMode === mode.key"
          @click="selectedMode = mode.key"
        >
          <div class="m-mode-card__icon" :style="{ background: mode.bg, color: mode.color }">
            <el-icon :size="22"><component :is="mode.icon" /></el-icon>
          </div>
          <div class="m-mode-card__info">
            <div class="m-mode-card__name">{{ mode.name }}</div>
            <div class="m-mode-card__desc">{{ mode.desc }}</div>
          </div>
        </button>
      </div>

      <div v-if="selectedMode === 'weak_point'" class="m-filters">
        <label class="m-filter-label">题量</label>
        <div class="m-count-group">
          <button v-for="n in [5, 10, 20]" :key="n" class="m-count-btn" :class="{ 'm-count-btn--active': questionCount === n }" @click="questionCount = n">{{ n }} 题</button>
        </div>
      </div>
      <div v-else class="m-filters">
        <div v-if="selectedMode === 'kp_focus'" class="m-kp-block">
          <label class="m-filter-label">知识点</label>
          <el-select
            v-model="selectedKpIds"
            multiple
            collapse-tags
            collapse-tags-tooltip
            filterable
            placeholder="选择知识点（可多选）"
            class="m-kp-select"
          >
            <el-option
              v-for="kp in kpAccuracyList"
              :key="kp.kpId"
              :label="kp.totalAttempts > 0 ? `${kp.kpName || kp.kpId.slice(0, 8)}（${kp.questionCount}题 · ${(kp.accuracyRate * 100).toFixed(0)}%）` : `${kp.kpName || kp.kpId.slice(0, 8)}（${kp.questionCount}题 · 未练习）`"
              :value="kp.kpId"
            />
          </el-select>
          <div v-if="kpAccuracyList.length === 0" class="m-kp-empty">暂无知识点数据，会随题库中带知识点的题目自动积累</div>
        </div>
        <label class="m-filter-label">题型与数量</label>
        <div class="m-type-presets">
          <button v-for="n in [5, 10, 20]" :key="n" class="m-type-preset-btn" @click="distributeCount(n)">{{ n }} 题均分</button>
        </div>
        <div class="m-type-grid">
          <div v-for="t in QUESTION_TYPES" :key="t.value" class="m-type-item">
            <span class="m-type-item__label">{{ t.label }}</span>
            <el-input-number v-model="typeCounts[t.value]" :min="0" :max="50" size="small" />
          </div>
        </div>
        <div class="m-type-total">共 {{ totalCount }} 题</div>
      </div>

      <div class="m-start">
        <el-button type="primary" size="large" round class="w-full" :loading="practiceStore.creating" :disabled="(selectedMode === 'kp_focus' && selectedKpIds.length === 0) || (selectedMode !== 'weak_point' && totalCount === 0)" @click="startPractice">
          {{ selectedMode === 'weak_point' ? 'AI 智能组卷' : `开始练习（${totalCount} 题）` }}
        </el-button>
      </div>
    </div>

    <!-- ===== 阶段 2+3：QuizPlayer ===== -->
    <div v-else-if="currentQuestions.length > 0" key="quiz" class="m-quiz-wrapper">
      <!-- Mobile top bar with exit -->
      <div class="m-quiz-topbar">
        <button class="m-exit-btn" aria-label="退出练习" @click="backToSelect">
          <el-icon :size="18"><Close /></el-icon>
        </button>
        <span class="m-quiz-topbar-title">
          {{ playerPhase === 'result' ? '练习报告' : `答题中 ${Object.keys(playerAnswers).length}/${currentQuestions.length}` }}
        </span>
        <span class="m-quiz-topbar-spacer"></span>
      </div>

      <QuizPlayer
        :questions="playerQuestions"
        :answers="playerAnswers"
        v-model:currentIndex="playerCurrentIdx"
        :phase="playerPhase"
        :result="playerResult"
        :timerSeconds="playerTimer"
        :markedQuestions="markedPlayerQuestions"
        submitMode="batch"
        :showSidebar="false"
        :showBackground="false"
        :showResultActions="false"
        :fullWidth="playerFullWidth"
        :evaluationText="evaluationText"
        :evaluationLoading="evaluationLoading"
        :evaluationError="evaluationError"
        @update:fullWidth="v => playerFullWidth = v"
        @select-answer="handlePlayerSelectAnswer"
        @submit="handlePlayerSubmit"
        @retry="handlePlayerRetry"
        @review="handlePlayerReview"
        @complete="handlePlayerComplete"
        @toggle-mark="toggleMarkQuestion"
      />

      <!-- Mobile AI 评估触发 -->
      <div v-if="playerPhase === 'result' && !evaluationText && !evaluationLoading" class="m-eval-trigger">
        <el-button type="primary" round size="small" @click="triggerEvaluation">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" class="mr-1">
            <path d="M8 1l1.6 3.8L13.5 6 9.6 8.2 8 12l-1.6-3.8L2.5 6l3.9-1.2L8 1z" fill="currentColor"/>
          </svg>
          AI 智能评估
        </el-button>
      </div>
      <!-- Mobile actions for result -->
      <div v-if="playerPhase === 'result'" class="m-result-actions">
        <el-button type="primary" round @click="handlePlayerReview" size="small">查看错题</el-button>
        <el-button round @click="handlePlayerRetry" size="small">再来一组</el-button>
        <el-button round @click="showExportDialog = true" size="small">
          <el-icon class="mr-1"><Download /></el-icon>导出
        </el-button>
        <el-button type="primary" round @click="backToSelect" size="small">切换模式</el-button>
      </div>
    </div>
    </transition>

    <!-- ===== 历史记录 BottomSheet ===== -->
    <el-drawer v-model="showHistory" title="练习记录" direction="btt" size="60%" append-to-body>
      <div v-if="practiceStore.sessions.length === 0" class="m-history-empty">暂无记录</div>
      <div v-else class="m-history-list">
        <div v-for="s in practiceStore.sessions" :key="s.id" class="m-history-item" @click="viewHistorySession(s.id)">
          <div class="m-history-item__top">
            <span class="m-type-tag m-tag--kp_focus">{{ sessionTypeLabel(s.sessionType) }}</span>
            <span class="m-history-item__accuracy" :class="accuracyColor(s.accuracyRate)">{{ (s.accuracyRate * 100).toFixed(0) }}%</span>
          </div>
          <div class="m-history-item__meta">{{ s.correctCount }}/{{ s.questionCount }} · {{ formatTime(s.createdAt) }}</div>
        </div>
      </div>
    </el-drawer>

    <ExportPracticeDialog v-model="showExportDialog" :session="practiceStore.currentSession" />

    <!-- 智能辅导 -->
    <TutoringDrawer
      :visible="showTutoringDrawer"
      :course-id="profileStore.activeCourseId"
      @close="handleTutoringClose"
    />
    <FloatingFab v-if="showTutoringFab" :class="{ 'fab-raised': playerPhase === 'result' }" @click="handleFabClick" />

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
.m-practice { padding: 16px; background: var(--lt-bg-page); min-height: 100%; padding-bottom: calc(16px + env(safe-area-inset-bottom)); }

.m-practice-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.m-practice-header h2 { font-size: 20px; font-weight: 700; color: var(--lt-text-primary); margin: 0; }

.pm-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px; }
.pm-stats__item {
  display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 16px 12px;
  background: var(--lt-bg-card); border-radius: var(--lt-radius-lg); box-shadow: var(--lt-shadow-card);
}
.pm-stats__item--clickable { cursor: pointer; }
.pm-stats__icon { color: var(--lt-brand); }
.pm-stats__icon--streak { color: var(--lt-orange); }
.pm-stats__icon--wrong { color: var(--lt-danger); }
.pm-stats__value { font-size: 22px; font-weight: 700; color: var(--lt-text-primary); }
.pm-stats__value--good { color: var(--lt-success); }
.pm-stats__value--ok { color: var(--lt-warning); }
.pm-stats__value--bad { color: var(--lt-danger); }
.pm-stats__value--streak { color: var(--lt-orange); }
.pm-stats__value--wrong { color: var(--lt-danger); }
.pm-stats__label { font-size: 12px; color: var(--lt-text-secondary); }

.m-modes { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
.m-mode-card {
  display: flex; align-items: center; gap: 14px; width: 100%; padding: 16px;
  font: inherit; color: inherit; text-align: left; background: var(--lt-bg-card);
  border-radius: var(--lt-radius-lg); border: 2px solid transparent; box-shadow: var(--lt-shadow-card);
  transition: border-color var(--lt-transition-smooth);
}
.m-mode-card--active { border-color: var(--lt-brand); }
.m-mode-card__icon { width: 48px; height: 48px; border-radius: var(--lt-radius-md); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.m-mode-card__name { font-size: 15px; font-weight: 600; color: var(--lt-text-primary); }
.m-mode-card__desc { font-size: 12px; color: var(--lt-text-secondary); margin-top: 2px; }

.m-filters { margin-bottom: 20px; }
.m-filter-label { font-size: 13px; color: var(--lt-text-secondary); display: block; margin-bottom: 8px; }
.m-kp-block { margin-bottom: 16px; }
.m-kp-select { width: 100%; }
.m-kp-empty { font-size: 12px; color: var(--lt-text-placeholder); margin-top: 6px; }
.m-count-group { display: flex; gap: 8px; }
.m-count-btn {
  flex: 1; min-height: 44px; padding: 10px; display: flex; align-items: center; justify-content: center;
  border-radius: var(--lt-radius-md); border: 1px solid var(--lt-border); background: var(--lt-bg-card);
  color: var(--lt-text-secondary); font-size: 14px; cursor: pointer;
  transition: border-color var(--lt-transition-smooth), background-color var(--lt-transition-smooth), color var(--lt-transition-smooth), transform var(--lt-transition-base);
}
.m-count-btn:active { transform: scale(0.96); }
.m-count-btn--active { border-color: var(--lt-brand); background: var(--lt-brand-lightest); color: var(--lt-brand); font-weight: 600; }

.m-type-presets { display: flex; gap: 8px; margin-bottom: 12px; }
.m-type-preset-btn { flex: 1; min-height: 36px; padding: 6px; border-radius: var(--lt-radius-md); border: 1px solid var(--lt-border); background: var(--lt-bg-card); color: var(--lt-text-secondary); font-size: 13px; cursor: pointer; transition: border-color var(--lt-transition-smooth), background-color var(--lt-transition-smooth); }
.m-type-preset-btn:active { transform: scale(0.96); }
.m-type-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.m-type-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.m-type-item__label { font-size: 14px; color: var(--lt-text-primary); white-space: nowrap; }
.m-type-total { font-size: 13px; color: var(--lt-text-secondary); margin-top: 8px; }
.m-start { margin-top: 24px; }

/* Quiz wrapper */
.m-quiz-wrapper { margin: -16px; background: var(--lt-bg-page); min-height: calc(100vh - 16px); }
.m-quiz-topbar {
  display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;
  background: var(--lt-bg-card); border-bottom: 1px solid var(--lt-border); position: sticky; top: 0; z-index: 20;
}
.m-quiz-topbar-title { font-size: 14px; font-weight: 600; color: var(--lt-text-primary); }
.m-quiz-topbar-spacer { width: 44px; }
.m-exit-btn {
  width: 44px; height: 44px; border-radius: var(--lt-radius-md); border: 1px solid var(--lt-border);
  background: var(--lt-bg-card); color: var(--lt-text-secondary); display: flex; align-items: center; justify-content: center;
  cursor: pointer; flex-shrink: 0; transition: border-color var(--lt-transition-smooth), background-color var(--lt-transition-smooth), color var(--lt-transition-smooth), transform var(--lt-transition-base);
}
.m-exit-btn:active { color: var(--lt-danger); border-color: var(--lt-danger); transform: scale(0.94); }

.m-eval-trigger { display: flex; justify-content: center; padding: 12px 16px 4px; }
.m-result-actions { display: flex; justify-content: center; gap: 10px; padding: 16px; position: sticky; bottom: 0; background: var(--lt-bg-page); z-index: 10; flex-wrap: wrap; }
.m-type-tag { font-size: 11px; padding: 2px 8px; border-radius: var(--lt-radius-sm); font-weight: 500; display: inline-block; }
.m-tag--kp_focus { background: var(--lt-brand-lightest); color: var(--lt-brand); }
.m-history-item__accuracy { font-weight: 600; }

/* 历史 */
.m-history-empty { text-align: center; padding: 40px; color: var(--lt-text-auxiliary); }
.m-history-list { display: flex; flex-direction: column; gap: 10px; }
.m-history-item { padding: 14px; background: var(--lt-bg-page); border-radius: var(--lt-radius-md); cursor: pointer; }
.m-history-item__top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.m-history-item__meta { font-size: 12px; color: var(--lt-text-secondary); }

.phase-enter-active, .phase-leave-active { transition: opacity 220ms ease, transform 220ms ease; }
.phase-enter-from { opacity: 0; transform: translateY(10px); }
.phase-leave-to { opacity: 0; transform: translateY(-10px); }

/* 结果页 FAB 上移，避开底部操作栏 */
.fab-raised { bottom: 100px !important; }
.learning-away-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 2000; backdrop-filter: blur(4px);
}
.learning-away-card {
  background: var(--lt-bg-card); border-radius: 16px;
  padding: 32px 48px; text-align: center;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
