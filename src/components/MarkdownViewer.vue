<template>
  <div class="markdown-viewer">
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
      class="markdown-content"
      v-html="sanitizedHtml"
      @click="onContentClick"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'
import katex from 'katex'
import 'katex/dist/katex.min.css'

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

// ===== Markdown 转 HTML =====
const mdToHtml = (md: string): string => {
  let html = md
  const mathPlaceholders: { placeholder: string; html: string }[] = []
  const codePlaceholders: { placeholder: string; html: string }[] = []

  // ── 数学公式保护 ──
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (_m, formula) => {
    const displayHtml = katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false })
    const ph = `%%MATH-${mathPlaceholders.length}%%`
    mathPlaceholders.push({ placeholder: ph, html: displayHtml })
    return ph
  })
  html = html.replace(/\\\[([\s\S]*?)\\\]/g, (_m, formula) => {
    const displayHtml = katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false })
    const ph = `%%MATH-${mathPlaceholders.length}%%`
    mathPlaceholders.push({ placeholder: ph, html: displayHtml })
    return ph
  })
  html = html.replace(/\$(.+?)\$/g, (_m, formula) => {
    const trimmed = formula.trim()
    // skip currency amounts like $100, $5.99M
    if (/^\d[\d.,]*[kMBT]?$/.test(trimmed)) return _m
    // skip text with spaces but no LaTeX symbols (e.g. mis-matched $ pairs)
    if (/\s/.test(trimmed) && !/[\\^_{}]/.test(trimmed)) return _m
    try {
      const inlineHtml = katex.renderToString(trimmed, { displayMode: false, throwOnError: true })
      const ph = `%%MATH-${mathPlaceholders.length}%%`
      mathPlaceholders.push({ placeholder: ph, html: inlineHtml })
      return ph
    } catch {
      return _m
    }
  })
  html = html.replace(/\\\((.+?)\\\)/g, (_m, formula) => {
    const inlineHtml = katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false })
    const ph = `%%MATH-${mathPlaceholders.length}%%`
    mathPlaceholders.push({ placeholder: ph, html: inlineHtml })
    return ph
  })

  // ── 代码块 + 行内代码保护（占位符，避免 * _ # 等被后续正则破坏）──
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const langClass = lang ? ` class="language-${lang}"` : ''
    const ph = `%%CODE-${codePlaceholders.length}%%`
    const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    codePlaceholders.push({
      placeholder: ph,
      html: `<div class="code-block-wrapper"><span class="code-copy-btn" data-code="${escapeAttr(code)}"><span class="code-copy-icon"></span></span><pre><code${langClass}>${escapedCode}</code></pre></div>`,
    })
    return ph
  })
  html = html.replace(/`([^`]+)`/g, (_m, code) => {
    const ph = `%%CODE-${codePlaceholders.length}%%`
    codePlaceholders.push({
      placeholder: ph,
      html: `<code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>`,
    })
    return ph
  })

  // 表格
  html = html.replace(/^\|(.+)\|\n\|[-| :]+\|\n((?:^\|.+\|\n?)+)/gm, (_m, headerRow, bodyRows) => {
    const hCells = headerRow.split('|').map((c: string) => c.trim()).filter((c: string) => c)
    let tbl = '<table><thead><tr>' + hCells.map((c: string) => `<th>${c}</th>`).join('') + '</tr></thead><tbody>'
    bodyRows.trim().split('\n').forEach((row: string) => {
      const cells = row.split('|').map((c: string) => c.trim()).filter((c: string) => c)
      tbl += '<tr>' + cells.map((c: string) => `<td>${c}</td>`).join('') + '</tr>'
    })
    return tbl + '</tbody></table>'
  })

  // 引用块（合并连续行，内部可被后续粗体/斜体/链接规则处理）
  html = html.replace(/(?:^> .+\n?)+/gm, (match) => {
    const lines = match.trim().split('\n').map(l => l.replace(/^> /, '')).join('\n')
    return `<blockquote>${lines}</blockquote>`
  })

  // 标题（ID 去重，避免重复标题导致 TOC 导航失效）
  const usedIds = new Set<string>()
  const makeId = (text: string): string => {
    let id = text.trim().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '') || 'heading'
    if (!usedIds.has(id)) { usedIds.add(id); return id }
    let counter = 2
    while (usedIds.has(`${id}-${counter}`)) counter++
    const newId = `${id}-${counter}`
    usedIds.add(newId)
    return newId
  }
  html = html.replace(/^###### (.+)$/gm, (_, text) => {
    return `<h6 id="${makeId(text)}">${text}</h6>`
  })
  html = html.replace(/^##### (.+)$/gm, (_, text) => {
    return `<h5 id="${makeId(text)}">${text}</h5>`
  })
  html = html.replace(/^#### (.+)$/gm, (_, text) => {
    return `<h4 id="${makeId(text)}">${text}</h4>`
  })
  html = html.replace(/^### (.+)$/gm, (_, text) => {
    return `<h3 id="${makeId(text)}">${text}</h3>`
  })
  html = html.replace(/^## (.+)$/gm, (_, text) => {
    return `<h2 id="${makeId(text)}">${text}</h2>`
  })
  html = html.replace(/^# (.+)$/gm, (_, text) => {
    return `<h1 id="${makeId(text)}">${text}</h1>`
  })

  // ── 粗体与斜体
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/(?<!\w)___(.+?)___(?!\w)/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/(?<!\w)__(.+?)__(?!\w)/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>')

  // strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')

  // 分割线
  html = html.replace(/^---$/gm, '<hr />')

  // 任务列表 (must precede unordered list)
  html = html.replace(/^[ \t]*[-*+] \[x\] (.+)$/gim, '%%UL%%<li class="task-list-item"><span class="task-checkbox checked"></span> $1</li>')
  html = html.replace(/^[ \t]*[-*+] \[ \] (.+)$/gim, '%%UL%%<li class="task-list-item"><span class="task-checkbox unchecked"></span> $1</li>')

  // 无序列表（支持缩进子列表：前导空白 + -/*/+ 标记符）
  html = html.replace(/^[ \t]*[-*+] +(.+)$/gm, '%%UL%%<li>$1</li>')
  html = html.replace(/(?:%%UL%%<li>.*<\/li>\n?)+/g, (match) => {
    const nl = match.endsWith('\n') ? '\n' : ''
    return '<ul>' + match.replace(/%%UL%%/g, '').replace(/\n$/, '') + '</ul>' + nl
  })

  // 有序列表（支持缩进子列表）
  html = html.replace(/^[ \t]*\d+\. (.+)$/gm, '%%OL%%<li>$1</li>')
  html = html.replace(/(?:%%OL%%<li>.*<\/li>\n?)+/g, (match) => {
    const nl = match.endsWith('\n') ? '\n' : ''
    return '<ol>' + match.replace(/%%OL%%/g, '').replace(/\n$/, '') + '</ol>' + nl
  })

  // 图片（必须在链接之前，避免 `![` 被链接正则误匹配）
  html = html.replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1">')

  // 链接
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')

  // 段落（占位符 %%CODE_ 和 %%MATH_ 视为块级，不包裹 <p>）
  const blockPattern = /^<\/?(h[1-6]|ul|ol|li|pre|code|hr|table|blockquote|del)/m
  const placeholderPattern = /^%%(CODE|MATH)-\d+%%/
  const lines = html.split('\n')
  const result: string[] = []
  let inBlock = false
  for (const line of lines) {
    if (blockPattern.test(line) || placeholderPattern.test(line) || line.trim() === '') {
      inBlock = blockPattern.test(line) || placeholderPattern.test(line)
      result.push(line)
    } else if (!inBlock && line.trim()) {
      result.push(`<p>${line}</p>`)
    } else {
      result.push(line)
    }
  }
  html = result.join('\n')

  // 合并被子列表打断的相邻 <ol> 块，保持有序列表序号连续
  html = html.replace(/<\/li><\/ol>(\s*(?:<ul>[\s\S]*?<\/ul>\s*)*)<ol>/g, '</li>$1')

  // ── 还原占位符（先数学后代码）──
  for (const { placeholder, html: mathHtml } of mathPlaceholders) {
    html = html.replace(placeholder, mathHtml)
  }
  for (const { placeholder, html: codeHtml } of codePlaceholders) {
    html = html.replace(placeholder, codeHtml)
  }

  return html
}

// ===== 提取标题用于 TOC =====
interface Heading {
  id: string
  text: string
  level: number
}

const headings = computed<Heading[]>(() => {
  const result: Heading[] = []
  const seenIds = new Set<string>()
  const lines = props.content.split('\n')
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (match) {
      const level = match[1].length
      const text = match[2].trim()
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
  return result
})

// ===== 消毒 HTML =====
const sanitizedHtml = computed(() => {
  const rawHtml = mdToHtml(props.content)
  return DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['target', 'rel', 'data-code'],
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'pre', 'code',
      'strong', 'em', 'a', 'span', 'div',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'blockquote', 'img', 'sup', 'sub', 'del'
    ]
  })
})

// ===== 代码高亮 =====
const highlightAll = () => {
  if (!contentRef.value) return
  nextTick(() => {
    contentRef.value?.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block as HTMLElement)
    })
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
  const container = contentRef.value?.closest('.overflow-y-auto') || contentRef.value
  container?.addEventListener('scroll', onScroll)
})
</script>

<style scoped>
.markdown-viewer {
  display: flex;
  gap: 24px;
  position: relative;
}

.toc-sidebar {
  width: 200px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
  border-right: 1px solid var(--lt-border);
  padding-right: 16px;
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

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
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
.markdown-content :deep(.task-checkbox) {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--lt-border);
  border-radius: 4px;
  margin-right: 8px;
  vertical-align: text-bottom;
  position: relative;
}
.markdown-content :deep(.task-checkbox.checked) {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
}
.markdown-content :deep(.task-checkbox.checked)::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 4px;
  height: 8px;
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

/* highlight.js 主题微调 */
.markdown-content :deep(.hljs) {
  background: transparent !important;
}
</style>
