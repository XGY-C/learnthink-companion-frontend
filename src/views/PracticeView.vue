<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import EvidenceDrawer from '@/components/EvidenceDrawer.vue'

const router = useRouter()

// ===== Type Definitions =====
type QuestionType = 'single' | 'fill-blank' | 'short-answer'
type Difficulty = 'easy' | 'medium' | 'hard'
type Confidence = 'high' | 'medium' | 'low'

interface Source {
  title: string
  locator: string
  quote: string
  relevance?: 'high' | 'medium' | 'low'
}

interface Question {
  id: string
  type: QuestionType
  stem: string
  options?: { label: string; text: string }[]
  placeholder?: string
  answer: string
  analysis: string
  difficulty: Difficulty
  knowledgePoints: string[]
  errorTags: string[]
  pushReason: string
  qualityScore: number
  confidence: Confidence
  sources: Source[]
}

interface ResultItem {
  questionId: string
  isCorrect: boolean
  userAnswer: string
}

// ===== State =====
const activeView = ref<'list' | 'result'>('list')
const currentQuestionIndex = ref(0)
const submitted = ref(false)

// Evidence drawer
const evidenceDrawer = ref<InstanceType<typeof EvidenceDrawer> | null>(null)

// Timer
const elapsedSeconds = ref(0)
const timerInterval = ref<ReturnType<typeof setInterval> | null>(null)

// Difficulty filter
const difficultyFilter = ref<Difficulty | 'all'>('all')

// ===== Mock Data =====
const practiceMeta = reactive({
  knowledgePoint: 'A* 搜索算法',
  course: '计算机基础与数据结构',
  totalQuestions: 8,
  estimatedMinutes: 20,
  generatedAt: '刚刚',
  qualityScore: 92
})

const questions = ref<Question[]>([
  {
    id: 'q1',
    type: 'single',
    stem: '在 A* 搜索算法中，估值函数 f(n) 的正确计算公式是？',
    options: [
      { label: 'A', text: 'f(n) = g(n)' },
      { label: 'B', text: 'f(n) = h(n)' },
      { label: 'C', text: 'f(n) = g(n) + h(n)' },
      { label: 'D', text: 'f(n) = g(n) x h(n)' }
    ],
    answer: 'C',
    analysis: 'A* 算法的核心估值函数 f(n) = g(n) + h(n)，其中 g(n) 是从起点到当前节点 n 的实际代价，h(n) 是从节点 n 到目标节点的启发式估计代价。两者相加得到总代价估计。',
    difficulty: 'easy',
    knowledgePoints: ['A* 搜索', '估值函数'],
    errorTags: ['概念混淆', '公式记忆'],
    pushReason: '针对薄弱点：A* 核心公式',
    qualityScore: 95,
    confidence: 'high',
    sources: [
      { title: '算法导论 第4版', locator: 'Ch 22.3', quote: 'A* 搜索使用评估函数 f(n) = g(n) + h(n) 来评估节点优先级。', relevance: 'high' },
      { title: '人工智能：一种现代方法', locator: 'Pg 189', quote: 'A* 算法结合了 Dijkstra 算法（g(n)）和贪心最佳优先搜索（h(n)）的思想。', relevance: 'high' }
    ]
  },
  {
    id: 'q2',
    type: 'single',
    stem: '以下哪种启发式函数 h(n) 是「可采纳的（Admissible）」？',
    options: [
      { label: 'A', text: 'h(n) 始终大于真实代价' },
      { label: 'B', text: 'h(n) 始终小于等于真实代价' },
      { label: 'C', text: 'h(n) 始终等于真实代价' },
      { label: 'D', text: 'h(n) 与真实代价无关' }
    ],
    answer: 'B',
    analysis: '可采纳启发式（Admissible Heuristic）要求 h(n) 永远不会高估到达目标节点的实际代价，即 h(n) <= h*(n) 对所有节点 n 成立。这保证了 A* 算法能找到最优解。',
    difficulty: 'medium',
    knowledgePoints: ['A* 搜索', '可采纳启发式'],
    errorTags: ['概念混淆'],
    pushReason: '核心概念辨析：可采纳性是A*最优性的关键',
    qualityScore: 88,
    confidence: 'high',
    sources: [
      { title: '算法导论 第4版', locator: 'Ch 22.3', quote: '如果 h(n) 是可采纳的，则 A* 保证找到最优路径。', relevance: 'high' },
      { title: '斯坦福 CS221 讲义', locator: 'Lecture 8', quote: 'Admissible heuristic never overestimates the cost to reach the goal.', relevance: 'high' }
    ]
  },
  {
    id: 'q3',
    type: 'fill-blank',
    stem: '在 A* 搜索中，若启发式函数 h(n) 满足一致性（Consistency）条件，也称为 ______ 性。',
    placeholder: '请输入你的答案',
    answer: '单调',
    analysis: '一致性（Consistency）条件也称为单调性（Monotonicity）。它要求对于任意边 (u, v)，有 h(u) <= cost(u, v) + h(v)。满足一致性的启发式函数必然也是可采纳的。',
    difficulty: 'medium',
    knowledgePoints: ['A* 搜索', '一致性启发式'],
    errorTags: ['术语记忆'],
    pushReason: '偏好：概念辨析型题目',
    qualityScore: 85,
    confidence: 'medium',
    sources: [
      { title: '人工智能：一种现代方法', locator: 'Pg 195', quote: '一致性条件有时也称为单调条件。', relevance: 'high' }
    ]
  },
  {
    id: 'q4',
    type: 'single',
    stem: '在二维网格寻路中，以下哪种启发式函数通常最适合 A* 算法？',
    options: [
      { label: 'A', text: '曼哈顿距离（Manhattan Distance）' },
      { label: 'B', text: '欧几里得距离（Euclidean Distance）' },
      { label: 'C', text: '切比雪夫距离（Chebyshev Distance）' },
      { label: 'D', text: '零启发式（h(n) = 0）' }
    ],
    answer: 'A',
    analysis: '对于四方向移动（上下左右）的网格，曼哈顿距离是最常用的可采纳启发式，因为它计算水平+垂直距离，不会高估实际代价。欧几里得距离虽然也可采纳但计算开销大。切比雪夫距离适用于八方向移动。零启发式退化为 Dijkstra 算法。',
    difficulty: 'hard',
    knowledgePoints: ['A* 搜索', '启发式函数设计', '网格寻路'],
    errorTags: ['场景应用'],
    pushReason: '针对薄弱点：启发式函数在不同场景的选择',
    qualityScore: 90,
    confidence: 'high',
    sources: [
      { title: '大话数据结构', locator: 'Pg 134', quote: '曼哈顿距离在四方向格点地图中是最优的可采纳启发式。', relevance: 'high' },
      { title: 'Red Blob Games: A* 可视化教程', locator: 'Heuristics section', quote: 'For 4-direction movement, Manhattan distance is the standard heuristic.', relevance: 'medium' }
    ]
  },
  {
    id: 'q5',
    type: 'fill-blank',
    stem: 'A* 算法使用优先队列（最小堆）来管理待扩展节点，每次取出 f(n) 值最 ______ 的节点进行扩展。',
    placeholder: '请输入：大 或 小',
    answer: '小',
    analysis: 'A* 使用最小堆（优先队列）按 f(n) 值从小到大管理开放集（Open Set），每次取出 f(n) 最小的节点进行扩展，确保优先探索最有希望的路径。',
    difficulty: 'easy',
    knowledgePoints: ['A* 搜索', '优先队列'],
    errorTags: ['算法流程'],
    pushReason: '节奏：15分钟/天 -> 速览版基础概念',
    qualityScore: 82,
    confidence: 'medium',
    sources: [
      { title: '数据结构与算法分析', locator: 'Ch 9.3', quote: '优先队列是 A* 算法的核心数据结构，保证了每次扩展最优节点。', relevance: 'high' }
    ]
  },
  {
    id: 'q6',
    type: 'short-answer',
    stem: '请简要说明 A* 算法与 Dijkstra 算法的核心区别，以及 A* 在什么条件下退化为 Dijkstra 算法？',
    placeholder: '请输入你的回答（不少于 20 字）',
    answer: 'A* 使用 f(n) = g(n) + h(n) 评估节点优先级，而 Dijkstra 仅使用 g(n)（即 h(n)=0）。A* 通过启发式函数引导搜索方向，效率更高。当 h(n)=0 时，A* 退化为 Dijkstra 算法，因为此时 f(n)=g(n)，扩展顺序与 Dijkstra 完全一致。',
    analysis: 'A* 与 Dijkstra 的核心区别在于：A* 利用启发式信息引导搜索，可以更快地找到目标；Dijkstra 从起点向所有方向均匀扩展。A* 在 h(n)=0 时退化为 Dijkstra。此外，如果启发式函数设计不当（过度估计），A* 可能无法找到最优解。',
    difficulty: 'hard',
    knowledgePoints: ['A* 搜索', 'Dijkstra 算法', '算法对比'],
    errorTags: ['概念混淆', '分析不完整'],
    pushReason: '偏好：代码实操与算法辨析',
    qualityScore: 93,
    confidence: 'high',
    sources: [
      { title: '算法导论 第4版', locator: 'Ch 22.3-22.4', quote: 'Dijkstra 算法是 A* 算法在 h(n)=0 时的特例。', relevance: 'high' },
      { title: '人工智能：一种现代方法', locator: 'Pg 192', quote: 'A* 搜索比 Dijkstra 算法更高效，因为它使用启发式信息进行定向搜索。', relevance: 'high' }
    ]
  },
  {
    id: 'q7',
    type: 'single',
    stem: '关于 A* 搜索的「最优性」条件，以下说法正确的是？',
    options: [
      { label: 'A', text: '只要 h(n) > 0，A* 就能找到最优解' },
      { label: 'B', text: '只要 h(n) 是可采纳的，A* 保证找到最优解' },
      { label: 'C', text: 'A* 在任何条件下都能找到最优解' },
      { label: 'D', text: 'A* 的最优性与启发式函数无关' }
    ],
    answer: 'B',
    analysis: 'A* 的最优性依赖于启发式函数的可采纳性（admissible）。如果 h(n) 永远不会高估实际代价，即 h(n) <= h*(n)，则 A* 保证找到最优解。这是 A* 算法最重要的理论保证。',
    difficulty: 'medium',
    knowledgePoints: ['A* 搜索', '最优性条件'],
    errorTags: ['概念混淆'],
    pushReason: '核心定理辨析：A* 最优性条件',
    qualityScore: 91,
    confidence: 'high',
    sources: [
      { title: '算法导论 第4版', locator: 'Ch 22.3', quote: 'Theorem: If h is admissible, A* is optimal.', relevance: 'high' },
      { title: '人工智能：一种现代方法', locator: 'Pg 192-194', quote: 'A* 是可采纳的，前提是 h(n) 是可采纳的。', relevance: 'high' }
    ]
  },
  {
    id: 'q8',
    type: 'short-answer',
    stem: '举一个实际场景，说明为什么启发式函数 h(n) 选择不当会导致 A* 搜索效率下降甚至找不到最优解。',
    placeholder: '请结合实际场景举例说明',
    answer: '以游戏寻路为例：若在迷宫中使用欧几里得距离作为启发式（实际移动只能上下左右），曼哈顿距离会更准确。若使用一个高估的启发式（如 h(n) = 真实代价 x 2），A* 会过度自信地沿着某条路径前进，可能忽略实际更优的路径，最终找不到最优解。例如在地图导航中，使用直线距离（过小河）会高估无法直接穿越的障碍物场景，导致次优路径。',
    analysis: '这是一个开放性题目，关键在于理解：1. 过度估计的启发式（非可采纳）会破坏最优性保证；2. 不准确的（但可采纳的）启发式只影响效率（扩展更多节点），不会破坏最优性；3. 启发式的选择需要与问题的实际移动代价模型匹配。',
    difficulty: 'hard',
    knowledgePoints: ['A* 搜索', '启发式函数设计', '实际应用'],
    errorTags: ['分析不完整', '场景理解'],
    pushReason: '偏好：代码实操与场景分析',
    qualityScore: 87,
    confidence: 'medium',
    sources: [
      { title: 'Red Blob Games: A* 可视化教程', locator: 'Heuristics section', quote: 'Choosing an appropriate heuristic depends on the type of movement allowed.', relevance: 'high' },
      { title: 'AI Game Programming Wisdom', locator: 'Ch 3.2', quote: 'Overestimating heuristics can lead to suboptimal paths in practical applications.', relevance: 'medium' }
    ]
  }
])

// ===== Computed =====
const filteredQuestions = computed(() => {
  if (difficultyFilter.value === 'all') return questions.value
  return questions.value.filter(q => q.difficulty === difficultyFilter.value)
})

const totalQuestions = computed(() => filteredQuestions.value.length)

const currentQuestion = computed(() => filteredQuestions.value[currentQuestionIndex.value])

// Answers tracking
const answerRecords = reactive<Record<string, string>>({})

const answeredCount = computed(() => {
  return Object.keys(answerRecords).filter(id => {
    const q = questions.value.find(q => q.id === id)
    if (!q) return false
    return answerRecords[id] && answerRecords[id].trim().length > 0
  }).length
})

const progressPercent = computed(() => {
  if (totalQuestions.value === 0) return 0
  return Math.round((answeredCount.value / totalQuestions.value) * 100)
})

const allAnswered = computed(() => answeredCount.value === totalQuestions.value)

// Results
const results = ref<ResultItem[]>([])

const correctCount = computed(() => results.value.filter(r => r.isCorrect).length)
const accuracyRate = computed(() => {
  if (results.value.length === 0) return 0
  return Math.round((correctCount.value / results.value.length) * 100)
})

const weakPoints = computed(() => {
  const tagCount = new Map<string, number>()
  results.value.forEach(r => {
    if (!r.isCorrect) {
      const q = questions.value.find(q => q.id === r.questionId)
      if (q) {
        q.errorTags.forEach(tag => {
          tagCount.set(tag, (tagCount.get(tag) || 0) + 1)
        })
      }
    }
  })
  return Array.from(tagCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag, count]) => ({ tag, count }))
})

const wrongKnowledgePoints = computed(() => {
  const kpCount = new Map<string, number>()
  results.value.forEach(r => {
    if (!r.isCorrect) {
      const q = questions.value.find(q => q.id === r.questionId)
      if (q) {
        q.knowledgePoints.forEach(kp => {
          kpCount.set(kp, (kpCount.get(kp) || 0) + 1)
        })
      }
    }
  })
  return Array.from(kpCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([kp, count]) => ({ kp, count }))
})

const accuracyStatus = computed(() => {
  if (accuracyRate.value >= 80) return 'success'
  if (accuracyRate.value >= 60) return 'warning'
  return 'danger'
})

// ===== Helper Functions =====
const confidenceLabel = (c: Confidence) => {
  const map: Record<Confidence, string> = { high: '高', medium: '中', low: '低' }
  return map[c]
}

const confidenceType = (c: Confidence) => {
  const map: Record<Confidence, string> = { high: 'success', medium: 'warning', low: 'danger' }
  return map[c]
}

const difficultyLabel = (d: Difficulty) => {
  const map: Record<Difficulty, string> = { easy: '简单', medium: '中等', hard: '困难' }
  return map[d]
}

const difficultyType = (d: Difficulty) => {
  const map: Record<Difficulty, string> = { easy: 'success', medium: 'warning', hard: 'danger' }
  return map[d]
}

// ===== Methods =====
const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const startTimer = () => {
  if (timerInterval.value) return
  timerInterval.value = setInterval(() => {
    elapsedSeconds.value++
  }, 1000)
}

const stopTimer = () => {
  if (timerInterval.value) {
    clearInterval(timerInterval.value)
    timerInterval.value = null
  }
}

const selectAnswer = (questionId: string, value: string) => {
  answerRecords[questionId] = value
}

const goToQuestion = (index: number) => {
  if (index >= 0 && index < totalQuestions.value) {
    currentQuestionIndex.value = index
  }
}

const normalizeAnswer = (s: string) =>
  s.trim().replace(/[，。！？、；：""''（）【】《》\s]/g, '').toLowerCase()

const checkSingleChoice = (q: Question, userAnswer: string): boolean => {
  return userAnswer.trim().toUpperCase() === q.answer.trim().toUpperCase()
}

const checkFillBlank = (q: Question, userAnswer: string): boolean => {
  return normalizeAnswer(userAnswer) === normalizeAnswer(q.answer)
}

const checkShortAnswer = (q: Question, userAnswer: string): boolean => {
  const keyTerms = q.answer.split(/[。，；、\s]+/).filter(t => t.length >= 2)
  const userNorm = normalizeAnswer(userAnswer)
  const matched = keyTerms.filter(term => userNorm.includes(normalizeAnswer(term)))
  return matched.length >= Math.ceil(keyTerms.length * 0.3)
}

const submitAnswers = () => {
  const unanswered = questions.value.filter(q => !answerRecords[q.id] || answerRecords[q.id].trim() === '')
  if (unanswered.length > 0) {
    ElMessage.warning(`还有 ${unanswered.length} 道题未作答，请完成后提交。`)
    return
  }

  stopTimer()
  submitted.value = true
  activeView.value = 'result'

  const res: ResultItem[] = questions.value.map(q => {
    const userAns = answerRecords[q.id] || ''
    let isCorrect = false
    if (q.type === 'single') {
      isCorrect = checkSingleChoice(q, userAns)
    } else if (q.type === 'fill-blank') {
      isCorrect = checkFillBlank(q, userAns)
    } else {
      isCorrect = checkShortAnswer(q, userAns)
    }
    return { questionId: q.id, isCorrect, userAnswer: userAns }
  })

  results.value = res
  ElMessage.success('提交成功！正在分析学习成果...')
}

const retry = () => {
  for (const key of Object.keys(answerRecords)) {
    delete answerRecords[key]
  }
  results.value = []
  submitted.value = false
  activeView.value = 'list'
  currentQuestionIndex.value = 0
  elapsedSeconds.value = 0
  startTimer()
  ElMessage.info('已重置所有作答，重新开始练习。')
}

const viewSources = (q: Question) => {
  if (q.sources && q.sources.length > 0) {
    evidenceDrawer.value?.open(q.sources)
  } else {
    evidenceDrawer.value?.open([
      { title: 'AI 合成来源', locator: 'System', quote: '此题目基于知识库与偏好动态生成。' }
    ])
  }
}

const goToStudio = () => {
  router.push({ name: 'studio', query: { topic: practiceMeta.knowledgePoint } })
}

const goToPath = () => {
  router.push({ name: 'path' })
}

const getQuestionStatus = (qId: string): 'success' | 'danger' | 'info' => {
  if (!submitted.value) return 'info'
  const r = results.value.find(res => res.questionId === qId)
  if (!r) return 'info'
  return r.isCorrect ? 'success' : 'danger'
}

const getQuestionIcon = (qId: string): string => {
  if (!submitted.value) return ''
  const r = results.value.find(res => res.questionId === qId)
  if (!r) return ''
  return r.isCorrect ? 'Y' : 'N'
}

// ===== Lifecycle =====
onMounted(() => {
  startTimer()
})

onUnmounted(() => {
  stopTimer()
})
</script>

<template>
  <div class="h-full flex overflow-hidden pt-2">
    <!-- ===== 主内容区 ===== -->
    <div class="flex-1 min-w-0 flex flex-col overflow-hidden">
      <!-- ===== 顶部信息栏（增强版） ===== -->
      <div class="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style="background: linear-gradient(135deg, #2B6FFF, #1A4FCC);">
              <el-icon size="18" color="white"><EditPen /></el-icon>
            </div>
            <div>
              <h1 class="text-2xl font-bold" style="color: #1A1A2E;">定制练习</h1>
              <p class="text-sm mt-0.5" style="color: #8E8EA0;">
                基于「<span style="color: #2B6FFF; font-weight: 500;">{{ practiceMeta.knowledgePoint }}</span>」生成 · 共 {{ practiceMeta.totalQuestions }} 题 · 预估 {{ practiceMeta.estimatedMinutes }} 分钟
              </p>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <el-select v-model="difficultyFilter" size="small" class="w-28" @change="currentQuestionIndex = 0" style="--el-border-radius-base: 20px;">
            <el-option label="全部难度" value="all" />
            <el-option label="简单" value="easy" />
            <el-option label="中等" value="medium" />
            <el-option label="困难" value="hard" />
          </el-select>
          <div class="flex items-center gap-2 text-sm px-3.5 py-1.5 rounded-full shadow-sm" style="background-color: rgba(255,255,255,0.8); backdrop-filter: blur(12px); border: 1px solid #E8ECF0;">
            <el-icon style="color: #2B6FFF;"><Timer /></el-icon>
            <span class="font-mono font-medium" :class="elapsedSeconds > 1200 ? '!text-red-500' : ''" style="color: #5A5A72;">
              {{ formatTime(elapsedSeconds) }}
            </span>
          </div>
          <el-tooltip content="本套练习的整体质量评分" placement="bottom">
            <el-tag type="success" effect="plain" class="cursor-help !rounded-full" style="--el-tag-bg-color: rgba(52,199,89,0.08); --el-tag-border-color: rgba(52,199,89,0.2);">
              🏆 质量 {{ practiceMeta.qualityScore }}/100
            </el-tag>
          </el-tooltip>
        </div>
      </div>

      <!-- ===== 提交后画像更新通知 ===== -->
      <el-alert
        v-if="submitted && results.length > 0"
        :title="accuracyRate >= 60 ? '画像与路径已更新' : '画像与路径已调整'"
        :type="accuracyRate >= 60 ? 'success' : 'warning'"
        :description="accuracyRate >= 60
          ? '本次练习结果已写入学习记录，画像薄弱点和学习路径已根据正确率动态调整。'
          : '正确率偏低，系统已标记薄弱知识点并插入复习节点到学习路径中。'"
        show-icon
        closable
        class="mb-4 flex-shrink-0"
      />

      <!-- ===== 模式：答题列表 / 结果页 ===== -->
      <template v-if="activeView === 'result'">
        <!-- ===== 结果页 ===== -->
        <div class="flex-1 overflow-y-auto pr-2">
          <!-- 总结卡片（增强版） -->
          <el-card class="mb-6" shadow="never" style="border-radius: 14px; border: 1px solid #E8ECF0; overflow: hidden;">
            <template #header>
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background: linear-gradient(135deg, #34C759, #28A745);">
                  <el-icon size="14" color="white"><Medal /></el-icon>
                </div>
                <span class="font-semibold" style="color: #1A1A2E;">练习成绩报告</span>
                <el-tag size="small" :type="accuracyStatus" effect="light" class="ml-2 !rounded-full">
                  {{ accuracyRate >= 80 ? '优秀' : accuracyRate >= 60 ? '良好' : '需加强' }}
                </el-tag>
              </div>
            </template>

            <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <!-- 正确率（增强） -->
              <div class="flex flex-col items-center justify-center p-6">
                <el-progress
                  type="circle"
                  :percentage="accuracyRate"
                  :status="accuracyStatus"
                  :width="110"
                  :stroke-width="10"
                />
                <p class="text-sm text-gray-600 mt-3 font-medium">正确率</p>
                <p class="text-xs text-gray-400 mt-1">{{ correctCount }}/{{ results.length }} 题</p>
              </div>
              <!-- 统计（增强） -->
              <div class="flex flex-col justify-center gap-3 p-6">
                <div class="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                  <div class="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                    <el-icon class="text-green-600"><CircleCheckFilled /></el-icon>
                  </div>
                  <div>
                    <span class="text-sm text-gray-500">答对</span>
                    <span class="text-xl font-bold text-green-600 ml-2">{{ correctCount }} 题</span>
                  </div>
                </div>
                <div class="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                  <div class="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
                    <el-icon class="text-red-500"><CircleCloseFilled /></el-icon>
                  </div>
                  <div>
                    <span class="text-sm text-gray-500">答错</span>
                    <span class="text-xl font-bold text-red-500 ml-2">{{ results.length - correctCount }} 题</span>
                  </div>
                </div>
                <div class="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                  <div class="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <el-icon class="text-indigo-500"><Timer /></el-icon>
                  </div>
                  <div>
                    <span class="text-sm text-gray-500">用时</span>
                    <span class="text-xl font-bold text-gray-700 ml-2">{{ formatTime(elapsedSeconds) }}</span>
                  </div>
                </div>
              </div>
              <!-- 薄弱知识点 Top 3 -->
              <div class="p-6">
                <h4 class="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
                  <el-icon class="text-red-500"><WarningFilled /></el-icon>
                  薄弱知识点 Top 3
                </h4>
                <div v-if="wrongKnowledgePoints.length > 0" class="space-y-3">
                  <div v-for="wk in wrongKnowledgePoints" :key="wk.kp" class="flex items-center justify-between p-2.5 rounded-lg bg-red-50/50">
                    <span class="text-sm text-gray-700">{{ wk.kp }}</span>
                    <el-tag size="small" type="danger" effect="dark" class="!rounded-full">{{ wk.count }}题错</el-tag>
                  </div>
                </div>
                <p v-else class="text-sm text-green-600 bg-green-50 p-3 rounded-lg flex items-center gap-2">
                  <el-icon><CircleCheckFilled /></el-icon>
                  无显著薄弱点
                </p>
              </div>
              <!-- 错因分析 Top 3 -->
              <div class="p-6">
                <h4 class="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
                  <el-icon class="text-orange-500"><InfoFilled /></el-icon>
                  主要错因分析
                </h4>
                <div v-if="weakPoints.length > 0" class="space-y-3">
                  <div v-for="wp in weakPoints" :key="wp.tag" class="flex items-center justify-between p-2.5 rounded-lg bg-orange-50/50">
                    <span class="text-sm text-gray-700">{{ wp.tag }}</span>
                    <el-tag size="small" type="warning" effect="dark" class="!rounded-full">{{ wp.count }}次</el-tag>
                  </div>
                </div>
                <p v-else class="text-sm text-green-600 bg-green-50 p-3 rounded-lg flex items-center gap-2">
                  <el-icon><CircleCheckFilled /></el-icon>
                  答题质量良好
                </p>
              </div>
            </div>

            <!-- 建议下一步（增强） -->
            <div class="px-6 py-4" style="background: linear-gradient(90deg, #E8F0FE, #F5F0FF); border-top: 1px solid #E8ECF0;">
              <div class="flex items-center justify-between flex-wrap gap-3">
                <div class="flex items-center gap-2 text-sm text-gray-600">
                  <div class="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                    <el-icon size="12" class="text-indigo-500"><InfoFilled /></el-icon>
                  </div>
                  <span style="color: #5A5A72;">基于本次练习结果，系统已更新学习画像与路径规划。</span>
                </div>
                <div class="flex gap-2">
                  <el-button @click="retry" class="!rounded-full">
                    🔄 重新练习
                  </el-button>
                  <el-button type="primary" @click="goToStudio" class="!rounded-full">
                    <el-icon class="mr-1"><MagicStick /></el-icon>巩固薄弱点
                  </el-button>
                  <el-button plain @click="goToPath" class="!rounded-full">
                    查看调整后的路径
                  </el-button>
                </div>
              </div>
            </div>
          </el-card>

          <!-- 逐题反馈 -->
          <h3 class="text-lg font-semibold mb-4" style="color: #1A1A2E;">逐题反馈</h3>
          <div class="space-y-4">
            <el-card
              v-for="(q, idx) in questions"
              :key="q.id"
              shadow="hover"
              class="transition-shadow"
              :class="getQuestionStatus(q.id) === 'success' ? 'border-l-4 border-l-success' : getQuestionStatus(q.id) === 'danger' ? 'border-l-4 border-l-danger' : ''"
            >
              <div class="flex gap-4">
                <!-- 题号与状态 -->
                <div class="flex flex-col items-center w-10 flex-shrink-0">
                  <div
                    class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    :class="getQuestionStatus(q.id) === 'success' ? 'bg-success/10 text-success' : getQuestionStatus(q.id) === 'danger' ? 'bg-danger/10 text-danger' : 'bg-gray-100 text-gray-500'"
                  >
                    {{ getQuestionIcon(q.id) || (idx + 1) }}
                  </div>
                </div>
                <!-- 内容 -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-2">
                    <el-tag size="small" :type="q.type === 'single' ? 'primary' : q.type === 'fill-blank' ? 'warning' : 'info'">
                      {{ q.type === 'single' ? '单选题' : q.type === 'fill-blank' ? '填空题' : '简答题' }}
                    </el-tag>
                    <el-tag size="small" :type="difficultyType(q.difficulty)">{{ difficultyLabel(q.difficulty) }}</el-tag>
                    <el-tag size="small" type="info" effect="plain" class="text-xs">{{ q.pushReason }}</el-tag>
                  </div>
                  <p class="text-base font-medium text-gray-900 mb-3">{{ q.stem }}</p>

                  <!-- 用户的答案 -->
                  <div class="mb-3 bg-gray-50 p-3 rounded text-sm">
                    <span class="text-gray-500">你的答案：</span>
                    <span :class="getQuestionStatus(q.id) === 'success' ? 'text-success font-medium' : 'text-danger font-medium'">
                      {{ answerRecords[q.id] || '未作答' }}
                    </span>
                    <span v-if="getQuestionStatus(q.id) !== 'success'" class="ml-3">
                      <span class="text-gray-500">参考答案：</span>
                      <span class="text-success font-medium">{{ q.answer }}</span>
                    </span>
                  </div>

                  <!-- 解析 -->
                  <div class="bg-blue-50 border border-blue-100 rounded p-3 text-sm text-gray-700 leading-relaxed">
                    <span class="font-semibold text-blue-700">解析：</span>
                    {{ q.analysis }}
                  </div>

                  <!-- 来源与质量 -->
                  <div class="flex items-center gap-3 mt-3">
                    <el-tag
                      size="small"
                      :type="confidenceType(q.confidence)"
                      effect="plain"
                      class="cursor-pointer"
                      @click="viewSources(q)"
                    >
                      置信度：{{ confidenceLabel(q.confidence) }}
                    </el-tag>
                    <el-tag size="small" type="info" effect="plain">
                      质量 {{ q.qualityScore }}/100
                    </el-tag>
                    <el-button link type="primary" size="small" @click="viewSources(q)">
                      查看引用来源（{{ q.sources.length }}）
                    </el-button>
                    <div class="flex flex-wrap gap-1 ml-auto">
                      <el-tag v-for="tag in q.errorTags" :key="tag" size="small" type="danger" effect="plain">
                        {{ tag }}
                      </el-tag>
                    </div>
                  </div>
                </div>
              </div>
            </el-card>
          </div>
        </div>
      </template>

      <template v-else>
        <!-- ===== 答题模式 ===== -->
        <div class="flex-1 flex flex-col min-h-0">
          <!-- 题目导航 + 进度 -->
          <div class="flex items-center justify-between mb-4 flex-shrink-0">
            <div class="flex items-center gap-2">
              <el-button
                size="small"
                :disabled="currentQuestionIndex === 0"
                @click="goToQuestion(currentQuestionIndex - 1)"
              >
                <el-icon><ArrowLeft /></el-icon> 上一题
              </el-button>
              <span class="text-sm text-gray-500 mx-2">
                {{ currentQuestionIndex + 1 }} / {{ totalQuestions }}
              </span>
              <el-button
                size="small"
                :disabled="currentQuestionIndex >= totalQuestions - 1"
                @click="goToQuestion(currentQuestionIndex + 1)"
              >
                下一题 <el-icon><ArrowRight /></el-icon>
              </el-button>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs text-gray-500">答题进度 {{ answeredCount }}/{{ totalQuestions }}</span>
              <el-progress :percentage="progressPercent" :stroke-width="6" class="w-32" />
              <el-button
                type="primary"
                :disabled="!allAnswered"
                @click="submitAnswers"
              >
                提交答案
              </el-button>
            </div>
          </div>

          <!-- 题目缩略导航（小圆点） -->
          <div class="flex gap-1.5 mb-4 flex-wrap flex-shrink-0">
            <div
              v-for="(q, idx) in questions"
              :key="q.id"
              class="w-6 h-6 rounded-full flex items-center justify-center text-xs cursor-pointer transition-all"
              :class="[
                currentQuestionIndex === idx ? 'ring-2 ring-primary ring-offset-1' : '',
                answerRecords[q.id] && answerRecords[q.id].trim() ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
              ]"
              @click="goToQuestion(idx)"
            >
              {{ idx + 1 }}
            </div>
          </div>

          <!-- 当前题目卡片（增强版） -->
          <div
            v-if="currentQuestion"
            class="flex-1 overflow-y-auto pr-2"
          >
            <el-card shadow="never" class="mb-4" style="border-radius: 14px; border: 1px solid #E8ECF0;">
              <!-- 题目标题行 -->
              <div class="flex items-center gap-2 mb-4">
                <el-tag :type="currentQuestion.type === 'single' ? 'primary' : currentQuestion.type === 'fill-blank' ? 'warning' : 'info'" class="!rounded-full">
                  {{ currentQuestion.type === 'single' ? '📝 单选题' : currentQuestion.type === 'fill-blank' ? '✏️ 填空题' : '📖 简答题' }}
                </el-tag>
                <el-tag size="small" :type="difficultyType(currentQuestion.difficulty)" class="!rounded-full">
                  {{ difficultyLabel(currentQuestion.difficulty) }}
                </el-tag>
                <!-- 个性化推送原因 -->
                <el-tag size="small" type="info" effect="plain" class="text-xs !rounded-full" style="--el-tag-bg-color: #F5F0FF; --el-tag-border-color: #CBB5FF; --el-tag-text-color: #7C5CFC;">
                  {{ currentQuestion.pushReason }}
                </el-tag>
                <!-- 质量与置信度 -->
                <el-tag size="small" :type="confidenceType(currentQuestion.confidence)" effect="plain" class="cursor-pointer !rounded-full" @click="viewSources(currentQuestion)">
                  置信度：{{ confidenceLabel(currentQuestion.confidence) }}
                </el-tag>
                <el-button link type="primary" size="small" class="ml-auto" style="color: #2B6FFF;" @click="viewSources(currentQuestion)">
                  查看引用来源（{{ currentQuestion.sources.length }}）
                </el-button>
              </div>

              <!-- 题干：浅蓝背景 #E8F0FE -->
              <div class="p-4 rounded-xl mb-6 border" style="background: #E8F0FE; border-color: #D6E4FF;">
                <p class="text-lg font-medium leading-relaxed" style="color: #1A1A2E;">{{ currentQuestion.stem }}</p>
              </div>

              <!-- 单选题选项：选中状态用蓝色 #2B6FFF -->
              <div v-if="currentQuestion.type === 'single' && currentQuestion.options" class="space-y-3 mb-4">
                <div
                  v-for="opt in currentQuestion.options"
                  :key="opt.label"
                  class="flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-200"
                  :class="answerRecords[currentQuestion.id] === opt.label ? 'shadow-sm' : ''"
                  :style="answerRecords[currentQuestion.id] === opt.label
                    ? 'border-color: #2B6FFF; background-color: #E8F0FE;'
                    : 'border-color: #E8ECF0;'"
                  @click="selectAnswer(currentQuestion.id, opt.label)"
                >
                  <div
                    class="w-7 h-7 rounded-full flex items-center justify-center mr-3 text-sm font-semibold transition-all duration-200"
                    :class="answerRecords[currentQuestion.id] === opt.label ? 'text-white shadow-sm' : ''"
                    :style="answerRecords[currentQuestion.id] === opt.label
                      ? 'background-color: #2B6FFF;'
                      : 'background-color: #F5F7FA; color: #8E8EA0;'"
                  >
                    {{ opt.label }}
                  </div>
                  <span style="color: #5A5A72;">{{ opt.text }}</span>
                </div>
              </div>

              <!-- 填空题 -->
              <div v-if="currentQuestion.type === 'fill-blank'" class="mb-4">
                <el-input
                  :model-value="answerRecords[currentQuestion.id] || ''"
                  :placeholder="currentQuestion.placeholder || '请输入答案'"
                  size="large"
                  class="max-w-lg"
                  @input="(val: string) => selectAnswer(currentQuestion.id, val)"
                />
              </div>

              <!-- 简答题 -->
              <div v-if="currentQuestion.type === 'short-answer'" class="mb-4">
                <el-input
                  :model-value="answerRecords[currentQuestion.id] || ''"
                  :placeholder="currentQuestion.placeholder || '请输入你的回答'"
                  type="textarea"
                  :rows="5"
                  :maxlength="500"
                  show-word-limit
                  @input="(val: string) => selectAnswer(currentQuestion.id, val)"
                />
              </div>

              <!-- 答题状态提示 -->
              <div class="mt-4 text-sm text-gray-500">
                <template v-if="answerRecords[currentQuestion.id] && answerRecords[currentQuestion.id].trim()">
                  <span class="text-success">- 已作答</span>
                </template>
                <template v-else>
                  <span class="text-gray-400">等待作答...</span>
                </template>
              </div>
            </el-card>
          </div>
          <div v-else class="flex-1 flex items-center justify-center text-gray-400">
            <p>暂无符合条件的题目</p>
          </div>
        </div>
      </template>
    </div>

    <!-- ===== 右侧侧栏：进度总览（只在答题模式显示） ===== -->
    <div
      v-if="activeView === 'list'"
      class="w-72 lg:w-80 flex-shrink-0 ml-4 hidden lg:block"
    >
      <el-card shadow="never" class="sticky top-0">
        <h3 class="text-sm font-semibold text-gray-800 mb-4">答题概览</h3>

        <!-- 进度环 -->
        <div class="flex flex-col items-center mb-6">
          <el-progress
            type="circle"
            :percentage="progressPercent"
            :width="80"
            :stroke-width="6"
          />
          <p class="text-xs text-gray-500 mt-2">{{ answeredCount }}/{{ totalQuestions }} 题已答</p>
        </div>

        <!-- 题目列表 -->
        <div class="space-y-1">
          <div
            v-for="(q, idx) in questions"
            :key="q.id"
            class="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-50 text-sm"
            :class="currentQuestionIndex === idx ? 'bg-primary/5 text-primary' : ''"
            @click="goToQuestion(idx)"
          >
            <div
              class="w-2 h-2 rounded-full flex-shrink-0"
              :class="answerRecords[q.id] && answerRecords[q.id].trim() ? 'bg-success' : 'bg-gray-300'"
            />
            <span class="flex-1 truncate">第 {{ idx + 1 }} 题</span>
            <el-tag size="small" :type="q.type === 'single' ? 'primary' : q.type === 'fill-blank' ? 'warning' : 'info'" class="flex-shrink-0">
              {{ q.type === 'single' ? '单选' : q.type === 'fill-blank' ? '填空' : '简答' }}
            </el-tag>
          </div>
        </div>

        <el-divider class="my-4" />
        <el-button
          type="primary"
          class="w-full"
          :disabled="!allAnswered"
          @click="submitAnswers"
        >
          {{ allAnswered ? '提交答案' : `还有 ${totalQuestions - answeredCount} 题未答` }}
        </el-button>

        <!-- 画像快照（小） -->
        <div class="mt-6 pt-4 border-t border-gray-100">
          <h4 class="text-xs font-semibold text-gray-700 mb-2">针对画像维度</h4>
          <div class="flex flex-wrap gap-1.5">
            <el-tag size="small" type="danger">薄弱：A*搜索</el-tag>
            <el-tag size="small" type="warning">偏好：代码实操</el-tag>
            <el-tag size="small" type="info">节奏：15分钟/天</el-tag>
          </div>
        </div>
      </el-card>
    </div>

    <!-- ===== Evidence Drawer ===== -->
    <EvidenceDrawer ref="evidenceDrawer" />
  </div>
</template>
