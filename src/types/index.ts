// ========== 资源包（Resource Pack）相关类型 ==========

/** 单个资源项 */
export interface ResourceItem {
  id: string
  title: string
  type: 'doc' | 'mindmap' | 'quiz' | 'reading' | 'code' | 'video_script'
  status: 'loading' | 'ready' | 'failed' | 'rejected'
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

/** 画像维度 */
export interface ProfileDimension {
  name: string
  value: number // 0-100
  category: 'mastery' | 'weakness' | 'interest'
}

/** 画像数据 */
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
  type: 'stage' | 'resource.ready' | 'review.flag' | 'done'
  data?: any
  timestamp: string
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
