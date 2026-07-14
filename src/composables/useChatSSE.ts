import { ref, computed, watch, reactive, onUnmounted } from 'vue'
import { useProfileStore } from '@/stores/profile'
import { usePlanStore } from '@/stores/plan'
import { useVideoLectureStore } from '@/stores/videoLecture'
import { useTutoringStore } from '@/stores/tutoring'
import { useTutoringSSE } from '@/composables/useTutoringSSE'
import { useDirectAnswerStore } from '@/stores/directAnswer'
import { useDirectAnswerInlineSSE } from '@/composables/useDirectAnswerInlineSSE'
import { apiFetch, ensureValidToken } from '@/utils/api'
import { useSSE } from '@/composables/useSSE'
import { ElMessageBox } from 'element-plus'
import type { ThinkingStep, ThinkingRecord, ThinkingPhase, SearchSource } from '@/types'
import type { SceneItemEvent } from '@/types/scene'
import type { TutoringMode, TutoringStartRequest, SectionState, QuestionAnalysis, ReActThought, GuidedStepState } from '@/types/tutoring'
import type { DirectAnswerSectionState, AnswerMetadata, ProblemAnalysis } from '@/types/directAnswer'
import type { VisualRenderType } from '@/types/smart'

// ===== Types =====

export interface ChatFileAttachment {
  fileName: string
  fileUrl: string
  parsedText: string
  fileSize: number
  contentType: string
  isImage: boolean
}

export interface Suggestion {
  text: string
  sendAs: string
}

export interface ChatMessage {
  role: 'assistant' | 'user'
  text: string
  messageId?: string
  isStreaming?: boolean
  suggestions?: Suggestion[]
  suggestionStyle?: 'plain' | 'primary'
  thinking?: ThinkingRecord
  feedback?: 'liked' | 'disliked' | null
  mode?: string
  metadataJson?: Record<string, any>
  _files?: ChatFileAttachment[]
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
  /** Tutoring state — 图文辅导模式内联渲染 */
  _tutoring?: {
    active: boolean
    completed: boolean
    sessionId: string | null
    subMode?: string
    /** 活跃 tutoring 的运行时状态快照（切换会话时保存/恢复用） */
    runtimeState?: {
      status: string
      currentGuidedStepIdx: number
      sectionOrder: string[]
      sections: Record<string, SectionState>
    }
    snapshot?: {
      expanded?: boolean
      analysis: QuestionAnalysis | null
      reactThoughts: ReActThought[]
      sections: SectionState[]
      guidedSteps?: GuidedStepState[]
      guidedSummary?: string
    }
  }
  /** DirectAnswer state — 直接模式内联渲染 */
  _directAnswer?: {
    active: boolean
    completed: boolean
    sessionId: string | null
    snapshot?: {
      sections: DirectAnswerSectionState[]
      thoughtContent?: string
      metadata?: AnswerMetadata | null
      analysis?: ProblemAnalysis | null
    }
  }
  /** Smart v2 state - Agent ReAct 模式内联渲染 */
  _smart?: {
    active: boolean
    completed: boolean
    sessionId: string | null
    /** 内容块序列 -- 文字和可视化自然交替 */
    blocks: Array<
      | { type: 'text'; content: string }
      | { type: 'visual'; renderType: VisualRenderType; code: string; description: string; status?: 'pending' | 'ready' }
    >
    /** 思考链步骤 */
    thinkingSteps: ThinkingStep[]
    /** 思考链展开状态 */
    thinkingExpanded?: boolean
    /** 认知状态 */
    conceptState?: Record<string, string>
    totalTurns?: number
    converged?: boolean
    /** 错误信息 */
    error?: { code: string; message: string; retryable: boolean }
  }
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  courseId: string
  type?: 'chat' | 'lecture' | 'resource' | 'plan'
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
  sources?: SearchSource[]
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

/**
 * C3: 根据消息元数据推断 session 的实际 type。
 * 后端 type 字段迁移未全覆盖时的前端兜底。
 */
function inferSessionType(
  session: { messages?: { metadataJson?: Record<string, any>; mode?: string }[] },
  rawMessages?: { metadataJson?: Record<string, any>; mode?: string }[]
): 'chat' | 'lecture' | 'resource' | 'plan' {
  // 优先使用 rawMessages（后端返回的最新数据），因为调用时 session.messages 可能尚未赋值
  const msgs = (rawMessages && rawMessages.length > 0) ? rawMessages : session.messages
  if (!msgs || msgs.length === 0) return 'chat'
  // 如果消息中有 tutoring_session_id 元数据或 mode 为 lecture/smart，推断为 lecture（辅导）
  const hasLecture = msgs.some(m => m.metadataJson?.tutoring_session_id || m.mode === 'lecture' || m.mode === 'smart')
  if (hasLecture) return 'lecture'
  // 如果有 plan 元数据或 mode 为 plan，推断为 plan
  const hasPlan = msgs.some(m => m.metadataJson?.plan_id || m.mode === 'plan')
  if (hasPlan) return 'plan'
  // 如果有 resource task 元数据或 mode 为 resource，推断为 resource
  const hasResource = msgs.some(m => m.metadataJson?.task_id || m.mode === 'resource')
  if (hasResource) return 'resource'
  return 'chat'
}

// ===== Visual Placeholder Helpers =====

/** 生成工具 -> 可视化渲染类型映射（用于提前显示占位框） */
const visualToolToRenderType: Record<string, VisualRenderType> = {
  generate_svg: 'svg',
  generate_chart: 'chartjs',
  generate_mermaid: 'mermaid',
  generate_mindmap: 'mindmap',
  generate_html: 'html',
  generate_image: 'image',
  generate_threejs: 'model',
}

/** 规范化 renderType：后端可能发 'threejs'，统一为 'model' */
function normalizeVisualRenderType(rt: string): VisualRenderType {
  if (rt === 'threejs') return 'model'
  return rt as VisualRenderType
}

interface PendingVisualBlock {
  type: 'visual'
  renderType: VisualRenderType
  code: string
  description: string
  status?: 'pending' | 'ready'
}

/** 查找最后一个 pending 的 visual block（按 renderType 匹配） */
function findPendingVisualBlock(
  blocks: Array<{ type: string } & PendingVisualBlock>,
  renderType: VisualRenderType
): PendingVisualBlock | null {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i]
    if (b.type === 'visual' && b.status === 'pending' && b.renderType === renderType) {
      return b as PendingVisualBlock
    }
  }
  return null
}

/** 清理所有仍在 pending 的 visual block（done/error 时调用） */
function cleanupPendingVisualBlocks(
  blocks: Array<{ type: string } & PendingVisualBlock>
) {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i]
    if (b.type === 'visual' && b.status === 'pending') {
      blocks.splice(i, 1)
    }
  }
}

// ===== Composable =====

export function useChatSSE() {
  const profile = useProfileStore()
  let streamAbortController: AbortController | null = null

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
  /** Files pending to be sent with the next message */
  const pendingFiles = ref<ChatFileAttachment[]>([])

  // 切换模式时，若当前活跃会话是空会话，同步更新其 type，使图标立即跟随模式变化
  watch(chatMode, (mode) => {
    const cur = activeSession.value
    if (cur && cur.messages.length === 0 && !(cur as any).messageCount) {
      cur.type = mode === 'chat' ? undefined : mode
    }
  })

  // ===== Tutoring (图文辅导) State =====
  const tutoringStore = useTutoringStore()
  const tutoringSSE = useTutoringSSE()
  const activeTutoringMsgIdx = ref(-1)
  const tutoringSessionId = ref('')  // 辅导所属的 chat session ID
  const tutoringQuestion = ref('')
  const tutoringRound = ref(1)
  const currentTutoringSubMode = ref<string>('smart') // 当前辅导子模式，用于快照持久化
  let tutoringGen = 0  // incremented each round to detect stale async completions

  /**
   * 保存当前 tutoringStore 运行时状态到消息的 _tutoring.runtimeState。
   * 在 switchSession 离开当前会话时调用。
   */
  function saveTutoringRuntimeState() {
    if (activeTutoringMsgIdx.value < 0) return
    const sess = sessions.value.find(s => s.id === tutoringSessionId.value)
    if (!sess) return
    const msg = sess.messages[activeTutoringMsgIdx.value]
    if (!msg || !msg._tutoring) return

    msg._tutoring.runtimeState = {
      status: tutoringStore.status,
      currentGuidedStepIdx: tutoringStore.currentGuidedStepIdx,
      sectionOrder: [...tutoringStore.sectionOrder],
      sections: JSON.parse(JSON.stringify(tutoringStore.sections)),
    }
    // 同步保存 snapshot 数据，供恢复时使用
    msg._tutoring.snapshot = {
      expanded: msg._tutoring.snapshot?.expanded ?? false,
      analysis: tutoringStore.analysis ? JSON.parse(JSON.stringify(tutoringStore.analysis)) : null,
      reactThoughts: JSON.parse(JSON.stringify(tutoringStore.reactThoughts)),
      sections: JSON.parse(JSON.stringify(tutoringStore.sectionList)),
      guidedSteps: JSON.parse(JSON.stringify(tutoringStore.guidedSteps)),
      guidedSummary: tutoringStore.guidedSummary,
    }
  }

  /**
   * 从消息的 _tutoring.runtimeState 恢复 tutoringStore。
   * 在 switchSession 进入目标会话时调用。
   */
  function restoreTutoringRuntimeState(sessionId: string) {
    const sess = sessions.value.find(s => s.id === sessionId)
    if (!sess) return

    // 查找该会话中是否有活跃的 tutoring 消息
    const msgIdx = sess.messages.findIndex(m =>
      m._tutoring?.active && !m._tutoring?.completed && m._tutoring?.runtimeState
    )
    if (msgIdx < 0) return

    const msg = sess.messages[msgIdx]
    const rs = msg._tutoring!.runtimeState!

    // 如果 store 当前持有该 session 的活跃数据（SSE 在后台更新了 store），
    // 直接复用 store 数据，只恢复 composable 索引
    if (tutoringStore.sessionId === msg._tutoring!.sessionId &&
        tutoringStore.status !== 'idle' &&
        tutoringStore.status !== 'done' &&
        tutoringStore.status !== 'error') {
      activeTutoringMsgIdx.value = msgIdx
      tutoringSessionId.value = sessionId
      currentTutoringSubMode.value = msg._tutoring!.subMode || 'smart'
      return
    }

    // 否则从 runtimeState 恢复
    tutoringStore.status = rs.status as any
    tutoringStore.sessionId = msg._tutoring!.sessionId
    tutoringStore.currentGuidedStepIdx = rs.currentGuidedStepIdx
    tutoringStore.sectionOrder = [...rs.sectionOrder]
    tutoringStore.sections = JSON.parse(JSON.stringify(rs.sections))
    tutoringStore.analysis = msg._tutoring!.snapshot?.analysis ?? null
    tutoringStore.reactThoughts = msg._tutoring!.snapshot?.reactThoughts
      ? JSON.parse(JSON.stringify(msg._tutoring!.snapshot.reactThoughts)) : []
    tutoringStore.guidedSteps = msg._tutoring!.snapshot?.guidedSteps
      ? JSON.parse(JSON.stringify(msg._tutoring!.snapshot.guidedSteps)) : []
    tutoringStore.guidedSummary = msg._tutoring!.snapshot?.guidedSummary ?? ''

    // 恢复 composable 状态
    activeTutoringMsgIdx.value = msgIdx
    tutoringSessionId.value = sessionId
    currentTutoringSubMode.value = msg._tutoring!.subMode || 'smart'
  }

  // ===== DirectAnswer (直接模式) State =====
  const directAnswerStore = useDirectAnswerStore()
  const directAnswerInlineSSE = useDirectAnswerInlineSSE()
  const activeDirectAnswerMsgIdx = ref(-1)
  let directAnswerGen = 0

  // ===== Smart v2 State =====
  const activeSmartMsgIdx = ref(-1)
  const smartSessionId = ref('')
  let smartGen = 0
  /** Smart v2 是否正在当前活跃会话中进行 */
  const isSmartActive = computed(() =>
    activeSmartMsgIdx.value >= 0 &&
    smartSessionId.value === activeSessionId.value
  )

  /** 辅导是否正在当前活跃会话中进行（用于 UI 阻塞判断） */
  const isTutoringActive = computed(() =>
    activeTutoringMsgIdx.value >= 0 &&
    tutoringSessionId.value === activeSessionId.value &&
    tutoringStore.status !== 'idle' &&
    tutoringStore.status !== 'done' &&
    tutoringStore.status !== 'error'
  )

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

  // ===== Track previous session for auto-end =====
  let lastActiveSessionId = ''

  /** 页面关闭/导航离开时 fire-and-forget 结束会话，使用 keepalive 确保请求送达 */
  function fireEndSessionOnLeave(sessionId?: string) {
    const id = sessionId || activeSessionId.value
    if (!id) return
    const sess = sessions.value.find(s => s.id === id)
    if (!sess || sess.messages.length === 0 || sess.profileVersionId || (sess as any)._ended) return
    const token = localStorage.getItem('token')
    if (!token) return
    try {
      fetch(`/api/chat/${id}/end`, {
        method: 'POST',
        keepalive: true,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      }).catch(() => {}).finally(() => { if (sess) (sess as any)._ended = true })
    } catch {}
  }

  // ===== Session CRUD =====

  function createSession() {
    const currentType = chatMode.value === 'chat' ? undefined : chatMode.value
    // 重置会话级状态，避免新会话渲染旧会话残留（顶部栏闪烁）
    generationReady.value = false
    planGenerationReady.value = false
    planGenerationMeta.value = null
    profileVersionId.value = null
    // 复用任意空会话，直接更新其 type 为当前模式，避免产生多个空会话
    const empty = sessions.value.find(s =>
      s.courseId === profile.activeCourseId && s.messages.length === 0 && !(s as any).messageCount
    )
    if (empty) {
      // Auto-end the previous session so profile gets updated
      const prevId = activeSessionId.value
      const prevSess = sessions.value.find(s => s.id === prevId)
      if (prevId && prevId !== empty.id && prevSess && prevSess.messages.length > 0 && !prevSess.profileVersionId && !(prevSess as any)._ended) {
        const pid = prevId
        apiFetch(`/chat/${pid}/end`, { method: 'POST' }).catch(() => {}).finally(() => {
          if (prevSess) (prevSess as any)._ended = true
        })
      }
      empty.type = currentType
      activeSessionId.value = empty.id
      chatId.value = empty.id
      return
    }
    // Auto-end the previous session so profile gets updated
    const prevId = activeSessionId.value
    const prevSess = sessions.value.find(s => s.id === prevId)
    if (prevId && prevSess && prevSess.messages.length > 0 && !prevSess.profileVersionId && !(prevSess as any)._ended) {
      const pid = prevId
      apiFetch(`/chat/${pid}/end`, { method: 'POST' }).catch(() => {}).finally(() => {
        if (prevSess) (prevSess as any)._ended = true
      })
    }
    const newId = crypto.randomUUID()
    sessions.value.unshift({
      id: newId, title: '新会话', messages: [],
      courseId: profile.activeCourseId,
      type: currentType,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    })
    activeSessionId.value = newId
    chatId.value = newId
  }

  async function loadSessions() {
    try {
      const res = await apiFetch<{
        chatId: string; courseId: string; title: string; type: string; messageCount: number
        lastMessagePreview: string; lastMessageAt: string; analyzed: boolean
        profileVersionId: string | null; createdAt: string
      }[]>('/chat/sessions?courseId=' + encodeURIComponent(profile.activeCourseId))
      if (res.data) {
        sessions.value = res.data.map(s => ({
          id: s.chatId, title: s.title || '新会话',
          messages: [] as ChatMessage[],
          courseId: s.courseId,
          type: s.type || 'chat',
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
        messages: { role: string; content: string; at: string; messageId?: string; mode?: string; feedback?: string; metadataJson?: Record<string, any>; thinking?: ThinkingRecord; planOffer?: any; reactThoughts?: string }[]
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
        tutoringSessionId?: string | null
        type?: string
      }>(`/chat/${sessionId}/messages`)
      const session = sessions.value.find(s => s.id === sessionId)

      // C3: 历史 session type 推断
      // 空会话（前端新建、尚未持久化）不覆盖 type，避免后端返回的默认值冲掉当前模式
      const isEmptySession = session && session.messages.length === 0 && !(session as any).messageCount
      if (session && !isEmptySession && res.data?.type) {
        session.type = res.data.type as ChatSession['type']
      } else if (session && !isEmptySession && res.data?.messages) {
        session.type = inferSessionType(session, res.data.messages)
      }

      if (res.data?.messages) {
        const msgs: ChatMessage[] = res.data.messages.map((m, idx) => {
          const msg: ChatMessage = {
            role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
            text: m.content,
            messageId: m.messageId || `${sessionId}_${idx}`,
            mode: m.mode,
            feedback: m.feedback === 'like' ? 'liked' : m.feedback === 'dislike' ? 'disliked' : null,
            metadataJson: m.metadataJson,
            thinking: m.thinking || undefined,
            _planOffer: m.planOffer || undefined,
          }
          // 恢复 ReAct 思考过程
          if (m.reactThoughts) {
            try {
              const thoughts = JSON.parse(m.reactThoughts) as Array<{ iteration: number; thought: string; action: string }>
              msg.thinking = {
                steps: thoughts.map(t => ({
                  label: `ReAct 第 ${t.iteration} 轮`,
                  icon: 'thought',
                  done: true,
                  phase: 'DECISION' as any,
                  detail: `Action: ${t.action}`,
                  thought: t.thought,
                })),
                expanded: false,
              }
            } catch { /* ignore parse error */ }
          }
          // 恢复 Smart 模式的思考链和可视化产物
          if (m.mode === 'smart' && m.metadataJson) {
            const meta = m.metadataJson as Record<string, any>
            const thinkingSteps = meta.thinking_steps
            const visuals = meta.visuals
            const blocks = meta.blocks
            // 如果有 thinking_steps 或 visuals/blocks，重建 _smart 状态
            if ((thinkingSteps && Array.isArray(thinkingSteps) && thinkingSteps.length > 0) ||
                (visuals && Array.isArray(visuals) && visuals.length > 0) ||
                (blocks && Array.isArray(blocks) && blocks.length > 0)) {
              const smartBlocks: Array<{ type: 'text'; content: string } | { type: 'visual'; renderType: VisualRenderType; code: string; description: string; status?: 'pending' | 'ready' }> = []
              // 优先使用 blocks 结构（含交替顺序），否则从 content + visuals 重建
              if (blocks && Array.isArray(blocks) && blocks.length > 0) {
                for (const b of blocks) {
                  if (b.type === 'text') {
                    smartBlocks.push({ type: 'text', content: b.content || '' })
                  } else if (b.type === 'visual') {
                    smartBlocks.push({
                      type: 'visual',
                      renderType: normalizeVisualRenderType(b.renderType || 'svg'),
                      code: b.code || '',
                      description: b.description || '',
                      status: 'ready',
                    })
                  }
                }
              } else {
                // 没有 blocks 时，文字作为唯一 text block
                if (m.content) {
                  smartBlocks.push({ type: 'text', content: m.content })
                }
                // visuals 追加在文字后面
                if (visuals && Array.isArray(visuals)) {
                  for (const v of visuals) {
                    smartBlocks.push({
                      type: 'visual',
                      renderType: normalizeVisualRenderType(v.renderType || 'svg'),
                      code: v.code || '',
                      description: v.description || '',
                      status: 'ready',
                    })
                  }
                }
              }
              // 重建 thinkingSteps
              const smartThinkingSteps: any[] = []
              if (thinkingSteps && Array.isArray(thinkingSteps)) {
                for (const ts of thinkingSteps) {
                  smartThinkingSteps.push({
                    label: ts.label || ts.phase || '',
                    icon: ts.icon || '●',
                    done: ts.done !== false,
                    phase: ts.phase,
                    detail: ts.content || ts.args || '',
                    sources: ts.sources || undefined,
                  })
                }
              }
              ;(msg as any)._smart = {
                active: false,
                completed: true,
                sessionId: null,
                blocks: smartBlocks,
                thinkingSteps: smartThinkingSteps,
              }
            }
          }
          return msg
        })
        if (session) { session.messages = msgs }
      }

      if (res.data?.tutoringSessionId && session) {
        await hydrateTutoringHistory(session, res.data.tutoringSessionId)
      }

      // 检测 direct_answer 会话，恢复直接模式结构化渲染
      if (session) {
        const daMsg = session.messages.find(m => m.metadataJson?.direct_answer_session_id)
        const daSessionId = daMsg?.metadataJson?.direct_answer_session_id
        if (daSessionId) {
          await hydrateDirectAnswerHistory(session, daSessionId)
        }
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

        const planOfferMsg = res.data.planOfferMessageIdx != null
          ? session.messages[res.data.planOfferMessageIdx]
          : findPlanOfferMsg(session, 'plan')
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

  async function hydrateTutoringHistory(session: ChatSession, tutoringSessionId: string) {
    try {
      const res = await apiFetch<{
        sessionId: string
        question: string
        mode: string
        subMode?: string
        sessionStatus?: string
        analysis?: any
        sections?: Array<{
          id: string
          title: string
          expandDefault: boolean
          status: 'done'
          content: string
          diagram: any
          regenerating: boolean
          regeneratedContent: string
        }>
        guidedSteps?: Array<{
          id: string
          order: number
          stage: string
          title: string
          status: string
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
        }>
        guidedSummary?: string
      }>(`/tutoring/${tutoringSessionId}/history`)
      if (!res.data) return

      const targetIdx = [...session.messages]
        .map((m, i) => [m, i] as const)
        .reverse()
        .find(([m]) => m.role === 'assistant')?.[1] ?? -1
      if (targetIdx < 0) return

      const target = session.messages[targetIdx]

      // guided 模式：从 DB 恢复 guided 快照
      if (res.data.subMode === 'guided' && res.data.guidedSteps) {
        // 无论是否完成，都作为只读快照渲染（中途退出的会话无法恢复 SSE 连接）
        target._tutoring = {
          active: false,
          completed: true,
          sessionId: res.data.sessionId,
          subMode: 'guided',
          snapshot: {
            expanded: false,
            analysis: res.data.analysis ?? null,
            reactThoughts: buildReActThoughtsFromMessage(target),
            sections: [],
            guidedSteps: res.data.guidedSteps.map(s => ({
              ...s,
              stage: s.stage as any,
              status: s.status as any,
            })),
            guidedSummary: res.data.guidedSummary || '',
          },
        }
        // 中途退出的会话标记文本
        if (res.data.sessionStatus !== 'completed') {
          target.text = '(引导式教学进行中，请重新提问继续学习)';
        } else {
          target.text = res.data.guidedSummary || '(引导式教学已完成)';
        }
        return
      }

      // smart/direct 模式：原有逻辑
      target._tutoring = {
        active: false,
        completed: true,
        sessionId: res.data.sessionId,
        snapshot: {
          expanded: false,
          analysis: res.data.analysis ?? null,
          reactThoughts: buildReActThoughtsFromMessage(target),
          sections: (res.data.sections || []).map(sec => ({
            id: sec.id,
            title: sec.title,
            expandDefault: sec.expandDefault,
            status: sec.status,
            content: sec.content,
            diagram: sec.diagram,
            regenerating: sec.regenerating,
            regeneratedContent: sec.regeneratedContent,
          })),
        },
      }
    } catch (err) {
      console.error('hydrateTutoringHistory failed:', err)
    }
  }

  /**
   * 恢复直接模式历史：调 GET /direct-answer/{sessionId} 拿7段内容，
   * 重建 _directAnswer.snapshot 供 DirectAnswerInline 组件渲染。
   */
  async function hydrateDirectAnswerHistory(session: ChatSession, directAnswerSessionId: string) {
    try {
      const res = await apiFetch<{
        sessionId: string
        question: string
        metadata?: any
        problemAnalysis?: any
        thoughtContent?: string
        sections?: Array<{
          sectionId: string
          title: string
          content: string
          sectionOrder: number
        }>
      }>(`/direct-answer/${directAnswerSessionId}`)
      if (!res.data) return

      // 定位含 direct_answer_session_id 的 assistant 消息
      const targetIdx = session.messages.findIndex(m =>
        m.role === 'assistant' && m.metadataJson?.direct_answer_session_id === directAnswerSessionId
      )
      if (targetIdx < 0) return

      const target = session.messages[targetIdx]
      const sections: DirectAnswerSectionState[] = (res.data.sections || []).map(s => ({
        id: s.sectionId,
        title: s.title,
        status: 'done' as const,
        content: s.content || '',
      }))

      target._directAnswer = {
        active: false,
        completed: true,
        sessionId: directAnswerSessionId,
        snapshot: {
          sections,
          thoughtContent: res.data.thoughtContent ?? '',
          metadata: res.data.metadata ?? null,
          analysis: res.data.problemAnalysis ?? null,
        },
      }
    } catch (err) {
      console.error('hydrateDirectAnswerHistory failed:', err)
    }
  }

  function buildReActThoughtsFromMessage(msg: ChatMessage): ReActThought[] {
    const steps = msg.thinking?.steps || []
    return steps.map((step, index) => {
      const detail = step.detail || ''
      const action = detail.startsWith('Action: ') ? detail.slice('Action: '.length) : ''
      return {
        iteration: index + 1,
        thought: step.thought || '',
        action,
      }
    })
  }

  async function switchSession(sessionId: string) {
    if (!sessionId) return
    if (activeSessionId.value !== sessionId) {
      // 离开当前会话：保存活跃 tutoring 状态到消息，然后清除全局状态
      saveTutoringRuntimeState()
      if (activeTutoringMsgIdx.value >= 0) {
        activeTutoringMsgIdx.value = -1
        tutoringStore.reset()
      }

      // Auto-end the previous session if it has messages and hasn't been ended yet
      const prevId = activeSessionId.value
      const prevSess = sessions.value.find(s => s.id === prevId)
      if (prevId && prevId !== sessionId && prevSess && prevSess.messages.length > 0 && !prevSess.profileVersionId && !(prevSess as any)._ended) {
        apiFetch(`/chat/${prevId}/end`, { method: 'POST' }).catch(() => {}).finally(() => {
          if (prevSess) (prevSess as any)._ended = true
        })
      }

      // 重置会话级状态，避免新会话渲染旧会话的中间态（顶部栏闪烁）
      generationReady.value = false
      planGenerationReady.value = false
      planGenerationMeta.value = null
      // profileVersionId 延迟到目标会话数据就绪后再设置，避免先 null 再恢复的闪烁

      activeSessionId.value = sessionId
      chatId.value = sessionId

      // 进入目标会话：恢复活跃 tutoring 状态
      restoreTutoringRuntimeState(sessionId)
    }
    const session = sessions.value.find(s => s.id === sessionId)
    if (session) {
      // 先用目标会话已缓存的 profileVersionId 占位，避免标签闪到"收集中"
      if (session.profileVersionId) {
        profileVersionId.value = session.profileVersionId
      }
      if (session.messages.length === 0) await loadSessionMessages(sessionId)
      // 同步顶部栏模式按钮到会话的实际类型
      if (session.type && session.type !== 'chat') {
        chatMode.value = session.type
      } else {
        chatMode.value = 'chat'
      }
      if (session.profileVersionId) {
        profileVersionId.value = session.profileVersionId
        await loadProfileFromBackend()
      } else {
        // 目标会话无画像版本：显式置空
        profileVersionId.value = null
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
    // 清理残留辅导状态（如页面刷新前辅导被中断）
    if (activeTutoringMsgIdx.value >= 0) {
      activeTutoringMsgIdx.value = -1
      tutoringStore.reset()
    }
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

  // ===== File Upload =====

  async function uploadFile(file: File): Promise<ChatFileAttachment | null> {
    const token = localStorage.getItem('token')
    if (!token) return null
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/chat/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      const json = await res.json()
      if (json.code !== 0 && json.code !== 200) throw new Error(json.message || 'Upload failed')
      const raw = json.data as any
      const data: ChatFileAttachment = {
        fileName: raw.fileName,
        fileUrl: raw.url || raw.fileUrl,
        parsedText: raw.parsedText,
        fileSize: raw.fileSize,
        contentType: raw.contentType,
        isImage: raw.isImage ?? raw.image ?? false,
      }
      pendingFiles.value.push(data)
      return data
    } catch (err) {
      console.error('File upload failed:', err)
      return null
    }
  }

  function removePendingFile(fileUrl: string) {
    pendingFiles.value = pendingFiles.value.filter(f => f.fileUrl !== fileUrl)
  }

  // ===== Send Message (SSE streaming) =====

  async function sendMessage(text: string): Promise<void> {
    const content = text.trim()
    if (!content && pendingFiles.value.length === 0) return
    if (isStreaming.value) return

    // 取消之前的流式请求
    if (streamAbortController) {
      streamAbortController.abort()
    }
    streamAbortController = new AbortController()

    if (!activeSessionId.value) {
      createSession()
      if (!activeSessionId.value) return
    }

    if (!activeSession.value) {
      await initChat()
      if (!activeSessionId.value) return
    }

    const targetSession = activeSession.value!

    const filesToSend = [...pendingFiles.value]
    pendingFiles.value = []
    const userMsg: ChatMessage = { role: 'user', text: content }
    if (filesToSend.length > 0) {
      userMsg._files = filesToSend
    }
    targetSession.messages.push(userMsg)
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
          ...(filesToSend.length > 0 ? { files: filesToSend } : {}),
        }),
        signal: streamAbortController.signal,
      })

      if (!response.ok) {
        if (response.status === 401) {
          // 只有在非 abort 状态下才跳转，避免与退出登录的 router.push 冲突
          if (!streamAbortController?.signal.aborted) {
            localStorage.removeItem('token'); localStorage.removeItem('refreshToken')
            localStorage.removeItem('userInfo'); location.href = '/login'
          }
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
                RETRIEVE: { label: '检索知识库', icon: '🔍' },
                REFLECT:  { label: '评估画像',   icon: '🪞' },
                RAG:      { label: '检索分析',   icon: '📚' },
                DECISION: { label: '决策判断',   icon: '⚖️' },
                PLANNING: { label: '意图分析与回复规划', icon: '📐' },
                ERROR:    { label: '执行异常',   icon: '⚠️' },
              }
              const meta = phaseLabels[parsed.phase] || { label: parsed.phase, icon: '●' }
              const step: ThinkingStep = {
                label: meta.label,
                icon: meta.icon,
                done: true,
                phase: (parsed.phase as ThinkingPhase) || undefined,
                detail: parsed.observation || parsed.thought || '',
                context: parsed.context || undefined,
                observation: parsed.observation || undefined,
                thought: parsed.thought || undefined,
                decision: parsed.decision || undefined,
                confidenceLevel: parsed.confidenceLevel || undefined,
                agentName: parsed.agentName || undefined,
                agentRole: parsed.agentRole || undefined,
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
              // Entry A: Chat → DirectAnswer 自动跳转
              if (parsed.replyPlan?.strategy === 'direct_answer' && parsed.replyPlan?.directAnswerSessionId) {
                console.log('[SSE done] redirecting to DirectAnswer:', parsed.replyPlan.directAnswerSessionId)
                // 异步跳转，不阻塞 done 事件处理
                setTimeout(() => {
                  window.location.href = `/answer/${parsed.replyPlan.directAnswerSessionId}`
                }, 500)
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
      // 忽略 abort 错误（组件卸载或新请求取消旧请求时）
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
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

    // 取消之前的流式请求
    if (streamAbortController) {
      streamAbortController.abort()
    }
    streamAbortController = new AbortController()

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
        signal: streamAbortController.signal,
      })

      if (!response.ok) {
        if (response.status === 401) {
          // 只有在非 abort 状态下才跳转，避免与退出登录的 router.push 冲突
          if (!streamAbortController?.signal.aborted) {
            localStorage.removeItem('token'); localStorage.removeItem('refreshToken')
            localStorage.removeItem('userInfo'); location.href = '/login'
          }
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

      // 安全网：连接断开但后端没发 done 事件时，确保流标记为结束
      // 否则播放器会永远卡在 buffering 等待不存在的下一个场景
      videoStore.markStreamEnded()

      // If no scenes were received at all, show as text fallback
      if (!lastSceneReceived) {
        targetSession.messages[msgIndex].text = '抱歉，未能生成视频讲解，请重试。'
      }
    } catch (err) {
      // 忽略 abort 错误（组件卸载或新请求取消旧请求时）
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
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

  // ===== Tutoring (图文辅导) =====

  /** 将辅导 sections 转为 markdown 文本，用于持久化到聊天消息 */
  function sectionsToMarkdown(): string {
    let markdown = ''
    for (const sectionId of tutoringStore.sectionOrder) {
      const section = tutoringStore.sections[sectionId]
      if (!section) continue
      markdown += `## ${section.title}\n\n`
      markdown += `${section.content}\n\n`
    }
    return markdown.trim()
  }

  /** 辅导结束（done/error）时，将结果写入聊天消息 */
  function finalizeTutoring() {
    // 用 tutoringSessionId 定位正确的 session，而非 activeSession
    const session = sessions.value.find(s => s.id === tutoringSessionId.value)
    if (!session || activeTutoringMsgIdx.value < 0) {
      activeTutoringMsgIdx.value = -1
      tutoringStore.reset()
      return
    }

    const msgIdx = activeTutoringMsgIdx.value
    const msg = session.messages[msgIdx]
    if (!msg) {
      activeTutoringMsgIdx.value = -1
      tutoringStore.reset()
      return
    }

    if (tutoringStore.status === 'done') {
      if (currentTutoringSubMode.value === 'guided') {
        // guided 模式完成：保存 guided 快照
        msg.text = tutoringStore.guidedSummary || '(引导式教学已完成)'
        msg.isStreaming = false
        msg._tutoring = {
          active: false,
          completed: true,
          sessionId: tutoringStore.sessionId,
          subMode: 'guided',
          snapshot: {
            expanded: false,
            analysis: tutoringStore.analysis,
            reactThoughts: JSON.parse(JSON.stringify(tutoringStore.reactThoughts)),
            sections: [],
            guidedSteps: JSON.parse(JSON.stringify(tutoringStore.guidedSteps)),
            guidedSummary: tutoringStore.guidedSummary,
          },
        }
      } else {
        msg.text = sectionsToMarkdown() || '(辅导已完成)'
        msg.isStreaming = false
        msg._tutoring = {
          active: false,
          completed: true,
          sessionId: tutoringStore.sessionId,
          subMode: currentTutoringSubMode.value,
          snapshot: {
            expanded: false,
            analysis: tutoringStore.analysis,
            reactThoughts: JSON.parse(JSON.stringify(tutoringStore.reactThoughts)),
            sections: JSON.parse(JSON.stringify(tutoringStore.sectionList)),
          },
        }
      }
    } else if (tutoringStore.status === 'guided') {
      // guided 模式挂起：保留 tutoring store 状态，不 reset，等待学生作答
      msg.isStreaming = false
      msg._tutoring = {
        active: true,
        completed: false,
        sessionId: tutoringStore.sessionId,
        subMode: 'guided',
      }
      return  // 不 reset store，不清理 activeTutoringMsgIdx
    } else if (tutoringStore.status === 'error') {
      msg.text = tutoringStore.error?.message || '辅导过程中出错，请重试。'
      msg.isStreaming = false
      msg._tutoring = { active: false, completed: false, sessionId: tutoringStore.sessionId }
    }

    activeTutoringMsgIdx.value = -1
    tutoringStore.reset()
  }

  /** 发送图文辅导消息（辅导模式 + 未开启视频） */
  async function sendTutoringMessage(text: string, mode?: TutoringMode): Promise<void> {
    const content = text.trim()
    if (!content) return
    // 不阻塞其它会话的普通对话；但防止同时开两个辅导
    // smart 模式只在当前活跃会话中正在进行时才阻止
    if (isStreaming.value || activeTutoringMsgIdx.value >= 0 || activeDirectAnswerMsgIdx.value >= 0 || isSmartActive.value) return

    // ── direct 模式走 DirectAnswer 管线 ──
    if (mode === 'direct') {
      return sendDirectAnswerMessage(content)
    }

    // ── smart 模式走 Smart v2 Agent ReAct 管线 ──
    if (mode === 'smart') {
      return sendSmartMessage(content)
    }

    // 记录当前子模式，用于快照持久化
    currentTutoringSubMode.value = mode || 'smart'

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

    const msgIndex = targetSession.messages.length
    targetSession.messages.push({
      role: 'assistant',
      text: '',
      isStreaming: true,
      _tutoring: { active: true, completed: false, sessionId: null },
    })

    activeTutoringMsgIdx.value = msgIndex
    tutoringSessionId.value = targetSession.id
    tutoringQuestion.value = content
    tutoringRound.value = 1
    // 同步初始化辅导状态，确保 status 立即为 'planning'，UI 即刻渲染 spinner
    tutoringStore.initSession(content)
    // 不设置 isStreaming — 用 isTutoringActive 替代，避免阻塞其它会话
    const gen = ++tutoringGen

    try {
      await tutoringSSE.startTutoring({
        question: content,
        courseId: profile.activeCourseId,
        chatId: targetSession.id,
        mode,
      } as TutoringStartRequest)

      if (gen !== tutoringGen) return

      if (tutoringStore.status === 'clarifying') {
        return
      }

      // guided 模式：SSE 流在"等待学生作答"点挂起，不调用 finalizeTutoring
      if (tutoringStore.status === 'guided') {
        return
      }

      finalizeTutoring()
    } catch (err) {
      if (gen !== tutoringGen) return
      console.error('sendTutoringMessage failed:', err)
      if (targetSession.messages[msgIndex]) {
        targetSession.messages[msgIndex].text = '辅导请求失败，请重试。'
        targetSession.messages[msgIndex].isStreaming = false
        targetSession.messages[msgIndex]._tutoring = { active: false, completed: false, sessionId: null }
      }
      activeTutoringMsgIdx.value = -1
      tutoringStore.reset()
    }
  }

  // ── Smart v2 phase labels ──
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

  /** Smart v2 SSE 事件处理 */
  function handleSmartEvent(eventName: string, data: string, msg: ChatMessage) {
    switch (eventName) {
      case 'smart.started': {
        try {
          const parsed = JSON.parse(data)
          console.info('[SMART-DIAG] smart.started received: sessionId=', parsed.sessionId)
          if (msg._smart) {
            msg._smart.sessionId = parsed.sessionId
            console.info('[SMART-DIAG] smart.started: set msg._smart.sessionId =', msg._smart.sessionId)
            // 不覆盖 smartSessionId，它应始终保持为 chatId（targetSession.id）
            // smartSsid（后端 sessionId）存储在 msg._smart.sessionId 中
          } else {
            console.warn('[SMART-DIAG] smart.started: msg._smart is null/undefined!')
          }
        } catch (e) { console.error('[SMART-DIAG] smart.started parse error:', e) }
        break
      }
      case 'agent.thought': {
        try {
          const parsed = JSON.parse(data)
          if (msg._smart) {
            const meta = smartPhaseLabels[parsed.phase] || { label: parsed.phase, icon: '●' }
            msg._smart.thinkingSteps.push({
              label: meta.label,
              icon: meta.icon,
              done: true,
              phase: parsed.phase as ThinkingPhase,
              detail: parsed.content || '',
            })
          }
        } catch { /* ignore */ }
        break
      }
      case 'agent.tool_call': {
        try {
          const parsed = JSON.parse(data)
          if (msg._smart) {
            msg._smart.thinkingSteps.push({
              label: `调用工具: ${parsed.tool}`,
              icon: toolIconMap[parsed.tool] || '🔧',
              done: false,
              phase: 'TOOL_CALL' as ThinkingPhase,
              detail: parsed.args || '',
            })
            // 如果是可视化生成工具，提前推送 pending 占位块
            const renderType = visualToolToRenderType[parsed.tool]
            if (renderType) {
              if (msg.text) {
                msg._smart.blocks.push({ type: 'text', content: msg.text })
                msg.text = ''
              }
              // 复用已有的同 renderType pending 块，避免重复工具调用产生多个占位框
              const existing = findPendingVisualBlock(msg._smart.blocks as any, renderType)
              if (!existing) {
                msg._smart.blocks.push({
                  type: 'visual',
                  renderType,
                  code: '',
                  description: '',
                  status: 'pending',
                })
              }
            }
          }
        } catch { /* ignore */ }
        break
      }
      case 'agent.tool_result': {
        try {
          const parsed = JSON.parse(data)
          if (msg._smart) {
            // 标记最近的 tool_call 步骤为完成
            const steps = msg._smart.thinkingSteps
            for (let i = steps.length - 1; i >= 0; i--) {
              if (steps[i].label?.startsWith('调用工具')) {
                steps[i].done = true
                steps[i].detail = (steps[i].detail || '') + ' -> ' + (parsed.result || '')
                // web_search：附加结构化来源列表
                if (parsed.sources && Array.isArray(parsed.sources) && parsed.sources.length > 0) {
                  steps[i].sources = parsed.sources
                }
                break
              }
            }
            // 工具失败时清理对应的 pending visual 占位块
            // 后端对返回 error JSON 的工具仍硬编码 success=true，故需同时检测 result 中的 "error:" 前缀
            const resultStr = String(parsed.result || '')
            const failed = parsed.success === false || /^error[:\s]/i.test(resultStr.trim())
            if (failed) {
              const failedRenderType = visualToolToRenderType[parsed.tool]
              if (failedRenderType) {
                const pending = findPendingVisualBlock(msg._smart.blocks as any, failedRenderType)
                if (pending) {
                  const idx = msg._smart.blocks.indexOf(pending as any)
                  if (idx >= 0) msg._smart.blocks.splice(idx, 1)
                }
              }
            }
          }
        } catch { /* ignore */ }
        break
      }
      case 'agent.visual': {
        try {
          const parsed = JSON.parse(data)
          if (msg._smart) {
            // flush 文本缓冲
            if (msg.text) {
              msg._smart.blocks.push({ type: 'text', content: msg.text })
              msg.text = ''
            }
            const rt = normalizeVisualRenderType(parsed.renderType)
            const pending = findPendingVisualBlock(msg._smart.blocks as any, rt)
            if (pending) {
              pending.code = parsed.code
              pending.description = parsed.description || ''
              pending.status = 'ready'
            } else {
              msg._smart.blocks.push({
                type: 'visual',
                renderType: rt,
                code: parsed.code,
                description: parsed.description || '',
                status: 'ready',
              })
            }
          }
        } catch { /* ignore */ }
        break
      }
      case 'chunk': {
        // chunk 事件的 data 是原始文本，非 JSON
        msg.text += data
        break
      }
      case 'smart.state': {
        try {
          const parsed = JSON.parse(data)
          if (msg._smart) {
            msg._smart.conceptState = parsed.concepts || {}
            msg._smart.totalTurns = parsed.totalTurns
            msg._smart.converged = parsed.converged
          }
        } catch { /* ignore */ }
        break
      }
      case 'smart.converged': {
        try {
          const parsed = JSON.parse(data)
          if (msg._smart) {
            msg._smart.converged = true
            // flush 文本
            if (msg.text) {
              msg._smart.blocks.push({ type: 'text', content: msg.text })
              msg.text = ''
            }
            if (parsed.summary) {
              msg._smart.blocks.push({ type: 'text', content: parsed.summary })
            }
          }
        } catch { /* ignore */ }
        break
      }
      case 'done': {
        // flush 文本
        if (msg.text) {
          if (msg._smart) {
            msg._smart.blocks.push({ type: 'text', content: msg.text })
          }
          msg.text = ''
        }
        msg.isStreaming = false
        if (msg._smart) {
          msg._smart.active = false
          msg._smart.completed = true
          // 清理未完成的 pending visual 占位块
          cleanupPendingVisualBlocks(msg._smart.blocks as any)
          // 读取 converged/totalTurns
          try {
            const parsed = JSON.parse(data)
            msg._smart.converged = parsed.converged
            msg._smart.totalTurns = parsed.totalTurns
          } catch { /* ignore */ }
        }
        // 不清零 activeSmartMsgIdx，保持 smart 会话活跃以支持多轮对话
        console.info('[SMART-DIAG] done event: activeSmartMsgIdx=', activeSmartMsgIdx.value,
          'smartSessionId=', smartSessionId.value,
          'msg._smart.sessionId=', msg._smart?.sessionId,
          'isSmartActive=', activeSmartMsgIdx.value >= 0 && smartSessionId.value === activeSessionId.value)
        break
      }
      case 'error': {
        try {
          const parsed = JSON.parse(data)
          msg.text = parsed.message || '未知错误'
          if (msg._smart) {
            msg._smart.error = {
              code: parsed.code || 'UNKNOWN',
              message: parsed.message || '未知错误',
              retryable: parsed.retryable ?? true,
            }
            cleanupPendingVisualBlocks(msg._smart.blocks as any)
          }
        } catch {
          msg.text = data
        }
        msg.isStreaming = false
        if (msg._smart) {
          msg._smart.active = false
        }
        activeSmartMsgIdx.value = -1
        break
      }
    }
  }

  /** Smart v2 SSE 流读取 */
  async function readSmartSSEStream(response: Response, msg: ChatMessage) {
    const reader = response.body?.getReader()
    if (!reader) return

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() || ''

        for (const block of blocks) {
          if (!block.trim()) continue
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
          if (dataStr) handleSmartEvent(eventType, dataStr, msg)
        }
      }
    } finally {
      reader.releaseLock()
      // 兜底：流异常终止（未收到 done/error 事件）时清理残留 pending 占位块并重置状态
      // 正常情况下 done/error 事件已处理，此处条件不触发；cleanupPendingVisualBlocks 幂等
      if (msg._smart) {
        cleanupPendingVisualBlocks(msg._smart.blocks as any)
      }
      if (msg.isStreaming) {
        msg.isStreaming = false
        if (msg._smart) msg._smart.active = false
      }
    }
  }

  /** Smart v2：启动智能辅导 */
  async function sendSmartMessage(content: string): Promise<void> {
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

    const msgIndex = targetSession.messages.length
    const msg: ChatMessage = reactive({
      role: 'assistant',
      text: '',
      isStreaming: true,
      mode: 'smart',
      _smart: {
        active: true,
        completed: false,
        sessionId: null,
        blocks: [],
        thinkingSteps: [],
        thinkingExpanded: true,
      },
    })
    targetSession.messages.push(msg)

    activeSmartMsgIdx.value = msgIndex
    smartSessionId.value = targetSession.id
    const gen = ++smartGen

    try {
      await ensureValidToken()
      const response = await fetch('/api/smart/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          question: content,
          courseId: profile.activeCourseId,
          chatId: targetSession.id,
        }),
      })

      if (!response.ok) {
        msg.text = `请求失败: HTTP ${response.status}`
        msg.isStreaming = false
        msg._smart!.active = false
        activeSmartMsgIdx.value = -1
        return
      }

      await readSmartSSEStream(response, msg)
    } catch (e: any) {
      if (gen !== smartGen) return
      msg.text = e.message || '连接失败'
      msg.isStreaming = false
      msg._smart!.active = false
      activeSmartMsgIdx.value = -1
    }
  }

  /** Smart v2：学生回答 */
  async function sendSmartAnswer(text: string): Promise<void> {
    const content = text.trim()
    if (!content) return
    if (activeSmartMsgIdx.value < 0) {
      console.warn('[SMART-DIAG] sendSmartAnswer: activeSmartMsgIdx < 0, aborting')
      return
    }

    const targetSession = sessions.value.find(s => s.id === smartSessionId.value)
    if (!targetSession) {
      console.warn('[SMART-DIAG] sendSmartAnswer: targetSession not found, smartSessionId=', smartSessionId.value)
      return
    }

    // 获取之前的 smart session ID
    const lastSmartMsg = targetSession.messages[activeSmartMsgIdx.value]
    console.info('[SMART-DIAG] sendSmartAnswer: activeSmartMsgIdx=', activeSmartMsgIdx.value,
      'lastSmartMsg=', lastSmartMsg ? { role: lastSmartMsg.role, mode: lastSmartMsg.mode, hasSmart: !!lastSmartMsg._smart, smartSessionId: lastSmartMsg._smart?.sessionId } : 'undefined')

    let smartSsid = lastSmartMsg?._smart?.sessionId

    // Fallback: 如果当前消息没有 sessionId，向前搜索任何有 sessionId 的 smart 消息
    if (!smartSsid) {
      console.warn('[SMART-DIAG] sendSmartAnswer: lastSmartMsg has no sessionId, searching fallback...')
      for (let i = targetSession.messages.length - 1; i >= 0; i--) {
        const m = targetSession.messages[i]
        if (m?._smart?.sessionId) {
          smartSsid = m._smart.sessionId
          console.info('[SMART-DIAG] sendSmartAnswer: found fallback sessionId at msg index', i, '=', smartSsid)
          break
        }
      }
    }

    if (!smartSsid) {
      console.error('[SMART-DIAG] sendSmartAnswer: no smartSsid found in any message, aborting')
      return
    }

    targetSession.messages.push({ role: 'user', text: content })
    targetSession.updatedAt = new Date().toISOString()

    const msgIndex = targetSession.messages.length
    const msg: ChatMessage = reactive({
      role: 'assistant',
      text: '',
      isStreaming: true,
      mode: 'smart',
      _smart: {
        active: true,
        completed: false,
        sessionId: smartSsid,
        blocks: [],
        thinkingSteps: [],
      },
    })
    targetSession.messages.push(msg)

    activeSmartMsgIdx.value = msgIndex
    const gen = ++smartGen

    try {
      await ensureValidToken()
      const response = await fetch('/api/smart/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          sessionId: smartSsid,
          answer: content,
          chatId: targetSession.id,
        }),
      })

      if (!response.ok) {
        msg.text = `请求失败: HTTP ${response.status}`
        msg.isStreaming = false
        msg._smart!.active = false
        activeSmartMsgIdx.value = -1
        return
      }

      await readSmartSSEStream(response, msg)
    } catch (e: any) {
      if (gen !== smartGen) return
      msg.text = e.message || '连接失败'
      msg.isStreaming = false
      msg._smart!.active = false
      activeSmartMsgIdx.value = -1
    }
  }

  /** 直接模式：走 DirectAnswer 管线，内嵌渲染 */
  async function sendDirectAnswerMessage(content: string): Promise<void> {
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

    const msgIndex = targetSession.messages.length
    targetSession.messages.push({
      role: 'assistant',
      text: '',
      isStreaming: true,
      _directAnswer: { active: true, completed: false, sessionId: null },
    })

    activeDirectAnswerMsgIdx.value = msgIndex
    const gen = ++directAnswerGen

    try {
      await directAnswerInlineSSE.start(content, profile.activeCourseId || '', 'direct', targetSession.id)

      if (gen !== directAnswerGen) return
      finalizeDirectAnswer()
    } catch (err) {
      if (gen !== directAnswerGen) return
      console.error('sendDirectAnswerMessage failed:', err)
      if (targetSession.messages[msgIndex]) {
        targetSession.messages[msgIndex].text = '直接解答请求失败，请重试。'
        targetSession.messages[msgIndex].isStreaming = false
        targetSession.messages[msgIndex]._directAnswer = { active: false, completed: false, sessionId: null }
      }
      activeDirectAnswerMsgIdx.value = -1
      directAnswerStore.reset()
    }
  }

  function finalizeDirectAnswer() {
    const session = activeSession.value
    if (!session) { activeDirectAnswerMsgIdx.value = -1; directAnswerStore.reset(); return }
    const msgIdx = activeDirectAnswerMsgIdx.value
    const msg = session.messages[msgIdx]
    if (!msg) { activeDirectAnswerMsgIdx.value = -1; directAnswerStore.reset(); return }

    if (directAnswerStore.status === 'done') {
      // 拼接所有 section 内容作为 text
      const texts = Array.from(directAnswerStore.sections.values())
        .map(s => s.content).filter(Boolean)
      msg.text = texts.join('\n\n') || '(直接解答已完成)'
      msg.isStreaming = false
      msg._directAnswer = {
        active: false,
        completed: true,
        sessionId: directAnswerStore.sessionId,
        snapshot: {
          sections: JSON.parse(JSON.stringify(Array.from(directAnswerStore.sections.values()))),
          thoughtContent: directAnswerStore.thoughtContent,
          metadata: directAnswerStore.metadata,
          analysis: directAnswerStore.analysis,
        },
      }
    } else if (directAnswerStore.status === 'error') {
      msg.text = directAnswerInlineSSE.error.value?.message || '直接解答过程中出错'
      msg.isStreaming = false
      msg._directAnswer = { active: false, completed: false, sessionId: directAnswerStore.sessionId }
    }

    activeDirectAnswerMsgIdx.value = -1
    directAnswerStore.reset()
  }

  /** 提交澄清回复 */
  async function sendClarificationResponse(response: {
    skipped: boolean
    selectedOptionId?: string
    freeInput?: string
  }): Promise<void> {
    if (!tutoringStore.sessionId) return
    const gen = ++tutoringGen

    try {
      await tutoringSSE.startTutoring({
        question: tutoringQuestion.value,
        sessionId: tutoringStore.sessionId,
        courseId: profile.activeCourseId,
        chatId: tutoringSessionId.value,
        clarificationResponse: {
          skipped: response.skipped,
          selectedOptionId: response.selectedOptionId || null,
          freeInput: response.freeInput || null,
        },
      })

      if (gen !== tutoringGen) return

      tutoringRound.value++

      if (tutoringStore.status === 'clarifying') {
        return
      }

      // guided 模式：SSE 流在"等待学生作答"点挂起，不调用 finalizeTutoring
      if (tutoringStore.status === 'guided') {
        return
      }

      finalizeTutoring()
    } catch (err) {
      if (gen !== tutoringGen) return
      console.error('sendClarificationResponse failed:', err)
      finalizeTutoring()
    }
  }

  /** 局部再生 section */
  async function regenerateTutoringSection(
    sectionId: string,
    action: string,
    instruction?: string
  ): Promise<void> {
    if (!tutoringStore.sessionId) return

    try {
      await tutoringSSE.regenerateSection(tutoringStore.sessionId, {
        sectionId,
        action: action as 'simplify' | 'switch_angle' | 'followup' | 'more_examples',
        instruction: instruction || null,
      })
    } catch (err) {
      console.error('regenerateTutoringSection failed:', err)
    }
  }

  /** 提交引导模式作答（聊天内联场景） */
  async function submitGuidedAnswerInline(
    stepId: string,
    action: 'answer' | 'reveal',
    answer?: string
  ): Promise<void> {
    if (!tutoringStore.sessionId) return
    const gen = ++tutoringGen

    try {
      await tutoringSSE.submitGuidedAnswer({
        sessionId: tutoringStore.sessionId,
        stepId,
        action,
        answer: answer || undefined,
      })

      if (gen !== tutoringGen) return

      // guided 模式继续挂起或已完成
      if (tutoringStore.status === 'guided') {
        return
      }

      finalizeTutoring()
    } catch (err) {
      if (gen !== tutoringGen) return
      console.error('submitGuidedAnswerInline failed:', err)
      finalizeTutoring()
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
      // Try the new /end flow first — only if the session has been ended
      // Otherwise fall back to /analyze for backward compatibility
      const res = await apiFetch<any>(`/chat/${activeSessionId.value}/analyze`, { method: 'POST' })
      if (res.data) {
        // Return dimensions from the new format or use refreshProfile fallback
        const dims = res.data.dimensions?.dimensions
        if (dims && dims.length > 0) {
          profile.loadFromProfile({
            profile_id: res.data.profileVersionId, user_id: '', course_id: profile.activeCourseId,
            version: res.data.version, dimensions: res.data.dimensions.dimensions,
            updated_at: new Date().toISOString(), last_trigger: 'chat',
          }, res.data)
          totalFilled.value = res.data.dimensions.dimensions.length
        } else if (res.data.profileVersionId) {
          // Minimal response: refresh from /profile endpoint
          await profile.refreshProfile(profile.activeCourseId)
          totalFilled.value = profile.fullProfile?.dimensions?.length || 0
        }
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
    if (streamAbortController) {
      streamAbortController.abort()
      streamAbortController = null
    }
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
    fireEndSessionOnLeave,
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

    // Tutoring (图文辅导)
    tutoringStore,
    activeTutoringMsgIdx,
    tutoringSessionId,
    isTutoringActive,
    tutoringRound,
    sendTutoringMessage,
    sendClarificationResponse,
    regenerateTutoringSection,
    submitGuidedAnswerInline,

    // DirectAnswer (直接模式)
    directAnswerStore,
    directAnswerInlineSSE,
    activeDirectAnswerMsgIdx,

    // Smart v2 (智能模式)
    activeSmartMsgIdx,
    isSmartActive,
    sendSmartAnswer,

    // File upload
    pendingFiles,
    uploadFile,
    removePendingFile,
  }
}
