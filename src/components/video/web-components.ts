/**
 * Web Components 注册文件
 * 所有 <lt-*> 自定义元素在此注册，内部库懒加载。
 * 调用 registerWebComponents() 确保注册（幂等，多次调用安全）。
 */

// ============================================================
// <lt-code> 代码语法高亮 + 逐行揭示
// ============================================================
class LtCode extends HTMLElement {
  private highlighted = false

  connectedCallback() {
    if (this.highlighted) return
    this.highlighted = true
    this.renderCode()
  }

  private async renderCode() {
    const language = this.getAttribute('language') || 'plaintext'
    const rawCode = this.textContent || ''

    // 清空原始内容
    this.innerHTML = ''
    const header = document.createElement('div')
    header.className = 'lt-code-header'

    const langLabel = document.createElement('span')
    langLabel.className = 'lt-code-lang'
    langLabel.textContent = language

    const dots = document.createElement('span')
    dots.className = 'lt-code-dots'
    dots.innerHTML = '<i class="dot dot-red"></i><i class="dot dot-yellow"></i><i class="dot dot-green"></i>'

    header.appendChild(langLabel)
    header.appendChild(dots)

    const pre = document.createElement('pre')
    const code = document.createElement('code')
    code.className = `language-${language}`

    // 修复：逐行高亮，避免切分跨行 span
    const lines = rawCode.split('\n')
    const hljs = (await import('highlight.js')).default

    code.innerHTML = lines.map((line, i) => {
      let highlighted: string
      try {
        if (hljs.getLanguage(language)) {
          highlighted = hljs.highlight(line, { language }).value
        } else {
          highlighted = hljs.highlightAuto(line).value
        }
      } catch {
        highlighted = line
      }
      return `<span class="lt-code-line" data-line="${i}">${highlighted}</span>`
    }).join('\n')

    pre.appendChild(code)
    this.appendChild(header)
    this.appendChild(pre)
  }
}

// ============================================================
// <lt-callout> 标注框 / 提示卡片
// ============================================================
class LtCallout extends HTMLElement {
  connectedCallback() {
    // 纯 CSS 样式，内容保持不变
  }
}

// ============================================================
// <lt-formula> LaTeX 公式渲染
// ============================================================
class LtFormula extends HTMLElement {
  private rendered = false

  connectedCallback() {
    if (this.rendered) return
    this.rendered = true
    this.renderFormula()
  }

  private async renderFormula() {
    const latex = this.textContent || ''
    this.innerHTML = ''
    const container = document.createElement('span')
    try {
      const katex = (await import('katex')).default
      // 获取 katex CSS 文本，注入到 Shadow DOM 内（Shadow DOM 隔离了外部样式）
      const katexCssModule = await import('katex/dist/katex.min.css?inline')
      const katexCss = katexCssModule.default
      katex.render(latex, container, {
        throwOnError: false,
        displayMode: !this.hasAttribute('inline'),
      })
      // 注入 katex 样式到 Shadow DOM（仅注入一次）
      const root = this.getRootNode()
      if (root instanceof ShadowRoot && !root.querySelector('style[data-katex]')) {
        const styleEl = document.createElement('style')
        styleEl.setAttribute('data-katex', '')
        styleEl.textContent = katexCss
        root.appendChild(styleEl)
      }
    } catch {
      container.textContent = latex
    }
    this.appendChild(container)
  }
}

// ============================================================
// <lt-chart> 数据图表
// ============================================================
class LtChart extends HTMLElement {
  private chartInstance: any = null
  private resizeObserver: ResizeObserver | null = null
  private rendering = false

  static get observedAttributes() {
    return ['type', 'data-data']
  }

  connectedCallback() {
    this.renderChart()
    // 监听容器尺寸变化，ECharts 在 Shadow DOM 中无法自动检测
    this.resizeObserver = new ResizeObserver(() => {
      if (this.chartInstance) {
        const w = this.offsetWidth
        const h = this.offsetHeight
        if (w > 0 && h > 0) this.chartInstance.resize({ width: w, height: h })
      }
    })
    this.resizeObserver.observe(this)
  }

  attributeChangedCallback() {
    if (this.isConnected) this.renderChart()
  }

  private async renderChart() {
    if (this.rendering) return
    this.rendering = true
    try {
      const chartType = this.getAttribute('type') || 'bar'
      const rawData = this.getAttribute('data-data')
      if (!rawData) return

      // 修复：创建新实例前销毁旧实例
      if (this.chartInstance) {
        this.chartInstance.dispose()
        this.chartInstance = null
      }

      const data = JSON.parse(rawData)
      this.innerHTML = ''
      const canvas = document.createElement('div')
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      this.appendChild(canvas)

      // 懒加载 ECharts（namespace import，与项目现有用法一致）
      const echarts = await import('echarts')

      // 显式传入尺寸，避免 Shadow DOM 中 ECharts 检测到 0x0
      const w = this.offsetWidth || 300
      const h = this.offsetHeight || 200
      const option = this.buildOption(chartType, data)
      this.chartInstance = echarts.init(canvas, null, { width: w, height: h })
      this.chartInstance.setOption(option)
    } catch (e) {
      console.warn('lt-chart render error:', e)
    } finally {
      this.rendering = false
    }
  }

  private buildOption(type: string, data: any) {
    const base = {
      backgroundColor: 'transparent',
      textStyle: { color: '#9ca3af' },
      grid: { top: 30, right: 20, bottom: 40, left: 50 },
    }

    switch (type) {
      case 'bar':
        return {
          ...base,
          xAxis: { type: 'category', data: data.labels, axisLine: { lineStyle: { color: '#374151' } } },
          yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1f2937' } } },
          series: [{
            type: 'bar',
            data: data.values,
            itemStyle: { color: '#2B6FFF', borderRadius: [4, 4, 0, 0] }
          }]
        }
      case 'line':
        return {
          ...base,
          xAxis: { type: 'category', data: data.labels },
          yAxis: { type: 'value' },
          series: [{
            type: 'line',
            data: data.values,
            smooth: true,
            lineStyle: { color: '#2B6FFF', width: 2 },
            itemStyle: { color: '#2B6FFF' },
            areaStyle: { color: 'rgba(43, 111, 255, 0.1)' }
          }]
        }
      case 'pie':
      case 'donut':
        return {
          ...base,
          series: [{
            type: 'pie',
            radius: type === 'donut' ? ['40%', '70%'] : '70%',
            data: data.labels.map((label: string, i: number) => ({
              name: label,
              value: data.values[i]
            })),
            color: ['#2B6FFF', '#FF8C42', '#7C5CFC', '#22c55e', '#ef4444']
          }]
        }
      default:
        return base
    }
  }

  disconnectedCallback() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
    if (this.chartInstance) {
      this.chartInstance.dispose()
      this.chartInstance = null
    }
  }
}

// ============================================================
// <lt-table> 数据表格（含 XSS 转义）
// ============================================================
class LtTable extends HTMLElement {
  connectedCallback() {
    const rawData = this.getAttribute('data-data')
    if (!rawData) return

    try {
      const data = JSON.parse(rawData)
      // 转义文本，防止 XSS（data-data 中的值未经过 DOMPurify 清洗）
      const esc = (s: string) => String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')

      this.innerHTML = `
        <table>
          <thead>
            <tr>${data.headers.map((h: string) => `<th>${esc(h)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${data.rows.map((row: string[], i: number) =>
              `<tr data-row="${i}">${row.map((cell: string) => `<td>${esc(cell)}</td>`).join('')}</tr>`
            ).join('')}
          </tbody>
        </table>
      `
    } catch (e) {
      console.warn('lt-table render error:', e)
    }
  }
}

// ============================================================
// <lt-arrow> 箭头 / 连接线
// ============================================================
class LtArrow extends HTMLElement {
  connectedCallback() {
    // 延迟到下一帧计算位置，确保其他 Web Component 已完成布局
    requestAnimationFrame(() => this.renderArrow())
  }

  private renderArrow() {
    const from = this.getAttribute('from')
    const to = this.getAttribute('to')
    if (!from || !to) return

    const root = this.getRootNode() as ShadowRoot | Document
    const fromEl = root.querySelector(from)
    const toEl = root.querySelector(to)
    if (!fromEl || !toEl) return

    const fromRect = fromEl.getBoundingClientRect()
    const toRect = toEl.getBoundingClientRect()
    const containerRect = (this.parentElement as HTMLElement).getBoundingClientRect()

    const x1 = fromRect.right - containerRect.left
    const y1 = fromRect.top + fromRect.height / 2 - containerRect.top
    const x2 = toRect.left - containerRect.left
    const y2 = toRect.top + toRect.height / 2 - containerRect.top

    const midX = (x1 + x2) / 2

    // 唯一 ID，避免多个箭头的 marker 冲突
    const markerId = 'arrowhead-' + Math.random().toString(36).slice(2, 9)

    this.innerHTML = `
      <svg style="position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;">
        <defs>
          <marker id="${markerId}" markerWidth="10" markerHeight="7"
                  refX="10" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="var(--lt-text-secondary)" />
          </marker>
        </defs>
        <path d="M ${x1} ${y1} Q ${midX} ${y1}, ${midX} ${(y1+y2)/2} T ${x2} ${y2}"
              stroke="var(--lt-text-secondary)" stroke-width="1.5" fill="none"
              marker-end="url(#${markerId})"
              data-enter="draw" data-delay="0" />
      </svg>
    `
  }
}

// ============================================================
// <lt-flowchart> 流程图 / 思维导图
// ============================================================
class LtFlowchart extends HTMLElement {
  private static counter = 0

  connectedCallback() {
    this.renderFlowchart()
  }

  private async renderFlowchart() {
    const rawData = this.getAttribute('data-data')
    if (!rawData) return

    try {
      const data = JSON.parse(rawData)
      // 清洗节点 ID 和标签，防止注入 Mermaid 语法或 HTML
      const sanitize = (s: string) => String(s).replace(/[<>"'{}]/g, '').replace(/\n/g, ' ')

      // 构建 Mermaid 语法
      let graph = 'graph TD\n'
      data.nodes.forEach((node: any) => {
        const shape = node.shape === 'round' ? '(' : '['
        const closeShape = node.shape === 'round' ? ')' : ']'
        graph += `  ${sanitize(node.id)}${shape}"${sanitize(node.label)}"${closeShape}\n`
      })
      data.edges.forEach((edge: any) => {
        const arrow = edge.label ? `--"${sanitize(edge.label)}"-->` : '-->'
        graph += `  ${sanitize(edge.from)} ${arrow} ${sanitize(edge.to)}\n`
      })

      const mermaid = (await import('mermaid')).default
      mermaid.initialize({ startOnLoad: false })
      // 修复：使用递增计数器替代 Date.now()
      const id = `flowchart-${++LtFlowchart.counter}`
      const { svg } = await mermaid.render(id, graph)
      this.innerHTML = svg
    } catch (e) {
      console.warn('lt-flowchart render error:', e)
    }
  }
}

// ============================================================
// <lt-timeline> 时间轴
// ============================================================
class LtTimeline extends HTMLElement {
  connectedCallback() {
    const rawData = this.getAttribute('data-data')
    if (!rawData) return

    try {
      const data = JSON.parse(rawData)
      const esc = (s: string) => String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')

      const items = (data.items || []).map((item: any, i: number) => {
        const title = esc(item.title || '')
        const desc = esc(item.description || '')
        return `
          <div class="lt-timeline-item" data-index="${i}">
            <div class="lt-timeline-dot"></div>
            <div class="lt-timeline-content">
              <div class="lt-timeline-title">${title}</div>
              ${desc ? `<div class="lt-timeline-desc">${desc}</div>` : ''}
            </div>
          </div>
        `
      }).join('')

      this.innerHTML = `<div class="lt-timeline-container">${items}</div>`
    } catch (e) {
      console.warn('lt-timeline render error:', e)
    }
  }
}

// ============================================================
// 注册所有组件（幂等）
// ============================================================
import { Lt3d } from './Lt3d'

export function registerWebComponents() {
  if (!customElements.get('lt-code')) customElements.define('lt-code', LtCode)
  if (!customElements.get('lt-callout')) customElements.define('lt-callout', LtCallout)
  if (!customElements.get('lt-formula')) customElements.define('lt-formula', LtFormula)
  if (!customElements.get('lt-chart')) customElements.define('lt-chart', LtChart)
  if (!customElements.get('lt-table')) customElements.define('lt-table', LtTable)
  if (!customElements.get('lt-arrow')) customElements.define('lt-arrow', LtArrow)
  if (!customElements.get('lt-flowchart')) customElements.define('lt-flowchart', LtFlowchart)
  if (!customElements.get('lt-timeline')) customElements.define('lt-timeline', LtTimeline)
  if (!customElements.get('lt-3d')) customElements.define('lt-3d', Lt3d)
}
