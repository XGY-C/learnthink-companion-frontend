<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
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
  EditPen,
  DataBoard,
  User,
  MagicStick
} from '@element-plus/icons-vue'

const router = useRouter()

echarts.use([RadarChart, CanvasRenderer])

// ===== 响应式数据 =====

/** 是否有画像（控制空状态） */
const hasProfile = ref(true) // 默认 true 展示完整驾驶舱；false 展示空状态引导

/** 顶部 4 指标卡 */
const metrics = computed(() => [
  {
    label: '今日建议学习时长',
    value: profilePace.value,
    unit: '分钟/天',
    icon: Timer,
    color: '--el-color-primary',
    bg: 'bg-primary/10'
  },
  {
    label: '薄弱知识点',
    value: weakTags.value.length,
    unit: '个需加强',
    icon: WarningFilled,
    color: '--el-color-danger',
    bg: 'bg-danger/10'
  },
  {
    label: '最近生成资源包',
    value: recentPacks.value.length,
    unit: '个',
    icon: Document,
    color: '--el-color-success',
    bg: 'bg-success/10'
  },
  {
    label: '当前路径完成度',
    value: pathProgress.value,
    unit: '%',
    icon: Medal,
    color: '--el-color-warning',
    bg: 'bg-warning/10'
  }
])

// ===== 画像模拟数据 =====
const profilePace = ref(15)
const profilePreference = ref('代码实操优先')

const weakTags = ref<string[]>(['工程规范', '架构设计', '测试素养'])
const strongTags = ref<string[]>(['产品思维', '算法基础'])
const interestTags = ref<string[]>(['前端工程化', 'Vue 生态', '性能优化'])

/** 雷达图 6 维数据 */
const radarValues = ref([70, 45, 60, 85, 30, 50])
const radarIndicators = [
  { name: '代码能力', max: 100 },
  { name: '架构设计', max: 100 },
  { name: '算法基础', max: 100 },
  { name: '产品思维', max: 100 },
  { name: '工程规范', max: 100 },
  { name: '测试素养', max: 100 }
]

const radarOption = computed(() => ({
  radar: {
    indicator: radarIndicators,
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
          value: radarValues.value,
          name: '掌握度',
          itemStyle: { color: '#3b82f6' },
          areaStyle: { color: 'rgba(59, 130, 246, 0.2)' }
        }
      ]
    }
  ]
}))

const profileVersion = ref('v1.2')
const profileUpdatedAt = ref('2026-05-05 14:30')

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
const pathProgress = ref(32)

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

/** 置信度样式映射 */
const confidenceConfig = {
  high: { type: 'success' as const, label: '高' },
  medium: { type: 'warning' as const, label: '中' },
  low: { type: 'danger' as const, label: '低' }
}

// ===== 空状态：引导创建画像 =====
const emptyGuideSteps = [
  { icon: '💬', title: '对话建画像', desc: '与智能导师对话，2分钟建立6维学习画像', action: '去对话', route: '/profile' },
  { icon: '🔧', title: '生成资源包', desc: '基于画像自动生成≥5类个性化资源', action: '去工作室', route: '/studio' },
  { icon: '📈', title: '学习路径', desc: '获取动态调整的学习规划与练习反馈', action: '去路径', route: '/path' }
]

// ===== 交互方法 =====
const goToProfile = () => router.push('/profile')
const goToStudio = (topic?: string) => {
  if (topic) {
    router.push({ name: 'studio', query: { topic } })
  } else {
    router.push('/studio')
  }
}
const goToPath = () => router.push('/path')
const goToLibrary = () => router.push('/library')
const goToPractice = () => router.push('/practice')

const openPack = (pack: RecentPack) => {
  router.push({ name: 'library', query: { packId: pack.id } })
}

const refreshMetrics = () => {
  ElMessage.success('已刷新仪表盘数据')
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
        <h1 class="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <el-icon size="24"><DataBoard /></el-icon>
          学习驾驶舱
        </h1>
        <p class="text-sm text-gray-500 mt-1">基于多智能体画像驱动的个性化学习概览</p>
      </div>
      <el-button size="small" plain :icon="RefreshRight" @click="refreshMetrics">
        刷新数据
      </el-button>
    </div>

    <!-- ============ 空状态（无画像时展示） ============ -->
    <template v-if="!hasProfile">
      <el-card class="text-center py-16" shadow="hover">
        <el-icon class="text-5xl text-primary mb-4"><User /></el-icon>
        <h2 class="text-xl font-bold text-gray-800 mb-2">开始你的个性化学习之旅</h2>
        <p class="text-gray-500 mb-8 max-w-lg mx-auto">
          系统尚未建立你的学习画像。与智能导师进行 2 分钟对话，即可解锁个性化资源推荐、学习路径规划与精准练习。
        </p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mb-8">
          <div
            v-for="(step, idx) in emptyGuideSteps"
            :key="idx"
            class="bg-slate-50 rounded-xl p-6 border border-slate-200 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer"
            @click="router.push(step.route)"
          >
            <div class="text-3xl mb-3">{{ step.icon }}</div>
            <h3 class="font-semibold text-gray-800 mb-1">{{ step.title }}</h3>
            <p class="text-xs text-gray-500 mb-4">{{ step.desc }}</p>
            <el-button size="small" type="primary" plain>{{ step.action }}</el-button>
          </div>
        </div>
        <el-button type="primary" size="large" class="px-8" @click="goToProfile">
          开始对话建画像
          <el-icon class="ml-1"><Right /></el-icon>
        </el-button>
      </el-card>
    </template>

    <!-- ============ 完整驾驶舱（有画像） ============ -->
    <template v-else>
      <!-- 1. 顶部概览条：4 个指标卡 -->
      <el-row :gutter="20">
        <el-col v-for="(metric, idx) in metrics" :key="idx" :xs="12" :sm="6" class="mb-4">
          <el-card shadow="hover" class="metric-card" :body-style="{ padding: '20px' }">
            <div class="flex items-center gap-4">
              <div
                class="w-12 h-12 rounded-xl flex items-center justify-center text-lg shrink-0"
                :class="metric.bg"
                :style="{ color: `var(${metric.color})` }"
              >
                <el-icon :size="22">
                  <component :is="metric.icon" />
                </el-icon>
              </div>
              <div class="min-w-0">
                <p class="text-xs text-gray-500 truncate">{{ metric.label }}</p>
                <p class="text-2xl font-bold text-gray-900 mt-0.5 flex items-baseline gap-1">
                  {{ metric.value }}
                  <span class="text-sm font-normal text-gray-400">{{ metric.unit }}</span>
                </p>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 2. 中部两列：下一步推荐 + 画像快照 -->
      <el-row :gutter="20">
        <!-- 左：下一步推荐 -->
        <el-col :xs="24" :lg="14" class="mb-4">
          <el-card shadow="never" class="h-full">
            <template #header>
              <div class="flex items-center justify-between">
                <span class="font-semibold text-gray-800 flex items-center gap-2">
                  <el-icon><Aim /></el-icon>
                  下一步学习推荐
                </span>
                <el-button link type="primary" size="small" @click="goToPath">
                  查看完整路径 <el-icon><Right /></el-icon>
                </el-button>
              </div>
            </template>

            <div class="p-2">
              <!-- 推荐知识点头部 -->
              <div class="flex items-start justify-between mb-3">
                <div>
                  <h3 class="text-lg font-bold text-gray-900">{{ nextRecommendation.title }}</h3>
                  <p class="text-sm text-gray-500 mt-0.5">
                    知识点：{{ nextRecommendation.knowledgePoint }}
                  </p>
                </div>
                <el-tag :type="confidenceConfig[nextRecommendation.confidence].type" size="small" effect="plain">
                  {{ confidenceConfig[nextRecommendation.confidence].label }}置信度
                </el-tag>
              </div>

              <!-- 证据行 -->
              <div class="flex items-center gap-4 text-xs text-gray-500 mb-4 bg-slate-50 px-3 py-2 rounded-lg">
                <span class="flex items-center gap-1">
                  <el-icon><Document /></el-icon>
                  来源 {{ nextRecommendation.sourcesCount }}
                </span>
                <span class="flex items-center gap-1">
                  <el-icon><TrendCharts /></el-icon>
                  质量 {{ nextRecommendation.qualityScore }}/100
                </span>
                <span class="flex items-center gap-1">
                  <el-icon><Timer /></el-icon>
                  预计 {{ nextRecommendation.estimatedMinutes }} 分钟
                </span>
              </div>

              <!-- 为什么推荐（核心可解释性） -->
              <div class="mb-4">
                <p class="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
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
              <div class="mt-6 pt-4 border-t border-slate-100">
                <div class="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>当前路径整体进度</span>
                  <span class="font-semibold text-gray-700">{{ pathProgress }}%</span>
                </div>
                <el-progress :percentage="pathProgress" :stroke-width="6" />
              </div>
            </div>
          </el-card>
        </el-col>

        <!-- 右：画像快照 -->
        <el-col :xs="24" :lg="10" class="mb-4">
          <el-card shadow="never" class="h-full">
            <template #header>
              <div class="flex items-center justify-between">
                <span class="font-semibold text-gray-800 flex items-center gap-2">
                  <el-icon><User /></el-icon>
                  画像快照
                </span>
                <el-button link type="primary" size="small" @click="goToProfile">
                  详细画像 <el-icon><Right /></el-icon>
                </el-button>
              </div>
            </template>

            <div class="space-y-4">
              <!-- 迷你雷达图 -->
              <div class="h-52 w-full bg-slate-50 rounded-lg p-2">
                <v-chart class="w-full h-full" :option="radarOption" autoresize />
              </div>

              <!-- 标签云 -->
              <div class="space-y-2.5">
                <div>
                  <span class="text-xs text-gray-500 block mb-1.5">
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
                  <span class="text-xs text-gray-500 block mb-1.5">
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
                  <span class="text-xs text-gray-500 block mb-1.5">
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
              <div class="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
                <div class="flex justify-between items-center">
                  <span class="text-gray-500">学习节奏</span>
                  <span class="font-medium text-gray-800">{{ profilePace }} 分钟/天</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-gray-500">内容偏好</span>
                  <span class="font-medium text-gray-800">{{ profilePreference }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-gray-500">画像版本</span>
                  <span class="text-xs text-gray-600 bg-white px-2 py-0.5 rounded">{{ profileVersion }} · {{ profileUpdatedAt }}</span>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 3. 底部：最近资源包列表 -->
      <el-card shadow="never">
        <template #header>
          <div class="flex items-center justify-between">
            <span class="font-semibold text-gray-800 flex items-center gap-2">
              <el-icon><Document /></el-icon>
              最近生成的资源包
            </span>
            <el-button link type="primary" size="small" @click="goToLibrary">
              查看全部 <el-icon><Right /></el-icon>
            </el-button>
          </div>
        </template>

        <div class="-mx-4">
          <el-table :data="recentPacks" style="width: 100%" stripe>
            <el-table-column label="资源包名称" min-width="180">
              <template #default="{ row }">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-gray-800 cursor-pointer hover:text-primary transition-colors" @click="openPack(row)">
                    {{ row.title }}
                  </span>
                  <el-tag v-if="row.isActive" size="small" type="success" effect="dark">当前</el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="knowledgePoint" label="知识点" width="130" />
            <el-table-column label="资源数" width="80" align="center">
              <template #default="{ row }">
                <span class="text-sm">{{ row.resourceCount }} 类</span>
              </template>
            </el-table-column>
            <el-table-column label="质量" width="100" align="center">
              <template #default="{ row }">
                <el-tag
                  :type="row.avgQuality >= 85 ? 'success' : row.avgQuality >= 70 ? 'warning' : 'danger'"
                  size="small"
                  effect="plain"
                >
                  {{ row.avgQuality }}/100
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="置信度" width="90" align="center">
              <template #default="{ row }">
                <el-tag
                  :type="confidenceConfig[row.avgConfidence].type"
                  size="small"
                  effect="plain"
                >
                  {{ confidenceConfig[row.avgConfidence].label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="生成时间" width="150" align="right">
              <template #default="{ row }">
                <span class="text-xs text-gray-500">{{ row.createdAt }}</span>
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
  transition: transform 0.2s, box-shadow 0.2s;
}
.metric-card:hover {
  transform: translateY(-2px);
}

:deep(.el-table th) {
  font-weight: 600;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

:deep(.el-card__header) {
  padding: 14px 20px;
  border-bottom: 1px solid var(--el-border-color-light);
}
</style>
