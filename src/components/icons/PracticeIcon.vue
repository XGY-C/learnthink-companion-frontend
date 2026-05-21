<template>
  <svg
    :width="numericSize"
    :height="numericSize"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    :aria-labelledby="`p-title-${uid}`"
    class="practice-icon"
    :class="[{ 'is-small': isSmall }]"
  >
    <title :id="`p-title-${uid}`">{{ statusText.title }}</title>
    <desc>{{ statusText.desc }}</desc>

    <defs>
      <linearGradient id="p-bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="var(--p-start, #3B82F6)" />
        <stop offset="65%" stop-color="var(--p-mid, #6B9BFF)" />
        <stop offset="100%" stop-color="var(--p-end, #1A4FCC)" />
      </linearGradient>

      <linearGradient id="p-glare" x1="10" y1="10" x2="70" y2="50" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="rgba(255,255,255,0.08)" />
        <stop offset="50%" stop-color="rgba(255,255,255,0.02)" />
        <stop offset="100%" stop-color="rgba(255,255,255,0)" />
      </linearGradient>

      <filter id="p-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <!-- 右上角浅橙暖色点 -->
      <radialGradient id="p-warm" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FFB380" stop-opacity="0.18" />
        <stop offset="100%" stop-color="#FFB380" stop-opacity="0" />
      </radialGradient>

      <radialGradient id="p-mark-aura" cx="50%" cy="50%" r="50%">
        <stop offset="0%" :stop-color="markColor" stop-opacity="0.25" />
        <stop offset="100%" :stop-color="markColor" stop-opacity="0" />
      </radialGradient>
    </defs>

    <!-- ====== 底板 ====== -->
    <g v-if="!isSmall">
      <rect width="100" height="100" rx="22" fill="url(#p-bg)" />
      <rect x="0.5" y="0.5" width="99" height="99" rx="21.5"
        stroke="rgba(255,255,255,0.08)" stroke-width="1" />
      <rect width="100" height="100" rx="22" fill="url(#p-glare)" />
      <!-- 右上角浅橙暖色点缀 -->
      <circle cx="82" cy="18" r="24" fill="url(#p-warm)" />
    </g>

    <!-- ====== 3×3 选项网格 ====== -->
    <g v-if="!isSmall">
      <!-- 答题卡底板 -->
      <rect x="16" y="16" width="68" height="68" rx="6"
        fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
      <!-- 选项方块 -->
      <rect
        v-for="(pos, i) in grid"
        :key="i"
        :x="pos.x" :y="pos.y"
        width="14" height="14" rx="3"
        :fill="pos.highlight ? highlightColor : 'rgba(255,255,255,0.1)'"
        :stroke="pos.highlight ? highlightColor : 'rgba(255,255,255,0.4)'"
        stroke-width="2"
        :filter="pos.highlight ? 'url(#p-glow)' : undefined"
        :class="{ 'cell-pulse': pos.highlight && animated }"
      />
    </g>
    <!-- 小尺寸：只留中心方块 -->
    <rect
      v-else
      x="38" y="38" width="24" height="24" rx="6"
      :fill="highlightColor"
      filter="url(#p-glow)"
      :class="{ 'cell-pulse': animated }"
    />

    <!-- ====== 批改标记 ====== -->
    <circle cx="78" cy="78" r="20" fill="url(#p-mark-aura)" class="mark-aura" />
    <g v-if="status !== 'incorrect'" class="mark-group">
      <path
        class="check-path"
        d="M 70 78 L 76 84 L 88 72"
        :stroke="markColor"
        stroke-width="5"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
    </g>
    <!-- 叉号 -->
    <g v-else class="mark-group">
      <line x1="71" y1="73" x2="85" y2="85"
        :stroke="markColor" stroke-width="5" stroke-linecap="round" />
      <line x1="85" y1="73" x2="71" y2="85"
        :stroke="markColor" stroke-width="5" stroke-linecap="round" />
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(defineProps<{
  size?: number | string
  status?: 'idle' | 'correct' | 'incorrect'
  animated?: boolean
  highlightColor?: string
  markColor?: string
}>(), {
  size: 64,
  status: 'idle',
  animated: true,
  highlightColor: '#FFFFFF',
  markColor: '#FFFFFF',
})

const uid = useId()
const numericSize = computed(() => parseInt(String(props.size), 10))
const isSmall = computed(() => numericSize.value < 32)

const grid = computed(() => {
  const cells = []
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      cells.push({
        x: 20 + col * 22,
        y: 20 + row * 22,
        highlight: row === 1 && col === 1,
      })
    }
  }
  return cells
})

const statusText = computed(() => {
  switch (props.status) {
    case 'correct': return { title: '练习完成', desc: '答题卡表示题目已正确回答' }
    case 'incorrect': return { title: '练习有误', desc: '答题卡表示题目回答错误' }
    default: return { title: '定制练习', desc: '答题卡与对勾表示个性化练习与批改' }
  }
})
</script>

<style>
@keyframes pi-cell {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.85; }
}
@keyframes pi-draw {
  to { stroke-dashoffset: 0; }
}
@keyframes pi-redraw {
  from { stroke-dashoffset: 65; }
  to   { stroke-dashoffset: 0; }
}
@keyframes pi-pop {
  0% { transform: scale(0) rotate(-30deg); opacity: 0; }
  70% { transform: scale(1.15) rotate(2deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
</style>

<style scoped>
.practice-icon {
  display: inline-block;
  vertical-align: middle;
  cursor: pointer;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.practice-icon:hover {
  transform: translateY(-2px) scale(1.03);
}

/* hover：对勾更亮 */
.practice-icon:hover .mark-aura {
  transform: scale(1.3);
  opacity: 0.8;
}
.practice-icon:hover .mark-group {
  filter: drop-shadow(0 0 6px rgba(255,255,255,0.9));
  transform: scale(1.1);
}
.mark-aura {
  transition: transform 0.3s ease, opacity 0.3s ease;
  transform-origin: 78px 78px;
}
.mark-group {
  transition: transform 0.3s ease, filter 0.3s ease;
  transform-origin: 78px 78px;
}

.cell-pulse {
  animation: pi-cell 1.5s ease-in-out infinite;
  transform-origin: center;
}

/* 小尺寸：单色融入文本流 */
.practice-icon.is-small {
  color: currentColor;
}

/* 对勾默认已画出 */
.check-path {
  stroke-dasharray: 65;
  stroke-dashoffset: 0;
}

/* hover：对勾重新描边 */
.practice-icon:hover .check-path {
  animation: pi-redraw 0.5s cubic-bezier(0.65, 0, 0.35, 1) forwards;
}

/* 批改标记弹入 */
.mark-group {
  animation: pi-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  transform-origin: 78px 78px;
}
</style>
