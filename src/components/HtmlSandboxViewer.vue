<template>
  <div class="html-sandbox-wrap">
    <iframe
      class="html-sandbox-frame"
      :title="title || '交互文档'"
      sandbox="allow-scripts allow-modals allow-popups allow-forms"
      :srcdoc="srcdoc"
      @load="onLoad"
    />
    <div v-if="loading" class="html-sandbox-loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>文档加载中…</span>
    </div>
    <div v-if="error" class="html-sandbox-error">
      <el-icon><WarningFilled /></el-icon>
      <span>文档渲染失败，可尝试下载后本地打开。</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { WarningFilled, Loading } from '@element-plus/icons-vue'
import { KATEX_INJECT } from '@/utils/htmlExport'

const props = defineProps<{ content: string; title?: string }>()

const loading = ref(true)
const error = ref(false)
let loadTimer: number | undefined

// 1) 主题变量 + 字体注入：运行时读取父窗口 --lt-* 与 body 字体，注入 iframe（不硬编码）
const themeCss = computed(() => {
  const root = getComputedStyle(document.documentElement)
  const body = getComputedStyle(document.body)
  const pick = (name: string) => root.getPropertyValue(name).trim()
  const vars = ['--lt-brand', '--lt-orange', '--lt-ai', '--lt-success', '--lt-danger',
    '--lt-text-primary', '--lt-text-secondary', '--lt-text-auxiliary', '--lt-bg-page',
    '--lt-bg-card', '--lt-border']
  const decl = vars.map(v => `${v}: ${pick(v) || 'initial'};`).join('')
  const font = body.getPropertyValue('font-family').trim() || 'system-ui, sans-serif'
  return `:root{${decl}} body{font-family:${font};color:var(--lt-text-primary);
    background:var(--lt-bg-card);line-height:1.7;padding:24px;max-width:880px;margin:0 auto}
    h1,h2,h3{color:var(--lt-text-primary)} a{color:var(--lt-brand)}
    sup[data-source]{color:var(--lt-ai);cursor:default;font-weight:600}
    table{border-collapse:collapse} td,th{border:1px solid var(--lt-border);padding:6px 10px}`
})

// 2) CSP：限制外部资源到白名单，connect-src 'none' 阻断 fetch/XHR 数据外发
const CSP = "default-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com https://cdn.plot.ly data: blob:; " +
  "script-src 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com https://cdn.plot.ly; " +
  "style-src 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
  "img-src data: blob: https:; connect-src 'none';"

// 3) 预处理：提取干净的 HTML（双重防御，后端也做同样清洗）
function extractHtml(raw: string): string {
  // 1) 尝试 ```html ... ``` 代码块
  const fenceMatch = raw.match(/```(?:html)?\s*([\s\S]*?)```/i)
  if (fenceMatch) return fenceMatch[1].trim()
  // 2) 定位 <!DOCTYPE html> 或 <html> 首标签
  const docIdx = Math.min(
    raw.search(/<!doctype\s+html/i) >= 0 ? raw.search(/<!doctype\s+html/i) : Infinity,
    raw.search(/<html[^>]*>/i) >= 0 ? raw.search(/<html[^>]*>/i) : Infinity
  )
  if (docIdx < Infinity) {
    const endIdx = raw.search(/<\/html>\s*$/i)
    return endIdx >= docIdx ? raw.slice(docIdx, endIdx + 7).trim() : raw.slice(docIdx).trim()
  }
  return raw.trim()
}

// 4) 不用 DOMPurify 清洗内容：DOMPurify 默认移除 <script> 会破坏 JS 交互。
//    安全完全由 iframe sandbox（allow-scripts 无 allow-same-origin，JS 无法逃逸）+ CSP 承担。
const srcdoc = computed(() => {
  const raw = extractHtml(props.content || '')
  const metaCsp = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`
  const theme = `<style>${themeCss.value}</style>`
  if (/<head[^>]*>/i.test(raw)) {
    return raw.replace(/<head[^>]*>/i, m => `${m}${metaCsp}${theme}${KATEX_INJECT}`)
  }
  return `<!DOCTYPE html><html><head>${metaCsp}${theme}${KATEX_INJECT}</head><body>${raw}</body></html>`
})

function onLoad() {
  window.clearTimeout(loadTimer)
  loading.value = false
}
watch(srcdoc, () => {
  loading.value = true
  error.value = false
  window.clearTimeout(loadTimer)
  // 超时兜底：8s 未 load 完提示（死循环无法在沙箱层中断，仅提示）
  loadTimer = window.setTimeout(() => { loading.value = false; error.value = true }, 8000)
}, { immediate: true })
onBeforeUnmount(() => window.clearTimeout(loadTimer))
</script>

<style scoped>
.html-sandbox-wrap {
  position: relative;
  width: 100%;
  height: calc(100vh - 88px);
  min-height: 520px;
}
.html-sandbox-frame {
  width: 100%; height: 100%; border: 0;
  border-radius: 0; background: var(--lt-bg-card);
}
.html-sandbox-loading {
  position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: 20px;
  background: var(--lt-bg-card); border: 1px solid var(--lt-border);
  color: var(--lt-text-secondary); font-size: 13px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.html-sandbox-error {
  padding: 16px; color: var(--lt-danger);
  display: flex; align-items: center; gap: 8px;
}
</style>
