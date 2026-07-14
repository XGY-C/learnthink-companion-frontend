<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProfileStore } from '@/stores/profile'
import { useLearningReport, useAllCoursesReport } from '@/composables/useLearningReport'
import * as echarts from 'echarts'
import { Timer, Right, Aim, TrendCharts } from '@element-plus/icons-vue'
import LearningCalendar from '@/components/report/LearningCalendar.vue'

const router = useRouter()
const profile = useProfileStore()

const scope = ref<'single' | 'all'>('single')

const {
  stats, loading, error, hasData,
  metrics, weakAnalysis, radarOption, trendOption,
  versionHistory, behaviorDetails,
  insightCards, weekOverWeekChange,
  refresh,
} = useLearningReport(profile.activeCourseId)

const {
  allCourseData, courseCards, selectedCourseIndex,
  totalHoursAcross, courseCount,
  allRadarOption, courseComparisonOption, timeDistributionOption,
  mergedTrendOption,
  allWeakAnalysis, overallAvgScore, bestCourse, mostInvestedCourse,
  selectCourse,
} = useAllCoursesReport()

const totalWeeks = computed(() => (stats.value?.weeklyActivity?.length ?? 0))
const activeWeeks = computed(() => (stats.value?.weeklyActivity ?? []).filter((w: any) => w.hours > 0).length)

// ===== 维度数据 =====
const dimData = computed(() => {
  const s = radarOption.value
  if (!s?.radar?.indicator?.length) return []
  return s.radar.indicator.map((ind: any, i: number) => ({
    name: ind.name,
    value: (s.series?.[0]?.data?.[0]?.value?.[i]) ?? 0,
    max: ind.max,
  }))
})

const overallScore = computed(() => {
  const d = dimData.value
  if (!d.length) return 0
  return Math.round(d.reduce((s, item) => s + item.value, 0) / d.length)
})

function gradeLabel(score: number): string {
  if (score >= 90) return 'A'
  if (score >= 80) return 'A-'
  if (score >= 70) return 'B+'
  if (score >= 60) return 'B'
  if (score >= 50) return 'C+'
  if (score >= 40) return 'C'
  return 'D'
}

const balance = computed(() => {
  const d = dimData.value
  if (!d.length) return null
  const scores = d.map(x => x.value)
  const max = Math.max(...scores); const min = Math.min(...scores)
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  return { max, min, gap: max - min, best: d.find(x => x.value === max)?.name || '', worst: d.find(x => x.value === min)?.name || '', flatness: scores.every(s => s >= avg - 15 && s <= avg + 15) ? '均衡' : '不均衡' }
})

function dimDesc(name: string, score: number): string {
  if (score >= 80) { const m: Record<string, string> = { '知识基础': '积累扎实', '学习目标': '目标清晰', '认知风格': '策略成熟', '学习节奏': '节奏稳定', '专业理解': '认知深入', '兴趣广度': '兴趣广泛' }; return m[name] || '优秀' }
  if (score >= 60) { const m: Record<string, string> = { '知识基础': '有基础，可提升', '学习目标': '方向明确', '认知风格': '可更多元', '学习节奏': '基本稳定', '专业理解': '成长中', '兴趣广度': '有待拓展' }; return m[name] || '成长中' }
  const m: Record<string, string> = { '知识基础': '需系统补强', '学习目标': '目标模糊', '认知风格': '未形成稳定策略', '学习节奏': '需建立规律', '专业理解': '有待深化', '兴趣广度': '范围较窄' }
  return m[name] || '需关注'
}

// ===== 稳定性 =====
const stability = computed(() => {
  const hours = (stats.value?.weeklyActivity ?? []).map(w => w.hours)
  if (hours.length < 2) return null
  const avg = hours.reduce((a, b) => a + b, 0) / hours.length
  const std = Math.sqrt(hours.reduce((sum, h) => sum + (h - avg) ** 2, 0) / hours.length)
  const cv = avg > 0 ? std / avg : 1
  const label = cv < 0.3 ? '高' : cv < 0.6 ? '中等' : '较低'
  const half = Math.floor(hours.length / 2)
  const fAvg = hours.slice(0, half).reduce((a, b) => a + b, 0) / half
  const sAvg = hours.slice(half).reduce((a, b) => a + b, 0) / (hours.length - half)
  const trend = sAvg - fAvg > 0.3 ? '上升' : sAvg - fAvg < -0.3 ? '下降' : '平稳'
  return { label, desc: cv < 0.3 ? '非常稳定' : cv < 0.6 ? '略有波动' : '波动较大', avg: +avg.toFixed(1), std: +std.toFixed(1), cv: +cv.toFixed(2), trend, firstHalf: +fAvg.toFixed(1), secondHalf: +sAvg.toFixed(1) }
})

// ===== 画像演进统计 =====
const versionStat = computed(() => {
  const vh = versionHistory.value
  if (!vh.length) return null
  const triggers = vh.map(h => h.trigger)
  const tc: Record<string, number> = {}
  triggers.forEach(t => { tc[t] = (tc[t] || 0) + 1 })
  const main = Object.entries(tc).sort((a, b) => b[1] - a[1])[0]
  const tLabel: Record<string, string> = { chat: '对话', quiz: '练习', path_update: '路径调整', manual: '手动' }
  return { total: vh.length, main: tLabel[main?.[0]] || '', mainCount: main?.[1] || 0, first: vh[0].createdAt, last: vh[vh.length - 1].createdAt }
})

// ===== 维度排序柱状图 =====
const dimBarChart = computed(() => {
  const d = dimData.value
  if (!d.length) return {}
  const cc = { brand: '#2B6FFF', success: '#34C759', warning: '#FF9F0A', axis: '#8E8EA0' }
  const sorted = [...d].sort((a, b) => b.value - a.value)
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 85, right: 15, top: 5, bottom: 15 },
    xAxis: { type: 'value', max: 100, axisLabel: { color: cc.axis, fontSize: 9 }, splitLine: { lineStyle: { color: '#F0F0F0' } }, axisTick: { show: false } },
    yAxis: { type: 'category', data: sorted.map(x => x.name), axisLabel: { color: '#5A5A72', fontSize: 10, fontWeight: 600 }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{ type: 'bar', data: sorted.map(x => ({ value: x.value, itemStyle: { color: x.value >= 80 ? cc.success : x.value >= 60 ? cc.brand : cc.warning, borderRadius: [0, 5, 5, 0] } })), barWidth: 14, label: { show: true, position: 'right', fontSize: 11, fontWeight: 700, color: '#1A1A2E' } }],
  }
})

// ===== 累计学时面积图 =====
const cumulativeChart = computed(() => {
  const weeks = (stats.value?.weeklyActivity ?? []).map(w => w.week)
  const hours = (stats.value?.weeklyActivity ?? []).map(w => w.hours)
  if (!weeks.length) return {}
  const cumulative: number[] = []
  let sum = 0
  hours.forEach(h => { sum += h; cumulative.push(+sum.toFixed(1)) })
  const cc = { brand: '#2B6FFF', brandLight: 'rgba(43,111,255,0.15)', axis: '#8E8EA0' }
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 15, top: 10, bottom: 20 },
    xAxis: { type: 'category', data: weeks.map(w => w.replace('第', '').replace('周', '')), axisLabel: { color: cc.axis, fontSize: 9 }, axisLine: { lineStyle: { color: '#E8ECF0' } } },
    yAxis: { type: 'value', axisLabel: { color: cc.axis, fontSize: 9 }, splitLine: { lineStyle: { color: '#F0F0F0' } } },
    series: [{
      type: 'line', data: cumulative, smooth: true, symbol: 'circle', symbolSize: 5,
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: cc.brandLight }, { offset: 1, color: 'rgba(43,111,255,0)' }]) },
      lineStyle: { color: cc.brand, width: 2 },
      itemStyle: { color: cc.brand },
    }],
  }
})

// ===== 周环比变化 =====
const wowChart = computed(() => {
  const hours = (stats.value?.weeklyActivity ?? []).map(w => w.hours)
  const weeks = (stats.value?.weeklyActivity ?? []).map(w => w.week.replace('第', '').replace('周', ''))
  if (hours.length < 2) return {}
  const changes = hours.slice(1).map((h, i) => {
    const prev = hours[i]
    return prev > 0 ? +(((h - prev) / prev) * 100).toFixed(0) : 0
  })
  const cc = { brand: '#2B6FFF', success: '#34C759', danger: '#FF3B30', axis: '#8E8EA0' }
  return {
    tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}周环比：${p[0].value}%` },
    grid: { left: 40, right: 15, top: 10, bottom: 20 },
    xAxis: { type: 'category', data: weeks.slice(1), axisLabel: { color: cc.axis, fontSize: 9 }, axisLine: { lineStyle: { color: '#E8ECF0' } } },
    yAxis: { type: 'value', axisLabel: { color: cc.axis, fontSize: 9, formatter: (v: number) => v + '%' }, splitLine: { lineStyle: { color: '#F0F0F0' } }, axisTick: { show: false } },
    series: [{
      type: 'bar', data: changes.map(v => ({ value: v, itemStyle: { color: v >= 0 ? cc.success : cc.danger, borderRadius: [2, 2, 0, 0] } })),
      barWidth: 12,
      label: { show: true, position: 'top', fontSize: 9, formatter: (p: any) => (p.value > 0 ? '+' : '') + p.value + '%', color: '#8E8EA0' },
    }],
  }
})

// ===== 各阶段活跃对比 =====
const halfCompare = computed(() => {
  const hours = (stats.value?.weeklyActivity ?? []).map(w => w.hours)
  if (hours.length < 3) return null
  const half = Math.floor(hours.length / 2)
  const first = hours.slice(0, half)
  const second = hours.slice(half)
  const fActive = first.filter(h => h > 0).length
  const sActive = second.filter(h => h > 0).length
  return { firstActive: fActive, firstTotal: first.length, secondActive: sActive, secondTotal: second.length }
})
</script>

<template>
  <div class="report-container h-full overflow-y-auto">
    <div class="px-6 py-5" style="max-width: 1440px; margin: 0 auto;">
      <!-- ===== 空/加载/错误 ===== -->
      <template v-if="!loading && !hasData && !error">
        <div class="text-center py-20">
          <div class="text-5xl mb-4">🧭</div>
          <h3 class="text-lg font-semibold mb-2" style="color: var(--lt-text-primary);">暂无学习数据</h3>
          <p class="text-sm mb-6 max-w-sm mx-auto" style="color: var(--lt-text-auxiliary);">你还没有开始学习之旅。与 AI 导师进行一次对话，系统将自动分析你的知识基础并生成个性化学习报告。</p>
          <el-button type="primary" @click="router.push('/chat')">去对话建画像 <el-icon class="ml-1"><Right /></el-icon></el-button>
          <div class="flex items-center justify-center gap-6 mt-6 text-sm" style="color: var(--lt-text-auxiliary);">
            <span class="cursor-pointer hover:text-[var(--lt-brand)]" @click="router.push('/')">📊 返回学习总览</span>
            <span class="cursor-pointer hover:text-[var(--lt-brand)]" @click="router.push('/practice')">📝 自测练习</span>
          </div>
        </div>
      </template>
      <div v-else-if="loading" class="flex items-center justify-center h-64">
        <el-icon class="is-loading" :size="32" style="color: var(--lt-brand);"><Timer /></el-icon>
      </div>
      <div v-else-if="error" class="flex flex-col items-center justify-center h-64 gap-3">
        <p class="text-sm" style="color: var(--lt-text-auxiliary);">{{ error }}</p>
        <el-button small @click="refresh()">重试</el-button>
      </div>

      <!-- ===== 有数据：HEADER + 内容 ===== -->
      <template v-else>
        <!-- ===== HEADER ===== -->
        <div class="flex items-center justify-between mb-5">
          <div class="flex items-center gap-3">
            <span class="text-2xl">📋</span>
            <div>
              <div class="flex items-center gap-3">
                <h1 class="text-xl font-bold" style="color: var(--lt-text-primary);">个人学习分析报告</h1>
                <el-radio-group v-model="scope" size="small">
                  <el-radio-button value="single">📖 当前课程</el-radio-button>
                  <el-radio-button value="all">📚 全部课程</el-radio-button>
                </el-radio-group>
              </div>
              <p class="text-xs mt-1" style="color: var(--lt-text-auxiliary);">
                <template v-if="scope === 'single'">
                  {{ profile.displayProfile?.core?.major || profile.activeCourse?.name || '学员' }}
                  · {{ totalWeeks }} 周数据 · 累计 {{ behaviorDetails.totalHours }}h · {{ activeWeeks }}/{{ totalWeeks }} 周活跃 · {{ new Date().toLocaleDateString('zh-CN') }}
                </template>
                <template v-else>
                  全部 {{ courseCount }} 门课程 · 累计 {{ totalHoursAcross }}h · {{ new Date().toLocaleDateString('zh-CN') }}
                </template>
              </p>
            </div>
          </div>
        </div>

        <!-- ===== 当前课程内容 ===== -->
        <template v-if="scope === 'single'">

        <!-- ===== ROW 1: 综合评分 + 雷达 + 维度排序 ===== -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <!-- 综合评分 -->
          <div class="r-card flex items-center gap-4">
            <svg viewBox="0 0 120 120" width="110" height="110" class="shrink-0">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--lt-bg-page)" stroke-width="10"/>
              <circle cx="60" cy="60" r="52" fill="none" stroke="url(#g)" stroke-width="10" stroke-linecap="round"
                :stroke-dasharray="2 * Math.PI * 52"
                :stroke-dashoffset="2 * Math.PI * 52 * (1 - overallScore / 100)"
                transform="rotate(-90, 60, 60)" style="transition: stroke-dashoffset 1.2s ease;"/>
              <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="var(--lt-brand)"/><stop offset="100%" stop-color="var(--lt-ai)"/></linearGradient></defs>
              <text x="60" y="48" text-anchor="middle" font-size="28" font-weight="800" fill="var(--lt-text-primary)">{{ overallScore }}</text>
              <text x="60" y="66" text-anchor="middle" font-size="11" fill="var(--lt-text-placeholder)">/ 100</text>
            </svg>
            <div>
              <div class="flex items-baseline gap-2 mb-1">
                <span class="text-3xl font-extrabold" :style="{ color: overallScore >= 70 ? 'var(--lt-success)' : 'var(--lt-warning)' }">{{ gradeLabel(overallScore) }}</span>
                <span class="text-xs" style="color: var(--lt-text-auxiliary);">综合评级</span>
              </div>
              <p class="text-xs leading-relaxed" style="color: var(--lt-text-secondary);" v-if="balance">
                最强：<strong>{{ balance.best }}</strong> {{ balance.max }}分 ·
                最弱：<strong>{{ balance.worst }}</strong> {{ balance.min }}分<br>
                差距 {{ balance.gap }} 分 · {{ balance.flatness }}
              </p>
            </div>
          </div>

          <!-- 雷达图 -->
          <div class="r-card" v-if="radarOption.radar?.indicator?.length">
            <p class="text-xs font-semibold mb-1" style="color: var(--lt-text-primary);">🎯 六维能力雷达</p>
            <div class="h-44">
              <v-chart class="w-full h-full" :option="radarOption" autoresize />
            </div>
          </div>

          <!-- 维度排序柱状图 -->
          <div class="r-card" v-if="dimBarChart.series?.length">
            <p class="text-xs font-semibold mb-1" style="color: var(--lt-text-primary);">📊 维度评分排序</p>
            <div class="h-44">
              <v-chart class="w-full h-full" :option="dimBarChart" autoresize />
            </div>
          </div>
        </div>

        <!-- ===== ROW 1.5: 各维度详解 ===== -->
        <div class="r-card mb-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div v-for="d in dimData" :key="d.name" class="text-center p-2 rounded-lg" style="background: var(--lt-bg-page);">
              <p class="text-xs font-semibold" style="color: var(--lt-text-secondary);">{{ d.name }}</p>
              <p class="text-xl font-bold" :style="{ color: d.value >= 80 ? 'var(--lt-success)' : d.value >= 60 ? 'var(--lt-brand)' : 'var(--lt-warning)' }">{{ d.value }}</p>
              <p class="text-[10px]" style="color: var(--lt-text-auxiliary);">{{ dimDesc(d.name, d.value) }}</p>
            </div>
          </div>
        </div>

        <!-- ===== ROW 2: 投入趋势 + 累计曲线 + 周环比 ===== -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <!-- 投入趋势 -->
          <div class="r-card lg:col-span-1" v-if="trendOption.xAxis?.data?.length">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-semibold" style="color: var(--lt-text-primary);">📈 每周投入趋势</span>
              <span class="text-[10px]" style="color: var(--lt-text-auxiliary);">柱状=时长 折线=3周均值</span>
            </div>
            <div class="h-44">
              <v-chart class="w-full h-full" :option="trendOption" autoresize />
            </div>
            <div class="flex items-center gap-3 mt-2 flex-wrap">
              <span class="text-[10px] px-2 py-0.5 rounded" :style="{ background: stability ? (stability.label === '高' ? 'rgba(52,199,89,0.12)' : stability.label === '中等' ? 'rgba(255,159,10,0.12)' : 'rgba(255,59,48,0.12)') : '', color: stability ? (stability.label === '高' ? 'var(--lt-success)' : stability.label === '中等' ? 'var(--lt-warning)' : 'var(--lt-danger)') : '' }" v-if="stability">稳定性：{{ stability.label }}</span>
              <span class="text-[10px]" style="color: var(--lt-text-auxiliary);" v-if="stability">CV={{ stability.cv }} · {{ stability.desc }}</span>
            </div>
          </div>

          <!-- 累计学时曲线 -->
          <div class="r-card" v-if="cumulativeChart.series?.length">
            <p class="text-xs font-semibold mb-1" style="color: var(--lt-text-primary);">📈 累计学时增长曲线</p>
            <div class="h-44">
              <v-chart class="w-full h-full" :option="cumulativeChart" autoresize />
            </div>
            <p class="text-[10px] mt-1" style="color: var(--lt-text-auxiliary);">
              从第1周到第{{ totalWeeks }}周，累计学习 {{ behaviorDetails.totalHours }}h
              <template v-if="stability">，后{{ Math.ceil(totalWeeks/2) }}周周均 {{ stability.secondHalf }}h（前{{ Math.floor(totalWeeks/2) }}周 {{ stability.firstHalf }}h）</template>
            </p>
          </div>

          <!-- 周环比变化 -->
          <div class="r-card" v-if="wowChart.series?.length">
            <p class="text-xs font-semibold mb-1" style="color: var(--lt-text-primary);">📊 周环比变化（较前一周）</p>
            <div class="h-44">
              <v-chart class="w-full h-full" :option="wowChart" autoresize />
            </div>
            <p class="text-[10px] mt-1" style="color: var(--lt-text-auxiliary);" v-if="weekOverWeekChange">
              本周 {{ weekOverWeekChange.pct >= 0 ? '+' : '' }}{{ weekOverWeekChange.pct }}% · 绝对值变化 {{ weekOverWeekChange.diff }}h
            </p>
          </div>
        </div>

        <!-- ===== ROW 2.5: 学习日历热力图 ===== -->
        <div class="mb-4">
          <LearningCalendar :course-id="scope === 'single' ? profile.activeCourseId : undefined" />
        </div>

        <!-- ===== ROW 3: 薄弱项改善 + 画像演进 ===== -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <!-- 薄弱项改善 -->
          <div class="r-card">
            <p class="text-xs font-semibold mb-3" style="color: var(--lt-text-primary);">🩺 薄弱项改善</p>
            <div class="flex items-center gap-3 mb-3 p-2.5 rounded-lg" style="background: var(--lt-bg-page);">
              <div class="flex items-center gap-1"><span class="text-[10px]" style="color: var(--lt-text-auxiliary);">上期</span><span class="text-lg font-bold" style="color: var(--lt-text-secondary);">{{ weakAnalysis.previousCount }}</span><span class="text-[10px]" style="color: var(--lt-text-auxiliary);">项</span></div>
              <span class="text-base" style="color: var(--lt-text-placeholder);">→</span>
              <div class="flex items-center gap-1"><span class="text-[10px]" style="color: var(--lt-text-auxiliary);">现有</span><span class="text-lg font-bold" :style="{ color: weakAnalysis.currentCount <= weakAnalysis.previousCount ? 'var(--lt-success)' : 'var(--lt-danger)' }">{{ weakAnalysis.currentCount }}</span><span class="text-[10px]" style="color: var(--lt-text-auxiliary);">项</span></div>
              <div class="flex-1 h-2 rounded-full overflow-hidden" style="background: var(--lt-bg-page); max-width: 140px;"><div class="h-full rounded-full" :style="{ width: weakAnalysis.healRate + '%', background: weakAnalysis.healRate > 50 ? 'linear-gradient(90deg, var(--lt-success), var(--lt-brand))' : 'linear-gradient(90deg, var(--lt-warning), var(--lt-orange))' }" /></div>
              <span class="text-sm font-bold" :style="{ color: weakAnalysis.healRate > 50 ? 'var(--lt-success)' : 'var(--lt-warning)' }">{{ weakAnalysis.healRate }}%</span>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div v-if="weakAnalysis.tags.length">
                <p class="text-[10px] font-semibold mb-1.5" style="color: var(--lt-danger);">⛔ 待加强</p>
                <div class="flex flex-wrap gap-1">
                  <span v-for="tag in weakAnalysis.tags" :key="tag" class="badge danger">{{ tag }}</span>
                </div>
              </div>
              <div v-if="weakAnalysis.mastered.length">
                <p class="text-[10px] font-semibold mb-1.5" style="color: var(--lt-success);">✅ 已掌握</p>
                <div class="flex flex-wrap gap-1">
                  <span v-for="tag in weakAnalysis.mastered" :key="tag" class="badge success">{{ tag }}</span>
                </div>
              </div>
            </div>
            <div v-if="weakAnalysis.errorPatterns.length" class="mt-2 pt-2" style="border-top:1px solid var(--lt-border);">
              <p class="text-[10px] font-semibold mb-1" style="color: var(--lt-orange);">⚠️ 错误模式</p>
              <div class="flex flex-wrap gap-1"><span v-for="p in weakAnalysis.errorPatterns" :key="p" class="badge warning">{{ p }}</span></div>
            </div>
          </div>

          <!-- 画像演进 -->
          <div class="r-card" v-if="versionStat">
            <p class="text-xs font-semibold mb-1" style="color: var(--lt-text-primary);">🔄 画像演进分析</p>
            <div class="flex items-center gap-3 mb-3 flex-wrap text-[10px]" style="color: var(--lt-text-auxiliary);">
              <span>共 <strong style="color:var(--lt-text-primary);">{{ versionStat.total }}</strong> 次更新</span>
              <span>主要触发：<strong style="color:var(--lt-text-primary);">{{ versionStat.main }}</strong>（{{ versionStat.mainCount }} 次）</span>
              <span v-if="halfCompare">前半程活跃 {{ halfCompare.firstActive }}/{{ halfCompare.firstTotal }} 周 · 后半程 {{ halfCompare.secondActive }}/{{ halfCompare.secondTotal }} 周</span>
            </div>
            <div class="version-flow">
              <div v-for="(h, i) in versionHistory" :key="h.version" class="v-node">
                <div class="v-line-wrap"><div class="v-dot" :class="{ latest: i === versionHistory.length - 1 }" /><div v-if="i < versionHistory.length - 1" class="v-line" /></div>
                <div class="v-body">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-bold text-xs" style="color: var(--lt-text-primary);">v{{ h.version }}</span>
                    <span class="v-tag">{{ h.label }}</span>
                    <span class="text-[10px] ml-auto" style="color: var(--lt-text-placeholder);">{{ h.createdAt }}</span>
                  </div>
                  <p class="text-[10px] mt-0.5" style="color: var(--lt-text-auxiliary);">{{ h.summary.join('；') }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ===== ROW 4: 综合诊断 ===== -->
        <div class="r-card diagnosis">
          <p class="text-xs font-semibold mb-3" style="color: var(--lt-text-primary);">📝 综合诊断</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <p class="diag-line"><strong>评级：</strong>{{ gradeLabel(overallScore) }}（{{ overallScore }}）。{{ overallScore >= 80 ? '优秀。' : overallScore >= 60 ? '良好，有提升空间。' : '需加强。' }}</p>
            <p class="diag-line" v-if="balance"><strong>均衡性：</strong>「{{ balance.best }}」{{ balance.max }}分，「{{ balance.worst }}」{{ balance.min }}分，差距{{ balance.gap }}。{{ balance.gap > 30 ? '建议补短板。' : '发展均衡。' }}</p>
            <p class="diag-line" v-if="stability"><strong>稳定性：</strong>{{ stability.label }}（CV={{ stability.cv }}）。{{ stability.trend === '上升' ? '近几周投入增加。' : stability.trend === '下降' ? '近几周投入减少。' : '保持平稳。' }}</p>
            <p class="diag-line" v-if="weakAnalysis.healedCount > 0"><strong>改善：</strong>治愈 {{ weakAnalysis.healedCount }} 个，治愈率 {{ weakAnalysis.healRate }}%。</p>
            <p class="diag-line" v-if="metrics[2]?.value && metrics[2].value !== '--'"><strong>练习：</strong>均分 {{ metrics[2].value }}。{{ (metrics[2].value as number) >= 70 ? '扎实。' : '需加强。' }}</p>
            <p class="diag-line" v-if="halfCompare"><strong>活跃对比：</strong>前半程 {{ halfCompare.firstActive }}/{{ halfCompare.firstTotal }} 周 · 后半程 {{ halfCompare.secondActive }}/{{ halfCompare.secondTotal }} 周{{ halfCompare.secondActive >= halfCompare.firstActive ? '，后半程更积极。' : '，后半程活跃度下降。' }}</p>
          </div>
          <div class="flex gap-3 mt-4">
            <el-button type="primary" :icon="Aim" @click="router.push(weakAnalysis.tags[0] ? { name: 'studio', query: { topic: weakAnalysis.tags[0] } } : '/studio')">去生成资源</el-button>
            <el-button :icon="TrendCharts" @click="router.push('/path')">查看学习路径</el-button>
            <el-button plain @click="router.push('/chat')">继续对话</el-button>
          </div>
        </div>
      </template>

      <!-- ===== 全部课程模式 ===== -->
      <template v-else>
        <!-- 课程概览行 -->
        <div class="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-thin">
          <div v-for="(card, i) in courseCards" :key="card.name"
            class="course-card shrink-0 cursor-pointer"
            :class="{ 'course-card-active': selectedCourseIndex === i }"
            :style="{ '--card-color': card.color }"
            @click="selectCourse(i)">
            <span class="text-lg">{{ card.emoji }}</span>
            <p class="course-card-name">{{ card.name }}</p>
            <div class="course-card-stats">
              <span class="course-card-stat">
                <span class="stat-value">{{ card.totalHours }}</span>h
              </span>
              <span class="course-card-stat">
                <span class="stat-value" :style="{ color: card.score >= 70 ? 'var(--lt-success)' : 'var(--lt-warning)' }">{{ card.score }}</span>分
              </span>
            </div>
            <div class="course-card-weak" v-if="card.weakCount > 0">
              <span class="text-[9px]" style="color: var(--lt-text-auxiliary);">{{ card.weakCount }} 项待加强</span>
            </div>
          </div>
        </div>

        <!-- ROW 1: 综合评估 + 对比柱状图 -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div class="r-card flex items-center gap-4">
            <svg viewBox="0 0 120 120" width="110" height="110" class="shrink-0">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--lt-bg-page)" stroke-width="10"/>
              <circle cx="60" cy="60" r="52" fill="none" stroke="url(#g2)" stroke-width="10" stroke-linecap="round"
                :stroke-dasharray="2 * Math.PI * 52"
                :stroke-dashoffset="2 * Math.PI * 52 * (1 - overallAvgScore / 100)"
                transform="rotate(-90, 60, 60)" style="transition: stroke-dashoffset 1.2s ease;"/>
              <defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="var(--lt-brand)"/><stop offset="100%" stop-color="var(--lt-ai)"/></linearGradient></defs>
              <text x="60" y="48" text-anchor="middle" font-size="28" font-weight="800" fill="var(--lt-text-primary)">{{ overallAvgScore }}</text>
              <text x="60" y="66" text-anchor="middle" font-size="11" fill="var(--lt-text-placeholder)">/ 100</text>
            </svg>
            <div>
              <div class="flex items-baseline gap-2 mb-2">
                <span class="text-3xl font-extrabold" :style="{ color: overallAvgScore >= 70 ? 'var(--lt-success)' : 'var(--lt-warning)' }">{{ gradeLabel(overallAvgScore) }}</span>
                <span class="text-xs" style="color: var(--lt-text-auxiliary);">跨课程平均</span>
              </div>
              <p class="text-xs leading-relaxed" style="color: var(--lt-text-secondary);" v-if="bestCourse && mostInvestedCourse">
                最高分：<strong style="color: var(--lt-success)">{{ bestCourse.name }}</strong> {{ bestCourse.score }} 分<br/>
                投入最多：<strong style="color: var(--lt-brand)">{{ mostInvestedCourse.name }}</strong> {{ mostInvestedCourse.totalHours }}h
              </p>
            </div>
          </div>
          <div class="r-card lg:col-span-2">
            <p class="text-xs font-semibold mb-1" style="color: var(--lt-text-primary);">📊 各课程评分与投入对比</p>
            <div class="h-56">
              <v-chart v-if="courseComparisonOption.series?.length" class="w-full h-full" :option="courseComparisonOption" autoresize />
            </div>
          </div>
        </div>

        <!-- ROW 2: 多课程雷达 + 时间分配 -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div class="r-card">
            <p class="text-xs font-semibold mb-1" style="color: var(--lt-text-primary);">🎯 六维能力对比（点击图例切换）</p>
            <div class="h-56">
              <v-chart v-if="allRadarOption.series?.length" class="w-full h-full" :option="allRadarOption" autoresize />
            </div>
          </div>
          <div class="r-card">
            <p class="text-xs font-semibold mb-1" style="color: var(--lt-text-primary);">🕐 学习时间分配</p>
            <div class="h-56">
              <v-chart v-if="timeDistributionOption.series?.length" class="w-full h-full" :option="timeDistributionOption" autoresize />
            </div>
          </div>
        </div>

        <!-- ROW 3: 合并趋势 -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div class="r-card lg:col-span-2">
            <p class="text-xs font-semibold mb-1" style="color: var(--lt-text-primary);">📈 各课程每周投入趋势</p>
            <div class="h-48">
              <v-chart class="w-full h-full" :option="mergedTrendOption" autoresize />
            </div>
          </div>
          <div class="r-card">
            <p class="text-xs font-semibold mb-1" style="color: var(--lt-text-primary);">🩺 跨课程薄弱项分析</p>
            <div class="mb-2">
              <div class="flex items-center gap-3 text-xs" style="color: var(--lt-text-auxiliary);">
                <span>共 <strong style="color:var(--lt-text-primary);">{{ allWeakAnalysis.totalWeak }}</strong> 个薄弱项</span>
                <span>已掌握 <strong style="color:var(--lt-success);">{{ allWeakAnalysis.totalMastered }}</strong> 项</span>
              </div>
            </div>
            <div v-if="allWeakAnalysis.crossCutting.length" class="mb-2">
              <p class="text-[10px] font-medium mb-1" style="color: var(--lt-orange);">⚠️ 跨课程共性问题</p>
              <div class="flex flex-wrap gap-1">
                <span v-for="item in allWeakAnalysis.crossCutting" :key="item" class="badge warning">{{ item }}</span>
              </div>
            </div>
            <div>
              <p class="text-[10px] font-medium mb-1" style="color: var(--lt-danger);">待加强</p>
              <div class="flex flex-wrap gap-1">
                <span v-for="item in allWeakAnalysis.weakList" :key="item.tag" class="badge danger">{{ item.tag }}<span class="ml-0.5 opacity-60">×{{ item.count }}</span></span>
              </div>
            </div>
          </div>
        </div>

        <!-- 跨课程诊断 -->
        <div class="r-card diagnosis">
          <p class="text-xs font-semibold mb-3" style="color: var(--lt-text-primary);">📝 跨课程综合诊断</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <p class="diag-line"><strong>整体评级：</strong>{{ gradeLabel(overallAvgScore) }}（{{ overallAvgScore }}均分）。{{ overallAvgScore >= 70 ? '整体表现良好。' : '有较大提升空间。' }}</p>
            <p class="diag-line" v-if="bestCourse && mostInvestedCourse"><strong>投入产出：</strong>「{{ mostInvestedCourse.name }}」投入最多（{{ mostInvestedCourse.totalHours }}h），但「{{ bestCourse.name }}」评分最高（{{ bestCourse.score }}分）。{{ bestCourse.name !== mostInvestedCourse.name ? '投入与产出不完全匹配，可优化时间分配。' : '投入与产出一致，方向正确。' }}</p>
            <p class="diag-line" v-if="allWeakAnalysis.crossCutting.length"><strong>共性问题：</strong>{{ allWeakAnalysis.crossCutting.length }} 个薄弱知识点在 2 门以上课程中出现，建议优先攻克。</p>
            <p class="diag-line"><strong>时间分配：</strong>共 {{ courseCount }} 门课程，累计 {{ totalHoursAcross }}h。{{ courseCount > 1 ? '建议关注各课程时间分配的均衡性。' : '' }}</p>
          </div>
          <div class="flex gap-3 mt-4">
            <el-button type="primary" :icon="Aim" @click="router.push('/studio')">去生成资源</el-button>
            <el-button :icon="TrendCharts" @click="router.push('/path')">查看学习路径</el-button>
          </div>
        </div>
      </template>
    </template>
    </div>
  </div>
</template>

<style scoped>
.report-container { background: transparent; min-height: 100%; }
.r-card { background: var(--lt-bg-card); border: 1px solid var(--lt-border); border-radius: 12px; padding: 16px; }
.badge { display: inline-flex; align-items: center; font-size: 10px; padding: 2px 8px; border-radius: 5px; font-weight: 500; border: 1px solid; }
.badge.danger { background: rgba(255,59,48,0.08); color: #DC2626; border-color: rgba(255,59,48,0.18); cursor: pointer; }
.badge.success { background: rgba(34,197,94,0.1); color: #16A34A; border-color: rgba(34,197,94,0.2); }
.badge.warning { background: rgba(255,140,66,0.1); color: #EA580C; border-color: rgba(255,140,66,0.2); }
.version-flow { display: flex; flex-direction: column; }
.v-node { display: flex; gap: 12px; }
.v-line-wrap { display: flex; flex-direction: column; align-items: center; width: 12px; flex-shrink: 0; padding-top: 3px; }
.v-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--lt-brand-lighter); flex-shrink: 0; }
.v-dot.latest { background: var(--lt-brand); box-shadow: 0 0 0 3px rgba(43,111,255,0.2); }
.v-line { width: 1px; flex: 1; background: var(--lt-border); margin-top: 3px; }
.v-node:last-child .v-line { display: none; }
.v-body { flex: 1; padding-bottom: 12px; }
.v-tag { font-size: 9px; padding: 1px 6px; border-radius: 3px; background: var(--lt-bg-page); color: var(--lt-text-auxiliary); }
.diagnosis { border-color: rgba(43,111,255,0.15); }
.diag-line { font-size: 12px; line-height: 1.6; color: var(--lt-text-secondary); margin: 0; padding: 6px 10px; border-radius: 6px; background: var(--lt-bg-page); }
.diag-line strong { color: var(--lt-text-primary); font-weight: 600; }

/* 课程概览行 */
.course-card {
  background: var(--lt-bg-card);
  border: 1.5px solid var(--lt-border);
  border-radius: 12px;
  padding: 12px 14px;
  min-width: 130px;
  transition: all 0.2s ease;
  border-top: 3px solid var(--card-color, var(--lt-brand));
}
.course-card:hover {
  border-color: var(--card-color, var(--lt-brand));
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  transform: translateY(-1px);
}
.course-card-active {
  border-color: var(--card-color, var(--lt-brand)) !important;
  background: color-mix(in srgb, var(--card-color, var(--lt-brand)) 6%, var(--lt-bg-card));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--card-color, var(--lt-brand)) 20%, transparent);
}
.course-card-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--lt-text-primary);
  margin: 4px 0 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.course-card-stats {
  display: flex;
  gap: 10px;
}
.course-card-stat {
  font-size: 10px;
  color: var(--lt-text-auxiliary);
}
.stat-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--lt-text-primary);
}
.course-card-weak {
  margin-top: 4px;
}
.scrollbar-thin::-webkit-scrollbar {
  height: 3px;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: var(--lt-border);
  border-radius: 2px;
}
</style>