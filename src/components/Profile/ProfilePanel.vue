<script setup lang="ts">
import { computed } from 'vue'
import * as echarts from 'echarts/core'
import { RadarChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { useProfileStore } from '@/stores/profile'
import type { ProfileDimensionItem, ProfileDimensionKey } from '@/types'

echarts.use([RadarChart, CanvasRenderer])

const profile = useProfileStore()

// ===== 7 维雷达图定义 =====
interface RadarDim {
  key: ProfileDimensionKey
  label: string
  layer: 'core' | 'style' | 'auxiliary'
}

const radarDims: RadarDim[] = [
  { key: 'knowledge_basis',     label: '知识基础', layer: 'core' },
  { key: 'learning_goal',       label: '学习目标', layer: 'core' },
  { key: 'cognitive_style',     label: '认知风格', layer: 'style' },
  { key: 'learning_pace',       label: '学习节奏', layer: 'style' },
  { key: 'major_context',       label: '专业上下文', layer: 'auxiliary' },
  { key: 'interest_direction',  label: '兴趣方向', layer: 'auxiliary' },
  { key: 'error_pattern',       label: '错误模式', layer: 'auxiliary' },
]

function getDim(key: ProfileDimensionKey): ProfileDimensionItem | undefined {
  return profile.fullProfile?.dimensions?.find(d => d.key === key)
}

function dimValue(key: ProfileDimensionKey): number {
  const dim = getDim(key)
  if (!dim) return 5   // 未建立 → 接近零
  return Math.round(dim.confidence * 100)
}

// 雷达图层色：核心蓝 / 风格橙 / 辅助灰
function layerColor(layer: string): string {
  if (layer === 'core') return '#2B6FFF'
  if (layer === 'style') return '#FF9F0A'
  return '#8E8EA0'
}

const radarOption = computed(() => ({
  radar: {
    indicator: radarDims.map(d => ({
      name: d.label,
      max: 100,
    })),
    radius: '55%',
    center: ['50%', '50%'],
    axisName: {
      color: '#5A5A72',
      fontSize: 10,
    },
    splitArea: {
      areaStyle: {
        color: ['#FAFBFC', '#F5F7FA', '#EEF1F5', '#E8ECF0'],
      },
    },
    axisLine: { lineStyle: { color: '#E8ECF0' } },
    splitLine: { lineStyle: { color: '#E8ECF0' } },
  },
  series: [
    {
      name: '画像完整度',
      type: 'radar',
      data: [
        {
          value: radarDims.map(d => dimValue(d.key)),
          name: '当前',
          itemStyle: { color: '#2B6FFF' },
          lineStyle: { color: '#2B6FFF', width: 1.5 },
          areaStyle: { color: 'rgba(43, 111, 255, 0.06)' },
        },
      ],
    },
  ],
}))

// ===== 核心层数据 =====
const knowledgeValue = computed(() => getDim('knowledge_basis')?.value)
const masteredList = computed(() => (knowledgeValue.value?.mastered ?? []) as string[])
const weakList    = computed(() => (knowledgeValue.value?.weak ?? []) as string[])
const kbPercent   = computed(() => {
  const total = masteredList.value.length + weakList.value.length
  if (total === 0) return dimValue('knowledge_basis') > 50 ? 50 : 10
  return Math.round((masteredList.value.length / total) * 100)
})

const goalValue = computed(() => getDim('learning_goal')?.value)
const goalPrimary = computed(() => goalValue.value?.primary as string || '未设置')
const goalSubs    = computed(() => (goalValue.value?.sub_goals ?? []) as string[])
const goalPercent = computed(() => dimValue('learning_goal'))

// ===== 风格层数据 =====
const styleValue = computed(() => getDim('cognitive_style')?.value)
const styleLabel  = computed(() => {
  const pref = styleValue.value?.media_preference as string
  const map: Record<string, string> = { text: '图文优先', video: '视频优先', code: '代码优先', mixed: '混合' }
  return map[pref] ?? '未设置'
})
const densityLabel = computed(() => {
  const d = styleValue.value?.example_density as string
  const map: Record<string, string> = { high: '高密度', medium: '中密度', low: '低密度' }
  return map[d] ?? ''
})

const paceValue = computed(() => getDim('learning_pace')?.value)
const paceMinutes  = computed(() => paceValue.value?.daily_minutes ?? '?')
const paceUrgency  = computed(() => {
  const u = paceValue.value?.urgency as string
  const map: Record<string, string> = { relaxed: '宽松', normal: '正常', intensive: '紧凑' }
  return map[u] ?? ''
})

// ===== 辅助层数据 =====
const majorValue = computed(() => getDim('major_context')?.value)
const majorText  = computed(() => {
  if (!majorValue.value) return '未设置'
  return `${majorValue.value.major ?? ''} · ${majorValue.value.course ?? ''}`.trim()
})
const majorGrade  = computed(() => majorValue.value?.grade as string || '')

const interestValue = computed(() => getDim('interest_direction')?.value)
const interestTopics = computed(() => (interestValue.value?.topics ?? []) as string[])

const errorValue = computed(() => getDim('error_pattern')?.value)
const errorTags = computed(() => (errorValue.value?.tags ?? []) as string[])

// ===== 元数据 =====
const versionText = computed(() =>
  profile.fullProfile ? `v${profile.fullProfile.version}` : profile.profileVersion
)
const updatedText = computed(() =>
  profile.fullProfile?.updated_at ?? profile.updatedAt
)
</script>

<template>
  <div style="display: grid; grid-template-rows: auto 1fr; height: 100%; background-color: var(--lt-bg-card); border-left: 1px solid var(--lt-border);">
    <!-- 头部 -->
    <div class="p-4" style="grid-row: 1; border-bottom: 1px solid var(--lt-border);">
      <h2 class="text-lg font-medium" style="color: var(--lt-text-primary);">学习画像</h2>
      <div class="flex items-center justify-between mt-1">
        <p class="text-xs" style="color: var(--lt-text-auxiliary);">{{ updatedText }}</p>
        <el-tag size="small" type="info" effect="plain">{{ versionText }}</el-tag>
      </div>
    </div>

    <div class="overflow-y-auto p-4 space-y-4" style="grid-row: 2; min-height: 0;">

      <!-- ===== 雷达图（7维全貌概览）===== -->
      <div class="rounded-xl p-3" style="background-color: var(--lt-bg-page); border: 1px solid var(--lt-border);">
        <h3 class="text-xs font-semibold mb-1 flex items-center gap-2" style="color: var(--lt-text-auxiliary);">
          画像全貌
          <span class="inline-flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full" style="background-color: var(--lt-brand);" />
            <span class="text-xs" style="color: var(--lt-brand);">核心</span>
          </span>
          <span class="inline-flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full" style="background-color: var(--lt-warning);" />
            <span class="text-xs" style="color: var(--lt-warning);">风格</span>
          </span>
          <span class="inline-flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full" style="background-color: var(--lt-text-auxiliary);" />
            <span class="text-xs" style="color: var(--lt-text-auxiliary);">辅助</span>
          </span>
        </h3>
        <div class="h-56 w-full">
          <v-chart class="w-full h-full" :option="radarOption" autoresize />
        </div>
      </div>

      <!-- ===== 核心层详情 ===== -->
      <div class="rounded-xl p-4" style="background: linear-gradient(135deg, rgba(43, 111, 255, 0.04), var(--lt-brand-lightest)); border: 1px solid var(--lt-brand-light-7);">
        <h3 class="text-sm font-bold mb-3 flex items-center gap-1.5" style="color: var(--lt-brand);">
          核心 · 决定学什么
        </h3>

        <!-- 知识基础 -->
        <div class="mb-4">
          <div class="flex justify-between mb-1">
            <span class="text-xs font-medium" style="color: var(--lt-text-secondary);">知识基础</span>
            <span class="text-xs font-bold" style="color: var(--lt-brand);">{{ kbPercent }}%</span>
          </div>
          <el-progress :percentage="kbPercent" :stroke-width="6" :show-text="false" color="var(--lt-brand)" />
          <div class="flex flex-wrap gap-1 mt-2">
            <el-tag v-for="t in weakList" :key="t" size="small" type="danger" effect="plain" class="rounded text-xs">
              {{ t }}
            </el-tag>
            <el-tag v-for="t in masteredList" :key="t" size="small" type="success" effect="plain" class="rounded text-xs">
              {{ t }}
            </el-tag>
            <span v-if="weakList.length === 0 && masteredList.length === 0" class="text-xs" style="color: var(--lt-text-auxiliary);">对话中建立...</span>
          </div>
        </div>

        <!-- 学习目标 -->
        <div>
          <div class="flex justify-between mb-1">
            <span class="text-xs font-medium" style="color: var(--lt-text-secondary);">学习目标</span>
            <span class="text-xs font-bold" style="color: var(--lt-brand);">{{ goalPercent }}%</span>
          </div>
          <el-progress :percentage="goalPercent" :stroke-width="6" :show-text="false" color="var(--lt-brand)" />
          <p class="text-xs mt-2 font-medium" style="color: var(--lt-text-primary);">{{ goalPrimary }}</p>
          <div class="flex flex-wrap gap-1 mt-1">
            <span v-for="(s, i) in goalSubs" :key="i" class="text-xs px-1.5 py-0.5 rounded" style="background-color: var(--lt-brand-lightest); color: var(--lt-brand);">
              {{ s }}
            </span>
          </div>
        </div>
      </div>

      <!-- ===== 风格层 ===== -->
      <div class="rounded-xl p-4" style="background: linear-gradient(135deg, rgba(255, 140, 66, 0.04), var(--lt-orange-light-9)); border: 1px solid var(--lt-orange-light-5);">
        <h3 class="text-sm font-bold mb-3 flex items-center gap-1.5" style="color: var(--lt-orange);">
          风格 · 决定怎么呈现
        </h3>
        <div class="space-y-2.5">
          <div class="flex items-center justify-between text-sm">
            <span style="color: var(--lt-text-auxiliary);">认知偏好</span>
            <span class="font-medium" style="color: var(--lt-text-primary);">{{ styleLabel }} · {{ densityLabel }}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span style="color: var(--lt-text-auxiliary);">学习节奏</span>
            <span class="font-medium" style="color: var(--lt-text-primary);">{{ paceMinutes }} 分钟/天 · {{ paceUrgency }}</span>
          </div>
        </div>
      </div>

      <!-- ===== 辅助层 ===== -->
      <div class="rounded-xl p-4" style="background-color: var(--lt-bg-page); border: 1px solid var(--lt-border);">
        <h3 class="text-sm font-medium mb-3 flex items-center gap-1.5" style="color: var(--lt-text-auxiliary);">
          辅助 · 补充上下文
        </h3>
        <div class="space-y-2.5">
          <div class="text-sm">
            <span class="text-xs" style="color: var(--lt-text-auxiliary);">专业</span>
            <p class="mt-0.5 font-medium" style="color: var(--lt-text-primary);">{{ majorText }}
              <span v-if="majorGrade" class="text-xs ml-1" style="color: var(--lt-text-auxiliary);">{{ majorGrade }}</span>
            </p>
          </div>
          <div class="text-sm">
            <span class="text-xs" style="color: var(--lt-text-auxiliary);">兴趣</span>
            <div class="flex flex-wrap gap-1 mt-0.5">
              <el-tag v-for="t in interestTopics" :key="t" size="small" type="primary" effect="plain" class="rounded text-xs">
                {{ t }}
              </el-tag>
              <span v-if="interestTopics.length === 0" class="text-xs" style="color: var(--lt-text-auxiliary);">对话中建立...</span>
            </div>
          </div>
          <div class="text-sm">
            <span class="text-xs" style="color: var(--lt-text-auxiliary);">常见错因</span>
            <div class="flex flex-wrap gap-1 mt-0.5">
              <el-tag v-for="t in errorTags" :key="t" size="small" type="danger" effect="light" class="rounded text-xs">
                {{ t }}
              </el-tag>
              <span v-if="errorTags.length === 0" class="text-xs" style="color: var(--lt-text-auxiliary);">做题后自动分析...</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
