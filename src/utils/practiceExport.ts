import type { PracticeSession, SessionQuestion } from '@/types'
import { markdownToDocxBlob, downloadDocx, preprocessLatexForMarkdown } from '@/utils/docxExport'

// ── 标签映射 ──
const TYPE_LABEL: Record<string, string> = {
  single_choice: '单选题',
  multiple_choice: '多选题',
  true_false: '判断题',
  fill_blank: '填空题',
}

const MODE_LABEL: Record<string, string> = {
  random: '随机练习',
  weak_point: 'AI 智能组卷',
  wrong_review: '错题重做',
  kp_focus: '知识点练习',
  custom: '手动选题',
}

const DIFFICULTY_STARS: Record<number, string> = {
  1: '★☆☆☆☆',
  2: '★★☆☆☆',
  3: '★★★☆☆',
  4: '★★★★☆',
  5: '★★★★★',
}

// ── 辅助函数 ──

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function avgDifficulty(questions: SessionQuestion[]): string {
  if (questions.length === 0) return '—'
  const avg = questions.reduce((s, q) => s + (q.difficulty || 3), 0) / questions.length
  const level = Math.round(avg)
  return DIFFICULTY_STARS[level] || DIFFICULTY_STARS[3]
}

function formatAnswer(ans: any): string {
  if (ans == null) return '—'
  if (Array.isArray(ans)) return ans.join(', ')
  return String(ans)
}

/** 按题型分组，保持组内原始顺序 */
function groupByType(questions: SessionQuestion[]): Map<string, SessionQuestion[]> {
  const map = new Map<string, SessionQuestion[]>()
  const order = ['single_choice', 'multiple_choice', 'true_false', 'fill_blank']
  for (const q of questions) {
    const type = q.questionType || 'other'
    if (!map.has(type)) map.set(type, [])
    map.get(type)!.push(q)
  }
  // 按固定顺序排序 key
  const sorted = new Map<string, SessionQuestion[]>()
  for (const t of [...order, 'other']) {
    if (map.has(t)) sorted.set(t, map.get(t)!)
  }
  // 兜底 unknown types
  for (const [t, qs] of map) {
    if (!sorted.has(t)) sorted.set(t, qs)
  }
  return sorted
}

function globalIndex(grouped: Map<string, SessionQuestion[]>, question: SessionQuestion): number {
  let idx = 1
  for (const [, qs] of grouped) {
    for (const q of qs) {
      if (q.itemId === question.itemId) return idx
      idx++
    }
  }
  return 0
}

// ── Markdown 模板生成 ──

/**
 * 将练习会话转为结构化 Markdown 试卷。
 * @param session  练习会话
 * @param includeAnswers  是否包含参考答案与解析
 * @returns Markdown 字符串
 */
export function practiceToMarkdown(
  session: PracticeSession,
  includeAnswers: boolean,
): string {
  const { questions } = session
  if (!questions || questions.length === 0) return ''

  const modeLabel = MODE_LABEL[session.sessionType] || session.sessionType
  const difficulty = avgDifficulty(questions)
  const date = formatDate(session.createdAt)
  const grouped = groupByType(questions)

  const lines: string[] = []

  // ═══ 封面 / 标题 ═══
  lines.push(`# 📝 练习试卷`)
  lines.push('')
  lines.push(`> **练习模式**：${modeLabel}　|　**共 ${questions.length} 题**　|　**难度**：${difficulty}　|　**生成时间**：${date}`)
  if (session.aiGeneratedCount) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/\n?$/, `　|　🤖 AI 生成 ${session.aiGeneratedCount} 题`)
  }
  lines.push('')
  lines.push('---')
  lines.push('')

  // ═══ 试题部分（按题型分组） ═══
  let sectionIdx = 0
  for (const [type, qs] of grouped) {
    sectionIdx++
    const typeLabel = TYPE_LABEL[type] || type
    const sectionTitles = ['一', '二', '三', '四', '五', '六', '七', '八']
    const sectionTitle = sectionTitles[sectionIdx - 1] || String(sectionIdx)

    lines.push(`## ${sectionTitle}、${typeLabel}`)
    lines.push('')

    for (const q of qs) {
      const no = globalIndex(grouped, q)
      const diffStars = DIFFICULTY_STARS[q.difficulty] || DIFFICULTY_STARS[3]

      // 题号 + 难度 + 知识点
      const metaParts: string[] = [`**难度**：${diffStars}`]
      if (q.kpName) metaParts.push(`**知识点**：${q.kpName}`)
      lines.push(`### ${no}. ` + (q.title ? q.title.replace(/\n/g, ' ').substring(0, 80) : '（题干）'))
      lines.push('')
      lines.push(metaParts.join('　|　'))
      lines.push('')

      // 题干（完整内容）
      if (q.title) {
        lines.push(q.title)
        lines.push('')
      }

      // 选项（选择题 / 判断题）
      if (q.options && q.options.length > 0 && q.questionType !== 'fill_blank') {
        for (const opt of q.options) {
          lines.push(`- **${opt.label}.** ${opt.content}`)
        }
        lines.push('')
      }

      // 填空留空位
      if (q.questionType === 'fill_blank') {
        lines.push(`> 作答区：\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_`)
        lines.push('')
      }

      lines.push('---')
      lines.push('')
    }
  }

  // ═══ 参考答案与解析（可选） ═══
  if (includeAnswers) {
    lines.push('')
    lines.push('# 📋 参考答案与解析')
    lines.push('')
    lines.push('---')
    lines.push('')

    for (const q of questions) {
      const no = globalIndex(grouped, q)
      const typeLabel = TYPE_LABEL[q.questionType] || q.questionType

      lines.push(`### ${no}. ${typeLabel}`)
      lines.push('')

      // 题干缩略
      if (q.title) {
        const brief = q.title.replace(/\n/g, ' ').substring(0, 100)
        lines.push(`> ${brief}`)
        lines.push('')
      }

      lines.push(`**正确答案**：${formatAnswer(q.correctAnswer)}`)
      lines.push('')

      if (q.explanation) {
        lines.push('**解析**')
        lines.push('')
        lines.push(q.explanation)
        lines.push('')
      }

      lines.push('---')
      lines.push('')
    }
  }

  // ═══ 页脚 ═══
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push(`*本试卷由 LearnThink Companion 学思伴侣智能生成*`)

  return preprocessLatexForMarkdown(lines.join('\n'))
}

// ── 导出入口 ──

/**
 * 导出练习试卷为 Markdown 文件并触发下载
 */
export function exportPracticeMD(session: PracticeSession, includeAnswers: boolean) {
  const md = practiceToMarkdown(session, includeAnswers)
  const filename = `练习试卷_${formatDate(session.createdAt).replace(/[: ]/g, '_')}${includeAnswers ? '_含答案' : ''}.md`
  const blob = new Blob(['\uFEFF' + md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 导出练习试卷为 Word (.docx) 文件并触发下载
 */
export async function exportPracticeDocx(session: PracticeSession, includeAnswers: boolean) {
  const md = practiceToMarkdown(session, includeAnswers)
  const title = `练习试卷 · ${MODE_LABEL[session.sessionType] || '练习'}`
  const blob = await markdownToDocxBlob(md, title)
  const filename = `练习试卷_${formatDate(session.createdAt).replace(/[: ]/g, '_')}${includeAnswers ? '_含答案' : ''}`
  downloadDocx(blob, filename)
}
