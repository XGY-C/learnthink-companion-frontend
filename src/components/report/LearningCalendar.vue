<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { apiFetch } from '@/utils/api'

interface Props {
  courseId?: string
}
const props = defineProps<Props>()

// ===== 类型 =====
interface DayData {
  date: string
  learningSeconds: number
  level: number
}
interface Stats {
  currentStreak: number
  monthActiveDays: number
  maxStreak: number
  totalActiveDays: number
}
interface DailyActivityData {
  days: DayData[]
  summary: Stats
}
interface DailyDetail {
  date: string
  totalLearningSeconds: number
  quizzes: Array<{ time: string; topic: string; score: number | null; durationSeconds: number | null }>
  resources: Array<{ time: string; title: string; type: string; status: string }>
  chats: Array<{ time: string; title: string; messageCount: number }>
}

// ===== 时间范围切换 =====
const rangeType = ref<'3months' | 'month' | 'lastMonth'>('3months')

const dateRange = computed(() => {
  const end = new Date()
  const start = new Date()
  switch (rangeType.value) {
    case '3months':
      start.setDate(start.getDate() - 84)
      break
    case 'month':
      start.setDate(1)
      break
    case 'lastMonth':
      start.setMonth(start.getMonth() - 1, 1)
      end.setDate(0)
      break
  }
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }
})

// ===== 请求数据 =====
const data = ref<DailyActivityData | null>(null)
const loading = ref(false)

async function fetchDailyActivity() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      startDate: dateRange.value.startDate,
      endDate: dateRange.value.endDate,
    })
    if (props.courseId) params.append('courseId', props.courseId)
    const res = await apiFetch<DailyActivityData>(`/user/me/daily-activity?${params}`)
    data.value = res.data
  } finally {
    loading.value = false
  }
}

watch([rangeType, () => props.courseId], fetchDailyActivity, { immediate: true })

// ===== 选中日期详情 =====
const selectedDate = ref<string | null>(null)
const detailLoading = ref(false)
const detail = ref<DailyDetail | null>(null)

async function selectDay(date: string, level: number) {
  if (level === 0 && selectedDate.value !== date) {
    // 空日期也允许点击，但可能有数据
  }
  if (selectedDate.value === date) {
    selectedDate.value = null
    detail.value = null
    return
  }
  selectedDate.value = date
  detailLoading.value = true
  try {
    const params = new URLSearchParams({ date })
    if (props.courseId) params.append('courseId', props.courseId)
    const res = await apiFetch<DailyDetail>(`/user/me/daily-detail?${params}`)
    detail.value = res.data
  } finally {
    detailLoading.value = false
  }
}

// ===== 热力图网格 =====
const heatmapGrid = computed(() => {
  if (!data.value?.days?.length) return []
  const days = data.value.days
  const firstDate = new Date(days[0].date)
  let startOffset = firstDate.getDay() - 1
  if (startOffset < 0) startOffset = 6

  const grid: (DayData | null)[][] = []
  let currentWeek: (DayData | null)[] = new Array(startOffset).fill(null)

  for (const day of days) {
    currentWeek.push(day)
    if (currentWeek.length === 7) {
      grid.push(currentWeek)
      currentWeek = []
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null)
    grid.push(currentWeek)
  }
  return grid
})

// ===== 月份标签 =====
const monthLabels = computed(() => {
  if (!data.value?.days?.length) return []
  const labels: { text: string; col: number }[] = []
  let lastMonth = -1
  heatmapGrid.value.forEach((week, col) => {
    const firstDay = week.find(d => d !== null)
    if (firstDay) {
      const month = new Date(firstDay.date).getMonth()
      if (month !== lastMonth) {
        labels.push({ text: `${month + 1}月`, col })
        lastMonth = month
      }
    }
  })
  return labels
})

// ===== 颜色映射 =====
const levelColors: Record<number, string> = {
  0: 'var(--lt-bg-page)',
  1: 'rgba(43,111,255,0.2)',
  2: 'rgba(43,111,255,0.4)',
  3: 'rgba(43,111,255,0.7)',
  4: 'var(--lt-brand)',
}

// ===== Tooltip =====
const hoverDay = ref<DayData | null>(null)
const hoverX = ref(0)
const hoverY = ref(0)

function onDayHover(day: DayData, e: MouseEvent) {
  hoverDay.value = day
  const rect = (e.target as HTMLElement).getBoundingClientRect()
  hoverX.value = rect.left + rect.width / 2
  hoverY.value = rect.top - 8
}

function onDayLeave() {
  hoverDay.value = null
}

// ===== 工具函数 =====
function formatSeconds(s: number): string {
  if (s === 0) return '0'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h${m > 0 ? m + 'min' : ''}`
  return `${m}min`
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getMonth() + 1}月${d.getDate()}日（周${weekdays[d.getDay()]}）`
}
</script>

<template>
  <div class="r-card calendar-card">
    <!-- 标题行 -->
    <div class="flex items-center justify-between mb-3">
      <p class="text-xs font-semibold" style="color: var(--lt-text-primary);">📅 学习日历</p>
      <div class="flex gap-1">
        <button
          v-for="rt in (['3months', 'month', 'lastMonth'] as const)"
          :key="rt"
          class="range-btn"
          :class="{ 'range-btn-active': rangeType === rt }"
          @click="rangeType = rt"
        >
          {{ rt === '3months' ? '近3月' : rt === 'month' ? '本月' : '上月' }}
        </button>
      </div>
    </div>

    <!-- 主体：左侧统计 + 右侧热力图 -->
    <div class="flex gap-4" v-if="data">
      <!-- 左侧统计 -->
      <div class="calendar-stats shrink-0">
        <div class="stat-block">
          <p class="stat-label">连续学习</p>
          <p class="stat-value" style="color: var(--lt-brand);">{{ data.summary.currentStreak }}</p>
          <p class="stat-unit">天</p>
        </div>
        <div class="stat-block">
          <p class="stat-label">本月活跃</p>
          <p class="stat-value" style="color: var(--lt-success);">{{ data.summary.monthActiveDays }}</p>
          <p class="stat-unit">天</p>
        </div>
        <div class="stat-block">
          <p class="stat-label">最长连续</p>
          <p class="stat-value" style="color: var(--lt-orange);">{{ data.summary.maxStreak }}</p>
          <p class="stat-unit">天</p>
        </div>
      </div>

      <!-- 右侧热力图 -->
      <div class="flex-1 overflow-x-auto scrollbar-thin">
        <div v-if="loading" class="flex items-center justify-center h-32">
          <span class="text-xs" style="color: var(--lt-text-auxiliary);">加载中...</span>
        </div>
        <div v-else-if="heatmapGrid.length" class="heatmap-wrap">
          <!-- 月份标签行 -->
          <div class="month-labels-row">
            <div class="weekday-spacer"></div>
            <div class="heatmap-grid-area">
              <div class="month-labels">
                <span
                  v-for="ml in monthLabels"
                  :key="ml.col"
                  class="month-label"
                  :style="{ gridColumn: ml.col + 1 }"
                >{{ ml.text }}</span>
              </div>
            </div>
          </div>
          <!-- 星期 + 格子 -->
          <div class="heatmap-body">
            <div class="weekday-labels">
              <span class="weekday-label"></span>
              <span class="weekday-label">二</span>
              <span class="weekday-label"></span>
              <span class="weekday-label">四</span>
              <span class="weekday-label"></span>
              <span class="weekday-label">六</span>
              <span class="weekday-label"></span>
            </div>
            <div class="heatmap-grid-area">
              <div class="heatmap-weeks">
                <div v-for="(week, wi) in heatmapGrid" :key="wi" class="heatmap-week">
                  <div
                    v-for="(day, di) in week"
                    :key="di"
                    class="heatmap-cell"
                    :class="{
                      'heatmap-cell-empty': !day,
                      'heatmap-cell-selected': day && selectedDate === day.date,
                    }"
                    :style="day ? { background: levelColors[day.level] } : {}"
                    @mouseenter="day && onDayHover(day, $event)"
                    @mouseleave="onDayLeave"
                    @click="day && selectDay(day.date, day.level)"
                  ></div>
                </div>
              </div>
            </div>
          </div>
          <!-- 图例 -->
          <div class="heatmap-legend">
            <span class="text-[10px]" style="color: var(--lt-text-auxiliary);">少</span>
            <div class="legend-cell" :style="{ background: levelColors[0] }"></div>
            <div class="legend-cell" :style="{ background: levelColors[1] }"></div>
            <div class="legend-cell" :style="{ background: levelColors[2] }"></div>
            <div class="legend-cell" :style="{ background: levelColors[3] }"></div>
            <div class="legend-cell" :style="{ background: levelColors[4] }"></div>
            <span class="text-[10px]" style="color: var(--lt-text-auxiliary);">多</span>
          </div>
        </div>
        <div v-else class="flex items-center justify-center h-32">
          <span class="text-xs" style="color: var(--lt-text-auxiliary);">暂无学习记录</span>
        </div>
      </div>
    </div>

    <!-- 当日详情面板 -->
    <Transition name="detail-slide">
      <div v-if="selectedDate && detail" class="detail-panel">
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold" style="color: var(--lt-text-primary);">
            {{ formatDateLabel(selectedDate) }} 学习详情
          </p>
          <button class="detail-close" @click="selectedDate = null; detail = null">收起</button>
        </div>
        <div class="detail-duration mb-3">
          <span class="text-[10px]" style="color: var(--lt-text-auxiliary);">学习时长</span>
          <span class="text-sm font-bold ml-2" style="color: var(--lt-brand);">
            {{ formatSeconds(detail.totalLearningSeconds) }}
          </span>
        </div>
        <div v-if="detailLoading" class="text-center py-4">
          <span class="text-xs" style="color: var(--lt-text-auxiliary);">加载中...</span>
        </div>
        <div v-else class="detail-list">
          <div v-if="!detail.quizzes.length && !detail.resources.length && !detail.chats.length" class="text-center py-4">
            <span class="text-xs" style="color: var(--lt-text-auxiliary);">当天暂无学习记录</span>
          </div>
          <template v-else>
            <div v-for="q in detail.quizzes" :key="'q'+q.time" class="detail-item">
              <span class="detail-time">{{ q.time }}</span>
              <span class="detail-type detail-type-quiz">练习</span>
              <span class="detail-content">《{{ q.topic }}》{{ q.score !== null ? ` 得分 ${q.score}` : '' }}{{ q.durationSeconds ? ` · 耗时 ${formatSeconds(q.durationSeconds)}` : '' }}</span>
            </div>
            <div v-for="r in detail.resources" :key="'r'+r.time" class="detail-item">
              <span class="detail-time">{{ r.time }}</span>
              <span class="detail-type detail-type-resource">资源</span>
              <span class="detail-content">《{{ r.title }}》({{ r.type }})</span>
            </div>
            <div v-for="c in detail.chats" :key="'c'+c.time" class="detail-item">
              <span class="detail-time">{{ c.time }}</span>
              <span class="detail-type detail-type-chat">对话</span>
              <span class="detail-content">"{{ c.title }}" · {{ c.messageCount }} 条消息</span>
            </div>
          </template>
        </div>
      </div>
    </Transition>

    <!-- Tooltip -->
    <Teleport to="body">
      <div
        v-if="hoverDay"
        class="calendar-tooltip"
        :style="{ left: hoverX + 'px', top: hoverY + 'px' }"
      >
        {{ formatDateLabel(hoverDay.date) }}
        <span v-if="hoverDay.learningSeconds > 0" style="color: var(--lt-brand);"> · {{ formatSeconds(hoverDay.learningSeconds) }}</span>
        <span v-else style="color: var(--lt-text-auxiliary);"> · 无学习记录</span>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.calendar-card { padding: 16px; }

/* 左侧统计 */
.calendar-stats {
  width: 90px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.stat-block { text-align: center; }
.stat-label { font-size: 10px; color: var(--lt-text-auxiliary); margin-bottom: 2px; }
.stat-value { font-size: 22px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
.stat-unit { font-size: 10px; color: var(--lt-text-auxiliary); margin-top: 1px; }

/* 热力图 */
.heatmap-wrap { min-width: 520px; }
.month-labels-row { display: flex; gap: 4px; margin-bottom: 4px; }
.weekday-spacer { width: 16px; flex-shrink: 0; }
.heatmap-grid-area { flex: 1; }
.month-labels { display: grid; grid-auto-flow: column; grid-auto-columns: 14px; gap: 3px; }
.month-label { font-size: 9px; color: var(--lt-text-auxiliary); white-space: nowrap; }

.heatmap-body { display: flex; gap: 4px; }
.weekday-labels { width: 16px; flex-shrink: 0; display: flex; flex-direction: column; gap: 3px; }
.weekday-label { height: 14px; font-size: 8px; line-height: 14px; color: var(--lt-text-placeholder); text-align: right; }

.heatmap-weeks { display: flex; gap: 3px; }
.heatmap-week { display: flex; flex-direction: column; gap: 3px; }
.heatmap-cell {
  width: 14px; height: 14px;
  border-radius: 3px;
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.1s;
}
.heatmap-cell:hover { transform: scale(1.3); box-shadow: 0 0 0 1px var(--lt-brand); }
.heatmap-cell-empty { background: transparent !important; cursor: default; }
.heatmap-cell-empty:hover { transform: none; box-shadow: none; }
.heatmap-cell-selected { box-shadow: 0 0 0 2px var(--lt-brand); }

/* 图例 */
.heatmap-legend { display: flex; align-items: center; gap: 3px; justify-content: flex-end; margin-top: 6px; }
.legend-cell { width: 12px; height: 12px; border-radius: 2px; }

/* 范围按钮 */
.range-btn {
  font-size: 10px; padding: 2px 8px; border-radius: 4px;
  border: 1px solid var(--lt-border); background: var(--lt-bg-card);
  color: var(--lt-text-auxiliary); cursor: pointer; transition: all 0.15s;
}
.range-btn:hover { color: var(--lt-brand); border-color: var(--lt-brand); }
.range-btn-active { color: #fff; background: var(--lt-brand); border-color: var(--lt-brand); }

/* 详情面板 */
.detail-panel {
  margin-top: 12px; padding-top: 12px;
  border-top: 1px solid var(--lt-border);
}
.detail-close {
  font-size: 10px; color: var(--lt-text-auxiliary);
  cursor: pointer; background: none; border: none;
}
.detail-close:hover { color: var(--lt-brand); }
.detail-duration { padding: 4px 8px; border-radius: 6px; background: var(--lt-bg-page); display: inline-block; }
.detail-list { display: flex; flex-direction: column; gap: 6px; }
.detail-item { display: flex; align-items: center; gap: 8px; font-size: 11px; }
.detail-time { color: var(--lt-text-placeholder); font-variant-numeric: tabular-nums; width: 36px; flex-shrink: 0; }
.detail-type { font-size: 9px; padding: 1px 5px; border-radius: 3px; flex-shrink: 0; }
.detail-type-quiz { background: rgba(255,159,10,0.12); color: var(--lt-orange); }
.detail-type-resource { background: rgba(43,111,255,0.12); color: var(--lt-brand); }
.detail-type-chat { background: rgba(124,92,252,0.12); color: var(--lt-ai); }
.detail-content { color: var(--lt-text-secondary); }

/* Tooltip */
.calendar-tooltip {
  position: fixed; transform: translate(-50%, -100%);
  background: rgba(26,26,46,0.92); color: #fff;
  font-size: 10px; padding: 4px 8px; border-radius: 4px;
  white-space: nowrap; z-index: 9999; pointer-events: none;
}

/* 过渡 */
.detail-slide-enter-active, .detail-slide-leave-active { transition: all 0.25s ease; }
.detail-slide-enter-from, .detail-slide-leave-to { opacity: 0; transform: translateY(-8px); }

/* 滚动条 */
.scrollbar-thin::-webkit-scrollbar { height: 3px; }
.scrollbar-thin::-webkit-scrollbar-thumb { background: var(--lt-border); border-radius: 2px; }
</style>
