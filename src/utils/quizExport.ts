import type { QuizContent, QuestionType } from '@/types'

const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  SINGLE_CHOICE: '单选题',
  MULTIPLE_CHOICE: '多选题',
  TRUE_FALSE: '判断题',
  FILL_IN_BLANK: '填空题',
  SHORT_ANSWER: '简答题',
}

const DIFFICULTY_LABEL: Record<number, string> = {
  1: '很简单',
  2: '简单',
  3: '中等',
  4: '困难',
  5: '很难',
}

/**
 * 从 Markdown 文本中提取 ```json 代码块的内容并解析为 JSON 对象。
 * 如果没有代码块，则尝试将整个字符串作为 JSON 解析。
 */
function extractJsonFromMarkdown(raw: string): string {
  // 匹配 ```json ... ``` 代码块（支持前后可能有换行）
  const match = raw.match(/```json\s*([\s\S]*?)```/)
  if (match?.[1]) {
    return match[1].trim()
  }
  return raw.trim()
}

export function parseQuiz(raw: string | QuizContent | null | undefined): QuizContent | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    const jsonStr = extractJsonFromMarkdown(raw)
    try { return JSON.parse(jsonStr) as QuizContent } catch { return null }
  }
  return raw
}

function optionLetter(index: number): string {
  return String.fromCharCode(65 + index)
}

/**
 * 将题目集（QuizContent JSON）转为结构化 Markdown，供 MD / DOCX 导出复用。
 * 返回 null 表示内容缺失或解析失败。
 *
 * 输出结构与 QuizPreview 展示一致：题号 · 题型 / 难度 / 知识点 / 题干 / 选项 / 参考答案 / 解析。
 * 题干与解析中的 LaTeX（$...$ / \(...\)）保持原样，由 preprocessLatexForMarkdown / markdownToDocxBlob 统一处理。
 */
export function quizToMarkdown(
  raw: string | QuizContent | null | undefined,
  title?: string,
): string | null {
  const quiz = parseQuiz(raw)
  if (!quiz?.questions?.length) return null

  const lines: string[] = []
  if (title) {
    lines.push(`# ${title}`, '')
  }
  lines.push(`> 本题集共 ${quiz.questions.length} 道题`, '')
  lines.push('---', '')

  quiz.questions.forEach((q, idx) => {
    const typeLabel = QUESTION_TYPE_LABEL[q.type] || q.type
    const diffLabel = DIFFICULTY_LABEL[q.difficulty] || `难度 ${q.difficulty}`
    lines.push(`## 第 ${idx + 1} 题 · ${typeLabel}`, '')

    const meta: string[] = [`**难度**：${diffLabel}`]
    if (q.knowledgePoint) meta.push(`**知识点**：${q.knowledgePoint}`)
    lines.push(meta.join(' ｜ '), '')

    if (q.content) {
      lines.push(q.content, '')
    }

    if (q.options?.length) {
      q.options.forEach((opt, i) => {
        lines.push(`- **${optionLetter(i)}.** ${opt}`)
      })
      lines.push('')
    }

    lines.push(`**参考答案**：${q.answer ?? ''}`, '')

    if (q.analysis) {
      lines.push('**解析**', '', q.analysis, '')
    }

    lines.push('---', '')
  })

  return lines.join('\n')
}
