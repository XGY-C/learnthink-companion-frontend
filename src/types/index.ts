// ========== 资源包（Resource Pack）相关类型 ==========

/** 单个资源项 */
export interface ResourceItem {
  id: string
  title: string
  type: 'doc' | 'mindmap' | 'quiz' | 'reading' | 'code' | 'video_script'
  status: 'pending' | 'ready' | 'failed' | 'rejected'
  confidence?: 'high' | 'medium' | 'low'
  sourcesCount?: number
  qualityScore?: number
  brief?: string
  deepContent?: string
  pushReasons?: string[]
  rejectReason?: string
  sources?: SourceItem[]
}

/** 来源/证据项 */
export interface SourceItem {
  title: string
  locator: string
  quote: string
  relevance?: 'high' | 'medium' | 'low'
}

/** 资源包（对应后端 ResourcePack 领域对象） */
export interface ResourcePack {
  id: string
  title: string
  knowledgePoint: string
  createdAt: string
  avgConfidence: 'high' | 'medium' | 'low'
  avgQuality: number
  resourceCount: number
  estimatedMinutes: number
  isActive: boolean
  pushReason?: string
  resourceTypes: string[]
  resources: ResourceItem[]
}

// ========== 画像（Profile）相关类型 ==========

/** 画像分层 */
export type ProfileDimensionLayer = 'core' | 'style' | 'auxiliary'

/** 画像7维 key（v2：移除 assessment_summary，归入学习报告模块） */
export type ProfileDimensionKey =
  | 'knowledge_basis'      // 核心 - 知识基础
  | 'learning_goal'        // 核心 - 学习目标
  | 'cognitive_style'      // 风格 - 认知偏好
  | 'learning_pace'        // 风格 - 学习节奏
  | 'major_context'        // 辅助 - 专业上下文
  | 'interest_direction'   // 辅助 - 兴趣方向
  | 'error_pattern'        // 辅助 - 错误模式

/** 画像维度（后端完整结构，v2 新增 layer 和独立 updated_at） */
export interface ProfileDimensionItem {
  key: ProfileDimensionKey
  label: string
  layer: ProfileDimensionLayer
  value: Record<string, any>
  confidence: number       // 0-1
  source: 'explicit' | 'inferred'
  updated_at: string       // 该维度的独立更新时间
}

/** 画像主结构 */
export interface Profile {
  profile_id: string
  user_id: string
  course_id: string
  version: number
  dimensions: ProfileDimensionItem[]
  updated_at: string
  last_trigger: 'chat' | 'quiz' | 'path_update' | 'manual'
}

/** 单个维度变更（ProfileDelta 子结构） */
export interface ProfileDimensionChange {
  key: ProfileDimensionKey
  label: string
  action: 'upsert' | 'append' | 'remove' | 'set'
  before: any | null
  after: any | null
  confidence: number     // 本次变更置信度，<0.6 不触发更新
  reason: string         // 变更原因，引用用户原话
}

/** 画像增量（对话/行为后的画像变化） */
export interface ProfileDelta {
  changed: ProfileDimensionChange[]
  summary: string[]      // 前端轻提示，如 ["知识基础：新增薄弱点「优先队列」"]
  from_version: number
  to_version: number
  trigger: 'chat' | 'quiz' | 'path_update' | 'manual'
  updated_at: string     // ISO 8601
}

// ---------- 以下为前端可视化用的简化类型（保持兼容） ----------

/** 画像维度（雷达图/标签云用，前端展示模型） */
export interface ProfileDimension {
  name: string
  value: number // 0-100
  category: 'mastery' | 'weakness' | 'interest'
}

/** 画像可视化数据 */
export interface ProfileData {
  dimensions: ProfileDimension[]
  radarData: { name: string; value: number }[]
  profileVersion: string
  updatedAt: string
  tags: { weakness: string[]; mastered: string[]; interest: string[] }
  pace: string
  preference: string
}

// ========== 任务（Task）相关类型 ==========

/** 任务阶段 */
export type TaskStage = 'profile' | 'retrieve' | 'plan' | 'generate' | 'review' | 'publish'

/** 任务状态 */
export interface TaskState {
  taskId: string
  stage: TaskStage
  percent: number
  message: string
  events: TaskEvent[]
}

/** 任务事件 */
export interface TaskEvent {
  type: 'stage' | 'resource.ready' | 'review.flag' | 'agent.thought' | 'agent.message' | 'done'
  data?: any
  timestamp: string
}

// ========== Agent 思考链（ThinkingTrace）相关类型 ==========

/** Agent 思考链记录 */
export interface AgentThinkingTrace {
  traceId: string
  agentName: string
  agentRole: string
  phase: string
  context: string
  observation: string
  thought: string
  decision: string
  confidenceLevel: 'high' | 'medium' | 'low'
  trigger: 'autonomous' | 'response_to_agent' | 'system_prompt'
  inResponseTo?: string
  timestamp: string
}

/** 前端思考链步骤（ChatPanel 用，由 SSE agent.thought 事件驱动） */
export interface ThinkingStep {
  label: string
  icon: string
  done: boolean
  /** 原始阶段标识（CONTEXT | RETRIEVE | REFLECT | RAG | DECISION），用于步骤类型分类 */
  phase?: string
  /** 简短描述 */
  detail?: string
  /** 完整推理链字段 */
  observation?: string
  thought?: string
  decision?: string
  confidenceLevel?: string
}

/** 思考链记录（挂载在每条助手消息上） */
export interface ThinkingRecord {
  steps: ThinkingStep[]
  expanded?: boolean
}

/** Agent 协作消息（SSE agent.message） */
export interface AgentMessage {
  agent: string
  role: string
  action: 'coverage_report' | 'plan_adjusted' | 'revision_request' | 'revision_applied' | 'revision_approved' | 'parallel_dispatch' | 'fallback_decision'
  message: string
  detail?: Record<string, any>
  fromAgent: string
  toAgent?: string
  timestamp: string
}

/** Planner 决策（ResourcePlan） */
export interface PlannerDecision {
  selectedTypes: string[]
  rationale: string
  items: PlanItem[]
  totalEstimatedMinutes: number
  difficulty: string
}

export interface PlanItem {
  type: string
  title: string
  reason: string
  priority: number
  difficulty: string
  focusAreas: string[]
  estimatedMinutes: number
  styleHint: string
}

/** SSE 事件类型汇总 */
export type SSEEventType = 'task.accepted' | 'task.stage' | 'resource.ready' | 'review.flag' | 'agent.thought' | 'agent.message' | 'task.done' | 'task.failed'

/** 全局通知项 */
export interface NotificationItem {
  id: string
  type: 'success' | 'error' | 'info'
  title: string
  message: string
  topic?: string
  packId?: string
  taskId?: string
  plannerRationale?: string
  resourceTypes?: string[]
  timestamp: number
}

// ========== 学习路径（Learning Path）相关类型 ==========

/** 路径节点 */
export interface PathNode {
  id: string
  title: string
  knowledgePoint: string
  status: 'not_started' | 'in_progress' | 'mastered'
  masteryEstimate: number // 0-100
  resourcePackId?: string
  prerequisites?: string[]
  completionCriteria?: string
}

/** 路径调整记录 */
export interface PathAdjustment {
  id: string
  reason: string
  type: 'insert' | 'remove' | 'reorder'
  description: string
  timestamp: string
}

/** 学习路径 */
export interface LearningPath {
  id: string
  nodes: PathNode[]
  version: string
  adjustments: PathAdjustment[]
  createdAt: string
  updatedAt: string
}
