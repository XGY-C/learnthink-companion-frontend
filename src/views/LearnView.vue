<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlanStore } from '@/stores/plan'
import { useActivityStore } from '@/stores/activity'
import type { Activity, ActivitySubmitResponse } from '@/types'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import {
  ArrowLeft, Clock, CircleCheckFilled,
  WarningFilled,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const planStore = usePlanStore()
const actStore = useActivityStore()

const activityId = computed(() => route.params.activityId as string)

// ===== 查找当前 activity =====
const activity = ref<Activity | null>(null)
const moduleTitle = ref('')

onMounted(() => {
  // Find the activity from plan store
  for (const m of planStore.moduleList) {
    const sp = planStore.subPlans.get(m.moduleId)
    if (sp) {
      const a = sp.activities.find(act => act.activityId === activityId.value)
      if (a) {
        activity.value = a
        moduleTitle.value = m.title
        break
      }
    }
  }
  if (!activity.value) {
    ElMessage.error('活动不存在')
    router.push('/path')
    return
  }

  if (activity.value.type === 'quiz') {
    startQuiz()
  } else if (activity.value.type === 'learn') {
    startLearn()
  }
})

onUnmounted(() => {
  if (activity.value?.type === 'learn') {
    // Auto-submit on leave if conditions met
  }
})

// ===== Quiz State =====
const questions = ref<any[]>([])
const currentQuestion = ref(0)
const answers = ref<Record<string, string>>({})
const quizState = ref<'answering' | 'submitting' | 'result'>('answering')
const quizResult = ref<ActivitySubmitResponse | null>(null)

// Restore saved answers
onMounted(() => {
  if (activity.value?.type === 'quiz') {
    const saved = sessionStorage.getItem(`quiz_${activity.value.activityId}`)
    if (saved) {
      try {
        answers.value = JSON.parse(saved)
      } catch { /* ignore */ }
    }
  }
})

// Load quiz questions from the resource item
async function startQuiz() {
  // In a real implementation, fetch quiz content from resource-packs API
  // For now, we initialize from the activity's resource
  quizState.value = 'answering'

  // Parse sample questions if available in the resource content
  try {
    // Mock quiz data structure - real data comes from API
    questions.value = [
      {
        questionId: 'q1',
        type: 'SINGLE_CHOICE',
        content: '题目加载中...',
        options: ['A. 选项1', 'B. 选项2', 'C. 选项3', 'D. 选项4'],
        analysis: '',
        difficulty: 1,
      },
    ]
    // Try to load from API
    const res = await fetch(`/api/resource-packs/quiz-content?activity=${activityId.value}`)
    if (res.ok) {
      const data = await res.json()
      if (data.data?.questions) {
        questions.value = data.data.questions
      }
    }
  } catch { /* use default */ }
}

function selectAnswer(questionId: string, answer: string) {
  answers.value[questionId] = answer
  sessionStorage.setItem(`quiz_${activity.value?.activityId}`, JSON.stringify(answers.value))
}

function goNext() {
  if (currentQuestion.value < questions.value.length - 1) {
    currentQuestion.value++
  }
}

function goPrev() {
  if (currentQuestion.value > 0) {
    currentQuestion.value--
  }
}

const allAnswered = computed(() => {
  return questions.value.every(q => answers.value[q.questionId] != null)
})
const answeredCount = computed(() =>
  Object.keys(answers.value).length
)

async function handleQuizSubmit() {
  if (!allAnswered.value && answeredCount.value < questions.value.length) {
    const confirmed = await ElMessage.confirm(
      `还有 ${questions.value.length - answeredCount.value} 题未作答，确定提交？`,
      '提示',
      { confirmButtonText: '确定提交', cancelButtonText: '继续作答', type: 'warning' }
    ).catch(() => false)
    if (!confirmed) return
  }

  quizState.value = 'submitting'
  const submission = Object.entries(answers.value).map(([questionId, answer]) => ({
    question_id: questionId,
    answer,
  }))

  const res = await planStore.submitActivity(activityId.value, {
    answers: submission,
    duration_seconds: Math.floor((Date.now() - (actStore.learnStartTime || Date.now())) / 1000),
  })

  if (res) {
    quizResult.value = res
    quizState.value = 'result'
    sessionStorage.removeItem(`quiz_${activity.value?.activityId}`)

    // Show auto-action message
    if (res.autoAction) {
      ElMessage.warning(res.autoAction.reason)
    }
  } else {
    ElMessage.error('提交失败')
    quizState.value = 'answering'
  }
}

// ===== Learn State =====
const elapsedSeconds = ref(0)
const interactionDetected = ref(false)
const scrolledToBottom = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

function startLearn() {
  actStore.learnStartTime = Date.now()
  timer = setInterval(() => {
    elapsedSeconds.value = Math.floor((Date.now() - actStore.learnStartTime) / 1000)
  }, 1000)
}

const canCompleteLearn = computed(() => {
  if (!activity.value) return false
  const estMin = activity.value.estimatedMinutes || 25
  const timeOk = elapsedSeconds.value >= estMin * 60 * 0.6
  const scrolledOk = scrolledToBottom.value && elapsedSeconds.value >= estMin * 60 * 0.3
  return (timeOk || scrolledOk) && interactionDetected.value
})

function handleInteraction() {
  interactionDetected.value = true
}

function handleScrollToBottom() {
  scrolledToBottom.value = true
}

async function handleLearnComplete() {
  const res = await planStore.submitActivity(activityId.value, {
    duration_seconds: elapsedSeconds.value,
    interaction_detected: interactionDetected.value,
  })
  if (res) {
    ElMessage.success('已完成')
    // Navigate to next activity or back to path
    navigateNext()
  }
}

// ===== Navigation =====
function navigateBack() {
  router.push('/path')
}

function navigateNext() {
  // Find next activity in same module
  if (activity.value) {
    for (const m of planStore.moduleList) {
      const sp = planStore.subPlans.get(m.moduleId)
      if (sp) {
        const idx = sp.activities.findIndex(a => a.activityId === activity.value?.activityId)
        if (idx >= 0 && idx < sp.activities.length - 1) {
          const next = sp.activities[idx + 1]
          router.push(`/learn/${next.activityId}`)
          return
        }
      }
    }
  }
  // No next activity, go back to path
  router.push('/path')
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="h-full flex flex-col" @click="handleInteraction" @touchstart="handleInteraction">
    <!-- ===== 顶部导航栏 ===== -->
    <div class="flex items-center justify-between px-6 py-3 border-b shrink-0" style="border-color: var(--lt-border); background: var(--lt-bg-card);">
      <div class="flex items-center gap-4">
        <el-button text @click="navigateBack">
          <el-icon><ArrowLeft /></el-icon>
          返回路径
        </el-button>
        <div class="flex items-center gap-2 text-sm" style="color: var(--lt-text-secondary);">
          <span style="color: var(--lt-text-primary); font-weight: 500;">{{ moduleTitle }}</span>
          <span>·</span>
          <span v-if="activity">{{ activity.title }}</span>
          <el-tag v-if="activity" size="small" effect="plain" :disable-transitions="true">
            {{ activity.type === 'learn' ? '学习' : activity.type === 'quiz' ? '练习' : '拓展' }}
          </el-tag>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <!-- Quiz: 题号进度 -->
        <template v-if="activity?.type === 'quiz' && quizState === 'answering'">
          <span class="text-sm" style="color: var(--lt-text-auxiliary);">
            第 {{ currentQuestion + 1 }}/{{ questions.length }} 题
          </span>
          <span v-if="activity.completionCriteria" class="text-xs" style="color: var(--lt-text-auxiliary);">
            目标正确率 ≥ {{ Math.round((activity.completionCriteria.threshold || 0.7) * 100) }}%
          </span>
        </template>
        <!-- Learn: 计时器 -->
        <template v-if="activity?.type === 'learn'">
          <span class="text-sm font-mono" :style="{ color: canCompleteLearn ? 'var(--lt-success)' : 'var(--lt-text-auxiliary)' }">
            <el-icon><Clock /></el-icon>
            {{ formatTime(elapsedSeconds) }}
          </span>
        </template>
      </div>
    </div>

    <!-- ===== 内容区 ===== -->
    <div class="flex-1 overflow-auto">
      <!-- ===== Quiz 类型 ===== -->
      <template v-if="activity?.type === 'quiz'">
        <!-- 答题中 -->
        <div v-if="quizState === 'answering'" class="max-w-3xl mx-auto p-8">
          <div v-if="questions.length > 0 && questions[currentQuestion]" class="space-y-6">
            <!-- 题干 -->
            <div class="text-lg font-medium mb-4" style="color: var(--lt-text-primary);">
              {{ currentQuestion + 1 }}. {{ questions[currentQuestion].content }}
            </div>

            <!-- 选择题选项 -->
            <div v-if="questions[currentQuestion].options" class="space-y-3">
              <div
                v-for="(opt, oi) in questions[currentQuestion].options"
                :key="oi"
                class="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all border"
                :style="{
                  borderColor: answers[questions[currentQuestion].questionId] === opt.charAt(0) ? 'var(--lt-brand)' : 'var(--lt-border)',
                  background: answers[questions[currentQuestion].questionId] === opt.charAt(0) ? 'var(--lt-brand-lightest)' : 'transparent',
                }"
                @click="selectAnswer(questions[currentQuestion].questionId, opt.charAt(0))"
              >
                <span
                  class="flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium border"
                  :style="{
                    borderColor: answers[questions[currentQuestion].questionId] === opt.charAt(0) ? 'var(--lt-brand)' : '#D0D0D8',
                    background: answers[questions[currentQuestion].questionId] === opt.charAt(0) ? 'var(--lt-brand)' : 'transparent',
                    color: answers[questions[currentQuestion].questionId] === opt.charAt(0) ? 'white' : 'var(--lt-text-secondary)',
                  }"
                >
                  {{ String.fromCharCode(65 + oi) }}
                </span>
                <span class="text-sm" style="color: var(--lt-text-primary);">{{ opt.replace(/^[A-Z][.、]\s*/, '') }}</span>
              </div>
            </div>
          </div>

          <!-- 无题目 -->
          <div v-else class="text-center py-12" style="color: var(--lt-text-auxiliary);">
            正在加载题目...
          </div>
        </div>

        <!-- 提交中 -->
        <div v-if="quizState === 'submitting'" class="flex items-center justify-center py-20">
          <el-icon class="is-loading" :size="32" style="color: var(--lt-brand);"><WarningFilled /></el-icon>
          <span class="ml-3" style="color: var(--lt-text-secondary);">提交中...</span>
        </div>

        <!-- 结果 -->
        <div v-if="quizState === 'result' && quizResult" class="max-w-3xl mx-auto p-8">
          <div class="text-center mb-8">
            <!-- 得分环形 -->
            <div class="inline-flex items-center justify-center w-24 h-24 rounded-full mb-4"
              :style="{
                background: `conic-gradient(${(quizResult.score || 0) >= 0.7 ? 'var(--lt-success)' : 'var(--lt-orange)'} ${Math.round((quizResult.score || 0) * 360)}deg, var(--lt-border) ${Math.round((quizResult.score || 0) * 360)}deg)`,
              }"
            >
              <div class="w-20 h-20 rounded-full flex items-center justify-center" style="background: white;">
                <span class="text-2xl font-bold" :style="{ color: (quizResult.score || 0) >= 0.7 ? 'var(--lt-success)' : 'var(--lt-orange)' }">
                  {{ Math.round((quizResult.score || 0) * 100) }}%
                </span>
              </div>
            </div>

            <h3 class="text-xl font-semibold mb-2" style="color: var(--lt-text-primary);">
              <template v-if="(quizResult.score || 0) >= 0.7">🎯 达标</template>
              <template v-else-if="(quizResult.score || 0) >= 0.35">💪 还差一点</template>
              <template v-else>📚 建议回顾知识点</template>
            </h3>
            <p style="color: var(--lt-text-auxiliary);">
              {{ answeredCount }}/{{ questions.length }} 题正确
              <template v-if="activity?.completionCriteria">
                · 目标 {{ Math.round((activity.completionCriteria.threshold || 0.7) * 100) }}%
              </template>
            </p>

            <!-- 薄弱点标签 -->
            <div v-if="quizResult.weakTags?.length" class="flex items-center justify-center gap-2 mt-3">
              <span class="text-xs" style="color: var(--lt-text-auxiliary);">薄弱点：</span>
              <span
                v-for="tag in quizResult.weakTags"
                :key="tag"
                class="text-xs px-2 py-0.5 rounded"
                style="background: var(--lt-orange-light-9); color: var(--lt-orange-text);"
              >
                {{ tag }}
              </span>
            </div>

            <!-- 自动调整提示 -->
            <div v-if="quizResult.autoAction" class="mt-4 p-4 rounded-lg text-sm text-left"
              style="background: var(--lt-orange-light-9); color: var(--lt-orange-text);"
            >
              <p class="font-medium mb-1">⚡ 系统自动调整</p>
              <p>{{ quizResult.autoAction.reason }}</p>
              <div v-if="quizResult.autoAction.insertedActivities?.length" class="mt-2 space-y-1">
                <p v-for="act in quizResult.autoAction.insertedActivities" :key="act.activityId" class="text-xs">
                  · {{ act.type === 'learn' ? '📖' : '📝' }} {{ act.title }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ===== Learn 类型 ===== -->
      <template v-if="activity?.type === 'learn'">
        <div class="max-w-4xl mx-auto p-8" @click="handleInteraction" @touchstart="handleInteraction">
          <div class="mb-6">
            <h1 class="text-2xl font-bold mb-2" style="color: var(--lt-text-primary);">{{ activity.title }}</h1>
            <p v-if="activity.description" style="color: var(--lt-text-auxiliary);">{{ activity.description }}</p>
          </div>

          <!-- Markdown 阅读区 -->
          <div class="mb-8" @scroll="handleInteraction">
            <MarkdownViewer
              :content="`# ${activity.title}\n\n${activity.description || ''}\n\n---\n\n*（内容由资源加载）*`"
              :show-toc="true"
            />
          </div>

          <!-- 底部哨兵（用于 scroll detection） -->
          <div ref="sentinelRef" class="h-4" style="pointer-events: none;"></div>
        </div>
      </template>
    </div>

    <!-- ===== 底部操作栏 ===== -->
    <div class="shrink-0 border-t px-6 py-3" style="border-color: var(--lt-border); background: var(--lt-bg-card);">
      <div class="max-w-3xl mx-auto flex items-center justify-between">
        <!-- Quiz 导航 -->
        <template v-if="activity?.type === 'quiz' && quizState === 'answering'">
          <div class="flex items-center gap-2">
            <el-button size="small" :disabled="currentQuestion === 0" @click="goPrev">上一题</el-button>
            <el-button size="small" :disabled="currentQuestion >= questions.length - 1" @click="goNext">下一题</el-button>
          </div>
          <div class="flex items-center gap-2">
            <!-- 题号导航 -->
            <div class="flex gap-1 mr-4">
              <span
                v-for="(q, i) in questions"
                :key="i"
                class="inline-flex items-center justify-center w-6 h-6 rounded text-xs cursor-pointer border"
                :style="{
                  borderColor: currentQuestion === i ? 'var(--lt-brand)' : 'var(--lt-border)',
                  background: answers[q.questionId] ? 'var(--lt-brand)' : 'transparent',
                  color: answers[q.questionId] ? 'white' : 'var(--lt-text-secondary)',
                }"
                @click="currentQuestion = i"
              >
                {{ answers[q.questionId] ? '●' : (i + 1) }}
              </span>
            </div>
            <el-button
              type="primary"
              :loading="quizState === 'submitting'"
              @click="handleQuizSubmit"
            >
              提交全部答案 ({{ answeredCount }}/{{ questions.length }})
            </el-button>
          </div>
        </template>

        <!-- Quiz 结果页操作 -->
        <template v-if="activity?.type === 'quiz' && quizState === 'result'">
          <div></div>
          <div class="flex gap-2">
            <el-button @click="navigateBack">返回路径</el-button>
            <el-button type="primary" @click="navigateNext">下一个 activity →</el-button>
          </div>
        </template>

        <!-- Learn 操作 -->
        <template v-if="activity?.type === 'learn'">
          <div class="text-sm" :style="{ color: canCompleteLearn ? 'var(--lt-success)' : 'var(--lt-text-auxiliary)' }">
            <span v-if="!interactionDetected">点击页面以标记交互</span>
            <span v-else-if="!canCompleteLearn">继续阅读以完成</span>
            <span v-else>✅ 条件满足，可标记完成</span>
          </div>
          <div class="flex gap-2">
            <el-button @click="navigateBack">返回路径</el-button>
            <el-button
              type="primary"
              :disabled="!canCompleteLearn"
              @click="handleLearnComplete"
            >
              标记完成
            </el-button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
