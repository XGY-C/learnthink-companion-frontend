<script setup lang="ts">
import { computed } from 'vue'
import DOMPurify from 'dompurify'
import type { DiagramState } from '@/types/tutoring'

const props = defineProps<{
  diagram: DiagramState | null
  sectionId: string
}>()

const emit = defineEmits<{
  retry: [diagramId: string]
  viewFullscreen: [diagram: DiagramState]
}>()

const showSkeleton = computed(() =>
  props.diagram?.status === 'pending' || props.diagram?.status === 'generating'
)

const skeletonText = computed(() =>
  props.diagram?.status === 'pending' ? '图解准备中...' : '图解生成中...'
)

const isDone = computed(() => props.diagram?.status === 'done')
const isDegraded = computed(() => props.diagram?.status === 'degraded')

const sanitizedSvg = computed(() => {
  if (!isDone.value || props.diagram?.tool !== 'svg_direct') return ''
  const svg = props.diagram?.content || ''
  if (!svg) return ''
  return DOMPurify.sanitize(svg, {
    ADD_TAGS: ['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'text', 'g', 'defs', 'use', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'marker'],
    ADD_ATTR: ['d', 'cx', 'cy', 'r', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'viewBox', 'fill', 'stroke', 'stroke-width', 'transform', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'opacity', 'clip-path', 'mask', 'id', 'href', 'style', 'class', 'rx', 'ry', 'marker-end', 'marker-start', 'refX', 'refY', 'markerWidth', 'markerHeight', 'orient', 'points'],
  })
})

function handleRetry() {
  if (props.diagram?.diagramId) {
    emit('retry', props.diagram.diagramId)
  }
}
</script>

<template>
  <div v-if="diagram" class="diagram-slot">
    <!-- 骨架屏 -->
    <div v-if="showSkeleton" class="diagram-skeleton">
      <div class="skeleton-icon">⟳</div>
      <p class="skeleton-text">{{ skeletonText }}</p>
      <div class="skeleton-bar"></div>
      <div class="skeleton-bar short"></div>
    </div>

    <!-- 就绪 -->
    <div v-else-if="isDone" class="diagram-ready">
      <div class="diagram-title">{{ diagram.spec?.description || '图解' }}</div>
      <div class="diagram-body">
        <img
          v-if="diagram.tool === 'image_model' && diagram.url"
          :src="diagram.url"
          :alt="diagram.spec?.description"
          :width="diagram.width"
          :height="diagram.height"
          class="diagram-img"
          loading="lazy"
        />
        <div v-else-if="diagram.tool === 'svg_direct' && diagram.content" v-html="sanitizedSvg" class="diagram-svg" />
        <div v-else-if="diagram.tool === 'mermaid'" class="diagram-mermaid">
          <pre class="mermaid-source">{{ diagram.content || diagram.spec?.description || 'Mermaid 图解' }}</pre>
        </div>
        <div v-else-if="diagram.tool === 'math_render'" class="diagram-math">
          {{ diagram.spec?.description || '数学公式' }}
        </div>
      </div>
      <div class="diagram-toolbar">
        <button class="diagram-tool-btn" @click="emit('viewFullscreen', diagram)">🔍 全屏查看</button>
      </div>
    </div>

    <!-- 降级 -->
    <div v-else-if="isDegraded" class="diagram-degraded">
      <div class="degraded-header">
        <span>⚠️ 图解生成失败，已用文字替代</span>
      </div>
      <div v-if="diagram.fallbackText" class="degraded-content" v-text="diagram.fallbackText" />
      <button class="diagram-retry-btn" @click="handleRetry">🔄 重试图解</button>
    </div>
  </div>
</template>

<style scoped>
.diagram-slot { margin-top: 18px; }

.diagram-skeleton {
  background: #F3F4F6;
  border-radius: 12px;
  padding: 32px 24px;
  text-align: center;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}
.skeleton-icon { font-size: 28px; margin-bottom: 8px; }
.skeleton-text { font-size: 13px; color: var(--lt-text-secondary); margin-bottom: 16px; }
.skeleton-bar {
  height: 12px;
  background: #E5E7EB;
  border-radius: 6px;
  margin: 0 auto 8px;
  width: 70%;
}
.skeleton-bar.short { width: 40%; }
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.diagram-ready {
  border: 1px solid var(--lt-border);
  border-radius: 12px;
  overflow: hidden;
  animation: diagram-enter 300ms ease;
}
@keyframes diagram-enter {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
.diagram-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--lt-text-secondary);
  padding: 10px 16px;
  background: var(--lt-bg-page);
  border-bottom: 1px solid var(--lt-border);
}
.diagram-body { padding: 16px; display: flex; justify-content: center; }
.diagram-img { max-width: 100%; height: auto; border-radius: 6px; }
.diagram-svg { max-width: 100%; overflow-x: auto; }
.diagram-svg :deep(svg) { max-width: 100%; height: auto; }
.diagram-mermaid, .diagram-math {
  padding: 24px;
  color: var(--lt-text-secondary);
  font-size: 14px;
}
.mermaid-source {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  white-space: pre-wrap;
  text-align: left;
}
.diagram-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  border-top: 1px solid var(--lt-border);
}
.diagram-tool-btn {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.15s;
}
.diagram-tool-btn:hover {
  color: var(--lt-brand);
  background: var(--lt-brand-lightest);
}

.diagram-degraded {
  border: 1px solid var(--lt-warning);
  border-radius: 12px;
  padding: 16px;
  background: var(--lt-orange-light-9);
}
.degraded-header {
  font-size: 13px;
  color: var(--lt-warning);
  margin-bottom: 8px;
}
.degraded-content {
  font-size: 13px;
  color: var(--lt-text-secondary);
  line-height: 1.6;
  padding: 8px;
  background: var(--lt-bg-card);
  border-radius: 6px;
  margin-bottom: 12px;
}
.diagram-retry-btn {
  font-size: 12px;
  color: var(--lt-brand);
  background: none;
  border: 1px solid var(--lt-brand);
  border-radius: 6px;
  padding: 4px 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.diagram-retry-btn:hover {
  background: var(--lt-brand-lightest);
}

@media (max-width: 768px) {
  .diagram-ready .diagram-body { padding: 8px; }
  .diagram-img { max-width: 100%; height: auto; }
  .diagram-skeleton { padding: 20px 16px; }
}
</style>
