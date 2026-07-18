<script setup lang="ts">
import { computed } from 'vue'
import type { PlaybackSpeed, DiagramContent } from '@/types/scene'
import { useSceneTimer } from '@/composables/useSceneTimer'

const props = defineProps<{
  content: Record<string, any>
  isPlaying: boolean
  speed: PlaybackSpeed
  duration: number
  narration: string
}>()

const emit = defineEmits<{ complete: [] }>()

const data = props.content as unknown as DiagramContent
const chartType = data.chartType || 'line'

function calcDuration(): number {
  if (props.duration > 0) return props.duration
  const narrationLen = (props.narration || '').length
  return Math.max(narrationLen * 240, 6000)
}

const totalTime = calcDuration()

const { virtualTime } = useSceneTimer(
  () => props.isPlaying,
  () => props.speed,
  totalTime,
  () => emit('complete'),
)

const chartReady = computed(() => virtualTime.value >= 300)

// Chart layout constants
const SVG_W = 600; const SVG_H = 350
const MARGIN = { top: 30, right: 30, bottom: 50, left: 50 }
const PLOT_W = SVG_W - MARGIN.left - MARGIN.right
const PLOT_H = SVG_H - MARGIN.top - MARGIN.bottom

// Colors for datasets
const COLORS = ['#2B6FFF', '#FF8C42', '#7C5CFC', '#22c55e', '#ef4444']

// Scale data to plot coordinates
function scaleData(datasets: DiagramContent['datasets']) {
  if (!datasets || datasets.length === 0) return { datasets: [], xMax: 10, yMax: 10, xMin: 0, yMin: 0 }
  let xMax = 0, yMax = 0, xMin = Infinity, yMin = Infinity
  for (const ds of datasets) {
    for (const pt of ds.points) {
      if (pt.x > xMax) xMax = pt.x
      if (pt.x < xMin) xMin = pt.x
      if (pt.y > yMax) yMax = pt.y
      if (pt.y < yMin) yMin = pt.y
    }
  }
  if (xMax === xMin) xMax = xMin + 10
  if (yMax === yMin) yMax = yMin + 10

  // 修复：检查是否存在有效数据点
  if (xMin === Infinity || yMin === Infinity) {
    return { datasets, xMax: 10, yMax: 10, xMin: 0, yMin: 0 }
  }

  return { datasets, xMax, yMax, xMin, yMin }
}

const scaled = computed(() => scaleData(data.datasets))

function toX(val: number): number {
  const { xMin, xMax } = scaled.value
  return MARGIN.left + ((val - xMin) / (xMax - xMin)) * PLOT_W
}

function toY(val: number): number {
  const { yMin, yMax } = scaled.value
  return MARGIN.top + PLOT_H - ((val - yMin) / (yMax - yMin)) * PLOT_H
}

// For bar charts: group points by x category
const barGroups = computed(() => {
  if (chartType !== 'bar' || !scaled.value.datasets.length) return []
  const allX = new Set<number>()
  for (const ds of scaled.value.datasets) {
    for (const pt of ds.points) allX.add(pt.x)
  }
  return [...allX].sort((a, b) => a - b)
})

const barWidth = computed(() => {
  const n = barGroups.value.length || 1
  const dsCount = scaled.value.datasets.length || 1
  return Math.min(PLOT_W / n / (dsCount + 1), 40)
})

// Stagger delay per element
function staggerDelay(index: number, total: number): string {
  return `${0.1 + (index / Math.max(total, 1)) * 0.8}s`
}
</script>

<template>
  <div class="diagram-scene">
    <h3 v-if="data.heading" class="diagram-heading">{{ data.heading }}</h3>
    <div class="chart-container" :class="{ ready: chartReady }">
      <svg :viewBox="`0 0 ${SVG_W} ${SVG_H}`" class="chart-svg">
        <!-- Grid lines -->
        <line v-for="i in 5" :key="'h'+i"
          :x1="MARGIN.left" :y1="MARGIN.top + i * (PLOT_H / 5)"
          :x2="MARGIN.left + PLOT_W" :y2="MARGIN.top + i * (PLOT_H / 5)"
          stroke="rgba(255,255,255,0.06)" />
        <!-- Axes -->
        <line :x1="MARGIN.left" :y1="MARGIN.top + PLOT_H"
          :x2="MARGIN.left + PLOT_W" :y2="MARGIN.top + PLOT_H"
          stroke="rgba(255,255,255,0.2)" />
        <line :x1="MARGIN.left" :y1="MARGIN.top"
          :x2="MARGIN.left" :y2="MARGIN.top + PLOT_H"
          stroke="rgba(255,255,255,0.2)" />

        <!-- BAR CHART -->
        <template v-if="chartType === 'bar' && chartReady">
          <g v-for="(xVal, gi) in barGroups" :key="'bg'+gi">
            <rect v-for="(ds, di) in scaled.datasets" :key="'bar'+di"
              :x="toX(xVal) - (barWidth * scaled.datasets.length) / 2 + di * barWidth"
              :y="toY(ds.points.find(p => p.x === xVal)?.y ?? 0)"
              :width="barWidth - 2"
              :height="MARGIN.top + PLOT_H - toY(ds.points.find(p => p.x === xVal)?.y ?? 0)"
              :fill="COLORS[di % COLORS.length]"
              class="chart-bar"
              :style="{ animationDelay: staggerDelay(gi * scaled.datasets.length + di, barGroups.length * scaled.datasets.length) }"
            />
          </g>
        </template>

        <!-- LINE CHART -->
        <template v-if="chartType === 'line' && scaled.datasets">
          <template v-if="chartReady">
            <polyline v-for="(ds, di) in scaled.datasets" :key="'line'+di"
              :points="ds.points.map((p: any) => `${toX(p.x)},${toY(p.y)}`).join(' ')"
              fill="none" :stroke="COLORS[di % COLORS.length]" stroke-width="2.5"
              class="chart-line-draw" />
          </template>
          <template v-for="(ds, di) in scaled.datasets" :key="'pts'+di">
            <circle v-for="(pt, pi) in ds.points" :key="'pt'+di+'-'+pi"
              :cx="toX(pt.x)" :cy="toY(pt.y)" r="4"
              :fill="COLORS[di % COLORS.length]" :opacity="chartReady ? 1 : 0"
              class="chart-point"
              :style="{ animationDelay: staggerDelay(pi, ds.points.length) }" />
          </template>
        </template>

        <!-- SCATTER CHART -->
        <template v-if="chartType === 'scatter' && chartReady">
          <template v-for="(ds, di) in scaled.datasets" :key="'scds'+di">
            <circle v-for="(pt, pi) in ds.points" :key="'sc'+di+'-'+pi"
              :cx="toX(pt.x)" :cy="toY(pt.y)" r="5"
              :fill="COLORS[di % COLORS.length]" opacity="0.85"
              class="chart-scatter"
              :style="{ animationDelay: staggerDelay(di * ds.points.length + pi, scaled.datasets.reduce((s, d) => s + d.points.length, 0)) }" />
          </template>
        </template>

        <!-- Labels -->
        <text v-if="data.xLabel" :x="MARGIN.left + PLOT_W / 2" :y="SVG_H - 8"
          text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="12">{{ data.xLabel }}</text>
        <text v-if="data.yLabel" :x="16" :y="MARGIN.top + PLOT_H / 2"
          text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="12"
          :transform="`rotate(-90,16,${MARGIN.top + PLOT_H / 2})`">{{ data.yLabel }}</text>
      </svg>
    </div>
    <div class="chart-legend" v-if="scaled.datasets">
      <div v-for="(ds, di) in scaled.datasets" :key="di" class="legend-item">
        <span class="legend-dot" :style="{ background: COLORS[di % COLORS.length] }" />
        <span class="legend-label">{{ ds.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.diagram-scene {
  width: 100%; height: 100%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: radial-gradient(ellipse at 70% 15%, rgba(43, 111, 255, 0.08), transparent 55%), radial-gradient(ellipse at 20% 85%, rgba(255, 140, 66, 0.05), transparent 55%), radial-gradient(ellipse at 50% 50%, #14141f 0%, #0d0d12 65%, #08080c 100%); padding: 40px;
}
.diagram-heading { font-size: 18px; font-weight: 600; color: rgba(255,255,255,0.8); margin: 0 0 16px; }
.chart-container { width: 100%; max-width: 600px; }
.chart-svg { width: 100%; height: auto; }

/* Bar animation */
.chart-bar {
  animation: bar-grow 0.6s cubic-bezier(0.2, 0, 0, 1) both;
  transform-origin: bottom;
}
@keyframes bar-grow {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}

/* Line animation */
.chart-line-draw {
  stroke-dasharray: 2000;
  animation: line-draw 1.5s cubic-bezier(0.2, 0, 0, 1) forwards;
}
@keyframes line-draw {
  from { stroke-dashoffset: 2000; }
  to { stroke-dashoffset: 0; }
}

/* Point animation */
.chart-point {
  animation: point-in 0.4s cubic-bezier(0.2, 0, 0, 1) both;
}
@keyframes point-in {
  from { r: 0; opacity: 0; }
  to { r: 4; opacity: 1; }
}

/* Scatter animation */
.chart-scatter {
  animation: scatter-in 0.5s cubic-bezier(0.2, 0, 0, 1) both;
}
@keyframes scatter-in {
  from { r: 0; opacity: 0; transform-origin: center; }
  to { r: 5; opacity: 0.85; }
}

.chart-legend { display: flex; gap: 20px; margin-top: 12px; }
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: rgba(255,255,255,0.5); }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; }
</style>
