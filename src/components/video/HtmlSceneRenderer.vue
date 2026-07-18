<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import type { Scene, PlaybackSpeed } from '@/types/scene'
import { useSceneTimer } from '@/composables/useSceneTimer'
import DOMPurify from 'dompurify'
import { sanitizeCss } from '@/utils/cssSanitizer'
import { registerWebComponents } from './web-components'
import { BASE_SCENE_CSS } from './baseSceneCss'

// 确保 Web Components 只注册一次
registerWebComponents()

const props = defineProps<{
  scene: Scene
  isPlaying: boolean   // 已由 SceneCanvas 计算的 effectiveIsPlaying（含音频缓冲判断）
  speed: PlaybackSpeed
}>()

const emit = defineEmits<{ complete: [] }>()

// Shadow DOM 容器
const hostRef = ref<HTMLElement>()
let shadowRoot: ShadowRoot | null = null

// 动画状态
const enterQueue = ref<Array<{ el: HTMLElement; delay: number; enter: string }>>([])
let lt3dEls: HTMLElement[] = []

// 渲染错误状态
const renderError = ref(false)

// 时间引擎 -- duration 通过 getter 传入，TTS 回填后自动生效
// stopTicking 由 useSceneTimer 内部的 onBeforeUnmount 自动管理
const { virtualTime } = useSceneTimer(
  () => props.isPlaying,
  () => props.speed,
  () => {
    const d = props.scene.duration
    if (d > 0) return d
    // 兜底：duration 为 0 时根据 narration 字数估算（与原有场景组件一致）
    const narrationLen = (props.scene.narration || '').length
    return Math.max(narrationLen * 240, 5000)
  },
  () => emit('complete')
)

// ===== 兜底：裸 LaTeX 自动包裹 =====
// LLM 可能误将 LaTeX 公式放进 <span class="kw"> 等非公式标签，前端只对 <lt-formula> 调用 KaTeX，
// 导致 \nabla、\frac 等以源码原样显示。此处扫描行内强调元素，检测到 LaTeX 命令则替换为 <lt-formula>。
function sanitizeBareLatex(root: HTMLElement) {
  const SKIP = 'lt-formula, lt-code, pre, code, script, style, textarea'
  // 仅处理行内强调元素（LLM 误将公式放进 kw 等标签的常见载体），
  // 避免 <p>、<div> 等块级元素含混合文本时被整体替换导致非 LaTeX 文本丢失
  const TARGET_TAGS = new Set(['SPAN', 'EM', 'STRONG', 'B', 'I', 'MARK'])
  // LaTeX 命令检测：\ 后跟字母（\nabla \frac \sum \sqrt \int \partial ...）
  const LATEX_RE = /\\[a-zA-Z]+/

  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (el.closest(SKIP)) continue            // 跳过受保护元素
    if (!TARGET_TAGS.has(el.tagName)) continue // 仅处理行内强调元素
    if (el.children.length > 0) continue       // 仅处理叶子元素，避免破坏嵌套结构

    const text = el.textContent || ''
    if (!LATEX_RE.test(text)) continue

    // 替换为 <lt-formula inline>（白名单内均为行内元素，用 inline 模式不破坏段落流式布局）
    const formula = document.createElement('lt-formula')
    formula.setAttribute('inline', '')
    formula.textContent = text
    // 保留 data-enter / data-delay 等动画属性
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('data-')) formula.setAttribute(attr.name, attr.value)
    }
    el.replaceWith(formula)
  }
}

// ===== 场景渲染 =====
function renderScene() {
  if (!hostRef.value) return

  try {
    renderError.value = false

    // 创建 Shadow DOM
    if (!shadowRoot) {
      shadowRoot = hostRef.value.attachShadow({ mode: 'open' })
    }
    shadowRoot.innerHTML = ''

    // 1. 注入基础 CSS（主题变量 + 动画 keyframes + Web Component 样式）
    const baseStyle = document.createElement('style')
    baseStyle.textContent = BASE_SCENE_CSS
    shadowRoot.appendChild(baseStyle)

    // 2. 注入 AI 产出的 CSS（经 CSS 清洗，禁止 @import 和外部 url()）
    const content = props.scene.content
    if (!content.html) {
      throw new Error('content.html is empty')
    }
    if (content.css) {
      const aiStyle = document.createElement('style')
      aiStyle.textContent = sanitizeCss(content.css)
      shadowRoot.appendChild(aiStyle)
    }

    // 3. 注入 AI 产出的 HTML（DOMPurify 清洗，不允许内联 style 属性）
    const wrapper = document.createElement('div')
    wrapper.className = 'scene-root'
    wrapper.innerHTML = DOMPurify.sanitize(content.html, {
      ADD_TAGS: ['lt-code', 'lt-chart', 'lt-formula', 'lt-callout', 'lt-arrow',
                 'lt-table', 'lt-flowchart', 'lt-timeline', 'lt-3d'],
      ADD_ATTR: ['data-enter', 'data-delay', 'data-exit', 'data-exit-at',
                 'language', 'type', 'data-data', 'from', 'to', 'inline',
                 'd', 'cx', 'cy', 'r', 'x', 'y', 'width', 'height',
                 'fill', 'stroke', 'stroke-width', 'viewBox', 'points', 'transform',
                 'data-vt'],
      // 禁止内联 style，强制所有样式走 CSS 类或 <style> 标签
      FORBID_ATTR: ['style'],
    })

    // 兜底：将误放在非 <lt-formula> 标签内的裸 LaTeX 自动包裹为 <lt-formula>
    sanitizeBareLatex(wrapper)

    shadowRoot.appendChild(wrapper)

    // 4. 收集所有需要动画的元素
    enterQueue.value = []
    wrapper.querySelectorAll('[data-enter]').forEach(el => {
      enterQueue.value.push({
        el: el as HTMLElement,
        delay: parseInt(el.getAttribute('data-delay') || '0'),
        enter: el.getAttribute('data-enter') || 'fade',
      })
    })
    // 5. 收集所有 lt-3d 元素（缓存引用，避免每帧 querySelectorAll）
    lt3dEls = Array.from(wrapper.querySelectorAll('lt-3d')) as HTMLElement[]
  } catch (e) {
    console.error('HtmlSceneRenderer render error:', e)
    renderError.value = true
    // Fallback：至少显示 narration 文本
    if (shadowRoot) {
      shadowRoot.innerHTML = ''
      const fallback = document.createElement('div')
      fallback.className = 'scene-root fallback'
      fallback.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;padding:48px;color:var(--lt-text);font-size:1.2rem;line-height:1.8;'
      fallback.textContent = props.scene.narration || '场景渲染失败'
      shadowRoot.appendChild(fallback)
    }
  }
}

// ===== 动画驱动 =====
watch(virtualTime, (t) => {
  // 同步 virtualTime 到所有 lt-3d（使用缓存的引用）
  for (const el of lt3dEls) {
    el.setAttribute('data-vt', String(t))
  }
  // 检查入场动画
  for (const item of enterQueue.value) {
    if (t >= item.delay && !item.el.hasAttribute('data-entered')) {
      item.el.setAttribute('data-entered', '')
    }
    // type-out 特殊处理：逐行揭示，每次 tick 都检查
    // （lt-code 的 renderCode 是异步的，首次 tick 时 .lt-code-line 可能尚未创建；
    //  且逐行揭示需要随时间推移持续添加 visible 类）
    if (item.enter === 'type-out' && t >= item.delay) {
      activateTypeOut(item.el as HTMLElement, t)
    }
  }
  // 检查退场动画
  for (const item of enterQueue.value) {
    const exitAt = parseInt(item.el.getAttribute('data-exit-at') || '0')
    if (exitAt > 0 && t >= exitAt && !item.el.hasAttribute('data-exited')) {
      item.el.setAttribute('data-exited', '')
    }
  }
})

// ===== type-out 逐行揭示 =====
function activateTypeOut(element: HTMLElement, virtualTime: number) {
  const lines = element.querySelectorAll('.lt-code-line')
  const totalLines = lines.length
  if (totalLines === 0) return
  const enterDelay = parseInt(element.dataset.delay || '0')
  // 使用与 timer 相同的兜底逻辑计算 duration
  const d = props.scene.duration
  const effectiveDuration = d > 0 ? d : Math.max((props.scene.narration || '').length * 240, 5000)
  const remainingTime = Math.max(effectiveDuration - enterDelay, 1000)
  const lineDelay = Math.min(250, remainingTime / (totalLines + 2))

  lines.forEach((line, i) => {
    const lineEnterTime = enterDelay + i * lineDelay
    if (virtualTime >= lineEnterTime) {
      line.classList.add('visible')
    }
  })
}

// ===== 生命周期 =====
// 初始渲染：onMounted 确保 DOM 已挂载（hostRef 可用），immediate watch 会在 DOM 挂载前触发导致 hostRef 为 undefined
onMounted(() => {
  if (props.scene?.type === 'html') {
    renderScene()
  }
})

// 场景内容变化时重新渲染（duration 变化由 timer getter 自动处理，无需重渲染）
watch(() => props.scene, (scene, oldScene) => {
  if (scene?.type === 'html') {
    // 仅内容变化时重新渲染画面；duration 变化（TTS 回填）由 timer getter 自动处理
    if (!oldScene || scene.content !== oldScene.content) {
      renderScene()
    }
  }
})
</script>

<template>
  <div class="html-scene-container">
    <!-- Shadow DOM 挂载点 -->
    <div ref="hostRef" class="shadow-host"></div>

    <!-- 渲染错误提示（音频/字幕/缓冲提示由 SceneCanvas 统一处理） -->
    <div v-if="renderError" class="render-error-hint">
      场景渲染异常，已显示文本内容
    </div>
  </div>
</template>

<style scoped>
.html-scene-container {
  width: 100%;
  height: 100%;
  position: relative;
}
.shadow-host {
  width: 100%;
  height: 100%;
}
.render-error-hint {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 16px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 8px;
  color: #ef4444;
  font-size: 13px;
  z-index: 10;
  backdrop-filter: blur(8px);
}
</style>
