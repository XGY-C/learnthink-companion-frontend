import { ref, computed, watch, reactive, nextTick } from 'vue'
import { useProfileStore } from '@/stores/profile'
import { usePlanStore } from '@/stores/plan'
import { apiFetch, ensureValidToken } from '@/utils/api'
import { useSSE } from '@/composables/useSSE'
import type { ThinkingStep, ThinkingRecord } from '@/types'

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
  status: 'generating' | 'done' | 'failed'
  progress: number
  resourceTypes: string[]
  readyCount: number
  totalCount: number
  message: string
  stage: string
  errorMessage?: string
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
  /** 'chat' | 'resource' | 'plan' — controls how intent is interpreted */
  const chatMode = ref<'chat' | 'resource' | 'plan'>('chat')
  const planGenerationReady = ref(false)
  const planGenerationMeta = ref<any>(null)
  const isGenerating = ref(false)
  /** Resource types detected from the last generation intent, passed to task creation */
  const pendingGenTypes = ref<string[]>([])

  // ===== Task Cards =====
  const taskCards = ref<Record<string, TaskCardState>>({})
  const taskSSE = useSSE()

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
        messages: { role: string; content: string; at: string; thinking?: ThinkingRecord }[]
        generationReady: boolean
        generationMeta: any
        planGenerationReady: boolean
        planGenerationMeta: any
        activeTasks: {
          taskId: string; topic: string; status: string; stage: string
          percent: number; resourceTypes: string[]; message: string
          errorMessage: string; readyCount: number; totalCount: number
        }[]
      }>(`/chat/${sessionId}/messages`)
      if (res.data?.messages) {
        const msgs: ChatMessage[] = res.data.messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
          text: m.content,
          thinking: m.thinking || undefined,
        }))
        const session = sessions.value.find(s => s.id === sessionId)
        if (session) { session.messages = msgs }
      }

      // Reconstruct generation offer message (skip for clarifying — text is in AI response)
      if (res.data?.generationReady && res.data?.generationMeta) {
        const meta = res.data.generationMeta as any
        const stage = meta?.stage
        // Save requested types if present
        if (meta?.preferences?.requestedTypes && Array.isArray(meta.preferences.requestedTypes)) {
          pendingGenTypes.value = meta.preferences.requestedTypes
        }
        if (stage === 'clarifying') {
          generationReady.value = true
        } else {
          generationReady.value = true
          const session = sessions.value.find(s => s.id === sessionId)
          if (session) {
            const lastUserMsg = [...session.messages].reverse().find(m => m.role === 'user')?.text || ''
            session.messages.push({
              role: 'assistant',
              text: '你的学习画像已就绪，是否为你生成个性化学习资源？',
            suggestions: [
              { text: lastUserMsg
                ? `✅ 确认生成「${lastUserMsg.slice(0, 20)}${lastUserMsg.length > 20 ? '…' : ''}」`
                : '✅ 确认生成',
                sendAs: `__generate__:${lastUserMsg}` },
              { text: '⏸ 稍后再说', sendAs: '' },
            ],
            suggestionStyle: 'primary',
          })
        }
        }
      }

      // Reconstruct plan generation offer message
      if (res.data?.planGenerationReady && res.data?.planGenerationMeta) {
        planGenerationReady.value = true
        planGenerationMeta.value = res.data.planGenerationMeta
        const session = sessions.value.find(s => s.id === sessionId)
        if (session) {
          const meta = res.data.planGenerationMeta
          const resolvedTopic = meta.topic_hint
          const lastUserMsg = [...session.messages].reverse().find(m => m.role === 'user')?.text || ''
          const launchTopic = resolvedTopic || lastUserMsg
          session.messages.push({
            role: 'assistant',
            text: resolvedTopic
              ? `检测到你想学习「${resolvedTopic}」，需要我为你生成一份个性化的学习计划吗？`
              : '根据我们的对话，我可以为你生成一份个性化的学习计划，是否确认？',
            suggestions: [
              { text: resolvedTopic ? `✅ 生成学习计划「${resolvedTopic}」` : '✅ 生成学习计划', sendAs: `__generate_plan__:${launchTopic}` },
              { text: '🏠 暂时不需要', sendAs: '' },
            ],
            suggestionStyle: 'primary',
          })
        }
      }

      // Reconstruct active generation cards
      if (res.data?.activeTasks && res.data.activeTasks.length > 0) {
        for (const task of res.data.activeTasks) {
          const isActive = task.status === 'RUNNING' || task.status === 'PENDING'
          if (isActive) connectTaskSSE(task.taskId, task.topic)
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
          const session = sessions.value.find(s => s.id === sessionId)
          if (session) {
            session.messages.push({
              role: 'assistant' as const,
              text: `好的！我已经为你启动了「${task.topic}」的资源包生成。`,
              // @ts-ignore - embedded card marker
              _generationCard: { taskId: task.taskId, topic: task.topic },
            })
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
              }
              const meta = phaseLabels[parsed.phase] || { label: parsed.phase, icon: '●' }
              const step: ThinkingStep = {
                label: meta.label,
                icon: meta.icon,
                done: true,
                phase: parsed.phase || undefined,
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
              console.log('[SSE done] generationReady=', generationReadyVal, 'meta=', generationMetaVal)
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
          // Clarifying question is already appended to the AI response as extraText
          // No separate offer message needed — user will type a natural response
        } else {
          // For 'offered' (sufficiency-triggered) or 'ready' (explicit), push offer with buttons
          if (coveredCountVal > 0) totalFilled.value = coveredCountVal
          const genKind = stage === 'ready' ? 'explicit' : 'offer'
          const prefs = (generationMetaVal as any)?.preferences
          const resolvedTopic = prefs?.topic
          // Save requested types from intent detection for task creation
          if (prefs?.requestedTypes && Array.isArray(prefs.requestedTypes)) {
            pendingGenTypes.value = prefs.requestedTypes
          }
          const launchTopic = resolvedTopic
            || [...targetSession.messages].reverse().find(m => m.role === 'user')?.text
            || ''
          targetSession.messages.push({
            role: 'assistant',
            text: genKind === 'explicit'
              ? (resolvedTopic
                  ? `检测到你需要「${resolvedTopic}」的学习资源，是否确认启动？`
                  : '检测到你需要生成学习资源，是否确认启动？')
              : '你的学习画像已就绪，是否为你生成个性化学习资源？',
            suggestions: [
              { text: resolvedTopic ? `✅ 确认生成「${resolvedTopic}」` : '✅ 确认生成', sendAs: `__generate__:${launchTopic}` },
              { text: '⏸ 稍后再说', sendAs: '' },
            ],
            suggestionStyle: 'primary',
          })
          if (onGenerationOffer) onGenerationOffer()
        }
      }

      if (planGenerationReadyVal) {
        planGenerationReady.value = true
        planGenerationMeta.value = planGenerationMetaVal
        const resolvedTopic = planGenerationMetaVal?.topic_hint
        const launchTopic = resolvedTopic
          || [...targetSession.messages].reverse().find(m => m.role === 'user')?.text
          || ''
        targetSession.messages.push({
          role: 'assistant',
          text: resolvedTopic
            ? `检测到你想学习「${resolvedTopic}」，需要我为你生成一份个性化的学习计划吗？`
            : '根据我们的对话，我可以为你生成一份个性化的学习计划，是否确认？',
          suggestions: [
            { text: resolvedTopic ? `✅ 生成学习计划「${resolvedTopic}」` : '✅ 生成学习计划', sendAs: `__generate_plan__:${launchTopic}` },
            { text: '🏠 暂时不需要', sendAs: '' },
          ],
          suggestionStyle: 'primary',
        })
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

  // ===== Task SSE =====

  function connectTaskSSE(taskId: string, topic: string) {
    if (!taskSSE) return
    taskCards.value[taskId] = {
      taskId, topic, status: 'generating', progress: 0,
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
      onTaskDone() {
        const card = taskCards.value[taskId]
        if (card) card.status = 'done'
      },
      onTaskFailed(data) {
        const card = taskCards.value[taskId]
        if (card) { card.status = 'failed'; card.errorMessage = data.message || '生成失败' }
      },
    })
  }

  // ===== Trigger Generate =====

  async function triggerGenerate(topic: string): Promise<string | null> {
    if (!topic.trim()) return null
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

  // ===== Confirm Generation (handles suggestion click) =====

  async function confirmGeneration(topic: string): Promise<string | null> {
    const session = activeSession.value
    if (!session) return null

    const confirmText = `确认生成「${topic}」`
    session.messages.push({ role: 'user', text: confirmText })
    session.updatedAt = new Date().toISOString()

    // Async sync to backend (non-streaming)
    apiFetch<{ newMessages?: { role: string; content: string }[] }>(
      `/chat/${activeSessionId.value}/send`,
      { method: 'POST', body: { content: confirmText, courseId: profile.activeCourseId, mode: chatMode.value === 'chat' ? undefined : chatMode.value } }
    ).then(res => {
      const msgs = res.data?.newMessages
      if (msgs) {
        for (const m of msgs) {
          if (m.role === 'assistant') {
            session.messages.push({ role: 'assistant', text: m.content })
          }
        }
      }
    }).catch(() => { /* local message still there */ })

    return triggerGenerate(topic)
  }

  // ===== Confirm Plan Generation =====

  async function confirmPlanGeneration(topic: string): Promise<void> {
    const session = activeSession.value
    if (!session) return

    const confirmText = `确认生成学习计划：${topic}`
    session.messages.push({ role: 'user', text: confirmText })
    session.updatedAt = new Date().toISOString()

    // Async sync to backend (non-streaming)
    apiFetch<{ newMessages?: { role: string; content: string }[] }>(
      `/chat/${activeSessionId.value}/send`,
      { method: 'POST', body: { content: confirmText, courseId: profile.activeCourseId, mode: chatMode.value === 'chat' ? undefined : chatMode.value } }
    ).then(res => {
      const msgs = res.data?.newMessages
      if (msgs) {
        for (const m of msgs) {
          if (m.role === 'assistant') {
            session.messages.push({ role: 'assistant', text: m.content })
          }
        }
      }
    }).catch(() => { /* local message still there */ })

    // Start plan generation via plan store
    const planStore = usePlanStore()
    try {
      await planStore.generatePlan(profile.activeCourseId, profile.fullProfile?.version || 1)
      if (planStore.status === 'generating' && planStore.generationTaskId) {
        session.messages.push({
          role: 'assistant',
          text: `好的！我已经启动了学习计划的生成，可前往「学习路径」查看进度。`,
        })
      }
    } catch {
      session.messages.push({
        role: 'assistant',
        text: '抱歉，学习计划生成启动失败，请稍后重试。',
      })
    }

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
    isGenerating,
    taskCards,

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
    connectTaskSSE,
    triggerGenerate,
    confirmGeneration,
    confirmPlanGeneration,
    loadProfileFromBackend,
    setupMobileReconnection,
  }
}
