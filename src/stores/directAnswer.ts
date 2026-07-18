import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  DirectAnswerStatus,
  DirectAnswerSectionState,
  PrerequisiteAnchor,
  AnswerMetadata,
  ProblemAnalysis,
} from '@/types/directAnswer'

export const useDirectAnswerStore = defineStore('directAnswer', () => {
  // ===== 状态 =====
  const sessionId = ref<string | null>(null)
  const status = ref<DirectAnswerStatus>('idle')
  const metadata = ref<AnswerMetadata | null>(null)
  const analysis = ref<ProblemAnalysis | null>(null)
  const thoughtContent = ref('')
  const sections = ref<Map<string, DirectAnswerSectionState>>(new Map())
  const anchors = ref<PrerequisiteAnchor[]>([])
  const expandedSteps = ref<Set<string>>(new Set())
  const expandedKnowledgeCards = ref<Set<string>>(new Set())
  const activeKnowledgeCard = ref<string | null>(null)
  const selectedGranularity = ref<'精简版' | '完整版'>('精简版')

  // ===== 计算属性 =====

  /** 生成进度 0-1 */
  const progress = computed(() => {
    const sects = [...sections.value.values()]
    if (sects.length === 0) return 0
    const done = sects.filter(s => s.status === 'done').length
    return done / sects.length
  })

  /** 已完成的 section 列表（按顺序） */
  const completedSections = computed(() => {
    return [...sections.value.values()]
      .filter(s => s.status === 'done')
      .sort((a, b) => {
        const order = ['answer_hero', 'problem_analysis', 'strategy_overview', 'reasoning_chain', 'method_summary', 'error_warning', 'prerequisite_knowledge']
        return order.indexOf(a.id) - order.indexOf(b.id)
      })
  })

  /** 当前正在流式生成的 section */
  const streamingSection = computed(() => {
    return [...sections.value.values()].find(s => s.status === 'streaming') || null
  })

  // ===== 操作方法 =====

  function reset() {
    sessionId.value = null
    status.value = 'idle'
    metadata.value = null
    analysis.value = null
    thoughtContent.value = ''
    sections.value = new Map()
    anchors.value = []
    expandedSteps.value = new Set()
    expandedKnowledgeCards.value = new Set()
    activeKnowledgeCard.value = null
    selectedGranularity.value = '精简版'
  }

  function setSessionId(id: string) {
    sessionId.value = id
  }

  function setStatus(s: DirectAnswerStatus) {
    status.value = s
  }

  function appendThought(chunk: string) {
    thoughtContent.value += chunk
  }

  function startSection(sectionId: string, title: string) {
    const map = new Map(sections.value)
    map.set(sectionId, { id: sectionId, title, status: 'streaming', content: '' })
    sections.value = map
  }

  function appendSectionChunk(sectionId: string, chunk: string) {
    const map = new Map(sections.value)
    const existing = map.get(sectionId)
    if (existing) {
      map.set(sectionId, { ...existing, content: existing.content + chunk })
      sections.value = map
    }
  }

  function completeSection(sectionId: string) {
    const map = new Map(sections.value)
    const existing = map.get(sectionId)
    if (existing) {
      map.set(sectionId, { ...existing, status: 'done' })
      sections.value = map
    }
  }

  function setAnchors(a: PrerequisiteAnchor[]) {
    anchors.value = a
  }

  function setMetadata(m: AnswerMetadata) {
    metadata.value = m
  }

  function setAnalysis(a: ProblemAnalysis) {
    analysis.value = a
  }

  function toggleExpandedStep(stepId: string) {
    const set = new Set(expandedSteps.value)
    if (set.has(stepId)) set.delete(stepId)
    else set.add(stepId)
    expandedSteps.value = set
  }

  function toggleExpandedKnowledgeCard(cardId: string) {
    const set = new Set(expandedKnowledgeCards.value)
    if (set.has(cardId)) set.delete(cardId)
    else set.add(cardId)
    expandedKnowledgeCards.value = set
  }

  function setGranularity(g: '精简版' | '完整版') {
    selectedGranularity.value = g
  }

  return {
    sessionId, status, metadata, analysis, thoughtContent, sections, anchors,
    expandedSteps, expandedKnowledgeCards, activeKnowledgeCard,
    selectedGranularity, progress, completedSections, streamingSection,
    reset, setSessionId, setStatus, appendThought,
    startSection, appendSectionChunk, completeSection,
    setAnchors, setMetadata, setAnalysis, toggleExpandedStep,
    toggleExpandedKnowledgeCard, setGranularity,
  }
})
