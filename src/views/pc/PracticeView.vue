<template>
  <div class="practice-view h-full flex flex-col overflow-hidden">
    <!-- ==================== TopBar ==================== -->
    <div class="practice-topbar">
      <div class="practice-topbar__left">
        <h2 class="practice-topbar__title">练习中心</h2>
        <span class="practice-topbar__subtitle">{{ topbarSubtitle }}</span>
      </div>
      <div class="practice-topbar__right">
        <el-button v-if="phase !== 'select'" text @click="backToSelect">返回选择</el-button>
        <el-button v-if="phase === 'select'" @click="showHistory = !showHistory">
          <el-icon class="mr-1"><Clock /></el-icon>
          练习记录
        </el-button>
      </div>
    </div>

    <!-- ==================== 主体 ==================== -->
    <div class="practice-body flex-1 overflow-y-auto">
      <transition name="phase" mode="out-in">
      <!-- ===== 阶段 1：模式选择 + 筛选 ===== -->
      <div v-if="phase === 'select'" key="select" class="practice-select">
        <!-- 核心数据统计条 -->
        <div class="practice-stats">
          <div class="practice-stats__item">
            <el-icon :size="24" class="practice-stats__icon"><Edit /></el-icon>
            <div class="practice-stats__value">{{ practiceStore.stats?.totalAnswered ?? '--' }}</div>
            <div class="practice-stats__label">累计刷题</div>
          </div>
          <div class="practice-stats__item">
            <el-icon :size="24" class="practice-stats__icon"><Aim /></el-icon>
            <div class="practice-stats__value" :class="accuracyColor(practiceStore.stats?.avgAccuracy)">
              {{ practiceStore.stats ? (practiceStore.stats.avgAccuracy * 100).toFixed(0) + '%' : '--' }}
            </div>
            <div class="practice-stats__label">平均正确率</div>
          </div>
          <div class="practice-stats__item">
            <el-icon :size="24" class="practice-stats__icon practice-stats__icon--streak"><MagicStick /></el-icon>
            <div class="practice-stats__value" :class="{ 'practice-stats__value--streak': (practiceStore.stats?.currentStreak ?? 0) > 0 }">
              {{ practiceStore.stats?.currentStreak ?? '--' }}
            </div>
            <div class="practice-stats__label">连续练习天数</div>
          </div>
          <div
            class="practice-stats__item practice-stats__item--clickable"
            @click="practiceStore.stats && practiceStore.stats.wrongQuestionCount > 0 && startWrongReview()"
          >
            <el-icon :size="24" class="practice-stats__icon practice-stats__icon--wrong"><CircleClose /></el-icon>
            <div class="practice-stats__value practice-stats__value--wrong">
              {{ practiceStore.stats?.wrongQuestionCount ?? '--' }}
            </div>
            <div class="practice-stats__label">待复习错题</div>
          </div>
        </div>

        <!-- 模式卡片 -->
        <div class="practice-modes">
          <button
            v-for="mode in modes"
            :key="mode.key"
            type="button"
            class="practice-mode-card card-elevated"
            :class="{ 'practice-mode-card--active': selectedMode === mode.key }"
            :aria-pressed="selectedMode === mode.key"
            @click="selectedMode = mode.key"
          >
            <div class="practice-mode-card__icon" :style="{ background: mode.bg, color: mode.color }">
              <el-icon :size="28"><component :is="mode.icon" /></el-icon>
            </div>
            <div class="practice-mode-card__info">
              <div class="practice-mode-card__name">{{ mode.name }}</div>
              <div class="practice-mode-card__desc">{{ mode.desc }}</div>
            </div>
          </button>
        </div>

        <!-- 筛选区（AI 组卷模式隐藏） -->
        <div v-if="selectedMode !== 'weak_point'" class="practice-filters card-elevated">
          <div class="practice-filters__title">练习设置</div>
          <div class="practice-filters__grid">
            <!-- 知识点选择（仅 kp_focus） -->
            <div v-if="selectedMode === 'kp_focus'" class="practice-filter practice-filter--full">
              <label class="practice-filter__label">知识点</label>
              <el-select
                v-model="selectedKpIds"
                multiple
                collapse-tags
                collapse-tags-tooltip
                filterable
                placeholder="选择知识点专项练习（可多选）"
                class="w-full"
              >
                <el-option
                  v-for="kp in kpAccuracyList"
                  :key="kp.kpId"
                  :label="kp.totalAttempts > 0 ? `${kp.kpName || kp.kpId.slice(0, 8)}（${kp.questionCount}题 · 正确率 ${(kp.accuracyRate * 100).toFixed(0)}%）` : `${kp.kpName || kp.kpId.slice(0, 8)}（${kp.questionCount}题 · 未练习）`"
                  :value="kp.kpId"
                />
              </el-select>
              <div v-if="kpAccuracyList.length === 0" class="practice-kp-empty">
                暂无知识点数据，知识点会随题库中带知识点的题目自动积累
              </div>
            </div>
            <div class="practice-filter practice-filter--full">
              <label class="practice-filter__label">题型与数量</label>
              <div class="practice-type-setup">
                <div class="practice-type-setup__presets">
                  <el-button v-for="n in [5, 10, 20]" :key="n" size="small" round @click="distributeCount(n)">{{ n }} 题均分</el-button>
                </div>
                <div class="practice-type-setup__grid">
                  <div v-for="t in QUESTION_TYPES" :key="t.value" class="practice-type-setup__item">
                    <span class="practice-type-setup__label">{{ t.label }}</span>
                    <el-input-number v-model="typeCounts[t.value]" :min="0" :max="50" size="small" />
                  </div>
                </div>
                <div class="practice-type-setup__total">共 {{ totalCount }} 题</div>
              </div>
            </div>
            <div class="practice-filter">
              <label class="practice-filter__label">难度</label>
              <el-select v-model="difficulty" placeholder="不限" clearable class="w-32">
                <el-option label="★☆☆☆☆ 入门" :value="1" />
                <el-option label="★★☆☆☆ 基础" :value="2" />
                <el-option label="★★★☆☆ 进阶" :value="3" />
                <el-option label="★★★★☆ 挑战" :value="4" />
                <el-option label="★★★★★ 困难" :value="5" />
              </el-select>
            </div>
          </div>
          <div class="practice-filters__actions">
            <el-button type="primary" size="large" round :loading="practiceStore.creating" :disabled="(selectedMode === 'kp_focus' && selectedKpIds.length === 0) || totalCount === 0" @click="startPractice">
              开始练习（{{ totalCount }} 题）
            </el-button>
          </div>
        </div>

        <!-- AI 组卷说明 -->
        <div v-else class="practice-filters card-elevated">
          <div class="practice-filters__title">AI 智能组卷</div>
          <p class="practice-ai-desc">
            基于你的学习画像薄弱知识点，AI 将自动从题库抽题；若题库题量不足，AI 会即时生成新题补足。以下参数可选填，留空则由 AI 自动决策。
          </p>
          <div class="practice-filters__grid">
            <div class="practice-filter">
              <label class="practice-filter__label">题量</label>
              <el-input-number v-model="aiQuestionCount" :min="1" :max="100" placeholder="自动" size="small" controls-position="right" class="w-32" />
            </div>
            <div class="practice-filter">
              <label class="practice-filter__label">难度</label>
              <el-select v-model="aiDifficulty" placeholder="自动" clearable size="small" class="w-32">
                <el-option label="★☆☆☆☆ 入门" :value="1" />
                <el-option label="★★☆☆☆ 基础" :value="2" />
                <el-option label="★★★☆☆ 进阶" :value="3" />
                <el-option label="★★★★☆ 挑战" :value="4" />
                <el-option label="★★★★★ 困难" :value="5" />
              </el-select>
            </div>
            <div class="practice-filter">
              <label class="practice-filter__label">题型</label>
              <el-checkbox-group v-model="aiSelectedTypes">
                <el-checkbox v-for="t in QUESTION_TYPES" :key="t.value" :value="t.value" :label="t.label" size="small" />
              </el-checkbox-group>
            </div>
          </div>
          <div class="practice-filters__actions">
            <el-button type="primary" size="large" round :loading="practiceStore.creating" @click="startAiGenerate">
              <el-icon class="mr-1"><MagicStick /></el-icon>
              AI 智能组卷
            </el-button>
          </div>
        </div>

        <!-- 练习记录抽屉 -->
        <el-drawer v-model="showHistory" title="练习记录" size="560px" append-to-body>
          <div v-if="practiceStore.loading" class="practice-history-loading">
            <el-skeleton :rows="5" animated />
          </div>
          <div v-else-if="practiceStore.sessions.length === 0" class="practice-history-empty">
            暂无练习记录
          </div>
          <div v-else class="practice-history-list">
            <div
              v-for="s in practiceStore.sessions"
              :key="s.id"
              class="practice-history-item card-elevated"
              @click="viewHistorySession(s.id)"
            >
              <div class="practice-history-item__header">
                <span class="practice-history-item__type" :class="`practice-tag--${s.sessionType}`">
                  {{ sessionTypeLabel(s.sessionType) }}
                </span>
                <span class="practice-history-item__accuracy" :class="accuracyClass(s.accuracyRate)">
                  {{ (s.accuracyRate * 100).toFixed(0) }}%
                </span>
              </div>
              <div class="practice-history-item__meta">
                <span>{{ s.correctCount }}/{{ s.questionCount }} 题</span>
                <span>{{ formatTime(s.createdAt) }}</span>
              </div>
            </div>
          </div>
        </el-drawer>
      </div>

      <!-- ===== 阶段 2+3：QuizPlayer（作答 + 结果） ===== -->
      <div v-else-if="currentQuestions.length > 0" key="quiz" class="practice-quiz-wrapper">
        <QuizPlayer
          :questions="playerQuestions"
          :answers="playerAnswers"
          v-model:currentIndex="playerCurrentIdx"
          :phase="playerPhase"
          :result="playerResult"
          :timerSeconds="playerTimer"
          :markedQuestions="markedPlayerQuestions"
          submitMode="batch"
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
          @ask-ai="handleQuestionAskAi"
        />
        <!-- AI 评估（用户手动触发） -->
        <div v-if="playerPhase === 'result' && !evaluationText && !evaluationLoading" class="practice-eval-trigger">
          <el-button type="primary" round @click="triggerEvaluation">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="mr-1">
              <path d="M8 1l1.6 3.8L13.5 6 9.6 8.2 8 12l-1.6-3.8L2.5 6l3.9-1.2L8 1z" fill="currentColor"/>
            </svg>
            AI 智能评估
          </el-button>
        </div>
        <!-- 结果页操作按钮 -->
        <div v-if="playerPhase === 'result'" class="practice-result-actions">
          <el-button type="primary" round @click="handlePlayerReview">查看错题</el-button>
          <el-button round @click="handlePlayerRetry">再来一组</el-button>
          <el-button round @click="showExportDialog = true">
            <el-icon class="mr-1"><Download /></el-icon>
            导出试卷
          </el-button>
          <el-button type="primary" round @click="backToSelect">切换模式</el-button>
        </div>
      </div>
      </transition>
    </div>

    <!-- 导出对话框 -->
    <ExportPracticeDialog v-model="showExportDialog" :session="practiceStore.currentSession" />

    <!-- 智能辅导 -->
    <TutoringDrawer
      :visible="showTutoringDrawer"
      :question-ref="questionRef"
      :course-id="profileStore.activeCourseId"
      @close="handleTutoringClose"
      @dismiss-question-ref="handleDismissQuestionRef"
    />
    <FloatingFab v-if="showTutoringFab" @click="handleFabClick" />

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

<script setup lang="ts">
import { ref, computed, onMounted, watch, markRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Clock, MagicStick, Edit, Aim, RefreshRight, CircleClose, Download } from '@element-plus/icons-vue'
import QuizPlayer from '@/components/learn/QuizPlayer.vue'
import ExportPracticeDialog from '@/components/ExportPracticeDialog.vue'
import FloatingFab from '@/components/tutoring/FloatingFab.vue'
import TutoringDrawer from '@/components/tutoring/TutoringDrawer.vue'
import { usePracticeStore } from '@/stores/practice'
import { useProfileStore } from '@/stores/profile'
import { useQuestionBankStore } from '@/stores/questionBank'
import { useLearningTracker } from '@/composables/useLearningTracker'
import type { SessionQuestion, PlayerQuestion, PlayerResult, KpAccuracy, QuestionRef } from '@/types'

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

// ===== 模式选择 =====
const modes = [
  { key: 'kp_focus', name: '知识点练习', desc: '按知识点抽题，专项突破', icon: markRaw(Aim), color: 'var(--lt-brand)', bg: 'var(--lt-brand-lightest)' },
  { key: 'random', name: '随机练习', desc: '全库随机抽题，综合测验', icon: markRaw(RefreshRight), color: 'var(--lt-ai)', bg: 'var(--lt-ai-light-9)' },
  { key: 'wrong_review', name: '错题重做', desc: '重做错过的题，查漏补缺', icon: markRaw(Edit), color: 'var(--lt-orange)', bg: 'var(--lt-orange-light-9)' },
  { key: 'weak_point', name: 'AI 智能组卷', desc: '基于薄弱点 AI 自动组卷', icon: markRaw(MagicStick), color: 'var(--lt-ai)', bg: 'var(--lt-ai-light-9)' },
]
const selectedMode = ref('kp_focus')
const difficulty = ref<number | undefined>(undefined)
const aiQuestionCount = ref<number | undefined>(undefined)
const aiSelectedTypes = ref<string[]>([])
const aiDifficulty = ref<number | undefined>(undefined)

// 知识点练习：选中的知识点（仅 kp_focus 模式使用）
const selectedKpIds = ref<string[]>([])
const kpAccuracyList = computed<KpAccuracy[]>(() => questionBankStore.kpAccuracyList)

const QUESTION_TYPES = [
  { value: 'single_choice', label: '单选题' },
  { value: 'multiple_choice', label: '多选题' },
  { value: 'true_false', label: '判断题' },
  { value: 'fill_blank', label: '填空题' },
  { value: 'essay', label: '简答题' },
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

// ===== QuizPlayer 状态 =====
const currentQuestions = ref<SessionQuestion[]>([])
const playerCurrentIdx = ref(0)
const playerAnswers = ref<Record<string, string>>({})
const playerPhase = ref<'loading' | 'answering' | 'submitting' | 'result' | 'review'>('answering')
const playerTimer = ref(0)
let playerTimerHandle: ReturnType<typeof setInterval> | null = null
const playerFullWidth = ref(false)
const markedPlayerQuestions = ref<Set<number>>(new Set())

// ===== 评估 =====
const evaluationText = ref('')
const evaluationLoading = ref(false)
const evaluationError = ref('')

// ===== 智能辅导 =====
const showTutoringDrawer = ref(false)
const questionRef = ref<QuestionRef | null>(null)
const showTutoringFab = true
function handleFabClick() {
  if (!showTutoringDrawer.value) {
    questionRef.value = null
  }
  showTutoringDrawer.value = !showTutoringDrawer.value
}
function handleTutoringClose() {
  showTutoringDrawer.value = false
  questionRef.value = null
}
function handleQuestionAskAi(_questionId: string, data: QuestionRef) {
  questionRef.value = data
  showTutoringDrawer.value = true
}
function handleDismissQuestionRef() {
  questionRef.value = null
}

// ===== 类型映射 =====
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

// ===== PlayerQuestion 适配 =====
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

// ===== PlayerResult 适配 =====
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

// ===== TopBar =====
const topbarSubtitle = computed(() => {
  if (phase.value === 'select') return '选择模式开始刷题'
  if (phase.value === 'answering') return practiceStore.currentSession?.completed ? '回看作答情况' : '回答所有题目后提交'
  return '练习报告'
})

// ===== QuizPlayer 事件处理 =====
function handlePlayerSelectAnswer(questionId: string, answer: string) {
  playerAnswers.value[questionId] = answer
}

async function handlePlayerSubmit() {
  if (!practiceStore.currentSession) return

  playerPhase.value = 'submitting'
  stopPlayerTimer()

  try {
    // 逐个提交答案
    for (const q of currentQuestions.value) {
      if (!q.answered) {
        const answer = playerAnswers.value[q.itemId]
        if (answer != null) {
          const dur = Math.max(1, Math.round(playerTimer.value / currentQuestions.value.length))
          await practiceStore.answerQuestion(
            practiceStore.currentSession.id, q.itemId, profileStore.activeCourseId!,
            q.questionId, answer, dur,
          ).catch(() => { /* 单个题目提交失败不中断整体流程 */ })
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
    // 流式完成后重新从后端拉取已持久化的评估内容，覆盖流式拼接结果
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
  // 重置会话题目状态
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

// ===== 计时器 =====
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
  if (totalCount.value === 0) { ElMessage.warning('请至少设置一道题'); return }
  try {
    const session = await practiceStore.createSession(courseId, {
      sessionType: selectedMode.value,
      kpIds: selectedMode.value === 'kp_focus' ? selectedKpIds.value : undefined,
      difficulty: difficulty.value,
      typeCounts: typeCounts.value,
    })
    if (session && session.questions.length > 0) {
      if (session.questions.length < totalCount.value) {
        ElMessage.info(`题库中符合条件的题目不足，本次练习共 ${session.questions.length} 题`)
      }
      beginSession(session.questions)
    } else {
      ElMessage.warning('没有符合条件的题目，请先在题库中添加题目')
    }
  } catch (e: any) {
    ElMessage.error(e.message || '创建练习失败')
  }
}

async function startAiGenerate() {
  const courseId = profileStore.activeCourseId
  if (!courseId) { ElMessage.warning('请先选择课程'); return }
  const requestedCount = aiQuestionCount.value
  try {
    const params: Record<string, any> = { focus: 'weak_point' }
    if (aiQuestionCount.value) params.count = aiQuestionCount.value
    if (aiDifficulty.value) params.difficulty = aiDifficulty.value
    if (aiSelectedTypes.value.length > 0) params.types = aiSelectedTypes.value
    const session = await practiceStore.aiGenerate(courseId, params)
    if (session && session.questions.length > 0) {
      beginSession(session.questions)
      // 合并提示：题量不足 + AI 新生成数量
      const messages: string[] = []
      if (requestedCount && session.questions.length < requestedCount) {
        messages.push(`AI 组卷实际生成 ${session.questions.length} 题（期望 ${requestedCount} 题）`)
      } else {
        messages.push('AI 组卷完成')
      }
      if (session.aiGeneratedCount) {
        messages.push(`其中 AI 新生成 ${session.aiGeneratedCount} 题`)
      }
      if (messages.length > 0) ElMessage.info(messages.join('，'))
    } else {
      ElMessage.warning('AI 组卷失败，请稍后重试')
    }
  } catch (e: any) {
    ElMessage.error(e.message || 'AI 组卷失败')
  }
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

async function backToSelect() {
  if (phase.value === 'answering' && !practiceStore.currentSession?.completed) {
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

// ===== 历史 =====
async function viewHistorySession(id: string) {
  showHistory.value = false
  stopPlayerTimer()
  const session = await practiceStore.fetchSession(id)
  if (session) {
    currentQuestions.value = session.questions
    // 恢复之前的答案
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

// ===== 工具函数 =====
function sessionTypeLabel(type: string) {
  const map: Record<string, string> = {
    random: '随机', weak_point: 'AI组卷', wrong_review: '错题重做', kp_focus: '知识点', custom: '手动',
  }
  return map[type] || type
}

function accuracyClass(rate: number) {
  if (rate >= 0.8) return 'practice-accuracy--high'
  if (rate >= 0.6) return 'practice-accuracy--mid'
  return 'practice-accuracy--low'
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function accuracyColor(rate?: number) {
  if (rate == null) return ''
  if (rate >= 0.8) return 'practice-stats__value--good'
  if (rate >= 0.6) return 'practice-stats__value--ok'
  return 'practice-stats__value--bad'
}

function startWrongReview() {
  selectedMode.value = 'wrong_review'
  startPractice()
}

// ===== 初始化 =====
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
      // 清除 query，避免刷新重复创建会话
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
  } catch (e: any) {
    ElMessage.error(e.message || '创建练习失败')
  }
}

watch(() => profileStore.activeCourseId, (cid) => {
  if (cid) {
    practiceStore.fetchSessions(cid)
    practiceStore.fetchStats(cid)
  }
})
</script>

<style scoped>
.practice-view { background: var(--lt-bg-page); }

/* ===== TopBar ===== */
.practice-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 24px; background: var(--lt-bg-card);
  border-bottom: 1px solid var(--lt-border); flex-shrink: 0;
}
.practice-topbar__left { display: flex; align-items: baseline; gap: 12px; }
.practice-topbar__title { font-size: 20px; font-weight: 700; color: var(--lt-text-primary); margin: 0; }
.practice-topbar__subtitle { font-size: 13px; color: var(--lt-text-secondary); }
.practice-topbar__right { display: flex; gap: 8px; }

/* ===== 主体 ===== */
.practice-body { padding: 24px; }
.practice-quiz-wrapper { max-width: 100%; margin: 0 auto; }

/* ===== 统计条 ===== */
.practice-stats {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;
}
.practice-stats__item {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 20px 16px; background: var(--lt-bg-card);
  border-radius: var(--lt-radius-lg); box-shadow: var(--lt-shadow-card); text-align: center;
}
.practice-stats__item--clickable { cursor: pointer; transition: transform var(--lt-transition-base), box-shadow var(--lt-transition-base); }
.practice-stats__item--clickable:hover { transform: translateY(-2px); box-shadow: var(--lt-shadow-hover); }
.practice-stats__icon { color: var(--lt-brand); margin-bottom: 4px; }
.practice-stats__icon--streak { color: var(--lt-orange); }
.practice-stats__icon--wrong { color: var(--lt-danger); }
.practice-stats__value { font-size: 28px; font-weight: 700; color: var(--lt-text-primary); line-height: 1.2; }
.practice-stats__value--good { color: var(--lt-success); }
.practice-stats__value--ok { color: var(--lt-warning); }
.practice-stats__value--bad { color: var(--lt-danger); }
.practice-stats__value--streak { color: var(--lt-orange); }
.practice-stats__value--wrong { color: var(--lt-danger); }
.practice-stats__label { font-size: 13px; color: var(--lt-text-secondary); }
@media (max-width: 768px) { .practice-stats { grid-template-columns: repeat(2, 1fr); } }

/* ===== 模式选择 ===== */
.practice-modes {
  display: grid;   grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-bottom: 24px;
}
.practice-mode-card {
  display: flex; align-items: center; gap: 16px; width: 100%; padding: 20px;
  font: inherit; color: inherit; text-align: left; background: var(--lt-bg-card);
  border-radius: var(--lt-radius-lg); border: 2px solid transparent; cursor: pointer;
  transition: border-color var(--lt-transition-smooth), box-shadow var(--lt-transition-smooth), transform var(--lt-transition-base);
}
.practice-mode-card:hover { transform: translateY(-2px); box-shadow: var(--lt-shadow-hover); }
.practice-mode-card:active { transform: translateY(0) scale(0.99); }
.practice-mode-card--active { border-color: var(--lt-brand); }
.practice-mode-card__icon {
  width: 56px; height: 56px; border-radius: var(--lt-radius-md);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.practice-mode-card__name { font-size: 16px; font-weight: 600; color: var(--lt-text-primary); margin-bottom: 4px; }
.practice-mode-card__desc { font-size: 13px; color: var(--lt-text-secondary); line-height: 1.4; }

/* ===== 筛选区 ===== */
.practice-filters {
  background: var(--lt-bg-card); border-radius: var(--lt-radius-lg);
  padding: 24px; box-shadow: var(--lt-shadow-card);
}
.practice-filters__title { font-size: 16px; font-weight: 600; color: var(--lt-text-primary); margin-bottom: 20px; }
.practice-filters__grid { display: flex; gap: 32px; flex-wrap: wrap; margin-bottom: 24px; }
.practice-filter { display: flex; flex-direction: column; gap: 8px; }
.practice-filter--full { flex: 1 1 100%; }
.practice-filter__label { font-size: 13px; color: var(--lt-text-secondary); font-weight: 500; }
.practice-kp-empty { font-size: 12px; color: var(--lt-text-placeholder); margin-top: 6px; }
.practice-type-setup { display: flex; flex-direction: column; gap: 12px; }
.practice-type-setup__presets { display: flex; gap: 8px; }
.practice-type-setup__grid { display: flex; gap: 16px; flex-wrap: wrap; }
.practice-type-setup__item { display: flex; align-items: center; gap: 8px; }
.practice-type-setup__label { font-size: 14px; color: var(--lt-text-primary); white-space: nowrap; }
.practice-type-setup__total { font-size: 13px; color: var(--lt-text-secondary); }
.practice-filters__actions { display: flex; justify-content: flex-end; }
.practice-ai-desc { color: var(--lt-text-secondary); font-size: 14px; line-height: 1.6; margin-bottom: 20px; }

/* ===== 历史 ===== */
.practice-history-loading, .practice-history-empty { padding: 40px 20px; text-align: center; color: var(--lt-text-auxiliary); }
.practice-history-list { display: flex; flex-direction: column; gap: 12px; }
.practice-history-item {
  padding: 16px; background: var(--lt-bg-card); border-radius: var(--lt-radius-md);
  border: 1px solid var(--lt-border); cursor: pointer;
  transition: box-shadow var(--lt-transition-smooth);
}
.practice-history-item:hover { box-shadow: var(--lt-shadow-hover); }
.practice-history-item__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.practice-history-item__meta { display: flex; justify-content: space-between; font-size: 13px; color: var(--lt-text-secondary); }
.practice-history-item__accuracy { font-weight: 600; }

/* 类型标签 */
.practice-tag--single_choice { background: var(--lt-brand-lightest); color: var(--lt-brand); }
.practice-tag--multiple_choice { background: var(--lt-ai-light-9); color: var(--lt-ai); }
.practice-tag--true_false { background: var(--lt-orange-light-9); color: var(--lt-orange); }
.practice-tag--fill_blank { background: var(--lt-success-bg); color: var(--lt-success-text); }
.practice-tag--random, .practice-tag--weak_point, .practice-tag--wrong_review,
.practice-tag--kp_focus, .practice-tag--custom {
  background: var(--lt-brand-lightest); color: var(--lt-brand);
}
.practice-history-item__type {
  font-size: 12px; padding: 2px 10px; border-radius: var(--lt-radius-sm); font-weight: 500;
}

/* 颜色 */
.practice-accuracy--high { color: var(--lt-success-text); }
.practice-accuracy--mid { color: var(--lt-orange); }
.practice-accuracy--low { color: var(--lt-danger-text); }

/* ===== 过渡动画 ===== */
.phase-enter-active, .phase-leave-active { transition: opacity 220ms ease, transform 220ms ease; }
.phase-enter-from { opacity: 0; transform: translateY(10px); }
.phase-leave-to { opacity: 0; transform: translateY(-10px); }

/* ===== AI 评估触发按钮 ===== */
.practice-eval-trigger {
  display: flex; justify-content: center; padding: 12px 0 4px;
}
/* ===== 结果操作按钮 ===== */
.practice-result-actions {
  display: flex; justify-content: center; gap: 16px;
  padding: 20px 0; position: sticky; bottom: 0;
  background: var(--lt-bg-page); border-top: 1px solid var(--lt-border); z-index: 2;
}
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
