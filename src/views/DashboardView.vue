<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
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
  Reading,
  User,
  MagicStick
} from '@element-plus/icons-vue'
import { useProfileStore } from '@/stores/profile'
import { usePathStore } from '@/stores/path'
import EmptyState from '@/components/EmptyState.vue'
import DashboardIcon from '@/components/icons/DashboardIcon.vue'

const router = useRouter()
const profile = useProfileStore()
const pathStore = usePathStore()

echarts.use([RadarChart, CanvasRenderer])

// ===== 响应式数据 =====

/** 是否有画像（基于 store 中的真实数据） */
const hasProfile = computed(() =>
  profile.fullProfile !== null && profile.fullProfile.dimensions.length > 0
)

/** 顶部 4 指标卡 */
const metrics = computed(() => [
  {
    label: '今日建议学习时长',
    value: profilePace.value,
    unit: '分钟/天',
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
    value: recentPacks.value.length,
    unit: '个',
    icon: Document,
    color: 'var(--lt-success)',
    bg: 'rgba(52, 199, 89, 0.08)'
  },
  {
    label: '当前路径完成度',
    value: pathProgress.value,
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

const radarOption = computed(() => ({
  radar: {
    indicator: radarIndicators.value,
    radius: '65%',
    center: ['50%', '50%'],
    axisName: {
      color: '#64748b',
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

const profileVersion = computed(() => profile.profileVersion)
const profileUpdatedAt = computed(() => profile.updatedAt)

// ===== 下一步推荐 =====
const nextRecommendation = computed(() => ({
  title: 'A* 搜索算法详解',
  knowledgePoint: 'A* 搜索算法',
  reason: [
    '针对薄弱点：架构设计 → 需掌握算法评估能力',
    '偏好：代码实操优先 → 含可运行代码示例',
    '节奏：15分钟/天 → 已生成速览版'
  ] as string[],
  estimatedMinutes: 15,
  resourcePackId: 'RPK-001',
  confidence: 'high' as const,
  sourcesCount: 6,
  qualityScore: 88
}))

// ===== 路径进度 =====
const pathProgress = computed(() => {
  const allNodes = pathStore.nodes.length
  if (allNodes === 0) return 0
  const mastered = pathStore.nodes.filter(n => n.status === 'mastered').length
  return Math.round((mastered / allNodes) * 100)
})

// ===== 最近资源包列表 =====
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

const recentPacks = ref<RecentPack[]>([
  {
    id: 'RPK-003',
    title: 'A\* 搜索算法学习包',
    knowledgePoint: 'A* 搜索算法',
    createdAt: '2026-05-05 14:30',
    resourceCount: 5,
    avgQuality: 92,
    avgConfidence: 'high',
    isActive: true
  },
  {
    id: 'RPK-002',
    title: 'Vue3 响应式原理学习包',
    knowledgePoint: 'Vue3 响应式',
    createdAt: '2026-05-04 10:15',
    resourceCount: 4,
    avgQuality: 85,
    avgConfidence: 'high',
    isActive: false
  },
  {
    id: 'RPK-001',
    title: 'JavaScript 闭包与作用域',
    knowledgePoint: 'JS 闭包',
    createdAt: '2026-05-03 09:00',
    resourceCount: 6,
    avgQuality: 78,
    avgConfidence: 'medium',
    isActive: false
  }
])

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
const goToLibrary = () => router.push('/library')

const openPack = (pack: RecentPack) => {
  router.push({ name: 'library', query: { packId: pack.id } })
}

const refreshMetrics = () => {
  ElMessage.success('已刷新仪表盘数据')
}

/** 指标卡点击跳转 */
const metricRoutes = ['/chat', '/chat', '/studio', '/path']
function handleMetricClick(idx: number) {
  const route = metricRoutes[idx]
  if (route) router.push(route)
}

// ===== 模拟数据加载 =====
onMounted(() => {
  // 可在此发起 API 请求获取真实数据
})
</script>

<template>
  <div class="dashboard-container h-full overflow-y-auto p-6 space-y-6">
        <!-- 页面标题行 -->
    <div class="flex items-center justify-between">
            <div>
        <h1 class="text-2xl font-bold flex items-center gap-2" style="color: var(--lt-text-primary);">
            <DashboardIcon :size="36" :animated="true" />
            <span>学习驾驶舱</span>
          </h1>
          <p class="text-sm mt-1 ml-[44px]" style="color: var(--lt-text-auxiliary);">基于多智能体画像驱动的个性化学习概览</p>
      </div>
      <el-button size="small" plain :icon="RefreshRight" @click="refreshMetrics" class="!rounded-full">
        刷新数据
      </el-button>
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

    <!-- ============ 完整驾驶舱（有画像） ============ -->
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

      <!-- 2. 中部两列：下一步推荐 + 画像快照 -->
      <el-row :gutter="20">
        <!-- 左：下一步推荐 -->
                                <el-col :xs="24" :lg="14" class="mb-4">
          <el-card shadow="never" class="h-full" style="border-radius: 12px; border: 1px solid var(--lt-border);">
              <template #header>
                <div class="flex items-center justify-between">
                  <span class="font-semibold flex items-center gap-2" style="color: var(--lt-text-primary);">
                    <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background: linear-gradient(135deg, var(--lt-brand), var(--lt-brand-dark));">
                      <el-icon size="14" color="white"><Aim /></el-icon>
                    </div>
                    下一步学习推荐
                  </span>
                  <el-button link type="primary" size="small" @click="goToPath" style="color: var(--lt-brand);">
                    查看完整路径 <el-icon><Right /></el-icon>
                  </el-button>
                </div>
              </template>

              <div class="p-2">
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

                                <!-- 证据行：来源用蓝色链接，质量分用中性色 -->
                <div class="flex items-center gap-4 text-xs mb-4 px-3 py-2 rounded-lg" style="color: var(--lt-text-auxiliary); background-color: var(--lt-bg-page);">
                  <span class="flex items-center gap-1" style="color: var(--lt-brand);">
                    <el-icon><Document /></el-icon>
                    来源 {{ nextRecommendation.sourcesCount }}
                  </span>
                  <span class="flex items-center gap-1 quality-score">
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
                    <el-tag
                      v-for="(reason, ridx) in nextRecommendation.reason"
                      :key="ridx"
                      size="small"
                      type="info"
                      effect="plain"
                      class="text-xs max-w-full"
                    >
                      {{ reason }}
                    </el-tag>
                  </div>
                </div>

                            <!-- 操作按钮 -->
              <div class="flex gap-3 mt-4">
                <el-button type="primary" @click="goToStudio(nextRecommendation.knowledgePoint)">
                  去生成资源包
                  <el-icon class="ml-1"><MagicStick /></el-icon>
                </el-button>
                <el-button plain @click="goToPath">
                  查看路径位置
                </el-button>
              </div>

              <!-- 进度条小提示 -->
                            <div class="mt-6 pt-4 border-t" style="border-color: var(--lt-border);">
                <div class="flex items-center justify-between text-xs mb-1" style="color: var(--lt-text-auxiliary);">
                  <span>当前路径整体进度</span>
                  <span class="font-semibold" style="color: var(--lt-text-secondary);">{{ pathProgress }}%</span>
                </div>
                <el-progress :percentage="pathProgress" :stroke-width="6" />
              </div>
            </div>
          </el-card>
        </el-col>

        <!-- 右：画像快照 -->
                                <el-col :xs="24" :lg="10" class="mb-4">
          <el-card shadow="never" class="h-full" style="border-radius: 12px; border: 1px solid var(--lt-border);">
              <template #header>
                <div class="flex items-center justify-between">
                  <span class="font-semibold flex items-center gap-2" style="color: var(--lt-text-primary);">
                    <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background: linear-gradient(135deg, var(--lt-success), #28A745);">
                      <el-icon size="14" color="white"><User /></el-icon>
                    </div>
                    画像快照
                  </span>
                  <el-button link type="primary" size="small" @click="goToChat" style="color: var(--lt-brand);">
                    详细画像 <el-icon><Right /></el-icon>
                  </el-button>
                </div>
              </template>

              <div class="space-y-4">
                                <!-- 迷你雷达图：蓝线 #2B6FFF + 浅蓝填充 -->
                <div class="h-52 w-full rounded-lg p-2" style="background-color: var(--lt-bg-page);">
                  <v-chart class="w-full h-full" :option="radarOption" autoresize />
                </div>

                                <!-- 标签云：分区豁免规则，标题用中性色 -->
                <div class="space-y-2.5">
                  <div>
                    <span class="text-xs block mb-1.5" style="color: var(--lt-text-secondary);">
                      <el-icon size="12" class="mr-0.5"><WarningFilled /></el-icon>
                      薄弱项
                    </span>
                    <div class="flex flex-wrap gap-1.5">
                      <el-tag
                        v-for="tag in weakTags"
                        :key="tag"
                        type="danger"
                        effect="plain"
                        size="small"
                        class="rounded"
                      >
                        {{ tag }}
                      </el-tag>
                    </div>
                  </div>
                  <div>
                    <span class="text-xs block mb-1.5" style="color: var(--lt-text-secondary);">
                      <el-icon size="12" class="mr-0.5"><Medal /></el-icon>
                      掌握项
                    </span>
                    <div class="flex flex-wrap gap-1.5">
                      <el-tag
                        v-for="tag in strongTags"
                        :key="tag"
                        type="success"
                        effect="plain"
                        size="small"
                        class="rounded"
                      >
                        {{ tag }}
                      </el-tag>
                    </div>
                  </div>
                  <div>
                    <span class="text-xs block mb-1.5" style="color: var(--lt-text-secondary);">
                      <el-icon size="12" class="mr-0.5"><Reading /></el-icon>
                      兴趣方向
                    </span>
                    <div class="flex flex-wrap gap-1.5">
                      <el-tag
                        v-for="tag in interestTags"
                        :key="tag"
                        type="primary"
                        effect="plain"
                        size="small"
                        class="rounded"
                      >
                        {{ tag }}
                      </el-tag>
                    </div>
                  </div>
                </div>

                <!-- 偏好与版本 -->
                <div class="rounded-lg p-3 space-y-2 text-sm" style="background-color: var(--lt-bg-page);">
                  <div class="flex justify-between items-center">
                    <span style="color: var(--lt-text-auxiliary);">学习节奏</span>
                    <span class="font-medium" style="color: var(--lt-text-primary);">{{ profilePace }} 分钟/天</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span style="color: var(--lt-text-auxiliary);">内容偏好</span>
                    <span class="font-medium" style="color: var(--lt-text-primary);">{{ profilePreference }}</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span style="color: var(--lt-text-auxiliary);">画像版本</span>
                    <span class="text-xs px-2 py-0.5 rounded" style="color: var(--lt-text-secondary); background-color: var(--lt-bg-card);">{{ profileVersion }} · {{ profileUpdatedAt }}</span>
                  </div>
                </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

            <!-- 3. 底部：最近资源包列表 -->
            <el-card shadow="never" style="border: 1px solid var(--lt-border); border-radius: 12px;">
        <template #header>
          <div class="flex items-center justify-between">
            <span class="font-semibold flex items-center gap-2" style="color: var(--lt-text-primary);">
              <el-icon style="color: var(--lt-brand);"><Document /></el-icon>
              最近生成的资源包
            </span>
            <el-button link type="primary" size="small" @click="goToLibrary" style="color: var(--lt-brand);">
              查看全部 <el-icon><Right /></el-icon>
            </el-button>
          </div>
        </template>

        <div class="-mx-4">
          <el-table :data="recentPacks" style="width: 100%" stripe>
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
                <el-tag
                  :type="getConfidenceConfig(row.avgConfidence).type"
                  size="small"
                  effect="plain"
                >
                  {{ getConfidenceConfig(row.avgConfidence).label }}
                </el-tag>
              </template>
            </el-table-column>
                        <el-table-column label="生成时间" width="150" align="right">
              <template #default="{ row }">
                <span class="text-xs" style="color: var(--lt-text-auxiliary);">{{ row.createdAt }}</span>
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
    </template>
  </div>
</template>

<style scoped>
.dashboard-container {
  background-color: var(--el-bg-color-page);
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

/* 空状态引导卡片 hover */
.empty-guide-card {
  transition: all 0.3s ease;
}
.empty-guide-card:hover {
  border-color: var(--lt-brand-lighter) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}
</style>
