<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import type { VisualRenderType } from '@/types/smart'
import VisualPlaceholder from './VisualPlaceholder.vue'
import MindmapViewer from '@/components/MindmapViewer.vue'

const props = defineProps<{
  renderType: VisualRenderType
  code: string
  description?: string
  /** 生成状态：pending 时显示占位动画，ready 或缺省时渲染实际内容 */
  status?: 'pending' | 'ready'
}>()

const chartCanvas = ref<HTMLCanvasElement | null>(null)
const mermaidContainer = ref<HTMLDivElement | null>(null)
let chartInstance: any = null

// ========== 全屏放大 ==========
const isExpanded = ref(false)

function openExpanded() {
  isExpanded.value = true
  document.body.style.overflow = 'hidden'
}

function closeExpanded() {
  isExpanded.value = false
  document.body.style.overflow = ''
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isExpanded.value) closeExpanded()
}

onMounted(() => {
  if (props.status !== 'pending') {
    renderContent()
  }
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})

watch(() => props.code, () => {
  if (props.status !== 'pending') {
    renderContent()
  }
})

watch(() => props.status, async (newStatus) => {
  if (newStatus !== 'pending') {
    await nextTick()
    renderContent()
  }
})

async function renderContent() {
  await nextTick()
  switch (props.renderType) {
    case 'svg':
      // SVG 通过 v-html 内联渲染，无需额外处理
      break
    case 'chartjs':
      await renderChart()
      break
    case 'mermaid':
      await renderMermaid()
      break
    case 'html':
      // HTML 通过 iframe srcdoc 渲染，无需额外处理
      break
    case 'image':
      // Image 通过 img src 渲染，无需额外处理
      break
    case 'mindmap':
      // MindmapViewer 自行处理渲染，无需额外处理
      break
  }
}

async function renderChart() {
  if (!chartCanvas.value) return
  try {
    // 动态导入 Chart.js
    const ChartModule = await import('chart.js/auto')
    const Chart = ChartModule.default
    // 销毁旧实例
    if (chartInstance) {
      chartInstance.destroy()
    }
    const config = JSON.parse(props.code)
    chartInstance = new Chart(chartCanvas.value, config)
  } catch (e) {
    console.error('Chart render failed:', e)
  }
}

async function renderMermaid() {
  if (!mermaidContainer.value) return
  try {
    // 动态导入 mermaid
    const mermaidModule = await import('mermaid')
    const mermaid = mermaidModule.default
    mermaid.initialize({ startOnLoad: false, theme: 'default' })
    const id = `mermaid-${Date.now()}`
    const { svg } = await mermaid.render(id, props.code)
    mermaidContainer.value.innerHTML = svg
  } catch (e) {
    console.error('Mermaid render failed:', e)
    if (mermaidContainer.value) {
      mermaidContainer.value.textContent = '图表渲染失败: ' + (e as Error).message
    }
  }
}
</script>

<template>
  <div class="smart-visual">
    <!-- 占位动画：生成中 -->
    <VisualPlaceholder v-if="status === 'pending'" :render-type="renderType" />

    <template v-else>
      <!-- SVG：内联渲染，继承主题 -->
      <div v-if="renderType === 'svg'" class="lt-svg-root svg-container" v-html="code"></div>

      <!-- Chart.js：canvas 渲染 -->
      <div v-else-if="renderType === 'chartjs'" class="chart-container">
        <canvas ref="chartCanvas"></canvas>
      </div>

      <!-- Mermaid：DSL 渲染 -->
      <div v-else-if="renderType === 'mermaid'" ref="mermaidContainer" class="mermaid-container"></div>

      <!-- HTML：iframe 沙箱渲染 -->
      <div v-else-if="renderType === 'html'" class="html-wrapper">
        <iframe
          :srcdoc="code"
          sandbox="allow-scripts"
          class="html-iframe"
        ></iframe>
        <!-- 悬停放大按钮：位于右上角边框区域，不遮住内容 -->
        <button class="expand-btn" title="放大查看" @click="openExpanded">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 3h6v6"/><path d="M9 21H3v-6"/>
            <path d="M21 3l-7 7"/><path d="M3 21l7-7"/>
          </svg>
        </button>
      </div>

      <!-- Image：图片渲染 -->
      <div v-else-if="renderType === 'image'" class="image-container">
        <img :src="`data:image/png;base64,${code}`" alt="AI 生成图片" />
      </div>

      <!-- 思维导图：markmap 渲染 JSON 树形数据 -->
      <div v-else-if="renderType === 'mindmap'" class="mindmap-container">
        <MindmapViewer :content="code" :is-json="true" />
      </div>

      <!-- 3D 模型：占位提示（three.js 渲染器尚未集成） -->
      <div v-else-if="renderType === 'model'" class="model-container">
        <p class="model-hint">3D 模型渲染器即将上线</p>
      </div>
    </template>
  </div>

  <!-- 全屏放大弹窗 -->
  <Teleport to="body">
    <Transition name="visual-expand">
      <div v-if="isExpanded" class="expand-backdrop" @click.self="closeExpanded">
        <div class="expand-container">
          <button class="expand-close" title="关闭 (ESC)" @click="closeExpanded">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <iframe :srcdoc="code" sandbox="allow-scripts" class="expand-iframe"></iframe>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.smart-visual {
  margin: 12px 0;
  border-radius: 12px;
  overflow: hidden;
  background: var(--lt-bg-card, #fff);
  border: 1px solid var(--lt-border, #e5e7eb);
}

.visual-desc {
  padding: 6px 12px;
  font-size: 12px;
  color: var(--lt-text-auxiliary, #6b7280);
  background: var(--lt-bg-page, #f9fafb);
  border-bottom: 1px solid var(--lt-border, #e5e7eb);
}

.svg-container {
  padding: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
}
.svg-container :deep(svg) {
  max-width: 100%;
  height: auto;
}

.chart-container {
  padding: 12px;
  max-height: 400px;
}

.mermaid-container {
  padding: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
}
.mermaid-container :deep(svg) {
  max-width: 100%;
  height: auto;
}

.html-wrapper {
  position: relative;
}

.html-iframe {
  width: 100%;
  min-height: 300px;
  border: none;
  border-radius: 0;
  display: block;
}

/* 悬停放大按钮：仅在 hover 时淡入，位于右上角不遮挡内容 */
.expand-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(4px);
  border: 1px solid var(--lt-border, #e5e7eb);
  border-radius: 6px;
  color: var(--lt-text-secondary, #6b7280);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease, background 0.15s ease;
  z-index: 1;
}
.html-wrapper:hover .expand-btn {
  opacity: 1;
}
.expand-btn:hover {
  background: var(--lt-brand, #3b82f6);
  color: #fff;
  border-color: var(--lt-brand, #3b82f6);
}

/* 全屏放大弹窗 */
.expand-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.expand-container {
  width: 90vw;
  height: 90vh;
  background: var(--lt-bg-card, #fff);
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.3);
}

.expand-close {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(4px);
  border: 1px solid var(--lt-border, #e5e7eb);
  border-radius: 8px;
  color: var(--lt-text-auxiliary, #6b7280);
  cursor: pointer;
  transition: all 0.15s;
}
.expand-close:hover {
  color: #fff;
  background: var(--lt-brand, #3b82f6);
  border-color: var(--lt-brand, #3b82f6);
}

.expand-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

/* 弹窗过渡动画 */
.visual-expand-enter-active { transition: opacity 200ms ease; }
.visual-expand-leave-active { transition: opacity 150ms ease; }
.visual-expand-enter-from,
.visual-expand-leave-to { opacity: 0; }

@media (max-width: 768px) {
  .expand-container { width: 96vw; height: 96vh; border-radius: 12px; }
}

.image-container {
  padding: 12px;
  display: flex;
  justify-content: center;
}
.image-container img {
  max-width: 100%;
  border-radius: 8px;
}

.model-container {
  padding: 40px 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.model-hint {
  margin: 0;
  font-size: 14px;
  color: var(--lt-text-auxiliary, #8e8ea0);
}

.mindmap-container {
  padding: 16px;
  min-height: 300px;
}
.mindmap-container :deep(.mindmap-wrapper) {
  width: 100%;
  height: 400px;
}
</style>
