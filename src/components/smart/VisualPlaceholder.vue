<script setup lang="ts">
import type { VisualRenderType } from '@/types/smart'

defineProps<{
  renderType: VisualRenderType
}>()

const meta: Record<VisualRenderType, { label: string; icon: string }> = {
  svg:     { label: '图片正在生成中',      icon: 'svg' },
  chartjs: { label: '图表正在生成中',      icon: 'chart' },
  mermaid: { label: '流程图正在生成中',    icon: 'flow' },
  html:    { label: 'HTML 交互页面正在生成中', icon: 'code' },
  image:   { label: '图片正在生成中',      icon: 'image' },
  model:   { label: '3D 模型正在生成中',   icon: 'cube' },
  mindmap: { label: '思维导图正在生成中',  icon: 'mindmap' },
}
</script>

<template>
  <div class="visual-placeholder">
    <!-- 顶部微光扫描 -->
    <div class="shimmer-bar" />

    <div class="placeholder-inner">
      <!-- 类型图标 + 呼吸动画 -->
      <div class="icon-wrap">
        <svg v-if="meta[renderType]?.icon === 'svg'" class="type-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
        </svg>
        <svg v-else-if="meta[renderType]?.icon === 'chart'" class="type-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="4" y1="20" x2="4" y2="10" /><line x1="10" y1="20" x2="10" y2="4" /><line x1="16" y1="20" x2="16" y2="14" /><line x1="22" y1="20" x2="2" y2="20" />
        </svg>
        <svg v-else-if="meta[renderType]?.icon === 'flow'" class="type-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="6" height="6" rx="1" /><rect x="16" y="3" width="6" height="6" rx="1" /><rect x="9" y="15" width="6" height="6" rx="1" /><path d="M5 9v3a2 2 0 0 0 2 2h4" /><path d="M19 9v3a2 2 0 0 1-2 2h-4" />
        </svg>
        <svg v-else-if="meta[renderType]?.icon === 'code'" class="type-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /><line x1="14" y1="4" x2="10" y2="20" />
        </svg>
        <svg v-else-if="meta[renderType]?.icon === 'image'" class="type-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
        </svg>
        <svg v-else-if="meta[renderType]?.icon === 'cube'" class="type-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
        </svg>
        <svg v-else-if="meta[renderType]?.icon === 'mindmap'" class="type-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3" /><circle cx="5" cy="5" r="2" /><circle cx="19" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" /><line x1="10" y1="10" x2="6.5" y2="6.5" /><line x1="14" y1="10" x2="17.5" y2="6.5" /><line x1="10" y1="14" x2="6.5" y2="17.5" /><line x1="14" y1="14" x2="17.5" y2="17.5" />
        </svg>
      </div>

      <!-- 标签文字 -->
      <p class="placeholder-label">{{ meta[renderType]?.label || '内容正在生成中' }}</p>

      <!-- 跳动点 -->
      <div class="dots">
        <span class="dot" /><span class="dot" /><span class="dot" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.visual-placeholder {
  position: relative;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--lt-bg-card, #fff);
  border: 1px solid var(--lt-border, #e8ecf0);
  border-radius: 12px;
  overflow: hidden;
}

/* ── 顶部微光扫描条 ── */
.shimmer-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg,
    transparent 0%,
    var(--lt-brand-lighter, #a3c4ff) 40%,
    var(--lt-brand, #2b6fff) 50%,
    var(--lt-brand-lighter, #a3c4ff) 60%,
    transparent 100%);
  animation: shimmer-sweep 2s ease-in-out infinite;
}

@keyframes shimmer-sweep {
  0%   { transform: translateX(-100%); opacity: 0.3; }
  50%  { opacity: 1; }
  100% { transform: translateX(100%); opacity: 0.3; }
}

/* ── 中心内容 ── */
.placeholder-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 32px 24px;
}

/* ── 图标呼吸 ── */
.icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--lt-brand-lightest, #e8f0fe);
  color: var(--lt-brand, #2b6fff);
}

.type-icon {
  animation: icon-breathe 1.6s ease-in-out infinite;
}

@keyframes icon-breathe {
  0%, 100% { transform: scale(1);    opacity: 0.65; }
  50%      { transform: scale(1.12); opacity: 1; }
}

/* ── 标签文字 ── */
.placeholder-label {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--lt-text-secondary, #5a5a72);
  letter-spacing: 0.2px;
}

/* ── 跳动点 ── */
.dots {
  display: flex;
  gap: 6px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lt-brand, #2b6fff);
  animation: dot-bounce 1.2s ease-in-out infinite;
}
.dot:nth-child(2) { animation-delay: 0.15s; }
.dot:nth-child(3) { animation-delay: 0.3s; }

@keyframes dot-bounce {
  0%, 80%, 100% { transform: translateY(0);     opacity: 0.35; }
  40%           { transform: translateY(-5px);  opacity: 1; }
}

/* ── 减少动画偏好 ── */
@media (prefers-reduced-motion: reduce) {
  .shimmer-bar { animation: none; opacity: 0.5; }
  .type-icon   { animation: none; opacity: 0.8; }
  .dot         { animation: none; opacity: 0.6; }
}
</style>
