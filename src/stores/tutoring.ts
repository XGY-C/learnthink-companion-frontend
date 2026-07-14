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
  ReActThought,
  GuidedStepState,
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

  // ReAct 思考步骤
  const reactThoughts = ref<ReActThought[]>([])

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

  // Guided Mode 状态
  const guidedSteps = ref<GuidedStepState[]>([])
  const currentGuidedStepIdx = ref(-1)
  const guidedSummary = ref('')

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
    reactThoughts.value = []
    sections.value = {}
    sectionOrder.value = []
    resourceCount.value = 0
    resources.value = null
    error.value = null
    guidedSteps.value = []
    currentGuidedStepIdx.value = -1
    guidedSummary.value = ''
  }

  function handleSSEEvent(event: TutoringSSEEvent) {
    const { event: eventName, data } = event

    if (eventName === 'tutoring.started') {
      status.value = 'planning'
      sessionId.value = data.sessionId
      return
    }

    if (eventName === 'tutoring.react.thought') {
      reactThoughts.value.push({
        iteration: data.iteration,
        thought: data.thought,
        action: data.action,
      })
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

    // ===== Guided Mode Events =====

    if (eventName === 'tutoring.guided.step_start') {
      status.value = 'guided'
      const step: GuidedStepState = {
        id: data.stepId,
        order: data.stepIndex,
        stage: data.stage,
        title: data.title,
        status: 'guiding',
        guidanceContent: '',
        question: '',
        studentAnswer: '',
        feedback: '',
        hint: '',
        evaluation: '',
        attempt: 0,
        maxAttempts: 2,
        allowReveal: false,
        timeSpentMs: 0,
      }
      guidedSteps.value.push(step)
      currentGuidedStepIdx.value = guidedSteps.value.length - 1
      return
    }

    if (eventName === 'tutoring.guided.guidance_chunk') {
      const step = guidedSteps.value.find(s => s.id === data.stepId)
      if (step) step.guidanceContent += data.chunk
      return
    }

    if (eventName === 'tutoring.guided.question') {
      const step = guidedSteps.value.find(s => s.id === data.stepId)
      if (step) {
        step.question = data.question
        step.status = 'waiting_answer'
      }
      return
    }

    if (eventName === 'tutoring.guided.waiting_answer') {
      const step = guidedSteps.value.find(s => s.id === data.stepId)
      if (step) {
        step.attempt = data.attempt
        step.maxAttempts = data.maxAttempts
        step.allowReveal = data.allowReveal
      }
      return
    }

    if (eventName === 'tutoring.guided.feedback') {
      const step = guidedSteps.value.find(s => s.id === data.stepId)
      if (step) {
        step.feedback = data.feedback
        step.hint = data.hint
        step.allowReveal = data.allowReveal
      }
      return
    }

    if (eventName === 'tutoring.guided.step_done') {
      const step = guidedSteps.value.find(s => s.id === data.stepId)
      if (step) {
        step.status = 'done'
        step.evaluation = data.evaluation
        step.timeSpentMs = data.timeSpentMs
      }
      return
    }

    if (eventName === 'tutoring.guided.revealed') {
      const step = guidedSteps.value.find(s => s.id === data.stepId)
      if (step) {
        step.studentAnswer = `[揭示答案] ${data.answer}`
        step.feedback = data.explanation
        step.evaluation = 'revealed'
        step.status = 'done'
      }
      return
    }

    if (eventName === 'tutoring.guided.summary') {
      guidedSummary.value += data.chunk
      return
    }

    if (eventName === 'tutoring.done') {
      sessionId.value = data.sessionId
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
    reactThoughts.value = []
    sections.value = {}
    sectionOrder.value = []
    resourceCount.value = 0
    resources.value = null
    error.value = null
    guidedSteps.value = []
    currentGuidedStepIdx.value = -1
    guidedSummary.value = ''
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
    reactThoughts,
    sections,
    sectionOrder,
    resourceCount,
    resources,
    error,
    sessions,
    sessionsLoading,
    // guided mode
    guidedSteps,
    currentGuidedStepIdx,
    guidedSummary,
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
