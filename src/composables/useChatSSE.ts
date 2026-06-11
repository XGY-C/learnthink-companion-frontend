import { ref, computed, watch, reactive, onUnmounted } from 'vue'
import { useProfileStore } from '@/stores/profile'
import { usePlanStore } from '@/stores/plan'
import { useVideoLectureStore } from '@/stores/videoLecture'
import { apiFetch, ensureValidToken } from '@/utils/api'
import { useSSE } from '@/composables/useSSE'
import { ElMessageBox } from 'element-plus'
import type { ThinkingStep, ThinkingRecord, ThinkingPhase } from '@/types'
import type { SceneItemEvent } from '@/types/scene'

// ===== Types =====

export interface Suggestion {
  text: string
  sendAs: string
}

export interface ChatMessage {
  role: 'assistant' | 'user'
  text: string
  isStreaming?: boolean
  suggestions?: Suggestion[]
  suggestionStyle?: 'plain' | 'primary'
  thinking?: ThinkingRecord
  _feedback?: 'liked' | 'disliked'
  _planOffer?: {
    type: 'resource' | 'plan'
    topic?: string
    goalSummary?: string
    difficulty?: string
    items?: { type: string; focus: string }[]
    totalHours?: number
    focusAreas?: string[]
    coveredCount?: number
    confidence?: number
    launchTopic?: string
    requirementText?: string  // plan 类型时使用：AI总结的用户需求文本
    accepted?: boolean
    dismissed?: boolean
    confirmed?: boolean       // 已确认生成，方案保留不消失
    _previewModules?: any[]   // 缓存的预览模块数据，避免历史加载时重新调 API
    _previewEdges?: any[]     // 缓存的预览边数据
  }
  _generationCard?: { taskId: string; topic: string; taskType?: 'resource' | 'plan' }
  /** v3.1: Plan data loaded from DB (pending_decision / decided / completed plans) */
  _pendingPlan?: {
    plan_id?: string
    status?: string
    modules?: any[]
    edges?: any[]
    summary?: any
    confirmed?: boolean
  }
  /** Video lecture record card — inserted after player closes */
  _videoRecord?: {
    type: 'video-record'
    lectureId: string
    topic: string
    sceneCount: number
    lastSceneIndex: number
    completed: boolean
    keyTakeaways: string[]
    icon: 'text' | 'code' | 'diagram' | 'chat'
  }
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  courseId: string
  createdAt: string
  updatedAt: string
  lastMessagePreview?: string
  messageCount?: number
  analyzed?: boolean
  profileVersionId?: string | null
}

export interface TaskCardState {
  taskId: string
  topic: string
  taskType?: 'resource' | 'plan'
  status: 'generating' | 'done' | 'failed'
  progress: number
  resourceTypes: string[]
  readyCount: number
  totalCount: number
  message: string
  stage: string
  errorMessage?: string
  /** 缺口资源任务 ID 列表（仅 plan 任务有） */
  gapTaskIds?: string[]
  gapDone?: number
  gapTotal?: number
}

interface AgentThoughtSSE {
  agentName: string; agentRole: string; phase: string
  context: string; observation: string; thought: string
  decision: string; confidenceLevel: string; timestamp: string
}

// ===== Helpers =====

function autoTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find(m => m.role === 'user')
  if (!firstUser) return '新会话'
  const t = firstUser.text.trim()
  return t.length > 20 ? t.slice(0, 20) + '…' : t
}

function formatSessionTime(iso: string): string {
  const d = new Date(iso); const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 86400000) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (diff < 172800000) return '昨天'
  return `${d.getMonth() + 1}-${d.getDate().toString().padStart(2, '0')}`
}

// ===== Composable =====

export function useChatSSE() {
  const profile = useProfileStore()

  // ===== Session State =====
  const sessions = ref<ChatSession[]>([])
  const activeSessionId = ref('')

  const activeSession = computed(() => sessions.value.find(s => s.id === activeSessionId.value))

  const courseSessions = computed(() =>
    [...sessions.value]
      .filter(s => s.courseId === profile.activeCourseId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  )

  const showWelcomePage = computed(() => !activeSession.value || activeSession.value.messages.length === 0)

  // ===== Chat State =====
  const isStreaming = ref(false)
  const chatId = ref('')
  const profileVersionId = ref<string | null>(null)
  const totalFilled = ref(0)
  const generationReady = ref(false)
  /** 'chat' | 'resource' | 'plan' | 'lecture' — controls how intent is interpreted */
  const chatMode = ref<'chat' | 'resource' | 'plan' | 'lecture'>('chat')
  const planGenerationReady = ref(false)
  const planGenerationMeta = ref<any>(null)
  const planPreviewLoading = ref(false)
  const planPreviewData = ref<any>(null)
  const isGenerating = ref(false)
  /** Resource types detected from the last generation intent, passed to task creation */
  const pendingGenTypes = ref<string[]>([])

  // ===== Task Cards =====
  const taskCards = ref<Record<string, TaskCardState>>({})
  const taskSSE = useSSE()
  const gapEventSources = new Map<string, EventSource>()

  // ===== Callbacks (set by consuming component) =====
  let onStreamChunk: (() => void) | null = null
  let onProfileReady: (() => void) | null = null
  let onGenerationOffer: (() => void) | null = null

  function setCallbacks(opts: {
    onStreamChunk?: () => void
    onProfileReady?: () => void
    onGenerationOffer?: () => void
  }) {
    onStreamChunk = opts.onStreamChunk ?? null
    onProfileReady = opts.onProfileReady ?? null
    onGenerationOffer = opts.onGenerationOffer ?? null
  }

  // ===== Session CRUD =====

  function createSession() {
    const empty = sessions.value.find(s =>
      s.courseId === profile.activeCourseId && s.messages.length === 0 && !(s as any).messageCount
    )
    if (empty) {
      activeSessionId.value = empty.id
      chatId.value = empty.id
      return
    }
    const newId = crypto.randomUUID()
    sessions.value.unshift({
      id: newId, title: '新会话', messages: [],
      courseId: profile.activeCourseId,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    })
    activeSessionId.value = newId
    chatId.value = newId
  }

  async function loadSessions() {
    try {
      const res = await apiFetch<{
        chatId: string; courseId: string; title: string; messageCount: number
        lastMessagePreview: string; lastMessageAt: string; analyzed: boolean
        profileVersionId: string | null; createdAt: string
      }[]>('/chat/sessions?courseId=' + encodeURIComponent(profile.activeCourseId))
      if (res.data) {
        sessions.value = res.data.map(s => ({
          id: s.chatId, title: s.title || '新会话',
          messages: [] as ChatMessage[],
          courseId: s.courseId,
          createdAt: s.createdAt,
          updatedAt: s.lastMessageAt || s.createdAt,
          lastMessagePreview: s.lastMessagePreview,
          messageCount: s.messageCount,
          analyzed: s.analyzed,
          profileVersionId: s.profileVersionId,
        }))
      }
    } catch (err) { console.error('loadSessions failed:', err) }
  }

  async function startChat(courseId: string, forceNew = false) {
    try {
      const res = await apiFetch<{
        chatId: string; courseId: string; messages: { role: string; content: string; at: string }[]
        profileReady: boolean; profileVersionId: string | null
      }>('/chat/start', { method: 'POST', body: { courseId, forceNew } })
      if (!res.data) throw new Error('No data')

      chatId.value = res.data.chatId
      profileVersionId.value = res.data.profileVersionId
      const msgs: ChatMessage[] = (res.data.messages || []).map(m => ({
        role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
        text: m.content,
      }))
      const existing = sessions.value.find(s => s.id === chatId.value)
      if (existing) { existing.messages = msgs }
      else {
        const nowIso = new Date().toISOString()
        sessions.value.unshift({
          id: chatId.value, title: msgs.length > 0 ? autoTitle(msgs) : '新会话',
          messages: msgs, courseId, createdAt: nowIso, updatedAt: nowIso,
        })
      }
      activeSessionId.value = chatId.value
      if (res.data.profileReady) await loadProfileFromBackend()
    } catch (err) { console.error('startChat failed:', err) }
  }

  async function loadSessionMessages(sessionId: string) {
    try {
      const res = await apiFetch<{
        messages: { role: string; content: string; at: string; thinking?: ThinkingRecord; planOffer?: any }[]
        generationReady: boolean
        generationMeta: any
        planGenerationReady: boolean
        planGenerationMeta: any
        activeTasks: {
          taskId: string; topic: string; status: string; stage: string
          percent: number; resourceTypes: string[]; message: string
          errorMessage: string; readyCount: number; totalCount: number
          taskType?: string
        }[]
        pendingPlan?: { plan_id?: string; status?: string; modules?: any[]; edges?: any[]; summary?: any }
      }>(`/chat/${sessionId}/messages`)
      if (res.data?.messages) {
        const msgs: ChatMessage[] = res.data.messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
          text: m.content,
          thinking: m.thinking || undefined,
          _planOffer: m.planOffer || undefined,
        }))
        const session = sessions.value.find(s => s.id === sessionId)
        if (session) { session.messages = msgs }
      }

      // Reconstruct generation / plan offer state from session
      if (res.data?.generationReady && res.data?.generationMeta) {
        const meta = res.data.generationMeta as any
        const stage = meta?.stage
        const items = meta?.items || []
        if (items.length > 0) {
          pendingGenTypes.value = [...new Set<string>(items.map((i: any) => i.type as string))]
        } else if (meta?.preferences?.requestedTypes && Array.isArray(meta.preferences.requestedTypes)) {
          pendingGenTypes.value = meta.preferences.requestedTypes
        } else if (meta?.suggestedTypes) {
          pendingGenTypes.value = meta.suggestedTypes
        }
        if (stage !== 'clarifying') {
          generationReady.value = true
        }
      }

      if (res.data?.planGenerationReady && res.data?.planGenerationMeta) {
        planGenerationReady.value = true
        planGenerationMeta.value = res.data.planGenerationMeta
      }

      // Reconstruct active generation cards
      const hasActiveTasks = res.data?.activeTasks && res.data.activeTasks.length > 0
      const session = sessions.value.find(s => s.id === sessionId)
      if (hasActiveTasks) {
        for (const task of res.data.activeTasks) {
          const isActive = task.status === 'RUNNING' || task.status === 'PENDING'
          const resolvedTaskType = (task as any).taskType === 'plan_generate' ? 'plan' : 'resource'
          if (isActive) connectTaskSSE(task.taskId, task.topic, resolvedTaskType)
          if (!taskCards.value[task.taskId]) {
            taskCards.value[task.taskId] = {
              taskId: task.taskId, topic: task.topic, status: 'generating',
              progress: 0, resourceTypes: [], readyCount: 0, totalCount: 0,
              message: '准备中...', stage: '',
            }
          }
          const card = taskCards.value[task.taskId]
          card.progress = task.percent
          card.message = task.stage || ''
          card.resourceTypes = task.resourceTypes
          card.totalCount = task.totalCount
          card.readyCount = task.readyCount
          card.status = task.status === 'RUNNING' || task.status === 'PENDING'
            ? 'generating' as const
            : task.status === 'SUCCEEDED'
              ? 'done' as const
              : 'failed' as const
          card.errorMessage = task.errorMessage || ''
          if (session) {
            const cardMsg: ChatMessage = {
              role: 'assistant' as const,
              text: `好的！我已经为你启动了「${task.topic}」的资源包生成。`,
              // @ts-ignore - embedded card marker
              _generationCard: { taskId: task.taskId, topic: task.topic },
            }
            // plan_generate 任务的卡片插入延迟到 pendingPlan 处理之后，
            // 届时 _pendingPlan 已挂载到正确消息上，可精确定位插入点
            if (task.taskType === 'plan_generate') continue
            // resource_generate: 搜索用户确认消息定位插入点
            const confirmIdx = [...session.messages].reverse().findIndex(
              m => m.role === 'user' && m.text.includes(task.topic)
            )
            if (confirmIdx >= 0) {
              const insertAt = session.messages.length - confirmIdx
              session.messages.splice(insertAt, 0, cardMsg)
            } else {
              session.messages.push(cardMsg)
            }
          }
        }
      }

      // After restoring messages & active tasks, reconcile plan offer state.
      // v3.1: 优先使用 DB 中的 pendingPlan（完整数据，避免重新调 LLM）
      if (session && res.data?.pendingPlan) {
        const pp = res.data.pendingPlan
        planPreviewData.value = { modules: pp.modules || [], edges: pp.edges || [] }
        planPreviewLoading.value = false

        const planOfferMsg = findPlanOfferMsg(session, 'plan')
          || [...session.messages].reverse().find(m => m.role === 'assistant')
        if (planOfferMsg) {
          const isConfirmed = pp.status === 'decided' || pp.status === 'completed' || pp.status === 'generating' || pp.status === 'ready'
          planOfferMsg._pendingPlan = {
            plan_id: pp.plan_id,
            status: pp.status,
            modules: pp.modules,
            edges: pp.edges,
            summary: pp.summary,
            confirmed: isConfirmed,
          }
          if (isConfirmed) {
            if (!planOfferMsg._planOffer) {
              planOfferMsg._planOffer = { type: 'plan', confirmed: true }
            } else {
              planOfferMsg._planOffer.confirmed = true
            }
          }
        }
      } else if (session) {
        // Fallback: legacy planOffer-based reconciliation（无 DB 计划时）
        const hasActivePlanTask = res.data?.activeTasks?.some(
          t => t.taskType === 'plan_generate' && (t.status === 'PENDING' || t.status === 'RUNNING')
        )
        const hasCompletedPlanTask = res.data?.activeTasks?.some(
          t => t.taskType === 'plan_generate' && t.status === 'SUCCEEDED'
        )
        for (const msg of session.messages) {
          if (msg._planOffer && msg._planOffer.type === 'plan') {
            if (hasActivePlanTask) {
              // 有活跃任务 → 方案保留但标记为已确认
              msg._planOffer.confirmed = true
            } else if (hasCompletedPlanTask) {
              // 方案已生成完毕 → 清除 planOffer，不再展示 PlanEditor
              msg._planOffer = undefined
              break
            } else {
              // 无任何任务 → 方案待确认，可继续编辑
              msg._planOffer.confirmed = false
              msg._planOffer.accepted = false
              msg._planOffer.dismissed = false
            }

            if (!msg._planOffer) break

            if (!msg._planOffer.dismissed) {
              // 优先使用缓存的预览数据，避免重新调 /plan/preview
              if (msg._planOffer._previewModules && msg._planOffer._previewModules.length > 0) {
                planPreviewData.value = {
                  modules: msg._planOffer._previewModules,
                  edges: msg._planOffer._previewEdges || [],
                }
                planPreviewLoading.value = false
              } else {
                const requirementText = msg._planOffer.requirementText
                if (requirementText) {
                  fetchPlanPreview(requirementText)
                }
              }
            }
            break
          }
        }
      }

      // 资源 offer 状态校准：有活跃/已完成资源任务时，标记 offer 为已接受
      if (session) {
        const hasActiveResourceTask = res.data?.activeTasks?.some(
          t => t.taskType !== 'plan_generate' && (t.status === 'PENDING' || t.status === 'RUNNING')
        )
        const hasCompletedResourceTask = res.data?.activeTasks?.some(
          t => t.taskType !== 'plan_generate' && t.status === 'SUCCEEDED'
        )
        for (const msg of session.messages) {
          if (msg._planOffer && msg._planOffer.type === 'resource') {
            if (hasActiveResourceTask || hasCompletedResourceTask) {
              msg._planOffer.accepted = true
            }
          }
        }
      }

      // v3.1: 为 plan_generate 任务插入 GenerationCard — 此时 _pendingPlan 已挂载，
      // 可精确定位 PlanEditor 消息位置，不再依赖脆弱的文本匹配
      if (session) {
        const planTasks = res.data?.activeTasks?.filter(
          (t: any) => t.taskType === 'plan_generate'
        ) || []
        if (planTasks.length > 0) {
          const anchorIdx = session.messages.findIndex(
            m => m._pendingPlan || (m._planOffer?.type === 'plan')
          )
          const insertAt = anchorIdx >= 0 ? anchorIdx + 1 : session.messages.length
          for (const task of planTasks) {
            const alreadyHas = session.messages.some(
              m => (m as any)._generationCard?.taskId === task.taskId
            )
            if (alreadyHas) continue
            session.messages.splice(insertAt, 0, {
              role: 'assistant' as const,
              text: '好的！我已确认你的学习方案，正在生成详细学习活动。',
              _generationCard: { taskId: task.taskId, topic: task.topic, taskType: 'plan' },
            } as any)
          }
        }
      }
    } catch (err) { console.error('loadSessionMessages failed:', err) }
  }

  async function switchSession(sessionId: string) {
    if (!sessionId) return
    if (activeSessionId.value !== sessionId) {
      activeSessionId.value = sessionId
      chatId.value = sessionId
      profileVersionId.value = null
    }
    const session = sessions.value.find(s => s.id === sessionId)
    if (session) {
      if (session.messages.length === 0) await loadSessionMessages(sessionId)
      if (session.profileVersionId) {
        profileVersionId.value = session.profileVersionId
        await loadProfileFromBackend()
      }
    }
  }

  async function deleteSession(sessionId: string) {
    if (sessions.value.length <= 1) {
      throw new Error('至少保留一个会话')
    }
    try { await apiFetch('/chat/' + sessionId, { method: 'DELETE' }) } catch { /* proceed */ }
    const idx = sessions.value.findIndex(s => s.id === sessionId)
    if (idx === -1) return
    sessions.value.splice(idx, 1)
    if (activeSessionId.value === sessionId) {
      const next = sessions.value[0]
      activeSessionId.value = next?.id ?? ''
      chatId.value = activeSessionId.value
      if (next && next.messages.length === 0) await loadSessionMessages(next.id)
    }
  }

  // ===== Init =====

  async function initChat() {
    sessions.value = []
    chatId.value = ''
    activeSessionId.value = ''
    await loadSessions()
    if (sessions.value.length > 0) {
      await switchSession(sessions.value[0].id)
    } else {
      createSession()
    }
  }

  // ===== Send Message (SSE streaming) =====

  async function sendMessage(text: string): Promise<void> {
    const content = text.trim()
    if (!content) return
    if (isStreaming.value) return

    if (!activeSessionId.value) {
      createSession()
      if (!activeSessionId.value) return
    }

    if (!activeSession.value) {
      await initChat()
      if (!activeSessionId.value) return
    }

    const targetSession = activeSession.value!

    targetSession.messages.push({ role: 'user', text: content })
    if (targetSession.title === '新会话') {
      targetSession.title = autoTitle(targetSession.messages)
    }
    targetSession.updatedAt = new Date().toISOString()
    isStreaming.value = true

    const thinkingSteps = reactive<ThinkingStep[]>([])
    const thinking: ThinkingRecord = { steps: thinkingSteps, expanded: true }

    const msgIndex = targetSession.messages.length
    targetSession.messages.push({ role: 'assistant', text: '', isStreaming: true, thinking })

    await ensureValidToken()
    const token = localStorage.getItem('token') || ''

    try {
      const response = await fetch(`/api/chat/${activeSessionId.value}/send/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          content,
          courseId: profile.activeCourseId,
          ...(chatMode.value !== 'chat' ? { mode: chatMode.value } : {}),
          ...(import.meta.env.VITE_DIALOGUE_MODE === 'unified' ? { dialogueMode: 'unified' } : {}),
        }),
      })

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token'); localStorage.removeItem('refreshToken')
          localStorage.removeItem('userInfo'); location.href = '/login'
          return
        }
        if (response.status === 404) {
          if (targetSession) {
            targetSession.messages.pop()
            targetSession.messages.pop()
          }
          await initChat()
          if (activeSessionId.value) {
            return sendMessage(content)
          }
          isStreaming.value = false
          return
        }
        throw new Error('HTTP ' + response.status)
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let profileReadyVal = false, profileVersionIdVal: string | null = null
      let generationReadyVal = false, generationMetaVal: any = null
      let planGenerationReadyVal = false, planGenerationMetaVal: any = null
      let coveredCountVal = 0
      let firstChunk = true

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() || ''

        for (const block of blocks) {
          if (!block.trim()) continue
          const lines = block.split('\n')
          let eventType = '', dataStr = ''

          for (const line of lines) {
            if (line.startsWith('event:')) eventType = line.slice(6).trim()
            else if (line.startsWith('data:')) {
              const val = line.slice(5)
              dataStr = dataStr === '' ? val : dataStr + '\n' + val
            }
          }
          if (!dataStr) continue

          if (eventType === 'agent.thought') {
            try {
              const parsed: AgentThoughtSSE = JSON.parse(dataStr)
              const phaseLabels: Record<string, { label: string; icon: string }> = {
                CONTEXT:  { label: '理解上下文', icon: '📋' },
                RETRIEVE: { label: '检索知识库', icon: '🔗' },
                REFLECT:  { label: '评估画像',   icon: '🎯' },
                RAG:      { label: '检索分析',   icon: '🔍' },
                DECISION: { label: '决策判断',   icon: '⚖️' },
                PLANNING: { label: '意图分析与回复规划', icon: '🔍' },
                ERROR:    { label: '执行异常',   icon: '⚠️' },
              }
              const meta = phaseLabels[parsed.phase] || { label: parsed.phase, icon: '●' }
              const step: ThinkingStep = {
                label: meta.label,
                icon: meta.icon,
                done: true,
                phase: (parsed.phase as ThinkingPhase) || undefined,
                detail: parsed.observation || parsed.thought || '',
                observation: parsed.observation || undefined,
                thought: parsed.thought || undefined,
                decision: parsed.decision || undefined,
                confidenceLevel: parsed.confidenceLevel || undefined,
              }
              if (!thinkingSteps.some(s => s.label === meta.label)) {
                thinkingSteps.push(step)
              }
              if (parsed.phase === 'REFLECT') {
                targetSession.messages[msgIndex].thinking = {
                  steps: [...thinkingSteps],
                  expanded: false,
                }
              }
            } catch { /* ignore */ }
          } else if (eventType === 'done') {
            try {
              const parsed = JSON.parse(dataStr)
              profileReadyVal = parsed.profileReady ?? false
              profileVersionIdVal = parsed.profileVersionId || null
              generationReadyVal = parsed.generationReady ?? false
              generationMetaVal = parsed.generationMeta
              planGenerationReadyVal = parsed.planGenerationReady ?? false
              planGenerationMetaVal = parsed.planGenerationMeta
              coveredCountVal = parsed.coveredCount ?? 0
              // Phase 6: respect replyPlan.shouldShowOffer from backend
              if (parsed.replyPlan && parsed.replyPlan.shouldShowOffer === false) {
                generationReadyVal = false
              }
              console.log('[SSE done] generationReady=', generationReadyVal, 'replyPlan=', parsed.replyPlan)
            } catch { /* fall through */ }
            if (targetSession) {
              const msg = targetSession.messages[msgIndex]
              if (msg && msg.thinking) {
                thinkingSteps.forEach(s => s.done = true)
                targetSession.messages[msgIndex].thinking = {
                  steps: [...thinkingSteps],
                  expanded: false,
                }
              }
            }
          } else if (eventType === 'chunk' || !eventType) {
            if (dataStr.startsWith('{') && dataStr.includes('"type"')) {
              try {
                const parsed = JSON.parse(dataStr)
                profileReadyVal = parsed.profileReady ?? profileReadyVal
                profileVersionIdVal = parsed.profileVersionId ?? profileVersionIdVal
                generationReadyVal = parsed.generationReady ?? generationReadyVal
              } catch { /* legacy */ }
            } else {
              if (firstChunk) { firstChunk = false }
              const messages = targetSession.messages
              const msg = messages[msgIndex]
              messages.splice(msgIndex, 1, { ...msg, text: msg.text + dataStr })
              if (onStreamChunk) onStreamChunk()
            }
          }
        }
      }

      // Finalize
      const doneMsg = targetSession.messages[msgIndex]
      targetSession.messages.splice(msgIndex, 1, { ...doneMsg, isStreaming: false })
      thinkingSteps.forEach(s => s.done = true)
      const finalThinking = targetSession.messages[msgIndex].thinking
      if (finalThinking) {
        finalThinking.steps.forEach(s => s.done = true)
        finalThinking.expanded = false
      }
      targetSession.messages[msgIndex].isStreaming = false

      if (profileReadyVal) {
        profileVersionId.value = profileVersionIdVal
        await loadProfileFromBackend()
        if (onProfileReady) onProfileReady()
      }
      profile.refreshProfile()

      if (generationReadyVal) {
        generationReady.value = true
        const stage = (generationMetaVal as any)?.stage
        console.log('[ChatSSE] generationReadyVal=true, stage=', stage, 'meta=', generationMetaVal)

        if (stage === 'clarifying') {
          console.log('[ChatSSE] clarifying stage — no offer')
        } else {
          if (coveredCountVal > 0) totalFilled.value = coveredCountVal
          const meta = generationMetaVal as any
          const prefs = meta?.preferences
          const resolvedTopic = prefs?.topic || meta?.topic
          const launchTopic = resolvedTopic
            || [...targetSession.messages].reverse().find(m => m.role === 'user')?.text
            || ''
          // Read items from generationMeta (backend sends List<{type, focus}>)
          const items: { type: string; focus: string }[] = meta?.items || []
          if (items.length > 0) {
          pendingGenTypes.value = [...new Set<string>(items.map((i: any) => i.type))]
          } else if (prefs?.requestedTypes && Array.isArray(prefs.requestedTypes)) {
            pendingGenTypes.value = prefs.requestedTypes
          } else if (meta?.suggestedTypes) {
            pendingGenTypes.value = meta.suggestedTypes
          }
          // Attach _planOffer to the AI response message (not a separate message)
          targetSession.messages[msgIndex]._planOffer = {
            type: 'resource',
            topic: resolvedTopic || launchTopic,
            goalSummary: meta?.goalSummary,
            difficulty: meta?.difficulty,
            items,
            coveredCount: coveredCountVal > 0 ? coveredCountVal : meta?.coveredCount,
            confidence: meta?.confidence,
            launchTopic,
          }
          if (onGenerationOffer) onGenerationOffer()
        }
      }

      if (planGenerationReadyVal) {
        planGenerationReady.value = true
        planGenerationMeta.value = planGenerationMetaVal
        const meta = planGenerationMetaVal as any
        const launchTopic = [...targetSession.messages].reverse().find(m => m.role === 'user')?.text || ''
        const requirementText = meta?.requirementText || ''
        targetSession.messages[msgIndex]._planOffer = {
          type: 'plan',
          requirementText,
          coveredCount: meta?.coveredCount,
          launchTopic,
        }
        // 自动触发大计划预览
        if (requirementText) {
          fetchPlanPreview(requirementText)
        }
      }
    } catch (err) {
      if (targetSession.messages[msgIndex]) {
        targetSession.messages[msgIndex].text = '抱歉，消息发送失败，请重试。'
        targetSession.messages[msgIndex].isStreaming = false
      }
      console.error('sendMessage failed:', err)
    } finally {
      isStreaming.value = false
    }
  }

  // ===== Send Lecture Message (智能助手 / 视频讲解模式) =====

  async function sendLectureMessage(text: string): Promise<void> {
    const content = text.trim()
    if (!content) return
    if (isStreaming.value) return

    if (!activeSessionId.value) {
      createSession()
      if (!activeSessionId.value) return
    }

    if (!activeSession.value) {
      await initChat()
      if (!activeSessionId.value) return
    }

    const targetSession = activeSession.value!
    const videoStore = useVideoLectureStore()

    targetSession.messages.push({ role: 'user', text: content })
    if (targetSession.title === '新会话') {
      targetSession.title = autoTitle(targetSession.messages)
    }
    targetSession.updatedAt = new Date().toISOString()
    isStreaming.value = true

    // Start the video lecture loading phase
    videoStore.startLoading(content)

    // Push a placeholder message that will be removed when the player opens
    const msgIndex = targetSession.messages.length
    targetSession.messages.push({ role: 'assistant', text: '', isStreaming: true })

    await ensureValidToken()
    const token = localStorage.getItem('token') || ''

    let lastSceneReceived = false

    try {
      const response = await fetch('/api/smart-assistant/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          question: content,
          courseId: profile.activeCourseId,
        }),
      })

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token'); localStorage.removeItem('refreshToken')
          localStorage.removeItem('userInfo'); location.href = '/login'
          return
        }
        throw new Error('HTTP ' + response.status)
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() || ''

        for (const block of blocks) {
          if (!block.trim()) continue
          const lines = block.split('\n')
          let eventType = '', dataStr = ''

          for (const line of lines) {
            if (line.startsWith('event:')) eventType = line.slice(6).trim()
            else if (line.startsWith('data:')) {
              const val = line.slice(5)
              dataStr = dataStr === '' ? val : dataStr + '\n' + val
            }
          }
          if (!dataStr) continue

          if (eventType === 'error') {
            const errorMsg = dataStr || '回答失败，请稍后重试。'
            targetSession.messages[msgIndex].text = errorMsg
            targetSession.messages[msgIndex].isStreaming = false
            videoStore.reset()
          } else if (eventType === 'item') {
            try {
              const parsed: SceneItemEvent = JSON.parse(dataStr)
              videoStore.receiveScene(parsed)
              lastSceneReceived = true
            } catch {
              // ignore parse errors
            }
          } else if (eventType === 'done') {
            videoStore.markStreamEnded()
          } else if (eventType === 'chunk' || !eventType) {
            // Legacy chunk events — used as fallback text
            if (onStreamChunk) onStreamChunk()
          }
        }
      }

      // If no scenes were received at all, show as text fallback
      if (!lastSceneReceived) {
        targetSession.messages[msgIndex].text = '抱歉，未能生成视频讲解，请重试。'
      }
    } catch (err) {
      if (targetSession.messages[msgIndex]) {
        targetSession.messages[msgIndex].text = '抱歉，消息发送失败，请重试。'
      }
      videoStore.reset()
      console.error('sendLectureMessage failed:', err)
    } finally {
      // Remove the loading placeholder — the video player handles the display
      if (!lastSceneReceived) {
        targetSession.messages[msgIndex].isStreaming = false
      } else {
        // Remove placeholder message; the video record card will replace it on close
        targetSession.messages.splice(msgIndex, 1)
      }
      isStreaming.value = false
    }
  }

  /**
   * Called when VideoLecturePlayer closes — insert record card into chat.
   */
  function onLecturePlayerClose() {
    const videoStore = useVideoLectureStore()
    const card = videoStore.lastRecord
    if (!card) return

    const session = activeSession.value
    if (!session) return

    // Push video record card message
    session.messages.push({
      role: 'assistant',
      text: '',
      // @ts-ignore - video record card marker
      _videoRecord: card,
    })
  }

  // ===== Task SSE =====

  function connectTaskSSE(taskId: string, topic: string, taskType: 'resource' | 'plan' = 'resource') {
    if (!taskSSE) return
    taskCards.value[taskId] = {
      taskId, topic, taskType, status: 'generating', progress: 0,
      resourceTypes: [], readyCount: 0, totalCount: 0,
      message: '准备中...', stage: '',
    }
    taskSSE.connect(taskId, {
      onStage(data) {
        const card = taskCards.value[taskId]
        if (!card) return
        card.progress = data.percent || 0
        card.message = data.message || card.message
        card.stage = data.stage || card.stage
        const rts = (data as any).stats?.resourceTypes
        if (rts && Array.isArray(rts) && rts.length > 0) {
          card.resourceTypes = rts
          card.totalCount = rts.length
        }
      },
      onResourceReady(data) {
        const card = taskCards.value[taskId]
        if (!card) return
        card.readyCount++
        card.totalCount = Math.max(card.totalCount, card.readyCount)
        if (data.type && !card.resourceTypes.includes(data.type)) {
          card.resourceTypes = [...card.resourceTypes, data.type]
        }
      },
      onGapTasks(data: any) {
        const card = taskCards.value[taskId]
        if (!card) return
        const gapIds: string[] = (data.tasks || []).map((t: any) => t.task_id)
        card.gapTaskIds = gapIds
        card.gapTotal = gapIds.length
        card.gapDone = 0
      },
      onTaskDone(data: any) {
        const card = taskCards.value[taskId]
        if (!card) return
        card.status = 'done'
        if (data?.resourcesReady) card.totalCount = data.resourcesReady
        setCardMessageText(taskId, topic, taskType, 'done', '')
      },
      onTaskFailed(data) {
        const card = taskCards.value[taskId]
        if (card) { card.status = 'failed'; card.errorMessage = data.message || '生成失败' }
        setCardMessageText(taskId, topic, taskType, 'failed', data.message || '未知错误')
      },
    })
  }

  function cleanupGapSources() {
    gapEventSources.forEach(es => es.close())
    gapEventSources.clear()
  }

  function setCardMessageText(taskId: string, topic: string, taskType: string, result: 'done' | 'failed', errorMsg: string) {
    const session = activeSession.value
    if (!session) return
    const msg = session.messages.find(m => (m as any)._generationCard?.taskId === taskId)
    if (!msg) return
    if (result === 'done') {
      msg.text = taskType === 'plan'
        ? `学习计划「${topic}」已全部生成完毕，点击卡片查看详情。`
        : `资源包「${topic}」已生成完毕，点击卡片查看详情。`
    } else {
      msg.text = `抱歉，「${topic}」生成失败：${errorMsg}，请重试。`
    }
  }

  // ===== Trigger Generate =====

  async function triggerGenerate(topic: string): Promise<string | null> {
    if (!topic.trim()) return null
    if (isGenerating.value) return null
    if (totalFilled.value < 4) {
      throw new Error('画像信息还不够完善（至少需要 4 个维度），请先多聊几句')
    }

    const types = pendingGenTypes.value.length > 0 ? pendingGenTypes.value : undefined
    pendingGenTypes.value = []
    isGenerating.value = true
    try {
      const res = await apiFetch<{ taskId: string }>('/tasks/generate', {
        method: 'POST',
        body: {
          courseId: profile.activeCourseId,
          topic: topic.trim(),
          profileVersion: profile.fullProfile?.version || 1,
          chatId: chatId.value,
          ...(types ? { resourceTypes: types } : {}),
        },
      })
      if (res.data?.taskId) {
        const taskId = res.data.taskId
        connectTaskSSE(taskId, topic.trim())
        const session = activeSession.value
        if (session) {
          session.messages.push({
            role: 'assistant',
            text: `好的！我已经为你启动了「${topic.trim()}」的资源包生成。`,
            // @ts-ignore
            _generationCard: { taskId, topic: topic.trim() },
          })
        }
        generationReady.value = false
        return taskId
      }
      throw new Error('创建生成任务失败')
    } finally {
      isGenerating.value = false
    }
  }

  // ===== Plan Offer Accept / Dismiss (via _planOffer message) =====

  function findPlanOfferMsg(session: ChatSession | undefined, type: 'resource' | 'plan'): ChatMessage | null {
    if (!session) return null
    return [...session.messages].reverse().find(m =>
      m._planOffer && m._planOffer.type === type && !m._planOffer.accepted && !m._planOffer.dismissed
    ) || null
  }

  async function acceptGenerationOffer(targetMsg?: ChatMessage): Promise<string | null> {
    if (isGenerating.value) return null
    const session = activeSession.value
    if (!session) return null
    const msg = targetMsg || findPlanOfferMsg(session, 'resource')
    if (!msg || !msg._planOffer) return null
    const offer = msg._planOffer
    offer.accepted = true
    const topic = offer.launchTopic || offer.topic
    session.messages.push({ role: 'user', text: `确认生成「${topic}」` })
    session.updatedAt = new Date().toISOString()
    return triggerGenerate(topic || '')
  }

  function dismissGenerationOffer() {
    const session = activeSession.value
    if (!session) return
    const msg = findPlanOfferMsg(session, 'resource')
    if (msg && msg._planOffer) msg._planOffer.dismissed = true
  }

  async function acceptPlanOffer(): Promise<void> {
    const session = activeSession.value
    if (!session) return
    const msg = findPlanOfferMsg(session, 'plan')
    if (!msg || !msg._planOffer) return
    const offer = msg._planOffer
    offer.confirmed = true
    const topic = offer.launchTopic || '学习计划'
    const requirementText = offer.requirementText || ''
    await confirmPlanGeneration(topic, requirementText)
  }

  function dismissPlanOffer() {
    const session = activeSession.value
    if (!session) return
    const msg = findPlanOfferMsg(session, 'plan')
    if (msg && msg._planOffer) msg._planOffer.dismissed = true
  }

  // ===== Confirm Generation (handles suggestion click) =====

  async function confirmGeneration(topic: string): Promise<string | null> {
    if (isGenerating.value) return null
    const session = activeSession.value
    if (!session) return null

    const confirmText = `确认生成「${topic}」`
    session.messages.push({ role: 'user', text: confirmText })
    session.updatedAt = new Date().toISOString()

    // 直接触发生成，不走 /send 同步
    return triggerGenerate(topic)
  }

  // ===== Confirm Plan Generation =====

  async function confirmPlanGeneration(topic: string, requirementText: string): Promise<void> {
    if (isGenerating.value) return
    const session = activeSession.value
    if (!session) return

    const confirmText = `确认生成学习计划：${topic}`
    session.messages.push({ role: 'user', text: confirmText })
    session.updatedAt = new Date().toISOString()

    const planStore = usePlanStore()
    const courseId = profile.activeCourseId
    const pv = profile.fullProfile?.version || 1

    try {
      const result = await planStore.generatePlan(courseId, pv, false, requirementText)
      if (!result) {
        session.messages.push({ role: 'assistant', text: '抱歉，学习计划生成启动失败，请稍后重试。' })
        planGenerationReady.value = false
        return
      }

      if (result.alreadyInProgress) {
        // 弹窗让用户选择：查看进度 / 重新规划
        try {
          await ElMessageBox.confirm(
            '检测到已有一个学习计划生成任务正在进行中。你可以查看当前进度，或者重新规划。',
            '已有学习计划正在生成',
            { confirmButtonText: '重新规划', cancelButtonText: '查看进度', type: 'warning' },
          )
          // 重新规划
          const newResult = await planStore.generatePlan(courseId, pv, true)
          if (newResult && !newResult.alreadyInProgress) {
            connectTaskSSE(newResult.taskId, topic, 'plan')
            session.messages.push({
              role: 'assistant',
              text: `好的！我已经为你重新启动了「${topic}」的学习计划生成。`,
              // @ts-ignore
              _generationCard: { taskId: newResult.taskId, topic, taskType: 'plan' },
            })
          }
        } catch {
          // 查看进度：连接到已有任务的 SSE
          connectTaskSSE(result.taskId, topic, 'plan')
          session.messages.push({
            role: 'assistant',
            text: `学习计划正在生成中，你可以在下方卡片中查看实时进度。`,
            // @ts-ignore
            _generationCard: { taskId: result.taskId, topic, taskType: 'plan' },
          })
        }
      } else {
        // 正常新任务
        connectTaskSSE(result.taskId, topic, 'plan')
        session.messages.push({
          role: 'assistant',
          text: `好的！我已经为你启动了「${topic}」的学习计划生成。`,
          // @ts-ignore
          _generationCard: { taskId: result.taskId, topic, taskType: 'plan' },
        })
      }
    } catch {
      session.messages.push({ role: 'assistant', text: '抱歉，学习计划生成启动失败，请稍后重试。' })
    }

    planGenerationReady.value = false
  }

  /**
   * 预览大计划 — 给 PlanEditor 使用
   */
  async function fetchPlanPreview(requirementText: string): Promise<any | null> {
    if (planPreviewLoading.value) return planPreviewData.value
    planPreviewLoading.value = true
    planPreviewData.value = null
    try {
      const planStore = usePlanStore()
      const courseId = profile.activeCourseId
      const pv = profile.fullProfile?.version || 1
      const data = await planStore.previewPlan(courseId, pv, requirementText, chatId.value)
      planPreviewData.value = data
      // v3.1: 自动落库（status=pending_decision），切换会话不丢方案
      if (data?.modules?.length > 0) {
        updatePlanDraft(JSON.stringify({
          modules: data.modules,
          edges: data.edges || [],
          summary: data.summary || {},
        }), data.plan_id)
      }
      // 缓存预览数据到 planOffer，历史加载时避免重新调 API
      const session = activeSession.value
      if (session && data) {
        const offerMsg = findPlanOfferMsg(session, 'plan')
        if (offerMsg?._planOffer) {
          offerMsg._planOffer._previewModules = data.modules
          offerMsg._planOffer._previewEdges = data.edges
        }
      }
      return data
    } catch {
      return null
    } finally {
      planPreviewLoading.value = false
    }
  }

  /**
   * 保存/更新计划草稿到后端 — PlanEditor 编辑时自动调用（防抖）
   * @param planJson 完整计划 JSON
   * @param explicitPlanId 首次保存时从 previewPlan 响应中获取的 plan_id
   */
  async function updatePlanDraft(planJson: string, explicitPlanId?: string): Promise<void> {
    try {
      const planStore = usePlanStore()
      const courseId = profile.activeCourseId
      const pv = profile.fullProfile?.version || 1
      // 优先使用显式传入的 planId，其次从 _pendingPlan 中取
      let planId = explicitPlanId
      if (!planId) {
        const session = activeSession.value
        if (session) {
          const planOfferMsg = findPlanOfferMsg(session, 'plan')
            || [...session.messages].reverse().find(m => m._pendingPlan)
          planId = planOfferMsg?._pendingPlan?.plan_id
        }
      }
      if (!planId && (planPreviewData.value as any)?.plan_id) {
        planId = (planPreviewData.value as any).plan_id
      }
      const result = await planStore.updatePlanDraft(planId, courseId, pv, planJson, chatId.value)
      // 更新 _pendingPlan.plan_id 以便后续确认时使用
      if (result?.plan_id) {
        const session = activeSession.value
        if (session) {
          const planOfferMsg = findPlanOfferMsg(session, 'plan')
            || [...session.messages].reverse().find(m => m._pendingPlan)
          if (planOfferMsg?._pendingPlan) {
            planOfferMsg._pendingPlan.plan_id = result.plan_id
          } else if (planOfferMsg) {
            planOfferMsg._pendingPlan = { plan_id: result.plan_id, status: 'pending_decision', confirmed: false }
          }
        }
      }
    } catch (e) {
      console.warn('Plan draft update failed:', e)
    }
  }

  /**
   * 确认编辑后的计划 — 给 PlanEditor 使用
   */
  async function confirmEditedPlan(planJson: string, requirementText: string, topic: string): Promise<void> {
    const session = activeSession.value
    if (!session) return

    // 标记为已确认但保留 PlanEditor 可见（方案不消失）
    const offerMsg = findPlanOfferMsg(session, 'plan')
    if (offerMsg?._planOffer) {
      offerMsg._planOffer.confirmed = true
      // 缓存确认后的方案数据，历史加载时直接使用，避免重新调 /plan/preview
      try {
        const parsed = JSON.parse(planJson)
        if (parsed.modules) {
          offerMsg._planOffer._previewModules = parsed.modules
          offerMsg._planOffer._previewEdges = parsed.edges || []
          planPreviewData.value = { modules: parsed.modules, edges: parsed.edges || [] }
        }
      } catch { /* ignore parse error */ }
    }
    // v3.1: 同步更新 _pendingPlan 状态
    if (offerMsg?._pendingPlan) {
      offerMsg._pendingPlan.confirmed = true
      offerMsg._pendingPlan.status = 'decided'
    }

    const planStore = usePlanStore()
    const courseId = profile.activeCourseId
    const pv = profile.fullProfile?.version || 1

    const result = await planStore.confirmPlan(courseId, pv, planJson, requirementText, chatId.value)
    if (!result) {
      session.messages.push({ role: 'assistant', text: '抱歉，计划确认失败，请稍后重试。' })
      return
    }

    connectTaskSSE(result.taskId, topic, 'plan')
    session.messages.push({
      role: 'assistant',
      text: `好的！我已确认你的学习方案，正在生成详细学习活动。`,
      // @ts-ignore
      _generationCard: { taskId: result.taskId, topic, taskType: 'plan' },
    })
    planGenerationReady.value = false
  }

  // ===== Profile =====

  async function loadProfileFromBackend() {
    try {
      const res = await apiFetch<any>(`/chat/${activeSessionId.value}/analyze`, { method: 'POST' })
      if (res.data && res.data.dimensions?.dimensions) {
        profile.loadFromProfile({
          profile_id: res.data.profileVersionId, user_id: '', course_id: profile.activeCourseId,
          version: res.data.version, dimensions: res.data.dimensions.dimensions,
          updated_at: new Date().toISOString(), last_trigger: 'chat',
        })
        totalFilled.value = res.data.dimensions.dimensions.length
      }
    } catch (err) { console.error('loadProfile failed:', err) }
  }

  // ===== SSE reconnection for mobile =====

  function setupMobileReconnection() {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const session = activeSession.value
        if (session && session.messages.length > 0) {
          loadSessionMessages(activeSessionId.value)
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }

  // ===== Watch course change =====

  watch(() => profile.activeCourseId, () => {
    initChat()
  })

  onUnmounted(() => {
    cleanupGapSources()
  })

  return {
    // State
    sessions,
    activeSessionId,
    activeSession,
    courseSessions,
    showWelcomePage,
    isStreaming,
    chatId,
    profileVersionId,
    totalFilled,
    generationReady,
    chatMode,
    planGenerationReady,
    planGenerationMeta,
    planPreviewLoading,
    planPreviewData,
    isGenerating,
    taskCards,

    // Plan offers (in-chat cards)
    acceptGenerationOffer,
    dismissGenerationOffer,
    acceptPlanOffer,
    dismissPlanOffer,

    // Callbacks
    setCallbacks,
    formatSessionTime,

    // Methods
    initChat,
    createSession,
    startChat,
    loadSessions,
    loadSessionMessages,
    switchSession,
    deleteSession,
    sendMessage,
    sendLectureMessage,
    onLecturePlayerClose,
    connectTaskSSE,
    triggerGenerate,
    confirmGeneration,
    confirmPlanGeneration,
    cleanupGapSources,
    fetchPlanPreview,
    confirmEditedPlan,
    updatePlanDraft,
    loadProfileFromBackend,
    setupMobileReconnection,
  }
}
