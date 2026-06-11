<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProfileStore } from '@/stores/profile'
import { usePlanStore } from '@/stores/plan'
import { usePullToRefresh } from '@/composables/usePullToRefresh'
import { apiFetch } from '@/utils/api'
import { getConfidenceConfig, CONFIDENCE_CONFIG } from '@/constants'
import type { CourseTextbook, ChapterNode } from '@/types'
import * as echarts from 'echarts/core'
import { RadarChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import {
  Timer, WarningFilled, Document, Medal, Right, Aim,
  TrendCharts, Reading, User, MagicStick
} from '@element-plus/icons-vue'
import BottomSheet from '@/components/mobile/BottomSheet.vue'
import DashboardIcon from '@/components/icons/DashboardIcon.vue'

const router = useRouter()
const profile = useProfileStore()
const planStore = usePlanStore()

const pullContainer = ref<HTMLElement | null>(null)
const { pullState, pullDistance } = usePullToRefresh(pullContainer, async () => {
  fetchTextbook()
  profile.refreshProfile()
})

echarts.use([RadarChart, CanvasRenderer])

// ===== 教材信息 =====
const activeCourseId = computed(() => profile.activeCourseId)
const textbook = ref<CourseTextbook | null>(null)
const textbookLoading = ref(false)
const showTocSheet = ref(false)

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
  { label: '今日学习', value: profilePace.value, unit: '分钟/天', icon: Timer, color: 'var(--lt-brand)', bg: 'rgba(43,111,255,0.08)' },
  { label: '薄弱项', value: weakTags.value.length, unit: '个需加强', icon: WarningFilled, color: 'var(--lt-danger)', bg: 'rgba(255,59,48,0.08)' },
  { label: '资源包', value: recentPacks.value.length, unit: '个', icon: Document, color: 'var(--lt-success)', bg: 'rgba(52,199,89,0.08)' },
  { label: '路径进度', value: pathProgress.value, unit: '%', icon: Medal, color: 'var(--lt-warning)', bg: 'rgba(255,159,10,0.08)' },
])

const pathProgress = computed(() => planStore.overallProgress)

const radarIndicators = computed(() =>
  profile.dimensions.map(d => ({ name: d.name, max: 100 }))
)

const chartColors = computed(() => {
  const style = getComputedStyle(document.documentElement)
  return {
    brand: style.getPropertyValue('--lt-brand').trim() || '#2B6FFF',
    textSecondary: style.getPropertyValue('--lt-text-secondary').trim() || '#64748b',
  }
})

const radarOption = computed(() => ({
  radar: {
    indicator: radarIndicators.value,
    radius: '50%',
    center: ['50%', '50%'],
    axisName: { color: chartColors.value.textSecondary, fontSize: 9 },
    splitArea: { areaStyle: { color: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1'] } },
    axisLine: { lineStyle: { color: '#e2e8f0' } },
    splitLine: { lineStyle: { color: '#e2e8f0' } },
  },
  series: [{
    name: '当前画像',
    type: 'radar',
    data: [{ value: profile.dimensions.map(d => d.value), name: '掌握度', itemStyle: { color: chartColors.value.brand }, areaStyle: { color: 'rgba(43,111,255,0.1)' } }],
  }],
}))

const profileVersion = computed(() => profile.profileVersion)
const profileUpdatedAt = computed(() => profile.updatedAt)

// ===== 下一步推荐 =====
const nextRecommendation = computed(() => ({
  title: 'A* 搜索算法详解',
  knowledgePoint: 'A* 搜索算法',
  reason: ['针对薄弱点：架构设计', '偏好：代码实操优先', '节奏：15分钟/天'],
  estimatedMinutes: 15,
  sourcesCount: 6,
  qualityScore: 88,
  confidence: 'high' as const,
}))

// ===== 最近资源包 =====
interface RecentPack {
  id: string; title: string; knowledgePoint: string; createdAt: string
  resourceCount: number; avgQuality: number; avgConfidence: 'high' | 'medium' | 'low'; isActive: boolean
}

const recentPacks = ref<RecentPack[]>([
  { id: 'RPK-003', title: 'A* 搜索算法学习包', knowledgePoint: 'A* 搜索算法', createdAt: '2026-05-05 14:30', resourceCount: 5, avgQuality: 92, avgConfidence: 'high', isActive: true },
  { id: 'RPK-002', title: 'Vue3 响应式原理学习包', knowledgePoint: 'Vue3 响应式', createdAt: '2026-05-04 10:15', resourceCount: 4, avgQuality: 85, avgConfidence: 'high', isActive: false },
  { id: 'RPK-001', title: 'JavaScript 闭包与作用域', knowledgePoint: 'JS 闭包', createdAt: '2026-05-03 09:00', resourceCount: 6, avgQuality: 78, avgConfidence: 'medium', isActive: false },
])

// ===== 空状态引导 =====
const emptyGuideSteps = [
  { icon: '💬', title: 'AI 学习助手', desc: '与 AI 导师随便聊聊，画像在学习对话中无感积累', action: '去对话', route: '/chat' },
  { icon: '🔧', title: '生成资源包', desc: '基于画像自动生成≥5类个性化资源', action: '去工作室', route: '/studio' },
  { icon: '📈', title: '学习路径', desc: '获取动态调整的学习规划与练习反馈', action: '去路径', route: '/path' },
]

onMounted(() => { fetchTextbook() })
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
    <!-- 标题行 -->
    <div class="m-dash-header">
      <div>
        <h1 class="m-dash-title">
          <DashboardIcon :size="28" :animated="true" />
          <span>学习总览</span>
        </h1>
        <p class="m-dash-subtitle">基于多智能体画像驱动的个性化学习概览</p>
      </div>
      <button class="m-dash-report-btn" @click="router.push('/report')">
        完整报告 <el-icon :size="14"><Right /></el-icon>
      </button>
    </div>

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
        <button class="m-dash-primary-btn" @click="router.push('/chat')">
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

      <!-- 2. 教材信息卡片 -->
      <div v-if="textbook" class="m-textbook-card" @click="showTocSheet = true">
        <div class="m-textbook-header">
          <span class="m-textbook-badge">
            <el-icon :size="14"><Reading /></el-icon> 教材信息
          </span>
          <span class="m-textbook-toc-link">查看目录 →</span>
        </div>
        <h3 class="m-textbook-title">《{{ textbook.title }}》</h3>
        <p v-if="textbook.author" class="m-textbook-author">作者：{{ textbook.author }}</p>
        <p v-if="textbook.introduction" class="m-textbook-intro line-clamp-3">{{ textbook.introduction }}</p>
      </div>

      <!-- 3. 下一步推荐（排在画像前面） -->
      <div class="m-recommend-card">
        <div class="m-section-header">
          <span class="m-section-label">
            <el-icon :size="16"><Aim /></el-icon> 下一步学习推荐
          </span>
          <button class="m-section-link" @click="router.push('/path')">查看完整路径 →</button>
        </div>
        <h3 class="m-recommend-title">{{ nextRecommendation.title }}</h3>
        <p class="m-recommend-kp">知识点：{{ nextRecommendation.knowledgePoint }}</p>
        <div class="m-recommend-meta">
          <span class="m-reco-tag" :class="CONFIDENCE_CONFIG[nextRecommendation.confidence].type">
            {{ CONFIDENCE_CONFIG[nextRecommendation.confidence].label }}置信度
          </span>
          <span class="m-reco-stat">来源 {{ nextRecommendation.sourcesCount }}</span>
          <span class="m-reco-stat">质量 {{ nextRecommendation.qualityScore }}/100</span>
          <span class="m-reco-stat">{{ nextRecommendation.estimatedMinutes }}分钟</span>
        </div>
        <div class="m-recommend-reasons">
          <span v-for="(r, i) in nextRecommendation.reason" :key="i" class="m-reason-tag">{{ r }}</span>
        </div>
        <div class="m-recommend-actions">
          <button class="m-dash-primary-btn" @click="router.push({ path: '/studio', query: { topic: nextRecommendation.knowledgePoint } })">
            <el-icon :size="14"><MagicStick /></el-icon> 去生成资源包
          </button>
        </div>
        <div class="m-recommend-progress">
          <span class="m-progress-label">路径整体进度 {{ pathProgress }}%</span>
          <div class="m-progress-track">
            <div class="m-progress-fill" :style="{ width: pathProgress + '%' }" />
          </div>
        </div>
      </div>

      <!-- 4. 画像快照 -->
      <div class="m-profile-card">
        <div class="m-section-header">
          <span class="m-section-label">
            <el-icon :size="16"><User /></el-icon> 画像快照
          </span>
          <button class="m-section-link" @click="router.push('/chat')">详细画像 →</button>
        </div>
        <div class="m-radar-wrap">
          <v-chart class="m-radar-chart" :option="radarOption" autoresize />
        </div>
        <div class="m-tags-section">
          <div class="m-tag-group">
            <span class="m-tag-group-label"><el-icon :size="12"><WarningFilled /></el-icon>薄弱</span>
            <div class="m-tag-row">
              <span v-for="t in weakTags" :key="t" class="m-tag danger">{{ t }}</span>
            </div>
          </div>
          <div class="m-tag-group">
            <span class="m-tag-group-label"><el-icon :size="12"><Medal /></el-icon>掌握</span>
            <div class="m-tag-row">
              <span v-for="t in strongTags" :key="t" class="m-tag success">{{ t }}</span>
            </div>
          </div>
          <div class="m-tag-group">
            <span class="m-tag-group-label"><el-icon :size="12"><Reading /></el-icon>兴趣</span>
            <div class="m-tag-row">
              <span v-for="t in interestTags" :key="t" class="m-tag primary">{{ t }}</span>
            </div>
          </div>
        </div>
        <div class="m-profile-meta">
          <div class="m-meta-row"><span class="m-meta-label">学习节奏</span><span class="m-meta-value">{{ profilePace }} 分钟/天</span></div>
          <div class="m-meta-row"><span class="m-meta-label">内容偏好</span><span class="m-meta-value">{{ profilePreference }}</span></div>
          <div class="m-meta-row"><span class="m-meta-label">画像版本</span><span class="m-meta-value m-meta-version">{{ profileVersion }} · {{ profileUpdatedAt }}</span></div>
        </div>
      </div>

      <!-- 5. 最近资源包：卡片列表替代 el-table -->
      <div class="m-packs-card">
        <div class="m-section-header">
          <span class="m-section-label">
            <el-icon :size="16"><Document /></el-icon> 最近资源包
          </span>
          <button class="m-section-link" @click="router.push('/library')">查看全部 →</button>
        </div>
        <div class="m-pack-list">
          <div v-for="pack in recentPacks" :key="pack.id" class="m-pack-item" @click="router.push({ path: '/library', query: { packId: pack.id } })">
            <div class="m-pack-top">
              <span class="m-pack-name">{{ pack.title }}</span>
              <span v-if="pack.isActive" class="m-pack-active">当前</span>
              <span class="m-pack-conf" :class="pack.avgConfidence">{{ getConfidenceConfig(pack.avgConfidence).label }}</span>
            </div>
            <div class="m-pack-meta">
              <span>{{ pack.resourceCount }} 类资源</span>
              <span>质量 {{ pack.avgQuality }}/100</span>
              <span>{{ pack.createdAt }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

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
  </div>
</template>

<style scoped>
.m-dashboard {
  padding: var(--mobile-page-padding-x, 16px);
  padding-bottom: 24px;
  background: var(--lt-bg-page);
  min-height: 100%;
}

/* ===== Header ===== */
.m-dash-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.m-dash-title { font-size: 20px; font-weight: 700; color: var(--lt-text-primary); display: flex; align-items: center; gap: 6px; margin: 0; }
.m-dash-subtitle { font-size: 12px; color: var(--lt-text-auxiliary); margin: 4px 0 0; }
.m-dash-report-btn { display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--lt-brand); background: none; border: none; cursor: pointer; padding: 6px 0; touch-action: manipulation; flex-shrink: 0; }

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
.m-section-link { font-size: 12px; color: var(--lt-brand); background: none; border: none; cursor: pointer; touch-action: manipulation; }
.m-dash-primary-btn {
  display: inline-flex; align-items: center; gap: 4px; padding: 10px 20px;
  border: none; border-radius: 10px; background: var(--lt-brand); color: #fff;
  font-size: 14px; font-weight: 500; cursor: pointer; touch-action: manipulation; transition: background 0.1s;
}
.m-dash-primary-btn:active { background: var(--lt-brand-dark); }

/* ===== Textbook card ===== */
.m-textbook-card {
  background: var(--lt-bg-card); border: 0.5px solid var(--lt-border); border-radius: 12px;
  padding: 14px; margin-bottom: 16px; cursor: pointer; touch-action: manipulation;
}
.m-textbook-card:active { background: var(--lt-brand-lightest); }
.m-textbook-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.m-textbook-badge { font-size: 12px; font-weight: 500; color: var(--lt-brand); display: flex; align-items: center; gap: 4px; }
.m-textbook-toc-link { font-size: 12px; color: var(--lt-brand); }
.m-textbook-title { font-size: 15px; font-weight: 600; color: var(--lt-text-primary); margin: 0 0 4px; }
.m-textbook-author { font-size: 12px; color: var(--lt-text-auxiliary); margin: 0 0 4px; }
.m-textbook-intro { font-size: 13px; color: var(--lt-text-secondary); margin: 0; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

/* ===== Recommend card ===== */
.m-recommend-card {
  background: var(--lt-bg-card); border: 0.5px solid var(--lt-border); border-radius: 12px;
  padding: 14px; margin-bottom: 16px;
}
.m-recommend-title { font-size: 17px; font-weight: 700; color: var(--lt-text-primary); margin: 0 0 4px; }
.m-recommend-kp { font-size: 12px; color: var(--lt-text-auxiliary); margin: 0 0 10px; }
.m-recommend-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.m-reco-tag { font-size: 10px; padding: 2px 8px; border-radius: 8px; font-weight: 500; }
.m-reco-tag.success { background: rgba(52,199,89,0.1); color: var(--lt-success); }
.m-reco-tag.warning { background: rgba(255,159,10,0.1); color: var(--lt-warning); }
.m-reco-tag.danger { background: rgba(255,59,48,0.1); color: var(--lt-danger); }
.m-reco-stat { font-size: 11px; color: var(--lt-text-auxiliary); padding: 2px 6px; background: var(--lt-bg-page); border-radius: 6px; }
.m-recommend-reasons { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.m-reason-tag { font-size: 11px; padding: 4px 10px; border-radius: 12px; background: var(--lt-brand-lightest); color: var(--lt-text-secondary); border: 0.5px solid var(--lt-brand-lighter); }
.m-recommend-actions { margin-bottom: 14px; }
.m-recommend-progress { }
.m-progress-label { font-size: 11px; color: var(--lt-text-auxiliary); display: block; margin-bottom: 6px; }
.m-progress-track { height: 6px; background: var(--lt-bg-page); border-radius: 3px; overflow: hidden; }
.m-progress-fill { height: 100%; background: var(--lt-brand); border-radius: 3px; transition: width 0.3s; }

/* ===== Profile card ===== */
.m-profile-card {
  background: var(--lt-bg-card); border: 0.5px solid var(--lt-border); border-radius: 12px;
  padding: 14px; margin-bottom: 16px;
}
.m-radar-wrap { height: 200px; margin-bottom: 12px; background: var(--lt-bg-page); border-radius: 8px; padding: 4px; }
.m-radar-chart { width: 100%; height: 100%; }

.m-tags-section { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
.m-tag-group { display: flex; align-items: flex-start; gap: 8px; }
.m-tag-group-label { font-size: 11px; color: var(--lt-text-secondary); flex-shrink: 0; width: 40px; display: flex; align-items: center; gap: 2px; padding-top: 2px; }
.m-tag-row { display: flex; flex-wrap: wrap; gap: 4px; }
.m-tag { font-size: 10px; padding: 2px 8px; border-radius: 8px; font-weight: 500; }
.m-tag.danger { background: rgba(255,59,48,0.08); color: var(--lt-danger); }
.m-tag.success { background: rgba(52,199,89,0.08); color: var(--lt-success); }
.m-tag.primary { background: rgba(43,111,255,0.08); color: var(--lt-brand); }

.m-profile-meta { background: var(--lt-bg-page); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
.m-meta-row { display: flex; justify-content: space-between; align-items: center; }
.m-meta-label { font-size: 12px; color: var(--lt-text-auxiliary); }
.m-meta-value { font-size: 12px; font-weight: 500; color: var(--lt-text-primary); }
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
.m-pack-name { font-size: 14px; font-weight: 600; color: var(--lt-text-primary); flex: 1; }
.m-pack-active { font-size: 10px; padding: 1px 6px; border-radius: 6px; background: rgba(52,199,89,0.12); color: var(--lt-success); font-weight: 500; }
.m-pack-conf { font-size: 10px; padding: 1px 6px; border-radius: 6px; font-weight: 500; }
.m-pack-conf.high { background: rgba(52,199,89,0.1); color: var(--lt-success); }
.m-pack-conf.medium { background: rgba(255,159,10,0.1); color: var(--lt-warning); }
.m-pack-conf.low { background: rgba(255,59,48,0.1); color: var(--lt-danger); }
.m-pack-meta { display: flex; gap: 10px; font-size: 11px; color: var(--lt-text-auxiliary); }

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
</style>
