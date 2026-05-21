<template>
  <div class="mindmap-wrapper">
    <div ref="containerRef" class="mindmap-container"></div>
    <div v-if="error" class="flex items-center justify-center h-full min-h-[300px] text-slate-400 bg-slate-50 rounded-lg">
      <div class="text-center">
        <svg class="mx-auto mb-2 w-8 h-8 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <p class="text-sm">思维导图渲染失败</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { Transformer } from 'markmap-lib'
import { Markmap } from 'markmap-view'

const props = withDefaults(defineProps<{
  content: string
  isJson?: boolean
}>(), {
  isJson: false
})

const containerRef = ref<HTMLElement | null>(null)
const error = ref(false)
const MIN_SCALE = 0.45

let mmInstance: Markmap | null = null

function normalizeNode(node: any): any {
  if (!node || typeof node !== 'object') return node
  return {
    content: node.content || node.text || node.name || '',
    children: Array.isArray(node.children) ? node.children.map(normalizeNode) : [],
  }
}

function stripMarkdownFences(raw: string): string {
  let s = raw.trim()
  if (s.startsWith('```')) {
    s = s.replace(/^```[a-z]*\s*/, '')
    s = s.replace(/\s*```$/, '')
  }
  return s
}

function getCurrentScale(): number {
  if (!containerRef.value) return 1
  const g = containerRef.value.querySelector('svg > g')
  if (!g) return 1
  const transform = g.getAttribute('transform') || ''
  const match = transform.match(/scale\(([\d.]+)\)/)
  return match ? parseFloat(match[1]) : 1
}

function ensureMinScale() {
  const scale = getCurrentScale()
  if (scale < MIN_SCALE && mmInstance) {
    mmInstance.rescale(MIN_SCALE)
  }
}

function destroyInstance() {
  if (mmInstance) {
    try { mmInstance.destroy() } catch (_) { /* already removed */ }
    mmInstance = null
  }
}

const renderMindmap = async () => {
  if (!containerRef.value) return

  destroyInstance()
  containerRef.value.innerHTML = ''
  error.value = false

  try {
    let data: any

    if (props.isJson) {
      const cleaned = stripMarkdownFences(props.content || '')
      data = JSON.parse(cleaned)
      if (data.root) data = data.root
      data = normalizeNode(data)
    } else {
      const transformer = new Transformer()
      const { root } = transformer.transform(props.content || '')
      data = root
    }

    await nextTick()

    // Markmap.create 需要一个 SVG 元素，而不是 div 容器
    let svgEl = containerRef.value.querySelector('svg.markmap-svg')
    if (!svgEl) {
      svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svgEl.classList.add('markmap-svg')
      svgEl.setAttribute('width', '100%')
      svgEl.setAttribute('height', '100%')
      containerRef.value.appendChild(svgEl)
    }

    mmInstance = Markmap.create(svgEl, {
      zoom: true,
      pan: true,
      autoFit: true,
      fitRatio: 0.9,
      maxWidth: 280,
      nodeMinHeight: 26,
      spacingVertical: 12,
      spacingHorizontal: 65,
      duration: 300,
      maxInitialScale: 2,
      style: (_id: string) => `
        .markmap-foreign { font-size: 14px; line-height: 1.6; }
        .markmap-foreign p { margin: 0; font-weight: 400; }
        .markmap-foreign strong { font-weight: 600; }
      `
    })
    await nextTick()
    mmInstance.setData(data)
    await nextTick()
    mmInstance.fit()
    await nextTick()
    ensureMinScale()

  } catch (err) {
    console.error('Mindmap rendering error:', err)
    destroyInstance()
    if (containerRef.value) containerRef.value.innerHTML = ''
    error.value = true
  }
}

watch(() => props.content, () => { renderMindmap() })
onMounted(() => { renderMindmap() })
onUnmounted(() => { destroyInstance() })

function getSvgEl(): SVGSVGElement | null {
  if (!containerRef.value) return null
  return containerRef.value.querySelector('svg.markmap-svg')
}

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

/**
 * 将 SVG 中的 foreignObject 转换为 <text> 元素，确保导出后文本可见。
 * foreignObject 在独立 SVG 文件 / canvas 绘图中可能不被渲染。
 */
function convertForeignObjectsToText(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement

  // 确保根元素命名空间
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  const foreignObjects = clone.querySelectorAll('foreignObject')
  foreignObjects.forEach((fo) => {
    // 提取嵌套的文本内容
    const innerDiv = fo.querySelector('div')
    const text = innerDiv?.textContent?.trim() || ''
    if (!text) return

    const ns = 'http://www.w3.org/2000/svg'
    const textEl = document.createElementNS(ns, 'text')
    textEl.textContent = text

    // 继承 foreignObject 的位置属性
    const x = fo.getAttribute('x')
    const y = fo.getAttribute('y')
    const height = fo.getAttribute('height')

    if (x) textEl.setAttribute('x', String(Number(x) + 8)) // padding
    // y 需要调整：foreignObject 的 y 是顶部，text 的 y 是基线
    if (y && height) {
      textEl.setAttribute('y', String(Number(y) + Number(height) * 0.72))
    } else if (y) {
      textEl.setAttribute('y', String(Number(y) + 16))
    }

    // 继承样式
    textEl.setAttribute('font-size', '13px')
    textEl.setAttribute('fill', '#333')
    textEl.setAttribute('font-family', 'sans-serif')
    textEl.setAttribute('text-anchor', 'start')

    fo.parentNode?.replaceChild(textEl, fo)
  })

  return clone
}

function exportSvg(filename = 'mindmap.svg') {
  const svgEl = getSvgEl()
  if (!svgEl) return

  const clone = convertForeignObjectsToText(svgEl)
  const svgData = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone)
  const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
  downloadBlob(blob, filename)
}

async function exportPng(filename = 'mindmap.png') {
  const svgEl = getSvgEl()
  if (!svgEl) return

  const bbox = svgEl.getBoundingClientRect()
  const w = bbox.width || 1920
  const h = bbox.height || 1080

  const clone = convertForeignObjectsToText(svgEl)
  clone.setAttribute('width', String(w))
  clone.setAttribute('height', String(h))

  const svgData = new XMLSerializer().serializeToString(clone)
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  const img = new Image()
  img.onload = () => {
    const scale = 4
    const canvas = document.createElement('canvas')
    canvas.width = w * scale
    canvas.height = h * scale
    const ctx = canvas.getContext('2d')!
    ctx.scale(scale, scale)
    ctx.fillStyle = '#fafbfc'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0)
    URL.revokeObjectURL(url)

    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, filename)
    }, 'image/png')
  }
  img.src = url
}

defineExpose({ exportSvg, exportPng })
</script>

<style scoped>
.mindmap-wrapper {
  width: 100%;
  height: 100%;
  min-height: 500px;
  position: relative;
}

.mindmap-container {
  width: 100%;
  height: 100%;
  min-height: 500px;
  background: #fafbfc;
  border-radius: 8px;
  overflow: hidden;
}

.mindmap-container :deep(svg.markmap-svg) {
  width: 100%;
  height: 100%;
  min-height: 500px;
  display: block;
}
</style>
