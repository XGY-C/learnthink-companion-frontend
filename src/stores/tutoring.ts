import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type {
  TutoringStatus,
  TutoringSessionSummary,
  ClarificationDecision,
  Clarification,
  QuestionAnalysis,
  Personalization,
  SectionState,
  ResourcesReadyPayload,
  TutoringError,
  TutoringSSEEvent,
  SectionBlueprint,
  DiagramState,
} from '@/types/tutoring'

function createSectionState(blueprint: { id: string; title: string; expandDefault: boolean; expectedDiagram?: { id: string } | null }): SectionState {
  return {
    id: blueprint.id,
    title: blueprint.title,
    expandDefault: blueprint.expandDefault,
    status: 'pending',
    content: '',
    diagram: blueprint.expectedDiagram ? { status: 'none' } : null,
    regenerating: false,
    regeneratedContent: '',
  }
}

export const useTutoringStore = defineStore('tutoring', () => {
  // ============ 状态 ============
  const sessionId = ref<string | null>(null)
  const planId = ref<string | null>(null)
  const status = ref<TutoringStatus>('idle')
  const mode = ref<'answer' | 'clarify' | null>(null)

  // Phase 1 输出
  const clarificationDecision = ref<ClarificationDecision | null>(null)
  const clarification = ref<Clarification | null>(null)
  const clarifyWaitSeconds = ref(0)
  const analysis = ref<QuestionAnalysis | null>(null)
  const personalization = ref<Personalization | null>(null)
  const teachingThesis = ref<string | null>(null)

  // Section
  const sections = ref<Record<string, SectionState>>({})
  const sectionOrder = ref<string[]>([])

  // Phase 2
  const resourceCount = ref(0)
  const resources = ref<ResourcesReadyPayload | null>(null)

  // 错误
  const error = ref<TutoringError | null>(null)

  // 会话列表
  const sessions = ref<TutoringSessionSummary[]>([])
  const sessionsLoading = ref(false)

  // ============ 计算属性 ============
  const sectionList = computed(() =>
    sectionOrder.value
      .map(id => sections.value[id])
      .filter((s): s is SectionState => Boolean(s))
  )

  const isClarifying = computed(() => status.value === 'clarifying')
  const isStreaming = computed(() =>
    ['planning', 'preparing', 'generating'].includes(status.value)
  )
  const incompleteSections = computed(() =>
    sectionList.value.filter(s => s.status !== 'done')
  )

  // ============ 方法 ============

  function initSession(question: string) {
    sessionId.value = null
    planId.value = null
    status.value = 'planning'
    mode.value = null
    clarificationDecision.value = null
    clarification.value = null
    clarifyWaitSeconds.value = 0
    analysis.value = null
    personalization.value = null
    teachingThesis.value = null
    sections.value = {}
    sectionOrder.value = []
    resourceCount.value = 0
    resources.value = null
    error.value = null
  }

  function handleSSEEvent(event: TutoringSSEEvent) {
    const { event: eventName, data } = event

    if (eventName === 'tutoring.started') {
      status.value = 'planning'
      sessionId.value = data.sessionId
      return
    }

    if (eventName === 'tutoring.plan.mode') {
      mode.value = data.mode
      return
    }

    if (eventName === 'tutoring.plan.clarify') {
      mode.value = 'clarify'
      status.value = 'clarifying'
      sessionId.value = data.sessionId
      clarificationDecision.value = data.clarificationDecision
      clarification.value = data.clarification
      return
    }

    if (eventName === 'tutoring.plan.clarify_timeout') {
      clarifyWaitSeconds.value = data.waitSeconds
      return
    }

    if (eventName === 'tutoring.waiting_clarification') {
      return
    }

    if (eventName === 'tutoring.plan.analysis') {
      analysis.value = data
      return
    }

    if (eventName === 'tutoring.plan.personalization') {
      personalization.value = data
      return
    }

    if (eventName === 'tutoring.plan.structure') {
      const blueprintList: SectionBlueprint[] = data.sections || []
      const newSections: Record<string, SectionState> = {}
      const order: string[] = []
      for (const bp of blueprintList) {
        newSections[bp.id] = createSectionState(bp)
        order.push(bp.id)
      }
      sections.value = newSections
      sectionOrder.value = order
      return
    }

    if (eventName === 'tutoring.plan.resources') {
      resourceCount.value = data.count
      return
    }

    if (eventName === 'tutoring.plan.done') {
      planId.value = data.planId
      teachingThesis.value = data.teachingThesis
      status.value = 'preparing'
      return
    }

    if (eventName === 'tutoring.resources.ready') {
      resources.value = {
        resolvedCount: data.resolvedCount,
        unavailableCount: data.unavailableCount,
        unavailableIds: data.unavailableIds || [],
      }
      return
    }

    if (eventName === 'tutoring.text.section_start') {
      status.value = 'generating'
      const sec = sections.value[data.sectionId]
      if (sec) {
        sec.status = 'streaming'
      }
      return
    }

    if (eventName === 'tutoring.text.chunk') {
      const sec = sections.value[data.sectionId]
      if (sec) {
        sec.content += data.chunk
      }
      return
    }

    if (eventName === 'tutoring.text.diagram_spec') {
      const sec = sections.value[data.sectionId]
      if (sec) {
        sec.diagram = {
          status: 'pending',
          diagramId: data.diagramId,
          spec: data.spec,
        }
      }
      return
    }

    if (eventName === 'tutoring.text.section_done') {
      const sec = sections.value[data.sectionId]
      if (sec) {
        sec.status = 'done'
      }
      return
    }

    if (eventName === 'tutoring.diagram.queued') {
      const sec = sections.value[data.sectionId]
      if (sec?.diagram) {
        sec.diagram.status = 'generating'
      }
      return
    }

    if (eventName === 'tutoring.diagram.done') {
      const sec = sections.value[data.sectionId]
      if (sec) {
        sec.diagram = {
          status: 'done',
          diagramId: data.diagramId,
          url: data.url,
          content: data.content,
          width: data.width,
          height: data.height,
          tool: data.tool,
        }
      }
      return
    }

    if (eventName === 'tutoring.diagram.degraded') {
      const sec = sections.value[data.sectionId]
      if (sec) {
        sec.diagram = {
          status: 'degraded',
          diagramId: data.diagramId,
          reason: data.reason,
          fallbackText: data.fallbackText,
        }
      }
      return
    }

    if (eventName === 'tutoring.section.regenerated') {
      const sec = sections.value[data.sectionId]
      if (sec) {
        sec.content = data.content
        sec.status = 'done'
        sec.regenerating = false
        sec.regeneratedContent = ''
      }
      return
    }

    if (eventName === 'tutoring.done') {
      status.value = 'done'
      return
    }

    if (eventName === 'tutoring.error') {
      error.value = data
      status.value = 'error'
      return
    }

    console.warn('[tutoring] unknown event:', eventName)
  }

  function toggleSection(id: string) {
    const sec = sections.value[id]
    if (sec) {
      sec.expandDefault = !sec.expandDefault
    }
  }

  function setSectionRegenerating(id: string) {
    const sec = sections.value[id]
    if (sec) {
      sec.regenerating = true
      sec.regeneratedContent = ''
    }
  }

  function appendRegeneratedChunk(id: string, chunk: string) {
    const sec = sections.value[id]
    if (sec) {
      sec.regeneratedContent += chunk
    }
  }

  function retryDiagram(sectionId: string) {
    const sec = sections.value[sectionId]
    if (sec?.diagram) {
      sec.diagram.status = 'generating'
    }
  }

  function reset() {
    sessionId.value = null
    planId.value = null
    status.value = 'idle'
    mode.value = null
    clarificationDecision.value = null
    clarification.value = null
    clarifyWaitSeconds.value = 0
    analysis.value = null
    personalization.value = null
    teachingThesis.value = null
    sections.value = {}
    sectionOrder.value = []
    resourceCount.value = 0
    resources.value = null
    error.value = null
  }

  return {
    // 状态
    sessionId,
    planId,
    status,
    mode,
    clarificationDecision,
    clarification,
    clarifyWaitSeconds,
    analysis,
    personalization,
    teachingThesis,
    sections,
    sectionOrder,
    resourceCount,
    resources,
    error,
    sessions,
    sessionsLoading,
    // 计算属性
    sectionList,
    isClarifying,
    isStreaming,
    incompleteSections,
    // 方法
    initSession,
    handleSSEEvent,
    toggleSection,
    setSectionRegenerating,
    appendRegeneratedChunk,
    retryDiagram,
    reset,
  }
})
