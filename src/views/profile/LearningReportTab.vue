<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useProfileStore } from '@/stores/profile'
import { useLearningReport } from '@/composables/useLearningReport'
import { Timer, Right } from '@element-plus/icons-vue'

const router = useRouter()
const profile = useProfileStore()

const {
  stats, loading, error, hasData,
  metrics, weakAnalysis, radarOption,
  versionHistory, behaviorDetails,
  insightCards,
} = useLearningReport(profile.activeCourseId)

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
  return { label: cv < 0.3 ? '高' : cv < 0.6 ? '中等' : '较低', avg: +avg.toFixed(1) }
})

const versionAnalysis = computed(() => {
  const vh = versionHistory.value
  if (!vh.length) return null
  const triggers = vh.map(h => h.trigger)
  const triggerCount: Record<string, number> = {}
  triggers.forEach(t => { triggerCount[t] = (triggerCount[t] || 0) + 1 })
  const mainTrigger = Object.entries(triggerCount).sort((a, b) => b[1] - a[1])[0]
  const triggerLabel: Record<string, string> = { chat: '对话', quiz: '练习', path_update: '路径调整', manual: '手动' }
  return { total: vh.length, mainTrigger: triggerLabel[mainTrigger?.[0]] || '' }
})
</script>

<template>
  <div class="max-w-3xl">
    <!-- 空状态 -->
    <template v-if="!loading && !hasData && !error">
      <div class="text-center py-12">
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
          <span class="cursor-pointer hover:text-[var(--lt-brand)]" @click="router.push('/library')">📖 浏览资源库</span>
          <span class="cursor-pointer hover:text-[var(--lt-brand)]" @click="router.push('/practice')">📝 自测练习</span>
        </div>
      </div>
    </template>

    <div v-else-if="loading" class="flex items-center justify-center h-64">
      <el-icon class="is-loading" :size="32" style="color: var(--lt-brand);"><Timer /></el-icon>
    </div>

    <div v-else-if="error" class="flex items-center justify-center h-64">
      <p class="text-sm" style="color: var(--lt-text-auxiliary);">{{ error }}</p>
    </div>

    <template v-else>
      <!-- 综合评分 -->
      <div class="flex items-center gap-3 p-4 rounded-xl border mb-3" style="background: var(--lt-bg-card); border-color: var(--lt-border);">
        <svg viewBox="0 0 100 100" width="70" height="70" class="shrink-0">
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
          <p class="text-xs" style="color: var(--lt-text-auxiliary);">累计 {{ behaviorDetails.totalHours }}h · 活跃 {{ activeWeeks }}/{{ totalWeeks }} 周</p>
        </div>
      </div>

      <!-- 维度详解 -->
      <div class="rounded-xl border p-4 mb-3" style="background: var(--lt-bg-card); border-color: var(--lt-border);">
        <p class="text-sm font-semibold mb-3" style="color: var(--lt-text-primary);">📐 能力维度详解</p>
        <div class="flex flex-col gap-2">
          <div v-for="d in barDimensions" :key="d.name" class="py-1.5" :class="{ 'border-t border-[var(--lt-border)]': barDimensions.indexOf(d) > 0 }">
            <div class="flex items-center gap-2">
              <span class="text-xs w-16 shrink-0 text-right" style="color: var(--lt-text-secondary);">{{ d.name }}</span>
              <div class="flex-1 h-1.5 rounded-full overflow-hidden" style="background: var(--lt-bg-page);">
                <div class="h-full rounded-full" :style="{ width: (d.value / d.max) * 100 + '%', background: 'linear-gradient(90deg, var(--lt-brand), var(--lt-ai))' }" />
              </div>
              <span class="text-xs font-bold w-5 text-right shrink-0" style="color: var(--lt-text-primary);">{{ d.value }}</span>
            </div>
            <p class="text-[10px] ml-[72px] mt-0.5" style="color: var(--lt-text-auxiliary);">{{ dimDescription(d.name, d.value) }}</p>
          </div>
        </div>
      </div>

      <!-- 稳定性 -->
      <div v-if="stabilityAnalysis" class="rounded-xl border p-4 mb-3" style="background: var(--lt-bg-card); border-color: var(--lt-border);">
        <p class="text-sm font-semibold mb-2" style="color: var(--lt-text-primary);">📊 学习稳定性</p>
        <p class="text-xs" style="color: var(--lt-text-secondary);">稳定性：<strong>{{ stabilityAnalysis.label }}</strong> · 周均 {{ stabilityAnalysis.avg }}h · 活跃 {{ activeWeeks }}/{{ totalWeeks }} 周</p>
      </div>

      <!-- 薄弱项改善 -->
      <div v-if="weakAnalysis.tags.length > 0 || weakAnalysis.mastered.length > 0" class="rounded-xl border p-4 mb-3" style="background: var(--lt-bg-card); border-color: var(--lt-border);">
        <p class="text-sm font-semibold mb-3" style="color: var(--lt-text-primary);">🩺 薄弱项改善分析</p>
        <div class="flex items-center gap-2 mb-3">
          <span class="text-xs" style="color: var(--lt-text-auxiliary);">{{ weakAnalysis.previousCount }}→{{ weakAnalysis.currentCount }}</span>
          <div class="flex-1 h-1.5 rounded-full overflow-hidden" style="background: var(--lt-bg-page); max-width: 60px;">
            <div class="h-full rounded-full" :style="{ width: weakAnalysis.healRate + '%', background: weakAnalysis.healRate > 50 ? 'var(--lt-success)' : 'var(--lt-warning)' }" />
          </div>
          <span class="text-xs font-bold" :style="{ color: weakAnalysis.healRate > 50 ? 'var(--lt-success)' : 'var(--lt-warning)' }">{{ weakAnalysis.healRate }}%</span>
        </div>
        <div v-if="weakAnalysis.tags.length > 0" class="mb-2">
          <p class="text-[10px] font-medium mb-1" style="color: var(--lt-danger);">待加强</p>
          <div class="flex flex-wrap gap-1">
            <span v-for="tag in weakAnalysis.tags" :key="tag" class="inline-flex items-center text-[10px] px-2 py-0.5 rounded" style="background: rgba(255,59,48,0.08); color: #DC2626; border: 1px solid rgba(255,59,48,0.18);">{{ tag }}</span>
          </div>
        </div>
        <div v-if="weakAnalysis.mastered.length > 0">
          <p class="text-[10px] font-medium mb-1" style="color: var(--lt-success);">已掌握</p>
          <div class="flex flex-wrap gap-1">
            <span v-for="tag in weakAnalysis.mastered" :key="tag" class="inline-flex items-center text-[10px] px-2 py-0.5 rounded" style="background: rgba(34,197,94,0.1); color: #16A34A; border: 1px solid rgba(34,197,94,0.2);">{{ tag }}</span>
          </div>
        </div>
      </div>

      <!-- 版本演进 -->
      <div v-if="versionHistory.length > 0" class="rounded-xl border p-4" style="background: var(--lt-bg-card); border-color: var(--lt-border);">
        <p class="text-sm font-semibold mb-2" style="color: var(--lt-text-primary);">🔄 画像演进分析</p>
        <p class="text-xs mb-3" style="color: var(--lt-text-auxiliary);" v-if="versionAnalysis">共 {{ versionAnalysis.total }} 次更新，主要由 {{ versionAnalysis.mainTrigger }} 触发</p>
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
  </div>
</template>

<style scoped>
</style>