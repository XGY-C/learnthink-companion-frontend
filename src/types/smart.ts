/**
 * Smart v2 智能辅导模式类型定义。
 * 与后端 SmartAgentLoop 的 SSE 事件协议对应。
 */

import type { ThinkingStep } from '@/types'

/** 可视化渲染类型 */
export type VisualRenderType = 'svg' | 'chartjs' | 'mermaid' | 'html' | 'image' | 'model' | 'mindmap'

/** Smart 消息中的内容块（文字/可视化交替） */
export type SmartContentBlock =
  | { type: 'text'; content: string }
  | {
      type: 'visual'
      renderType: VisualRenderType
      code: string
      description: string
      /** 生成状态：pending=占位中, ready=内容就绪（旧数据无此字段视为 ready） */
      status?: 'pending' | 'ready'
    }

/** Smart 消息 */
export interface SmartMessage {
  role: 'user' | 'assistant'
  /** 内容块序列 -- 文字和可视化自然交替 */
  blocks: SmartContentBlock[]
  /** 思考链 */
  thinking?: ThinkingStep[]
  /** 是否流式中 */
  isStreaming?: boolean
  /** 时间戳 */
  timestamp?: string
}

/** Smart 认知状态面板 */
export interface SmartState {
  concepts: Array<{
    id: string
    label: string
    status: 'UNVERIFIED' | 'UNCLEAR' | 'MASTERED'
  }>
  totalTurns: number
  converged: boolean
}

/** Smart 会话信息 */
export interface SmartSession {
  sessionId: string
  courseId: string
  question: string
  state: SmartState | null
  messages: SmartMessage[]
}

// ── SSE 事件数据类型 ──

/** smart.started 事件数据 */
export interface SmartStartedEvent {
  sessionId: string
  analysis: {
    questionType: string
    domain: string
    subDomain: string
    difficulty: string
    keyConcepts: string[]
    prerequisiteGaps: string[]
    realIntent: string
  }
  concepts: Array<{
    id: string
    label: string
    description?: string
    expectedAnswer?: string
    difficulty?: string
    dependsOn?: string[]
  }>
}

/** agent.thought 事件数据 */
export interface AgentThoughtEvent {
  phase: 'THINKING' | 'TOOL_CALL' | string
  content: string
  timestamp: string
}

/** agent.tool_call 事件数据 */
export interface AgentToolCallEvent {
  tool: string
  args: string
  timestamp: string
}

/** agent.tool_result 事件数据 */
export interface AgentToolResultEvent {
  tool: string
  result: string
  success: boolean
  timestamp: string
}

/** agent.visual 事件数据 */
export interface AgentVisualEvent {
  renderType: VisualRenderType
  code: string
  description: string
  tool: string
  timestamp: string
}

/** smart.state 事件数据 */
export interface SmartStateEvent {
  concepts: Record<string, 'UNVERIFIED' | 'UNCLEAR' | 'MASTERED'>
  totalTurns: number
  converged: boolean
}

/** smart.converged 事件数据 */
export interface SmartConvergedEvent {
  summary: string
  timestamp: string
}

/** done 事件数据 */
export interface SmartDoneEvent {
  converged: boolean
  totalTurns: number
}

/** error 事件数据 */
export interface SmartErrorEvent {
  code: string
  message: string
  retryable: boolean
}
