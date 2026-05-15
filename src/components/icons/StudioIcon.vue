<template>
  <svg
    :width="numericSize"
    :height="numericSize"
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-labelledby="ai-icon-title ai-icon-desc"
    class="ai-resource-icon"
    :class="[
      `theme-${theme}`,
      { 'is-interactive': interactive, 'is-small': isSmall }
    ]"
    :style="cssVars"
  >
    <title id="ai-icon-title">AI 智能生成资源</title>
    <desc id="ai-icon-desc">层叠资料卡片与AI星芒，代表多智能体生成结构化学习资源</desc>

    <defs>
      <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="var(--icon-primary, #3B82F6)" />
        <stop offset="65%" stop-color="var(--icon-mid, #6B9BFF)" />
        <stop offset="83%" stop-color="var(--icon-edge, #C4B5FD)" />
        <stop offset="100%" stop-color="var(--icon-secondary, #F9A8D4)" />
      </linearGradient>

      <linearGradient id="borderHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="var(--icon-highlight, #FFFFFF)" stop-opacity="0.3" />
        <stop offset="50%" stop-color="var(--icon-highlight, #FFFFFF)" stop-opacity="0.05" />
        <stop offset="100%" stop-color="var(--icon-highlight, #FFFFFF)" stop-opacity="0.0" />
      </linearGradient>

      <linearGradient id="cardSurface" x1="12" y1="12" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="var(--icon-highlight, #FFFFFF)" stop-opacity="0.15" />
        <stop offset="100%" stop-color="var(--icon-highlight, #FFFFFF)" stop-opacity="0" />
      </linearGradient>

      <mask id="sparkCutout">
        <rect width="64" height="64" fill="white" />
        <path
          d="M 32 12 C 32 18, 28 22, 22 22 C 28 22, 32 26, 32 32 C 32 26, 36 22, 42 22 C 36 22, 32 18, 32 12 Z"
          fill="black"
          stroke="black"
          :stroke-width="isSmall ? 4 : 2.5"
          stroke-linejoin="round"
        />
      </mask>
    </defs>

    <!-- 外层容器（小尺寸下隐藏） -->
    <g v-if="!isSmall" class="icon-container">
      <rect width="64" height="64" rx="10" fill="url(#bgGradient)" />
      <rect x="0.5" y="0.5" width="63" height="63" rx="9.5" stroke="url(#borderHighlight)" stroke-width="1" />
    </g>

    <!-- 核心组合图形 -->
    <g
      class="icon-core"
      :transform="isSmall ? 'translate(32, 32) scale(1.4) translate(-32, -26)' : 'translate(0, -1)'"
    >
      <!-- 底层卡片（小尺寸下隐藏） -->
      <path
        v-if="!isSmall"
        class="card-layer card-bottom"
        d="M 12 38 L 32 48 L 52 38"
        stroke="var(--icon-lines, #FFFFFF)"
        stroke-opacity="0.25"
        stroke-width="1.2"
        stroke-linejoin="round"
        stroke-linecap="round"
      />

      <!-- 中层卡片（小尺寸下隐藏） -->
      <path
        v-if="!isSmall"
        class="card-layer card-middle"
        d="M 12 30 L 32 40 L 52 30"
        stroke="var(--icon-lines, #FFFFFF)"
        stroke-opacity="0.5"
        stroke-width="1.2"
        stroke-linejoin="round"
        stroke-linecap="round"
      />

      <!-- 顶层主卡片 -->
      <g mask="url(#sparkCutout)" class="card-top">
        <polygon points="12,22 32,32 32,12" fill="url(#cardSurface)" />
        <path
          d="M 12 22 L 32 32 L 52 22 L 32 12 Z"
          stroke="var(--icon-lines, #FFFFFF)"
          :stroke-width="isSmall ? 2.5 : 2"
          stroke-linejoin="round"
        />
      </g>

      <!-- AI 星芒系统 -->
      <g class="sparkle-system">
        <!-- 主星芒 -->
        <path
          class="sparkle-main"
          d="M 32 12 C 32 18, 28 22, 22 22 C 28 22, 32 26, 32 32 C 32 26, 36 22, 42 22 C 36 22, 32 18, 32 12 Z"
          fill="var(--icon-sparkle, #FFFFFF)"
        />

        <!-- 小星芒 1（右上角） -->
        <path
          class="sparkle-sm sparkle-1"
          d="M 46 6 C 46 9, 44 10, 42 10 C 44 10, 46 11, 46 14 C 46 11, 48 10, 50 10 C 48 10, 46 9, 46 6 Z"
          fill="var(--icon-sparkle, #FFFFFF)"
          opacity="0.9"
        />

        <!-- 小星芒 2（左下角，小尺寸下隐藏） -->
        <path
          v-if="!isSmall"
          class="sparkle-sm sparkle-2"
          d="M 14 33 C 14 35, 12.5 36, 11 36 C 12.5 36, 14 37, 14 39 C 14 37, 15.5 36, 17 36 C 15.5 36, 14 35, 14 33 Z"
          fill="var(--icon-sparkle, #FFFFFF)"
          opacity="0.7"
        />
      </g>
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  size: {
    type: [Number, String],
    default: 64,
  },
  theme: {
    type: String,
    default: 'auto',
  },
  interactive: {
    type: Boolean,
    default: true,
  },
  colorStart: String,
  colorEnd: String,
  glow: {
    type: [String, Number],
    default: '1',
  },
})

const numericSize = computed(() => parseInt(String(props.size), 10))
const isSmall = computed(() => numericSize.value < 32)

const cssVars = computed(() => {
  const vars: Record<string, string> = {}
  if (props.colorStart) vars['--icon-primary'] = props.colorStart
  if (props.colorEnd) vars['--icon-secondary'] = props.colorEnd
  if (props.glow !== undefined) vars['--icon-glow'] = String(props.glow)
  return vars
})
</script>

<style scoped>
.ai-resource-icon {
  --g: var(--icon-glow, 1);
  display: inline-block;
  vertical-align: middle;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  will-change: transform;
}

.card-layer,
.sparkle-main,
.sparkle-sm {
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
  transform-origin: center;
}

/* 卡片展开：展示资源"厚度" */
.ai-resource-icon.is-interactive:hover {
  transform: translateY(-2px);
}
.ai-resource-icon.is-interactive:hover .card-middle {
  transform: translateY(2px);
  stroke-opacity: 0.7;
}
.ai-resource-icon.is-interactive:hover .card-bottom {
  transform: translateY(4px);
  stroke-opacity: 0.4;
}

/* 星芒呼吸发光 */
.sparkle-system {
  transition: filter 0.4s ease;
}
.ai-resource-icon.is-interactive:hover .sparkle-system {
  filter: drop-shadow(0 0 6px rgba(96, 165, 250, calc(0.8 * var(--g))))
          drop-shadow(0 0 2px rgba(255, 255, 255, calc(0.9 * var(--g))));
}
.ai-resource-icon.is-interactive:hover .sparkle-main {
  transform: scale(1.05);
}
.ai-resource-icon.is-interactive:hover .sparkle-sm {
  transform: scale(1.1) rotate(5deg);
}

/* 暗黑模式 */
@media (prefers-color-scheme: dark) {
  .ai-resource-icon.theme-auto {
    --icon-lines: rgba(255, 255, 255, 0.85);
    --icon-sparkle: #F8FAFC;
  }
}
.ai-resource-icon.theme-dark {
  --icon-lines: rgba(255, 255, 255, 0.85);
  --icon-sparkle: #F8FAFC;
}

/* 小尺寸模式：单色图标，融入文本流 */
.ai-resource-icon.is-small {
  --icon-lines: currentColor;
  --icon-sparkle: currentColor;
}
</style>
