<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProfileStore } from '@/stores/profile'
import { useLearningReport, useAllCoursesReport } from '@/composables/useLearningReport'
import VChart from 'vue-echarts'
import { Timer, Right, TrendCharts } from '@element-plus/icons-vue'

const router = useRouter()
const profile = useProfileStore()

const scope = ref<'single' | 'all'>('single')

const {
  stats, loading, error, hasData,
  metrics, weakAnalysis, radarOption, trendOption,
  versionHistory, behaviorDetails,
  insightCards,
} = useLearningReport(profile.activeCourseId)

const {
  courseCards, selectedCourseIndex,
  totalHoursAcross, courseCount,
  allRadarOption, courseComparisonOption, timeDistributionOption,
  mergedTrendOption,
  allWeakAnalysis, overallAvgScore, bestCourse, mostInvestedCourse,
  selectCourse,
} = useAllCoursesReport()

const barDimensions = computed(() => {
  const s = radarOption.value
  if (!s?.radar?.indicator?.length) return []
  return s.radar.indicator.map((ind: any, i: number) => ({
    name: ind.name,
    value: (s.series?.[0]?.data?.[0]?.value?.[i]) ?? 0,
    max: ind.max,
  }))
})

const overallScore = computed(() => {
  const d = barDimensions.value
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

function dimDescription(name: string, score: number): string {
  if (score >= 80) {
    if (name === '知识基础') return '基础知识积累扎实'
    if (name === '学习目标') return '目标体系清晰'
    if (name === '认知风格') return '有成熟的认知策略'
    if (name === '学习节奏') return '节奏把控得当'
    if (name === '专业理解') return '专业认知深入'
    if (name === '兴趣广度') return '兴趣广泛'
    return '表现优秀'
  }
  if (score >= 60) {
    if (name === '知识基础') return '有一定基础，仍可提升'
    if (name === '学习目标') return '方向基本明确'
    if (name === '认知风格') return '认知策略可更多元'
    if (name === '学习节奏') return '节奏基本稳定'
    if (name === '专业理解') return '处于成长阶段'
    if (name === '兴趣广度') return '有待拓展'
    return '成长中'
  }
  return '需重点关注'
}

const totalWeeks = computed(() => (stats.value?.weeklyActivity?.length ?? 0))
const activeWeeks = computed(() => (stats.value?.weeklyActivity ?? []).filter((w: any) => w.hours > 0).length)

const stabilityAnalysis = computed(() => {
  const hours = (stats.value?.weeklyActivity ?? []).map(w => w.hours)
  if (hours.length < 2) return null
  const avg = hours.reduce((a, b) => a + b, 0) / hours.length
  const variance = hours.reduce((sum, h) => sum + (h - avg) ** 2, 0) / hours.length
  const std = Math.sqrt(variance)
  const cv = avg > 0 ? std / avg : 1
  const label = cv < 0.3 ? '高' : cv < 0.6 ? '中等' : '较低'
  const half = Math.floor(hours.length / 2)
  const firstAvg = hours.slice(0, half).reduce((a, b) => a + b, 0) / half
  const secondAvg = hours.slice(half).reduce((a, b) => a + b, 0) / (hours.length - half)
  const trend = secondAvg - firstAvg > 0.5 ? '上升' : secondAvg - firstAvg < -0.5 ? '下降' : '平稳'
  return { label, avg: +avg.toFixed(1), trend, cv: +cv.toFixed(2) }
})
</script>

<template>
  <div class="m-report">
    <div class="m-report-header">
      <div class="flex items-center gap-2 mb-1">
        <h1 class="m-report-title">
          <span class="text-lg">📋</span>
          个人学习分析
        </h1>
        <el-radio-group v-model="scope" size="small">
          <el-radio-button value="single">当前</el-radio-button>
          <el-radio-button value="all">全部</el-radio-button>
        </el-radio-group>
      </div>
      <p class="m-report-subtitle">
        <template v-if="scope === 'single'">{{ profile.displayProfile?.core?.major || profile.activeCourse?.name || '学员' }} · {{ totalWeeks }} 周数据</template>
        <template v-else>全部 {{ courseCount }} 门课程 · 累计 {{ totalHoursAcross }}h</template>
      </p>
    </div>

    <template v-if="!loading && !hasData && !error">
      <div class="m-report-empty">
        <div class="text-5xl mb-4">🧭</div>
        <h3 class="m-empty-title">暂无学习数据</h3>
        <p class="m-empty-desc">你还没有开始学习之旅。与 AI 导师进行一次对话，系统将自动生成个性化学习报告。</p>
        <button class="m-empty-action" @click="router.push('/chat')">去对话建画像 <el-icon :size="14"><Right /></el-icon></button>
      </div>
    </template>

    <div v-else-if="loading" class="m-report-loading"><el-icon class="is-loading" :size="32" style="color: var(--lt-brand);"><Timer /></el-icon></div>
    <div v-else-if="error" class="m-report-error">
      <p class="text-sm" style="color: var(--lt-text-auxiliary);">{{ error }}</p>
      <button class="m-retry-btn">重试</button>
    </div>

    <template v-else-if="hasData && scope === 'single'">
      <!-- 综合评分 + 雷达 -->
      <div class="m-card">
        <p class="m-card-title">🎯 综合能力评估</p>
        <div class="flex items-center gap-3 mb-3">
          <svg viewBox="0 0 100 100" width="72" height="72" class="shrink-0">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--lt-bg-page)" stroke-width="8"/>
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--lt-brand)" stroke-width="8" stroke-linecap="round"
              :stroke-dasharray="2 * Math.PI * 42"
              :stroke-dashoffset="2 * Math.PI * 42 * (1 - overallScore / 100)"
              transform="rotate(-90, 50, 50)" style="transition: stroke-dashoffset 1s ease;"/>
            <text x="50" y="38" text-anchor="middle" font-size="18" font-weight="800" fill="var(--lt-text-primary)">{{ overallScore }}</text>
            <text x="50" y="52" text-anchor="middle" font-size="8" fill="var(--lt-text-placeholder)">/ 100</text>
          </svg>
          <div>
            <div class="text-xl font-extrabold" :style="{ color: overallScore >= 70 ? 'var(--lt-success)' : 'var(--lt-warning)' }">{{ gradeLabel(overallScore) }}</div>
            <p class="text-xs" style="color: var(--lt-text-auxiliary);">累计 {{ behaviorDetails.totalHours }}h · {{ activeWeeks }}/{{ totalWeeks }} 周活跃</p>
          </div>
        </div>
        <div class="h-44" v-if="radarOption.radar?.indicator?.length">
          <v-chart class="w-full h-full" :option="radarOption" autoresize />
        </div>
      </div>

      <!-- 维度水平条 -->
      <div class="m-card">
        <p class="m-card-title">📐 维度评分</p>
        <div class="flex flex-col gap-2">
          <div v-for="d in barDimensions" :key="d.name" class="py-1" :class="{ 'border-t border-[var(--lt-border)]': barDimensions.indexOf(d) > 0 }">
            <div class="flex items-center gap-2">
              <span class="text-xs w-16 shrink-0 text-right" style="color: var(--lt-text-secondary);">{{ d.name }}</span>
              <div class="flex-1 h-1.5 rounded-full overflow-hidden" style="background: var(--lt-bg-page);">
                <div class="h-full rounded-full" :style="{ width: (d.value / d.max) * 100 + '%', background: d.value >= 80 ? 'var(--lt-success)' : d.value >= 60 ? 'var(--lt-brand)' : 'var(--lt-warning)' }" />
              </div>
              <span class="text-xs font-bold w-5 text-right shrink-0" :style="{ color: d.value >= 80 ? 'var(--lt-success)' : d.value >= 60 ? 'var(--lt-brand)' : 'var(--lt-warning)' }">{{ d.value }}</span>
            </div>
            <p class="text-[10px] ml-[72px] mt-0.5" style="color: var(--lt-text-auxiliary);">{{ dimDescription(d.name, d.value) }}</p>
          </div>
        </div>
      </div>

      <!-- 趋势图 -->
      <div class="m-card" v-if="trendOption.xAxis?.data?.length">
        <p class="m-card-title">📈 学习投入趋势</p>
        <div class="h-44 mb-2">
          <v-chart class="w-full h-full" :option="trendOption" autoresize />
        </div>
        <div class="flex items-center gap-2 text-xs" style="color: var(--lt-text-auxiliary);" v-if="stabilityAnalysis">
          <span>稳定性：<strong>{{ stabilityAnalysis.label }}</strong></span>
          <span>· 周均 <strong>{{ stabilityAnalysis.avg }}h</strong></span>
          <span>· 趋势 <strong :style="{ color: stabilityAnalysis.trend === '上升' ? 'var(--lt-success)' : stabilityAnalysis.trend === '下降' ? 'var(--lt-danger)' : '' }">{{ stabilityAnalysis.trend }}</strong></span>
        </div>
      </div>

      <!-- 薄弱项 -->
      <div class="m-card">
        <p class="m-card-title">🩺 薄弱项改善</p>
        <div class="flex items-center gap-2 mb-3">
          <span class="text-xs" style="color: var(--lt-text-auxiliary);">{{ weakAnalysis.previousCount }}→{{ weakAnalysis.currentCount }}</span>
          <div class="flex-1 h-1.5 rounded-full overflow-hidden" style="background: var(--lt-bg-page); max-width: 80px;">
            <div class="h-full rounded-full" :style="{ width: weakAnalysis.healRate + '%', background: weakAnalysis.healRate > 50 ? 'var(--lt-success)' : 'var(--lt-warning)' }" />
          </div>
          <span class="text-xs font-bold" :style="{ color: weakAnalysis.healRate > 50 ? 'var(--lt-success)' : 'var(--lt-warning)' }">{{ weakAnalysis.healRate }}%</span>
        </div>
        <div v-if="weakAnalysis.tags.length > 0" class="mb-2">
          <p class="text-[10px] font-medium mb-1" style="color: var(--lt-danger);">待加强</p>
          <div class="flex flex-wrap gap-1"><span v-for="tag in weakAnalysis.tags" :key="tag" class="m-badge danger">{{ tag }}</span></div>
        </div>
        <div v-if="weakAnalysis.mastered.length > 0">
          <p class="text-[10px] font-medium mb-1" style="color: var(--lt-success);">已掌握</p>
          <div class="flex flex-wrap gap-1"><span v-for="tag in weakAnalysis.mastered" :key="tag" class="m-badge success">{{ tag }}</span></div>
        </div>
      </div>

      <!-- 画像演进 -->
      <div v-if="versionHistory.length > 0" class="m-card">
        <p class="m-card-title">🔄 画像演进</p>
        <div class="flex flex-col gap-0">
          <div v-for="(h, i) in versionHistory" :key="h.version" class="flex gap-2">
            <div class="flex flex-col items-center w-2.5 shrink-0 pt-1">
              <div class="w-2 h-2 rounded-full" :style="{ background: i === versionHistory.length - 1 ? 'var(--lt-brand)' : 'var(--lt-brand-lighter)' }" />
              <div v-if="i < versionHistory.length - 1" class="w-px flex-1" style="background: var(--lt-border); margin-top: 2px;" />
            </div>
            <div class="flex-1 pb-2.5">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-xs font-semibold" style="color: var(--lt-text-primary);">v{{ h.version }}</span>
                <span class="text-[9px] px-1 rounded" style="background: var(--lt-bg-page); color: var(--lt-text-auxiliary);">{{ h.label }}</span>
                <span class="text-[9px] ml-auto" style="color: var(--lt-text-placeholder);">{{ h.createdAt }}</span>
              </div>
              <p class="text-[10px] mt-0.5" style="color: var(--lt-text-auxiliary);">{{ h.summary.join('；') }}</p>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 全部课程模式 -->
    <template v-else>
      <!-- 课程概览行（水平滚动） -->
      <div class="flex gap-2 mb-3 overflow-x-auto pb-1" style="-webkit-overflow-scrolling: touch;">
        <div v-for="(card, i) in courseCards" :key="card.name"
          class="m-course-card shrink-0"
          :class="{ 'm-course-card-active': selectedCourseIndex === i }"
          :style="{ '--card-color': card.color }"
          @click="selectCourse(i)">
          <span class="text-base">{{ card.emoji }}</span>
          <p class="m-course-card-name">{{ card.name }}</p>
          <div class="flex gap-2 text-[10px]" style="color: var(--lt-text-auxiliary);">
            <span><strong class="text-xs" style="color:var(--lt-text-primary);">{{ card.totalHours }}</strong>h</span>
            <span><strong class="text-xs" :style="{ color: card.score >= 70 ? 'var(--lt-success)' : 'var(--lt-warning)' }">{{ card.score }}</strong>分</span>
          </div>
        </div>
      </div>

      <!-- 综合评分 + 对比柱状图 -->
      <div class="m-card">
        <p class="m-card-title">🎯 跨课程综合评估</p>
        <div class="flex items-center gap-3 mb-3">
          <svg viewBox="0 0 100 100" width="72" height="72" class="shrink-0">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--lt-bg-page)" stroke-width="8"/>
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--lt-brand)" stroke-width="8" stroke-linecap="round"
              :stroke-dasharray="2 * Math.PI * 42"
              :stroke-dashoffset="2 * Math.PI * 42 * (1 - overallAvgScore / 100)"
              transform="rotate(-90, 50, 50)" style="transition: stroke-dashoffset 1s ease;"/>
            <text x="50" y="38" text-anchor="middle" font-size="18" font-weight="800" fill="var(--lt-text-primary)">{{ overallAvgScore }}</text>
            <text x="50" y="52" text-anchor="middle" font-size="8" fill="var(--lt-text-placeholder)">/ 100</text>
          </svg>
          <div>
            <div class="text-lg font-extrabold" :style="{ color: overallAvgScore >= 70 ? 'var(--lt-success)' : 'var(--lt-warning)' }">{{ gradeLabel(overallAvgScore) }}</div>
            <p class="text-[10px]" style="color: var(--lt-text-auxiliary);" v-if="bestCourse && mostInvestedCourse">
              最高：{{ bestCourse.name }} {{ bestCourse.score }}分 · 最多：{{ mostInvestedCourse.name }} {{ mostInvestedCourse.totalHours }}h
            </p>
          </div>
        </div>
        <div class="h-48">
          <v-chart v-if="courseComparisonOption.series?.length" class="w-full h-full" :option="courseComparisonOption" autoresize />
        </div>
      </div>

      <!-- 时间分配饼图 -->
      <div class="m-card">
        <p class="m-card-title">🕐 学习时间分配</p>
        <div class="h-48">
          <v-chart v-if="timeDistributionOption.series?.length" class="w-full h-full" :option="timeDistributionOption" autoresize />
        </div>
      </div>

      <!-- 多课程雷达 -->
      <div class="m-card">
        <p class="m-card-title">🎯 六维能力对比</p>
        <div class="h-56">
          <v-chart v-if="allRadarOption.series?.length" class="w-full h-full" :option="allRadarOption" autoresize />
        </div>
      </div>

      <!-- 合并趋势 -->
      <div class="m-card">
        <p class="m-card-title">📈 每周投入趋势</p>
        <div class="h-48">
          <v-chart class="w-full h-full" :option="mergedTrendOption" autoresize />
        </div>
      </div>

      <!-- 跨课程薄弱项 -->
      <div class="m-card">
        <p class="m-card-title">🩺 跨课程薄弱项</p>
        <div class="flex items-center gap-3 text-xs mb-2" style="color: var(--lt-text-auxiliary);">
          <span>共 <strong style="color:var(--lt-text-primary);">{{ allWeakAnalysis.totalWeak }}</strong> 个</span>
          <span>已掌握 <strong style="color:var(--lt-success);">{{ allWeakAnalysis.totalMastered }}</strong> 项</span>
        </div>
        <div v-if="allWeakAnalysis.crossCutting.length" class="mb-2">
          <p class="text-[10px] font-medium mb-1" style="color: var(--lt-orange);">跨课程共性问题</p>
          <div class="flex flex-wrap gap-1"><span v-for="item in allWeakAnalysis.crossCutting" :key="item" class="m-badge" style="background:rgba(255,140,66,0.1);color:#EA580C;border-color:rgba(255,140,66,0.2)">{{ item }}</span></div>
        </div>
        <div>
          <p class="text-[10px] font-medium mb-1" style="color: var(--lt-danger);">待加强</p>
          <div class="flex flex-wrap gap-1"><span v-for="item in allWeakAnalysis.weakList" :key="item.tag" class="m-badge danger">{{ item.tag }}<span class="ml-0.5 opacity-60">×{{ item.count }}</span></span></div>
        </div>
      </div>

      <!-- 诊断 -->
      <div class="m-card" style="border-color:rgba(43,111,255,0.15);">
        <p class="m-card-title">📝 综合诊断</p>
        <div class="text-xs leading-relaxed" style="color: var(--lt-text-secondary);">
          <p class="mb-1"><strong>整体：</strong>{{ gradeLabel(overallAvgScore) }}（均分{{ overallAvgScore }}）</p>
          <p class="mb-1" v-if="bestCourse && mostInvestedCourse"><strong>投入产出：</strong>{{ mostInvestedCourse.name }} 投入最多（{{ mostInvestedCourse.totalHours }}h），{{ bestCourse.name }} 评分最高（{{ bestCourse.score }}分）</p>
          <p v-if="allWeakAnalysis.crossCutting.length"><strong>共性问题：</strong>{{ allWeakAnalysis.crossCutting.length }} 个跨课程薄弱点</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.m-report { padding: 16px; background: var(--lt-bg-page); min-height: 100%; }
.m-report-header { margin-bottom: 14px; }
.m-report-title { font-size: 19px; font-weight: 700; color: var(--lt-text-primary); display: flex; align-items: center; gap: 6px; margin: 0; }
.m-report-subtitle { font-size: 11px; color: var(--lt-text-auxiliary); margin: 3px 0 0; }
.m-card { background: var(--lt-bg-card); border: 1px solid var(--lt-border); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
.m-card-title { font-size: 13px; font-weight: 600; color: var(--lt-text-primary); margin: 0 0 10px; }
.m-badge { display: inline-flex; align-items: center; font-size: 10px; padding: 2px 8px; border-radius: 5px; font-weight: 500; border: 1px solid; line-height: 1.5; }
.m-badge.danger { background: rgba(255,59,48,0.08); color: #DC2626; border-color: rgba(255,59,48,0.18); }
.m-badge.success { background: rgba(34,197,94,0.1); color: #16A34A; border-color: rgba(34,197,94,0.2); }
.m-report-empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 60px 24px; }
.m-empty-title { font-size: 16px; font-weight: 600; color: var(--lt-text-primary); margin: 12px 0 6px; }
.m-empty-desc { font-size: 13px; color: var(--lt-text-auxiliary); max-width: 280px; margin: 0 0 20px; line-height: 1.5; }
.m-empty-action { display: flex; align-items: center; gap: 4px; padding: 10px 24px; border: none; border-radius: 10px; background: var(--lt-brand); color: #fff; font-size: 14px; cursor: pointer; }
.m-report-loading { display: flex; justify-content: center; padding: 80px 0; }
.m-report-error { text-align: center; padding: 60px 0; }
.m-retry-btn { padding: 8px 20px; border: 1px solid var(--lt-border); border-radius: 8px; background: var(--lt-bg-card); color: var(--lt-text-secondary); font-size: 13px; cursor: pointer; margin-top: 12px; }
.m-course-card {
  background: var(--lt-bg-card);
  border: 1.5px solid var(--lt-border);
  border-radius: 10px;
  padding: 10px 12px;
  min-width: 110px;
  border-top: 2.5px solid var(--card-color, var(--lt-brand));
  transition: all 0.2s ease;
}
.m-course-card-active {
  border-color: var(--card-color, var(--lt-brand)) !important;
  background: color-mix(in srgb, var(--card-color, var(--lt-brand)) 6%, var(--lt-bg-card));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--card-color, var(--lt-brand)) 20%, transparent);
}
.m-course-card-name {
  font-size: 10px;
  font-weight: 600;
  color: var(--lt-text-primary);
  margin: 3px 0 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>