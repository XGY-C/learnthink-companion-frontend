import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, ShadingType } from 'docx'

/** 常见 LaTeX 符号 → Unicode */
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

function convertLatex(text: string): string {
  let s = text.replace(/\\text\{([^}]*)\}/g, '$1')
  for (const [cmd, ch] of Object.entries(LATEX_SYMBOLS)) {
    s = s.replace(new RegExp(cmd.replace(/\\/g, '\\\\'), 'g'), ch)
  }
  s = s.replace(/\\[a-zA-Z]+/g, '')
  s = s.replace(/[{}]/g, '')
  return s.trim()
}

function preprocessMath(md: string): string {
  return md
    .replace(/\\\[([\s\S]*?)\\\]/g, (_m, latex) => '\n\n' + convertLatex(latex) + '\n\n')
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

function buildRuns(tokens: InlineToken[]): TextRun[] {
  return tokens.map(t => {
    const o: any = { text: t.text, size: 21 }
    if (t.bold) o.bold = true
    if (t.italic) o.italics = true
    if (t.strike) o.strike = true
    if (t.code) { o.font = 'Consolas'; o.shading = { type: ShadingType.SOLID, color: 'F0F0F0' }; o.size = 20 }
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

function parseMd(md: string): Token[] {
  const lines = md.split('\n')
  const tokens: Token[] = []
  let i = 0
  while (i < lines.length) {
    const L = lines[i], t = L.trim()

    if (L.startsWith('|') && lines[i + 1]?.startsWith('|') && lines[i + 1].includes('-')) {
      const h = L.split('|').map(c => c.trim()).filter(Boolean)
      const rows: string[][] = []; i += 2
      while (i < lines.length && lines[i].startsWith('|')) { rows.push(lines[i].split('|').map(c => c.trim()).filter(Boolean)); i++ }
      tokens.push({ type: 'table', header: h, rows }); continue
    }
    if (L.startsWith('```')) {
      const lang = L.slice(3).trim(); const code: string[] = []; i++
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i++ }
      i++; tokens.push({ type: 'code', text: code.join('\n'), lang }); continue
    }
    if (/^---+$/.test(t)) { tokens.push({ type: 'hr' }); i++; continue }
    const hm = L.match(/^(#{1,4})\s+(.+)$/)
    if (hm) {
      const level = hm[1].length
      if (level === 1) tokens.push({ type: 'h1', text: hm[2] })
      else if (level === 2) tokens.push({ type: 'h2', text: hm[2] })
      else if (level === 3) tokens.push({ type: 'h3', text: hm[2] })
      else tokens.push({ type: 'h4', text: hm[2] })
      i++; continue
    }
    if (L.startsWith('>')) {
      const q: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) { q.push(lines[i].replace(/^>\s?/, '')); i++ }
      tokens.push({ type: 'blockquote', text: q.join('\n') }); continue
    }
    if (/^[-*]\s+.+$/.test(L)) {
      const items: InlineToken[][] = []
      while (i < lines.length && /^[-*]\s+.+$/.test(lines[i])) { items.push(parseInline(lines[i].replace(/^[-*]\s+/, ''))); i++ }
      tokens.push({ type: 'ul', items }); continue
    }
    if (/^\d+\.\s+.+$/.test(L)) {
      const items: InlineToken[][] = []
      while (i < lines.length && /^\d+\.\s+.+$/.test(lines[i])) { items.push(parseInline(lines[i].replace(/^\d+\.\s+/, ''))); i++ }
      tokens.push({ type: 'ol', items }); continue
    }
    if (t === '') { i++; continue }
    // paragraph
    const pl: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('```') && !lines[i].startsWith('|') && !lines[i].startsWith('>') && !/^(#{1,4}\s|[-*]\s+|\d+\.\s+|---+)/.test(lines[i])) { pl.push(lines[i]); i++ }
    if (pl.length) tokens.push({ type: 'p', text: pl.join('\n') })
    else i++
  }
  return tokens
}

// ── token → docx ──

function tokenToParagraphs(token: Token): Paragraph[] {
  const p = (children: any[], opts?: any) => new Paragraph({ spacing: { after: 120 }, ...opts, children })

  switch (token.type) {
    case 'h1': return [p([new TextRun({ text: token.text, bold: true, size: 32 })], { heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } })]
    case 'h2': return [p([new TextRun({ text: token.text, bold: true, size: 28 })], { heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } })]
    case 'h3': return [p([new TextRun({ text: token.text, bold: true, size: 24 })], { heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 80 } })]
    case 'h4': return [p([new TextRun({ text: token.text, bold: true, size: 22 })], { heading: HeadingLevel.HEADING_4, spacing: { before: 120, after: 60 } })]
    case 'p': return [p(buildRuns(parseInline(token.text)))]
    case 'blockquote': return [p(buildRuns(parseInline(token.text)), { indent: { left: 400 }, border: { left: { style: BorderStyle.SINGLE, size: 6, color: '2B6FFF' } }, spacing: { before: 80, after: 80 } })]
    case 'code': return [p([new TextRun({ text: token.text, font: 'Consolas', size: 18 })], { shading: { type: ShadingType.SOLID, color: 'F5F5F5' }, indent: { left: 200, right: 200 }, spacing: { before: 120, after: 120 } })]
    case 'ul': return (token.items || []).map(item => p(buildRuns(item), { bullet: { level: 0 }, spacing: { after: 60 } }))
    case 'ol': return (token.items || []).map(item => p(buildRuns(item), { numbering: { reference: 'ol-ref', level: 0 }, spacing: { after: 60 } }))
    case 'hr': return [p([], { border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } }, spacing: { before: 120, after: 120 } })]
    case 'table': {
      const rows: Paragraph[] = []
      if (token.header) {
        rows.push(p([new TextRun({ text: '| ' + token.header.join(' | ') + ' |', bold: true, font: 'Consolas', size: 20 })]))
        rows.push(p([new TextRun({ text: '|' + token.header.map(() => '---').join('|') + '|', font: 'Consolas', size: 20 })]))
      }
      token.rows.forEach(r => rows.push(p([new TextRun({ text: '| ' + r.join(' | ') + ' |', font: 'Consolas', size: 20 })])))
      rows.push(new Paragraph({ children: [] }))
      return rows
    }
    default: return []
  }
}

// ── public API ──

export async function markdownToDocxBlob(markdown: string, title?: string): Promise<Blob> {
  const processed = preprocessMath(markdown)
  const tokens = parseMd(processed)
  const paragraphs: Paragraph[] = []

  if (title) {
    paragraphs.push(new Paragraph({
      heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 400 },
      children: [new TextRun({ text: title, bold: true, size: 40 })],
    }))
  }

  tokens.forEach(t => paragraphs.push(...tokenToParagraphs(t)))

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Microsoft YaHei', size: 21 } } } },
    sections: [{ properties: {}, children: paragraphs }],
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
