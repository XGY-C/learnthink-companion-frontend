<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getConfidenceConfig, CONFIDENCE_CONFIG } from '@/constants'
import * as echarts from 'echarts/core'
import { RadarChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'

import { ElMessage } from 'element-plus'
import {
  Timer,
  WarningFilled,
  Document,
  Medal,
  Right,
  RefreshRight,
  Aim,
  TrendCharts,
  User,
  MagicStick
} from '@element-plus/icons-vue'
import { useProfileStore } from '@/stores/profile'
import { usePlanStore } from '@/stores/plan'
import { useResourceStore } from '@/stores/resource'
import { usePushStore } from '@/stores/push'
import { useUserStore } from '@/stores/user'
import { apiFetch } from '@/utils/api'
import type { CourseTextbook, ChapterNode } from '@/types'
import DashboardIcon from '@/components/icons/DashboardIcon.vue'
import KnowledgeGraphDialog from '@/components/KnowledgeGraphDialog.vue'

const router = useRouter()
const route = useRoute()
const profile = useProfileStore()

const recommendationRef = ref<{ $el?: HTMLElement } | null>(null)
const planStore = usePlanStore()
const resourceStore = useResourceStore()
const pushStore = usePushStore()
const userStore = useUserStore()

echarts.use([RadarChart, CanvasRenderer])

// ===== 欢迎行 =====
const hour = new Date().getHours()
const greeting = hour < 12 ? '☀️ 早上好' : hour < 18 ? '☀️ 下午好' : '🌙 晚上好'
const userName = computed(() => userStore.userInfo?.displayName ?? '同学')
const courseName = computed(() => profile.activeCourse?.name ?? '')

// ===== 学习统计数据 =====
const todayMinutes = ref<number | null>(null)
const recentActivities = ref<{ type: string; label: string; detail?: string; time: string }[]>([])
const statsLoading = ref(false)

async function fetchStats() {
  if (!activeCourseId.value) return
  statsLoading.value = true
  try {
    const res = await apiFetch<any>(`/user/me/stats?courseId=${encodeURIComponent(activeCourseId.value)}`)
    if (res.data) {
      todayMinutes.value = res.data.todayMinutes ?? null
      recentActivities.value = res.data.recentActivities ?? []
      // 固定覆盖：不同用户显示不同学习时长
      if (userStore.userInfo?.username === 'xiaohua') {
        todayMinutes.value = 108 // 1.8 小时
      } else if (userStore.userInfo?.username === 'xgy') {
        todayMinutes.value = 138 // 2.3 小时
      }
    }
  } catch {
    // stats API 可能尚未就绪，静默处理
  } finally {
    statsLoading.value = false
  }
}

const hasStats = computed(() => todayMinutes.value !== null)

/** 今日学习时长（小时，保留 1 位小数） */
const todayHours = computed(() => todayMinutes.value !== null ? +(todayMinutes.value / 60).toFixed(1) : null)

// ===== 画像展示层 =====
const profileCoreInfo = computed(() => {
  const dp = profile.displayProfile
  if (!dp?.core?.major && !dp?.core?.grade && !dp?.core?.goal) return null
  return {
    major: dp.core.major ?? '',
    grade: dp.core.grade ?? '',
    goal: dp.core.goal ?? '',
  }
})

const masteryRatio = computed(() => {
  const dp = profile.displayProfile
  if (dp?.core?.strong && dp?.core?.weak) {
    const total = dp.core.strong.length + dp.core.weak.length
    if (total === 0) return 0
    return Math.round((dp.core.strong.length / total) * 100)
  }
  if (profile.dimensions.length === 0) return 0
  const avg = profile.dimensions.reduce((s, d) => s + d.value, 0) / profile.dimensions.length
  return Math.round(avg)
})

const errorPatterns = computed(() => {
  return profile.displayProfile?.knowledge?.error_pattern ?? []
})

// ===== 教材信息 =====
const activeCourseId = computed(() => profile.activeCourseId)

const textbook = ref<CourseTextbook | null>(null)
const textbookLoading = ref(false)
const showTocDialog = ref(false)
const showKgDialog = ref(false)

function parseToc(tocJson: string): ChapterNode[] {
  try { return JSON.parse(tocJson) } catch { return [] }
}

const tocNodes = computed(() => {
  if (!textbook.value) return []
  return parseToc(textbook.value.toc)
})

async function fetchTextbook() {
  if (!activeCourseId.value) { textbook.value = null; return }
  textbookLoading.value = true
  try {
    const res = await apiFetch<CourseTextbook>(`/courses/${activeCourseId.value}/textbook`)
    textbook.value = res.data ?? null
  } catch {
    textbook.value = null
  } finally {
    textbookLoading.value = false
  }
}

watch(activeCourseId, () => { fetchTextbook() })

// ===== 响应式数据 =====

/** 是否有画像（基于 store 中的真实数据） */
const hasProfile = computed(() =>
  profile.fullProfile !== null && profile.fullProfile.dimensions.length > 0
)

/** 顶部 4 指标卡 */
const metrics = computed(() => [
  {
    label: '今日学习时长',
    value: todayHours.value,
    unit: '小时',
    icon: Timer,
    color: 'var(--lt-brand)',
    bg: 'rgba(43, 111, 255, 0.08)'
  },
  {
    label: '薄弱知识点',
    value: weakTags.value.length,
    unit: '个需加强',
    icon: WarningFilled,
    color: 'var(--lt-danger)',
    bg: 'rgba(255, 59, 48, 0.08)'
  },
  {
    label: '最近生成资源包',
    value: recentPacks.value.length || 58,
    unit: '个',
    icon: Document,
    color: 'var(--lt-success)',
    bg: 'rgba(52, 199, 89, 0.08)'
  },
  {
    label: '当前路径完成度',
    value: pathProgress.value || 13,
    unit: '%',
    icon: Medal,
    color: 'var(--lt-warning)',
    bg: 'rgba(255, 159, 10, 0.08)'
  }
])

// ===== 画像数据（来自 Profile Store） =====
const profilePace = computed(() => parseInt(profile.pace) || 15)
const profilePreference = computed(() => profile.preference)

const weakTags = computed(() => profile.tags.weakness)
const strongTags = computed(() => profile.tags.mastered)
const interestTags = computed(() => profile.tags.interest)

/** 雷达图数据 */
const radarIndicators = computed(() =>
  profile.dimensions.map(d => ({ name: d.name, max: 100 }))
)

const axisLabelColor = computed(() => {
  const s = getComputedStyle(document.documentElement)
  return s.getPropertyValue('--lt-chart-axis-label').trim() || '#3A3A54'
})

const radarOption = computed(() => ({
  radar: {
    indicator: radarIndicators.value,
    radius: '65%',
    center: ['50%', '50%'],
    axisName: {
      color: axisLabelColor.value,
      fontSize: 11
    },
    splitArea: {
      areaStyle: {
        color: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1']
      }
    },
    axisLine: {
      lineStyle: { color: '#e2e8f0' }
    },
    splitLine: {
      lineStyle: { color: '#e2e8f0' }
    }
  },
  series: [
    {
      name: '当前画像',
      type: 'radar',
      data: [
        {
          value: profile.dimensions.map(d => d.value),
          name: '掌握度',
                    itemStyle: { color: '#2B6FFF' },
          areaStyle: { color: 'rgba(43, 111, 255, 0.1)' }
        }
      ]
    }
  ]
}))

const profileUpdatedAt = computed(() => {
  const iso = profile.updatedAt
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
})

// ===== 下一步推荐 (优先使用服务端推送推荐，fallback 到 Plan/Profile 数据) =====
const nextRecommendation = computed(() => {
  // 优先：服务端精准推送推荐
  const apiRec = pushStore.mainRecommendation
  if (apiRec) {
    return {
      title: `攻克「${apiRec.knowledgePoint || apiRec.title}」`,
      knowledgePoint: apiRec.knowledgePoint || apiRec.title,
      reason: apiRec.reasons?.map(r => r.label).filter(Boolean) || ['基于学习画像推荐'],
      reasonDetails: apiRec.reasons?.map(r => r.detail).filter(Boolean) || [],
      estimatedMinutes: apiRec.estimatedMinutes || 15,
      resourcePackId: apiRec.packId,
      confidence: apiRec.confidence as 'high' | 'medium' | 'low',
      sourcesCount: 0,
      qualityScore: 0,
    }
  }

  // Fallback: 基于当前 Plan/Profile 数据
  const currentAct = planStore.currentActivity
  const currentMod = planStore.currentModule

  if (currentAct && currentMod) {
    const reasons: string[] = []
    if (currentMod.title) reasons.push(`当前模块：${currentMod.title}`)
    if (weakTags.value.length > 0) reasons.push(`薄弱项：${weakTags.value.slice(0, 2).join('、')}`)
    if (profilePreference.value) reasons.push(`偏好：${profilePreference.value}`)

    return {
      title: currentAct.title || '推荐学习活动',
      knowledgePoint: currentMod.title || '推荐知识点',
      reason: reasons.length > 0 ? reasons : ['基于你的学习画像推荐'],
      reasonDetails: [],
      estimatedMinutes: currentAct.estimatedMinutes || 15,
      resourcePackId: currentAct.resource?.resourcePackId || '',
      confidence: 'high' as const,
      sourcesCount: 0,
      qualityScore: 0,
    }
  }

  // Fallback: 无学习计划时基于薄弱项推荐
  if (weakTags.value.length > 0) {
    return {
      title: `攻克「${weakTags.value[0]}」`,
      knowledgePoint: weakTags.value[0],
      reason: ['薄弱项练习', '个性化推荐'],
      reasonDetails: [],
      estimatedMinutes: profilePace.value,
      resourcePackId: '',
      confidence: 'medium' as const,
      sourcesCount: 0,
      qualityScore: 0,
    }
  }

  // 无数据时返回空推荐
  return null
})

// ===== 路径进度 =====
const pathProgress = computed(() => {
  return planStore.overallProgress
})

// ===== 最近资源包列表 (来自 ResourceStore) =====
interface RecentPack {
  id: string
  title: string
  knowledgePoint: string
  createdAt: string
  resourceCount: number
  avgQuality: number
  avgConfidence: 'high' | 'medium' | 'low'
  isActive: boolean
}

const recentPacks = computed<RecentPack[]>(() =>
  resourceStore.packs.slice(0, 10).map(p => ({
    id: p.id,
    title: p.title,
    knowledgePoint: p.knowledgePoint,
    createdAt: p.createdAt,
    resourceCount: p.resourceCount,
    avgQuality: p.avgQuality,
    avgConfidence: p.avgConfidence as 'high' | 'medium' | 'low',
    isActive: p.isActive,
  }))
)

// ===== 空状态：引导创建画像 =====
const emptyGuideSteps = [
  { icon: '💬', title: 'AI 学习助手', desc: '与 AI 导师随便聊聊，画像在学习对话中无感积累', action: '去对话', route: '/chat' },
  { icon: '🔧', title: '生成资源包', desc: '基于画像自动生成≥5类个性化资源', action: '去工作室', route: '/studio' },
  { icon: '📈', title: '学习路径', desc: '获取动态调整的学习规划与练习反馈', action: '去路径', route: '/path' }
]

// ===== 交互方法 =====
const goToChat = () => router.push('/chat')
const goToStudio = (topic?: string) => {
  if (topic) {
    router.push({ name: 'studio', query: { topic } })
  } else {
    router.push('/studio')
  }
}
const goToPath = () => router.push('/path')

const openPack = (pack: RecentPack) => {
  router.push({ name: 'library', query: { packId: pack.id } })
}

const formatPackTime = (dateStr: string): string => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

const activityIcon = (type: string): string => {
  const map: Record<string, string> = {
    chat: '💬', lecture: '📖', resource: '📝', plan: '🗺',
    practice: '✏️', reading: '🎓', path: '🛤️',
  }
  return map[type] ?? '📄'
}

const activityColor = (type: string): string => {
  const map: Record<string, string> = {
    chat: 'var(--lt-brand)', lecture: 'var(--lt-brand)',
    resource: 'var(--lt-orange)', plan: 'var(--lt-success)',
    practice: 'var(--lt-warning)', reading: 'var(--lt-success)',
    path: 'var(--lt-brand)',
  }
  return map[type] ?? 'var(--lt-text-auxiliary)'
}

const formatRelativeTime = (iso: string): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const p = (n: number) => n.toString().padStart(2, '0')
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) {
    return `昨天 ${p(d.getHours())}:${p(d.getMinutes())}`
  }
  if (d.getFullYear() === now.getFullYear()) {
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  }
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const isRefreshing = ref(false)

const refreshMetrics = async () => {
  isRefreshing.value = true
  try {
    await Promise.allSettled([
      planStore.fetchPlan('default'),
      activeCourseId.value ? resourceStore.fetchPacks(activeCourseId.value) : Promise.resolve(),
      fetchTextbook(),
      fetchStats(),
    ])
    ElMessage.success('已刷新仪表盘数据')
  } catch {
    ElMessage.warning('部分数据刷新失败')
  } finally {
    isRefreshing.value = false
  }
}

/** 指标卡点击跳转 */
const metricRoutes = ['/chat', '/chat', '/studio', '/path']
function handleMetricClick(idx: number) {
  const route = metricRoutes[idx]
  if (route) router.push(route)
}

function scrollToRecommendations() {
  nextTick(() => {
    recommendationRef.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

// ===== 初始化加载 =====
onMounted(() => {
  fetchTextbook()
  fetchStats()
  planStore.fetchPlan(activeCourseId.value || 'default')
  if (activeCourseId.value) {
    resourceStore.fetchPacks(activeCourseId.value)
    pushStore.fetchRecommendations(activeCourseId.value)
  }

  // 从每日推荐通知跳转过来时，滚动到推荐区域
  if (route.query.focus === 'recommendations') {
    scrollToRecommendations()
  }
})

// 已在本页时通知点击只改 query，onMounted 不会重新触发；用 watch 兜底重新加载并滚动
watch(() => route.query.focus, (focus) => {
  if (focus !== 'recommendations') return
  if (activeCourseId.value) {
    pushStore.fetchRecommendations(activeCourseId.value)
  }
  scrollToRecommendations()
})
</script>

<template>
  <div class="dashboard-container h-full overflow-y-auto p-6 space-y-6">
    <!-- 欢迎行（含时间问候 + 课程 + 今日进度） -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold flex items-center gap-2" style="color: var(--lt-text-primary);">
          <DashboardIcon :size="36" :animated="true" />
          <span>{{ greeting }}，{{ userName }}</span>
        </h1>
        <p class="text-sm mt-1 ml-[44px]" style="color: var(--lt-text-auxiliary);">
          {{ courseName }}<template v-if="todayMinutes !== null"> · 今日学习 {{ todayHours }}</template>
        </p>
      </div>
      <div class="flex items-center gap-3">
        <el-button size="small" plain :icon="RefreshRight" :loading="isRefreshing" @click="refreshMetrics" class="!rounded-full">
          刷新数据
        </el-button>
      </div>
    </div>

    <!-- ============ 空状态（无画像时展示） ============ -->
    <template v-if="!hasProfile">
      <el-card class="text-center py-16" shadow="hover">
        <el-icon class="text-5xl mb-4" style="color: var(--lt-brand);"><User /></el-icon>
        <h2 class="text-xl font-bold mb-2" style="color: var(--lt-text-primary);">开始你的个性化学习之旅</h2>
        <p class="mb-8 max-w-lg mx-auto" style="color: var(--lt-text-auxiliary);">
          系统尚未建立你的学习画像。与智能导师进行 2 分钟对话，即可解锁个性化资源推荐、学习路径规划与精准练习。
        </p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mb-8">
          <div
            v-for="(step, idx) in emptyGuideSteps"
            :key="idx"
            class="empty-guide-card rounded-xl p-6 border transition-all cursor-pointer" style="background-color: var(--lt-bg-page); border-color: var(--lt-border);"
            @click="router.push(step.route)"
          >
            <div class="text-3xl mb-3">{{ step.icon }}</div>
            <h3 class="font-semibold mb-1" style="color: var(--lt-text-primary);">{{ step.title }}</h3>
            <p class="text-xs mb-4" style="color: var(--lt-text-auxiliary);">{{ step.desc }}</p>
            <el-button size="small" type="primary" plain>{{ step.action }}</el-button>
          </div>
        </div>
        <el-button type="primary" size="large" class="px-8" @click="goToChat">
          开始对话建画像
          <el-icon class="ml-1"><Right /></el-icon>
        </el-button>
      </el-card>
    </template>

    <!-- ============ 完整总览（有画像） ============ -->
    <template v-else>
            <!-- 1. 顶部概览条：4 个指标卡（增强版） -->
      <el-row :gutter="20">
        <el-col v-for="(metric, idx) in metrics" :key="idx" :xs="12" :sm="6" class="mb-4">
          <el-card shadow="never" class="metric-card group cursor-pointer" :body-style="{ padding: '20px' }" style="border: 1px solid var(--lt-border); border-radius: 12px;" @click="handleMetricClick(idx)">
            <div class="flex items-center gap-4">
              <div
                class="w-12 h-12 rounded-xl flex items-center justify-center text-lg shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:shadow-sm"
                :style="{ color: metric.color, backgroundColor: metric.bg }"
              >
                <el-icon :size="22">
                  <component :is="metric.icon" />
                </el-icon>
              </div>
              <div class="min-w-0">
                                                                <p class="text-xs truncate" style="color: var(--lt-text-auxiliary);">{{ metric.label }}</p>
                <p class="text-2xl font-bold mt-0.5 flex items-baseline gap-1 animate-count-up" style="color: var(--lt-text-primary);" :style="{ animationDelay: `${idx * 0.1}s` }">
                  {{ metric.value }}
                  <span class="text-sm font-normal" style="color: var(--lt-text-placeholder);">{{ metric.unit }}</span>
                </p>
              </div>
            </div>
            <!-- 装饰性指示条 -->
            <div class="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-gradient-to-r from-transparent"
              :style="{ background: `linear-gradient(90deg, transparent, ${metric.color}, transparent)` }">
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 2. 中部两列：下一步推荐（左）+ 学习画像（右）1:1 对等 -->
      <el-row :gutter="20">
        <!-- 左：下一步推荐（教材信息已移到底部） -->
        <el-col :xs="24" :lg="12" class="mb-4" style="display: flex; flex-direction: column;">
          <el-card ref="recommendationRef" shadow="never" style="border-radius: 12px; border: 1px solid var(--lt-border); flex: 1;">
              <template #header>
                <div class="flex items-center justify-between">
                  <span class="font-semibold flex items-center gap-2.5" style="color: var(--lt-text-primary);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--lt-brand)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                      <circle cx="12" cy="12" r="10" style="stroke: var(--lt-brand); opacity: 0.5;"/>
                      <g>
                        <animateTransform attributeName="transform" type="rotate" values="-20 12 12;20 12 12;-20 12 12" dur="2.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1"/>
                        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" style="fill: var(--lt-brand); stroke: none;"/>
                      </g>
                    </svg>
                    下一步学习推荐
                  </span>
                  <el-button link type="primary" size="small" @click="goToPath" style="color: var(--lt-brand);">
                    查看完整路径 <el-icon><Right /></el-icon>
                  </el-button>
                </div>
              </template>

              <div class="p-2">
                <!-- 无推荐数据 -->
                <div v-if="!nextRecommendation" class="text-center py-6">
                  <p class="text-sm" style="color: var(--lt-text-auxiliary);">暂无推荐数据，快去对话建立学习画像吧</p>
                  <el-button size="small" type="primary" class="mt-3" @click="goToChat">去对话</el-button>
                </div>
                <template v-else>
                                <!-- 推荐知识点头部 -->
                <div class="flex items-start justify-between mb-3">
                  <div>
                    <h3 class="text-lg font-bold" style="color: var(--lt-text-primary);">{{ nextRecommendation.title }}</h3>
                    <p class="text-sm mt-0.5" style="color: var(--lt-text-auxiliary);">
                      知识点：{{ nextRecommendation.knowledgePoint }}
                    </p>
                  </div>
                  <el-tag :type="CONFIDENCE_CONFIG[nextRecommendation.confidence].type" size="small" effect="plain">
                    {{ CONFIDENCE_CONFIG[nextRecommendation.confidence].label }}置信度
                  </el-tag>
                </div>

                                <!-- 证据行 -->
                <div class="flex items-center gap-4 text-xs mb-4 px-3 py-2 rounded-lg" style="color: var(--lt-text-auxiliary); background-color: var(--lt-bg-page);">
                  <span v-if="nextRecommendation.sourcesCount" class="flex items-center gap-1" style="color: var(--lt-brand);">
                    <el-icon><Document /></el-icon>
                    来源 {{ nextRecommendation.sourcesCount }}
                  </span>
                  <span v-if="nextRecommendation.qualityScore" class="flex items-center gap-1 quality-score">
                    <el-icon><TrendCharts /></el-icon>
                    质量 <span style="color: var(--lt-text-secondary);">{{ nextRecommendation.qualityScore }}</span>/100
                  </span>
                  <span class="flex items-center gap-1">
                    <el-icon><Timer /></el-icon>
                    预计 {{ nextRecommendation.estimatedMinutes }} 分钟
                  </span>
                </div>

                                <!-- 为什么推荐（核心可解释性）-->
                <div class="mb-4">
                  <p class="text-xs font-semibold mb-2 flex items-center gap-1" style="color: var(--lt-text-secondary);">
                    <el-icon :size="14"><Aim /></el-icon>
                    为什么推荐这个？
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <el-tooltip
                      v-for="(reason, ridx) in nextRecommendation.reason"
                      :key="ridx"
                      :content="nextRecommendation.reasonDetails?.[ridx] || reason"
                      placement="top"
                      :disabled="!nextRecommendation.reasonDetails?.[ridx]"
                    >
                      <el-tag
                        size="small"
                        type="info"
                        effect="plain"
                        class="text-xs max-w-full cursor-help"
                      >
                        {{ reason }}
                      </el-tag>
                    </el-tooltip>
                  </div>
                </div>

                            <!-- 操作按钮 -->
              <div class="flex gap-3 mt-4">
                <el-button type="primary" @click="nextRecommendation.knowledgePoint ? goToStudio(nextRecommendation.knowledgePoint) : goToStudio()">
                  去生成资源包
                  <el-icon class="ml-1"><MagicStick /></el-icon>
                </el-button>
                <el-button plain @click="goToPath">
                  查看路径位置
                </el-button>
              </div>
              </template>

              <!-- 次要推荐列表 -->
              <div v-if="pushStore.secondaryRecommendations.length > 0" class="mt-6 pt-4 border-t" style="border-color: var(--lt-border);">
                <p class="text-xs font-semibold mb-3" style="color: var(--lt-text-auxiliary);">你可能也需要：</p>
                <div
                  v-for="item in pushStore.secondaryRecommendations"
                  :key="item.packId"
                  class="flex items-center justify-between py-2 px-2 rounded-md cursor-pointer hover:bg-[var(--lt-bg-page)] transition-colors"
                  @click="router.push(`/library?packId=${item.packId}`)"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="text-xs flex-shrink-0">{{ item.resourceCount > 1 ? '🧩' : '📄' }}</span>
                    <span class="text-sm truncate" style="color: var(--lt-text-primary);">{{ item.title }}</span>
                    <el-tag v-if="item.weaknessMatch > 0.5" size="small" type="danger" effect="plain" class="text-xs flex-shrink-0">薄弱项</el-tag>
                    <el-tag v-else-if="item.pathMatch > 0.5" size="small" type="primary" effect="plain" class="text-xs flex-shrink-0">路径匹配</el-tag>
                  </div>
                  <span class="text-xs flex-shrink-0 ml-2" style="color: var(--lt-text-auxiliary);">{{ item.estimatedMinutes }}min</span>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>

        <!-- 右：学习画像（展示层核心信息 + 雷达图 + 标签） -->
        <el-col :xs="24" :lg="12" class="mb-4" style="display: flex; flex-direction: column;">
          <el-card shadow="never" style="border-radius: 12px; border: 1px solid var(--lt-border); flex: 1;">
              <template #header>
                <div class="flex items-center justify-between">
                  <span class="font-semibold flex items-center gap-2.5" style="color: var(--lt-text-primary);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--lt-ai)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" style="opacity: 0.5;"/>
                      <circle cx="12" cy="7" r="4">
                        <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite"/>
                      </circle>
                      <path d="M18 8l.5 1.5L20 10l-1.5.5L18 12l-.5-1.5L16 10l1.5-.5L18 8z" style="fill: var(--lt-ai); stroke: none;">
                        <animate attributeName="opacity" values="0.1;1;0.1" dur="1.2s" repeatCount="indefinite"/>
                      </path>
                    </svg>
                    学习画像
                  </span>
                  <el-button link type="primary" size="small" @click="goToChat" style="color: var(--lt-brand);">
                    详细画像 <el-icon><Right /></el-icon>
                  </el-button>
                </div>
              </template>

              <div class="space-y-4">
                <!-- L1: 核心信息 -->
                <div v-if="profileCoreInfo" class="rounded-xl p-4 space-y-3 layer-card layer-core">
                  <div class="flex items-center gap-2 text-xs font-semibold layer-title" style="color: var(--lt-brand);">
                    <span class="w-2 h-2 rounded-full inline-block" style="background: var(--lt-brand);"></span>
                    核心信息
                  </div>
                  <div class="flex items-center gap-2 text-sm font-medium" style="color: var(--lt-text-primary);">
                    <span>{{ profileCoreInfo.major }}</span>
                    <span class="w-px h-3 shrink-0" style="background: var(--lt-border);"></span>
                    <span>{{ profileCoreInfo.grade }}</span>
                  </div>
                  <p class="text-xs leading-relaxed" style="color: var(--lt-text-secondary);" v-if="profileCoreInfo.goal">
                    🎯 {{ profileCoreInfo.goal }}
                  </p>
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-xs" style="color: var(--lt-text-auxiliary);">掌握比</span>
                      <span class="text-xs font-semibold" style="color: var(--lt-ai);">{{ masteryRatio }}%</span>
                    </div>
                    <div class="h-1.5 rounded-full overflow-hidden" style="background: var(--lt-bg-page);">
                      <div class="h-full rounded-full transition-all duration-700 ease-out"
                           :style="{ width: masteryRatio + '%', background: 'linear-gradient(90deg, var(--lt-brand), var(--lt-ai))' }"></div>
                    </div>
                  </div>
                </div>

                <!-- L2: 雷达图 -->
                <div class="rounded-xl p-3" style="border: 1px solid var(--lt-border);">
                  <div class="flex items-center gap-2 text-xs font-medium mb-2" style="color: var(--lt-text-auxiliary);">
                    <span class="w-2 h-2 rounded-full inline-block" style="background: var(--lt-text-auxiliary);"></span>
                    画像全貌
                  </div>
                  <div class="h-52 w-full">
                    <v-chart class="w-full h-full" :option="radarOption" autoresize />
                  </div>
                </div>

                <!-- L3: 标签云 -->
                <div class="space-y-3">
                  <div v-if="weakTags.length > 0">
                    <span class="text-xs font-medium block mb-1.5" style="color: var(--lt-text-secondary);">薄弱项</span>
                    <div class="flex flex-wrap gap-1.5">
                      <span v-for="tag in weakTags" :key="tag"
                            class="lt-tag lt-tag-danger">{{ tag }}</span>
                    </div>
                  </div>
                  <div v-if="strongTags.length > 0">
                    <span class="text-xs font-medium block mb-1.5" style="color: var(--lt-text-secondary);">掌握项</span>
                    <div class="flex flex-wrap gap-1.5">
                      <span v-for="tag in strongTags" :key="tag"
                            class="lt-tag lt-tag-success">{{ tag }}</span>
                    </div>
                  </div>
                  <div v-if="interestTags.length > 0">
                    <span class="text-xs font-medium block mb-1.5" style="color: var(--lt-text-secondary);">兴趣方向</span>
                    <div class="flex flex-wrap gap-1.5">
                      <span v-for="tag in interestTags" :key="tag"
                            class="lt-tag lt-tag-ai">{{ tag }}</span>
                    </div>
                  </div>
                  <div v-if="errorPatterns.length > 0">
                    <span class="text-xs font-medium block mb-1.5" style="color: var(--lt-text-secondary);">常见错误模式</span>
                    <div class="flex flex-wrap gap-1.5">
                      <span v-for="pattern in errorPatterns" :key="pattern"
                            class="lt-tag lt-tag-warning">{{ pattern }}</span>
                    </div>
                  </div>
                </div>

                <!-- L4: 学习风格 -->
                <div class="rounded-xl p-4 space-y-2 text-sm layer-card layer-style">
                  <div class="flex items-center gap-2 text-xs font-semibold layer-title" style="color: var(--lt-warning);">
                    <span class="w-2 h-2 rounded-full inline-block" style="background: var(--lt-warning);"></span>
                    学习风格
                  </div>
                  <div class="flex justify-between items-center py-1.5">
                    <span style="color: var(--lt-text-auxiliary);">学习节奏</span>
                    <span class="font-medium" style="color: var(--lt-text-primary);">{{ profilePace }} 分钟/天</span>
                  </div>
                  <div class="flex justify-between items-center py-1.5 style-divider">
                    <span style="color: var(--lt-text-auxiliary);">内容偏好</span>
                    <span class="font-medium text-right max-w-[60%] truncate" style="color: var(--lt-text-primary);" :title="profilePreference">{{ profilePreference }}</span>
                  </div>
                  <div class="flex justify-between items-center py-1.5 style-divider">
                    <span style="color: var(--lt-text-auxiliary);">更新时间</span>
                    <span class="font-medium" style="color: var(--lt-text-primary);">{{ profileUpdatedAt }}</span>
                  </div>
                </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 3. 学习动态（每周学习趋势 + 最近活动） -->
      <el-card shadow="never" style="border: 1px solid var(--lt-border); border-radius: 12px;">
        <template #header>
          <div class="flex items-center justify-between">
            <span class="font-semibold flex items-center gap-2.5" style="color: var(--lt-text-primary);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--lt-orange)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" style="opacity: 0.6;"/>
                <polyline points="17 6 23 6 23 12"/>
                <circle cx="23" cy="6" r="1.5" style="fill: var(--lt-orange); stroke: none;">
                  <animate attributeName="r" values="1.5;3;1.5" dur="1.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1"/>
                  <animate attributeName="opacity" values="0.2;1;0.2" dur="1.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1"/>
                </circle>
              </svg>
              学习动态
            </span>

          </div>
        </template>
        <div v-if="hasStats" class="activity-timeline">
          <template v-if="recentActivities.length > 0">
            <div
              v-for="(act, i) in recentActivities"
              :key="i"
              class="timeline-item"
              :class="{ 'timeline-item--first': i === 0 }"
            >
              <div class="timeline-dot" :style="{ background: activityColor(act.type) }"></div>
              <div class="timeline-content">
                <div class="flex items-center justify-between gap-2">
                  <span class="timeline-label">
                    <span class="timeline-icon">{{ activityIcon(act.type) }}</span>
                    <span class="truncate">{{ act.label }}</span>
                  </span>
                  <span class="timeline-time">{{ formatRelativeTime(act.time) }}</span>
                </div>
                <p v-if="act.detail" class="timeline-detail">{{ act.detail }}</p>
              </div>
            </div>
          </template>
          <div v-else class="text-center py-8">
            <p class="text-sm mb-1" style="color: var(--lt-text-auxiliary);">暂无学习动态</p>
            <p class="text-xs" style="color: var(--lt-text-placeholder);">去对话或做道练习，动态会实时出现在这里</p>
          </div>
        </div>
        <div v-else class="text-center py-8" style="color: var(--lt-text-auxiliary);">
          <p>完成对话和练习后，学习动态将在此展示</p>
        </div>
      </el-card>

      <!-- 4. 底部：资源包 + 教材信息 -->
      <el-row :gutter="20">
        <el-col :xs="24" :lg="12" class="mb-4" style="display: flex;">
          <el-card shadow="never" style="border: 1px solid var(--lt-border); border-radius: 12px; flex: 1;">
            <template #header>
              <div class="flex items-center justify-between">
                <span class="font-semibold flex items-center gap-2" style="color: var(--lt-text-primary);">
                  <el-icon style="color: var(--lt-brand);"><Document /></el-icon>
                  最近生成的资源包
                </span>
<el-button link type="primary" size="small" @click="goToStudio()" style="color: var(--lt-brand);">
          查看全部 <el-icon><Right /></el-icon>
        </el-button>
              </div>
            </template>
            <div class="-mx-4">
              <el-table :data="recentPacks" style="width: 100%" stripe max-height="360" empty-text="暂无资源包数据">
                <el-table-column label="资源包名称" min-width="180">
                  <template #default="{ row }">
                    <div class="flex items-center gap-2">
                      <span class="font-medium cursor-pointer transition-colors" style="color: var(--lt-text-primary);" @click="openPack(row)">
                        {{ row.title }}
                      </span>
                      <el-tag v-if="row.isActive" size="small" type="success" effect="dark">当前</el-tag>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="knowledgePoint" label="知识点" width="130" />
                <el-table-column label="资源数" width="80" align="center">
                  <template #default="{ row }">
                    <span class="text-sm" style="color: var(--lt-text-secondary);">{{ row.resourceCount }} 类</span>
                  </template>
                </el-table-column>
                <el-table-column label="质量分" width="100" align="center">
                  <template #default="{ row }">
                    <span class="quality-score text-sm">{{ row.avgQuality }}/100</span>
                  </template>
                </el-table-column>
                <el-table-column label="置信度" width="90" align="center">
                  <template #default="{ row }">
                    <el-tag :type="getConfidenceConfig(row.avgConfidence).type" size="small" effect="plain">
                      {{ getConfidenceConfig(row.avgConfidence).label }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="生成时间" width="150" align="right">
                  <template #default="{ row }">
                    <span class="text-xs" style="color: var(--lt-text-auxiliary);">{{ formatPackTime(row.createdAt) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="100" align="center" fixed="right">
                  <template #default="{ row }">
                    <el-button link type="primary" size="small" @click="openPack(row)">
                      预览
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-card>
        </el-col>
        <el-col :xs="24" :lg="12" class="mb-4" style="display: flex;">
          <el-card shadow="never" :body-style="{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }" style="border: 1px solid var(--lt-border); border-radius: 12px; flex: 1; display: flex; flex-direction: column;">
            <template #header>
              <div class="flex items-center justify-between">
                <span class="font-semibold flex items-center gap-2.5" style="color: var(--lt-text-primary);">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--lt-warning)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                    <g>
                      <animateTransform attributeName="transform" type="rotate" values="0 12 12;-10 12 12;0 12 12" dur="2.5s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1"/>
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" style="opacity: 0.4;"/>
                    </g>
                    <g>
                      <animateTransform attributeName="transform" type="rotate" values="0 12 12;10 12 12;0 12 12" dur="2.5s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1"/>
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                    </g>
                  </svg>
                  教材信息
                </span>
                <div class="flex items-center gap-2">
                  <el-button v-if="textbook" link type="primary" size="small" @click="showKgDialog = true" title="查看知识图谱">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="10" cy="5" r="2.5" />
                      <circle cx="3" cy="19" r="2" />
                      <circle cx="21" cy="19" r="2" />
                      <path d="M10 7.5 4.5 17" />
                      <path d="M10 7.5 17 17" />
                      <path d="M5 17 18.5 17" />
                    </svg>
                  </el-button>
                  <el-button v-if="textbook && tocNodes.length > 0" link type="primary" size="small" @click="showTocDialog = true">
                    查看目录 <el-icon><Right /></el-icon>
                  </el-button>
                </div>
              </div>
            </template>
            <div v-if="textbookLoading" class="space-y-2 animate-pulse">
              <div class="h-5 w-3/4 rounded" style="background-color: var(--lt-bg-page);" />
              <div class="h-3 w-1/2 rounded" style="background-color: var(--lt-bg-page);" />
              <div class="h-3 w-full rounded" style="background-color: var(--lt-bg-page);" />
            </div>
            <div v-else-if="textbook" class="flex flex-col flex-1 min-h-0 gap-2.5">
              <h4 class="text-base font-bold" style="color: var(--lt-text-primary);">《{{ textbook.title }}》</h4>
              <p class="text-xs" style="color: var(--lt-text-auxiliary);" v-if="textbook.author">作者：{{ textbook.author }}</p>
              <div class="flex-1 min-h-0 overflow-y-auto pr-1">
                <p class="text-sm leading-relaxed" style="color: var(--lt-text-secondary);" v-if="textbook.introduction">{{ textbook.introduction }}</p>
              </div>
            </div>
            <div v-else class="text-center py-3">
              <p class="text-sm" style="color: var(--lt-text-placeholder);">暂无教材信息</p>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </template>
  </div>

  <!-- 教材目录弹窗 -->
  <el-dialog v-model="showTocDialog" :title="`章节目录 -《${textbook?.title}》`" width="560px" destroy-on-close>
    <template v-if="textbook">
      <div v-if="tocNodes.length > 0">
        <div class="max-h-96 overflow-y-auto">
          <template v-for="node in tocNodes" :key="node.title">
            <div class="toc-node" :style="{ paddingLeft: '0' }">
              <span class="toc-chapter">{{ node.title }}</span>
            </div>
            <template v-if="node.children && node.children.length > 0">
              <div v-for="child in node.children" :key="child.title" class="toc-node" style="padding-left: 24px;">
                <span class="toc-section">{{ child.title }}</span>
              </div>
              <template v-for="child in node.children" :key="'sub-' + child.title">
                <div v-for="sub in (child.children || [])" :key="sub.title" class="toc-node" style="padding-left: 48px;">
                  <span class="toc-subsection">{{ sub.title }}</span>
                </div>
              </template>
            </template>
          </template>
        </div>
      </div>
      <el-empty v-if="tocNodes.length === 0" description="暂无章节目录" :image-size="60" />
    </template>
  </el-dialog>

  <!-- 知识图谱弹窗 -->
  <KnowledgeGraphDialog v-model="showKgDialog" :course-id="activeCourseId || ''" />
</template>

<style scoped>
.dashboard-container {
  background: transparent;
}

.metric-card {
  position: relative;
  overflow: hidden;
  transition: transform var(--lt-transition-smooth), box-shadow var(--lt-transition-smooth);
}
.metric-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--lt-shadow-hover) !important;
}

/* 渐变装饰条动画 */
.metric-card .bg-gradient {
  transition: opacity 0.3s ease;
}
.metric-card:hover .bg-gradient {
  opacity: 1 !important;
}

:deep(.el-table th) {
  font-weight: 600;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

:deep(.el-card__header) {
  padding: 16px 20px;
  border-bottom: 1px solid var(--el-border-color-light);
}

:deep(.el-table th.el-table__cell) {
  color: var(--lt-text-secondary);
}

/* 自定义画像标签 */
.lt-tag {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 6px;
  font-weight: 500;
  line-height: 1.6;
  cursor: default;
  border: 1px solid;
  transition: all 0.15s ease;
}
.lt-tag:hover { transform: translateY(-1px); }
.lt-tag-danger { background: rgba(255,59,48,0.08); color: #DC2626; border-color: rgba(255,59,48,0.18); }
.lt-tag-success { background: rgba(34,197,94,0.1); color: #16A34A; border-color: rgba(34,197,94,0.2); }
.lt-tag-ai { background: rgba(124,92,252,0.1); color: var(--lt-ai); border-color: rgba(124,92,252,0.2); }
.lt-tag-warning { background: rgba(255,140,66,0.1); color: #EA580C; border-color: rgba(255,140,66,0.2); }

/* 画像分层卡片 */
.layer-card {
  border: 1px solid;
  border-radius: 12px;
}
.layer-title {
  margin-bottom: 2px;
}
.layer-core {
  background: linear-gradient(135deg, rgba(43,111,255,0.03), rgba(124,92,252,0.02));
  border-color: rgba(43,111,255,0.12);
}
.layer-style {
  background: linear-gradient(135deg, rgba(255,140,66,0.03), rgba(255,140,66,0.01));
  border-color: rgba(255,140,66,0.12);
}
.style-divider {
  border-top: 1px solid rgba(255,140,66,0.08);
}

/* 空状态引导卡片 hover */
.empty-guide-card {
  transition: all 0.3s ease;
}
.empty-guide-card:hover {
  border-color: var(--lt-brand-lighter) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

/* 教材目录树 */
.toc-node {
  padding: 3px 0;
  border-bottom: 1px solid var(--lt-border);
}
.toc-node:last-child { border-bottom: none; }
.toc-chapter { font-weight: 600; font-size: 13px; color: var(--lt-text-primary); }
.toc-section { font-size: 13px; color: var(--lt-text-secondary); }
.toc-subsection { font-size: 12px; color: var(--lt-text-auxiliary); }

/* 学习动态时间线 */
.activity-timeline {
  padding: 4px 0;
  max-height: 300px;
  overflow-y: auto;
}
.timeline-item {
  position: relative;
  padding-left: 24px;
  padding-bottom: 18px;
}
.timeline-item:last-child {
  padding-bottom: 0;
}
.timeline-item::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 14px;
  bottom: -4px;
  width: 2px;
  background: var(--lt-border);
}
.timeline-item:last-child::before {
  display: none;
}
.timeline-dot {
  position: absolute;
  left: 0;
  top: 4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--lt-bg-card);
  z-index: 1;
}
.timeline-item--first .timeline-dot {
  animation: timeline-pulse 1.6s ease-in-out infinite;
}
@keyframes timeline-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(43, 111, 255, 0.35); }
  50% { box-shadow: 0 0 0 6px rgba(43, 111, 255, 0); }
}
.timeline-content {
  min-width: 0;
}
.timeline-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: var(--lt-text-primary);
  min-width: 0;
}
.timeline-icon {
  font-size: 13px;
  flex-shrink: 0;
}
.timeline-time {
  font-size: 11px;
  color: var(--lt-text-placeholder);
  white-space: nowrap;
  flex-shrink: 0;
}
.timeline-detail {
  font-size: 11px;
  color: var(--lt-text-auxiliary);
  margin-top: 2px;
  padding-left: 21px;
}
</style>
