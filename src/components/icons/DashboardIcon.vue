<template>
  <svg
    :width="numericSize"
    :height="numericSize"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-labelledby="dash-title dash-desc"
    class="dashboard-icon"
    :class="[{ 'is-animated': animated, 'is-small': isSmall }]"
  >
    <title id="dash-title">学习总览</title>
    <desc id="dash-desc">展示学习进度和多维度数据</desc>

    <defs>
      <!-- 底板渐变 -->
      <linearGradient id="db-bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="var(--db-start, #3B82F6)" />
        <stop offset="65%" stop-color="var(--db-mid, #6B9BFF)" />
        <stop offset="100%" stop-color="var(--db-end, #1A4FCC)" />
      </linearGradient>

      <!-- 玻璃反光对角线渐变 -->
      <linearGradient id="db-glare" x1="10" y1="10" x2="70" y2="50" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="rgba(255,255,255,0.08)" />
        <stop offset="50%" stop-color="rgba(255,255,255,0.02)" />
        <stop offset="100%" stop-color="rgba(255,255,255,0)" />
      </linearGradient>

      <!-- 扫描扇面渐变 -->
      <linearGradient id="db-sweep" x1="50" y1="50" x2="100" y2="50" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="rgba(255,255,255,0.35)" />
        <stop offset="100%" stop-color="rgba(255,255,255,0)" />
      </linearGradient>

      <!-- 节点内发光 -->
      <radialGradient id="db-node-fill" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.08)" />
        <stop offset="100%" stop-color="rgba(255,255,255,0)" />
      </radialGradient>

      <!-- 焦点霓虹光晕（外层柔光） -->
      <filter id="db-neon-outer" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur5" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur2" />
        <feMerge>
          <feMergeNode in="blur5" />
          <feMergeNode in="blur2" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <!-- ====== 底板 ====== -->
    <g v-if="!isSmall">
      <rect width="100" height="100" rx="22" fill="url(#db-bg)" />
      <!-- 底部暗角 -->
      <rect x="0.5" y="0.5" width="99" height="99" rx="21.5"
        stroke="rgba(255,255,255,0.08)" stroke-width="1" />
      <!-- 玻璃反光盖板 -->
      <rect width="100" height="100" rx="22" fill="url(#db-glare)" />
    </g>

    <!-- ====== 雷达波纹 ====== -->
    <g v-if="!isSmall">
      <circle cx="50" cy="50" r="22" fill="none"
        stroke="rgba(255,255,255,0.18)" stroke-width="1.5"
        stroke-dasharray="4 4" />
      <circle cx="50" cy="50" r="38" fill="none"
        stroke="rgba(255,255,255,0.1)" stroke-width="1.5"
        stroke-dasharray="2 6" />
      <!-- 十字准星 -->
      <line x1="50" y1="14" x2="50" y2="86"
        stroke="rgba(255,255,255,0.04)" stroke-width="1" />
      <line x1="14" y1="50" x2="86" y2="50"
        stroke="rgba(255,255,255,0.04)" stroke-width="1" />
    </g>

    <!-- ====== 雷达扫描扇面 ====== -->
    <g class="radar-sweep sweep-group" :class="{ 'is-scanning': animated }">
      <path class="sweep-fill" d="M50 50 L50 12 A38 38 0 0 1 88 50 Z" fill="url(#db-sweep)" />
      <line class="sweep-line" x1="50" y1="50" x2="50" y2="12"
        stroke="var(--db-sweep-line, rgba(255,255,255,0.8))"
        stroke-width="2.5" stroke-linecap="round" />
    </g>

    <!-- ====== 指标节点 ====== -->
    <g v-if="!isSmall">
      <rect x="22" y="22" width="10" height="10" rx="2.5"
        fill="url(#db-node-fill)"
        stroke="rgba(255,255,255,0.6)" stroke-width="1.5" />
      <rect x="68" y="26" width="8" height="8" rx="2"
        fill="url(#db-node-fill)"
        stroke="rgba(255,255,255,0.4)" stroke-width="1.5" />
      <rect x="28" y="66" width="9" height="9" rx="2"
        fill="url(#db-node-fill)"
        stroke="rgba(255,255,255,0.35)" stroke-width="1.5" />
      <rect x="64" y="64" width="12" height="12" rx="3"
        fill="url(#db-node-fill)"
        stroke="rgba(255,255,255,0.5)" stroke-width="1.5" />
    </g>

    <!-- ====== 核心薄弱点（霓虹发光节点） ====== -->
    <g class="focus-node" :class="{ 'is-pulsing': animated }">
      <!-- 外层光晕 -->
      <rect x="38" y="38" width="24" height="24" rx="6"
        :fill="highlightColor" opacity="0.18"
        filter="url(#db-neon-outer)" />
      <!-- 内层发光环 -->
      <rect x="41" y="41" width="18" height="18" rx="4.5"
        fill="none"
        :stroke="highlightColor"
        stroke-width="1.5" stroke-opacity="0.5" />
      <!-- 核心实心 -->
      <rect x="43.5" y="43.5" width="13" height="13" rx="3.5"
        :fill="highlightColor" />
      <!-- 中心亮白点 -->
      <rect x="47.5" y="47.5" width="5" height="5" rx="1.5"
        fill="rgba(255,255,255,0.7)" />
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  size?: number | string
  animated?: boolean
  highlightColor?: string
}>(), {
  size: 64,
  animated: true,
  highlightColor: '#F59E0B',
})

const numericSize = computed(() => parseInt(String(props.size), 10))
const isSmall = computed(() => numericSize.value < 32)
</script>

<style>
@keyframes d-scan {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes d-pulse {
  0%   { transform: scale(1);     opacity: 1; }
  50%  { transform: scale(1.08);  opacity: 0.85; }
  100% { transform: scale(1);     opacity: 1; }
}
</style>

<style scoped>
.dashboard-icon {
  display: inline-block;
  vertical-align: middle;
  cursor: pointer;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.dashboard-icon:hover {
  transform: translateY(-2px) scale(1.03);
}

/* hover：扫描光线更亮更粗 */
.dashboard-icon:hover .sweep-fill {
  opacity: 1;
}
.dashboard-icon:hover .sweep-line {
  stroke: rgba(255,255,255,1);
  stroke-width: 3.5;
  filter: drop-shadow(0 0 4px rgba(255,255,255,0.8));
}
.sweep-fill {
  transition: opacity 0.25s ease;
}
.sweep-line {
  transition: stroke 0.25s ease, stroke-width 0.25s ease, filter 0.25s ease;
}

.radar-sweep,
.focus-node {
  transform-origin: 50px 50px;
}
.is-scanning {
  animation: d-scan 3.5s linear infinite;
}
.is-pulsing {
  animation: d-pulse 2s ease-in-out infinite;
}
.dashboard-icon.is-small {
  --db-sweep-line: currentColor;
}
</style>
