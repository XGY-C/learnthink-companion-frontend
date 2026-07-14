/**
 * 画像 MD 解析工具
 *
 * 详见 docs/画像展示设计方案_v2.md §3.4 / §5.4。
 *  - parseKnowledgeTree：将 knowledge_profile_md 解析为科目→知识点树形结构
 *  - resolveMastery：判定单个知识点的 mastery（精确匹配优先，关键词推断 fallback）
 *  - parseMdKeys：通用 [stable_key] 描述行解析
 */

import type { KnowledgeTreeNode, KnowledgeTopicNode, DisplayJson } from '@/types'
import { MASTERY_KEYWORDS, MIN_NAME_MATCH_LEN } from '@/constants/profile'

const POSITIVE_RE = new RegExp(MASTERY_KEYWORDS.positive.join('|'))
const NEGATIVE_RE = new RegExp(MASTERY_KEYWORDS.negative.join('|'))

/**
 * 判定知识点掌握状态。
 * 优先用 display_profile.knowledge 精确匹配（high 置信），fallback 到 MD 关键词推断（low 置信）。
 *
 * 歧义优先级：当一句描述同时命中正向词和负向词，**以负向为准**——
 * 产品价值上"提示弱项"比"鼓励强项"更重要，避免遗漏需补强的知识点。
 */
export function resolveMastery(
  topicName: string,
  desc: string,
  knowledge?: { mastered?: string[]; weak?: string[] }
): { mastery: 'mastered' | 'weak' | 'unknown'; confidence: 'high' | 'low' } {
  const matchTag = (tags: string[] | undefined) =>
    tags?.some(t => {
      const tt = t.trim()
      const tn = topicName.trim()
      if (!tt || !tn) return false
      // 名称匹配规则：双向 includes，最短串长度 ≥ 3 字符；
      // 否则要求完全相等，避免"图"误匹配"图论"/"图像"
      const short = tt.length < tn.length ? tt : tn
      if (short.length < MIN_NAME_MATCH_LEN) return tt === tn
      return tn.includes(tt) || tt.includes(tn)
    }) ?? false

  if (matchTag(knowledge?.mastered)) return { mastery: 'mastered', confidence: 'high' }
  if (matchTag(knowledge?.weak)) return { mastery: 'weak', confidence: 'high' }

  // 歧义优先级：负向词优先于正向词
  if (NEGATIVE_RE.test(desc)) return { mastery: 'weak', confidence: 'low' }
  if (POSITIVE_RE.test(desc)) return { mastery: 'mastered', confidence: 'low' }

  return { mastery: 'unknown', confidence: 'low' }
}

/**
 * 将 knowledge_profile_md 解析为树形结构。
 *
 * 输入格式：
 *   # 知识掌握画像
 *   ## 人工智能导论
 *   - [know.ai_intro.overall] 我对AI导论的整体掌握处于中等水平。
 *   ### 概率基础
 *   - [know.ai_intro.probability] 我对概率基础掌握较好，能独立解题。
 *
 * @param md         MD 原文
 * @param knowledge  display_profile.knowledge（用于精确判定 mastery，强烈建议传入）
 */
export function parseKnowledgeTree(
  md: string | undefined,
  knowledge?: DisplayJson['knowledge']
): KnowledgeTreeNode[] {
  if (!md) return []
  const lines = md.split('\n')
  const tree: KnowledgeTreeNode[] = []
  let currentSubject: KnowledgeTreeNode | null = null
  let currentTopic: KnowledgeTopicNode | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('# ') || line === '#') continue

    const subjectMatch = line.match(/^##\s+(.+)/)
    if (subjectMatch) {
      currentSubject = { subject: subjectMatch[1].trim(), topics: [] }
      tree.push(currentSubject)
      currentTopic = null
      continue
    }

    const topicMatch = line.match(/^###\s+(.+)/)
    if (topicMatch && currentSubject) {
      currentTopic = {
        name: topicMatch[1].trim(),
        key: '',
        description: '',
        mastery: 'unknown',
        masteryConfidence: 'low',
      }
      currentSubject.topics.push(currentTopic)
      continue
    }

    const kvMatch = line.match(/^-\s+\[([^\]]+)\]\s+(.+)/)
    if (kvMatch && currentSubject) {
      const key = kvMatch[1].trim()
      const desc = kvMatch[2].trim()

      if (key.endsWith('.overall')) {
        currentSubject.overall = desc
      } else if (currentTopic) {
        currentTopic.key = key
        currentTopic.description = desc
        const r = resolveMastery(currentTopic.name, desc, knowledge)
        currentTopic.mastery = r.mastery
        currentTopic.masteryConfidence = r.confidence
      }
      continue
    }
  }

  return tree
}

/**
 * 解析任意 profile_md 为 [stable_key] → 描述 的扁平 map。
 * 用于补充 display_json 未覆盖的字段。
 */
export function parseMdKeys(md: string | undefined): Record<string, string> {
  const result: Record<string, string> = {}
  if (!md) return result
  for (const line of md.split('\n')) {
    const m = line.trim().match(/^-\s+\[([^\]]+)\]\s+(.+)/)
    if (m) result[m[1].trim()] = m[2].trim()
  }
  return result
}
