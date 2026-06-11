// ========== 视频讲解 Scene 协议类型 ==========

/** 场景类型 */
export type SceneType = 'title' | 'text' | 'diagram' | 'code' | 'comparison' | 'summary' | 'ending'

/** 转场类型 */
export type TransitionType = 'fade' | 'slide-left' | 'slide-up' | 'zoom' | 'none'

/** 动画步骤 */
export interface SceneStep {
  at: number
  action: string
  selector?: string
  payload?: Record<string, any>
}

/** 场景数据 */
export interface Scene {
  type: SceneType
  duration: number
  transition: TransitionType
  narration: string
  content: Record<string, any>
  steps?: SceneStep[]
  background?: string
  audioUrl?: string   // TTS 合成后回填的音频 URL
}

/** SSE item 事件——后端推送的单个场景 */
export interface SceneItemEvent {
  sceneIndex: number
  scene: Scene
}

// ===== 各场景类型的 content 结构 =====

export interface TitleContent {
  title: string
  subtitle?: string
  tags?: string[]
}

export interface TextContent {
  heading?: string
  paragraphs?: string[]
  bullets?: string[]
  formula?: string
}

export interface CodeContent {
  heading?: string
  language: string
  code: string
  highlightLines?: number[]
  output?: string
}

export interface DiagramContent {
  heading?: string
  chartType: 'line' | 'bar' | 'scatter'
  xLabel?: string
  yLabel?: string
  datasets: { label: string; points: { x: number; y: number }[] }[]
  highlights?: { x: number; label: string; color: string }[]
}

export interface ComparisonContent {
  heading?: string
  left: { title: string; items: string[] }
  right: { title: string; items: string[] }
  conclusion?: string
}

export interface SummaryContent {
  heading?: string
  checkpoints: string[]
  nextHint?: string
}

export interface EndingContent {
  title: string
  subtitle?: string
  actions: string[]
}

// ===== 视频记录卡片 =====

export interface VideoRecordCard {
  type: 'video-record'
  lectureId: string
  topic: string
  sceneCount: number
  lastSceneIndex: number
  completed: boolean
}

// ===== 播放器状态枚举 =====

export type PlayerPhase =
  | 'idle'
  | 'loading'       // 等待第一个 Scene
  | 'darkening'     // 暗场过渡中
  | 'expanding'     // 播放器展开中
  | 'playing'       // 播放中
  | 'paused'        // 暂停
  | 'buffering'     // 等待下一个 Scene
  | 'closing'       // 关闭动画中

export type PlaybackSpeed = 0.75 | 1.0 | 1.25 | 1.5 | 2.0
