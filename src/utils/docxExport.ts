import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  BorderStyle, ShadingType, Table, TableRow, TableCell, WidthType,
  VerticalAlign, LevelFormat, Footer, PageNumber, ImageRun,
} from 'docx'

// ── 颜色方案 ──
const C = {
  H1: '1F3864',
  H2: '2E5395',
  H3: '2B6FFF',
  H4: '595959',
  TITLE: '1F3864',
  BODY: '333333',
  BLOCKQUOTE_BG: 'EDF2FF',
  BLOCKQUOTE_BORDER: '4472C4',
  BLOCKQUOTE_TEXT: '555555',
  CODE_BG: 'F5F7FA',
  CODE_BORDER: 'D5DDE5',
  CODE_TEXT: '333333',
  INLINE_CODE_BG: 'EEF1F5',
  TABLE_HEADER_BG: '4472C4',
  TABLE_HEADER_FG: 'FFFFFF',
  TABLE_ALT_ROW: 'DCE6F7',
  TABLE_BORDER: 'B4C7E7',
  HR_COLOR: 'BFBFBF',
  FOOTER: '888888',
}

// ── LaTeX 符号 -> Unicode ──
const LATEX_SYMBOLS: Record<string, string> = {
  '\\to': '\u2192', '\\rightarrow': '\u2192', '\\leftarrow': '\u2190',
  '\\Rightarrow': '\u21D2', '\\Leftrightarrow': '\u21D4', '\\implies': '\u21D2', '\\iff': '\u21D4',
  '\\lambda': '\u03BB', '\\mu': '\u03BC', '\\sigma': '\u03C3', '\\Sigma': '\u03A3',
  '\\sum': '\u2211', '\\int': '\u222B', '\\prod': '\u220F',
  '\\infty': '\u221E', '\\partial': '\u2202',
  '\\alpha': '\u03B1', '\\beta': '\u03B2', '\\gamma': '\u03B3', '\\delta': '\u03B4',
  '\\epsilon': '\u03B5', '\\theta': '\u03B8', '\\pi': '\u03C0', '\\rho': '\u03C1', '\\omega': '\u03C9',
  '\\times': '\u00D7', '\\cdot': '\u00B7', '\\pm': '\u00B1', '\\div': '\u00F7',
  '\\leq': '\u2264', '\\geq': '\u2265', '\\neq': '\u2260', '\\approx': '\u2248',
  '\\equiv': '\u2261', '\\propto': '\u221D', '\\sim': '\u223C',
  '\\subset': '\u2282', '\\subseteq': '\u2286', '\\forall': '\u2200', '\\exists': '\u2203',
  '\\in': '\u2208', '\\notin': '\u2209', '\\cup': '\u222A', '\\cap': '\u2229',
  '\\emptyset': '\u2205', '\\nabla': '\u2207', '\\langle': '\u27E8', '\\rangle': '\u27E9',
  '\\land': '\u2227', '\\lor': '\u2228', '\\neg': '\u00AC',
}

// ── Unicode 上下标 ──
const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'n': 'ⁿ', 'i': 'ⁱ',
}
const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
  'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
  'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
  'v': 'ᵥ', 'x': 'ₓ',
}

function toSup(s: string): string { return s.split('').map(c => SUP[c] || c).join('') }
function toSub(s: string): string { return s.split('').map(c => SUB[c] || c).join('') }

function convertLatex(text: string): string {
  let s = text

  // \text{}, \mathrm{}, \mathbf{} -> 纯文本
  s = s.replace(/\\text\{([^}]*)\}/g, '$1')
  s = s.replace(/\\mathrm\{([^}]*)\}/g, '$1')
  s = s.replace(/\\mathbf\{([^}]*)\}/g, '$1')
  s = s.replace(/\\textit\{([^}]*)\}/g, '$1')
  s = s.replace(/\\boldsymbol\{([^}]*)\}/g, '$1')

  // 分数 \frac{a}{b} -> (a)/(b)
  s = s.replace(/\\[dt]?frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')

  // 根号 \sqrt[n]{x} -> ⁿ√(x), \sqrt{x} -> √(x)
  s = s.replace(/\\sqrt\[([^\]]*)\]\{([^}]*)\}/g, (_m, n, x) => `${toSup(n)}√(${x})`)
  s = s.replace(/\\sqrt\{([^}]*)\}/g, '√($1)')

  // 组合数 \binom{n}{k} -> C(n,k)
  s = s.replace(/\\binom\{([^}]*)\}\{([^}]*)\}/g, 'C($1,$2)')

  // 上下标 ^{...}, _{...}
  s = s.replace(/\^\{([^}]*)\}/g, (_m, c) => toSup(c))
  s = s.replace(/_\{([^}]*)\}/g, (_m, c) => toSub(c))
  // 单字符上下标 ^a, _a
  s = s.replace(/\^([a-zA-Z0-9])/g, (_m, c) => toSup(c))
  s = s.replace(/_([a-zA-Z0-9])/g, (_m, c) => toSub(c))

  // 重音符号
  s = s.replace(/\\overline\{([^}]*)\}/g, '$1\u0304')
  s = s.replace(/\\bar\{([^}]*)\}/g, '$1\u0304')
  s = s.replace(/\\hat\{([^}]*)\}/g, '$1\u0302')
  s = s.replace(/\\vec\{([^}]*)\}/g, '$1\u20D7')
  s = s.replace(/\\dot\{([^}]*)\}/g, '$1\u0307')
  s = s.replace(/\\ddot\{([^}]*)\}/g, '$1\u0308')
  s = s.replace(/\\tilde\{([^}]*)\}/g, '$1\u0303')

  // 间距命令
  s = s.replace(/\\[ ,;:!]/g, ' ')
  s = s.replace(/\\quad/g, '  ')
  s = s.replace(/\\qquad/g, '    ')

  // \left, \right, 显示模式等
  s = s.replace(/\\left/g, '')
  s = s.replace(/\\right/g, '')
  s = s.replace(/\\displaystyle/g, '')
  s = s.replace(/\\textstyle/g, '')
  s = s.replace(/\\limits/g, '')
  s = s.replace(/\\nolimits/g, '')

  // 已知符号替换
  for (const [cmd, ch] of Object.entries(LATEX_SYMBOLS)) {
    s = s.replace(new RegExp(cmd.replace(/\\/g, '\\\\'), 'g'), ch)
  }

  // 删除剩余未识别命令
  s = s.replace(/\\[a-zA-Z]+/g, '')
  // 删除花括号
  s = s.replace(/[{}]/g, '')

  return s.trim()
}

function preprocessMath(md: string): string {
  return md
    // 块级公式 $$...$$ 和 \[...\]
    .replace(/\$\$([\s\S]*?)\$\$/g, (_m, latex) => '\n\n' + convertLatex(latex) + '\n\n')
    .replace(/\\\[([\s\S]*?)\\\]/g, (_m, latex) => '\n\n' + convertLatex(latex) + '\n\n')
    // 行内公式 $...$（过滤货币金额）
    .replace(/\$([^$\n]+?)\$/g, (m, latex) => {
      if (/^\s*\d+([.,]\d+)?\s*$/.test(latex)) return m // 跳过 $3.50 等金额
      return convertLatex(latex)
    })
    // 行内公式 \(...\)
    .replace(/\\\((.+?)\\\)/g, (_m, latex) => convertLatex(latex))
}

// ── inline parsing ──

interface InlineToken { text: string; bold?: boolean; italic?: boolean; code?: boolean; strike?: boolean }

function parseInline(raw: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let s = raw.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1').replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
  const re = /(\*\*\*(.+?)\*\*\*)|(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`([^`]+)`)|(~~(.+?)~~)/g
  let last = 0, m
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) tokens.push({ text: s.slice(last, m.index) })
    if (m[1]) tokens.push({ text: m[2], bold: true, italic: true })
    else if (m[3]) tokens.push({ text: m[4], bold: true })
    else if (m[5]) tokens.push({ text: m[6], italic: true })
    else if (m[7]) tokens.push({ text: m[8], code: true })
    else if (m[9]) tokens.push({ text: m[10], strike: true })
    last = m.index + m[0].length
  }
  if (last < s.length) tokens.push({ text: s.slice(last) })
  return tokens.length ? tokens : [{ text: s }]
}

function buildRuns(tokens: InlineToken[], extra?: { italic?: boolean; color?: string }): TextRun[] {
  return tokens.map(t => {
    const o: any = { text: t.text, size: 21, color: C.BODY }
    if (t.bold) o.bold = true
    if (t.italic || extra?.italic) o.italics = true
    if (t.strike) o.strike = true
    if (extra?.color) o.color = extra.color
    if (t.code) {
      o.font = 'Consolas'
      o.shading = { type: ShadingType.CLEAR, color: 'auto', fill: C.INLINE_CODE_BG }
      o.size = 20
    }
    return new TextRun(o)
  })
}

// ── markdown parsing ──

type Token =
  | { type: 'h1' | 'h2' | 'h3' | 'h4'; text: string }
  | { type: 'p'; text: string }
  | { type: 'blockquote'; text: string }
  | { type: 'code'; text: string; lang: string }
  | { type: 'ul' | 'ol'; items: InlineToken[][] }
  | { type: 'hr' }
  | { type: 'table'; header: string[]; rows: string[][] }

/** 解析表格行，正确处理空单元格 */
function parseTableRow(line: string): string[] {
  return line.split('|').slice(1, -1).map(c => c.trim())
}

function parseMd(md: string): Token[] {
  const lines = md.split('\n')
  const tokens: Token[] = []
  let i = 0
  while (i < lines.length) {
    const L = lines[i], t = L.trim()

    // 表格
    if (L.startsWith('|') && lines[i + 1]?.startsWith('|') && lines[i + 1].includes('-')) {
      const h = parseTableRow(L)
      const rows: string[][] = []; i += 2
      while (i < lines.length && lines[i].startsWith('|')) { rows.push(parseTableRow(lines[i])); i++ }
      tokens.push({ type: 'table', header: h, rows }); continue
    }
    // 代码块
    if (L.startsWith('```')) {
      const lang = L.slice(3).trim(); const code: string[] = []; i++
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i++ }
      i++; tokens.push({ type: 'code', text: code.join('\n'), lang }); continue
    }
    // 分割线
    if (/^---+$/.test(t)) { tokens.push({ type: 'hr' }); i++; continue }
    // 标题
    const hm = L.match(/^(#{1,4})\s+(.+)$/)
    if (hm) {
      const level = hm[1].length
      if (level === 1) tokens.push({ type: 'h1', text: hm[2] })
      else if (level === 2) tokens.push({ type: 'h2', text: hm[2] })
      else if (level === 3) tokens.push({ type: 'h3', text: hm[2] })
      else tokens.push({ type: 'h4', text: hm[2] })
      i++; continue
    }
    // 引用块
    if (L.startsWith('>')) {
      const q: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) { q.push(lines[i].replace(/^>\s?/, '')); i++ }
      tokens.push({ type: 'blockquote', text: q.join('\n') }); continue
    }
    // 无序列表
    if (/^[-*]\s+.+$/.test(L)) {
      const items: InlineToken[][] = []
      while (i < lines.length && /^[-*]\s+.+$/.test(lines[i])) { items.push(parseInline(lines[i].replace(/^[-*]\s+/, ''))); i++ }
      tokens.push({ type: 'ul', items }); continue
    }
    // 有序列表
    if (/^\d+\.\s+.+$/.test(L)) {
      const items: InlineToken[][] = []
      while (i < lines.length && /^\d+\.\s+.+$/.test(lines[i])) { items.push(parseInline(lines[i].replace(/^\d+\.\s+/, ''))); i++ }
      tokens.push({ type: 'ol', items }); continue
    }
    // 空行
    if (t === '') { i++; continue }
    // 段落
    const pl: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('```') && !lines[i].startsWith('|') && !lines[i].startsWith('>') && !/^(#{1,4}\s|[-*]\s+|\d+\.\s+|---+)/.test(lines[i])) { pl.push(lines[i]); i++ }
    if (pl.length) tokens.push({ type: 'p', text: pl.join('\n') })
    else i++
  }
  return tokens
}

// ── SVG 主题 CSS（亮色模式，注入到 SVG 内以便在 <img> 中渲染）──

const SVG_THEME_CSS = [
  'text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;dominant-baseline:central}',
  'text.t,text.th{font-size:14px;fill:#1f2937}',
  'text.th{font-weight:500}',
  'text.ts{font-size:12px;fill:#6b7280}',
  '.box{fill:#ffffff;stroke:#d1d5db;stroke-width:.5}',
  '.arr{stroke:#6b7280;stroke-width:1.5;fill:none!important}',
  '.leader{stroke:#9ca3af;stroke-width:.5;stroke-dasharray:3 3;fill:none!important}',
  '.c-gray rect,.c-gray circle,.c-gray ellipse,.c-gray polygon,.c-gray path,.c-gray line{fill:#f1efe8;stroke:#5f5e5a}',
  '.c-gray text{fill:#2c2c2a}',
  '.c-blue rect,.c-blue circle,.c-blue ellipse,.c-blue polygon,.c-blue path,.c-blue line{fill:#e6f1fb;stroke:#185fa5}',
  '.c-blue text{fill:#0c447c}',
  '.c-teal rect,.c-teal circle,.c-teal ellipse,.c-teal polygon,.c-teal path,.c-teal line{fill:#e1f5ee;stroke:#0f6e56}',
  '.c-teal text{fill:#085041}',
  '.c-coral rect,.c-coral circle,.c-coral ellipse,.c-coral polygon,.c-coral path,.c-coral line{fill:#faece7;stroke:#993c1d}',
  '.c-coral text{fill:#712b13}',
  '.c-pink rect,.c-pink circle,.c-pink ellipse,.c-pink polygon,.c-pink path,.c-pink line{fill:#fbeaf0;stroke:#993556}',
  '.c-pink text{fill:#72243e}',
  '.c-purple rect,.c-purple circle,.c-purple ellipse,.c-purple polygon,.c-purple path,.c-purple line{fill:#eeedfe;stroke:#534ab7}',
  '.c-purple text{fill:#3c3489}',
  '.c-green rect,.c-green circle,.c-green ellipse,.c-green polygon,.c-green path,.c-green line{fill:#eaf3de;stroke:#3b6d11}',
  '.c-green text{fill:#27500a}',
  '.c-amber rect,.c-amber circle,.c-amber ellipse,.c-amber polygon,.c-amber path,.c-amber line{fill:#faeeda;stroke:#854f0b}',
  '.c-amber text{fill:#633806}',
  '.c-red rect,.c-red circle,.c-red ellipse,.c-red polygon,.c-red path,.c-red line{fill:#fcebeb;stroke:#a32d2d}',
  '.c-red text{fill:#791f1f}',
].join('')

/** 向 SVG 注入项目主题 CSS，使 Canvas 渲染时正确显示样式 */
function injectSvgTheme(svg: string): string {
  // 检查 SVG 中是否使用了 c- 色板类且尚未注入样式
  if (/\bc-(gray|blue|teal|coral|pink|purple|green|amber|red)\b/i.test(svg) && !/<style>/i.test(svg)) {
    const m = svg.match(/<svg[\s\S]*?>/i)
    if (m) return svg.slice(0, m[0].length) + '<style>' + SVG_THEME_CSS + '</style>' + svg.slice(m[0].length)
  }
  return svg
}

// ── SVG -> PNG 转换（浏览器环境）──

interface PngImage { data: Uint8Array; width: number; height: number }

async function svgToPng(svgText: string, maxWidth = 580): Promise<PngImage | null> {
  try {
    let svg = injectSvgTheme(svgText)
    if (!/xmlns=/i.test(svg)) svg = svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"')

    const vbMatch = svg.match(/viewBox=["']([^"']+)["']/i)
    const wMatch = svg.match(/\bwidth=["']?([^"'\s>]+)/i)
    const hMatch = svg.match(/\bheight=["']?([^"'\s>]+)/i)
    let w = 400, h = 300
    if (wMatch && hMatch) { w = parseFloat(wMatch[1]); h = parseFloat(hMatch[1]) }
    else if (vbMatch) { const p = vbMatch[1].split(/[\s,]+/).map(Number); w = p[2] || 400; h = p[3] || 300 }
    if (!w || !h || isNaN(w) || isNaN(h)) { w = 400; h = 300 }

    const scale = Math.min(1, maxWidth / w)
    const outW = Math.round(w * scale)
    const outH = Math.round(h * scale)

    return new Promise((resolve) => {
      try {
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const img = new Image()
        let settled = false
        const finish = (r: PngImage | null) => { if (!settled) { settled = true; URL.revokeObjectURL(url); resolve(r) } }
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas')
            canvas.width = outW; canvas.height = outH
            const ctx = canvas.getContext('2d')
            if (!ctx) { finish(null); return }
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, outW, outH)
            ctx.drawImage(img, 0, 0, outW, outH)
            canvas.toBlob((pngBlob) => {
              if (!pngBlob) { finish(null); return }
              pngBlob.arrayBuffer().then(buf => finish({ data: new Uint8Array(buf), width: outW, height: outH }), () => finish(null))
            }, 'image/png')
          } catch { finish(null) }
        }
        img.onerror = () => finish(null)
        setTimeout(() => { if (!settled) finish(null) }, 5000)
        img.src = url
      } catch { resolve(null) }
    })
  } catch { return null }
}

// ── token -> docx blocks ──

function tokenToBlocks(token: Token): (Paragraph | Table)[] {
  switch (token.type) {
    case 'h1': return [new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: token.text })],
    })]
    case 'h2': return [new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: token.text })],
    })]
    case 'h3': return [new Paragraph({
      heading: HeadingLevel.HEADING_3,
      children: [new TextRun({ text: token.text })],
    })]
    case 'h4': return [new Paragraph({
      heading: HeadingLevel.HEADING_4,
      children: [new TextRun({ text: token.text })],
    })]
    case 'p': return [new Paragraph({
      spacing: { after: 160, line: 360 },
      indent: { firstLine: 420 },
      children: buildRuns(parseInline(token.text)),
    })]
    case 'blockquote': {
      const lines = token.text.split('\n').filter(l => l.trim())
      const paras = lines.map((line, idx) => new Paragraph({
        indent: { left: 420 },
        border: { left: { style: BorderStyle.SINGLE, size: 18, color: C.BLOCKQUOTE_BORDER, space: 12 } },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: C.BLOCKQUOTE_BG },
        spacing: {
          before: idx === 0 ? 100 : 0,
          after: idx === lines.length - 1 ? 100 : 0,
          line: 312,
        },
        children: buildRuns(parseInline(line), { italic: true, color: C.BLOCKQUOTE_TEXT }),
      }))
      paras.push(new Paragraph({ spacing: { after: 80 }, children: [] }))
      return paras
    }
    case 'code': {
      const codeLines = token.text.split('\n')
      const codeParas = codeLines.map(line => new Paragraph({
        spacing: { before: 0, after: 0, line: 276 },
        children: [new TextRun({ text: line || ' ', font: 'Consolas', size: 18, color: C.CODE_TEXT })],
      }))
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: C.CODE_BORDER },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: C.CODE_BORDER },
            left: { style: BorderStyle.SINGLE, size: 1, color: C.CODE_BORDER },
            right: { style: BorderStyle.SINGLE, size: 1, color: C.CODE_BORDER },
            insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          },
          rows: [new TableRow({
            children: [new TableCell({
              shading: { fill: C.CODE_BG },
              margins: { top: 120, bottom: 120, left: 200, right: 200 },
              children: codeParas,
            })],
          })],
        }),
        new Paragraph({ spacing: { after: 80 }, children: [] }),
      ]
    }
    case 'ul': return (token.items || []).map(item => new Paragraph({
      bullet: { level: 0 },
      spacing: { after: 60, line: 312 },
      children: buildRuns(item),
    }))
    case 'ol': return (token.items || []).map(item => new Paragraph({
      numbering: { reference: 'ol-ref', level: 0 },
      spacing: { after: 60, line: 312 },
      children: buildRuns(item),
    }))
    case 'hr': return [new Paragraph({
      spacing: { before: 200, after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.HR_COLOR } },
      children: [],
    })]
    case 'table': {
      const colCount = token.header.length || (token.rows[0]?.length ?? 1)
      const normHeader = [...token.header, ...Array(colCount).fill('')].slice(0, colCount)
      const normRows = token.rows.map(r => [...r, ...Array(colCount).fill('')].slice(0, colCount))
      const colWidth = Math.floor(100 / colCount)

      const rows: TableRow[] = []

      // 表头
      rows.push(new TableRow({
        tableHeader: true,
        children: normHeader.map(cell => new TableCell({
          width: { size: colWidth, type: WidthType.PERCENTAGE },
          shading: { fill: C.TABLE_HEADER_BG },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 60 },
            children: [new TextRun({ text: cell, bold: true, color: C.TABLE_HEADER_FG, size: 20 })],
          })],
        })),
      }))

      // 数据行（交替底色）
      normRows.forEach((row, rowIdx) => {
        const isAlt = rowIdx % 2 === 1
        rows.push(new TableRow({
          children: row.map(cell => new TableCell({
            width: { size: colWidth, type: WidthType.PERCENTAGE },
            shading: isAlt ? { fill: C.TABLE_ALT_ROW } : undefined,
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({
              spacing: { before: 40, after: 40 },
              children: buildRuns(parseInline(cell)),
            })],
          })),
        }))
      })

      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: C.TABLE_BORDER },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: C.TABLE_BORDER },
            left: { style: BorderStyle.SINGLE, size: 1, color: C.TABLE_BORDER },
            right: { style: BorderStyle.SINGLE, size: 1, color: C.TABLE_BORDER },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: C.TABLE_BORDER },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: C.TABLE_BORDER },
          },
          rows,
        }),
        new Paragraph({ spacing: { after: 80 }, children: [] }),
      ]
    }
    default: return []
  }
}

// ── public API ──

export async function markdownToDocxBlob(markdown: string, title?: string): Promise<Blob> {
  // 1. 提取 SVG 块（处理两种格式：```svg code block 和 bare <svg> tag）
  const svgBlocks: string[] = []
  let textWithoutSvg = markdown
  // 先处理 ```svg ... ``` 代码块（支持 \r\n 和 \n 换行）
  textWithoutSvg = textWithoutSvg.replace(/```svg\s*\r?\n([\s\S]*?)\r?\n```/gi, (match, code) => {
    const idx = svgBlocks.length
    svgBlocks.push(code.trim())
    return `\n\n@@SVG_${idx}@@\n\n`
  })
  // 再处理裸 <svg>...</svg> 标签（未被代码块包裹的）
  textWithoutSvg = textWithoutSvg.replace(/<svg\b[\s\S]*?<\/svg>/gi, (match) => {
    const idx = svgBlocks.length
    svgBlocks.push(match)
    return `\n\n@@SVG_${idx}@@\n\n`
  })

  // 2. 转换数学公式
  const processed = preprocessMath(textWithoutSvg)

  // 3. 异步转换 SVG -> PNG
  const svgImages: (PngImage | null)[] = []
  for (const svg of svgBlocks) {
    svgImages.push(await svgToPng(svg))
  }

  // 4. 解析 markdown
  const tokens = parseMd(processed)
  const children: (Paragraph | Table)[] = []

  if (title) {
    children.push(new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 480 },
      children: [new TextRun({ text: title, bold: true, size: 44, color: C.TITLE, font: 'Microsoft YaHei' })],
    }))
  }

  // 5. 构建 docx 块，SVG 占位符替换为图片
  tokens.forEach(t => {
    // 检查是否是 SVG 占位符段落
    if (t.type === 'p') {
      const svgMatch = t.text.trim().match(/^@@SVG_(\d+)@@$/)
      if (svgMatch) {
        const idx = parseInt(svgMatch[1])
        const img = svgImages[idx]
        if (img) {
          children.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 160, after: 160 },
            children: [new ImageRun({
              data: img.data,
              transformation: { width: img.width, height: img.height },
            })],
          }))
          return
        }
        // SVG 转换失败，回退为代码块显示
        const svgText = svgBlocks[idx]
        children.push(...tokenToBlocks({ type: 'code', text: svgText, lang: 'svg' }))
        return
      }
    }
    children.push(...tokenToBlocks(t))
  })

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Microsoft YaHei', size: 21, color: C.BODY },
          paragraph: { spacing: { line: 360 } },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 32, bold: true, color: C.H1, font: 'Microsoft YaHei' },
          paragraph: { spacing: { before: 360, after: 160, line: 276 }, outlineLevel: 0 },
        },
        {
          id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, color: C.H2, font: 'Microsoft YaHei' },
          paragraph: { spacing: { before: 320, after: 140, line: 276 }, outlineLevel: 1 },
        },
        {
          id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 24, bold: true, color: C.H3, font: 'Microsoft YaHei' },
          paragraph: { spacing: { before: 280, after: 120, line: 276 }, outlineLevel: 2 },
        },
        {
          id: 'Heading4', name: 'Heading 4', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 22, bold: true, color: C.H4, font: 'Microsoft YaHei' },
          paragraph: { spacing: { before: 240, after: 100, line: 276 }, outlineLevel: 3 },
        },
      ],
    },
    numbering: {
      config: [{
        reference: 'ol-ref',
        levels: [{
          level: 0,
          format: LevelFormat.DECIMAL,
          text: '%1.',
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({
              children: ['第 ', PageNumber.CURRENT, ' 页 / 共 ', PageNumber.TOTAL_PAGES, ' 页'],
              size: 18, color: C.FOOTER, font: 'Microsoft YaHei',
            })],
          })],
        }),
      },
      children,
    }],
  })

  return await Packer.toBlob(doc)
}

/** 将 \( \) \[ \] 转为 markdown 标准 $ $$ 语法 */
export function preprocessLatexForMarkdown(md: string): string {
  return md
    .replace(/\\\[([\s\S]*?)\\\]/g, (_m, latex) => '\n\n$$\n' + latex.trim() + '\n$$\n\n')
    .replace(/\\\((.+?)\\\)/g, (_m, latex) => '$' + latex.trim() + '$')
}

export function downloadDocx(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.docx') ? filename : filename + '.docx'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
