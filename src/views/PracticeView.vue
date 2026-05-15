<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import EvidenceDrawer from '@/components/EvidenceDrawer.vue'
import PracticeIcon from '@/components/icons/PracticeIcon.vue'

const router = useRouter()

// ===== Type Definitions =====
type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILL_IN_BLANK' | 'SHORT_ANSWER'
type Difficulty = number  // 1-5 五级难度标准
type Confidence = 'high' | 'medium' | 'low'

interface Source {
  title: string
  locator: string
  quote: string
  relevance?: 'high' | 'medium' | 'low'
}

interface Question {
  id: number
  type: QuestionType
  content: string              // 题干，支持 LaTeX（$...$ / $$...$$）
  options: string[] | null     // 选择题/判断题选项，填空/简答为 null
  answer: string
  analysis: string             // 详细解析
  difficulty: Difficulty       // 1-5 五级难度
  knowledgePoint: string       // 对应知识点
  // --- 前端展示扩展字段 ---
  sources: Source[]
  confidence: Confidence
  qualityScore: number
  pushReason: string
}

interface ResultItem {
  questionId: number
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

// Difficulty filter (5-level)
const difficultyFilter = ref<number | 'all'>('all')

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
    id: 1,
    type: 'SINGLE_CHOICE',
    content: '在 A* 搜索算法中，估值函数 $f(n)$ 的正确计算公式是？',
    options: ['A. f(n) = g(n)', 'B. f(n) = h(n)', 'C. f(n) = g(n) + h(n)', 'D. f(n) = g(n) \\times h(n)'],
    answer: 'C',
    analysis: '本题考察 A* 算法核心公式识记（Level 1）。A* 估值函数 $f(n) = g(n) + h(n)$，其中 $g(n)$ 是从起点到节点 $n$ 的实际代价，$h(n)$ 是从 $n$ 到目标的启发式估计代价。干扰项：A 遗漏启发式分量（退化为 Dijkstra）；B 仅保留启发式（退化为贪心搜索）；D 将加法误为乘法。',
    difficulty: 1,
    knowledgePoint: 'A* 搜索算法',
    sources: [
      { title: '算法导论 第4版', locator: 'Ch 22.3', quote: 'A* 搜索使用评估函数 f(n) = g(n) + h(n) 来评估节点优先级。', relevance: 'high' },
      { title: '人工智能：一种现代方法', locator: 'Pg 189', quote: 'A* 算法结合了 Dijkstra 算法（g(n)）和贪心最佳优先搜索（h(n)）的思想。', relevance: 'high' }
    ],
    confidence: 'high',
    qualityScore: 95,
    pushReason: '针对薄弱点：A* 核心公式'
  },
  {
    id: 2,
    type: 'SINGLE_CHOICE',
    content: '以下哪种启发式函数 $h(n)$ 是「可采纳的（Admissible）」？',
    options: ['A. h(n) 始终大于真实代价', 'B. h(n) 始终小于等于真实代价', 'C. h(n) 始终等于真实代价', 'D. h(n) 与真实代价无关'],
    answer: 'B',
    analysis: '本题考察可采纳启发式的定义理解（Level 2）。可采纳启发式要求 $h(n) \\leq h^*(n)$ 对所有节点 $n$ 成立，即永远不高估实际代价——这是 A* 最优性的充分条件。干扰项：A 描述的是「过度估计」；C 过于严格（完美启发式理想情况）；D 忽略启发式设计的核心约束。',
    difficulty: 2,
    knowledgePoint: '可采纳启发式',
    sources: [
      { title: '算法导论 第4版', locator: 'Ch 22.3', quote: '如果 h(n) 是可采纳的，则 A* 保证找到最优路径。', relevance: 'high' },
      { title: '斯坦福 CS221 讲义', locator: 'Lecture 8', quote: 'Admissible heuristic never overestimates the cost to reach the goal.', relevance: 'high' }
    ],
    confidence: 'high',
    qualityScore: 88,
    pushReason: '核心概念辨析：可采纳性是A*最优性的关键'
  },
  {
    id: 3,
    type: 'FILL_IN_BLANK',
    content: '在 A* 搜索中，若启发式函数 $h(n)$ 满足一致性（Consistency）条件，也称为 ______ 性。',
    options: null,
    answer: '单调',
    analysis: '本题考察一致性条件的术语识记（Level 1）。一致性条件又称单调性（Monotonicity），要求对任意边 $(u,v)$ 有 $h(u) \\leq cost(u,v) + h(v)$。满足一致性的启发式必然也是可采纳的，且在使用闭合集优化时保证最优性。',
    difficulty: 1,
    knowledgePoint: '一致性启发式',
    sources: [
      { title: '人工智能：一种现代方法', locator: 'Pg 195', quote: '一致性条件有时也称为单调条件。', relevance: 'high' }
    ],
    confidence: 'medium',
    qualityScore: 85,
    pushReason: '偏好：概念辨析型题目'
  },
  {
    id: 4,
    type: 'SINGLE_CHOICE',
    content: '在二维网格寻路（仅允许四方向移动）中，以下哪种启发式函数通常最适合 A* 算法？',
    options: ['A. 曼哈顿距离', 'B. 欧几里得距离', 'C. 切比雪夫距离', 'D. 零启发式（h(n) = 0）'],
    answer: 'A',
    analysis: '本题考察不同场景下启发式函数的选择应用（Level 3）。四方向网格中，曼哈顿距离计算水平+垂直距离，与实际移动代价完全匹配，且不会高估（可采纳）。干扰项：B 欧几里得距离计算开销大且低估严重（扩展节点多）；C 切比雪夫距离适用于八方向移动；D 零启发式退化为 Dijkstra 算法，效率最低。',
    difficulty: 3,
    knowledgePoint: '启发式函数设计',
    sources: [
      { title: '大话数据结构', locator: 'Pg 134', quote: '曼哈顿距离在四方向格点地图中是最优的可采纳启发式。', relevance: 'high' },
      { title: 'Red Blob Games: A* 可视化教程', locator: 'Heuristics section', quote: 'For 4-direction movement, Manhattan distance is the standard heuristic.', relevance: 'medium' }
    ],
    confidence: 'high',
    qualityScore: 90,
    pushReason: '针对薄弱点：启发式函数在不同场景的选择'
  },
  {
    id: 5,
    type: 'FILL_IN_BLANK',
    content: 'A* 算法使用优先队列（最小堆）管理待扩展节点，每次取出 $f(n)$ 值最 ______ 的节点进行扩展。',
    options: null,
    answer: '小',
    analysis: '本题考察 A* 算法流程理解（Level 2）。A* 使用最小堆按 $f(n)$ 值升序管理开放集（Open Set），每次取出 $f(n)$ 最小的节点扩展——确保优先探索最有希望的路径，这是 A* 高效性的关键机制。',
    difficulty: 2,
    knowledgePoint: 'A* 搜索算法',
    sources: [
      { title: '数据结构与算法分析', locator: 'Ch 9.3', quote: '优先队列是 A* 算法的核心数据结构，保证了每次扩展最优节点。', relevance: 'high' }
    ],
    confidence: 'medium',
    qualityScore: 82,
    pushReason: '节奏：15分钟/天，侧重基础概念'
  },
  {
    id: 6,
    type: 'SHORT_ANSWER',
    content: '请简要说明 A* 算法与 Dijkstra 算法的核心区别，并分析 A* 在什么条件下退化为 Dijkstra 算法？',
    options: null,
    answer: 'A* 使用 f(n)=g(n)+h(n) 评估节点优先级，Dijkstra 仅使用 g(n)。当 h(n)=0 时 A* 退化为 Dijkstra，因为此时 f(n)=g(n)，扩展顺序与 Dijkstra 完全一致。',
    analysis: '本题考察算法对比分析能力（Level 4）。A* 与 Dijkstra 的本质区别在于搜索策略：A* 利用启发式信息 $h(n)$ 引导方向性搜索，Dijkstra 从起点向所有方向均匀扩展。当 $h(n)=0$ 时，$f(n)=g(n)$，A* 退化为 Dijkstra。另外，若 $h(n)$ 过度估计，A* 可能错过最优解。理解这一关系是掌握启发式搜索设计的关键。',
    difficulty: 4,
    knowledgePoint: 'A* 搜索算法',
    sources: [
      { title: '算法导论 第4版', locator: 'Ch 22.3-22.4', quote: 'Dijkstra 算法是 A* 算法在 h(n)=0 时的特例。', relevance: 'high' },
      { title: '人工智能：一种现代方法', locator: 'Pg 192', quote: 'A* 搜索比 Dijkstra 算法更高效，因为它使用启发式信息进行定向搜索。', relevance: 'high' }
    ],
    confidence: 'high',
    qualityScore: 93,
    pushReason: '偏好：代码实操与算法辨析'
  },
  {
    id: 7,
    type: 'SINGLE_CHOICE',
    content: '关于 A* 搜索的「最优性」条件，以下说法正确的是？',
    options: ['A. 只要 h(n) > 0，A* 就能找到最优解', 'B. 只要 h(n) 是可采纳的，A* 保证找到最优解', 'C. A* 在任何条件下都能找到最优解', 'D. A* 的最优性与启发式函数无关'],
    answer: 'B',
    analysis: '本题考察最优性条件的理解辨析（Level 3）。A* 的最优性充分条件是 $h(n)$ 可采纳（不高估）。干扰项：A 混淆了「正启发式」和「可采纳启发式」；C 忽略前提条件；D 与算法理论直接矛盾。注意：在树搜索版本中可采纳性足够，在图搜索版本中还需一致性保证。',
    difficulty: 3,
    knowledgePoint: 'A* 最优性条件',
    sources: [
      { title: '算法导论 第4版', locator: 'Ch 22.3', quote: 'Theorem: If h is admissible, A* is optimal.', relevance: 'high' },
      { title: '人工智能：一种现代方法', locator: 'Pg 192-194', quote: 'A* 是可采纳的，前提是 h(n) 是可采纳的。', relevance: 'high' }
    ],
    confidence: 'high',
    qualityScore: 91,
    pushReason: '核心定理辨析：A* 最优性条件'
  },
  {
    id: 8,
    type: 'SHORT_ANSWER',
    content: '举一个实际场景，说明为什么启发式函数 $h(n)$ 选择不当会导致 A* 搜索效率下降甚至找不到最优解。',
    options: null,
    answer: '以游戏寻路为例：若在四方向迷宫中使用欧几里得距离（低估严重），A* 会扩展过多节点导致效率低下；若使用高估启发式（如 h(n)=2×真实代价），A* 可能错过实际最优路径。',
    analysis: '本题考察评价与创造能力（Level 5）。关键在于区分两类问题：①不准确的但可采纳的启发式（如欧几里得距离用于四方向网格）仅降低效率，不破坏最优性——因为不高估；②过度估计的启发式破坏最优性——因为可能跳过包含最优解的节点。优秀的启发式应在「可采纳」前提下尽量「接近真实代价」。',
    difficulty: 5,
    knowledgePoint: '启发式函数设计',
    sources: [
      { title: 'Red Blob Games: A* 可视化教程', locator: 'Heuristics section', quote: 'Choosing an appropriate heuristic depends on the type of movement allowed.', relevance: 'high' },
      { title: 'AI Game Programming Wisdom', locator: 'Ch 3.2', quote: 'Overestimating heuristics can lead to suboptimal paths in practical applications.', relevance: 'medium' }
    ],
    confidence: 'medium',
    qualityScore: 87,
    pushReason: '偏好：代码实操与场景分析'
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
  // 从答错题目的 analysis 中提取错因关键词（概念混淆、公式错误、计算失误等）
  const tagCount = new Map<string, number>()
  const errorPatterns = ['概念混淆', '公式错误', '计算失误', '理解偏差', '逻辑陷阱', '场景应用', '分析不完整']
  results.value.forEach(r => {
    if (!r.isCorrect) {
      const q = questions.value.find(q => q.id === r.questionId)
      if (q) {
        errorPatterns.forEach(pattern => {
          if (q.analysis.includes(pattern)) {
            tagCount.set(pattern, (tagCount.get(pattern) || 0) + 1)
          }
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
        const kp = q.knowledgePoint
        kpCount.set(kp, (kpCount.get(kp) || 0) + 1)
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
  const map: Record<number, string> = { 1: 'L1 识记', 2: 'L2 理解', 3: 'L3 应用', 4: 'L4 分析', 5: 'L5 评价' }
  return map[d] || `L${d}`
}

const difficultyType = (d: Difficulty): 'success' | 'warning' | 'danger' | 'info' => {
  if (d <= 2) return 'success'
  if (d === 3) return 'warning'
  return 'danger'
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

const selectAnswer = (questionId: number, value: string) => {
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
    if (q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE' || q.type === 'TRUE_FALSE') {
      isCorrect = checkSingleChoice(q, userAns)
    } else if (q.type === 'FILL_IN_BLANK') {
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

const getQuestionStatus = (qId: number): 'success' | 'danger' | 'info' => {
  if (!submitted.value) return 'info'
  const r = results.value.find(res => res.questionId === qId)
  if (!r) return 'info'
  return r.isCorrect ? 'success' : 'danger'
}

const getQuestionIcon = (qId: number): string => {
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
            <PracticeIcon :size="36" />
            <div>
              <h1 class="text-2xl font-bold" style="color: #1A1A2E;">定制练习</h1>
              <p class="text-sm mt-0.5" style="color: #8E8EA0;">
                基于「<span style="color: #2B6FFF; font-weight: 500;">{{ practiceMeta.knowledgePoint }}</span>」生成 · 共 {{ practiceMeta.totalQuestions }} 题 · 预估 {{ practiceMeta.estimatedMinutes }} 分钟
              </p>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <el-select v-model="difficultyFilter" size="small" class="w-32" @change="currentQuestionIndex = 0" style="--el-border-radius-base: 20px;">
            <el-option label="全部难度" :value="'all'" />
            <el-option label="L1 识记" :value="1" />
            <el-option label="L2 理解" :value="2" />
            <el-option label="L3 应用" :value="3" />
            <el-option label="L4 分析" :value="4" />
            <el-option label="L5 评价" :value="5" />
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
                    <el-tag size="small" :type="q.type === 'SINGLE_CHOICE' ? 'primary' : q.type === 'FILL_IN_BLANK' ? 'warning' : 'info'">
                      {{ q.type === 'SINGLE_CHOICE' ? '单选题' : q.type === 'FILL_IN_BLANK' ? '填空题' : '简答题' }}
                    </el-tag>
                    <el-tag size="small" :type="difficultyType(q.difficulty)">{{ difficultyLabel(q.difficulty) }}</el-tag>
                    <el-tag size="small" type="info" effect="plain" class="text-xs">{{ q.pushReason }}</el-tag>
                  </div>
                  <p class="text-base font-medium text-gray-900 mb-3">{{ q.content }}</p>

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
                      <el-tag size="small" type="info" effect="plain">
                        {{ q.knowledgePoint }}
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
                <el-tag :type="currentQuestion.type === 'SINGLE_CHOICE' ? 'primary' : currentQuestion.type === 'FILL_IN_BLANK' ? 'warning' : 'info'" class="!rounded-full">
                  {{ currentQuestion.type === 'SINGLE_CHOICE' ? '单选题' : currentQuestion.type === 'FILL_IN_BLANK' ? '填空题' : '简答题' }}
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
                <p class="text-lg font-medium leading-relaxed" style="color: #1A1A2E;">{{ currentQuestion.content }}</p>
              </div>

              <!-- 单选题选项：选中状态用蓝色 #2B6FFF -->
              <div v-if="(currentQuestion.type === 'SINGLE_CHOICE' || currentQuestion.type === 'MULTIPLE_CHOICE') && currentQuestion.options" class="space-y-3 mb-4">
                <div
                  v-for="opt in currentQuestion.options"
                  :key="opt"
                  class="flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-200"
                  :class="answerRecords[currentQuestion.id] === opt.substring(0, 1) ? 'shadow-sm' : ''"
                  :style="answerRecords[currentQuestion.id] === opt.substring(0, 1)
                    ? 'border-color: #2B6FFF; background-color: #E8F0FE;'
                    : 'border-color: #E8ECF0;'"
                  @click="selectAnswer(currentQuestion.id, opt.substring(0, 1))"
                >
                  <div
                    class="w-7 h-7 rounded-full flex items-center justify-center mr-3 text-sm font-semibold transition-all duration-200"
                    :class="answerRecords[currentQuestion.id] === opt.substring(0, 1) ? 'text-white shadow-sm' : ''"
                    :style="answerRecords[currentQuestion.id] === opt.substring(0, 1)
                      ? 'background-color: #2B6FFF;'
                      : 'background-color: #F5F7FA; color: #8E8EA0;'"
                  >
                    {{ opt.substring(0, 1) }}
                  </div>
                  <span style="color: #5A5A72;">{{ opt.substring(3) }}</span>
                </div>
              </div>

              <!-- 填空题 -->
              <div v-if="currentQuestion.type === 'FILL_IN_BLANK'" class="mb-4">
                <el-input
                  :model-value="answerRecords[currentQuestion.id] || ''"
                  placeholder="请输入答案"
                  size="large"
                  class="max-w-lg"
                  @input="(val: string) => selectAnswer(currentQuestion.id, val)"
                />
              </div>

              <!-- 简答题 -->
              <div v-if="currentQuestion.type === 'SHORT_ANSWER'" class="mb-4">
                <el-input
                  :model-value="answerRecords[currentQuestion.id] || ''"
                  placeholder="请输入你的回答"
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
            <el-tag size="small" :type="q.type === 'SINGLE_CHOICE' ? 'primary' : q.type === 'FILL_IN_BLANK' ? 'warning' : 'info'" class="flex-shrink-0">
              {{ q.type === 'SINGLE_CHOICE' ? '单选' : q.type === 'FILL_IN_BLANK' ? '填空' : '简答' }}
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
