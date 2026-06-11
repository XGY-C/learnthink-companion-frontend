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
  if (profile.activeCourseId) fetchStats()
})

async function fetchStats() {
  if (!profile.activeCourseId) return
  loading.value = true
  error.value = null
  try {
    const res = await apiFetch<LearningStats>(`/user/me/stats?courseId=${encodeURIComponent(profile.activeCourseId)}`)
    stats.value = res.data
  } catch { error.value = '加载统计数据失败' }
  finally { loading.value = false }
}

const metrics = computed(() => {
  if (!stats.value) return []
  return [
    { label: '累计学习', value: stats.value.totalHours, unit: '小时', icon: Timer, color: 'var(--lt-brand)' },
    { label: '资源包', value: stats.value.resourcePackCount, unit: '个', icon: Document, color: 'var(--lt-success)' },
    { label: '完成度', value: stats.value.pathProgressPercent, unit: '%', icon: Medal, color: 'var(--lt-warning)' },
    { label: '薄弱项', value: `${stats.value.prevWeakCount}→${stats.value.weakCount}`, unit: stats.value.weakCount < stats.value.prevWeakCount ? '改善' : '关注', icon: WarningFilled, color: stats.value.weakCount < stats.value.prevWeakCount ? 'var(--lt-success)' : 'var(--lt-danger)' },
  ]
})

const chartColors = (() => {
  const style = getComputedStyle(document.documentElement)
  return {
    axisLabel: style.getPropertyValue('--lt-chart-axis-label').trim() || '#8E8EA0',
    axisLine: style.getPropertyValue('--lt-chart-axis-line').trim() || '#E8ECF0',
    splitBg0: style.getPropertyValue('--lt-chart-split-bg-0').trim() || '#F5F7FA',
    splitBg1: style.getPropertyValue('--lt-chart-split-bg-1').trim() || '#EEF1F5',
    brand: style.getPropertyValue('--lt-brand').trim() || '#2B6FFF',
  }
})()

const radarOption = computed(() => ({
  radar: {
    indicator: (stats.value?.radarData || []).map(d => ({ name: d.name, max: 100 })),
    radius: '50%',
    axisName: { color: chartColors.axisLabel, fontSize: 9 },
    splitArea: { areaStyle: { color: [chartColors.splitBg0, chartColors.splitBg1, '#e2e8f0'] } },
    axisLine: { lineStyle: { color: chartColors.axisLine } },
    splitLine: { lineStyle: { color: chartColors.axisLine } }
  },
  series: [{ name: '当前画像', type: 'radar', data: [{ value: (stats.value?.radarData || []).map(d => d.value), name: '掌握度', itemStyle: { color: chartColors.brand }, areaStyle: { color: chartColors.brand + '1a' } }] }]
}))

const barOption = computed(() => ({
  tooltip: { trigger: 'axis' as const },
  grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
  xAxis: { type: 'category' as const, data: (stats.value?.weeklyActivity || []).map(w => w.week), axisLine: { lineStyle: { color: chartColors.axisLine } }, axisLabel: { color: chartColors.axisLabel, fontSize: 10, rotate: 30 } },
  yAxis: { type: 'value' as const, name: '小时', axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: chartColors.splitBg1 } }, axisLabel: { color: chartColors.axisLabel, fontSize: 10 } },
  series: [{ data: (stats.value?.weeklyActivity || []).map(w => w.hours), type: 'bar' as const, barWidth: 14, itemStyle: { color: chartColors.brand, borderRadius: [4, 4, 0, 0] } }]
}))
</script>

<template>
  <div class="m-report">
    <!-- 标题 -->
    <div class="m-report-header">
      <h1 class="m-report-title">
        <el-icon :size="22" style="color: var(--lt-brand);"><TrendCharts /></el-icon>
        学习报告
      </h1>
      <p class="m-report-subtitle">回顾学习历程，追踪能力成长</p>
    </div>

    <!-- 空状态 -->
    <template v-if="!loading && !hasData && !error">
      <div class="m-report-empty">
        <div class="text-5xl mb-4">🧭</div>
        <h3 class="m-empty-title">暂无学习数据</h3>
        <p class="m-empty-desc">你还没有开始学习之旅。与 AI 导师进行一次对话，系统将自动生成个性化学习报告。</p>
        <button class="m-empty-action" @click="router.push('/chat')">去对话建画像 <el-icon :size="14"><Right /></el-icon></button>
      </div>
    </template>

    <!-- Loading -->
    <div v-else-if="loading" class="m-report-loading"><el-icon class="is-loading" :size="32" style="color: var(--lt-brand);"><Timer /></el-icon></div>

    <!-- Error -->
    <div v-else-if="error" class="m-report-error">
      <p class="text-sm" style="color: var(--lt-text-auxiliary);">{{ error }}</p>
      <button class="m-retry-btn" @click="fetchStats()">重试</button>
    </div>

    <!-- 数据视图 -->
    <template v-else-if="stats">
      <!-- 2×2 指标卡 -->
      <div class="m-metrics">
        <div v-for="(m, i) in metrics" :key="i" class="m-metric-card">
          <p class="m-metric-label">{{ m.label }}</p>
          <p class="m-metric-value">{{ m.value }}<span class="m-metric-unit">{{ m.unit }}</span></p>
        </div>
      </div>

      <!-- 雷达图 + 柱状图（堆叠） -->
      <div v-if="stats.radarData.length > 0" class="m-chart-card">
        <h3 class="m-chart-title">能力雷达</h3>
        <div class="m-chart-box" style="height: 210px;">
          <v-chart class="w-full h-full" :option="radarOption" autoresize />
        </div>
      </div>

      <div v-if="stats.weeklyActivity.length > 0" class="m-chart-card">
        <h3 class="m-chart-title">学习轨迹（周）</h3>
        <div class="m-chart-box" style="height: 180px;">
          <v-chart class="w-full h-full" :option="barOption" autoresize />
        </div>
      </div>

      <!-- 画像版本历史 -->
      <div v-if="stats.profileHistory.length > 0" class="m-chart-card">
        <h3 class="m-chart-title">画像版本历史</h3>
        <div class="m-history-list">
          <div v-for="h in stats.profileHistory" :key="h.version" class="m-history-item">
            <div class="m-history-indicator">
              <div class="m-history-dot" />
              <div class="m-history-line" />
            </div>
            <div class="m-history-content">
              <p class="m-history-version">v{{ h.version }} · {{ h.trigger === 'chat' ? '对话更新' : h.trigger }}</p>
              <p class="m-history-time">{{ h.createdAt }}</p>
              <p v-if="h.summary.length > 0" class="m-history-summary">{{ h.summary.join('；') }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 详细数据 -->
      <div class="m-chart-card">
        <h3 class="m-chart-title">详细数据</h3>
        <div class="m-detail-list">
          <div class="m-detail-row"><span class="m-detail-label">最长连续学习</span><span class="m-detail-value">{{ stats.value?.longestStreak ?? '-' }} 天</span></div>
          <div class="m-detail-row"><span class="m-detail-label">平均每日</span><span class="m-detail-value">{{ stats.value?.avgDailyHours ?? '-' }} 小时</span></div>
          <div class="m-detail-row"><span class="m-detail-label">生成总资源</span><span class="m-detail-value">{{ stats.value?.totalResources ?? '-' }} 份</span></div>
          <div class="m-detail-row"><span class="m-detail-label">完成练习</span><span class="m-detail-value">{{ stats.value?.totalQuizzes ?? '-' }} 题</span></div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.m-report { padding: 16px; background: var(--lt-bg-page); min-height: 100%; }
.m-report-header { margin-bottom: 16px; }
.m-report-title { font-size: 20px; font-weight: 700; color: var(--lt-text-primary); display: flex; align-items: center; gap: 8px; margin: 0; }
.m-report-subtitle { font-size: 12px; color: var(--lt-text-auxiliary); margin: 4px 0 0; }

/* Metrics 2×2 */
.m-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
.m-metric-card { background: var(--lt-bg-card); border: 1px solid var(--lt-border); border-radius: 12px; padding: 14px; }
.m-metric-label { font-size: 11px; color: var(--lt-text-auxiliary); margin: 0 0 4px; }
.m-metric-value { font-size: 20px; font-weight: 700; color: var(--lt-text-primary); margin: 0; line-height: 1.2; }
.m-metric-unit { font-size: 11px; font-weight: 400; color: var(--lt-text-placeholder); margin-left: 2px; }

/* Chart cards */
.m-chart-card { background: var(--lt-bg-card); border: 1px solid var(--lt-border); border-radius: 12px; padding: 14px; margin-bottom: 14px; }
.m-chart-title { font-size: 13px; font-weight: 600; color: var(--lt-text-secondary); margin: 0 0 10px; }
.m-chart-box { background: var(--lt-bg-page); border-radius: 8px; padding: 4px; }

/* Empty */
.m-report-empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 60px 24px; }
.m-empty-title { font-size: 16px; font-weight: 600; color: var(--lt-text-primary); margin: 12px 0 6px; }
.m-empty-desc { font-size: 13px; color: var(--lt-text-auxiliary); max-width: 280px; margin: 0 0 20px; line-height: 1.5; }
.m-empty-action { display: flex; align-items: center; gap: 4px; padding: 10px 24px; border: none; border-radius: 10px; background: var(--lt-brand); color: #fff; font-size: 14px; cursor: pointer; }
.m-report-loading { display: flex; justify-content: center; padding: 80px 0; }
.m-report-error { text-align: center; padding: 60px 0; }
.m-retry-btn { padding: 8px 20px; border: 1px solid var(--lt-border); border-radius: 8px; background: var(--lt-bg-card); color: var(--lt-text-secondary); font-size: 13px; cursor: pointer; margin-top: 12px; }

/* Version history (vertical timeline) */
.m-history-list { display: flex; flex-direction: column; }
.m-history-item { display: flex; gap: 12px; position: relative; }
.m-history-indicator { display: flex; flex-direction: column; align-items: center; width: 12px; flex-shrink: 0; padding-top: 4px; }
.m-history-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--lt-brand); flex-shrink: 0; }
.m-history-line { width: 1px; flex: 1; background: var(--lt-border); margin-top: 4px; }
.m-history-item:last-child .m-history-line { display: none; }
.m-history-content { flex: 1; padding-bottom: 16px; }
.m-history-version { font-size: 13px; font-weight: 500; color: var(--lt-text-primary); margin: 0; }
.m-history-time { font-size: 10px; color: var(--lt-text-placeholder); margin: 2px 0; }
.m-history-summary { font-size: 12px; color: var(--lt-text-auxiliary); margin: 4px 0 0; line-height: 1.4; }

/* Detail list */
.m-detail-list { display: flex; flex-direction: column; gap: 10px; }
.m-detail-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--lt-border); }
.m-detail-row:last-child { border-bottom: none; }
.m-detail-label { font-size: 13px; color: var(--lt-text-auxiliary); }
.m-detail-value { font-size: 14px; font-weight: 600; color: var(--lt-text-primary); }
</style>
