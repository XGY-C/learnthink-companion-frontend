<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProfileStore } from '@/stores/profile'
import { apiFetch } from '@/utils/api'
import type { LearningStats } from '@/types'
import * as echarts from 'echarts/core'
import { RadarChart, BarChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { Timer, Document, Medal, WarningFilled, Right, TrendCharts } from '@element-plus/icons-vue'

const router = useRouter()
const profile = useProfileStore()

echarts.use([RadarChart, BarChart, CanvasRenderer])

const stats = ref<LearningStats | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const hasData = computed(() => stats.value !== null && stats.value.totalHours > 0)

onMounted(() => {
  if (profile.activeCourseId) {
    fetchStats()
  }
})

async function fetchStats() {
  if (!profile.activeCourseId) return
  loading.value = true
  error.value = null
  try {
    const res = await apiFetch<LearningStats>(
      `/user/me/stats?courseId=${encodeURIComponent(profile.activeCourseId)}`
    )
    stats.value = res.data
  } catch {
    error.value = '加载统计数据失败'
  } finally {
    loading.value = false
  }
}

const metrics = computed(() => {
  if (!stats.value) return []
  return [
    { label: '累计学习', value: stats.value.totalHours, unit: '小时', icon: Timer, color: 'var(--lt-brand)' },
    { label: '生成资源包', value: stats.value.resourcePackCount, unit: '个', icon: Document, color: 'var(--lt-success)' },
    { label: '路径完成度', value: stats.value.pathProgressPercent, unit: '%', icon: Medal, color: 'var(--lt-warning)' },
    { label: '薄弱项', value: `${stats.value.prevWeakCount}→${stats.value.weakCount}`, unit: stats.value.weakCount < stats.value.prevWeakCount ? '已改善' : '关注中', icon: WarningFilled, color: stats.value.weakCount < stats.value.prevWeakCount ? 'var(--lt-success)' : 'var(--lt-danger)' },
  ]
})

const chartColors = getChartColors()

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
  }
}

const radarOption = computed(() => ({
  radar: {
    indicator: (stats.value?.radarData || []).map(d => ({ name: d.name, max: 100 })),
    radius: '60%',
    axisName: { color: chartColors.axisLabel, fontSize: 11 },
    splitArea: { areaStyle: { color: [chartColors.splitBg0, chartColors.splitBg1, chartColors.splitBg2, chartColors.splitBg3] } },
    axisLine: { lineStyle: { color: chartColors.axisLine } },
    splitLine: { lineStyle: { color: chartColors.axisLine } }
  },
  series: [{
    name: '当前画像',
    type: 'radar',
    data: [{ value: (stats.value?.radarData || []).map(d => d.value), name: '掌握度', itemStyle: { color: chartColors.brand }, areaStyle: { color: chartColors.brand + '1a' } }]
  }]
}))

const barOption = computed(() => ({
  tooltip: { trigger: 'axis' as const },
  grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
  xAxis: {
    type: 'category' as const,
    data: (stats.value?.weeklyActivity || []).map(w => w.week),
    axisLine: { lineStyle: { color: chartColors.axisLine } },
    axisLabel: { color: chartColors.axisLabel, fontSize: 11 }
  },
  yAxis: {
    type: 'value' as const,
    name: '小时',
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: chartColors.splitBg1 } },
    axisLabel: { color: chartColors.axisLabel, fontSize: 11 }
  },
  series: [{
    data: (stats.value?.weeklyActivity || []).map(w => w.hours),
    type: 'bar' as const,
    barWidth: 16,
    itemStyle: {
      color: chartColors.brand,
      borderRadius: [4, 4, 0, 0]
    }
  }]
}))
</script>

<template>
  <div class="report-container h-full overflow-y-auto">
    <div class="max-w-5xl mx-auto p-6">
      <!-- 页面标题 -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold flex items-center gap-2" style="color: var(--lt-text-primary);">
          <el-icon :size="24" style="color: var(--lt-brand);"><TrendCharts /></el-icon>
          学习报告
        </h1>
        <p class="text-sm mt-1" style="color: var(--lt-text-auxiliary);">回顾学习历程，追踪能力成长与薄弱项变化</p>
      </div>

      <!-- 空状态 -->
      <template v-if="!loading && !hasData && !error">
        <div class="text-center py-16">
          <div class="text-5xl mb-4">🧭</div>
          <h3 class="text-lg font-semibold mb-2" style="color: var(--lt-text-primary);">暂无学习数据</h3>
          <p class="text-sm mb-6 max-w-sm mx-auto" style="color: var(--lt-text-auxiliary);">
            你还没有开始学习之旅。与 AI 导师进行一次对话，系统将自动分析你的知识基础并生成个性化学习报告。
          </p>
          <el-button type="primary" @click="router.push('/chat')">
            去对话建画像
            <el-icon class="ml-1"><Right /></el-icon>
          </el-button>
          <div class="flex items-center justify-center gap-6 mt-6 text-sm" style="color: var(--lt-text-auxiliary);">
            <span class="cursor-pointer hover:text-[var(--lt-brand)]" @click="router.push('/')">📊 返回学习总览</span>
            <span class="cursor-pointer hover:text-[var(--lt-brand)]" @click="router.push('/practice')">📝 自测练习</span>
          </div>
        </div>
      </template>

      <!-- 加载中 -->
      <div v-else-if="loading" class="flex items-center justify-center h-64">
        <el-icon class="is-loading" :size="32" style="color: var(--lt-brand);"><Timer /></el-icon>
      </div>

      <!-- 加载失败 -->
      <div v-else-if="error" class="flex flex-col items-center justify-center h-64 gap-3">
        <p class="text-sm" style="color: var(--lt-text-auxiliary);">{{ error }}</p>
        <el-button size="small" @click="fetchStats()">重试</el-button>
      </div>

      <!-- 数据视图 -->
      <template v-else-if="stats">
        <!-- 统计卡片 -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div
            v-for="(m, i) in metrics"
            :key="i"
            class="rounded-xl p-4 border"
            style="border-color: var(--lt-border); background-color: var(--lt-bg-card);"
          >
            <p class="text-xs mb-1" style="color: var(--lt-text-auxiliary);">{{ m.label }}</p>
            <p class="text-2xl font-bold" style="color: var(--lt-text-primary);">
              {{ m.value }}<span class="text-sm font-normal ml-1" style="color: var(--lt-text-placeholder);">{{ m.unit }}</span>
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <!-- 雷达图 -->
          <div v-if="stats.radarData.length > 0" class="rounded-xl border p-4" style="border-color: var(--lt-border); background-color: var(--lt-bg-card);">
            <p class="text-sm font-medium mb-3" style="color: var(--lt-text-secondary);">能力雷达</p>
            <div class="h-60">
              <v-chart class="w-full h-full" :option="radarOption" autoresize />
            </div>
          </div>

          <!-- 学习轨迹柱状图 -->
          <div v-if="stats.weeklyActivity.length > 0" class="rounded-xl border p-4" style="border-color: var(--lt-border); background-color: var(--lt-bg-card);">
            <p class="text-sm font-medium mb-3" style="color: var(--lt-text-secondary);">学习轨迹（周）</p>
            <div class="h-60">
              <v-chart class="w-full h-full" :option="barOption" autoresize />
            </div>
          </div>
        </div>

        <!-- 画像版本历史 -->
        <div v-if="stats.profileHistory.length > 0" class="rounded-xl border p-4" style="border-color: var(--lt-border); background-color: var(--lt-bg-card);">
          <p class="text-sm font-medium mb-3" style="color: var(--lt-text-secondary);">画像版本历史</p>
          <el-timeline>
            <el-timeline-item
              v-for="h in stats.profileHistory"
              :key="h.version"
              :timestamp="h.createdAt"
              placement="top"
              color="var(--lt-brand)"
            >
              <p class="text-sm" style="color: var(--lt-text-primary);">
                v{{ h.version }} · {{ h.trigger === 'chat' ? '对话更新' : h.trigger }}
              </p>
              <p v-if="h.summary.length > 0" class="text-xs mt-1" style="color: var(--lt-text-auxiliary);">
                {{ h.summary.join('；') }}
              </p>
            </el-timeline-item>
          </el-timeline>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.report-container {
  background-color: var(--lt-bg-page);
}
</style>
