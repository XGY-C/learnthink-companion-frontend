/** KaTeX 自动渲染注入片段（CDN 资源 + auto-render 初始化） */
export const KATEX_INJECT = `
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"><\/script>
<script>
document.addEventListener("DOMContentLoaded",function(){renderMathInElement(document.body,{delimiters:[{left:"$$",right:"$$",display:true},{left:"\\\\[",right:"\\\\]",display:true},{left:"\\\\(",right:"\\\\)",display:false}]})});
<\/script>`

/** 将 KaTeX 注入片段插入到 HTML 的 <head> 中 */
export function injectKatex(html: string): string {
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, m => m + KATEX_INJECT)
  }
  return `<!DOCTYPE html><html><head>${KATEX_INJECT}</head><body>${html}</body></html>`
}

/** 下载自包含 HTML 文件 */
export function downloadHtml(content: string, title: string) {
  const blob = new Blob([injectKatex(content)], { type: 'text/html;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${title}.html`
  a.click()
  URL.revokeObjectURL(a.href)
}

/** 在新窗口打开后调用打印（用于导出 PDF） */
export function printHtml(content: string) {
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(injectKatex(content))
  w.document.close()
  w.focus()
  // 等待内容加载完成后打印；2s 兜底防止 onload 不触发
  let done = false
  const print = () => { if (!done) { done = true; w.print() } }
  w.addEventListener('load', print)
  setTimeout(print, 2000)
}
