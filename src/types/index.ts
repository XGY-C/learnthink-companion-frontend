// ========== 用户（User）相关类型 ==========

/** 用户完整信息（与后端 UserInfoResponse 对齐） */
export interface UserInfo {
  id: string
  username: string
  email: string
  role: string
  displayName?: string
  avatarUrl?: string
  bio?: string
  major?: string
  grade?: string
  createdAt?: string
}

/** 个人资料更新请求 */
export interface UpdateProfileRequest {
  displayName?: string
  bio?: string
  major?: string
  grade?: string
}

/** 学习统计（与后端 LearningStatsResponse 对齐） */
export interface LearningStats {
  totalHours: number
  weekHours: number
  resourcePackCount: number
  weekResourcePacks: number
  pathProgressPercent: number
  weakCount: number
  prevWeakCount: number
  totalQuizScoreAvg?: number
  radarData: { name: string; value: number }[]
  weeklyActivity: { week: string; hours: number }[]
  profileHistory: ProfileVersionSummary[]
}

/** 画像版本摘要 */
export interface ProfileVersionSummary {
  version: number
  createdAt: string
  trigger: string
  summary: string[]
}

/** 后端通知（与 NotificationResponse 对齐） */
export interface AppNotification {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  isPushed: boolean
  refId?: string
  refType?: string
  createdAt: string
}

// ========== 课程（Course）相关类型 ==========

/** 课程信息（来自后端 API） */
export interface CourseInfo {
  id: string
  name: string
  emoji: string
  enrolledAt?: string
  progress?: {
    tasksCompleted: number
    resourcesGenerated: number
    pathProgressPercent: number
  }
}

/** 课程详情（含选课状态） */
export interface CourseDetail {
  id: string
  name: string
  description: string
  emoji: string
  enrolledCount: number
  isEnrolled: boolean
  createdAt: string
}

/** 可选课程列表项 */
export interface AvailableCourse {
  id: string
  name: string
  description: string
  emoji: string
  enrolledCount: number
  createdAt: string
}

// ========== 教材信息（Textbook）相关类型 ==========

/** 教材基本信息（来自 GET /courses/{id}/textbook） */
export interface CourseTextbook {
  title: string
  author: string
  introduction: string
  toc: string  // JSON 字符串，前端使用时需 JSON.parse
}

/** 目录节点（解析后的 toc） */
export interface ChapterNode {
  title: string
  children: ChapterNode[]
}

// ========== 资源文件夹（Resource Folder）相关类型 ==========

/** 资源文件夹（网盘式嵌套） */
export interface ResourceFolder {
  id: string
  parentId: string | null
  name: string
  sortOrder: number
  resourceCount: number
  children: ResourceFolder[]
}

// ========== 资源文件（Resource File，库内展示单位） ==========

/** 资源文件（文件级，对应后端 ResourceFileDTO） */
export interface ResourceFile {
  id: string
  folderId: string | null
  packId?: string
  type: 'doc' | 'mindmap' | 'quiz' | 'reading' | 'code' | 'video'
  title: string
  topic?: string
  status: 'pending' | 'ready' | 'failed' | 'rejected' | 'rendering'
  confidence: 'high' | 'medium' | 'low'
  qualityScore: number
  noteCount: number
  isLearning: boolean
  createdAt: string
  updatedAt?: string
  /** 详情加载时才有 */
  content?: string
  sources?: SourceItem[]
  sourcesCount?: number
}

// ========== 资源包（Resource Pack）相关类型 ==========

/** 单个资源项 */
export interface ResourceItem {
  id: string
  title: string
  type: 'doc' | 'mindmap' | 'quiz' | 'reading' | 'code' | 'video'
  status: 'pending' | 'ready' | 'failed' | 'rejected' | 'rendering'
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

/** 任务列表摘要（后端 GET /api/tasks 返回） */
export interface TaskSummary {
  taskId: string
  topic: string
  courseId: string
  taskType: string
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
  stage: string | null
  percent: number
  resourceTypes: string[]
  packId: string | null
  resourceCount: number
  errorMessage: string | null
  createdAt: string | null
  startedAt: string | null
  finishedAt: string | null
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

/** Agent 思考阶段 -- 与后端 ThinkingPhase.java 枚举同步 */
export type ThinkingPhase =
  | 'CONTEXT' | 'RETRIEVE' | 'RAG' | 'PLANNING'
  | 'DECISION' | 'REFLECT' | 'ERROR'
  | 'THINKING' | 'TOOL_CALL'  // Smart v2 新增

/** 前端思考链步骤（ChatPanel 用，由 SSE agent.thought 事件驱动） */
export interface ThinkingStep {
  label: string
  icon: string
  done: boolean
  /** 原始阶段标识，用于步骤类型分类 */
  phase?: ThinkingPhase
  /** 简短描述 */
  detail?: string
  /** 阶段上下文描述 */
  context?: string
  /** 完整推理链字段 */
  observation?: string
  thought?: string
  decision?: string
  confidenceLevel?: string
  /** Agent 名称 */
  agentName?: string
  /** Agent 角色 */
  agentRole?: string
    /** 来源列表（web_search / rag_retrieve 等工具步骤） */
  sources?: SearchSource[]
}

/** 来源项（支持 web_search 和 rag_retrieve） */
export interface SearchSource {
  title: string
  /** web_search 有 URL，rag_retrieve 无 URL */
  url?: string
  snippet: string
  /** rag_retrieve 来源定位（如页码、章节） */
  locator?: string
  /** rag_retrieve 相关性分数（0-1） */
  relevance?: number
  /** 来源类型：'web' | 'rag' */
  type?: 'web' | 'rag'
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
  difficulty: number  // 1-5 五级难度
}

export interface PlanItem {
  type: string
  title: string
  reason: string
  priority: number
  difficulty: number  // 1-5 五级难度
  focusAreas: string[]
  estimatedMinutes: number
  styleHint: string
}

// ========== 练习题（Quiz Question）相关类型 ==========

/** 题目类型枚举 */
export type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILL_IN_BLANK' | 'SHORT_ANSWER'

/** 单道练习题（对应后端 quiz JSON 格式） */
export interface Question {
  id: number
  type: QuestionType
  content: string              // 题干，支持 LaTeX（$...$ / $$...$$）
  options: string[] | null     // 选择题/判断题必填，填空/简答为 null
  answer: string               // 选择题填选项字母，多选填字母串，填空填具体值，简答填关键步骤
  analysis: string             // 详细解析：解题思路 + 关键步骤 + 干扰项分析 + 难度层级说明
  difficulty: number           // 1-5 五级难度标准
  knowledgePoint: string       // 对应大纲知识点名称
}

/** 练习题集 */
export interface QuizContent {
  questions: Question[]
}

/** SSE 事件类型汇总 */
export type SSEEventType = 'task.accepted' | 'task.stage' | 'resource.ready' | 'review.flag' | 'agent.thought' | 'agent.message' | 'task.done' | 'task.failed' | 'subtopic.started' | 'subtopic.completed' | 'checklist.created' | 'checklist.updated' | 'agent.generation.started' | 'agent.generation.done' | 'agent.generation.failed' | 'plan.gap_tasks'

// ========== 代码运行相关类型 ==========

/** 代码运行请求 */
export interface CodeRunRequest {
  source_code: string
  language: string
  stdin?: string
  expected_output?: string
  cpu_time_limit?: number
  memory_limit?: number
}

/** 代码运行结果 */
export interface CodeRunResult {
  stdout: string | null
  stderr: string | null
  compile_output: string | null
  status: string
  status_code: number
  time: number | null
  memory: number | null
}

/** 全局通知项 */
export interface NotificationItem {
  id: string
  type: 'success' | 'error' | 'info'
  title: string
  message: string
  topic?: string
  packId?: string
  taskId?: string
  dailyRefType?: string
  plannerRationale?: string
  resourceTypes?: string[]
  timestamp: number
}

// ========== 题库（Question Bank）相关类型 ==========

/** 题目库中的题目（对应后端 QuestionDTO） */
export interface QBankQuestion {
  id: string
  userId: string
  courseId: string
  sourceItemId?: string
  questionType: string
  difficulty: number
  title: string
  options?: { label: string; content: string }[]
  answer?: any
  explanation?: string
  kpId?: string
  kpName?: string
  tags?: string[]
  attemptCount: number
  correctCount: number
  accuracyRate: number
  status: string
  createdAt: string
}

/** 题目分页（对应后端 QuestionPageDTO） */
export interface QuestionPage {
  items: QBankQuestion[]
  total: number
  page: number
  size: number
}

/** 创建题目请求 */
export interface CreateQBankQuestionRequest {
  courseId: string
  questionType: string
  difficulty: number
  title: string
  options?: { label: string; content: string }[]
  answer: any
  explanation?: string
  kpId?: string
}

/** 知识点正确率（对应后端 KpAccuracyDTO） */
export interface KpAccuracy {
  kpId: string
  kpName: string
  totalAttempts: number
  correctCount: number
  accuracyRate: number
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

// ========== 学习计划 v3.0 (Plan) 相关类型 ==========

/** 学习计划（大计划） */
export interface Plan {
  planId: string
  version: number
  profileVersion: number
  courseId: string
  status: string
  createdAt: string | null
  modules: Module[]
  edges: Edge[]
  summary: PlanSummary | null
}

export interface PlanSummary {
  totalModules: number
  coreModules: number
  supplementaryModules: number
  totalHours: number
  completionEstimate: string
}

export interface Edge {
  from: string
  to: string
  type: string
}

/** Module（大计划中的一个模块） */
export interface Module {
  moduleId: string
  title: string
  knowledgePoints: { kpId: string; name: string }[]
  scope: 'core_curriculum' | 'supplementary' | 'extracurricular'
  prerequisites: string[]
  estimatedHours: number | null
  depth: 'basic' | 'standard' | 'deep'
  status: 'locked' | 'ready' | 'in_progress' | 'completed'
  mastery: number | null
  subPlanId: string | null
  subPlan: SubPlan | null
}

/** 子计划（一个 module 的 activity 序列） */
export interface SubPlan {
  subPlanId: string
  moduleId: string
  version: number
  activities: Activity[]
  adjustments: any[]
  stats: SubPlanStats | null
  matchSummary: MatchSummary | null
}

export interface SubPlanStats {
  completionPct: number
  avgQuizScore: number | null
  totalTimeSpent: number
}

export interface MatchSummary {
  matchedCount: number
  toGenerateCount: number
  toGenerate: { type: string; topic: string; reason: string }[]
}

/** Activity（单个学习活动） */
export interface Activity {
  activityId: string
  type: 'learn' | 'explore'
  title: string
  description: string | null
  requires: string[]
  /** @deprecated 使用 resources[] */
  resource: ActivityResource | null
  resources: ActivityResource[]
  estimatedMinutes: number | null
  order: number | null
  completionCriteria: CompletionCriteria | null
  status: 'locked' | 'ready' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  retryCount: number
  result: ActivityResult | null
}

export interface ActivityResource {
  source: 'matched' | 'generated'
  resourcePackId: string | null
  resourceType: string
  generationStatus: string | null
}

export interface CompletionCriteria {
  type: 'resource_open' | 'quiz_score'
  threshold: number
  met: boolean
}

export interface ActivityResult {
  score: number | null
  timeSpent: number | null
  completedAt: string | null
  weakTags: string[]
}

/** Quiz 答题结果 */
export interface QuizQuestion {
  questionId: string
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILL_IN_BLANK' | 'SHORT_ANSWER'
  content: string
  options: string[] | null
  answer: string
  analysis: string
  difficulty: number
  tags?: { mistakes?: string[]; knowledge?: string[] }
}

// ========== 精准推送（Push）相关类型 ==========

/** 推送理由 */
export interface PushReason {
  dimension: string      // path_match / weakness_match / interest_match / general
  label: string          // 简短标签
  detail: string         // 详细描述
}

/** 已评分资源包（推荐列表项） */
export interface ScoredPack {
  packId: string
  title: string
  knowledgePoint: string
  pathMatch: number
  weaknessMatch: number
  interestMatch: number
  confidence: 'high' | 'medium' | 'low'
  estimatedMinutes: number
  resourceCount: number
  reasons: PushReason[]
  createdAt: string | null
}

/** Dashboard 推荐响应 */
export interface RecommendationResponse {
  main: ScoredPack | null
  secondary: ScoredPack[]
}

/** 推送 SSE 事件负载 */
export interface PushEvent {
  type: 'push_resource_ready' | 'push_weakness_found' | 'push_path_next'
  notificationId: string
  title: string
  message: string
  refId: string
  refType: string
  pathMatch?: number
  weaknessMatch?: number
  interestMatch?: number
  reasons?: PushReason[]
  createdAt: string
}

/** 推送通知列表响应 */
export interface PushNotificationListResponse {
  notifications: AppNotification[]
  unreadCount: number
}

export interface QuestionResult {
  questionId: string
  result: 'correct' | 'incorrect' | 'partial'
}

/** Activity 提交响应 */
export interface ActivitySubmitResponse {
  activityId: string
  activityCompleted: boolean
  status?: string
  score?: number
  weakTags?: string[]
  questionResults?: QuestionResult[]
  retryCount?: number
  retryAllowed?: boolean
  retriesRemaining?: number
  moduleStatus?: string
  moduleMastery?: number
  autoAction?: AutoAction | null
}

export interface AutoAction {
  type: string
  reason: string
  insertedActivities: { activityId: string; type: string; title: string }[]
}

// ========== 画像展示 v2 类型（详见 docs/画像展示设计方案_v2.md） ==========

/** display_json 原始结构（后端 step2_display.txt 产出） */
export interface DisplayJson {
  core: {
    summary?: string
    current_chapter?: string
    major?: string
    grade?: string
    goal?: string
    strong?: string[]
    weak?: string[]
  }
  style: {
    preference?: string[]
    pace?: string
    avoid?: string
  }
  knowledge: {
    mastered?: string[]
    weak?: string[]
    error_pattern?: string[]
  }
  dimensions?: string[]
  /** 兼容旧字段：早期画像可能挂在顶层 overview 里 */
  overview?: string
}

/** key → value 形状的精确映射 */
export interface DimensionValueMap {
  knowledge_basis: {
    mastered?: string[]
    weak?: string[]
    /** 学科级强项；后端当前未稳定产出，仅作可选 fallback */
    strong?: string[]
  }
  learning_goal: { primary?: string; sub_goals?: string[] }
  cognitive_style: {
    style?: string[]
    media_preference?: string
    avoid?: string
    example_density?: 'high' | 'medium' | 'low'
  }
  learning_pace: {
    daily_minutes?: number
    /** 兼容历史字段名 */
    minutes_per_day?: number
    urgency?: 'intensive' | 'normal' | 'relaxed'
  }
  major_context: { major?: string; grade?: string; course?: string }
  interest_direction: { topics?: string[] }
  error_pattern: { tags?: string[] }
}

/** 以 key 判别的泛型条目 */
export interface TypedDimensionItem<K extends ProfileDimensionKey = ProfileDimensionKey> {
  key: K
  label: string
  layer: ProfileDimensionLayer
  value: DimensionValueMap[K]
  confidence: number
  source: 'explicit' | 'inferred'
  updated_at: string
}

/** dimensions[] 元素的具体联合（每个元素 key/value 强绑定） */
export type AnyDimensionItem = {
  [K in ProfileDimensionKey]: TypedDimensionItem<K>
}[ProfileDimensionKey]

/** 知识树节点（前端从 knowledge_profile_md 解析） */
export interface KnowledgeTopicNode {
  /** ### 标题：知识点名 */
  name: string
  /** stable_key，如 know.ai_intro.bayes */
  key: string
  /** MD 行的自然语言描述 */
  description: string
  mastery: 'mastered' | 'weak' | 'unknown'
  /** high = display_json 精确匹配；low = MD 关键词推断或未知 */
  masteryConfidence: 'high' | 'low'
}

export interface KnowledgeTreeNode {
  /** ## 标题：科目名 */
  subject: string
  /** [know.xxx.overall] 行的描述 */
  overall?: string
  topics: KnowledgeTopicNode[]
}

/** 维度展示状态（卡片级，非标签级） */
export type DimDisplayState = 'normal' | 'inferred' | 'low' | 'missing'

/** 类型守卫：从 dimensions[] 按 key 取整条 */
export function getDim<K extends ProfileDimensionKey>(
  dimensions: ProfileDimensionItem[] | AnyDimensionItem[] | undefined,
  key: K
): TypedDimensionItem<K> | undefined {
  if (!dimensions) return undefined
  // 联合数组的 find 谓词无法精确收窄到泛型 K，使用 as 断言。
  // 类型安全由运行时 `d.key === key` 保证。
  const found = (dimensions as Array<ProfileDimensionItem | AnyDimensionItem>).find(d => d.key === key)
  return found as TypedDimensionItem<K> | undefined
}

/** 类型守卫：从 dimensions[] 按 key 取 value（自动收窄类型） */
export function getDimValue<K extends ProfileDimensionKey>(
  dimensions: ProfileDimensionItem[] | AnyDimensionItem[] | undefined,
  key: K
): DimensionValueMap[K] | undefined {
  return getDim(dimensions, key)?.value
}

// ========== 画像 Phase 2：来源追溯 + 纠错闭环 ==========

/**
 * profile_signals 表的来源类型枚举（与后端 enum 同名）。
 *  - user_said：用户在对话里明确表述
 *  - user_corrected：用户主动纠正过该项
 *  - learning_result：答题/资源完成等学习结果触发
 *  - behavior：行为推断（停留时长、跳过等）
 *  - llm_inferred：LLM 推断
 */
export type SignalSource =
  | 'user_said'
  | 'user_corrected'
  | 'learning_result'
  | 'behavior'
  | 'llm_inferred'

/** 单条来源信号（对应后端 profile_signals 表一行） */
export interface ProfileSignal {
  id: string
  dimension: string
  signal_key: string
  value: string
  source: SignalSource
  status: 'written' | 'pending' | 'discarded'
  created_at: string
  chat_id?: string
}

/** 用户纠错动作 */
export type CorrectAction = 'confirm' | 'correct' | 'deny'

/** 纠错请求负载（POST /profile/correct） */
export interface CorrectPayload {
  course_id: string
  dimension: ProfileDimensionKey
  signal_key?: string
  /** 被纠正的原值（可选，便于后端审计） */
  original_value?: string
  action: CorrectAction
  /** action='correct' 时必填 */
  corrected_value?: string
  /** action='deny' 时可选附文 */
  note?: string
}

// ========== 笔记（Notebook）相关类型 ==========

/** 笔记创建请求 */
export interface CreateNoteRequest {
  courseId: string
  notebookId?: string
  resourcePackId?: string
  resourceItemId?: string
  resourceTitle?: string
  sectionTitle?: string
  content: string
  selectedText?: string
  anchorId?: string
  textRange?: string
}

/** 笔记更新请求 */
export interface UpdateNoteRequest {
  content: string
}

/** 笔记完整对象 */
export interface Note {
  id: string
  userId: string
  courseId: string
  notebookId?: string
  resourcePackId?: string
  resourceItemId?: string
  resourceTitle?: string
  sectionTitle?: string
  content: string
  selectedText?: string
  anchorId?: string
  textRange?: string
  createdAt: string
  updatedAt: string
}

/** 笔记本 */
export interface Notebook {
  id: string
  courseId: string
  name: string
  description?: string
  cover?: string
  sortOrder?: number
  isDefault?: boolean
  createdAt: string
  updatedAt: string
}

/** 笔记本创建请求 */
export interface CreateNotebookRequest {
  courseId: string
  name: string
  description?: string
  cover?: string
  sortOrder?: number
  isDefault?: boolean
}

/** 笔记本更新请求 */
export interface UpdateNotebookRequest {
  name?: string
  description?: string
  cover?: string
  sortOrder?: number
  isDefault?: boolean
}

/**
 * 三种关联层次判定：
 * - 资源级：sectionTitle == null
 * - 章节级：sectionTitle != null && selectedText == null
 * - 文本级：sectionTitle != null && selectedText != null
 */
