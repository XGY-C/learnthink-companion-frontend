// ========== DirectAnswer — TypeScript 类型定义 ==========
// 与后端 com.learnthink.core.directanswer.domain.response 包下一一对应

// ========== 枚举类型 ==========

export type ProblemType = '求解' | '证明' | '探索'
export type ConditionHighlightType = 'data' | 'known' | 'target' | 'distractor'
export type StepTypeEnum = 'core' | 'normal' | 'completed'
export type DirectAnswerMode = 'direct' | 'smart'

export type DirectAnswerStatus = 'idle' | 'analyzing' | 'planning' | 'generating' | 'done' | 'error'

// ========== SSE 事件类型 ==========

export type DirectAnswerSSEEventName =
  | 'direct.mode'
  | 'direct.section_analysis'
  | 'direct.section_plan'
  | 'direct.thought'
  | 'direct.section_start'
  | 'direct.section_chunk'
  | 'direct.section_done'
  | 'direct.done'
  | 'direct.error'

export interface DirectAnswerSSEEvent {
  event: DirectAnswerSSEEventName
  data: any
}

// ========== 请求 DTO ==========

export interface DirectAnswerStartRequest {
  question: string
  courseId: string
  mode: DirectAnswerMode
  chatId?: string | null
  sessionId?: string | null
}

// ========== 响应 DTO（17 个 interface） ==========

/** 顶级响应 */
export interface DirectAnswerResponse {
  sessionId: string
  mode: string
  source: string
  question: string
  answerCard?: AnswerCard | null
  problemAnalysis?: ProblemAnalysis | null
  strategyOverview?: StrategyOverview | null
  reasoningChain?: ReasoningChain | null
  methodSummary?: MethodSummary | null
  errorWarning?: ErrorWarning | null
  prerequisiteKnowledge?: KnowledgeCard[] | null
  metadata?: AnswerMetadata | null
}

/** Step 1：答案卡 */
export interface AnswerCard {
  answer: string
  unit?: string | null
  format?: string | null
  precision?: string | null
}

/** Step 2：题目分析 */
export interface ProblemAnalysis {
  problemType: string
  subject: string
  tags: string[]
  conditionMappings: ConditionMapping[]
  answerFirst: boolean
  overallSummary?: string | null
  difficulty?: string | null
}

/** Step 2 辅助：条件映射 */
export interface ConditionMapping {
  label: string
  value: string
  highlightType: string
  interpretation?: string | null
}

/** Step 3：策略概览 */
export interface StrategyOverview {
  narrative: string
  steps: ThinkingStep[]
  keyInsight?: string | null
}

/** Step 3 辅助：思考步骤 */
export interface ThinkingStep {
  id: string
  label: string
  description: string
  type: string
}

/** Step 4：推理链 */
export interface ReasoningChain {
  title: string
  steps: ReasoningStep[]
  prerequisiteAnchors?: PrerequisiteAnchor[] | null
}

/** Step 4 辅助：推理步骤 */
export interface ReasoningStep {
  id: string
  label: string
  thinking: string
  expression: string
  result: string
  type: string
  explanation?: string | null
  knowledgeCardId?: string | null
}

/** Step 5：方法总结 */
export interface MethodSummary {
  coreMethod: string
  keyPoints: string[]
  mnemonic?: string | null
  conditionRules?: ConditionRule[] | null
  transferExamples?: TransferExample[] | null
}

/** Step 5 辅助：条件规则 */
export interface ConditionRule {
  condition: string
  method: string
}

/** Step 5 辅助：迁移示例 */
export interface TransferExample {
  scenario: string
  question: string
  solutionHint: string
}

/** Step 6：错误预警 */
export interface ErrorWarning {
  overview: string
  categories: ErrorCategory[]
  variantQuestions?: VariantQuestion[] | null
}

/** Step 6 辅助：错误分类 */
export interface ErrorCategory {
  name: string
  description: string
  examples?: ErrorExample[] | null
}

/** Step 6 辅助：错误示例 */
export interface ErrorExample {
  wrongAttempt: string
  whyWrong: string
  correction: string
}

/** Step 6 辅助：变式题 */
export interface VariantQuestion {
  question: string
  variation: string
  answerHint?: string | null
}

/** Step 7：知识卡片（递归） */
export interface KnowledgeCard {
  id: string
  label: string
  level: string
  content: string
  prerequisites?: PrerequisiteAnchor[] | null
}

/** 锚点：推理步骤↔知识卡片 */
export interface PrerequisiteAnchor {
  stepId: string
  knowledgeCardId: string
  knowledgeLabel?: string | null
}

/** 元数据 */
export interface AnswerMetadata {
  problemType: string
  subject: string
  tags?: string[] | null
  difficulty?: string | null
  createdAt?: string | null
  completedAt?: string | null
  sectionCount: number
}

// ========== 前端扩展类型 ==========

/** Section 渲染状态 */
export interface DirectAnswerSectionState {
  id: string
  title: string
  status: 'pending' | 'streaming' | 'done'
  content: string
}
