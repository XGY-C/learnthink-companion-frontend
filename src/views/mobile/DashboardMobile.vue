<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProfileStore } from '@/stores/profile'
import { usePlanStore } from '@/stores/plan'
import { useResourceStore } from '@/stores/resource'
import { usePushStore } from '@/stores/push'
import { usePullToRefresh } from '@/composables/usePullToRefresh'
import { apiFetch } from '@/utils/api'
import { getConfidenceConfig, CONFIDENCE_CONFIG } from '@/constants'
import type { CourseTextbook, ChapterNode } from '@/types'
import * as echarts from 'echarts/core'
import { RadarChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { ElMessage } from 'element-plus'
import {
  Timer, WarningFilled, Document, Medal, Right,
  TrendCharts, Reading, User, MagicStick, RefreshRight,
  ChatDotRound, Monitor, Grid, EditPen
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import BottomSheet from '@/components/mobile/BottomSheet.vue'
import KnowledgeGraphDialog from '@/components/KnowledgeGraphDialog.vue'
import DashboardIcon from '@/components/icons/DashboardIcon.vue'

const router = useRouter()
const profile = useProfileStore()
const planStore = usePlanStore()
const resourceStore = useResourceStore()
const pushStore = usePushStore()
const userStore = useUserStore()

const pullContainer = ref<HTMLElement | null>(null)
const { pullState, pullDistance } = usePullToRefresh(pullContainer, async () => {
  fetchTextbook()
  fetchStats()
  profile.refreshProfile()
  planStore.fetchPlan(activeCourseId.value || 'default')
  if (activeCourseId.value) {
    resourceStore.fetchPacks(activeCourseId.value)
    pushStore.fetchRecommendations(activeCourseId.value)
  }
})

echarts.use([RadarChart, CanvasRenderer])

// ===== 欢迎行 =====
const hour = new Date().getHours()
const greeting = hour < 12 ? '☀️ 早上好' : hour < 18 ? '☀️ 下午好' : '🌙 晚上好'
const userName = computed(() => userStore.userInfo?.displayName ?? '同学')
const courseName = computed(() => profile.activeCourse?.name ?? '')

const COURSE_PILL_LIMIT = 4
const showCourseSheet = ref(false)
const visibleCourses = computed(() => {
  const courses = profile.courses
  if (courses.length <= COURSE_PILL_LIMIT) return courses
  const activeIdx = courses.findIndex(c => c.id === activeCourseId.value)
  if (activeIdx < COURSE_PILL_LIMIT - 1) {
    return courses.slice(0, COURSE_PILL_LIMIT - 1)
  }
  const result = courses.filter((_, i) => i < COURSE_PILL_LIMIT - 1 || i === activeIdx)
  return result.slice(0, COURSE_PILL_LIMIT - 1).concat(courses[activeIdx])
})
const hiddenCount = computed(() => profile.courses.length - visibleCourses.value.length)

function switchCourse(course: { id: string; name: string; emoji?: string }) {
  if (course.id === activeCourseId.value) return
  profile.switchCourse(course)
  fetchTextbook()
  fetchStats()
  planStore.fetchPlan(course.id)
  resourceStore.fetchPacks(course.id)
  pushStore.fetchRecommendations(course.id)
}

// ===== 学习统计数据 =====
const todayMinutes = ref<number | null>(null)
const weeklyHours = ref<number[]>([])
const recentActivities = ref<{ type: string; label: string; time: string }[]>([])
const statsLoading = ref(false)

async function fetchStats() {
  if (!activeCourseId.value) return
  statsLoading.value = true
  try {
    const res = await apiFetch<any>(`/user/me/stats?courseId=${encodeURIComponent(activeCourseId.value)}`)
    if (res.data) {
      todayMinutes.value = res.data.todayMinutes ?? null
      weeklyHours.value = (res.data.weeklyActivity ?? []).map((e: { hours: number }) => e.hours)
      recentActivities.value = res.data.recentActivities ?? []
    }
  } catch { /* stats API may not be ready */ }
  finally { statsLoading.value = false }
}

const hasStats = computed(() => todayMinutes.value !== null)

// ===== 画像展示层 =====
const profileCoreInfo = computed(() => {
  const dp = profile.displayProfile
  if (!dp?.core_profile) return null
  const findVal = (key: string) => dp.core_profile.find((d: any) => d.key === key)?.value ?? ''
  return {
    major: findVal('core.major'),
    grade: findVal('core.grade'),
    goal: findVal('core.goal'),
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
const showTocSheet = ref(false)
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
  } catch { textbook.value = null }
  finally { textbookLoading.value = false }
}

watch(activeCourseId, () => { fetchTextbook() })

// ===== 响应式数据 =====
const hasProfile = computed(() =>
  profile.fullProfile !== null && profile.fullProfile.dimensions.length > 0
)

const profilePace = computed(() => parseInt(profile.pace) || 15)
const profilePreference = computed(() => profile.preference)
const weakTags = computed(() => profile.tags.weakness)
const strongTags = computed(() => profile.tags.mastered)
const interestTags = computed(() => profile.tags.interest)

const metrics = computed(() => [
  { label: '今日学习', value: todayMinutes.value ?? '--', unit: todayMinutes.value !== null ? '分钟' : '', icon: Timer, color: 'var(--lt-brand)', bg: 'rgba(43,111,255,0.08)' },
  { label: '薄弱项', value: weakTags.value.length, unit: '个需加强', icon: WarningFilled, color: 'var(--lt-danger)', bg: 'rgba(255,59,48,0.08)' },
  { label: '资源包', value: resourceStore.packs.length, unit: '个', icon: Document, color: 'var(--lt-success)', bg: 'rgba(52,199,89,0.08)' },
  { label: '路径进度', value: planStore.overallProgress, unit: '%', icon: Medal, color: 'var(--lt-warning)', bg: 'rgba(255,159,10,0.08)' },
])


const radarIndicators = computed(() =>
  profile.dimensions.map(d => ({ name: d.name, max: 100 }))
)

const chartColors = computed(() => {
  const style = getComputedStyle(document.documentElement)
  return {
    brand: style.getPropertyValue('--lt-brand').trim() || '#2B6FFF',
    textSecondary: style.getPropertyValue('--lt-text-secondary').trim() || '#64748b',
    splitBg: [
      style.getPropertyValue('--lt-chart-split-bg-0').trim() || '#F5F7FA',
      style.getPropertyValue('--lt-chart-split-bg-1').trim() || '#EEF1F5',
      style.getPropertyValue('--lt-chart-split-bg-2').trim() || '#E8ECF0',
      style.getPropertyValue('--lt-chart-split-bg-3').trim() || '#DEE3E8',
    ],
    grid: style.getPropertyValue('--lt-chart-grid').trim() || '#E8ECF0',
  }
})

const radarOption = computed(() => ({
  radar: {
    indicator: radarIndicators.value,
    radius: '50%',
    center: ['50%', '50%'],
    axisName: { color: chartColors.value.textSecondary, fontSize: 9 },
    splitArea: { areaStyle: { color: chartColors.value.splitBg } },
    axisLine: { lineStyle: { color: chartColors.value.grid } },
    splitLine: { lineStyle: { color: chartColors.value.grid } },
  },
  series: [{
    name: '当前画像',
    type: 'radar',
    data: [{ value: profile.dimensions.map(d => d.value), name: '掌握度', itemStyle: { color: chartColors.value.brand }, areaStyle: { color: 'rgba(43,111,255,0.1)' } }],
  }],
}))

const profileVersion = computed(() => profile.profileVersion)
const profileUpdatedAt = computed(() => profile.updatedAt)

// ===== 下一步推荐 (dynamic from pushStore) =====
const nextRecommendation = computed(() => {
  const apiRec = pushStore.mainRecommendation
  if (apiRec) {
    return {
      title: `攻克「${apiRec.knowledgePoint || apiRec.title}」`,
      knowledgePoint: apiRec.knowledgePoint || apiRec.title,
      reason: apiRec.reasons?.map((r: any) => r.label).filter(Boolean) || ['基于学习画像推荐'],
      reasonDetails: apiRec.reasons?.map((r: any) => r.detail).filter(Boolean) || [],
      estimatedMinutes: apiRec.estimatedMinutes || 15,
      resourcePackId: apiRec.packId,
      confidence: apiRec.confidence as 'high' | 'medium' | 'low',
      sourcesCount: 0,
      qualityScore: 0,
    }
  }

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

  return null
})

// ===== 最近资源包 =====
interface RecentPack {
  id: string; title: string; knowledgePoint: string; createdAt: string
  resourceCount: number; avgQuality: number; avgConfidence: 'high' | 'medium' | 'low'; isActive: boolean
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

// ===== 空状态引导 =====
const emptyGuideSteps = [
  { icon: '💬', title: 'AI 学习助手', desc: '与 AI 导师随便聊聊，画像在学习对话中无感积累', action: '去对话', route: '/chat' },
  { icon: '🔧', title: '生成资源包', desc: '基于画像自动生成≥5类个性化资源', action: '去工作室', route: '/studio' },
  { icon: '📈', title: '学习路径', desc: '获取动态调整的学习规划与练习反馈', action: '去路径', route: '/path' },
]

// ===== 交互方法 =====
const goToChat = () => router.push('/chat')
const goToStudio = (topic?: string) => {
  if (topic) router.push({ name: 'studio', query: { topic } })
  else router.push('/studio')
}
const goToPath = () => router.push('/path')
const openPack = (pack: RecentPack) => router.push({ path: '/library', query: { packId: pack.id } })

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

onMounted(() => {
  if (activeCourseId.value) {
    profile.refreshProfile(activeCourseId.value)
  }
  fetchTextbook()
  fetchStats()
  planStore.fetchPlan(activeCourseId.value || 'default')
  if (activeCourseId.value) {
    resourceStore.fetchPacks(activeCourseId.value)
    pushStore.fetchRecommendations(activeCourseId.value)
  }
})
</script>

<template>
  <div ref="pullContainer" class="m-dashboard">
    <!-- 下拉刷新指示器 -->
    <div class="m-pull-indicator" :class="{ visible: pullState !== 'idle', refreshing: pullState === 'refreshing' }" :style="{ height: pullDistance + 'px' }">
      <template v-if="pullState === 'refreshing'">
        <div class="m-pull-spinner" />
        <span>刷新中...</span>
      </template>
      <template v-else-if="pullDistance >= 60">
        <span>释放刷新</span>
      </template>
      <template v-else>
        <span>下拉刷新</span>
      </template>
    </div>

    <!-- 欢迎行 -->
    <div class="m-dash-header">
      <div>
        <h1 class="m-dash-title">
          <DashboardIcon :size="28" :animated="true" />
          <span>{{ greeting }}，{{ userName }}</span>
        </h1>
        <p class="m-dash-subtitle">{{ courseName }}<template v-if="todayMinutes !== null"> · 今日学习 {{ todayMinutes }} 分钟</template></p>
      </div>
      <div class="m-dash-header-actions">
        <button class="m-dash-icon-btn" :disabled="isRefreshing" @click="refreshMetrics">
          <el-icon :size="18" :class="{ 'm-spin': isRefreshing }"><RefreshRight /></el-icon>
        </button>
        <button class="m-dash-report-btn" @click="router.push('/report')">
          完整报告 <el-icon :size="14"><Right /></el-icon>
        </button>
      </div>
    </div>

    <!-- ===== 课程横向选择 Pill ===== -->
    <div v-if="profile.courses.length >= 1" class="m-course-pills">
      <button
        v-for="c in visibleCourses"
        :key="c.id"
        class="m-course-pill"
        :class="{ 'is-active': c.id === activeCourseId }"
        @click="switchCourse(c)"
      >
        <span class="m-course-pill-emoji">{{ c.emoji || '📚' }}</span>
        <span class="m-course-pill-name">{{ c.shortName || c.name }}</span>
      </button>
      <button
        v-if="hiddenCount > 0"
        class="m-course-pill m-course-more"
        @click="showCourseSheet = true"
      >
        <span>全部 {{ profile.courses.length }}</span>
        <el-icon :size="12"><Right /></el-icon>
      </button>
    </div>

    <!-- ===== 课程切换 BottomSheet ===== -->
    <BottomSheet v-model="showCourseSheet" height="medium" title="选择课程" :show-close="true">
      <div class="m-course-list">
        <button
          v-for="c in profile.courses"
          :key="c.id"
          class="m-course-item"
          :class="{ 'is-active': c.id === activeCourseId }"
          @click="switchCourse(c); showCourseSheet = false"
        >
          <span class="m-course-item-emoji">{{ c.emoji || '📚' }}</span>
          <div class="m-course-item-info">
            <div class="m-course-item-name">{{ c.name }}</div>
            <div v-if="c.teacher" class="m-course-item-teacher">{{ c.teacher }}</div>
          </div>
          <span v-if="c.id === activeCourseId" class="m-course-item-check">
            <el-icon :size="16"><Right /></el-icon>
          </span>
        </button>
      </div>
    </BottomSheet>

    <!-- ===== 空状态 ===== -->
    <template v-if="!hasProfile">
      <div class="m-empty-hero">
        <el-icon :size="48" style="color: var(--lt-brand);"><User /></el-icon>
        <h2 class="m-empty-title">开始你的个性化学习之旅</h2>
        <p class="m-empty-desc">与智能导师进行 2 分钟对话，即可解锁个性化资源推荐、学习路径规划与精准练习。</p>
        <div class="m-empty-steps">
          <div v-for="(step, idx) in emptyGuideSteps" :key="idx" class="m-empty-step" @click="router.push(step.route)">
            <div class="m-step-icon">{{ step.icon }}</div>
            <h3 class="m-step-title">{{ step.title }}</h3>
            <p class="m-step-desc">{{ step.desc }}</p>
            <span class="m-step-action">{{ step.action }} →</span>
          </div>
        </div>
        <button class="m-dash-primary-btn" @click="goToChat">
          开始对话建画像 <el-icon :size="16" class="ml-1"><Right /></el-icon>
        </button>
      </div>
    </template>

    <!-- ===== 有画像 ===== -->
    <template v-else>
      <!-- 1. 指标卡：2列×2行 -->
      <div class="m-metrics">
        <div
          v-for="(metric, idx) in metrics" :key="idx"
          class="m-metric-card"
          :style="{ '--metric-color': metric.color }"
          @click="router.push(['/chat','/chat','/studio','/path'][idx])"
         
        >
          <div class="m-metric-icon" :style="{ color: metric.color, backgroundColor: metric.bg }">
            <el-icon :size="20"><component :is="metric.icon" /></el-icon>
          </div>
          <div class="m-metric-body">
            <p class="m-metric-label">{{ metric.label }}</p>
            <p class="m-metric-value">{{ metric.value }}<span class="m-metric-unit">{{ metric.unit }}</span></p>
          </div>
        </div>
      </div>

      <!-- 2. 下一步推荐 -->
      <div class="m-recommend-card">
        <div class="m-section-header">
          <span class="m-section-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--lt-brand)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
              <circle cx="12" cy="12" r="10" style="stroke: var(--lt-brand); opacity: 0.5;"/>
              <g>
                <animateTransform attributeName="transform" type="rotate" values="-20 12 12;20 12 12;-20 12 12" dur="2.8s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1"/>
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" style="fill: var(--lt-brand); stroke: none;"/>
              </g>
            </svg>
            下一步学习推荐
          </span>
          <button class="m-section-link" @click="goToPath">查看完整路径 →</button>
        </div>

        <div v-if="!nextRecommendation" class="m-recommend-empty">
          <p>暂无推荐数据，快去对话建立学习画像吧</p>
          <button class="m-dash-primary-btn m-btn-sm" @click="goToChat">去对话</button>
        </div>
        <template v-else>
          <h3 class="m-recommend-title">{{ nextRecommendation.title }}</h3>
          <p class="m-recommend-kp">知识点：{{ nextRecommendation.knowledgePoint }}</p>

          <div class="m-recommend-meta">
            <span v-if="nextRecommendation.sourcesCount" class="m-reco-stat">
              <el-icon :size="12"><Document /></el-icon> 来源 {{ nextRecommendation.sourcesCount }}
            </span>
            <span v-if="nextRecommendation.qualityScore" class="m-reco-stat">
              <el-icon :size="12"><TrendCharts /></el-icon> 质量 {{ nextRecommendation.qualityScore }}/100
            </span>
            <span class="m-reco-stat">
              <el-icon :size="12"><Timer /></el-icon> 预计 {{ nextRecommendation.estimatedMinutes }} 分钟
            </span>
            <span
              class="m-reco-tag"
              :class="{ success: nextRecommendation.confidence === 'high', warning: nextRecommendation.confidence === 'medium', danger: nextRecommendation.confidence === 'low' }"
            >
              {{ CONFIDENCE_CONFIG[nextRecommendation.confidence].label }}置信度
            </span>
          </div>

          <div class="m-recommend-reasons">
            <span v-for="(reason, ridx) in nextRecommendation.reason" :key="ridx" class="m-reason-tag">
              {{ reason }}
            </span>
          </div>

          <div class="m-recommend-actions">
            <button class="m-dash-primary-btn m-btn-block" @click="nextRecommendation.knowledgePoint ? goToStudio(nextRecommendation.knowledgePoint) : goToStudio()">
              去生成资源包 <el-icon :size="14" class="ml-1"><MagicStick /></el-icon>
            </button>
            <button class="m-dash-secondary-btn" @click="goToPath">查看路径位置</button>
          </div>
        </template>

        <!-- 次要推荐 -->
        <div v-if="pushStore.secondaryRecommendations.length > 0" class="m-secondary-list">
          <p class="m-secondary-title">你可能也需要：</p>
          <div
            v-for="item in pushStore.secondaryRecommendations"
            :key="item.packId"
            class="m-secondary-item"
            @click="router.push(`/library?packId=${item.packId}`)"
           
          >
            <div class="m-secondary-left">
              <span class="m-secondary-icon">{{ item.resourceCount > 1 ? '🧩' : '📄' }}</span>
              <span class="m-secondary-name">{{ item.title }}</span>
              <span v-if="item.weaknessMatch > 0.5" class="m-secondary-badge danger">薄弱项</span>
              <span v-else-if="item.pathMatch > 0.5" class="m-secondary-badge primary">路径匹配</span>
            </div>
            <span class="m-secondary-time">{{ item.estimatedMinutes }}min</span>
          </div>
        </div>
      </div>

      <!-- 3. 学习画像 -->
      <div class="m-profile-card">
        <div class="m-section-header">
          <span class="m-section-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--lt-ai)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" style="opacity: 0.5;"/>
              <circle cx="12" cy="7" r="4">
                <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite"/>
              </circle>
            </svg>
            学习画像
          </span>
          <button class="m-section-link" @click="goToChat">详细画像 →</button>
        </div>

        <!-- L1: 核心信息 -->
        <div v-if="profileCoreInfo" class="m-core-info">
          <div class="m-core-header">
            <span class="m-core-dot" style="background: var(--lt-brand);"></span>
            核心信息
          </div>
          <div class="m-core-row">
            <span class="m-core-major">{{ profileCoreInfo.major }}</span>
            <span class="m-core-divider"></span>
            <span>{{ profileCoreInfo.grade }}</span>
          </div>
          <p v-if="profileCoreInfo.goal" class="m-core-goal">🎯 {{ profileCoreInfo.goal }}</p>
          <div class="m-mastery-bar">
            <div class="m-mastery-label">
              <span>掌握比</span>
              <span class="m-mastery-pct">{{ masteryRatio }}%</span>
            </div>
            <div class="m-mastery-track">
              <div class="m-mastery-fill" :style="{ width: masteryRatio + '%' }"></div>
            </div>
          </div>
        </div>

        <!-- L2: 雷达图 -->
        <div class="m-radar-wrap">
          <div class="m-radar-label">画像全貌</div>
          <div class="m-radar-chart">
            <v-chart class="w-full h-full" :option="radarOption" autoresize />
          </div>
        </div>

        <!-- L3: 标签云 -->
        <div class="m-tags-section">
          <div v-if="weakTags.length > 0" class="m-tag-group">
            <span class="m-tag-group-label">薄弱项</span>
            <div class="m-tag-row">
              <span v-for="tag in weakTags" :key="tag" class="m-tag danger">{{ tag }}</span>
            </div>
          </div>
          <div v-if="strongTags.length > 0" class="m-tag-group">
            <span class="m-tag-group-label">掌握项</span>
            <div class="m-tag-row">
              <span v-for="tag in strongTags" :key="tag" class="m-tag success">{{ tag }}</span>
            </div>
          </div>
          <div v-if="interestTags.length > 0" class="m-tag-group">
            <span class="m-tag-group-label">兴趣</span>
            <div class="m-tag-row">
              <span v-for="tag in interestTags" :key="tag" class="m-tag primary">{{ tag }}</span>
            </div>
          </div>
          <div v-if="errorPatterns.length > 0" class="m-tag-group">
            <span class="m-tag-group-label">错误模式</span>
            <div class="m-tag-row">
              <span v-for="pattern in errorPatterns" :key="pattern" class="m-tag warning">{{ pattern }}</span>
            </div>
          </div>
        </div>

        <!-- L4: 学习风格 + 版本 -->
        <div class="m-profile-meta">
          <div class="m-meta-row">
            <span class="m-meta-label">学习节奏</span>
            <span class="m-meta-value">{{ profilePace }} 分钟/天</span>
          </div>
          <div class="m-meta-row">
            <span class="m-meta-label">内容偏好</span>
            <span class="m-meta-value m-meta-pref">{{ profilePreference }}</span>
          </div>
          <div class="m-meta-row">
            <span class="m-meta-label">画像版本</span>
            <span class="m-meta-version">{{ profileVersion }} · {{ profileUpdatedAt }}</span>
          </div>
        </div>
      </div>

      <!-- 4. 学习动态 -->
      <div class="m-section-card">
        <div class="m-section-header">
          <span class="m-section-label">
            <el-icon :size="16"><TrendCharts /></el-icon> 学习动态
          </span>
          <button class="m-section-link" @click="router.push('/report')">查看完整报告 →</button>
        </div>
        <template v-if="hasStats">
          <div class="flex items-end gap-1.5 h-24 mb-3">
            <div v-for="(h, i) in weeklyHours" :key="i" class="flex-1 flex flex-col items-center gap-0.5">
              <span class="text-[9px]" style="color: var(--lt-text-auxiliary);">{{ h > 0 ? h : '' }}</span>
              <div
                class="w-full rounded-t-md"
                :style="{
                  height: Math.max(h / (Math.max(...weeklyHours, 1)) * 100, 4) + '%',
                  background: i === weeklyHours.length - 1 ? 'var(--lt-brand)' : 'var(--lt-brand-lighter)',
                }"
              />
              <span class="text-[9px]" style="color: var(--lt-text-placeholder);">{{ ['一','二','三','四','五','六','日'][i] }}</span>
            </div>
          </div>
          <div v-if="recentActivities.length > 0" class="space-y-1.5">
            <p class="text-xs font-medium" style="color: var(--lt-text-secondary);">最近活动</p>
            <div v-for="(act, i) in recentActivities.slice(0, 3)" :key="i" class="flex items-center gap-2 text-xs py-1.5 px-2 rounded-md" style="background-color: var(--lt-bg-page);">
              <span>{{ { chat: '💬', lecture: '📖', resource: '📝', plan: '🗺', practice: '✏️', reading: '🎓' }[act.type] ?? '📄' }}</span>
              <span class="flex-1 truncate" style="color: var(--lt-text-secondary);">{{ act.label }}</span>
              <span style="color: var(--lt-text-placeholder);">{{ act.time }}</span>
            </div>
          </div>
        </template>
        <p v-else class="text-xs text-center py-6" style="color: var(--lt-text-auxiliary);">完成对话和练习后，学习动态将在此展示</p>
      </div>

      <!-- 5. 最近资源包 -->
      <div class="m-packs-card">
        <div class="m-section-header">
          <span class="m-section-label">
            <el-icon :size="16"><Document /></el-icon> 最近生成的资源包
          </span>
          <button class="m-section-link" @click="goToStudio()">查看全部 →</button>
        </div>
        <div v-if="recentPacks.length > 0" class="m-pack-list">
          <div v-for="pack in recentPacks" :key="pack.id" class="m-pack-item" @click="openPack(pack)">
            <div class="m-pack-top">
              <span class="m-pack-name">{{ pack.title }}</span>
              <span v-if="pack.isActive" class="m-pack-active">当前</span>
              <span class="m-pack-conf" :class="pack.avgConfidence">{{ getConfidenceConfig(pack.avgConfidence).label }}</span>
            </div>
            <div class="m-pack-meta">
              <span>{{ pack.resourceCount }} 类资源</span>
              <span>质量 {{ pack.avgQuality }}/100</span>
              <span>{{ formatPackTime(pack.createdAt) }}</span>
            </div>
          </div>
        </div>
        <p v-else class="text-xs text-center py-6" style="color: var(--lt-text-auxiliary);">暂无资源包数据</p>
      </div>

      <!-- 6. 教材信息 -->
      <div v-if="textbookLoading" class="m-section-card">
        <div class="space-y-2 animate-pulse">
          <div class="h-5 w-3/4 rounded" style="background-color: var(--lt-bg-page);" />
          <div class="h-3 w-1/2 rounded" style="background-color: var(--lt-bg-page);" />
          <div class="h-3 w-full rounded" style="background-color: var(--lt-bg-page);" />
        </div>
      </div>
      <div v-else-if="textbook" class="m-textbook-card" @click="showTocSheet = true">
        <div class="m-textbook-header">
          <span class="m-textbook-badge">
            <el-icon :size="14"><Reading /></el-icon> 教材信息
          </span>
          <div class="flex items-center gap-2">
            <button class="m-textbook-kg-btn" @click.stop="showKgDialog = true" title="查看知识图谱">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="10" cy="5" r="2.5" />
                <circle cx="3" cy="19" r="2" />
                <circle cx="21" cy="19" r="2" />
                <path d="M10 7.5 4.5 17" />
                <path d="M10 7.5 17 17" />
                <path d="M5 17 18.5 17" />
              </svg>
            </button>
            <span class="m-textbook-toc-link" @click.stop="showTocSheet = true">查看目录 →</span>
          </div>
        </div>
        <h3 class="m-textbook-title">《{{ textbook.title }}》</h3>
        <p v-if="textbook.author" class="m-textbook-author">作者：{{ textbook.author }}</p>
        <p v-if="textbook.introduction" class="m-textbook-intro line-clamp-2">{{ textbook.introduction }}</p>
      </div>
      <div v-else class="m-section-card text-center py-3">
        <p class="text-sm" style="color: var(--lt-text-placeholder);">暂无教材信息</p>
      </div>
    </template>

    <!-- ===== 更多功能 ===== -->
    <div class="m-more-section">
      <div class="m-section-header">
        <span class="m-section-label">
          <el-icon :size="16"><Grid /></el-icon> 更多功能
        </span>
      </div>
      <div class="m-more-list">
        <button class="m-more-item" @click="router.push('/practice')">
          <div class="m-more-icon" style="color: var(--lt-brand); background: rgba(43,111,255,0.08);">
            <el-icon :size="22"><EditPen /></el-icon>
          </div>
          <div class="m-more-body">
            <p class="m-more-title">练习中心</p>
            <p class="m-more-desc">刷题练习 · AI 组卷 · 错题重做</p>
          </div>
          <el-icon :size="14" class="m-more-arrow"><Right /></el-icon>
        </button>
        <button class="m-more-item" @click="router.push('/forum')">
          <div class="m-more-icon" style="color: var(--lt-orange); background: rgba(255,140,66,0.08);">
            <el-icon :size="22"><ChatDotRound /></el-icon>
          </div>
          <div class="m-more-body">
            <p class="m-more-title">学习论坛</p>
            <p class="m-more-desc">交流讨论 · 互助答疑</p>
          </div>
          <el-icon :size="14" class="m-more-arrow"><Right /></el-icon>
        </button>
        <button class="m-more-item" @click="router.push('/code')">
          <div class="m-more-icon" style="color: var(--lt-ai); background: rgba(124,92,252,0.08);">
            <el-icon :size="22"><Monitor /></el-icon>
          </div>
          <div class="m-more-body">
            <p class="m-more-title">代码学习</p>
            <p class="m-more-desc">在线编程 · 实战练习</p>
          </div>
          <el-icon :size="14" class="m-more-arrow"><Right /></el-icon>
        </button>
      </div>
    </div>

    <!-- 教材目录 BottomSheet -->
    <BottomSheet v-model="showTocSheet" height="large" :title="`教材信息 —《${textbook?.title}》`">
      <template v-if="textbook">
        <div v-if="textbook.introduction" class="toc-section">
          <h4 class="toc-section-title">内容简介</h4>
          <p class="toc-intro-text">{{ textbook.introduction }}</p>
        </div>
        <div v-if="tocNodes.length > 0" class="toc-section">
          <h4 class="toc-section-title">章节目录</h4>
          <div class="toc-tree">
            <template v-for="node in tocNodes" :key="node.title">
              <div class="toc-node chapter">{{ node.title }}</div>
              <template v-if="node.children">
                <div v-for="child in node.children" :key="child.title" class="toc-node section">{{ child.title }}</div>
                <template v-for="child in node.children" :key="'sub-' + child.title">
                  <div v-for="sub in (child.children || [])" :key="sub.title" class="toc-node subsection">{{ sub.title }}</div>
                </template>
              </template>
            </template>
          </div>
        </div>
        <p v-if="!textbook.introduction && tocNodes.length === 0" class="toc-empty">暂无教材信息</p>
      </template>
    </BottomSheet>

    <!-- 知识图谱弹窗 -->
    <KnowledgeGraphDialog v-model="showKgDialog" :course-id="activeCourseId || ''" />
  </div>
</template>

<style scoped>
.m-dashboard {
  padding: var(--mobile-page-padding-x, 16px);
  padding-bottom: 24px;
  background: var(--lt-bg-page);
  min-height: 100%;
}

/* 全局触摸优化：消除点击延迟和高亮闪烁 */
.m-dashboard button,
.m-dashboard .m-metric-card,
.m-dashboard .m-empty-step,
.m-dashboard .m-secondary-item,
.m-dashboard .m-pack-item,
.m-dashboard .m-textbook-card,
.m-dashboard .m-more-item,
.m-dashboard .m-course-pill {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

/* ===== Course Pills ===== */
.m-course-pills {
  display: flex; gap: 8px; padding: 0 0 14px; overflow-x: auto;
  -webkit-overflow-scrolling: touch; scrollbar-width: none;
  margin-bottom: 2px;
}
.m-course-pills::-webkit-scrollbar { display: none; }
.m-course-pill {
  display: flex; align-items: center; gap: 4px; flex-shrink: 0;
  padding: 6px 14px; min-height: 44px; border-radius: 22px; border: 0.5px solid var(--lt-border);
  background: var(--lt-bg-card); color: var(--lt-text-secondary);
  font-size: 13px; cursor: pointer; touch-action: manipulation;
  transition: all 0.15s; white-space: nowrap;
}
.m-course-pill:active { transform: scale(0.96); }
.m-course-pill.is-active {
  background: var(--lt-brand); color: #fff; border-color: var(--lt-brand);
  font-weight: 500; box-shadow: 0 2px 8px rgba(43,111,255,0.2);
}
.m-course-pill-emoji { font-size: 14px; line-height: 1; }
.m-course-more { color: var(--lt-brand); border-color: var(--lt-brand-lighter); font-size: 12px; }

/* ===== Course BottomSheet ===== */
.m-course-list { display: flex; flex-direction: column; gap: 6px; padding: 4px 0; }
.m-course-item {
  display: flex; align-items: center; gap: 12px; padding: 14px 16px;
  border-radius: 12px; border: 0.5px solid var(--lt-border);
  background: var(--lt-bg-card); cursor: pointer; touch-action: manipulation;
  transition: all 0.15s; width: 100%; text-align: left;
}
.m-course-item:active { background: var(--lt-bg-page); }
.m-course-item.is-active {
  border-color: var(--lt-brand); background: var(--lt-brand-lightest);
}
.m-course-item-emoji { font-size: 24px; flex-shrink: 0; }
.m-course-item-info { flex: 1; min-width: 0; }
.m-course-item-name {
  font-size: 15px; font-weight: 500; color: var(--lt-text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.m-course-item-teacher { font-size: 12px; color: var(--lt-text-auxiliary); margin-top: 2px; }
.m-course-item-check { color: var(--lt-brand); flex-shrink: 0; }

/* ===== Header ===== */
.m-dash-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.m-dash-title { font-size: 20px; font-weight: 700; color: var(--lt-text-primary); display: flex; align-items: center; gap: 6px; margin: 0; }
.m-dash-subtitle { font-size: 12px; color: var(--lt-text-auxiliary); margin: 4px 0 0; }
.m-dash-header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.m-dash-icon-btn {
  width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
  border: 0.5px solid var(--lt-border); border-radius: 50%; background: var(--lt-bg-card);
  color: var(--lt-text-secondary); cursor: pointer; touch-action: manipulation;
}
.m-dash-icon-btn:active { background: var(--lt-bg-page); }
.m-dash-report-btn { display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--lt-brand); background: none; border: none; cursor: pointer; padding: 6px 0; min-height: 44px; touch-action: manipulation; flex-shrink: 0; }
.m-spin { animation: pull-spin 0.8s linear infinite; }

/* ===== Metrics (2-col) ===== */
.m-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
.m-metric-card {
  background: var(--lt-bg-card); border: 0.5px solid var(--lt-border); border-radius: 12px;
  padding: 14px; display: flex; align-items: center; gap: 10px; cursor: pointer;
  touch-action: manipulation; transition: transform 0.1s;
}
.m-metric-card:active { transform: scale(0.97); }
.m-metric-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.m-metric-body { min-width: 0; }
.m-metric-label { font-size: 11px; color: var(--lt-text-auxiliary); margin: 0 0 2px; }
.m-metric-value { font-size: 20px; font-weight: 700; color: var(--lt-text-primary); margin: 0; line-height: 1.2; }
.m-metric-unit { font-size: 11px; font-weight: 400; color: var(--lt-text-placeholder); margin-left: 2px; }

/* ===== Common ===== */
.m-section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.m-section-label { font-size: 15px; font-weight: 600; color: var(--lt-text-primary); display: flex; align-items: center; gap: 6px; }
.m-section-link { font-size: 12px; color: var(--lt-brand); background: none; border: none; cursor: pointer; touch-action: manipulation; white-space: nowrap; }
.m-section-card {
  background: var(--lt-bg-card); border: 0.5px solid var(--lt-border); border-radius: 12px;
  padding: 14px; margin-bottom: 16px;
}
.m-dash-primary-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 10px 20px; min-height: 44px;
  border: none; border-radius: 10px; background: var(--lt-brand); color: #fff;
  font-size: 14px; font-weight: 500; cursor: pointer; touch-action: manipulation; transition: background 0.1s;
}
.m-dash-primary-btn:active { background: var(--lt-brand-dark); }
.m-btn-sm { padding: 6px 16px; font-size: 13px; }
.m-btn-block { width: 100%; }
.m-dash-secondary-btn {
  display: flex; align-items: center; justify-content: center; width: 100%; padding: 10px 20px; min-height: 44px;
  border: 0.5px solid var(--lt-border); border-radius: 10px; background: var(--lt-bg-card);
  color: var(--lt-text-secondary); font-size: 14px; font-weight: 500;
  cursor: pointer; touch-action: manipulation; text-align: center;
}
.m-dash-secondary-btn:active { background: var(--lt-bg-page); }

/* ===== Textbook card ===== */
.m-textbook-card {
  background: var(--lt-bg-card); border: 0.5px solid var(--lt-border); border-radius: 12px;
  padding: 14px; margin-bottom: 16px; cursor: pointer; touch-action: manipulation;
}
.m-textbook-card:active { background: var(--lt-brand-lightest); }
.m-textbook-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.m-textbook-badge { font-size: 12px; font-weight: 500; color: var(--lt-brand); display: flex; align-items: center; gap: 4px; }
.m-textbook-toc-link { font-size: 12px; color: var(--lt-brand); }
.m-textbook-kg-btn { color: var(--lt-ai); display: flex; align-items: center; padding: 2px; border-radius: 4px; transition: background 0.15s; }
.m-textbook-kg-btn:active { background: rgba(124,92,252,0.08); }
.m-textbook-title { font-size: 15px; font-weight: 600; color: var(--lt-text-primary); margin: 0 0 4px; }
.m-textbook-author { font-size: 12px; color: var(--lt-text-auxiliary); margin: 0 0 4px; }
.m-textbook-intro { font-size: 13px; color: var(--lt-text-secondary); margin: 0; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

/* ===== Recommend card ===== */
.m-recommend-card {
  background: var(--lt-bg-card); border: 0.5px solid var(--lt-border); border-radius: 12px;
  padding: 14px; margin-bottom: 16px;
}
.m-recommend-empty { text-align: center; padding: 16px 0; }
.m-recommend-empty p { font-size: 13px; color: var(--lt-text-auxiliary); margin: 0 0 12px; }
.m-recommend-title { font-size: 17px; font-weight: 700; color: var(--lt-text-primary); margin: 0 0 4px; }
.m-recommend-kp { font-size: 12px; color: var(--lt-text-auxiliary); margin: 0 0 10px; }
.m-recommend-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; align-items: center; }
.m-reco-tag { font-size: 10px; padding: 2px 8px; border-radius: 8px; font-weight: 500; }
.m-reco-tag.success { background: rgba(52,199,89,0.1); color: var(--lt-success); }
.m-reco-tag.warning { background: rgba(255,159,10,0.1); color: var(--lt-warning); }
.m-reco-tag.danger { background: rgba(255,59,48,0.1); color: var(--lt-danger); }
.m-reco-stat { font-size: 11px; color: var(--lt-text-auxiliary); padding: 2px 6px; background: var(--lt-bg-page); border-radius: 6px; display: inline-flex; align-items: center; gap: 2px; }
.m-recommend-reasons { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.m-reason-tag { font-size: 11px; padding: 4px 10px; border-radius: 12px; background: var(--lt-brand-lightest); color: var(--lt-text-secondary); border: 0.5px solid var(--lt-brand-lighter); }
.m-recommend-actions { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }

/* ===== Secondary recommendations ===== */
.m-secondary-list { border-top: 0.5px solid var(--lt-border); padding-top: 12px; margin-top: 4px; }
.m-secondary-title { font-size: 12px; color: var(--lt-text-auxiliary); margin: 0 0 8px; font-weight: 500; }
.m-secondary-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 8px; border-radius: 8px; cursor: pointer; touch-action: manipulation;
}
.m-secondary-item:active { background: var(--lt-bg-page); }
.m-secondary-left { display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1; }
.m-secondary-icon { font-size: 14px; flex-shrink: 0; }
.m-secondary-name { font-size: 13px; color: var(--lt-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-secondary-badge { font-size: 10px; padding: 1px 6px; border-radius: 6px; font-weight: 500; flex-shrink: 0; }
.m-secondary-badge.danger { background: rgba(255,59,48,0.08); color: var(--lt-danger); }
.m-secondary-badge.primary { background: rgba(43,111,255,0.08); color: var(--lt-brand); }
.m-secondary-time { font-size: 11px; color: var(--lt-text-auxiliary); flex-shrink: 0; margin-left: 8px; }

/* ===== Profile card ===== */
.m-profile-card {
  background: var(--lt-bg-card); border: 0.5px solid var(--lt-border); border-radius: 12px;
  padding: 14px; margin-bottom: 16px;
}
.m-core-info { margin-bottom: 12px; }
.m-core-header { font-size: 11px; font-weight: 600; color: var(--lt-brand); display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.m-core-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
.m-core-row { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; color: var(--lt-text-primary); margin-bottom: 6px; }
.m-core-divider { width: 1px; height: 12px; background: var(--lt-border); flex-shrink: 0; }
.m-core-goal { font-size: 12px; color: var(--lt-text-secondary); margin: 0 0 8px; line-height: 1.4; }
.m-mastery-bar { margin-top: 4px; }
.m-mastery-label { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; }
.m-mastery-label span:first-child { color: var(--lt-text-auxiliary); }
.m-mastery-pct { color: var(--lt-ai); font-weight: 600; }
.m-mastery-track { height: 6px; background: var(--lt-bg-page); border-radius: 3px; overflow: hidden; }
.m-mastery-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--lt-brand), var(--lt-ai)); transition: width 0.7s ease-out; }
.m-radar-wrap { margin-bottom: 12px; }
.m-radar-label { font-size: 11px; color: var(--lt-text-auxiliary); display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.m-radar-label::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--lt-text-auxiliary); display: inline-block; }
.m-radar-chart { height: 180px; background: var(--lt-bg-page); border-radius: 8px; padding: 4px; }
.m-tags-section { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
.m-tag-group { display: flex; align-items: flex-start; gap: 8px; }
.m-tag-group-label { font-size: 11px; color: var(--lt-text-secondary); flex-shrink: 0; width: 44px; display: flex; align-items: center; gap: 2px; padding-top: 2px; }
.m-tag-row { display: flex; flex-wrap: wrap; gap: 4px; }
.m-tag { font-size: 10px; padding: 2px 8px; border-radius: 8px; font-weight: 500; }
.m-tag.danger { background: rgba(255,59,48,0.08); color: var(--lt-danger); }
.m-tag.success { background: rgba(52,199,89,0.08); color: var(--lt-success); }
.m-tag.primary { background: rgba(43,111,255,0.08); color: var(--lt-brand); }
.m-tag.warning { background: rgba(255,140,66,0.08); color: #EA580C; }
.m-profile-meta { background: var(--lt-bg-page); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
.m-meta-row { display: flex; justify-content: space-between; align-items: center; }
.m-meta-label { font-size: 12px; color: var(--lt-text-auxiliary); }
.m-meta-value { font-size: 12px; font-weight: 500; color: var(--lt-text-primary); }
.m-meta-pref { max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right; }
.m-meta-version { font-size: 10px; padding: 2px 8px; background: var(--lt-bg-card); border-radius: 6px; color: var(--lt-text-secondary); }

/* ===== Packs card ===== */
.m-packs-card {
  background: var(--lt-bg-card); border: 0.5px solid var(--lt-border); border-radius: 12px;
  padding: 14px; margin-bottom: 16px;
}
.m-pack-list { display: flex; flex-direction: column; gap: 10px; }
.m-pack-item {
  padding: 12px; background: var(--lt-bg-page); border-radius: 10px; cursor: pointer;
  touch-action: manipulation; transition: background 0.1s;
}
.m-pack-item:active { background: var(--lt-brand-lightest); }
.m-pack-top { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.m-pack-name { font-size: 14px; font-weight: 600; color: var(--lt-text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-pack-active { font-size: 10px; padding: 1px 6px; border-radius: 6px; background: rgba(52,199,89,0.12); color: var(--lt-success); font-weight: 500; flex-shrink: 0; }
.m-pack-conf { font-size: 10px; padding: 1px 6px; border-radius: 6px; font-weight: 500; flex-shrink: 0; }
.m-pack-conf.high { background: rgba(52,199,89,0.1); color: var(--lt-success); }
.m-pack-conf.medium { background: rgba(255,159,10,0.1); color: var(--lt-warning); }
.m-pack-conf.low { background: rgba(255,59,48,0.1); color: var(--lt-danger); }
.m-pack-meta { display: flex; gap: 10px; font-size: 11px; color: var(--lt-text-auxiliary); flex-wrap: wrap; }

/* ===== Empty state ===== */
.m-empty-hero { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 40px 12px; }
.m-empty-title { font-size: 18px; font-weight: 600; color: var(--lt-text-primary); margin: 12px 0 6px; }
.m-empty-desc { font-size: 13px; color: var(--lt-text-auxiliary); max-width: 280px; line-height: 1.5; margin: 0 0 24px; }
.m-empty-steps { display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 320px; margin-bottom: 20px; }
.m-empty-step {
  background: var(--lt-bg-card); border: 0.5px solid var(--lt-border); border-radius: 12px;
  padding: 14px; text-align: left; cursor: pointer; touch-action: manipulation; transition: background 0.1s;
}
.m-empty-step:active { background: var(--lt-brand-lightest); border-color: var(--lt-brand-lighter); }
.m-step-icon { font-size: 28px; margin-bottom: 6px; }
.m-step-title { font-size: 14px; font-weight: 600; color: var(--lt-text-primary); margin: 0 0 2px; }
.m-step-desc { font-size: 12px; color: var(--lt-text-auxiliary); margin: 0 0 6px; }
.m-step-action { font-size: 12px; font-weight: 500; color: var(--lt-brand); }

/* ===== Toc BottomSheet ===== */
.toc-section { margin-bottom: 16px; }
.toc-section-title { font-size: 13px; font-weight: 600; color: var(--lt-text-secondary); margin: 0 0 8px; }
.toc-intro-text { font-size: 13px; color: var(--lt-text-primary); line-height: 1.6; margin: 0; }
.toc-tree { max-height: 50vh; overflow-y: auto; }
.toc-node { padding: 6px 0; border-bottom: 1px solid var(--lt-border); font-size: 13px; }
.toc-node:last-child { border-bottom: none; }
.toc-node.chapter { font-weight: 600; color: var(--lt-text-primary); }
.toc-node.section { padding-left: 16px; color: var(--lt-text-secondary); }
.toc-node.subsection { padding-left: 32px; color: var(--lt-text-auxiliary); font-size: 12px; }
.toc-empty { text-align: center; font-size: 13px; color: var(--lt-text-placeholder); padding: 24px 0; }

/* ===== Pull-to-refresh ===== */
.m-pull-indicator {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  font-size: 12px; color: var(--lt-text-auxiliary);
  overflow: hidden; transition: height 0.1s;
  height: 0;
}
.m-pull-indicator.visible { min-height: 0; }
.m-pull-indicator.refreshing { color: var(--lt-brand); }
.m-pull-spinner {
  width: 16px; height: 16px;
  border: 2px solid var(--lt-border); border-top-color: var(--lt-brand);
  border-radius: 50%; animation: pull-spin 0.6s linear infinite;
}
@keyframes pull-spin { to { transform: rotate(360deg); } }

/* ===== 更多功能 ===== */
.m-more-section {
  margin-top: var(--mobile-section-gap, 20px);
}
.m-more-list {
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-lg, 12px);
  overflow: hidden;
}
.m-more-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px var(--mobile-card-padding, 12px);
  border: none;
  background: transparent;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  text-align: left;
  transition: background-color 0.1s ease-out;
}
.m-more-item:not(:last-child) {
  border-bottom: 1px solid var(--lt-border);
}
.m-more-item:active {
  background: var(--mobile-active-bg, rgba(43, 111, 255, 0.06));
}
.m-more-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.m-more-body {
  flex: 1;
  min-width: 0;
}
.m-more-title {
  font-size: var(--mobile-font-body, 15px);
  font-weight: 600;
  color: var(--lt-text-primary);
  margin: 0;
}
.m-more-desc {
  font-size: var(--mobile-font-caption, 13px);
  color: var(--lt-text-auxiliary);
  margin: 2px 0 0;
}
.m-more-arrow {
  color: var(--lt-text-placeholder);
  flex-shrink: 0;
}
</style>
