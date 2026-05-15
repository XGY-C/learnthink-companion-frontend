<template>
  <svg
    :width="numericSize"
    :height="numericSize"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    :aria-labelledby="`path-title-${uid}`"
    class="path-icon"
    :class="[{ 'is-small': isSmall }]"
  >
    <title :id="`path-title-${uid}`">学习路径</title>
    <desc>个性化学习路径：从起点经里程碑节点到达目标终点</desc>

    <defs>
      <!-- 底板渐变 -->
      <linearGradient id="pth-bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="var(--pth-start, #3B82F6)" />
        <stop offset="65%" stop-color="var(--pth-mid, #6B9BFF)" />
        <stop offset="100%" stop-color="var(--pth-end, #1A4FCC)" />
      </linearGradient>

      <!-- 玻璃反光 -->
      <linearGradient id="pth-glare" x1="10" y1="10" x2="70" y2="50" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="rgba(255,255,255,0.08)" />
        <stop offset="50%" stop-color="rgba(255,255,255,0.02)" />
        <stop offset="100%" stop-color="rgba(255,255,255,0)" />
      </linearGradient>

      <!-- 路径主线：纯白到金黄 -->
      <linearGradient id="pth-line" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#FFFFFF" />
        <stop offset="85%" stop-color="#FFFFFF" />
        <stop offset="100%" stop-color="#FFD166" />
      </linearGradient>

      <!-- 星标多层发光 -->
      <filter id="pth-star-outer" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur4" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur1" />
        <feMerge>
          <feMergeNode in="blur4" />
          <feMergeNode in="blur1" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <!-- 节点发光 -->
      <filter id="pth-node-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <!-- 光晕径向渐变 -->
      <radialGradient id="pth-star-aura" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FFD166" stop-opacity="0.5" />
        <stop offset="50%" stop-color="#FFD166" stop-opacity="0.15" />
        <stop offset="100%" stop-color="#FFD166" stop-opacity="0" />
      </radialGradient>

      <radialGradient id="pth-node-aura" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.2)" />
        <stop offset="100%" stop-color="rgba(255,255,255,0)" />
      </radialGradient>
    </defs>

    <!-- ====== 底板 ====== -->
    <g v-if="!isSmall">
      <rect width="100" height="100" rx="22" fill="url(#pth-bg)" />
      <rect x="0.5" y="0.5" width="99" height="99" rx="21.5"
        stroke="rgba(255,255,255,0.1)" stroke-width="1.5" />
      <rect width="100" height="100" rx="22" fill="url(#pth-glare)" />
    </g>

    <!-- ====== 曲线路径 ====== -->
    <g v-if="!isSmall">
      <!-- 外光晕 -->
      <path
        d="M 22 78 C 60 78, 40 50, 55 42 C 68 35, 58 18, 78 16"
        fill="none" stroke="rgba(255,255,255,0.22)"
        stroke-width="16" stroke-linecap="round"
      />
      <!-- 底色轨迹 -->
      <path
        d="M 22 78 C 60 78, 40 50, 55 42 C 68 35, 58 18, 78 16"
        fill="none" stroke="rgba(255,255,255,0.45)"
        stroke-width="8" stroke-linecap="round"
      />
      <!-- 发光主线 -->
      <path
        class="path-main"
        d="M 22 78 C 60 78, 40 50, 55 42 C 68 35, 58 18, 78 16"
        fill="none" stroke="url(#pth-line)"
        stroke-width="4" stroke-linecap="round"
        :class="{ 'path-flow': animated }"
      />
      <!-- 流动光点 ✕ 2 -->
      <circle
        v-if="animated"
        class="flow-dot"
        r="3" fill="#FFFFFF"
        filter="url(#pth-node-glow)"
      />
      <circle
        v-if="animated"
        class="flow-dot flow-dot-2"
        r="2" fill="#FFFFFF"
        filter="url(#pth-node-glow)"
      />
    </g>
    <!-- 小尺寸简化路径 -->
    <path
      v-else
      d="M 18 82 C 50 82, 45 40, 78 18"
      fill="none" stroke="currentColor"
      stroke-width="3" stroke-linecap="round"
      opacity="0.6"
    />

    <!-- ====== 节点 1：起点 ====== -->
    <g v-if="!isSmall">
      <circle cx="22" cy="78" r="12" fill="url(#pth-node-aura)" />
      <circle cx="22" cy="78" r="8"
        fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"
        :class="{ 'ring-pulse': animated }" />
      <circle cx="22" cy="78" r="4.5"
        fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.9)"
        stroke-width="2" filter="url(#pth-node-glow)" />
    </g>
    <circle v-else cx="18" cy="82" r="5"
      fill="currentColor" opacity="0.8" />

    <!-- ====== 节点 2：里程碑 ====== -->
    <g v-if="!isSmall">
      <circle cx="55" cy="42" r="10" fill="url(#pth-node-aura)" />
      <circle cx="55" cy="42" r="6"
        fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"
        :class="{ 'ring-pulse': animated }" style="animation-delay: -0.3s" />
      <circle cx="55" cy="42" r="3.5"
        fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.8)"
        stroke-width="2" filter="url(#pth-node-glow)" />
    </g>

    <!-- ====== 节点 3：终点星标 ====== -->
    <circle cx="78" cy="16" r="20" fill="url(#pth-star-aura)"
      :class="{ 'aura-pulse': animated }"
      class="star-aura" />
    <g filter="url(#pth-star-outer)" :class="{ 'star-float': animated }"
      class="star-body">
      <path
        d="M 78 1 L 81 11 L 91 14 L 81 17 L 78 27 L 75 17 L 65 14 L 75 11 Z"
        fill="#FFD166"
      />
      <circle cx="78" cy="14" r="2.5" fill="#FFFFFF" />
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(defineProps<{
  size?: number | string
  animated?: boolean
}>(), {
  size: 64,
  animated: true,
})

const uid = useId()
const numericSize = computed(() => parseInt(String(props.size), 10))
const isSmall = computed(() => numericSize.value < 32)
</script>

<style>
@keyframes pth-flow {
  to { stroke-dashoffset: -200; }
}
@keyframes pth-star-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2.5px); }
}
@keyframes pth-ring-expand {
  0% { transform: scale(0.6); opacity: 0.5; }
  100% { transform: scale(1.6); opacity: 0; }
}
@keyframes pth-aura-breathe {
  0%, 100% { r: 14; opacity: 0.6; }
  50% { r: 18; opacity: 0.9; }
}
@keyframes pth-dot-flow {
  0% { offset-distance: 0%; opacity: 1; }
  70% { opacity: 1; }
  100% { offset-distance: 100%; opacity: 0; }
}
.flow-dot {
  offset-path: path("M 22 78 C 60 78, 40 50, 55 42 C 68 35, 58 18, 78 16");
  animation: pth-dot-flow 2.5s linear infinite;
}
.flow-dot-2 {
  animation-delay: -1.25s;
}
</style>

<style scoped>
.path-icon {
  display: inline-block;
  vertical-align: middle;
  cursor: pointer;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.path-icon:hover {
  transform: translateY(-2px) scale(1.03);
}

/* 流线动画 */
.path-flow {
  stroke-dasharray: 20 120;
  animation: pth-flow 2.5s linear infinite;
}

/* 节点波纹 */
.ring-pulse {
  animation: pth-ring-expand 1.2s ease-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}

/* 星标浮动 */
.star-float {
  animation: pth-star-float 2.5s ease-in-out infinite;
  transform-origin: 78px 13px;
}

/* 星标光晕呼吸 */
.aura-pulse {
  animation: pth-aura-breathe 2.5s ease-in-out infinite;
}

/* hover：星标更亮 */
.path-icon:hover .star-aura {
  transform: scale(1.35);
  opacity: 0.85;
}
.path-icon:hover .star-body {
  filter: drop-shadow(0 0 8px rgba(255,209,102,0.9))
          drop-shadow(0 0 2px rgba(255,255,255,1));
  transform: scale(1.15);
}
.star-aura {
  transition: transform 0.35s ease, opacity 0.35s ease;
  transform-origin: 78px 16px;
}
.star-body {
  transition: transform 0.35s ease, filter 0.35s ease;
  transform-origin: 78px 14px;
}

.path-icon.is-small {
  color: currentColor;
}
</style>
