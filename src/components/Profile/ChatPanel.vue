<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ChatLineRound, Plus, Delete, Fold, Expand, MagicStick } from '@element-plus/icons-vue'
import { useProfileStore } from '@/stores/profile'
import { useRouter } from 'vue-router'
import { apiFetch } from '@/utils/api'
import type { ThinkingStep, ThinkingRecord } from '@/types'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import ThoughtChainTimeline from '@/components/ThoughtChainTimeline.vue'
import LottieAnimation from '@/components/LottieAnimation.vue'
import liveChatbotLottie from '@/assets/lottie/live-chatbot.json'
import GenerationCard from '@/components/GenerationCard.vue'
import { useSSE } from '@/composables/useSSE'

const router = useRouter()
const profile = useProfileStore()

// ===== 消息模型 =====
interface Suggestion {
  text: string
  sendAs: string
}


interface ChatMessage {
  role: 'assistant' | 'user'
  text: string
  isStreaming?: boolean
  suggestions?: Suggestion[]
  suggestionStyle?: 'plain' | 'primary'
  thinking?: ThinkingRecord
}

// ===== SSE事件模型 (v3.1) =====
interface AgentThoughtSSE {
  agentName: string; agentRole: string; phase: string
  context: string; observation: string; thought: string
  decision: string; confidenceLevel: string; timestamp: string
}

// ===== 会话模型 =====
interface ChatSession {
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

function autoTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find(m => m.role === 'user')
  if (!firstUser) return '新会话'
  const t = firstUser.text.trim()
  return t.length > 20 ? t.slice(0, 20) + '…' : t
}

// ===== 会话状态 =====
const isSessionListCollapsed = ref(false)
const sessions = ref<ChatSession[]>([])
const activeSessionId = ref('')
const activeSession = computed(() => sessions.value.find(s => s.id === activeSessionId.value)!)
const messages = computed({
  get: () => activeSession.value?.messages ?? [],
  set: () => {},
})

const inputMessage = ref('')
const isStreaming = ref(false)
const showGeneratePanel = ref(false)
const generateTopic = ref('')
const isGenerating = ref(false)
const chatId = ref('')
const profileVersionId = ref<string | null>(null)
const totalFilled = ref(0)
const generationReady = ref(false)

// ===== v3.1: SSE-aware 发送消息 =====
async function sendMessage(text?: string) {
  const content = (text ?? inputMessage.value.trim())
  if (!content) return
  if (isStreaming.value) return
  // Auto-create session if needed (first visit, no sessions at all)
  if (!activeSessionId.value) {
    createSession()
    if (!activeSessionId.value) return
  }
  // Guard: session may have been deleted from DB
  if (!activeSession.value) {
    ElMessage.warning('会话异常，正在重新初始化...')
    await initChat()
    if (!activeSessionId.value) return
  }

  activeSession.value.messages.push({ role: 'user', text: content })
  if (activeSession.value.title === '新会话') {
    activeSession.value.title = autoTitle(activeSession.value.messages)
  }
  activeSession.value.updatedAt = new Date().toISOString()
  inputMessage.value = ''
  isStreaming.value = true

  const thinkingSteps = reactive<ThinkingStep[]>([])
  const thinking: ThinkingRecord = { steps: thinkingSteps, expanded: true }

  const msgIndex = activeSession.value.messages.length
  activeSession.value.messages.push({ role: 'assistant', text: '', isStreaming: true, thinking })

  const token = localStorage.getItem('token') || ''

  try {
    const response = await fetch(`/api/chat/${activeSessionId.value}/send/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ content, courseId: profile.activeCourseId }),
    })

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token'); localStorage.removeItem('refreshToken')
        localStorage.removeItem('userInfo'); location.href = '/login'; return
      }
      if (response.status === 404) {
        // Session was deleted or doesn't exist — reinitialize
        if (activeSession.value) {
          activeSession.value.messages.pop() // remove placeholder assistant msg
          activeSession.value.messages.pop() // remove user msg we just added
        }
        ElMessage.warning('会话已失效，正在重新创建...')
        await initChat()
        if (activeSessionId.value) {
          inputMessage.value = content
          return sendMessage()
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
    let coveredCountVal = 0
    let firstChunk = true, chunkCount = 0

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

        // === Route by event type ===
        if (eventType === 'agent.thought') {
          try {
            const parsed: AgentThoughtSSE = JSON.parse(dataStr)
            const phaseLabels: Record<string, { label: string; icon: string }> = {
              CONTEXT:  { label: '理解上下文', icon: '📋' },
              RETRIEVE: { label: '检索知识库', icon: '🔗' },
              REFLECT:  { label: '评估画像',   icon: '🎯' },
              RAG:      { label: '检索分析',   icon: '🔍' },
              DECISION: { label: '决策判断',   icon: '⚖️' },
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
            // Avoid duplicate steps for the same phase
            if (!thinkingSteps.some(s => s.label === meta.label)) {
              thinkingSteps.push(step)
            }

            if (parsed.phase === 'REFLECT') {
              // Finalize thinking with the accumulated real steps
              activeSession.value.messages[msgIndex].thinking = {
                steps: [...thinkingSteps],
                expanded: false,
              }
            }
          } catch { /* ignore parse errors */ }
        } else if (eventType === 'done') {
          try {
            const parsed = JSON.parse(dataStr)
            profileReadyVal = parsed.profileReady ?? false
            profileVersionIdVal = parsed.profileVersionId || null
            generationReadyVal = parsed.generationReady ?? false
            generationMetaVal = parsed.generationMeta
            coveredCountVal = parsed.coveredCount ?? 0
          } catch { /* fall through */ }
          // Finalize thinking card with whatever real steps we have
          if (activeSession.value) {
            const msg = activeSession.value.messages[msgIndex]
            if (msg && msg.thinking) {
              thinkingSteps.forEach(s => s.done = true)
              activeSession.value.messages[msgIndex].thinking = {
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
            } catch { /* legacy format */ }
          } else {
            if (firstChunk) { firstChunk = false }
            const messages = activeSession.value.messages
            const msg = messages[msgIndex]
            // Replace entire message object to guarantee Vue reactivity trigger
            messages.splice(msgIndex, 1, { ...msg, text: msg.text + dataStr })
            // 先等 Vue 完成 DOM 更新，再让出给浏览器渲染管道（rAF 保证在下一帧绘制前执行）
            await nextTick()
            await new Promise(resolve => requestAnimationFrame(resolve))
          }
        }
      }
    }

    // Stream done — ensure final state is reactive
    const doneMsg = activeSession.value.messages[msgIndex]
    activeSession.value.messages.splice(msgIndex, 1, { ...doneMsg, isStreaming: false, thinking: doneMsg.thinking })
    thinkingSteps.forEach(s => s.done = true)
    const finalThinking = activeSession.value.messages[msgIndex].thinking
    if (finalThinking) {
      // Mark any incomplete steps as done
      finalThinking.steps.forEach(s => s.done = true)
      // Show collapsed toggle so user can expand to review the thinking
      finalThinking.expanded = false
    }

    activeSession.value.messages[msgIndex].isStreaming = false

    if (profileReadyVal) {
      profileVersionId.value = profileVersionIdVal
      loadProfileFromBackend()
    }
    // 每轮对话后刷新画像（增量数据已异步保存）
    profile.refreshProfile()

    if (generationReadyVal) {
      generationReady.value = true
      if (coveredCountVal > 0) totalFilled.value = coveredCountVal
      // 在对话流中内联推送确认卡片，用户确认后再触发生成
      const genKind = (generationMetaVal as any)?.stage === 'ready' ? 'explicit' : 'offer'
      const resolvedTopic = (generationMetaVal as any)?.preferences?.topic
      const launchTopic = resolvedTopic || [...activeSession.value.messages].reverse().find(m => m.role === 'user')?.text || ''
      activeSession.value.messages.push({
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
      nextTick(() => {
        const el = document.querySelector('.overflow-y-auto[style*="grid-row: 2"]')
        if (el) el.scrollTop = el.scrollHeight
      })
    }
  } catch (err) {
    activeSession.value.messages[msgIndex].text = '抱歉，消息发送失败，请重试。'
    activeSession.value.messages[msgIndex].isStreaming = false
    console.error('sendMessage failed:', err)
  } finally {
    isStreaming.value = false
  }
}

// ===== 任务 SSE 管理 =====
interface TaskCardState {
  taskId: string; topic: string; status: 'generating' | 'done' | 'failed'
  progress: number; resourceTypes: string[]; readyCount: number; totalCount: number
  message: string; stage: string
  errorMessage?: string
}
const taskCards = ref<Record<string, TaskCardState>>({})
const taskSSE = useSSE()

function connectTaskSSE(taskId: string, topic: string) {
  if (!taskSSE) return
  taskCards.value[taskId] = { taskId, topic, status: 'generating', progress: 0, resourceTypes: [], readyCount: 0, totalCount: 0, message: '准备中...', stage: '' }
  taskSSE.connect(taskId, {
    onStage(data) {
      const card = taskCards.value[taskId]
      if (!card) return
      card.progress = data.percent || 0
      card.message = data.message || card.message
      card.stage = data.stage || card.stage
      const rts = data.stats?.resourceTypes
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

// ===== API: 触发资源生成 =====
async function triggerGenerate(topic?: string) {
  const topicText = topic || generateTopic.value.trim()
  if (!topicText) { ElMessage.warning('请输入知识点'); return }
  if (totalFilled.value < 4) { ElMessage.warning('画像信息还不够完善（至少需要 4 个维度），请先多聊几句'); return }

  isGenerating.value = true; showGeneratePanel.value = false

  try {
    const res = await apiFetch<{ taskId: string }>('/tasks/generate', {
      method: 'POST',
      body: { courseId: profile.activeCourseId, topic: topicText, profileVersion: profile.fullProfile?.version || 1 },
    })
    if (res.data?.taskId) {
      const taskId = res.data.taskId
      connectTaskSSE(taskId, topicText)
      activeSession.value.messages.push({
        role: 'assistant',
        text: `好的！我已经为你启动了「${topicText}」的资源包生成。`,
        suggestions: [
          { text: '前往工作室查看进度', sendAs: `/studio/${taskId}` },
          { text: '继续聊天', sendAs: '' },
        ],
        suggestionStyle: 'primary',
        // @ts-ignore — generation card embedded in the same bubble
        _generationCard: { taskId, topic: topicText },
      })
      ElMessage.success(`资源生成任务已创建 #${taskId}`)
      generateTopic.value = ''
      generationReady.value = false
    } else { ElMessage.error('创建生成任务失败') }
  } catch { ElMessage.error('创建生成任务失败，请稍后重试') }
  finally { isGenerating.value = false }
}

// ===== API: 加载画像 =====
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

// ===== 会话管理 =====
const courseSessions = computed(() =>
  [...sessions.value].filter(s => s.courseId === profile.activeCourseId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
)

function createSession() {
  // Dedup: if there's already a local-only empty session (never sent), switch to it.
  // Use messageCount (from DB) to distinguish: local placeholders have no messageCount.
  const empty = sessions.value.find(s =>
    s.courseId === profile.activeCourseId && s.messages.length === 0 && !(s as any).messageCount
  )
  if (empty) {
    activeSessionId.value = empty.id
    chatId.value = empty.id
    return
  }
  // Lazy creation: generate UUID locally, DB record is created on first message
  const newId = crypto.randomUUID()
  sessions.value.unshift({
    id: newId, title: '新会话', messages: [],
    courseId: profile.activeCourseId,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  })
  activeSessionId.value = newId
  chatId.value = newId
}

async function startChat(courseId: string, forceNew = false) {
  try {
    const res = await apiFetch<{
      chatId: string; courseId: string; messages: { role: string; content: string; at: string }[]
      profileReady: boolean; profileVersionId: string | null
    }>('/chat/start', { method: 'POST', body: { courseId, forceNew } })
    if (!res.data) throw new Error('No data')

    chatId.value = res.data.chatId; profileVersionId.value = res.data.profileVersionId
    const msgs: ChatMessage[] = (res.data.messages || []).map(m => ({
      role: m.role === 'assistant' ? 'assistant' as const : 'user' as const, text: m.content,
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
    if (res.data.profileReady) loadProfileFromBackend()
  } catch (err) { ElMessage.error('无法连接对话服务'); console.error('startChat failed:', err) }
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

async function loadSessionMessages(sessionId: string) {
  try {
    const res = await apiFetch<{ role: string; content: string; at: string; thinking?: ThinkingRecord }[]>(`/chat/${sessionId}/messages`)
    if (res.data) {
      const msgs: ChatMessage[] = res.data.map(m => ({
        role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
        text: m.content,
        thinking: m.thinking || undefined,
      }))
      const session = sessions.value.find(s => s.id === sessionId)
      if (session) { session.messages = msgs }
    }
  } catch (err) { console.error('loadSessionMessages failed:', err) }
}

async function switchSession(sessionId: string) {
  if (!sessionId) return
  // Always reload messages when switching (handles re-init after error)
  if (activeSessionId.value !== sessionId) {
    activeSessionId.value = sessionId; chatId.value = sessionId; profileVersionId.value = null
  }
  const session = sessions.value.find(s => s.id === sessionId)
  if (session) {
    if (session.messages.length === 0) await loadSessionMessages(sessionId)
    if (session.profileVersionId) {
      profileVersionId.value = session.profileVersionId
      loadProfileFromBackend()
    }
  }
}

async function deleteSession(sessionId: string) {
  if (sessions.value.length <= 1) { ElMessage.info('至少保留一个会话'); return }
  try { await ElMessageBox.confirm('确定删除该会话？', '删除确认', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }) }
  catch { return }
  try { await apiFetch('/chat/' + sessionId, { method: 'DELETE' }) } catch { /* proceed with local removal */ }
  const idx = sessions.value.findIndex(s => s.id === sessionId)
  if (idx === -1) return
  sessions.value.splice(idx, 1)
  if (activeSessionId.value === sessionId) {
    const next = sessions.value[0]
    activeSessionId.value = next?.id ?? ''; chatId.value = activeSessionId.value
    if (next && next.messages.length === 0) await loadSessionMessages(next.id)
  }
  ElMessage.success('会话已删除')
}

function formatSessionTime(iso: string): string {
  const d = new Date(iso); const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 86400000) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (diff < 172800000) return '昨天'
  return `${d.getMonth() + 1}-${d.getDate().toString().padStart(2, '0')}`
}

function handleSuggestionClick(suggestion: { text: string; sendAs: string }) {
  if (suggestion.sendAs.startsWith('__generate__:')) {
    // Topic resolved by backend ConversationAgent.resolveTopic()
    const topic = suggestion.sendAs.slice('__generate__:'.length)
    triggerGenerate(topic)
  } else if (suggestion.sendAs.startsWith('/studio')) router.push(suggestion.sendAs)
  else if (suggestion.sendAs) sendMessage(suggestion.sendAs)
}

// ===== 冷启动 =====
const showWelcomePage = computed(() => !activeSession.value || activeSession.value.messages.length === 0)

async function initChat() {
  sessions.value = []; chatId.value = ''; activeSessionId.value = ''
  await loadSessions()
  if (sessions.value.length > 0) {
    await switchSession(sessions.value[0].id)
  } else {
    createSession()
  }
}

watch(() => profile.activeCourseId, () => initChat())

onMounted(() => initChat())
</script>

<template>
  <div style="display: flex; height: 100%; background-color: var(--lt-bg-page);">
    <!-- ===== 会话列表侧栏 ===== -->
    <div class="session-sidebar-wrapper flex-shrink-0 relative" :style="{ width: isSessionListCollapsed ? '0px' : '260px', transition: 'width 0.25s ease', overflow: 'hidden' }">
      <div class="session-sidebar flex flex-col h-full" style="width: 260px; min-width: 260px; background-color: var(--lt-bg-card); border-right: 1px solid var(--lt-border);">
        <div class="px-3 pt-3 pb-2 flex items-center justify-between">
          <el-button size="default" class="flex-1" style="border-radius: 10px; border: 1px dashed var(--lt-brand-lighter); color: var(--lt-brand); background-color: rgba(43, 111, 255, 0.04); font-weight: 500;" @click="createSession">
            <el-icon class="mr-1"><Plus /></el-icon>新建会话
          </el-button>
          <button class="flex-shrink-0 ml-2 p-1 rounded-md transition-all cursor-pointer" style="color: var(--lt-text-auxiliary); border: none; background: transparent;" @click="isSessionListCollapsed = true">
            <el-icon :size="16"><Fold /></el-icon>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto px-2 pb-2">
          <div v-for="sess in courseSessions" :key="sess.id" class="session-item group relative cursor-pointer rounded-lg px-3 py-2.5 mb-1 transition-all" :class="{ 'session-active': sess.id === activeSessionId }" :style="sess.id === activeSessionId ? 'background-color: var(--lt-brand-lightest); border-left: 3px solid var(--lt-brand);' : 'border-left: 3px solid transparent;'" @click="switchSession(sess.id)">
            <div class="flex items-start justify-between">
              <div class="min-w-0 flex-1">
                <div class="text-sm font-medium truncate" :style="{ color: sess.id === activeSessionId ? 'var(--lt-text-primary)' : 'var(--lt-text-secondary)' }">{{ sess.title }}</div>
                <div class="text-xs mt-0.5 truncate" style="color: var(--lt-text-auxiliary);">{{ sess.lastMessagePreview || (sess.messageCount ? sess.messageCount + ' 条消息' : '') }}</div>
              </div>
              <button class="opacity-0 group-hover:opacity-100 flex-shrink-0 ml-1 p-0.5 rounded transition-all hover:bg-red-50" style="color: var(--lt-text-disabled); border: none; background: none; cursor: pointer;" @click.stop="deleteSession(sess.id)">
                <el-icon :size="14"><Delete /></el-icon>
              </button>
            </div>
            <div class="text-xs mt-1" style="color: var(--lt-text-placeholder);">{{ formatSessionTime(sess.updatedAt) }}</div>
          </div>
          <div v-if="courseSessions.length === 0" class="text-center py-8">
            <p class="text-xs" style="color: var(--lt-text-placeholder);">连接中...</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 主对话区 ===== -->
    <div class="flex-1 min-w-0" style="display: grid; grid-template-rows: auto 1fr auto; height: 100%;">
      <!-- 顶部 -->
      <div class="px-5 py-3 bg-white border-b flex items-center justify-between shadow-sm z-10" style="grid-row: 1; border-color: var(--lt-border);">
        <div class="flex items-center gap-3">
          <button v-if="isSessionListCollapsed" class="rounded-lg cursor-pointer flex items-center justify-center transition-all" style="width: 30px; height: 30px; background-color: rgba(43, 111, 255, 0.06); border: 1px solid var(--lt-brand-light-7); color: var(--lt-brand);" @click="isSessionListCollapsed = false">
            <el-icon :size="14"><Expand /></el-icon>
          </button>
          <h1 class="text-lg font-bold" style="color: var(--lt-text-primary);">AI 学习助手</h1>
          <el-tag v-if="profileVersionId" type="success" size="small" effect="plain">画像已就绪</el-tag>
          <el-tag v-else type="info" size="small" effect="plain">画像收集中</el-tag>
          <el-tag v-if="generationReady" type="warning" size="small" effect="plain">可生成资源</el-tag>
        </div>
        <div class="flex items-center gap-3">
          <el-button type="primary" size="small" :disabled="!profileVersionId" @click="showGeneratePanel = true">
            <el-icon class="mr-1"><MagicStick /></el-icon>生成资源
          </el-button>
          <el-button size="small" @click="router.push('/studio')">工作室 &rarr;</el-button>
        </div>
      </div>

      <!-- 消息列表 -->
      <div class="overflow-y-auto" style="grid-row: 2; min-height: 0;">
        <div v-if="showWelcomePage" class="flex flex-col items-center justify-center h-full px-8">
          <div class="w-28 h-28 mb-6">
            <LottieAnimation :animationData="liveChatbotLottie" width="100%" height="100%" />
          </div>
          <h2 class="text-xl font-bold mb-2" style="color: var(--lt-text-primary);">Hi，我是你的 AI 学习助手</h2>
          <p class="text-sm text-center mb-8 max-w-md leading-relaxed" style="color: var(--lt-text-auxiliary);">
            在学习对话中我会逐渐了解你的专业、基础、偏好和节奏<br/>
            为你定制个性化的学习体验<br/>
            直接问我知识点，或者聊聊你的学习情况吧
          </p>
          <div class="flex flex-wrap justify-center gap-3">
            <el-button size="large" class="text-sm" style="border-radius: 14px; padding: 12px 22px;" @click="sendMessage('我是计算机大三，在学人工智能导论，平时喜欢看代码')">
              我是计算机大三，在学AI导论
            </el-button>
            <el-button size="large" class="text-sm" style="border-radius: 14px; padding: 12px 22px;" @click="sendMessage('我概率基础还行但贝叶斯公式和A*搜索不太懂')">
              概率还行，贝叶斯不太懂
            </el-button>
            <el-button size="large" class="text-sm" style="border-radius: 14px; padding: 12px 22px;" @click="sendMessage('我每天能学60分钟，目标是期末考到85分')">
              每天60分钟，目标85分
            </el-button>
          </div>
        </div>

        <div v-else class="px-5 py-4 space-y-4">
          <div v-for="(msg, idx) in activeSession.messages" :key="idx" class="flex" :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
            <!-- AI 消息 -->
            <div v-if="msg.role === 'assistant'" class="max-w-[72%] rounded-xl text-sm leading-relaxed" style="border: 1px solid var(--lt-border); border-left: 3px solid var(--lt-brand); background-color: var(--lt-bg-card); border-radius: 12px; overflow: hidden;">
              <!-- 思考过程（ThoughtChainTimeline 时间线组件） -->
              <ThoughtChainTimeline
                v-if="msg.thinking"
                :steps="msg.thinking.steps"
                :is-streaming="msg.isStreaming"
                :expanded="msg.thinking.expanded || false"
                @update:expanded="msg.thinking.expanded = $event"
                class="mx-3 mb-2"
              />
              <!-- 正文（纯文本消息） -->
              <div v-if="!(msg as any)._generationCard" class="px-4 py-3 assistant-message-body">
                <MarkdownViewer v-if="!msg.isStreaming" :content="msg.text" :showToc="false" />
                <pre v-else class="streaming-text whitespace-pre-wrap text-sm leading-relaxed" style="color: var(--lt-text-primary); font-family: inherit; margin: 0;">{{ msg.text }}</pre>
                <span v-if="msg.isStreaming && msg.text" class="streaming-cursor" />
              </div>
              <!-- 带 GenerationCard 的消息：先显示文字，再显示进度卡片 -->
              <template v-if="(msg as any)._generationCard">
                <div class="px-4 py-3 assistant-message-body">
                  <p style="color: var(--lt-text-primary); margin: 0;">{{ msg.text }}</p>
                </div>
                <GenerationCard
                  v-bind="taskCards[(msg as any)._generationCard.taskId] || (msg as any)._generationCard"
                  class="mx-3 mb-2"
                />
              </template>
              <!-- v3.1: 资源生成建议按钮 -->
              <div v-if="msg.suggestions && msg.suggestions.length > 0" class="px-4 pb-3 flex flex-wrap gap-2">
                <el-button v-for="(sug, si) in msg.suggestions" :key="si" size="small" :type="msg.suggestionStyle === 'primary' ? 'primary' : undefined" plain @click="handleSuggestionClick(sug)">{{ sug.text }}</el-button>
              </div>
            </div>
            <!-- 用户消息 -->
            <div v-else class="max-w-[72%] px-4 py-3 rounded-xl text-sm leading-relaxed" style="background-color: var(--lt-brand); border-radius: 12px; color: #FFFFFF;">
              {{ msg.text }}
            </div>
          </div>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="px-4 py-3 bg-white border-t" style="grid-row: 3; border-color: var(--lt-border);">
        <div class="flex gap-3">
          <el-input v-model="inputMessage" placeholder="聊聊你的学习情况，我会帮你定制学习方案..." :disabled="isStreaming || isGenerating" @keyup.enter="sendMessage()" size="large" class="flex-1">
            <template #prefix><el-icon><ChatLineRound /></el-icon></template>
          </el-input>
          <el-button type="primary" size="large" :disabled="(isStreaming || !inputMessage.trim()) && !isGenerating" @click="sendMessage()">发送</el-button>
        </div>
      </div>
    </div>

    <!-- 生成资源弹窗 -->
    <el-dialog v-model="showGeneratePanel" title="生成个性化资源包" width="420px" :close-on-click-modal="false">
      <el-form label-position="top">
        <el-form-item label="知识点">
          <el-input v-model="generateTopic" placeholder="例如：贝叶斯分类器" size="large" @keyup.enter="triggerGenerate()" />
        </el-form-item>
        <p class="text-xs mb-4" style="color: var(--lt-text-auxiliary);">
          Planner 会根据你的画像自主决策生成哪些资源类型（3-5 类），无需手动选择。
        </p>
      </el-form>
      <template #footer>
        <el-button @click="showGeneratePanel = false">取消</el-button>
        <el-button type="primary" :loading="isGenerating" :disabled="!generateTopic.trim()" @click="triggerGenerate()">启动生成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.session-item { transition: all 0.15s ease; }
.session-item:hover { background-color: var(--lt-bg-page); }
.session-active { font-weight: 500; }
.streaming-cursor {
  display: inline-block; width: 8px; height: 16px;
  background-color: var(--lt-brand); margin-left: 2px;
  vertical-align: text-bottom; border-radius: 1px;
  animation: cursor-blink 0.8s ease-in-out infinite;
}
@keyframes cursor-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
.assistant-message-body :deep(.markdown-viewer) { display: block; }
.assistant-message-body :deep(.markdown-content) { font-size: 14px; line-height: 1.7; }
.assistant-message-body :deep(.markdown-content p) { margin: 4px 0; }
.assistant-message-body :deep(.markdown-content pre) { margin: 8px 0; }

</style>
