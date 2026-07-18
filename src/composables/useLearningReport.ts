import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { useProfileStore } from '@/stores/profile'
import { apiFetch } from '@/utils/api'
import type { LearningStats } from '@/types'

function generateMockStats(): LearningStats {
  // 10 周模拟数据：学生选修《数据结构与算法》课程
  const weeks = ['第1周', '第2周', '第3周', '第4周', '第5周', '第6周', '第7周', '第8周', '第9周', '第10周']
  // 第4周期末考试缺席，第9周复习周爆发
  const hours = [1.5, 3.2, 2.8, 0, 4.5, 5.2, 3.8, 4.0, 7.5, 5.5]
  return {
    totalHours: hours.reduce((a, b) => a + b, 0),
    weekHours: hours[hours.length - 1],
    resourcePackCount: 15,
    weekResourcePacks: 3,
    pathProgressPercent: 52,
    weakCount: 3,
    prevWeakCount: 6,
    totalQuizScoreAvg: 68,
    radarData: [
      { name: '知识基础', value: 68 },
      { name: '学习目标', value: 85 },
      { name: '认知风格', value: 62 },
      { name: '学习节奏', value: 48 },
      { name: '专业理解', value: 75 },
      { name: '兴趣广度', value: 80 },
    ],
    weeklyActivity: weeks.map((week, i) => ({ week, hours: hours[i] })),
    profileHistory: [
      { version: 1, createdAt: '2026-04-02 10:15', trigger: 'chat', summary: ['初始画像建立', '专业：计算机科学与技术 大二', '学习目标：掌握数据结构与算法基础'] },
      { version: 2, createdAt: '2026-04-10 14:30', trigger: 'chat', summary: ['补充编程经验信息', '薄弱项识别：链表操作、递归思维', '认知风格：偏向视觉型+动手实践'] },
      { version: 3, createdAt: '2026-04-22 09:00', trigger: 'quiz', summary: ['第一次阶段测验成绩录入', '数组与链表：正确率65%', '栈与队列：正确率72%'] },
      { version: 4, createdAt: '2026-05-06 16:45', trigger: 'chat', summary: ['学习节奏调整为每两天一次', '链表操作和递归通过练习已基本掌握', '兴趣方向：对算法可视化感兴趣'] },
      { version: 5, createdAt: '2026-05-18 11:00', trigger: 'quiz', summary: ['第二次阶段测验', '树与二叉树：正确率58%', '薄弱项新增：树的遍历、动态规划入门'] },
      { version: 6, createdAt: '2026-05-30 08:20', trigger: 'path_update', summary: ['路径重新规划', '加强二叉树和排序算法模块', '递归思维已达标移除薄弱列表'] },
      { version: 7, createdAt: '2026-06-08 15:10', trigger: 'quiz', summary: ['第三次阶段测验', '排序与查找：正确率70%', '链表已完全掌握，薄弱项减至3个'] },
      { version: 8, createdAt: '2026-06-18 13:30', trigger: 'chat', summary: ['期末复习阶段画像微调', '当前薄弱项：二叉树遍历、动态规划、图的表示', '推荐优先级：树→排序→动态规划'] },
    ],
  }
}

const mockTags = {
  weakness: ['二叉树遍历', '动态规划', '图的表示'],
  mastered: ['数组与链表', '栈与队列', '递归思想', '排序算法比较', '时间复杂度分析'],
  // 已治愈项（用于支撑 prevWeakCount=6 的叙事）
  healed: ['链表操作', '递归思维', '栈与队列应用'],
}
const mockErrorPatterns = ['递归终止条件遗漏', '指针越界访问', '树形结构遍历顺序混淆', '动态规划状态转移方程错误']

// ===== 全部课程模式 =====

interface CourseProfile {
  courseName: string
  emoji: string
  hours: number[]
  radar: number[]
  weak: string[]
  mastered: string[]
  prevWeak: number
  quiz: number
  progress: number
}

const ALL_COURSE_PROFILES: CourseProfile[] = [
  { courseName: '数据结构与算法', emoji: '📊', hours: [1.5,3.2,2.8,0,4.5,5.2,3.8,4.0,7.5,5.5], radar: [68,85,62,48,75,80], weak: ['二叉树遍历','动态规划','图的表示'], mastered: ['数组与链表','栈与队列','时间复杂度'], prevWeak: 6, quiz: 68, progress: 52 },
  { courseName: '计算机网络', emoji: '🌐', hours: [2.0,2.5,3.0,3.5,2.0,4.0,3.0,2.5,4.5,3.0], radar: [75,70,80,55,60,65], weak: ['TCP拥塞控制','DNS解析','子网划分'], mastered: ['OSI模型','HTTP协议','IP地址'], prevWeak: 5, quiz: 76, progress: 65 },
  { courseName: '操作系统', emoji: '🖥️', hours: [0,1.0,1.5,2.0,2.5,0,3.0,2.0,1.5,2.0], radar: [55,60,45,70,50,55], weak: ['进程调度','内存管理','文件系统'], mastered: ['进程线程概念','同步互斥'], prevWeak: 4, quiz: 58, progress: 30 },
  { courseName: '数据库系统', emoji: '🗄️', hours: [1.0,0,2.0,1.5,0,3.0,0,2.0,0,1.5], radar: [80,90,70,65,85,60], weak: ['查询优化','事务隔离'], mastered: ['SQL','范式设计','ER图','索引'], prevWeak: 3, quiz: 85, progress: 78 },
  { courseName: '编译原理', emoji: '⚙️', hours: [0,0,1.0,0,0,2.0,0,1.0,0,1.5], radar: [40,50,35,30,45,55], weak: ['语法分析','中间代码生成','优化'], mastered: ['词法分析'], prevWeak: 3, quiz: 45, progress: 15 },
]

const COURSE_CHART_COLORS = ['#2B6FFF', '#FF8C42', '#34C759', '#7C5CFC', '#FF3B30']

function getChartColors() {
  const style = getComputedStyle(document.documentElement)
  return {
    axisLabel: style.getPropertyValue('--lt-chart-axis-label').trim() || '#8E8EA0',
    axisLine: style.getPropertyValue('--lt-chart-axis-line').trim() || '#E8ECF0',
    splitBg0: style.getPropertyValue('--lt-chart-split-bg-0').trim() || '#F5F7FA',
    splitBg1: style.getPropertyValue('--lt-chart-split-bg-1').trim() || '#EEF1F5',
    splitBg2: style.getPropertyValue('--lt-chart-split-bg-2').trim() || '#E8ECF0',
    splitBg3: style.getPropertyValue('--lt-chart-split-bg-3').trim() || '#DEE3E8',
    brand: style.getPropertyValue('--lt-brand').trim() || '#2B6FFF',
    brandLight: style.getPropertyValue('--lt-brand-lighter').trim() || '#A8C5FF',
    success: style.getPropertyValue('--lt-success').trim() || '#34C759',
    warning: style.getPropertyValue('--lt-warning').trim() || '#FF9F0A',
    danger: style.getPropertyValue('--lt-danger').trim() || '#FF3B30',
    ai: style.getPropertyValue('--lt-ai').trim() || '#7C5CFC',
    orange: style.getPropertyValue('--lt-orange').trim() || '#FF8C42',
  }
}

function generateStatsFromProfile(p: CourseProfile): LearningStats {
  const weeks = ['第1周','第2周','第3周','第4周','第5周','第6周','第7周','第8周','第9周','第10周']
  const totalHours = +(p.hours.reduce((a,b) => a+b, 0).toFixed(1))
  return {
    totalHours,
    weekHours: p.hours[p.hours.length - 1],
    resourcePackCount: Math.round(totalHours / 3),
    weekResourcePacks: Math.round(p.hours[p.hours.length - 1] / 2),
    pathProgressPercent: p.progress,
    weakCount: p.weak.length,
    prevWeakCount: p.prevWeak,
    totalQuizScoreAvg: p.quiz,
    radarData: [
      { name: '知识基础', value: p.radar[0] },
      { name: '学习目标', value: p.radar[1] },
      { name: '认知风格', value: p.radar[2] },
      { name: '学习节奏', value: p.radar[3] },
      { name: '专业理解', value: p.radar[4] },
      { name: '兴趣广度', value: p.radar[5] },
    ],
    weeklyActivity: weeks.map((week, i) => ({ week, hours: p.hours[i] })),
    profileHistory: [],
  }
}

export interface AllCourseItem {
  courseName: string
  emoji: string
  stats: LearningStats
  weakTags: string[]
  masteredTags: string[]
}

export interface CourseCardData {
  name: string
  emoji: string
  totalHours: number
  score: number
  weakCount: number
  progress: number
  color: string
}

export function useAllCoursesReport() {
  const allCourseData = computed<AllCourseItem[]>(() =>
    ALL_COURSE_PROFILES.map(p => ({
      courseName: p.courseName, emoji: p.emoji,
      stats: generateStatsFromProfile(p),
      weakTags: p.weak, masteredTags: p.mastered,
    }))
  )

  const courseCards = computed<CourseCardData[]>(() =>
    allCourseData.value.map((c, i) => {
      const radar = c.stats.radarData
      const score = radar.length ? Math.round(radar.reduce((a, d) => a + d.value, 0) / radar.length) : 0
      return {
        name: c.courseName, emoji: c.emoji,
        totalHours: c.stats.totalHours, score, weakCount: c.weakTags.length,
        progress: c.stats.pathProgressPercent,
        color: COURSE_CHART_COLORS[i % COURSE_CHART_COLORS.length],
      }
    })
  )

  const selectedCourseIndex = ref(-1)

  const totalHoursAcross = computed(() =>
    +(allCourseData.value.reduce((s, c) => s + c.stats.totalHours, 0)).toFixed(1)
  )

  const courseCount = computed(() => allCourseData.value.length)

  const allRadarOption = computed(() => {
    const cc = getChartColors()
    const indicator = ALL_COURSE_PROFILES[0].radar.map((_, i) => ({
      name: ['知识基础','学习目标','认知风格','学习节奏','专业理解','兴趣广度'][i], max: 100
    }))
    const series = allCourseData.value.map((c, i) => {
      const vals = c.stats.radarData.map(d => d.value)
      const color = COURSE_CHART_COLORS[i % COURSE_CHART_COLORS.length]
      const faded = selectedCourseIndex.value >= 0 && selectedCourseIndex.value !== i
      return {
        type: 'radar' as const,
        data: [{
          value: vals, name: c.courseName,
          itemStyle: { color, opacity: faded ? 0.2 : 1 },
          areaStyle: { color: color + (faded ? '08' : '1a') },
          lineStyle: { color, width: faded ? 1 : 2 },
        }],
        animationDuration: 600,
      }
    })
    return {
      radar: {
        indicator,
        radius: '60%',
        center: ['50%', '50%'],
        axisName: { color: cc.axisLabel, fontSize: 11 },
        splitArea: { areaStyle: { color: [cc.splitBg0, cc.splitBg1, cc.splitBg2, cc.splitBg3] } },
        axisLine: { lineStyle: { color: cc.axisLine } },
        splitLine: { lineStyle: { color: cc.axisLine } },
      },
      legend: {
        data: allCourseData.value.map(c => c.courseName),
        bottom: 0, textStyle: { fontSize: 10, color: cc.axisLabel },
      },
      series,
    }
  })

  const courseComparisonOption = computed(() => {
    const cc = getChartColors()
    const names = allCourseData.value.map(c => c.courseName)
    const scores = allCourseData.value.map(c => {
      const r = c.stats.radarData
      return r.length ? Math.round(r.reduce((a, d) => a + d.value, 0) / r.length) : 0
    })
    const hours = allCourseData.value.map(c => c.stats.totalHours)
    const maxHours = Math.max(...hours, 1)

    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        formatter: (params: any[]) => {
          let s = `<strong>${params[0].axisValue}</strong><br/>`
          params.forEach((p: any) => {
            if (p.seriesName === '综合评分') s += `${p.marker} 评分：${p.value} 分<br/>`
            if (p.seriesName === '总学时') s += `${p.marker} 学时：${p.value} h<br/>`
          })
          return s
        },
      },
      legend: {
        data: ['综合评分', '总学时'],
        bottom: 0, textStyle: { fontSize: 11, color: cc.axisLabel },
      },
      grid: { left: 40, right: 40, bottom: 40, top: 10 },
      xAxis: { type: 'category' as const, data: names, axisLabel: { color: cc.axisLabel, fontSize: 10 } },
      yAxis: [
        { type: 'value' as const, name: '评分', min: 0, max: 100, axisLabel: { color: cc.axisLabel, fontSize: 9 }, splitLine: { lineStyle: { color: cc.splitBg1 } } },
        { type: 'value' as const, name: '学时/h', axisLabel: { color: cc.axisLabel, fontSize: 9 }, splitLine: { show: false } },
      ],
      series: [
        {
          name: '综合评分', type: 'bar' as const, data: scores, yAxisIndex: 0,
          barWidth: 14, barGap: '30%',
          itemStyle: {
            color: (p: any) => {
              const ci = p.dataIndex
              return selectedCourseIndex.value >= 0 && selectedCourseIndex.value !== ci
                ? COURSE_CHART_COLORS[ci % COURSE_CHART_COLORS.length] + '40'
                : COURSE_CHART_COLORS[ci % COURSE_CHART_COLORS.length]
            },
            borderRadius: [3, 3, 0, 0],
          },
          label: { show: true, position: 'top', fontSize: 10, color: cc.axisLabel, formatter: (p: any) => p.value + '' },
        },
        {
          name: '总学时', type: 'bar' as const, data: hours, yAxisIndex: 1,
          barWidth: 14,
          itemStyle: {
            color: (p: any) => {
              const ci = p.dataIndex
              const c = COURSE_CHART_COLORS[ci % COURSE_CHART_COLORS.length]
              const faded = selectedCourseIndex.value >= 0 && selectedCourseIndex.value !== ci
              return faded ? c + '30' : c + '80'
            },
            borderRadius: [3, 3, 0, 0],
          },
          label: { show: true, position: 'top', fontSize: 10, color: cc.axisLabel, formatter: (p: any) => p.value + 'h' },
        },
      ],
    }
  })

  const timeDistributionOption = computed(() => {
    const cc = getChartColors()
    const data = allCourseData.value.map((c, i) => ({
      name: c.courseName,
      value: c.stats.totalHours,
      itemStyle: { color: COURSE_CHART_COLORS[i % COURSE_CHART_COLORS.length] },
    }))
    return {
      tooltip: { trigger: 'item' as const, formatter: (p: any) => `${p.name}<br/>${p.value}h（${p.percent}%）` },
      series: [{
        type: 'pie' as const, radius: ['45%', '70%'], center: ['50%', '45%'],
        data,
        label: { fontSize: 10, color: cc.axisLabel, formatter: (p: any) => `${p.name}\n${p.value}h` },
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.2)' } },
      }],
    }
  })

  const allWeakAnalysis = computed(() => {
    const allWeak = new Map<string, number>()
    const allMastered = new Map<string, number>()
    allCourseData.value.forEach(c => {
      c.weakTags.forEach(t => allWeak.set(t, (allWeak.get(t) || 0) + 1))
      c.masteredTags.forEach(t => allMastered.set(t, (allMastered.get(t) || 0) + 1))
    })
    const totalWeak = allWeak.size
    const totalMastered = allMastered.size
    const crossCutting = [...allWeak.entries()].filter(([_, count]) => count > 1).map(([tag, count]) => `${tag}（${count}门）`)
    return {
      totalWeak,
      totalMastered,
      crossCutting,
      weakList: [...allWeak.entries()].map(([tag, count]) => ({ tag, count })),
    }
  })

  const overallAvgScore = computed(() => {
    const scores = courseCards.value.map(c => c.score)
    return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
  })

  const bestCourse = computed(() => {
    const cards = courseCards.value
    if (!cards.length) return null
    return [...cards].sort((a, b) => b.score - a.score)[0]
  })

  const mostInvestedCourse = computed(() => {
    const cards = courseCards.value
    if (!cards.length) return null
    return [...cards].sort((a, b) => b.totalHours - a.totalHours)[0]
  })

  const mergedTrendOption = computed(() => {
    const cc = getChartColors()
    const weeks = ALL_COURSE_PROFILES[0].hours.map((_, i) => `第${i + 1}周`)
    const series = allCourseData.value.map((c, i) => ({
      name: c.courseName,
      type: 'line' as const,
      data: c.stats.weeklyActivity.map(w => w.hours),
      smooth: true,
      symbol: 'circle' as const,
      symbolSize: 4,
      lineStyle: { color: COURSE_CHART_COLORS[i % COURSE_CHART_COLORS.length], width: 2 },
      itemStyle: { color: COURSE_CHART_COLORS[i % COURSE_CHART_COLORS.length] },
    }))
    return {
      tooltip: { trigger: 'axis' as const },
      legend: {
        data: allCourseData.value.map(c => c.courseName),
        bottom: 0, textStyle: { fontSize: 10, color: cc.axisLabel },
      },
      grid: { left: 35, right: 10, bottom: 40, top: 5 },
      xAxis: { type: 'category' as const, data: weeks, axisLabel: { color: cc.axisLabel, fontSize: 9 } },
      yAxis: { type: 'value' as const, axisLabel: { color: cc.axisLabel, fontSize: 9 }, splitLine: { lineStyle: { color: cc.splitBg1 } } },
      series,
    }
  })

  function selectCourse(index: number) {
    selectedCourseIndex.value = selectedCourseIndex.value === index ? -1 : index
  }

  return {
    allCourseData, courseCards, selectedCourseIndex,
    totalHoursAcross, courseCount,
    allRadarOption, courseComparisonOption, timeDistributionOption,
    mergedTrendOption,
    allWeakAnalysis, overallAvgScore, bestCourse, mostInvestedCourse,
    selectCourse,
  }
}

export interface MetricCardData {
  id: string
  label: string
  value: number | string
  unit: string
  delta: number | null
  deltaText: string
  improving: boolean
  sparkline: number[]
  color: string
  bg: string
}

export interface WeakAnalysisData {
  currentCount: number
  previousCount: number
  healedCount: number
  healRate: number
  tags: string[]
  mastered: string[]
  errorPatterns: string[]
}

export function useLearningReport(
  courseId: Ref<string | null> | ComputedRef<string | null>
) {
  const profile = useProfileStore()
  const stats = ref<LearningStats | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const hasData = computed(() => {
    const s = stats.value
    if (!s) return false
    return (s.weeklyActivity?.length ?? 0) > 0 || (s.totalHours ?? 0) > 0
  })

  function loadMockData() {
    stats.value = generateMockStats()
  }

  async function fetchStats() {
    const cid = courseId.value
    if (!cid) { loadMockData(); return }
    loading.value = true
    error.value = null
    try {
      const res = await apiFetch<LearningStats>(`/user/me/stats?courseId=${encodeURIComponent(cid)}`)
      stats.value = res.data
    } catch {
      loadMockData()
    } finally {
      loading.value = false
    }
  }

  // 初始加载模拟数据，确保页面可预览
  loadMockData()

  watch(() => courseId.value, (val) => {
    if (val) fetchStats()
  })

  const colors = {
    brand: 'var(--lt-brand)',
    brandBg: 'rgba(43, 111, 255, 0.08)',
    success: 'var(--lt-success)',
    successBg: 'rgba(52, 199, 89, 0.08)',
    warning: 'var(--lt-warning)',
    warningBg: 'rgba(255, 159, 10, 0.08)',
    danger: 'var(--lt-danger)',
    dangerBg: 'rgba(255, 59, 48, 0.08)',
    ai: 'var(--lt-ai)',
  }

  /** 三个核心累积指标（区别于 Dashboard 的实时指标） */
  const insightCards = computed(() => {
    const s = stats.value
    if (!s) return []

    const weeks = s.weeklyActivity ?? []
    const activeWeeks = weeks.filter(w => w.hours > 0).length
    const totalWeeks = weeks.length
    const radarValues = s.radarData ?? []
    const avgMastery = radarValues.length > 0
      ? Math.round(radarValues.reduce((a, d) => a + d.value, 0) / radarValues.length)
      : 0

    return [
      {
        id: 'total', label: '累计学时', value: s.totalHours ?? 0, unit: 'h',
        icon: '📚', color: colors.brand, bg: colors.brandBg,
      },
      {
        id: 'weeks', label: '学习活跃周', value: activeWeeks, unit: `/ ${totalWeeks} 周`,
        icon: '📅', color: colors.success, bg: colors.successBg,
      },
      {
        id: 'mastery', label: '综合掌握度', value: avgMastery, unit: '%',
        icon: '🎯', color: colors.ai, bg: colors.brandBg,
      },
    ]
  })

  /** 周环比变化（用于洞察横幅） */
  const weekOverWeekChange = computed(() => {
    const s = stats.value
    if (!s?.weeklyActivity || s.weeklyActivity.length < 2) return null
    const hours = s.weeklyActivity.map(w => w.hours)
    const cur = hours[hours.length - 1]
    const prev = hours[hours.length - 2]
    if (prev === 0) return null
    const diff = +(cur - prev).toFixed(1)
    const pct = Math.round((diff / prev) * 100)
    return { cur, prev, diff, pct }
  })

  const metrics = computed<MetricCardData[]>(() => {
    const s = stats.value
    if (!s) return []

    const hours = (s.weeklyActivity ?? []).map(w => w.hours)
    const cur = hours.length > 0 ? hours[hours.length - 1] : 0
    const prev = hours.length > 1 ? hours[hours.length - 2] : null
    const hDelta = prev !== null ? +((cur as number) - prev).toFixed(1) : null

    const weakDelta = (s.prevWeakCount ?? 0) - (s.weakCount ?? 0)

    return [
      {
        id: 'hours', label: '本周学习时长', value: cur, unit: 'h',
        delta: hDelta,
        deltaText: hDelta !== null ? (hDelta >= 0 ? `+${hDelta}` : `${hDelta}`) : '--',
        improving: hDelta !== null && hDelta >= 0,
        sparkline: hours.slice(-8),
        color: colors.brand, bg: colors.brandBg,
      },
      {
        id: 'weak', label: '薄弱项变化', value: s.weakCount, unit: '个',
        delta: weakDelta,
        deltaText: weakDelta > 0 ? `治愈 ${weakDelta}` : weakDelta < 0 ? `新增 ${Math.abs(weakDelta)}` : '持平',
        improving: weakDelta >= 0,
        sparkline: [],
        color: weakDelta >= 0 ? colors.success : colors.danger,
        bg: weakDelta >= 0 ? colors.successBg : colors.dangerBg,
      },
      {
        id: 'score', label: '练习平均分', value: s.totalQuizScoreAvg ?? '--', unit: '分',
        delta: null, deltaText: '--', improving: true,
        sparkline: [],
        color: colors.warning, bg: colors.warningBg,
      },
      {
        id: 'progress', label: '路径完成度', value: s.pathProgressPercent ?? 0, unit: '%',
        delta: null, deltaText: '--', improving: true,
        sparkline: [],
        color: colors.ai, bg: colors.brandBg,
      },
    ]
  })

  const weakAnalysis = computed<WeakAnalysisData>(() => {
    const prev = stats.value?.prevWeakCount ?? 0
    const curr = stats.value?.weakCount ?? 0
    const healed = Math.max(0, prev - curr)
    const storeTags = profile.tags
    return {
      currentCount: curr,
      previousCount: prev,
      healedCount: healed,
      healRate: prev > 0 ? Math.round((healed / prev) * 100) : 0,
      tags: (storeTags?.weakness?.length ? storeTags.weakness : mockTags.weakness) as string[],
      mastered: (storeTags?.mastered?.length ? storeTags.mastered : mockTags.mastered) as string[],
      errorPatterns: mockErrorPatterns,
    }
  })

  const radarOption = computed(() => {
    const s = stats.value
    const cc = getChartColors()
    const indicator = (s?.radarData ?? []).map(d => ({ name: d.name, max: 100 }))
    const values = (s?.radarData ?? []).map(d => d.value)

    return {
      radar: {
        indicator,
        radius: '60%',
        axisName: { color: cc.axisLabel, fontSize: 11 },
        splitArea: { areaStyle: { color: [cc.splitBg0, cc.splitBg1, cc.splitBg2, cc.splitBg3] } },
        axisLine: { lineStyle: { color: cc.axisLine } },
        splitLine: { lineStyle: { color: cc.axisLine } },
      },
      series: [{
        type: 'radar',
        data: [{
          value: values,
          name: '当前',
          itemStyle: { color: cc.brand },
          areaStyle: { color: cc.brand + '1a' },
          lineStyle: { color: cc.brand, width: 2 },
        }],
        animationDuration: 800,
      }],
    }
  })

  const trendOption = computed(() => {
    const s = stats.value
    const cc = getChartColors()
    const weeks = (s?.weeklyActivity ?? []).map(w => w.week)
    const hours = (s?.weeklyActivity ?? []).map(w => w.hours)

    const movingAvg = hours.map((_, i) => {
      const slice = hours.slice(Math.max(0, i - 2), i + 1)
      return +(slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(1)
    })

    return {
      tooltip: { trigger: 'axis' as const },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: weeks,
        axisLine: { lineStyle: { color: cc.axisLine } },
        axisLabel: { color: cc.axisLabel, fontSize: 11 },
      },
      yAxis: {
        type: 'value' as const,
        name: '小时',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: cc.splitBg1 } },
        axisLabel: { color: cc.axisLabel, fontSize: 11 },
      },
      series: [
        {
          name: '学习时长',
          data: hours,
          type: 'bar' as const,
          barWidth: 18,
          itemStyle: { color: cc.brand, borderRadius: [4, 4, 0, 0] },
        },
        {
          name: '趋势',
          data: movingAvg,
          type: 'line' as const,
          smooth: true,
          lineStyle: { color: cc.ai, width: 2 },
          symbol: 'none',
          z: 2,
        },
      ],
    }
  })

  const versionHistory = computed(() => {
    return (stats.value?.profileHistory ?? []).map(h => ({
      ...h,
      label: h.trigger === 'chat' ? '对话更新' :
             h.trigger === 'quiz' ? '练习更新' :
             h.trigger === 'path_update' ? '路径调整' : h.trigger,
    }))
  })

  const behaviorDetails = computed(() => {
    const s = stats.value
    const hours = (s?.weeklyActivity ?? []).map(w => w.hours)
    const avg = hours.length > 0
      ? +(hours.reduce((a, b) => a + b, 0) / hours.length).toFixed(1)
      : 0
    const max = hours.length > 0 ? Math.max(...hours) : 0
    return {
      totalHours: s?.totalHours ?? 0,
      avgDaily: avg,
      maxWeekDay: max,
      totalResources: s?.resourcePackCount ?? 0,
      weekResources: s?.weekResourcePacks ?? 0,
      totalQuizzes: 0,
    }
  })

  return {
    stats, loading, error, hasData,
    metrics, weakAnalysis, radarOption, trendOption,
    versionHistory, behaviorDetails,
    insightCards, weekOverWeekChange,
    getChartColors, refresh: fetchStats,
  }
}
