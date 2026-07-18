// ========== 视频讲解 Scene 协议类型 ==========

/** 场景类型 */
export type SceneType = 'title' | 'text' | 'diagram' | 'code' | 'comparison' | 'summary' | 'ending' | 'html'

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
  interactive?: InteractiveConfig  // 交互配置--存在则场景播完后暂停等待用户交互
  waitForUser?: boolean   // 交互型可视化--true 表示到 duration 暂停等用户操作后点"继续"
  interactHint?: string   // 交互提示文案，显示在"继续"按钮上方
}

/** SSE item 事件--后端推送的单个场景 */
export interface SceneItemEvent {
  sceneIndex: number
  scene: Scene
}

// ===== 交互配置 =====

/** 交互选项 */
export interface InteractiveOption {
  id: string
  label: string
}

/** 交互配置--场景播完后暂停，等待用户选择 */
export interface InteractiveConfig {
  /** 问题文本 */
  question: string
  /** 选项列表 */
  options: InteractiveOption[]
  /** 正确选项的 ID 列表 */
  correctIds: string[]
  /** 答题后的解析说明 */
  explanation?: string
  /** 是否多选（默认 false 单选） */
  multiSelect?: boolean
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

/** HTML 场景 -- AI 自由描述画面 */
export interface HtmlSceneContent {
  html: string       // AI 产出的 HTML 片段（含 <lt-*> 自定义标签和 data-* 属性）
  css?: string       // AI 产出的 CSS（布局 + 自定义动画，可选）
  duration: number   // 场景时长（ms），由 AI 根据 narration 长度估算
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
  | 'interactive-paused'  // 交互暂停--等待用户完成交互（选择题或探索）
  | 'closing'       // 关闭动画中

export type PlaybackSpeed = 0.75 | 1.0 | 1.25 | 1.5 | 2.0
