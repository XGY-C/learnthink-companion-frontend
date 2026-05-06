<template>
  <div class="markdown-viewer">
    <!-- 目录 TOC -->
    <div v-if="showToc && headings.length > 0" class="toc-sidebar">
      <div class="toc-header">目录</div>
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
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'

const props = withDefaults(defineProps<{
  content: string
  showToc?: boolean
}>(), {
  showToc: true
})

const contentRef = ref<HTMLElement | null>(null)
const activeHeadingId = ref('')

// ===== Markdown 转 HTML =====
const mdToHtml = (md: string): string => {
  let html = md

  // 代码块（必须优先处理，防止内部内容被其他规则匹配）
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const trimmedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const langClass = lang ? ` class="language-${lang}"` : ''
    return `<pre><code${langClass}>${trimmedCode}</code></pre>`
  })

  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // 标题（生成 id 用于锚点）
  html = html.replace(/^#### (.+)$/gm, (_, text) => {
    const id = text.trim().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '')
    return `<h4 id="${id}">${text}</h4>`
  })
  html = html.replace(/^### (.+)$/gm, (_, text) => {
    const id = text.trim().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '')
    return `<h3 id="${id}">${text}</h3>`
  })
  html = html.replace(/^## (.+)$/gm, (_, text) => {
    const id = text.trim().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '')
    return `<h2 id="${id}">${text}</h2>`
  })
  html = html.replace(/^# (.+)$/gm, (_, text) => {
    const id = text.trim().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '')
    return `<h1 id="${id}">${text}</h1>`
  })

  // 粗体与斜体
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // 无序列表
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')

  // 有序列表
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
  html = html.replace(/(?:<li>.*<\/li>\n?)+/g, (match) => {
    if (!match.startsWith('<ol>')) return '<ol>' + match + '</ol>'
    return match
  })

  // 链接
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')

  // 分割线
  html = html.replace(/^---$/gm, '<hr />')

  // 段落（包裹非块元素的文本）
  const blockPattern = /^<\/?(h[1-4]|ul|ol|li|pre|code|hr|table|blockquote)/m
  const lines = html.split('\n')
  const result: string[] = []
  let inBlock = false
  for (const line of lines) {
    if (blockPattern.test(line) || line.trim() === '') {
      inBlock = blockPattern.test(line)
      result.push(line)
    } else if (!inBlock && line.trim()) {
      result.push(`<p>${line}</p>`)
    } else {
      result.push(line)
    }
  }
  html = result.join('\n')

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
  const lines = props.content.split('\n')
  for (const line of lines) {
    const match = line.match(/^(#{1,4})\s+(.+)$/)
    if (match) {
      const level = match[1].length
      const text = match[2].trim()
      const id = text.replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '')
      result.push({ id, text, level })
    }
  }
  return result
})

// ===== 消毒 HTML =====
const sanitizedHtml = computed(() => {
  const rawHtml = mdToHtml(props.content)
  return DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['target', 'rel'],
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'pre', 'code',
      'strong', 'em', 'a', 'span', 'div',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'blockquote', 'img', 'sup', 'sub'
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
  const el = contentRef.value?.querySelector(`#${CSS.escape(id)}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

// 滚动监听高亮当前标题
const onScroll = () => {
  if (!contentRef.value) return
  const hTags = contentRef.value.querySelectorAll('h1, h2, h3, h4')
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
  border-right: 1px solid #e2e8f0;
  padding-right: 16px;
}

.toc-header {
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e2e8f0;
}

.toc-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.toc-item {
  font-size: 12px;
  color: #64748b;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.15s;
  line-height: 1.4;
}

.toc-item:hover {
  color: var(--el-color-primary);
  background: #f1f5f9;
}

.toc-item.toc-active {
  color: var(--el-color-primary);
  background: #eff6ff;
  font-weight: 600;
}

.toc-level-2 { padding-left: 8px; }
.toc-level-3 { padding-left: 20px; font-size: 11px; }
.toc-level-4 { padding-left: 32px; font-size: 11px; }

.markdown-content {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  line-height: 1.8;
  color: #334155;
}

.markdown-content :deep(h1) {
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
  margin: 32px 0 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid #e2e8f0;
}

.markdown-content :deep(h2) {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  margin: 28px 0 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid #e2e8f0;
}

.markdown-content :deep(h3) {
  font-size: 17px;
  font-weight: 600;
  color: #334155;
  margin: 24px 0 10px;
}

.markdown-content :deep(h4) {
  font-size: 15px;
  font-weight: 600;
  color: #475569;
  margin: 20px 0 8px;
}

.markdown-content :deep(p) {
  margin: 12px 0;
}

.markdown-content :deep(pre) {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  overflow-x: auto;
  margin: 16px 0;
  font-size: 13px;
  line-height: 1.6;
}

.markdown-content :deep(code) {
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
  color: #e11d48;
}

.markdown-content :deep(pre code) {
  background: transparent;
  padding: 0;
  color: #334155;
  font-size: 13px;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 8px 0;
  padding-left: 24px;
}

.markdown-content :deep(li) {
  margin: 4px 0;
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
  background: #f8fafc;
  color: #64748b;
  border-radius: 0 8px 8px 0;
}

.markdown-content :deep(hr) {
  margin: 24px 0;
  border: none;
  border-top: 1px solid #e2e8f0;
}

.markdown-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid #e2e8f0;
  padding: 8px 12px;
  text-align: left;
  font-size: 13px;
}

.markdown-content :deep(th) {
  background: #f8fafc;
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
