import { ref, onUnmounted } from 'vue'
import { ensureValidToken, getToken } from '@/api/tutoring'
import type { ThinkingStep, ThinkingPhase } from '@/types'
import type { SmartContentBlock, VisualRenderType } from '@/types/smart'

const smartPhaseLabels: Record<string, { label: string; icon: string }> = {
  THINKING: { label: '思考中', icon: '🤔' },
  TOOL_CALL: { label: '调用工具', icon: '🔧' },
  CONTEXT: { label: '理解上下文', icon: '📋' },
  RETRIEVE: { label: '检索知识库', icon: '🔍' },
  REFLECT: { label: '评估画像', icon: '🪞' },
  RAG: { label: '检索分析', icon: '📚' },
  DECISION: { label: '决策判断', icon: '⚖️' },
  PLANNING: { label: '意图分析与回复规划', icon: '📐' },
  ERROR: { label: '执行异常', icon: '⚠️' },
}

/** 工具名称 -> 图标映射 */
const toolIconMap: Record<string, string> = {
  rag_retrieve: '📚',
  web_search: '🔍',
  paper_search: '🔍',
  generate_svg: '🎨',
  generate_chart: '📊',
  generate_mermaid: '📊',
  generate_html: '🎨',
  generate_visualization: '🎨',
  generate_threejs: '🎨',
  generate_image: '🎨',
  generate_mindmap: '🧠',
  assess_concept: '📝',
  challenge_transfer: '📝',
  update_concept_status: '📝',
  generate_summary: '📝',
  reason: '🤔',
  brainstorm: '💡',
  code_execution: '💻',
  read_profile: '👤',
  write_profile: '👤',
  ask_user: '❓',
}

/** 生成工具 -> 可视化渲染类型映射（用于提前显示占位框） */
const toolToRenderType: Record<string, VisualRenderType> = {
  generate_svg: 'svg',
  generate_chart: 'chartjs',
  generate_mermaid: 'mermaid',
  generate_mindmap: 'mindmap',
  generate_html: 'html',
  generate_image: 'image',
  generate_threejs: 'model',
}

/** 规范化 renderType：后端可能发 'threejs'，统一为 'model' */
function normalizeRenderType(rt: string): VisualRenderType {
  if (rt === 'threejs') return 'model'
  return rt as VisualRenderType
}

/** 查找最后一个 pending 的 visual block（按 renderType 匹配） */
function findPendingVisual(blocks: SmartContentBlock[], renderType: VisualRenderType): SmartContentBlock | null {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i]
    if (b.type === 'visual' && b.status === 'pending' && b.renderType === renderType) {
      return b
    }
  }
  return null
}

/** 清理所有仍在 pending 的 visual block（done/error 时调用） */
function cleanupPendingVisuals(blocks: SmartContentBlock[]) {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i]
    if (b.type === 'visual' && b.status === 'pending') {
      blocks.splice(i, 1)
    }
  }
}

export function useSmartSSE() {
  const sessionId = ref<string | null>(null)
  const blocks = ref<SmartContentBlock[]>([])
  const thinkingSteps = ref<ThinkingStep[]>([])
  const streamingText = ref('')
  const isStreaming = ref(false)
  const isCompleted = ref(false)
  const error = ref<{ code: string; message: string; retryable: boolean } | null>(null)
  const thinkingExpanded = ref(true)
  const conceptState = ref<Record<string, string>>({})
  const totalTurns = ref(0)
  const converged = ref(false)

  let abortController: AbortController | null = null

  function reset() {
    sessionId.value = null
    blocks.value = []
    thinkingSteps.value = []
    streamingText.value = ''
    isStreaming.value = false
    isCompleted.value = false
    error.value = null
    conceptState.value = {}
    totalTurns.value = 0
    converged.value = false
    thinkingExpanded.value = true
  }

  function cancel() {
    abortController?.abort()
    abortController = null
    isStreaming.value = false
  }

  function handleEvent(eventName: string, data: string) {
    switch (eventName) {
      case 'smart.started': {
        try {
          const parsed = JSON.parse(data)
          sessionId.value = parsed.sessionId
        } catch { /* ignore */ }
        break
      }
      case 'agent.thought': {
        try {
          const parsed = JSON.parse(data)
          const meta = smartPhaseLabels[parsed.phase] || { label: parsed.phase, icon: '●' }
          thinkingSteps.value.push({
            label: meta.label,
            icon: meta.icon,
            done: true,
            phase: parsed.phase as ThinkingPhase,
            detail: parsed.content || '',
          })
        } catch { /* ignore */ }
        break
      }
      case 'agent.tool_call': {
        try {
          const parsed = JSON.parse(data)
          thinkingSteps.value.push({
            label: `调用工具: ${parsed.tool}`,
            icon: toolIconMap[parsed.tool] || '🔧',
            done: false,
            phase: 'TOOL_CALL' as ThinkingPhase,
            detail: parsed.args || '',
          })
          // 如果是可视化生成工具，提前推送 pending 占位块
          const renderType = toolToRenderType[parsed.tool]
          if (renderType) {
            if (streamingText.value) {
              blocks.value.push({ type: 'text', content: streamingText.value })
              streamingText.value = ''
            }
            // 复用已有的同 renderType pending 块，避免重复工具调用产生多个占位框
            const existing = findPendingVisual(blocks.value, renderType)
            if (!existing) {
              blocks.value.push({
                type: 'visual',
                renderType,
                code: '',
                description: '',
                status: 'pending',
              })
            }
          }
        } catch { /* ignore */ }
        break
      }
      case 'agent.tool_result': {
        try {
          const parsed = JSON.parse(data)
          const steps = thinkingSteps.value

          // 优先按工具名匹配最后一个未完成的同名工具调用
          let matched = false
          if (parsed.tool) {
            for (let i = steps.length - 1; i >= 0; i--) {
              if (steps[i].label?.includes(parsed.tool) && !steps[i].done) {
                steps[i].done = true
                steps[i].detail = (steps[i].detail || '') + ' -> ' + (parsed.result || '')
                if (parsed.sources && Array.isArray(parsed.sources) && parsed.sources.length > 0) {
                  steps[i].sources = parsed.sources
                }
                matched = true
                break
              }
            }
          }

          // Fallback：取最后一个未完成的工具调用
          if (!matched) {
            for (let i = steps.length - 1; i >= 0; i--) {
              if (steps[i].label?.startsWith('调用工具') && !steps[i].done) {
                steps[i].done = true
                steps[i].detail = (steps[i].detail || '') + ' -> ' + (parsed.result || '')
                if (parsed.sources && Array.isArray(parsed.sources) && parsed.sources.length > 0) {
                  steps[i].sources = parsed.sources
                }
                break
              }
            }
          }

          // 工具失败时清理对应的 pending visual 占位块
          const resultStr = String(parsed.result || '')
          const failed = parsed.success === false || /^error[:\s]/i.test(resultStr.trim())
          if (failed) {
            const failedRenderType = toolToRenderType[parsed.tool]
            if (failedRenderType) {
              const pending = findPendingVisual(blocks.value, failedRenderType)
              if (pending) {
                const idx = blocks.value.indexOf(pending)
                if (idx >= 0) blocks.value.splice(idx, 1)
              }
            }
          }
        } catch { /* ignore */ }
        break
      }
      case 'agent.visual': {
        try {
          const parsed = JSON.parse(data)
          if (streamingText.value) {
            blocks.value.push({ type: 'text', content: streamingText.value })
            streamingText.value = ''
          }
          const rt = normalizeRenderType(parsed.renderType)
          const pending = findPendingVisual(blocks.value, rt)
          if (pending) {
            pending.code = parsed.code
            pending.description = parsed.description || ''
            pending.status = 'ready'
          } else {
            blocks.value.push({
              type: 'visual',
              renderType: rt,
              code: parsed.code,
              description: parsed.description || '',
              status: 'ready',
            })
          }
        } catch { /* ignore */ }
        break
      }
      case 'chunk': {
        streamingText.value += data
        break
      }
      case 'smart.state': {
        try {
          const parsed = JSON.parse(data)
          conceptState.value = parsed.concepts || {}
          totalTurns.value = parsed.totalTurns
          converged.value = parsed.converged
        } catch { /* ignore */ }
        break
      }
      case 'smart.converged': {
        try {
          const parsed = JSON.parse(data)
          if (streamingText.value) {
            blocks.value.push({ type: 'text', content: streamingText.value })
            streamingText.value = ''
          }
          if (parsed.summary) {
            blocks.value.push({ type: 'text', content: parsed.summary })
          }
        } catch { /* ignore */ }
        break
      }
      case 'done': {
        if (streamingText.value) {
          blocks.value.push({ type: 'text', content: streamingText.value })
          streamingText.value = ''
        }
        cleanupPendingVisuals(blocks.value)
        isStreaming.value = false
        isCompleted.value = true
        break
      }
      case 'error': {
        try {
          const parsed = JSON.parse(data)
          error.value = {
            code: parsed.code || 'UNKNOWN',
            message: parsed.message || '未知错误',
            retryable: parsed.retryable ?? true,
          }
        } catch {
          error.value = { code: 'UNKNOWN', message: data, retryable: true }
        }
        cleanupPendingVisuals(blocks.value)
        isStreaming.value = false
        break
      }
    }
  }

  async function start(question: string, courseId: string) {
    cancel()        // 中止已有流
    reset()
    isStreaming.value = true

    abortController = new AbortController()

    try {
      await ensureValidToken()
      isStreaming.value = true  // 旧流 finally 可能在 await 期间清除了此标志

      const response = await fetch('/api/smart/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ question, courseId }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        error.value = {
          code: 'HTTP_ERROR',
          message: `请求失败: HTTP ${response.status}`,
          retryable: true,
        }
        isStreaming.value = false
        await response.body?.cancel()   // 释放连接
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        await response.body?.cancel()   // 释放连接
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const eventBlocks = buffer.split('\n\n')
        buffer = eventBlocks.pop() || ''

        for (const block of eventBlocks) {
          if (!block.trim()) continue
          if (abortController.signal.aborted) return
          const lines = block.split('\n')
          let eventType = ''
          let dataStr = ''

          for (const line of lines) {
            if (line.startsWith('event:')) eventType = line.slice(6).trim()
            else if (line.startsWith('data:')) {
              const val = line.slice(5)
              dataStr = dataStr === '' ? val : dataStr + '\n' + val
            }
          }
          if (!eventType && dataStr) eventType = 'chunk'
          if (dataStr) handleEvent(eventType, dataStr)
        }
      }
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        error.value = {
          code: 'CONNECTION_FAILED',
          message: (e as Error).message || '连接失败',
          retryable: true,
        }
        isStreaming.value = false
      }
    } finally {
      // 兜底：流异常终止（未收到 done/error 事件，或提前 return/abort）时清理残留 pending 占位块
      // 正常情况下 done/error 事件已处理；cleanupPendingVisuals 幂等，重复调用无副作用
      cleanupPendingVisuals(blocks.value)
      if (isStreaming.value) {
        isStreaming.value = false
      }
    }
  }

  onUnmounted(() => {
    cancel()
  })

  return {
    sessionId,
    blocks,
    thinkingSteps,
    streamingText,
    isStreaming,
    isCompleted,
    error,
    thinkingExpanded,
    conceptState,
    totalTurns,
    converged,
    start,
    cancel,
    reset,
  }
}
