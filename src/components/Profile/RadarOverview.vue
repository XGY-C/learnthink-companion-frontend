<script setup lang="ts">
/**
 * L1 雷达图：7 维 confidence 驱动。
 *
 * 关键决策（详见 §3.1）：
 *  - confidence 是"系统对该维度推断的把握度"，不是用户能力评分。
 *  - 对 polarity=negative 维度（error_pattern）反转为 (1 - confidence) * 100，
 *    避免"系统很确信用户存在错误模式"被画成"得分高"，与用户直觉相反。
 *  - tooltip 中明确标注每维数值含义。
 */
import { computed, ref, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts/core'
import { RadarChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { useProfileStore } from '@/stores/profile'
import { RADAR_DIMS } from '@/constants/profile'

echarts.use([RadarChart, TooltipComponent, CanvasRenderer])

const profile = useProfileStore()

const radarSize = ref(280)
function updateSize() {
  const w = window.innerWidth
  radarSize.value = w < 640 ? 220 : w < 1024 ? 260 : 300
}
onMounted(() => {
  updateSize()
  window.addEventListener('resize', updateSize)
})
onUnmounted(() => {
  window.removeEventListener('resize', updateSize)
})

interface RadarPoint {
  value: number
  rawConfidence: number
  polarity: 'positive' | 'negative'
}

const radarPoints = computed<RadarPoint[]>(() =>
  RADAR_DIMS.map(rd => {
    const d = profile.dim(rd.key)
    const c = d?.confidence ?? 0
    const value = rd.polarity === 'negative'
      ? Math.round((1 - c) * 100)
      : Math.round(c * 100)
    return { value, rawConfidence: c, polarity: rd.polarity }
  })
)

const axisLabelColor = computed(() => {
  const s = getComputedStyle(document.documentElement)
  return s.getPropertyValue('--lt-chart-axis-label').trim() || '#3A3A54'
})

const radarOption = computed(() => ({
  tooltip: {
    trigger: 'item',
    formatter: () => {
      const lines = RADAR_DIMS.map((rd, idx) => {
        const p = radarPoints.value[idx]
        const note = rd.polarity === 'negative' ? '（已反转）' : ''
        const raw = `${Math.round(p.rawConfidence * 100)}%`
        return `${rd.label}：${p.value}${note}<br/><span style="color:#888;font-size:11px;">原始置信度 ${raw}</span>`
      }).join('<br/>')
      return `<div style="line-height:1.7;font-size:12px;">${lines}</div>`
    },
  },
  radar: {
    indicator: RADAR_DIMS.map(d => ({ name: d.label, max: 100 })),
    radius: '60%',
    center: ['50%', '52%'],
    axisName: {
      color: axisLabelColor.value,
      fontSize: 11,
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
      name: '画像置信度',
      type: 'radar',
      data: [
        {
          value: radarPoints.value.map(p => p.value),
          name: '当前',
          itemStyle: { color: '#2B6FFF' },
          lineStyle: { color: '#2B6FFF', width: 1.5 },
          areaStyle: { color: 'rgba(43, 111, 255, 0.08)' },
        },
      ],
    },
  ],
}))

const overall = computed(() => profile.overallConfidence)
</script>

<template>
  <div class="radar-overview">
    <div class="radar-head">
      <h3 class="radar-title">画像全貌</h3>
      <div class="radar-legend">
        <span class="legend-item">
          <span class="legend-dot" style="background-color: var(--lt-brand);" />核心
        </span>
        <span class="legend-item">
          <span class="legend-dot" style="background-color: var(--lt-warning);" />风格
        </span>
        <span class="legend-item">
          <span class="legend-dot" style="background-color: var(--lt-text-auxiliary);" />辅助
        </span>
        <el-tooltip placement="top">
          <template #content>
            <div style="max-width: 240px; line-height: 1.6;">
              数值 = 系统对该维度推断的把握度。<br/>
              <b>错误模式</b>已反转：值越高表示"系统越确信用户没有错因"，与其他维度方向一致。
            </div>
          </template>
          <span class="legend-help">?</span>
        </el-tooltip>
      </div>
    </div>

    <div class="radar-canvas" :style="{ height: radarSize + 'px' }">
      <v-chart class="w-full h-full" :option="radarOption" autoresize />
    </div>

    <div class="radar-footer">
      <span class="radar-overall-label">整体置信度</span>
      <span class="radar-overall-value">{{ overall }}%</span>
    </div>
  </div>
</template>

<style scoped>
.radar-overview {
  background-color: var(--lt-bg-page);
  border: 1px solid var(--lt-border);
  border-radius: 12px;
  padding: 12px;
}
.radar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
  flex-wrap: wrap;
  gap: 8px;
}
.radar-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--lt-text-auxiliary);
  margin: 0;
}
.radar-legend {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 11px;
  color: var(--lt-text-auxiliary);
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.legend-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}
.legend-help {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid var(--lt-text-placeholder);
  color: var(--lt-text-placeholder);
  font-size: 10px;
  cursor: help;
  user-select: none;
}
.radar-canvas {
  width: 100%;
}
.radar-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding-top: 4px;
  border-top: 1px dashed var(--lt-border);
  margin-top: 4px;
}
.radar-overall-label {
  font-size: 11px;
  color: var(--lt-text-auxiliary);
}
.radar-overall-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--lt-brand);
  font-variant-numeric: tabular-nums;
}
</style>
