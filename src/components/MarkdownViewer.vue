<template>
  <div class="markdown-viewer" :class="{ 'has-toc': props.showToc && tocVisible }">
    <!-- TOC toggle button (collapsible mode) -->
    <button
      v-if="props.showToc && props.tocCollapsible && headings.length > 0"
      class="md-toc-toggle"
      :class="{ 'is-collapsed': tocUserCollapsed }"
      @click="toggleToc"
      :title="tocUserCollapsed ? '展开目录' : '收起目录'"
    >☰</button>

    <!-- 目录 TOC -->
    <div v-if="tocVisible" class="toc-sidebar">
      <div class="toc-header">
        <span>目录</span>
        <span v-if="props.tocCollapsible" class="toc-close" @click="toggleToc">×</span>
      </div>
      <div class="toc-list">
        <div
          v-for="(heading, idx) in headings"
          :key="idx"
          class="toc-item"
          :class="[`toc-level-${heading.level}`, { 'toc-active': activeHeadingId === heading.id }]"
          @click="scrollToHeading(heading.id)"
        >
          {{ heading.text }}
        </div>
      </div>
    </div>

    <!-- 渲染内容 -->
    <div
      ref="contentRef"
      class="markdown-content lt-svg-root"
      v-html="sanitizedHtml"
      @click="onContentClick"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import mermaid from 'mermaid'
import MarkdownIt from 'markdown-it'
import { processLinkCards, initLinkCardInteractions } from '../utils/linkCard'

const props = withDefaults(defineProps<{
  content: string
  showToc?: boolean
  tocCollapsible?: boolean
}>(), {
  showToc: true,
  tocCollapsible: false
})

const emit = defineEmits<{
  headingClick: [id: string]
}>()

const contentRef = ref<HTMLElement | null>(null)
const activeHeadingId = ref('')
const tocUserCollapsed = ref(localStorage.getItem('lt-toc-collapsed-md') === 'true')

function toggleToc() {
  tocUserCollapsed.value = !tocUserCollapsed.value
  localStorage.setItem('lt-toc-collapsed-md', String(tocUserCollapsed.value))
}

const tocVisible = computed(() => {
  if (!props.showToc || headings.value.length === 0) return false
  if (props.tocCollapsible) return !tocUserCollapsed.value
  return true
})

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// 事件委托：代码块复制按钮
function onContentClick(e: MouseEvent) {
  const btn = (e.target as HTMLElement).closest('.code-copy-btn')
  if (!btn) return
  const code = btn.getAttribute('data-code')
  if (!code) return
  navigator.clipboard.writeText(code).then(() => {
    btn.classList.add('copied')
    setTimeout(() => btn.classList.remove('copied'), 1500)
  }).catch(() => {
    // fallback: silent
  })
}

// ===== markdown-it 实例 =====
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
  breaks: false,
  highlight(str: string, lang: string): string {
    const langClass = lang ? ` class="language-${lang}"` : ''
    const escapedCode = str.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<div class="code-block-wrapper"><span class="code-copy-btn" data-code="${escapeAttr(str)}"><span class="code-copy-icon"></span></span><pre><code${langClass}>${escapedCode}</code></pre></div>`
  }
})

// 自定义任务列表插件
function taskListsPlugin(md: MarkdownIt) {
  md.core.ruler.after('inline', 'task-lists', (state) => {
    const tokens = state.tokens
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type === 'inline') {
        const content = tokens[i].content
        const match = content.match(/^\[([ xX])\]\s*/)
        if (match) {
          const checked = match[1].toLowerCase() === 'x'
          const checkbox = `<input type="checkbox" disabled${checked ? ' checked' : ''}>`
          tokens[i].content = content.slice(match[0].length)
          tokens[i].children = md.utils.arrayReplaceAt(tokens[i].children!, 0, [
            Object.assign(new state.Token('html_inline', '', 0), { content: checkbox }),
            Object.assign(new state.Token('text', '', 0), { content: ' ' })
          ].concat(tokens[i].children!.slice(1)))

          // 给父 <li> 加 class
          const listToken = tokens[i - 2]
          if (listToken?.type === 'list_item_open') {
            listToken.attrSet('class', 'task-list-item')
          }
        }
      }
    }
  })
}

md.use(taskListsPlugin)

// 给渲染出的 <h1>~<h6> 添加 id 属性，与 headings computed 保持一致
function headingIdPlugin(md: MarkdownIt) {
  const defaultRender = md.renderer.rules.heading_open || ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))
  md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
    const inlineToken = tokens[idx + 1]
    if (inlineToken?.type === 'inline') {
      const text = stripInlineMarkdown(inlineToken.content)
      const id = text.replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '') || 'heading'
      tokens[idx].attrSet('id', id)
    }
    return defaultRender(tokens, idx, options, env, self)
  }
}
md.use(headingIdPlugin)

// ===== Mermaid 初始化 =====
mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' })
let mermaidCounter = 0

// ===== 数学公式预处理（在 markdown-it 之前） =====
const processMath = (text: string): { html: string; placeholders: Map<string, string> } => {
  const placeholders = new Map<string, string>()
  let idx = 0
  const ph = () => `%%MATH_${idx++}%%`

  let html = text

  // 块级公式 $$...$$
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (_m, formula) => {
    const key = ph()
    placeholders.set(key, katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false }))
    return key
  })
  // 块级公式 \[...\]
  html = html.replace(/\\\[([\s\S]*?)\\\]/g, (_m, formula) => {
    const key = ph()
    placeholders.set(key, katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false }))
    return key
  })
  // 行内公式 $...$
  html = html.replace(/\$(.+?)\$/g, (_m, formula) => {
    const trimmed = formula.trim()
    if (/^\d[\d.,]*[kMBT]?$/.test(trimmed)) return _m
    if (/\s/.test(trimmed) && !/[\\^_{}]/.test(trimmed)) return _m
    try {
      const key = ph()
      placeholders.set(key, katex.renderToString(trimmed, { displayMode: false, throwOnError: true }))
      return key
    } catch {
      return _m
    }
  })
  // 行内公式 \(...\)
  html = html.replace(/\\\((.+?)\\\)/g, (_m, formula) => {
    const key = ph()
    placeholders.set(key, katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false }))
    return key
  })

  return { html, placeholders }
}

// ===== 后处理：还原数学公式 + 代码块包装 =====
const postProcess = (html: string, mathPlaceholders: Map<string, string>): string => {
  // 还原数学公式占位符
  for (const [ph, mathHtml] of mathPlaceholders) {
    html = html.split(ph).join(mathHtml)
  }
  return html
}

// 修复与上文连在一起的标题标记（无换行的 #/##/###）
// 注意：用 [^\n#] 防止匹配到行首的 ## （避免把 ## 拆成 #\n\n#）
const fixConcatHeadings = (text: string): string => {
  return text.replace(/([^\n#])(#{1,6}\s)/g, '$1\n\n$2')
}

// ===== Markdown 转 HTML =====
const mdToHtml = (text: string): string => {
  const fixed = fixConcatHeadings(text)

  // Protect raw <svg> blocks from two pipeline hazards:
  //
  // 1. processMath $$...$$ regex - uses [\s\S]*? (cross-line); if an SVG
  //    <text> contains "$$", the regex swallows everything from that $$ to
  //    the next $$ in the document.
  //
  // 2. markdown-it HTML block splitting - type 7 HTML blocks end at blank
  //    lines.  LLM-generated SVGs often contain blank lines (e.g. between
  //    </defs> and diagram elements).  When split, the second fragment is
  //    wrapped in <p>, which triggers the HTML5 parser's "breakout" rule:
  //    the parser exits SVG namespace, placing <rect>/<text>/<line> in HTML
  //    namespace.  DOMPurify then removes them because SVG-specific tags in
  //    HTML namespace fail _checkValidNamespace() (they're in ALL_SVG_TAGS
  //    but not in COMMON_SVG_AND_HTML_ELEMENTS).
  //
  // Fix: extract SVGs, strip internal blank lines, protect from processMath,
  // then restore as a single unbroken HTML block for markdown-it.
  const htmlBlocks: string[] = []
  const protectedText = fixed.replace(/<svg\b[\s\S]*?<\/svg>/gi, (m) => {
    const idx = htmlBlocks.length
    htmlBlocks.push(m.replace(/\n[ \t]*\n/g, '\n'))
    return `\n\n%%HTMLBLOCK_${idx}%%\n\n`
  })

  const { html: preprocessed, placeholders } = processMath(protectedText)

  // Restore HTML blocks (with blank lines already removed) before rendering
  let restored = preprocessed
  htmlBlocks.forEach((block, i) => {
    restored = restored.split(`%%HTMLBLOCK_${i}%%`).join(block)
  })

  const rendered = md.render(restored)
  return postProcess(rendered, placeholders)
}

// ===== 提取标题用于 TOC =====
interface Heading {
  id: string
  text: string
  level: number
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .trim()
}

const headings = computed<Heading[]>(() => {
  const result: Heading[] = []
  const seenIds = new Set<string>()

  // 从 markdown-it token 流中提取标题（比正则更可靠）
  const tokens = md.parse(props.content, {})
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === 'heading_open') {
      const level = parseInt(tokens[i].tag.slice(1), 10)
      const inlineToken = tokens[i + 1]
      if (inlineToken?.type === 'inline') {
        const text = stripInlineMarkdown(inlineToken.content)
        let id = text.replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '') || 'heading'
        if (seenIds.has(id)) {
          let counter = 2
          while (seenIds.has(`${id}-${counter}`)) counter++
          id = `${id}-${counter}`
        }
        seenIds.add(id)
        result.push({ id, text, level })
      }
    }
  }
  return result
})

// 剥离 [CONTROL] ... ---CONTROL_END--- 控制块（兼容已有消息）
function stripControlBlock(text: string): string {
  return text.replace(/\[CONTROL\][\s\S]*?---CONTROL_END---/g, '').trim()
}

// ===== 消毒 HTML + 链接卡片 =====
const sanitizedHtml = computed(() => {
  const rawHtml = mdToHtml(stripControlBlock(props.content))
  const sanitized = DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['id', 'target', 'rel', 'data-code', 'type', 'checked', 'disabled',
      'd', 'cx', 'cy', 'r', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
      'width', 'height', 'viewBox', 'fill', 'stroke', 'stroke-width',
      'transform', 'font-size', 'font-weight', 'text-anchor',
      'dominant-baseline', 'opacity', 'clip-path', 'mask',
      'href', 'style', 'class', 'rx', 'ry',
      'marker-end', 'marker-start', 'refX', 'refY',
      'markerWidth', 'markerHeight', 'orient', 'points',
      'version', 'xmlns', 'stroke-linecap', 'stroke-linejoin',
      'fill-rule', 'clip-rule', 'stroke-dasharray',
      'stroke-opacity', 'fill-opacity', 'preserveAspectRatio',
      'stroke-miterlimit', 'stroke-dashoffset',
      'font-family', 'font-style', 'text-decoration',
      'letter-spacing', 'word-spacing',
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
    ]
  })
  // 在消毒后处理链接卡片（卡片 HTML 由可信代码生成，动态内容已转义）
  return processLinkCards(sanitized)
})

// ===== Mermaid 图表渲染 =====
const renderMermaidBlocks = () => {
  if (!contentRef.value) return
  const blocks = contentRef.value.querySelectorAll('code.language-mermaid')
  blocks.forEach(async (block) => {
    const wrapper = (block as HTMLElement).closest('.code-block-wrapper')
    if (!wrapper || wrapper.getAttribute('data-mermaid-rendered')) return
    wrapper.setAttribute('data-mermaid-rendered', 'true')

    const code = block.textContent || ''
    if (!code.trim()) return

    const id = `mermaid-svg-${++mermaidCounter}`
    try {
      const { svg } = await mermaid.render(id, code.trim())
      const container = document.createElement('div')
      container.className = 'mermaid-container'
      container.innerHTML = svg
      wrapper.replaceWith(container)
    } catch (e) {
      // 渲染失败，保留原始代码块供用户查看
      wrapper.removeAttribute('data-mermaid-rendered')
    }
  })
}

// ===== 代码高亮 + 链接卡片交互 =====
const highlightAll = () => {
  if (!contentRef.value) return
  nextTick(() => {
    contentRef.value?.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block as HTMLElement)
    })
    // 初始化链接卡片交互（文章点击、视频展开、favicon 回退）
    if (contentRef.value) {
      initLinkCardInteractions(contentRef.value)
    }
    // 渲染 Mermaid 图表（在高亮之后，复用已构建的 DOM）
    renderMermaidBlocks()
  })
}

watch(sanitizedHtml, () => {
  highlightAll()
})

onMounted(() => {
  highlightAll()
})

// ===== 滚动到标题锚点 =====
const scrollToHeading = (id: string) => {
  activeHeadingId.value = id
  emit('headingClick', id)
  const el = contentRef.value?.querySelector(`#${CSS.escape(id)}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

// 滚动监听高亮当前标题
let scrollContainer: HTMLElement | null = null
const onScroll = () => {
  if (!contentRef.value) return
  const hTags = contentRef.value.querySelectorAll('h1, h2, h3, h4, h5, h6')
  let currentId = ''
  for (const h of hTags) {
    const rect = h.getBoundingClientRect()
    if (rect.top <= 120) {
      currentId = h.id
    }
  }
  if (currentId) {
    activeHeadingId.value = currentId
  }
}

onMounted(() => {
  scrollContainer = contentRef.value?.closest('.overflow-y-auto') || contentRef.value
  scrollContainer?.addEventListener('scroll', onScroll)
})

onUnmounted(() => {
  scrollContainer?.removeEventListener('scroll', onScroll)
})
</script>

<style scoped>
.markdown-viewer {
  display: flex;
  gap: 24px;
  position: relative;
}

.markdown-viewer.has-toc {
  height: 100%;
  min-height: 0;
}

.toc-sidebar {
  width: 200px;
  flex-shrink: 0;
  overflow-y: auto;
  border-right: 1px solid var(--lt-border);
  padding-right: 16px;
}

.markdown-viewer.has-toc .toc-sidebar {
  height: 100%;
}

.toc-header {
  font-size: 13px;
  font-weight: 700;
  color: var(--lt-text-primary);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--lt-border);
}

.toc-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.toc-item {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.15s;
  line-height: 1.4;
}

.toc-item:hover {
  color: var(--el-color-primary);
  background: var(--lt-bg-page);
}

.toc-item.toc-active {
  color: var(--el-color-primary);
  background: var(--lt-brand-lightest);
  font-weight: 600;
}

.toc-level-2 { padding-left: 8px; }
.toc-level-3 { padding-left: 20px; font-size: 11px; }
.toc-level-4 { padding-left: 32px; font-size: 11px; }

.toc-close {
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  color: var(--lt-text-auxiliary);
  padding: 0 2px;
  transition: color 0.15s;
}

.toc-close:hover {
  color: var(--lt-text-primary);
}

/* TOC toggle button */
.md-toc-toggle {
  position: sticky;
  top: 8px;
  align-self: flex-start;
  width: 32px;
  height: 32px;
  border: 1px solid var(--lt-border);
  border-radius: 8px;
  background: var(--lt-bg-card, #fff);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: var(--lt-text-secondary, #475569);
  transition: all 0.2s;
  z-index: 5;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
  margin-right: 8px;
}

.md-toc-toggle:hover {
  background: var(--lt-brand-lightest, #eff6ff);
  color: var(--lt-brand, #2B6FFF);
  border-color: var(--lt-brand-lighter, #bfdbfe);
}

.markdown-content {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  line-height: 1.85;
  color: var(--lt-text-primary);
}

.markdown-viewer.has-toc .markdown-content {
  min-height: 0;
  overflow-y: auto;
}

.markdown-content :deep(h1) {
  font-size: 26px;
  font-weight: 700;
  color: var(--lt-text-primary);
  margin: 36px 0 18px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--lt-border);
}

.markdown-content :deep(h2) {
  font-size: 21px;
  font-weight: 700;
  color: var(--lt-text-primary);
  margin: 30px 0 14px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--lt-border);
}

.markdown-content :deep(h3) {
  font-size: 18px;
  font-weight: 600;
  color: var(--lt-text-secondary);
  margin: 26px 0 12px;
}

.markdown-content :deep(h4) {
  font-size: 16px;
  font-weight: 600;
  color: var(--lt-text-auxiliary);
  margin: 22px 0 10px;
}

.markdown-content :deep(h5) {
  font-size: 15px;
  font-weight: 600;
  color: var(--lt-text-auxiliary);
  margin: 18px 0 8px;
}

.markdown-content :deep(h6) {
  font-size: 14px;
  font-weight: 600;
  color: var(--lt-text-placeholder);
  margin: 16px 0 6px;
}

.markdown-content :deep(p) {
  margin: 14px 0;
}

.markdown-content :deep(pre) {
  background: var(--lt-bg-page);
  border: 1px solid var(--lt-border);
  border-radius: 8px;
  padding: 16px;
  overflow-x: auto;
  margin: 16px 0;
  font-size: 13px;
  line-height: 1.6;
}

.markdown-content :deep(code) {
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  background: var(--lt-bg-page);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
  color: var(--lt-danger);
}

.markdown-content :deep(pre code) {
  background: transparent;
  padding: 0;
  color: var(--lt-text-primary);
  font-size: 13px;
}

/* 代码块包装容器 + 复制按钮 */
.markdown-content :deep(.code-block-wrapper) {
  position: relative;
}
.markdown-content :deep(.code-copy-btn) {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--lt-border);
  border-radius: 6px;
  background: var(--lt-bg-card);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s, border-color 0.2s;
  z-index: 1;
}
.markdown-content :deep(.code-copy-icon)::before {
  content: '';
  position: absolute;
  top: 6px;
  left: 6px;
  width: 11px;
  height: 11px;
  border: 1.5px solid var(--lt-text-placeholder);
  border-radius: 2px;
  transition: border-color 0.2s;
}
.markdown-content :deep(.code-copy-icon)::after {
  content: '';
  position: absolute;
  top: 9px;
  left: 9px;
  width: 11px;
  height: 11px;
  border: 1.5px solid var(--lt-text-placeholder);
  border-radius: 2px;
  background: var(--lt-bg-card);
  transition: border-color 0.2s;
}
.markdown-content :deep(.code-block-wrapper):hover .code-copy-btn {
  opacity: 1;
}
.markdown-content :deep(.code-copy-btn):hover .code-copy-icon::before,
.markdown-content :deep(.code-copy-btn):hover .code-copy-icon::after {
  border-color: var(--lt-text-primary);
}
.markdown-content :deep(.code-copy-btn.copied) {
  border-color: #22c55e;
  background: rgba(52, 199, 89, 0.1);
  opacity: 1;
}
.markdown-content :deep(.code-copy-btn.copied) .code-copy-icon::before {
  display: none;
}
.markdown-content :deep(.code-copy-btn.copied) .code-copy-icon::after {
  content: '✓';
  top: 4px;
  left: 6px;
  width: auto;
  height: auto;
  border: none;
  background: transparent;
  color: #22c55e;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}
.markdown-content :deep(.code-block-wrapper pre) {
  margin: 0;
}

.markdown-content :deep(ul) {
  list-style: disc;
  margin: 8px 0;
  padding-left: 24px;
}

.markdown-content :deep(ol) {
  list-style: decimal;
  margin: 8px 0;
  padding-left: 24px;
}

.markdown-content :deep(li) {
  margin: 4px 0;
}

/* task list checkboxes */
.markdown-content :deep(.task-list-item) {
  list-style: none;
  margin-left: -20px;
}
.markdown-content :deep(.contains-task-list) {
  padding-left: 0;
}
.markdown-content :deep(input[type="checkbox"]) {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border: 2px solid var(--lt-border);
  border-radius: 4px;
  margin-right: 8px;
  vertical-align: text-bottom;
  position: relative;
  cursor: pointer;
  transition: all 0.15s;
}
.markdown-content :deep(input[type="checkbox"]:checked) {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
}
.markdown-content :deep(input[type="checkbox"]:checked)::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 0px;
  width: 5px;
  height: 9px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

/* strikethrough */
.markdown-content :deep(del) {
  text-decoration: line-through;
  color: var(--lt-text-placeholder);
}

.markdown-content :deep(a) {
  color: var(--el-color-primary);
  text-decoration: none;
}

.markdown-content :deep(a:hover) {
  text-decoration: underline;
}

.markdown-content :deep(blockquote) {
  border-left: 4px solid var(--el-color-primary);
  margin: 16px 0;
  padding: 8px 16px;
  background: var(--lt-bg-page);
  color: var(--lt-text-auxiliary);
  border-radius: 0 8px 8px 0;
}

.markdown-content :deep(hr) {
  margin: 24px 0;
  border: none;
  border-top: 1px solid var(--lt-border);
}

.markdown-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid var(--lt-border);
  padding: 8px 12px;
  text-align: left;
  font-size: 13px;
}

.markdown-content :deep(th) {
  background: var(--lt-bg-page);
  font-weight: 600;
}

.markdown-content :deep(img) {
  max-width: 100%;
  border-radius: 8px;
}

.markdown-content :deep(svg) {
  max-width: 100%;
  height: auto;
}

/* Mermaid 图表容器 */
.markdown-content :deep(.mermaid-container) {
  display: flex;
  justify-content: center;
  margin: 16px 0;
  padding: 20px;
  background: var(--lt-bg-page);
  border: 1px solid var(--lt-border);
  border-radius: 8px;
  overflow-x: auto;
}

/* highlight.js 主题微调 */
.markdown-content :deep(.hljs) {
  background: transparent !important;
  color: var(--lt-text-primary) !important;
}
/* highlight.js github.css 硬编码了 padding，需覆盖 */
.markdown-content :deep(pre code.hljs) {
  padding: 0 !important;
  display: block;
  overflow-x: auto;
}
.markdown-content :deep(code.hljs) {
  padding: 2px 6px !important;
}

/* 暗色模式：覆盖 github.css 的硬编码亮色 token 颜色 */
:root[data-theme="dark"] .markdown-content :deep(.hljs-keyword),
:root[data-theme="dark"] .markdown-content :deep(.hljs-selector-tag),
:root[data-theme="dark"] .markdown-content :deep(.hljs-built_in) {
  color: #ff7b72 !important;
}
:root[data-theme="dark"] .markdown-content :deep(.hljs-string),
:root[data-theme="dark"] .markdown-content :deep(.hljs-attr) {
  color: #a5d6ff !important;
}
:root[data-theme="dark"] .markdown-content :deep(.hljs-comment),
:root[data-theme="dark"] .markdown-content :deep(.hljs-quote) {
  color: #8b949e !important;
}
:root[data-theme="dark"] .markdown-content :deep(.hljs-function),
:root[data-theme="dark"] .markdown-content :deep(.hljs-title) {
  color: #d2a8ff !important;
}
:root[data-theme="dark"] .markdown-content :deep(.hljs-number),
:root[data-theme="dark"] .markdown-content :deep(.hljs-literal) {
  color: #79c0ff !important;
}
:root[data-theme="dark"] .markdown-content :deep(.hljs-type),
:root[data-theme="dark"] .markdown-content :deep(.hljs-class .hljs-title) {
  color: #ffa657 !important;
}
</style>
