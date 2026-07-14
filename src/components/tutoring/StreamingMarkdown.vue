<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import DOMPurify from 'dompurify'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import MarkdownIt from 'markdown-it'
import { processLinkCards, initLinkCardInteractions } from '../../utils/linkCard'

const props = withDefaults(defineProps<{
  content: string
  streaming?: boolean
}>(), {
  streaming: false,
})

// ---- markdown-it 实例（与 MarkdownViewer 保持一致） ----
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
  breaks: false,
  highlight(str: string, lang: string): string {
    const escapedCode = str.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<pre><code class="language-${lang || ''}">${escapedCode}</code></pre>`
  },
})

// 数学公式预处理
function processMath(text: string): { html: string; placeholders: Map<string, string> } {
  const placeholders = new Map<string, string>()
  let idx = 0
  const ph = () => `%%MATH_${idx++}%%`

  let html = text
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (_m, formula) => {
    const key = ph()
    placeholders.set(key, katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false }))
    return key
  })
  html = html.replace(/\\\[([\s\S]*?)\\\]/g, (_m, formula) => {
    const key = ph()
    placeholders.set(key, katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false }))
    return key
  })
  html = html.replace(/\$(.+?)\$/g, (_m, formula) => {
    const trimmed = formula.trim()
    if (/^\d[\d.,]*[kMBT]?$/.test(trimmed)) return _m
    if (/\s/.test(trimmed) && !/[\\^_{}]/.test(trimmed)) return _m
    try {
      const key = ph()
      placeholders.set(key, katex.renderToString(trimmed, { displayMode: false, throwOnError: true }))
      return key
    } catch { return _m }
  })
  html = html.replace(/\\\((.+?)\\\)/g, (_m, formula) => {
    const key = ph()
    placeholders.set(key, katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false }))
    return key
  })
  return { html, placeholders }
}

function postProcessMath(html: string, placeholders: Map<string, string>): string {
  for (const [ph, mathHtml] of placeholders) {
    html = html.split(ph).join(mathHtml)
  }
  return html
}

// 自定义标记后处理
function postProcessCustomMarkers(html: string): string {
  // [ref:chunk_id] → sup
  html = html.replace(/\[ref:([^\]]+)\]/g, (_m, id: string) =>
    `<sup class="ref-citation" data-ref-id="${id}">[¹]</sup>`
  )
  // {#diag-id:element} → span
  html = html.replace(/\{#([^:]+):([^}]+)\}/g, (_m, diagId: string, elem: string) =>
    `<span class="diagram-ref" data-diag-id="${diagId}" data-element="${elem}">${elem}</span>`
  )
  // [uncertain]...[/uncertain] → span
  html = html.replace(/\[uncertain\]([\s\S]*?)\[\/uncertain\]/g, (_m, text: string) =>
    `<span class="uncertain-mark">${text}</span>`
  )
  return html
}

function stripControlBlock(text: string): string {
  return text.replace(/\[CONTROL\][\s\S]*?---CONTROL_END---/g, '').trim()
}

function fixConcatHeadings(text: string): string {
  return text.replace(/([^\n#])(#{1,6}\s)/g, '$1\n\n$2')
}

const sanitizedHtml = computed(() => {
  const cleaned = stripControlBlock(props.content)
  const fixed = fixConcatHeadings(cleaned)

  // Protect raw <svg> blocks from processMath regex and markdown-it splitting.
  const htmlBlocks: string[] = []
  const protectedText = fixed.replace(/<svg\b[\s\S]*?<\/svg>/gi, (m) => {
    const idx = htmlBlocks.length
    htmlBlocks.push(m.replace(/\n[ \t]*\n/g, '\n'))
    return `\n\n%%HTMLBLOCK_${idx}%%\n\n`
  })

  const { html: preprocessed, placeholders } = processMath(protectedText)

  // Restore HTML blocks before markdown rendering
  let restored = preprocessed
  htmlBlocks.forEach((block, i) => {
    restored = restored.split(`%%HTMLBLOCK_${i}%%`).join(block)
  })

  const rendered = md.render(restored)
  const withMath = postProcessMath(rendered, placeholders)
  const withMarkers = postProcessCustomMarkers(withMath)
  const sanitized = DOMPurify.sanitize(withMarkers, {
    ADD_ATTR: ['id', 'target', 'rel', 'data-ref-id', 'data-diag-id', 'data-element', 'class',
      'd', 'cx', 'cy', 'r', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
      'width', 'height', 'viewBox', 'fill', 'stroke', 'stroke-width',
      'transform', 'font-size', 'font-weight', 'text-anchor',
      'dominant-baseline', 'opacity', 'clip-path', 'mask',
      'href', 'style', 'rx', 'ry',
      'marker-end', 'marker-start', 'refX', 'refY',
      'markerWidth', 'markerHeight', 'orient', 'points',
      'version', 'xmlns', 'stroke-linecap', 'stroke-linejoin',
      'fill-rule', 'clip-rule', 'stroke-dasharray',
      'stroke-opacity', 'fill-opacity', 'preserveAspectRatio',
    ],
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'pre', 'code',
      'strong', 'em', 'a', 'span', 'div',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'blockquote', 'img', 'sup', 'sub', 'del',
      'input',
      'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon',
      'ellipse', 'text', 'tspan', 'g', 'defs', 'use',
      'linearGradient', 'radialGradient', 'stop',
      'clipPath', 'mask', 'marker', 'pattern',
      'image', 'foreignObject', 'filter',
      'feGaussianBlur', 'feOffset', 'feMerge', 'feMergeNode',
      'feColorMatrix', 'feBlend', 'feComposite', 'feFlood',
      'feDropShadow', 'animate', 'animateTransform', 'set',
    ],
  })
  // 在消毒后处理链接卡片
  return processLinkCards(sanitized)
})

const contentRef = ref<HTMLElement | null>(null)

// 滚动处理：流式时保持底部可见 + 链接卡片交互
watch(sanitizedHtml, async () => {
  await nextTick()
  if (props.streaming && contentRef.value) {
    const parent = contentRef.value.closest('.overflow-y-auto') || contentRef.value.parentElement
    if (parent) {
      parent.scrollTop = parent.scrollHeight
    }
  }
  // 初始化链接卡片交互（新出现的卡片会自动绑定，已绑定的不会重复）
  if (contentRef.value) {
    initLinkCardInteractions(contentRef.value)
  }
})
</script>

<template>
  <div class="streaming-markdown">
    <div ref="contentRef" class="markdown-content" v-html="sanitizedHtml" />
    <span v-if="streaming" class="streaming-cursor">▎</span>
  </div>
</template>

<style scoped>
.streaming-markdown {
  position: relative;
}

.markdown-content {
  font-size: 15px;
  line-height: 1.85;
  color: var(--lt-text-primary);
}

.markdown-content :deep(h1) {
  font-size: 22px;
  font-weight: 700;
  color: var(--lt-text-primary);
  margin: 28px 0 14px;
}
.markdown-content :deep(h2) {
  font-size: 19px;
  font-weight: 700;
  color: var(--lt-text-primary);
  margin: 24px 0 12px;
}
.markdown-content :deep(h3) {
  font-size: 17px;
  font-weight: 600;
  color: var(--lt-text-secondary);
  margin: 20px 0 10px;
}
.markdown-content :deep(p) { margin: 12px 0; }
.markdown-content :deep(ul) { list-style: disc; margin: 8px 0; padding-left: 24px; }
.markdown-content :deep(ol) { list-style: decimal; margin: 8px 0; padding-left: 24px; }
.markdown-content :deep(li) { margin: 4px 0; }
.markdown-content :deep(blockquote) {
  border-left: 4px solid var(--lt-brand);
  margin: 14px 0;
  padding: 8px 16px;
  background: var(--lt-bg-page);
  color: var(--lt-text-auxiliary);
  border-radius: 0 8px 8px 0;
}
.markdown-content :deep(code) {
  font-family: var(--lt-font-mono);
  font-size: 13px;
  background: var(--lt-bg-page);
  padding: 2px 6px;
  border-radius: 4px;
}
.markdown-content :deep(pre) {
  background: var(--lt-bg-page);
  border: 1px solid var(--lt-border);
  border-radius: 8px;
  padding: 14px;
  overflow-x: auto;
  margin: 14px 0;
  font-size: 13px;
  line-height: 1.6;
}
.markdown-content :deep(pre code) {
  background: transparent;
  padding: 0;
  color: var(--lt-text-primary);
}
.markdown-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 14px 0;
}
.markdown-content :deep(th), .markdown-content :deep(td) {
  border: 1px solid var(--lt-border);
  padding: 8px 12px;
  font-size: 13px;
  text-align: left;
}
.markdown-content :deep(th) { background: var(--lt-bg-page); font-weight: 600; }
.markdown-content :deep(a) { color: var(--lt-brand); text-decoration: none; }
.markdown-content :deep(a:hover) { text-decoration: underline; }
.markdown-content :deep(hr) {
  margin: 20px 0;
  border: none;
  border-top: 1px solid var(--lt-border);
}
.markdown-content :deep(img) { max-width: 100%; border-radius: 8px; }
.markdown-content :deep(svg) { max-width: 100%; height: auto; }

/* 自定义标记样式 */
.markdown-content :deep(.ref-citation) {
  color: var(--lt-brand);
  font-size: 0.75em;
  vertical-align: super;
  cursor: pointer;
}
.markdown-content :deep(.ref-citation:hover) {
  text-decoration: underline;
}
.markdown-content :deep(.diagram-ref) {
  color: var(--lt-warm);
  border-bottom: 1px dashed var(--lt-warm);
  cursor: pointer;
}
.markdown-content :deep(.diagram-ref:hover) {
  border-bottom-style: solid;
}
.markdown-content :deep(.uncertain-mark) {
  color: var(--lt-text-secondary);
  border-bottom: 1px dotted var(--lt-text-secondary);
}

/* 流式光标 */
.streaming-cursor {
  display: inline;
  color: var(--lt-brand);
  font-size: 1.1em;
  animation: cursor-blink 800ms ease-in-out infinite;
  margin-left: 1px;
}
@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@media (max-width: 768px) {
  .markdown-content { font-size: 14px; line-height: 1.7; }
  .markdown-content :deep(h1) { font-size: 20px; }
  .markdown-content :deep(h2) { font-size: 17px; }
  .markdown-content :deep(h3) { font-size: 15px; }
  .markdown-content :deep(pre) { padding: 12px; font-size: 12px; }
}
</style>
