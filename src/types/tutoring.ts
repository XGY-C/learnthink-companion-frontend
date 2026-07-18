// ========== 智能辅导系统 — TypeScript 类型定义 ==========
// 与后端 com.learnthink.core.tutoring.domain 包下的 Java record ——对应

// ========== SSE 事件类型汇总 ==========

export type TutoringSSEEventName =
  | 'tutoring.started'
  | 'tutoring.react.thought'
  | 'tutoring.plan.mode'
  | 'tutoring.plan.clarify'
  | 'tutoring.plan.clarify_timeout'
  | 'tutoring.waiting_clarification'
  | 'tutoring.plan.analysis'
  | 'tutoring.plan.personalization'
  | 'tutoring.plan.structure'
  | 'tutoring.plan.resources'
  | 'tutoring.plan.done'
  | 'tutoring.resources.ready'
  | 'tutoring.text.section_start'
  | 'tutoring.text.chunk'
  | 'tutoring.text.diagram_spec'
  | 'tutoring.text.section_done'
  | 'tutoring.diagram.queued'
  | 'tutoring.diagram.done'
  | 'tutoring.diagram.degraded'
  | 'tutoring.section.regenerated'
  | 'tutoring.guided.step_start'
  | 'tutoring.guided.guidance_chunk'
  | 'tutoring.guided.question'
  | 'tutoring.guided.waiting_answer'
  | 'tutoring.guided.feedback'
  | 'tutoring.guided.step_done'
  | 'tutoring.guided.revealed'
  | 'tutoring.guided.summary'
  | 'tutoring.done'
  | 'tutoring.error'

export interface TutoringSSEEvent {
  event: TutoringSSEEventName
  data: any
}

// ReAct 思考步骤
export interface ReActThought {
  iteration: number
  thought: string
  action: string
}

// ========== 会话 ==========

export interface TutoringSessionSummary {
  sessionId: string
  question: string
  courseName: string | null
  chapterLabel: string | null
  createdAt: string
  messageCount: number
}

export interface TutoringSessionDetail {
  sessionId: string
  question: string
  mode: 'answer' | 'clarify'
  sections: SectionState[]
  analysis: QuestionAnalysis | null
  resources: ResolvedResources | null
}

// ========== 请求 DTO ==========
// 对应后端 TutoringStartRequest

export type TutoringMode = 'smart' | 'guided' | 'direct' | 'test'

export interface TutoringStartRequest {
  question: string
  sessionId?: string | null
  chatId?: string | null
  courseId?: string | null
  clarificationResponse?: ClarificationResponse | null
  mode?: TutoringMode
}

// 对应后端 ClarificationResponse
export interface ClarificationResponse {
  skipped: boolean
  selectedOptionId?: string | null
  freeInput?: string | null
}

// 对应后端 RegenerateSectionRequest
export interface RegenerateSectionRequest {
  sectionId: string
  action: 'simplify' | 'switch_angle' | 'followup' | 'more_examples'
  instruction?: string | null
}

// ========== Phase 1 输出（对应后端 ExecutionPlan 及其依赖） ==========

// 对应后端 ClarificationDecision
export interface ClarificationDecision {
  action: string
  reasoning: string
}

// 对应后端 ClarificationOption
export interface ClarificationOption {
  id: string
  label: string
  detail: string
  prefillQuestion: string
}

// 对应后端 Clarification
export interface Clarification {
  understoodPart: string
  ambiguityDescription: string
  options: ClarificationOption[]
  allowFreeInput: boolean
}

// 对应后端 QuestionAnalysis
export interface QuestionAnalysis {
  questionType: string
  domain: string
  subDomain: string
  difficulty: string
  keyConcepts: string[]
  prerequisiteGaps: string[]
  realIntent: string
}

// 对应后端 TeachingPersonalization
export interface Personalization {
  strategy: string
  depth: string
}

// 对应后端 ExpectedDiagram
export interface ExpectedDiagram {
  id: string
  type: string
  description: string
  tool: 'image_model' | 'svg_direct' | 'mermaid' | 'math_render'
  priority: number
  aspectRatio: string
}

// 对应后端 SectionBlueprint
export interface SectionBlueprint {
  id: string
  title: string
  expandDefault: boolean
  purpose: string
  resourceRefs: string[]
  expectedDiagram: ExpectedDiagram | null
  generationHint: string
}

// 对应后端 ResourceRequirement
export interface ResourceRequirement {
  requirementId: string
  type: string
  query: string
  priority: number
}

// 对应后端 QualitySpec
export interface QualitySpec {
  minConfidence: number
  minSources: number
  requireCodeExample: boolean
  requireFormula: boolean
}

// ========== Phase 2 输出 ==========

// 对应后端 RetrievedChunk
export interface RetrievedChunk {
  chunkId: string
  content: string
  sourceTitle: string
  sourceSection: string
  relevanceScore: number
}

// 对应后端 ResolvedResources（Phase2 输出领域对象）
export interface ResolvedResources {
  resources: Record<string, RetrievedChunk[]>
}

// 对应 SSE 事件 tutoring.resources.ready 的 payload
export interface ResourcesReadyPayload {
  resolvedCount: number
  unavailableCount: number
  unavailableIds: string[]
}

// ========== Phase 3 输出 ==========

// 对应后端 DiagramSpec
export interface DiagramSpec {
  id: string
  type: string
  tool: 'image_model' | 'svg_direct' | 'mermaid' | 'math_render'
  priority: number
  aspectRatio: string
  description: string
  sectionId: string
}

// ========== 前端状态类型 ==========

export type TutoringStatus = 'idle' | 'planning' | 'clarifying' | 'preparing' | 'generating' | 'guided' | 'done' | 'error'

export type SectionStatus = 'pending' | 'streaming' | 'done' | 'error'

export type DiagramStatus = 'none' | 'pending' | 'generating' | 'done' | 'degraded'

export interface DiagramState {
  status: DiagramStatus
  diagramId?: string
  spec?: DiagramSpec
  url?: string
  content?: string
  width?: number
  height?: number
  tool?: string
  reason?: string
  fallbackText?: string
}

export interface SectionState {
  id: string
  title: string
  expandDefault: boolean
  status: SectionStatus
  content: string
  diagram: DiagramState | null
  regenerating: boolean
  regeneratedContent: string
}

// ========== 错误 ==========

export interface TutoringError {
  code: string
  message: string
  phase: string
  retryable: boolean
}

// ========== 反馈 ==========

export interface TutoringFeedback {
  rating: 'like' | 'dislike'
  comment?: string | null
}

// ========== Guided Mode 类型 ==========

export type GuidedStage = 'understanding' | 'analysis' | 'recall' | 'execution' | 'verification'
export type GuidedStepStatus = 'pending' | 'guiding' | 'waiting_answer' | 'evaluating' | 'done'

export interface GuidedStepState {
  id: string
  order: number
  stage: GuidedStage
  title: string
  status: GuidedStepStatus
  guidanceContent: string
  question: string
  studentAnswer: string
  feedback: string
  hint: string
  evaluation: string
  attempt: number
  maxAttempts: number
  allowReveal: boolean
  timeSpentMs: number
}

// 对应后端 GuidedAnswerRequest
export interface GuidedAnswerRequest {
  sessionId: string
  stepId: string
  action: 'answer' | 'reveal' | 'hint'
  answer?: string
}
