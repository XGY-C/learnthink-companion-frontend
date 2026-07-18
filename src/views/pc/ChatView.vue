<script setup lang="ts">
import { ref, computed, watch, reactive, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, Fold, Expand, MagicStick } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { useChatSSE } from '@/composables/useChatSSE'
import type { ChatMessage, Suggestion } from '@/composables/useChatSSE'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import { createTtsPlayer, type TtsSentenceState } from '@/utils/ttsSentence'
import ThoughtChainTimeline from '@/components/ThoughtChainTimeline.vue'
import LottieAnimation from '@/components/LottieAnimation.vue'
import liveChatbotLottie from '@/assets/lottie/live-chatbot.json'
import GenerationCard from '@/components/GenerationCard.vue'
import ProfilePanel from '@/components/Profile/ProfilePanel.vue'
import PlanEditor from '@/components/PlanEditor.vue'
import VideoLecturePlayer from '@/components/video/VideoLecturePlayer.vue'
import VideoRecordCard from '@/components/video/VideoRecordCard.vue'
import { useVideoLectureStore } from '@/stores/videoLecture'
import ClarificationCard from '@/components/tutoring/ClarificationCard.vue'
import AnalysisBar from '@/components/tutoring/AnalysisBar.vue'
import AnswerContainer from '@/components/tutoring/AnswerContainer.vue'
import GuidedDialogue from '@/components/tutoring/GuidedDialogue.vue'
import DirectAnswerInline from '@/components/tutoring/DirectAnswerInline.vue'
import TutoringInput from '@/components/tutoring/TutoringInput.vue'
import SmartVisualRenderer from '@/components/smart/SmartVisualRenderer.vue'
import type { TutoringMode } from '@/types/tutoring'

const router = useRouter()
const chat = useChatSSE()
const videoStore = useVideoLectureStore()

/** Mode options for the chat mode toggle — 辅导模式合并了原 tutoring 和 lecture */
const modes = [
  { value: 'chat' as const, label: '💬 对话' },
  { value: 'lecture' as const, label: '📖 辅导' },
  { value: 'resource' as const, label: '📝 资源' },
  { value: 'plan' as const, label: '🗺 规划' },
]

// ===== Profile Panel =====
const PROFILE_STORAGE_KEY = 'lt-profile-panel'
function getInitialCollapsed(): boolean {
  try {
    const v = localStorage.getItem(PROFILE_STORAGE_KEY)
    return v === 'collapsed'
  } catch { return false }
}
const isProfileCollapsed = ref(getInitialCollapsed())
function toggleProfile() {
  isProfileCollapsed.value = !isProfileCollapsed.value
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, isProfileCollapsed.value ? 'collapsed' : 'expanded')
  } catch { /* ignore */ }
}

// ===== Session sidebar collapse =====
const isSessionListCollapsed = ref(false)

// ===== Minimap =====
const showMinimap = ref(localStorage.getItem('lt-minimap') !== 'off')
watch(showMinimap, (v) => { localStorage.setItem('lt-minimap', v ? 'on' : 'off') })
const activeNavMsgIdx = ref(-1)
const isScrollingTo = ref(false)
let messageObserver: IntersectionObserver | null = null

const userNavItems = computed(() => {
  const session = chat.activeSession.value
  if (!session) return []
  return session.messages
    .map((msg, idx) => ({ msg, idx }))
    .filter(({ msg }) => msg.role === 'user')
})

function scrollToMessage(idx: number) {
  isScrollingTo.value = true
  activeNavMsgIdx.value = idx
  const el = document.getElementById(`msg-${idx}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  setTimeout(() => { isScrollingTo.value = false }, 800)
}

function setupNavObserver() {
  if (messageObserver) { messageObserver.disconnect(); messageObserver = null }
  const root = messageListRef.value
  if (!root) return

  messageObserver = new IntersectionObserver((entries) => {
    if (isScrollingTo.value || chat.isStreaming.value) return
    const intersecting = entries.filter(e => e.isIntersecting)
    if (intersecting.length === 0) return
    intersecting.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
    const id = intersecting[0].target.id
    const match = id.match(/^msg-(\d+)$/)
    if (match) activeNavMsgIdx.value = parseInt(match[1])
  }, {
    root,
    rootMargin: '-15% 0px -55% 0px',
    threshold: 0,
  })

  nextTick(() => {
    requestAnimationFrame(() => {
      const blocks = root.querySelectorAll('[id^="msg-"]')
      if (blocks.length === 0) return
      blocks.forEach(b => messageObserver?.observe(b))
      const firstVisible = Array.from(blocks).find(b => {
        const rect = b.getBoundingClientRect()
        const rootRect = root.getBoundingClientRect()
        return rect.top >= rootRect.top && rect.bottom <= rootRect.bottom
      })
      if (firstVisible) {
        const match = firstVisible.id.match(/^msg-(\d+)$/)
        if (match) activeNavMsgIdx.value = parseInt(match[1])
      }
    })
  })
}

const messageListRef = ref<HTMLElement | null>(null)
const inputMessage = ref('')
const messageTextareaRef = ref<HTMLTextAreaElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const ACCEPTED_TYPES = '.txt,.md,.csv,.json,.xml,.yaml,.yml,.log,.html,.htm,.pdf,.docx,.pptx,.xlsx,.xls,.py,.js,.ts,.tsx,.jsx,.vue,.java,.c,.cpp,.h,.hpp,.cs,.go,.rs,.rb,.php,.swift,.kt,.scala,.sh,.sql,.r,.tex,.bat,.ps1,.jpg,.jpeg,.png,.gif,.bmp,.webp,.svg'

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  if (input.files.length > 50) {
    ElMessage.warning('每次最多上传 50 个文件')
    input.value = ''
    return
  }
  const oversized = Array.from(input.files).filter(f => f.size > 100 * 1024 * 1024)
  if (oversized.length > 0) {
    ElMessage.warning(`文件 "${oversized[0].name}" 超过 100MB 限制`)
    input.value = ''
    return
  }
  isUploading.value = true
  const promises = Array.from(input.files).map(file => chat.uploadFile(file))
  Promise.allSettled(promises).finally(() => {
    isUploading.value = false
    input.value = ''
  })
}

function triggerFilePicker() {
  fileInputRef.value?.click()
}

function autoResizeMessageTextarea() {
  nextTick(() => {
    const el = messageTextareaRef.value
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 168) + 'px'
    }
  })
}

function getFileExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toUpperCase() : ''
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
}

function handleMessageKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSendMessage()
  }
}
const showGeneratePanel = ref(false)
const generateTopic = ref('')

function scrollToBottom() {
  nextTick(() => {
    const el = messageListRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

// ===== Action bar handlers =====
async function handleSuggestionClick(suggestion: Suggestion, msg: ChatMessage) {
  if (suggestion.sendAs.startsWith('__generate_plan__:')) {
    const topic = suggestion.sendAs.slice('__generate_plan__:'.length)
    msg.suggestions = undefined
    await chat.confirmPlanGeneration(topic, '')
  } else if (suggestion.sendAs.startsWith('__generate__:')) {
    const topic = suggestion.sendAs.slice('__generate__:'.length)
    msg.suggestions = undefined
    await chat.confirmGeneration(topic)
  } else if (suggestion.sendAs.startsWith('/studio')) {
    msg.suggestions = undefined
    router.push(suggestion.sendAs)
  } else if (suggestion.sendAs) {
    msg.suggestions = undefined
    await chat.sendMessage(suggestion.sendAs)
  } else {
    msg.suggestions = undefined
    msg.text = (msg.text || '') + '\n\n_（已了解，随时可以说「生成」来启动）_'
  }
  scrollToBottom()
}

async function copyMessage(msg: ChatMessage) {
  try {
    await navigator.clipboard.writeText(msg.text)
    ElMessage.success('已复制到剪贴板')
  } catch { ElMessage.error('复制失败') }
}

async function regenerateMessage(_msg: ChatMessage, idx: number) {
  const session = chat.activeSession.value
  if (!session || chat.isStreaming.value) return
  let userText = ''
  for (let i = idx - 1; i >= 0; i--) {
    if (session.messages[i]?.role === 'user') {
      userText = session.messages[i].text
      break
    }
  }
  if (userText) {
    await chat.sendMessage(userText)
    scrollToBottom()
  }
}

async function toggleLike(msg: ChatMessage) {
  const newFeedback = msg.feedback === 'liked' ? null : 'liked'
  msg.feedback = newFeedback
  msg._feedback = newFeedback ?? undefined
  if (msg.messageId) {
    try {
      await fetch(import.meta.env.VITE_API_BASE + `/chat/messages/${msg.messageId}/feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ feedback: newFeedback }),
      })
    } catch { /* 非阻塞 */ }
  }
}
async function toggleDislike(msg: ChatMessage) {
  const newFeedback = msg.feedback === 'disliked' ? null : 'disliked'
  msg.feedback = newFeedback
  msg._feedback = newFeedback ?? undefined
  if (msg.messageId) {
    try {
      await fetch(import.meta.env.VITE_API_BASE + `/chat/messages/${msg.messageId}/feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ feedback: newFeedback }),
      })
    } catch { /* 非阻塞 */ }
  }
}
async function shareMessage(msg: ChatMessage) {
  try {
    await navigator.clipboard.writeText(msg.text)
    ElMessage.success('内容已复制，可粘贴分享')
  } catch { ElMessage.error('分享失败') }
}

/** 渲染 mode 标签显示文本 */
function modeLabel(mode: string): string {
  switch (mode) {
    case 'lecture': return '辅导模式'
    case 'smart': return '智能辅导'
    case 'resource': return '资源生成'
    case 'plan': return '学习方案'
    default: return mode
  }
}

// ===== TTS (Text-to-Speech) — sentence-by-sentence streaming =====
const audioState = reactive({
  playingMsgIdx: -1,
  loading: false,
})

let ttsPlayer: { stop: () => void } | null = null

function stopAudio() {
  ttsPlayer?.stop()
  ttsPlayer = null
  audioState.playingMsgIdx = -1
  audioState.loading = false
}

async function toggleAudio(msg: ChatMessage, idx: number) {
  if (audioState.playingMsgIdx === idx) {
    stopAudio()
    return
  }
  stopAudio()

  const player = createTtsPlayer(msg, (s: TtsSentenceState) => {
    audioState.loading = s.isLoading
    if (!s.isPlaying && !s.isLoading) {
      audioState.playingMsgIdx = -1
    }
  })

  ttsPlayer = player
  audioState.playingMsgIdx = idx

  try {
    await player.start()
  } catch (err) {
    console.error('TTS error:', err)
    ElMessage.error(`语音合成失败: ${err instanceof Error ? err.message : '未知错误'}`)
  } finally {
    ttsPlayer = null
    audioState.loading = false
    audioState.playingMsgIdx = -1
  }
}

async function handleDeleteSession(sessionId: string) {
  if (chat.sessions.value.length <= 1) { ElMessage.info('至少保留一个会话'); return }
  try {
    await ElMessageBox.confirm('确定删除该会话？', '', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
    })
  } catch { return }
  await chat.deleteSession(sessionId)
  ElMessage.success('会话已删除')
}

function handleSessionClick(sess: any) {
  chat.switchSession(sess.id)
}

function handleSendMessage() {
  const text = inputMessage.value.trim()
  if (!text && chat.pendingFiles.value.length === 0) { console.warn('[SMART-DIAG] handleSendMessage: empty text & no files, aborting'); return }
  if (chat.isStreaming.value) { console.warn('[SMART-DIAG] handleSendMessage: isStreaming=true, aborting'); return }
  if (chat.isTutoringActive.value) { console.warn('[SMART-DIAG] handleSendMessage: isTutoringActive=true, aborting'); return }
  // Smart v2 对话中 -> 走 Smart answer
  console.info('[SMART-DIAG] handleSendMessage: isSmartActive=', chat.isSmartActive.value,
    'activeSmartMsgIdx=', chat.activeSmartMsgIdx?.value,
    'activeSessionId=', chat.activeSessionId?.value)
  if (chat.isSmartActive.value) {
    inputMessage.value = ''
    chat.sendSmartAnswer(text)
    scrollToBottom()
    return
  }
  console.warn('[SMART-DIAG] handleSendMessage: isSmartActive=false, falling through to sendMessage')
  inputMessage.value = ''
  chat.sendMessage(text)
  scrollToBottom()
}

function handleTutoringInputSend(text: string, mode: TutoringMode, isVideo: boolean) {
  if (chat.isStreaming.value || chat.isTutoringActive.value) return
  // Smart v2 对话中 -> 走 Smart answer（而非 sendTutoringMessage，后者会被 isSmartActive 阻断）
  if (chat.isSmartActive.value) {
    chat.sendSmartAnswer(text)
    scrollToBottom()
    return
  }
  if (isVideo) {
    chat.sendLectureMessage(text)
  } else {
    chat.sendTutoringMessage(text, mode)
  }
  scrollToBottom()
}

async function handleTriggerGenerate() {
  const topic = generateTopic.value.trim()
  if (!topic) { ElMessage.warning('请输入知识点'); return }
  try {
    await chat.triggerGenerate(topic)
    generateTopic.value = ''
    showGeneratePanel.value = false
    scrollToBottom()
  } catch (err: any) {
    ElMessage.warning(err.message || '生成失败')
  }
}

async function handleAcceptGenerationOffer(msg: ChatMessage) {
  try {
    await chat.acceptGenerationOffer(msg)
    scrollToBottom()
  } catch (err: any) {
    ElMessage.warning(err.message || '操作失败')
  }
}

async function handleConfirmEditedPlan(planJson: string, msg: ChatMessage) {
  try {
    await chat.confirmEditedPlan(planJson, msg._planOffer?.requirementText || '', msg._planOffer?.launchTopic || '学习计划')
    scrollToBottom()
  } catch (err: any) {
    ElMessage.warning(err.message || '操作失败')
  }
}

async function handleWelcomeButtonClick(text: string) {
  try {
    await chat.sendMessage(text)
    scrollToBottom()
  } catch (err: any) {
    ElMessage.warning(err.message || '操作失败')
  }
}

// ===== Init =====
onMounted(() => {
  chat.setCallbacks({
    onStreamChunk: () => { scrollToBottom() },
    onGenerationOffer: () => { scrollToBottom() },
  })
  chat.initChat()
})

onBeforeUnmount(() => {
  chat.fireEndSessionOnLeave()
  window.removeEventListener('beforeunload', onBeforeUnload)
  if (messageObserver) { messageObserver.disconnect(); messageObserver = null }
  stopAudio()
})

function onBeforeUnload() {
  chat.fireEndSessionOnLeave()
}
window.addEventListener('beforeunload', onBeforeUnload)

// Watch video lecture close → insert record card
let prevPhase: string = videoStore.phase
watch(() => videoStore.phase, (newPhase) => {
  if (prevPhase !== 'idle' && newPhase === 'idle' && videoStore.lastRecord && !videoStore._isReplaying) {
    chat.onLecturePlayerClose()
    scrollToBottom()
  }
  prevPhase = newPhase
})

// Handle video lecture replay from record card
function handleVideoReplay() {
  const card = videoStore.lastRecord
  if (!card) return
  videoStore.replayFromCard(card)
}

// ===== Tutoring handlers =====
/** 将 ReAct 思考步骤转为 ThoughtChainTimeline 需要的格式 */
const tutoringThoughtSteps = computed(() => {
  return chat.tutoringStore.reactThoughts.map((t) => ({
    label: `ReAct 第 ${t.iteration} 轮`,
    icon: 'thought',
    done: true,
    phase: 'DECISION' as const,
    detail: `Action: ${t.action}`,
    thought: t.thought,
  }))
})

const tutoringVisibleSections = computed(() => {
  const msg = tutoringActiveMessage.value
  return msg?.role === 'assistant' && msg._tutoring?.completed && msg._tutoring.snapshot?.sections
    ? msg._tutoring.snapshot.sections
    : null
})

const tutoringVisibleAnalysis = computed(() => {
  const msg = tutoringActiveMessage.value
  return msg?.role === 'assistant' && msg._tutoring?.completed ? msg._tutoring.snapshot?.analysis ?? null : null
})



const tutoringVisibleThoughtSteps = computed(() => {
  const msg = tutoringActiveMessage.value
  if (msg?.role === 'assistant' && msg._tutoring?.completed) {
    return (msg._tutoring.snapshot?.reactThoughts ?? []).map((t) => ({
      label: `ReAct 第 ${t.iteration} 轮`,
      icon: 'thought',
      done: true,
      phase: 'DECISION' as const,
      detail: `Action: ${t.action}`,
      thought: t.thought,
    }))
  }
  return tutoringThoughtSteps.value
})

const tutoringVisibleStatus = computed(() => {
  const msg = tutoringActiveMessage.value
  if (msg?.role === 'assistant' && msg._tutoring?.completed) return 'done'
  return chat.tutoringStore.status
})

const tutoringActiveMessage = computed(() => {
  const session = chat.activeSession.value
  if (!session) return null
  if (chat.activeTutoringMsgIdx.value >= 0) {
    return session.messages[chat.activeTutoringMsgIdx.value] ?? null
  }
  return [...session.messages].reverse().find(m => m.role === 'assistant' && m._tutoring?.completed) ?? null
})

function handleClarifySubmit(response: { skipped: boolean; selectedOptionId?: string; freeInput?: string }) {
  chat.sendClarificationResponse(response)
  scrollToBottom()
}

function handleSectionAction(sectionId: string, action: string, instruction?: string) {
  chat.regenerateTutoringSection(sectionId, action, instruction)
}

function handleTutoringRetry() {
  if (!chat.tutoringStore.error?.retryable) return
  const question = [...(chat.activeSession.value?.messages ?? [])]
    .reverse().find(m => m.role === 'user')?.text
  if (question) {
    chat.sendTutoringMessage(question)
  }
}

// Watch messages to re-setup minimap observer
watch([() => chat.activeSession.value?.messages.length, chat.showWelcomePage], ([, isWelcome]) => {
  if (isWelcome) {
    if (messageObserver) { messageObserver.disconnect(); messageObserver = null }
    return
  }
  nextTick(() => setupNavObserver())
})

// Tutoring: scroll to bottom when content updates
watch(
  () => chat.tutoringStore.sectionList.map(s => s.content.length).reduce((a, b) => a + b, 0),
  () => { if (chat.isStreaming.value || chat.isTutoringActive.value) scrollToBottom() }
)
watch(
  () => chat.tutoringStore.status,
  () => { nextTick(() => scrollToBottom()) }
)
// 消息数量变化时滚动（用户消息 push / AI 占位 push）
watch(
  () => chat.activeSession.value?.messages.length ?? 0,
  () => { nextTick(() => scrollToBottom()) }
)
</script>

<template>
  <div style="display: flex; height: 100%;">
    <!-- ===== 会话列表侧栏 ===== -->
    <div class="session-sidebar-wrapper flex-shrink-0 relative" :style="{ width: isSessionListCollapsed ? '0px' : '260px', transition: 'width 0.25s ease', overflow: 'hidden' }">
      <div class="session-sidebar flex flex-col h-full" style="width: 260px; min-width: 260px; background-color: var(--lt-bg-card); border-right: 1px solid var(--lt-border);">
        <div class="px-3 pt-3 pb-2 flex items-center justify-between">
          <el-button size="default" class="flex-1" style="border-radius: 10px; border: 1px dashed var(--lt-brand-lighter); color: var(--lt-brand); background-color: rgba(43, 111, 255, 0.04); font-weight: 500;" @click="inputMessage = ''; chat.createSession()">
            <el-icon class="mr-1"><Plus /></el-icon>新建会话
          </el-button>
          <button class="flex-shrink-0 ml-2 p-1 rounded-md transition-all cursor-pointer" style="color: var(--lt-text-auxiliary); border: none; background: transparent;" @click="isSessionListCollapsed = true">
            <el-icon :size="16"><Fold /></el-icon>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto px-2 pb-2">
          <div
            v-for="sess in chat.courseSessions.value"
            :key="sess.id"
            class="session-item group relative cursor-pointer rounded-lg px-3 py-2.5 mb-1 transition-all"
            :class="{ 'session-active': sess.id === chat.activeSessionId.value }"
            :style="sess.id === chat.activeSessionId.value ? 'background-color: var(--lt-brand-lightest); border-left: 3px solid var(--lt-brand);' : 'border-left: 3px solid transparent;'"
            @click="handleSessionClick(sess)"
          >
            <div class="flex items-start justify-between">
              <div class="min-w-0 flex-1">
                <div class="text-sm font-medium truncate flex items-center gap-1" :style="{ color: sess.id === chat.activeSessionId.value ? 'var(--lt-text-primary)' : 'var(--lt-text-secondary)' }">
                  <span v-if="sess.type === 'lecture'" class="flex-shrink-0">📖</span>
                  <span v-else-if="sess.type === 'resource'" class="flex-shrink-0">📝</span>
                  <span v-else-if="sess.type === 'plan'" class="flex-shrink-0">🗺</span>
                  <span v-else class="flex-shrink-0">💬</span>
                  {{ sess.title }}
                </div>
                <div class="text-xs mt-0.5 truncate" style="color: var(--lt-text-auxiliary);">{{ sess.lastMessagePreview || (sess.messageCount ? sess.messageCount + ' 条消息' : '') }}</div>
              </div>
              <button class="opacity-0 group-hover:opacity-100 flex-shrink-0 ml-1 p-0.5 rounded transition-all hover:bg-red-50" style="color: var(--lt-text-disabled); border: none; background: none; cursor: pointer;" @click.stop="handleDeleteSession(sess.id)">
                <el-icon :size="14"><Delete /></el-icon>
              </button>
            </div>
            <div class="text-xs mt-1" style="color: var(--lt-text-placeholder);">{{ chat.formatSessionTime(sess.updatedAt) }}</div>
          </div>
          <div v-if="chat.courseSessions.value.length === 0" class="text-center py-8">
            <p class="text-xs" style="color: var(--lt-text-placeholder);">连接中...</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 主对话区 ===== -->
    <div class="flex-1 min-w-0 relative" style="display: grid; grid-template-rows: auto 1fr auto; height: 100%;">
      <!-- 顶部 -->
      <div class="px-5 py-3 bg-white border-b flex items-center justify-between shadow-sm z-10" style="grid-row: 1; border-color: var(--lt-border);">
        <div class="flex items-center gap-3">
          <button v-if="isSessionListCollapsed" class="rounded-lg cursor-pointer flex items-center justify-center transition-all" style="width: 30px; height: 30px; background-color: rgba(43, 111, 255, 0.06); border: 1px solid var(--lt-brand-light-7); color: var(--lt-brand);" @click="isSessionListCollapsed = false">
            <el-icon :size="14"><Expand /></el-icon>
          </button>
          <h1 class="text-lg font-bold" style="color: var(--lt-text-primary);">AI 学习助手</h1>
          <!-- 对话模式切换 -->
          <div class="mode-switch">
            <button
              v-for="m in modes" :key="m.value"
              class="mode-btn"
              :class="{ 'is-active': chat.chatMode.value === m.value }"
              :disabled="chat.isStreaming.value || chat.isTutoringActive.value"
              @click="chat.chatMode.value = m.value"
            >
              {{ m.label }}
            </button>
          </div>
          <el-tag v-if="chat.profileVersionId.value" type="success" size="small" effect="plain">画像已就绪</el-tag>
          <el-tag v-else type="info" size="small" effect="plain">画像收集中</el-tag>
          <el-tag v-if="chat.generationReady.value" type="warning" size="small" effect="plain">可生成资源</el-tag>
          <el-tag v-if="chat.planGenerationReady.value" type="primary" size="small" effect="plain">可生成计划</el-tag>
        </div>
        <div class="flex items-center gap-3">
          <el-button type="primary" size="small" :disabled="!chat.profileVersionId.value" @click="showGeneratePanel = true">
            <el-icon class="mr-1"><MagicStick /></el-icon>生成资源
          </el-button>
          <el-button size="small" @click="router.push('/studio')">工作室 &rarr;</el-button>
          <button
            class="minimap-toggle-btn"
            :class="{ 'is-on': showMinimap }"
            :title="showMinimap ? '大纲已开启' : '大纲已关闭'"
            @click="showMinimap = !showMinimap"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="15" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- 消息列表 -->
      <div ref="messageListRef" class="message-list-scroll" style="grid-row: 2; min-height: 0;">
        <div v-if="chat.showWelcomePage.value" class="flex flex-col items-center justify-center h-full px-8">
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
            <el-button size="large" class="text-sm" style="border-radius: 14px; padding: 12px 22px;" @click="handleWelcomeButtonClick('我是计算机大三，在学人工智能导论，平时喜欢看代码')">
              我是计算机大三，在学AI导论
            </el-button>
            <el-button size="large" class="text-sm" style="border-radius: 14px; padding: 12px 22px;" @click="handleWelcomeButtonClick('我概率基础还行但贝叶斯公式和A*搜索不太懂')">
              概率还行，贝叶斯不太懂
            </el-button>
            <el-button size="large" class="text-sm" style="border-radius: 14px; padding: 12px 22px;" @click="handleWelcomeButtonClick('我每天能学60分钟，目标是期末考到85分')">
              每天60分钟，目标85分
            </el-button>
          </div>
        </div>

        <div v-else class="px-5 py-4">
          <div
            v-for="(msg, idx) in chat.activeSession.value?.messages ?? []"
            :key="msg.messageId || idx"
            class="flex"
            :class="msg.role === 'user' ? 'justify-end' : 'justify-center'"
            :style="{ marginBottom: idx === (chat.activeSession.value?.messages.length ?? 1) - 1 ? '0' : (msg.role === 'user' ? '24px' : '40px') }"
          >
            <!-- AI 消息 -->
            <div v-if="msg.role === 'assistant'" class="ai-response-block" style="max-width: 860px; width: 100%;">
              <!-- 辅导模式标签 -->
              <div v-if="msg.mode && msg.mode !== 'chat'" class="mode-tag" :class="`mode-tag--${msg.mode}`">
                {{ modeLabel(msg.mode) }}
              </div>
              <ThoughtChainTimeline
                v-if="msg.thinking && !(msg._tutoring?.completed || (idx === chat.activeTutoringMsgIdx.value && chat.tutoringStore.status !== 'idle'))"
                :steps="msg.thinking.steps"
                :is-streaming="msg.isStreaming"
                :expanded="msg.thinking.expanded || false"
                @update:expanded="msg.thinking.expanded = $event"
                class="mb-3"
              />
              <div v-if="!(msg as any)._generationCard && !(msg as any)._videoRecord && !(msg as any)._directAnswer && !(msg as any)._smart && !(idx === chat.activeTutoringMsgIdx.value && chat.tutoringStore.status !== 'idle') && !(msg.role === 'assistant' && msg._tutoring?.completed)" class="assistant-message-body">
                <MarkdownViewer v-if="!msg.isStreaming" :content="msg.text" :showToc="false" />
                <pre v-else class="streaming-text whitespace-pre-wrap text-sm leading-relaxed" style="color: var(--lt-text-primary); font-family: inherit; margin: 0;">{{ msg.text }}</pre>
                <span v-if="msg.isStreaming && msg.text" class="streaming-cursor" />
              </div>

              <!-- ═══ 图文辅导内联渲染 ═══ -->
              <div v-if="(idx === chat.activeTutoringMsgIdx.value && chat.tutoringStore.status !== 'idle') || msg._tutoring?.completed" class="tutoring-inline">
                <!-- ReAct 思考过程（可折叠） -->
                <ThoughtChainTimeline
                  :steps="tutoringVisibleThoughtSteps"
                  :is-streaming="tutoringVisibleStatus === 'planning'"
                  :expanded="msg._tutoring?.snapshot?.expanded ?? false"
                  @update:expanded="msg._tutoring!.snapshot!.expanded = $event"
                  class="mb-3"
                />

                <!-- 澄清卡片 -->
                <ClarificationCard
                  v-if="chat.tutoringStore.status === 'clarifying' && chat.tutoringStore.clarification"
                  :clarification="chat.tutoringStore.clarification"
                  :clarifyWaitSeconds="chat.tutoringStore.clarifyWaitSeconds"
                  :round="chat.tutoringRound.value"
                  @submit="handleClarifySubmit"
                />

                <!-- 分析标签栏 -->
                <AnalysisBar v-if="tutoringVisibleAnalysis && ['preparing','generating','done','guided'].includes(tutoringVisibleStatus)" :analysis="tutoringVisibleAnalysis" class="mb-4" />

                <!-- 准备中 -->
                <div v-if="chat.tutoringStore.status === 'preparing'" class="text-center py-4">
                  <p style="font-size: 13px; color: var(--lt-text-auxiliary);">正在准备资料...</p>
                </div>

                <!-- 引导模式对话（活跃中：从 store 渲染，仅当前会话匹配时显示） -->
                <GuidedDialogue
                  v-if="chat.isTutoringActive.value && (chat.tutoringStore.status === 'guided' || chat.tutoringStore.guidedSteps.length > 0)"
                  :inline-submit="chat.submitGuidedAnswerInline"
                />

                <!-- 引导模式对话（已完成：从快照渲染） -->
                <GuidedDialogue
                  v-else-if="msg._tutoring?.completed && msg._tutoring?.subMode === 'guided' && msg._tutoring?.snapshot?.guidedSteps"
                  :snapshot="msg._tutoring.snapshot"
                />

                <!-- 解答内容（SectionCards） -->
                <AnswerContainer
                  v-if="(chat.tutoringStore.sectionList.length > 0 || tutoringVisibleSections)"
                  :sections="tutoringVisibleSections || undefined"
                  :read-only="!!tutoringVisibleSections"
                  @action="handleSectionAction"
                />

                <!-- 错误 -->
                <div v-if="chat.tutoringStore.status === 'error'" style="background: var(--lt-orange-light-9); border: 1px solid var(--lt-warning); border-radius: var(--lt-radius-lg); padding: 20px; text-align: center;">
                  <div style="font-size: 32px; margin-bottom: 8px;">⚠️</div>
                  <h3 style="font-size: 16px; font-weight: 600; color: var(--lt-text-primary); margin-bottom: 4px;">{{ chat.tutoringStore.error?.message || '出错了' }}</h3>
                  <el-button v-if="chat.tutoringStore.error?.retryable" type="primary" size="small" @click="handleTutoringRetry" style="margin-top: 12px;">重试</el-button>
                </div>
              </div>

              <!-- ═══ DirectAnswer 内联渲染 ═══ -->
              <div v-if="(idx === chat.activeDirectAnswerMsgIdx.value && chat.directAnswerStore.status !== 'idle') || msg._directAnswer?.completed" class="da-inline-wrap">
                <DirectAnswerInline
                  :store="chat.directAnswerStore"
                  :is-completed="!!msg._directAnswer?.completed"
                  :snapshot="msg._directAnswer?.snapshot ?? null"
                />
              </div>

              <!-- ═══ Smart v2 智能模式内联渲染 ═══ -->
              <div v-if="msg._smart && (msg._smart.active || msg._smart.completed)" class="smart-inline-wrap">
                <!-- 思考链（可折叠） -->
                <ThoughtChainTimeline
                  v-if="msg._smart.thinkingSteps.length > 0"
                  :steps="msg._smart.thinkingSteps"
                  :is-streaming="msg.isStreaming"
                  :expanded="msg._smart.thinkingExpanded || false"
                  @update:expanded="msg._smart!.thinkingExpanded = $event"
                  class="mb-3"
                />
                <!-- 内容块序列 -- 文字和可视化自然交替 -->
                <template v-for="(block, bi) in msg._smart.blocks" :key="bi">
                  <div v-if="block.type === 'text'" class="smart-text-block">
                    <MarkdownViewer :content="block.content" :showToc="false" />
                  </div>
                  <div v-else-if="block.type === 'visual'" class="smart-visual-block">
                    <SmartVisualRenderer
                      :render-type="block.renderType"
                      :code="block.code"
                      :description="block.description"
                      :status="block.status"
                    />
                  </div>
                </template>
                <!-- 流式中的文本 -->
                <div v-if="msg.isStreaming && msg.text" class="smart-text-block">
                  <pre class="streaming-text whitespace-pre-wrap text-sm leading-relaxed" style="color: var(--lt-text-primary); font-family: inherit; margin: 0;">{{ msg.text }}</pre>
                  <span class="streaming-cursor" />
                </div>
                <!-- 等待中光标 -->
                <div v-if="msg.isStreaming && !msg.text && msg._smart.blocks.length === 0" class="smart-loading">
                  <span class="streaming-cursor" />
                </div>
              </div>

              <template v-if="(msg as any)._generationCard">
                <div class="assistant-message-body">
                  <p style="color: var(--lt-text-primary); margin: 0;">{{ msg.text }}</p>
                </div>
                <GenerationCard
                  v-bind="chat.taskCards.value[(msg as any)._generationCard.taskId] || (msg as any)._generationCard"
                  class="mb-3"
                />
              </template>

              <!-- 方案确认卡片 — 资源类型 -->
              <div v-if="msg._planOffer && msg._planOffer.type === 'resource' && !msg._planOffer.dismissed" class="generation-offer-card" :class="{ 'is-accepted': msg._planOffer.accepted }">
                <div class="offer-header">
                  <div class="offer-header-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </div>
                  <div class="offer-header-title">AI 为你规划了以下学习方案</div>
                </div>
                <div class="offer-topic-card">
                  <div class="offer-topic-title">{{ msg._planOffer.topic }}</div>
                  <div class="offer-topic-goal">{{ msg._planOffer.goalSummary }}</div>
                  <div class="offer-topic-pills">
                    <!-- 优化: 增加图标 -->
                    <span v-if="msg._planOffer.difficulty" class="offer-pill pill-difficulty">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><path d="M2 13.54a9 9 0 010-3.08l.34-1.63a2 2 0 00-1.2-2.34L.36 5.2a9 9 0 013.08-3.08l1.63.34a2 2 0 002.34-1.2l.34-1.63A9 9 0 0112 0a9 9 0 014.88 1.36l.34 1.63a2 2 0 002.34 1.2l1.63-.34a9 9 0 013.08 3.08l-.78 1.34a2 2 0 00-1.2 2.34l.34 1.63a9 9 0 010 3.08l-.34 1.63a2 2 0 001.2 2.34l.78 1.34a9 9 0 01-3.08 3.08l-1.63-.34a2 2 0 00-2.34 1.2l-.34 1.63A9 9 0 0112 24a9 9 0 01-4.88-1.36l-.34-1.63a2 2 0 00-2.34-1.2L2.8 21.16a9 9 0 01-3.08-3.08l.78-1.34a2 2 0 001.2-2.34L2 13.54z" /><path d="M12 8v8" /><path d="M8 12h8" /></svg>
                      {{ { beginner: '入门', basic: '基础', intermediate: '中级', advanced: '高级', expert: '专家' }[msg._planOffer.difficulty] || msg._planOffer.difficulty }}
                    </span>
                    <span v-if="msg._planOffer.items?.length" class="offer-pill pill-count">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                      共 {{ msg._planOffer.items.length }} 份
                    </span>
                    <span v-if="msg._planOffer.coveredCount != null" class="offer-pill pill-profile">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                      画像覆盖 {{ msg._planOffer.coveredCount }}/7
                    </span>
                  </div>
                </div>
                <div v-if="msg._planOffer.items?.length" class="offer-plan-section">
                  <div class="offer-plan-title">执行计划</div>
                  <div class="offer-plan-timeline">
                    <div v-for="(item, itemIdx) in msg._planOffer.items" :key="itemIdx" class="offer-plan-item">
                      <div class="offer-plan-dot-wrapper">
                        <div class="offer-plan-dot" :style="{ backgroundColor: {doc: '#2B6FFF', mindmap: '#7C5CFC', quiz: '#FF8C42', reading: '#34C759', code: '#FF3B30', video: '#FF9F0A'}[item.type] || '#8E8EA0' }"></div>
                      </div>
                      <div class="offer-plan-content">
                        <div class="offer-plan-type">
                          <span class="font-medium">{{ {doc: '讲解文档', quiz: '练习题', mindmap: '思维导图', code: '代码实操', reading: '拓展阅读', video: '讲解视频', html: '交互文档'}[item.type] || item.type }}</span>
                          <span class="offer-plan-type-count">×1</span>
                        </div>
                        <div class="offer-plan-focus">{{ item.focus }}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="!msg._planOffer.accepted" class="offer-actions">
                  <button class="offer-btn-primary" :disabled="chat.isGenerating.value" @click="handleAcceptGenerationOffer(msg)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>确认启动
                  </button>
                  <button class="offer-btn-ghost" @click="chat.dismissGenerationOffer()">继续聊天</button>
                </div>
                <div v-else class="offer-actions offer-actions-done">
                  <span class="offer-done-badge">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    已启动生成
                  </span>
                </div>
              </div>

              <!-- 视频讲解记录卡片 -->
              <div v-if="(msg as any)._videoRecord" class="video-record-wrapper">
                <VideoRecordCard
                  :topic="(msg as any)._videoRecord.topic"
                  :scene-count="(msg as any)._videoRecord.sceneCount"
                  :completed="(msg as any)._videoRecord.completed"
                  @replay="handleVideoReplay"
                />
              </div>

              <!-- 可编辑计划编辑器 — 计划类型（已确认的方案不消失，但禁用编辑） -->
              <!-- v3.1: 支持 _pendingPlan（DB 加载）和 _planOffer（实时流）两种数据源 -->
              <PlanEditor
                v-if="(msg._planOffer && msg._planOffer.type === 'plan' && !msg._planOffer.dismissed) || (msg as any)._pendingPlan"
                :modules="((msg as any)._pendingPlan?.modules?.length ? (msg as any)._pendingPlan.modules : (chat.planPreviewData.value?.modules || []))"
                :edges="((msg as any)._pendingPlan?.edges?.length ? (msg as any)._pendingPlan.edges : (chat.planPreviewData.value?.edges || []))"
                :loading="chat.planPreviewLoading.value && !(msg as any)._pendingPlan"
                :confirmed="!!(msg._planOffer?.confirmed || (msg as any)._pendingPlan?.confirmed)"
                :on-save="(planJson: string) => chat.updatePlanDraft(planJson)"
                @confirm="(planJson: string) => handleConfirmEditedPlan(planJson, msg)"
                @cancel="chat.dismissPlanOffer()"
              />

              <div v-if="!(msg as any)._videoRecord && !(idx === chat.activeTutoringMsgIdx.value && chat.tutoringStore.status !== 'idle')" class="ai-action-bar">
                <button class="ai-action-btn" title="复制" @click="copyMessage(msg)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
                <button class="ai-action-btn" title="重新生成" :disabled="chat.isStreaming.value" @click="regenerateMessage(msg, idx)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                </button>
                <button class="ai-action-btn" :class="{ 'is-liked': msg.feedback === 'liked' || msg._feedback === 'liked' }" title="喜欢" @click="toggleLike(msg)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                </button>
                <button class="ai-action-btn" :class="{ 'is-disliked': msg.feedback === 'disliked' || msg._feedback === 'disliked' }" title="不喜欢" @click="toggleDislike(msg)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 2h3a2 2 0 0 0 2 2v7a2 2 0 0 1-2 2h-3"/></svg>
                </button>
                <button class="ai-action-btn" title="分享" @click="shareMessage(msg)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                </button>
                <button
                  class="ai-action-btn"
                  :class="{
                    'is-playing': audioState.playingMsgIdx === idx,
                    'is-loading': audioState.loading && audioState.playingMsgIdx === idx
                  }"
                  :disabled="audioState.loading && audioState.playingMsgIdx === idx"
                  title="朗读"
                  @click="toggleAudio(msg, idx)"
                >
                  <!-- Stop icon when playing: muted speaker -->
                  <svg v-if="audioState.playingMsgIdx === idx" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                  <!-- Play icon otherwise: speaker with sound waves -->
                  <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                </button>
                <template v-if="msg.suggestions && msg.suggestions.length > 0">
                  <span class="ai-action-divider" />
                  <button
                    v-for="(sug, si) in msg.suggestions"
                    :key="si"
                    class="ai-action-suggestion"
                    :class="{ 'is-primary': msg.suggestionStyle === 'primary' }"
                    @click="handleSuggestionClick(sug, msg)"
                  >{{ sug.text }}</button>
                </template>
              </div>
            </div>
            <!-- 用户消息 -->
            <div v-else :id="'msg-' + idx" class="user-message-block max-w-[72%] px-4 py-3 rounded-xl text-sm leading-relaxed" style="background-color: var(--lt-brand); border-radius: 12px; color: #FFFFFF;">
              <div>{{ msg.text }}</div>
              <div v-if="msg._files && msg._files.length > 0" class="user-files-row">
                <div v-for="(f, fi) in msg._files" :key="fi" class="user-file-chip" :class="{ 'is-image': f.isImage }">
                  <span v-if="f.isImage" class="ufc-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  </span>
                  <span v-else class="ufc-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </span>
                  <span class="ufc-name">{{ f.fileName.length > 25 ? f.fileName.slice(0, 23) + '…' : f.fileName }}</span>
                  <span v-if="!f.isImage && getFileExt(f.fileName)" class="ufc-ext">{{ getFileExt(f.fileName) }}</span>
                  <span v-if="f.fileSize" class="ufc-size">{{ formatFileSize(f.fileSize) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="px-4 py-3 bg-white border-t" style="grid-row: 3; border-color: var(--lt-border);">
        <!-- 辅导模式：集成式输入（模式选择 + 视频 + textarea） -->
        <TutoringInput
          v-if="chat.chatMode.value === 'lecture'"
          :disabled="chat.isStreaming.value || chat.isTutoringActive.value || chat.isGenerating.value"
          :placeholder="'输入你的问题，获取 AI 辅导解答...'"
          @send="handleTutoringInputSend"
        />
        <!-- 其他模式：textarea 支持 shift+enter 换行 -->
        <div v-else class="flex gap-3 items-end">
          <div class="flex-1 message-textarea-wrap">
            <div v-if="chat.pendingFiles.value.length > 0" class="file-chips-row">
              <div v-for="(f, fi) in chat.pendingFiles.value" :key="fi" class="file-chip" :class="{ 'is-image': f.isImage }">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span class="file-chip-name">{{ f.fileName.length > 20 ? f.fileName.slice(0, 18) + '…' : f.fileName }}</span>
                <span v-if="!f.isImage && getFileExt(f.fileName)" class="file-chip-ext">{{ getFileExt(f.fileName) }}</span>
                <span v-if="f.fileSize" class="file-chip-size">{{ formatFileSize(f.fileSize) }}</span>
                <button class="file-chip-remove" @click="chat.removePendingFile(f.fileUrl)">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
            <textarea
              ref="messageTextareaRef"
              v-model="inputMessage"
              class="message-textarea"
              :placeholder="chat.isSmartActive.value ? '继续对话，回答 AI 老师的问题...'
                : chat.chatMode.value === 'resource' ? '描述你想生成的资料内容...'
                : chat.chatMode.value === 'plan' ? '聊聊你的学习目标和基础...'
                : '聊聊你的学习情况，我会帮你定制学习方案...'"
              :disabled="chat.isStreaming.value || chat.isTutoringActive.value || chat.isGenerating.value"
              rows="1"
              @input="autoResizeMessageTextarea"
              @keydown="handleMessageKeydown"
            ></textarea>
          </div>
          <div class="flex items-end gap-2">
            <button
              class="upload-btn"
              :disabled="chat.isStreaming.value || chat.isTutoringActive.value || isUploading"
              :title="isUploading ? '上传中...' : '上传文件'"
              @click="triggerFilePicker"
            >
              <div class="ds-button__icon ds-button__icon--last-child" v-if="!isUploading">
                <div class="ds-icon" style="font-size: inherit;">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5.5498 9.75V5H6.9502V9.75C6.9502 10.3299 7.4201 10.7998 8 10.7998C8.5799 10.7998 9.0498 10.3299 9.0498 9.75V4.5C9.0498 2.9536 7.7964 1.7002 6.25 1.7002C4.7036 1.7002 3.4502 2.9536 3.4502 4.5V9.75C3.4502 12.2629 5.4871 14.2998 8 14.2998C10.5129 14.2998 12.5498 12.2629 12.5498 9.75V4H13.9502V9.75C13.9502 13.0361 11.2861 15.7002 8 15.7002C4.71391 15.7002 2.0498 13.0361 2.0498 9.75V4.5C2.04981 2.1804 3.9304 0.299806 6.25 0.299805C8.5696 0.299805 10.4502 2.1804 10.4502 4.5V9.75C10.4502 11.1031 9.3531 12.2002 8 12.2002C6.6469 12.2002 5.5498 11.1031 5.5498 9.75Z" fill="currentColor"></path>
                  </svg>
                </div>
              </div>
              <span v-else class="upload-spinner"></span>
            </button>
            <input
              ref="fileInputRef"
              type="file"
              multiple
              :accept="ACCEPTED_TYPES"
              style="display:none"
              @change="handleFileSelect"
            />
            <el-button type="primary" size="large" :disabled="chat.isStreaming.value || chat.isTutoringActive.value || (!inputMessage.trim() && chat.pendingFiles.value.length === 0)" @click="handleSendMessage">发送</el-button>
          </div>
        </div>
      </div>

      <!-- ===== 迷你地图导航 ===== -->
      <div
        class="minimap-wrapper"
        :class="{ 'minimap-hidden': !showMinimap || userNavItems.length === 0 }"
      >
        <div class="minimap-bar">
          <div
            v-for="item in userNavItems"
            :key="item.idx"
            class="minimap-item"
            :class="{ 'is-active': item.idx === activeNavMsgIdx }"
            @click="scrollToMessage(item.idx)"
          >
            <span class="minimap-indicator"></span>
            <span class="minimap-text">{{ item.msg.text.slice(0, 40) }}{{ item.msg.text.length > 40 ? '…' : '' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 右侧画像面板 ===== -->
    <div
      class="transition-all duration-300 flex-shrink-0"
      :style="{
        width: isProfileCollapsed ? '36px' : '280px',
        height: '100%',
        overflow: 'hidden'
      }"
    >
      <ProfilePanel
        style="height: 100%;"
        :collapsed="isProfileCollapsed"
        @toggle="toggleProfile"
      />
    </div>

    <!-- 视频讲解播放器 -->
    <VideoLecturePlayer />

    <!-- 生成资源弹窗 -->
    <el-dialog v-model="showGeneratePanel" title="生成个性化资源包" width="420px" :close-on-click-modal="false">
      <el-form label-position="top">
        <el-form-item label="知识点">
          <el-input v-model="generateTopic" placeholder="例如：贝叶斯分类器" size="large" @keyup.enter="handleTriggerGenerate" />
        </el-form-item>
        <p class="text-xs mb-4" style="color: var(--lt-text-auxiliary);">
          Planner 会根据你的画像自主决策生成哪些资源类型（3-5 类），无需手动选择。
        </p>
      </el-form>
      <template #footer>
        <el-button @click="showGeneratePanel = false">取消</el-button>
        <el-button type="primary" :loading="chat.isGenerating.value" :disabled="!generateTopic.trim()" @click="handleTriggerGenerate">启动生成</el-button>
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
@keyframes spin { to { transform: rotate(360deg); } }

/* 辅导内联渲染 */
.tutoring-inline {
  width: 100%;
}

/* Smart v2 智能模式内联渲染 */
.smart-inline-wrap {
  width: 100%;
}
.smart-text-block {
  font-size: 15px;
  line-height: 1.75;
  color: var(--lt-text-primary, #1f2937);
  margin: 8px 0;
}
.smart-text-block :deep(.markdown-content) {
  font-size: 15px;
  line-height: 1.75;
}
.smart-text-block :deep(.markdown-content p) {
  margin: 10px 0;
}
.smart-visual-block {
  margin: 12px 0;
}
.smart-loading {
  padding: 8px 0;
}

.assistant-message-body :deep(.markdown-viewer) { display: block; }
.assistant-message-body :deep(.markdown-content) { font-size: 15px; line-height: 1.75; }
.assistant-message-body :deep(.markdown-content p) { margin: 10px 0; }
.assistant-message-body :deep(.markdown-content h1),
.assistant-message-body :deep(.markdown-content h2),
.assistant-message-body :deep(.markdown-content h3) { margin-top: 20px; margin-bottom: 10px; }
.assistant-message-body :deep(.markdown-content pre) { margin: 12px 0; }

/* Mode tag */
.mode-tag {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 10px; border-radius: 12px;
  font-size: 11px; font-weight: 500;
  margin-bottom: 8px;
}
.mode-tag--lecture {
  background: rgba(64, 158, 255, 0.12); color: var(--lt-blue);
}
.mode-tag--smart {
  background: rgba(139, 92, 246, 0.12); color: #8b5cf6;
}
.mode-tag--resource {
  background: rgba(103, 194, 58, 0.12); color: var(--lt-green);
}
.mode-tag--plan {
  background: rgba(230, 162, 60, 0.12); color: var(--lt-orange);
}

.ai-action-bar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
  margin-top: 16px; padding-top: 12px;
  border-top: 1px solid var(--lt-border);
  opacity: 0.65; transition: opacity var(--lt-transition-base);
}
.ai-action-bar:hover { opacity: 1; }

.ai-action-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px;
  border: none; background: transparent;
  color: var(--lt-text-auxiliary); cursor: pointer;
  transition: all var(--lt-transition-base);
}
.ai-action-btn:hover {
  background-color: var(--lt-brand-lightest);
  color: var(--lt-brand);
}
.ai-action-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.ai-action-btn.is-liked {
  color: var(--lt-success);
  background-color: rgba(52, 199, 89, 0.08);
}
.ai-action-btn.is-disliked {
  color: var(--lt-danger);
  background-color: rgba(255, 59, 48, 0.08);
}
.ai-action-btn.is-playing {
  color: var(--lt-brand);
  background-color: var(--lt-brand-lightest);
}
.ai-action-btn.is-loading {
  opacity: 0.5;
  pointer-events: none;
}

.ai-action-divider {
  display: inline-block; width: 1px; height: 16px;
  background-color: var(--lt-border); margin: 0 4px;
}

.ai-action-suggestion {
  display: inline-flex; align-items: center;
  padding: 3px 10px; border-radius: 14px;
  border: 1px solid var(--lt-border); background: transparent;
  color: var(--lt-text-secondary); font-size: 12px; cursor: pointer;
  transition: all var(--lt-transition-base);
  white-space: nowrap;
}
.ai-action-suggestion:hover {
  border-color: var(--lt-brand-lighter);
  color: var(--lt-brand);
  background-color: var(--lt-brand-lightest);
}
.ai-action-suggestion.is-primary {
  border-color: var(--lt-brand-lighter);
  color: var(--lt-brand);
  background-color: var(--lt-brand-lightest);
  font-weight: 500;
}
.ai-action-suggestion.is-primary:hover {
  border-color: var(--lt-brand);
  background-color: var(--lt-brand);
  color: #fff;
}

/* Minimap */
.minimap-toggle-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px;
  border: 1px solid var(--lt-border); background: transparent;
  color: var(--lt-text-auxiliary); cursor: pointer;
  transition: all var(--lt-transition-base);
}
.minimap-toggle-btn.is-on {
  border-color: var(--lt-brand-lighter);
  color: var(--lt-brand);
  background-color: var(--lt-brand-lightest);
}
.minimap-toggle-btn:hover {
  border-color: var(--lt-brand-lighter);
  color: var(--lt-brand);
  background-color: var(--lt-brand-lightest);
}

.minimap-wrapper {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  width: 32px;
  overflow: hidden;
  background-color: transparent;
  border-radius: 12px;
  transition:
    width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    background-color 0.3s ease,
    box-shadow 0.3s ease;
}
.minimap-wrapper:hover {
  width: 200px;
  background-color: var(--lt-bg-card);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}
.minimap-hidden { width: 0 !important; }
.minimap-bar {
  width: 200px;
  min-width: 200px;
  max-height: 55vh;
  overflow-y: auto;
  padding: 10px 0;
}
.minimap-item {
  display: flex;
  align-items: center;
  height: 30px;
  padding: 0 12px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.minimap-item:hover { background-color: var(--lt-bg-page); }
.minimap-indicator {
  width: 8px; height: 2px;
  background-color: var(--lt-text-placeholder);
  border-radius: 2px;
  flex-shrink: 0;
  transition: all 0.2s ease;
}
.minimap-item.is-active .minimap-indicator {
  width: 16px;
  background-color: var(--lt-brand);
}
.minimap-text {
  margin-left: 14px;
  font-size: 12px;
  color: var(--lt-text-secondary);
  white-space: nowrap;
  opacity: 0;
  transform: translateX(-8px);
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.minimap-wrapper:hover .minimap-text {
  opacity: 1;
  transform: translateX(0);
  transition-delay: 0.08s;
}
.minimap-item.is-active .minimap-text {
  color: var(--lt-brand-dark);
  font-weight: 600;
}

.message-list-scroll {
  overflow-y: auto;
}
.message-list-scroll::-webkit-scrollbar { width: 4px; }
.message-list-scroll::-webkit-scrollbar-track { background: transparent; }
.message-list-scroll::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.12);
  border-radius: 2px;
  transition: background 0.2s;
}
.message-list-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.25); }
.message-list-scroll { scrollbar-width: thin; scrollbar-color: rgba(0, 0, 0, 0.12) transparent; }

/* Mode switch */
.mode-switch {
  display: inline-flex;
  background-color: var(--lt-bg-page);
  border-radius: 8px;
  padding: 2px;
  border: 1px solid var(--lt-border);
}
.mode-btn {
  padding: 3px 10px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  color: var(--lt-text-auxiliary);
  transition: all 0.15s ease;
  white-space: nowrap;
}
.mode-btn:hover {
  color: var(--lt-text-primary);
}
.mode-btn.is-active {
  background-color: #fff;
  color: var(--lt-brand);
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
.mode-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* --- New Generation Offer Card Styles --- */
.generation-offer-card {
  background: #FFFFFF;
  border: 1px solid var(--lt-border);
  border-radius: 16px;
  padding: 20px;
  margin-top: 12px;
  box-shadow: 0 4px 16px -4px rgba(43, 111, 255, 0.08);
  border-left: 3px solid var(--lt-brand);
}

.offer-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.offer-header-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(43, 111, 255, 0.08);
  color: var(--lt-brand);
}
.offer-header-icon.icon-plan {
  background: rgba(124, 92, 252, 0.1);
  color: var(--lt-ai);
}
.offer-header-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--lt-text-primary);
}

.offer-topic-card {
  background: var(--lt-bg-page);
  border: 1px solid var(--lt-border-light);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
}
.offer-topic-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--lt-brand);
  margin-bottom: 6px;
}
.offer-topic-goal {
  font-size: 13px;
  color: var(--lt-text-secondary);
  line-height: 1.5;
  margin-bottom: 12px;
}
.offer-topic-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.offer-pill {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 20px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
}
.pill-difficulty { background: rgba(43, 111, 255, 0.08); color: var(--lt-brand); }
.pill-count { background: rgba(255, 140, 66, 0.08); color: var(--lt-orange); }
.pill-profile { background: rgba(52, 199, 89, 0.08); color: var(--lt-success); }

.offer-plan-section {
  margin-bottom: 20px;
}
.offer-plan-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--lt-text-auxiliary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
  padding-left: 4px;
}
.offer-plan-timeline {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.offer-plan-item {
  display: flex;
  gap: 12px;
  position: relative;
  /* 优化-start: 增加圆角、内边距和过渡效果 */
  border-radius: 8px;
  padding: 8px;
  transition: all 0.2s ease-out;
  /* 优化-end */
}
.offer-plan-item:hover {
  /* 优化-start: 增加悬浮样式 */
  background-color: var(--lt-bg-page);
  transform: translateX(4px);
  /* 优化-end */
}
.offer-plan-item::before {
  content: '';
  position: absolute;
  left: 17px;
  top: 18px;
  /* 优化-start: 修复伪元素高度计算，确保连接线不断裂 */
  height: calc(100% - 10px);
  /* 优化-end */
  width: 2px;
  background-color: var(--lt-bg-page);
}
.offer-plan-item:last-child::before {
  display: none;
}
.offer-plan-dot-wrapper {
  /* 优化-start: 增加一个wrapper来垂直居中 */
  flex-shrink: 0;
  padding-top: 5px; /* 微调 */
  /* 优化-end */
}
.offer-plan-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  z-index: 1;
  border: 2px solid #fff;
}
.offer-plan-content {
  flex: 1;
}
.offer-plan-type {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--lt-text-primary);
  margin-bottom: 2px;
}
.offer-plan-type-count {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  background: var(--lt-bg-page);
  padding: 1px 6px;
  border-radius: 8px;
}
.offer-plan-focus {
  font-size: 13px;
  color: var(--lt-text-secondary);
  line-height: 1.45;
}

.offer-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  /* 优化-start: 增加背景、调整边距和圆角，强化区域感 */
  margin: 8px -20px -20px -20px;
  padding: 16px 20px;
  background-color: var(--lt-bg-page);
  border-top: 1px solid var(--lt-border-light);
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
  /* 优化-end */
}
.offer-btn-primary, .offer-btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  padding: 9px 18px;
  border-radius: 10px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}
.offer-btn-primary {
  background: var(--lt-brand);
  color: #fff;
  border-color: var(--lt-brand);
}
.offer-btn-primary:hover {
  background: var(--lt-brand-dark);
  border-color: var(--lt-brand-dark);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(43, 111, 255, 0.25);
}
.offer-btn-ghost {
  background: transparent;
  color: var(--lt-text-secondary);
  border-color: var(--lt-border);
}
.offer-btn-ghost:hover {
  color: var(--lt-text-primary);
  background: var(--lt-bg-page);
  border-color: var(--lt-border-dark);
}

/* 已确认状态：卡片降级展示，保留方案内容供对照 */
.generation-offer-card.is-accepted {
  opacity: 0.72;
  border-left-color: var(--lt-success);
  box-shadow: none;
}
.offer-actions-done {
  justify-content: flex-start;
}
.offer-done-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--lt-success);
}

/* Video Lecture Button - Premium Design */
.video-lecture-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1.5px solid var(--lt-ai-light-3);
  border-radius: 10px;
  background: 
    linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%),
    linear-gradient(145deg, #F8F5FF 0%, #EDE5FF 100%);
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.8),
    0 1px 3px rgba(124, 92, 252, 0.1);
  color: var(--lt-ai);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}
.video-lecture-btn .btn-shine {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    135deg,
    transparent 40%,
    rgba(255, 255, 255, 0.4) 50%,
    transparent 60%
  );
  opacity: 0;
  transform: rotate(30deg);
  transition: opacity 0.3s ease;
}
.video-lecture-btn .btn-icon {
  position: relative;
  z-index: 1;
  transition: transform 0.2s ease;
}
.video-lecture-btn:hover {
  background: 
    linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%),
    linear-gradient(145deg, #F0EAFF 0%, #E5DAFF 100%);
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 2px 4px rgba(124, 92, 252, 0.12),
    0 4px 12px rgba(124, 92, 252, 0.08);
  transform: translateY(-1px);
}
.video-lecture-btn:hover .btn-shine {
  opacity: 1;
  animation: shine 0.6s ease forwards;
}
.video-lecture-btn:hover .btn-icon {
  transform: scale(1.08);
}
.video-lecture-btn:active {
  transform: translateY(0);
  box-shadow: 
    inset 0 1px 2px rgba(0, 0, 0, 0.1),
    0 1px 2px rgba(124, 92, 252, 0.1);
  transition-duration: 0.1s;
}
.video-lecture-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.5),
    0 1px 2px rgba(124, 92, 252, 0.04);
}
/* Active State */
.video-lecture-btn.is-active {
  border-color: var(--lt-ai);
  background: 
    linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 40%),
    linear-gradient(145deg, var(--lt-ai) 0%, var(--lt-ai-light-3) 100%);
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 2px 8px rgba(124, 92, 252, 0.25),
    0 4px 16px rgba(124, 92, 252, 0.15);
  color: #fff;
}
.video-lecture-btn.is-active:hover {
  border-color: var(--lt-ai-dark-2);
  background: 
    linear-gradient(135deg, rgba(255,255,255,0.25) 0%, transparent 40%),
    linear-gradient(145deg, var(--lt-ai-dark-2) 0%, var(--lt-ai) 100%);
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    0 4px 12px rgba(124, 92, 252, 0.3),
    0 8px 24px rgba(124, 92, 252, 0.18);
}
/* Loading State */
.video-lecture-btn.is-loading {
  pointer-events: none;
}
.video-lecture-btn.is-loading .btn-icon {
  animation: pulse-icon 1.5s ease-in-out infinite;
}
@keyframes shine {
  0% { transform: rotate(30deg) translateX(-100%); }
  100% { transform: rotate(30deg) translateX(100%); }
}
@keyframes pulse-icon {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.95); }
}

/* Video Button Transition */
.video-btn-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.video-btn-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.video-btn-enter-from {
  opacity: 0;
  transform: translateX(-8px) scale(0.85);
  filter: blur(2px);
}
.video-btn-leave-to {
  opacity: 0;
  transform: translateX(-8px) scale(0.85);
  filter: blur(2px);
}

/* Message textarea */
.message-textarea-wrap {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--el-input-border-color, var(--lt-border));
  border-radius: var(--el-input-border-radius, 8px);
  background: var(--el-input-bg-color, var(--lt-bg-card));
  transition: border-color 0.15s, box-shadow 0.15s;
}
.message-textarea-wrap:focus-within {
  border-color: var(--el-input-focus-border-color, var(--lt-brand));
  box-shadow: 0 0 0 1px var(--el-input-focus-border-color, var(--lt-brand)) inset;
}
.message-textarea {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  font-family: inherit;
  color: var(--lt-text-primary);
  resize: none;
  line-height: 1.5;
  padding: 10px 12px;
  min-height: 22px;
  max-height: 168px;
}
.message-textarea::placeholder {
  color: var(--lt-text-placeholder);
}
.message-textarea:disabled {
  cursor: not-allowed;
}

/* File chips inside textarea container (thin inline row) */
.file-chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 10px 0;
}
.file-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 4px 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 1.5;
  background: var(--lt-bg-page);
  border: 1px solid var(--lt-border-light);
  color: var(--lt-text-secondary);
}
.file-chip.is-image {
  background: rgba(43, 111, 255, 0.05);
  border-color: var(--lt-brand-light-7);
}
.file-chip svg {
  flex-shrink: 0;
  color: var(--lt-text-auxiliary);
}
.file-chip.is-image svg {
  color: var(--lt-brand);
}
.file-chip-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-chip-ext { flex-shrink: 0; padding: 0 4px; border-radius: 3px; background: var(--lt-brand-lightest); color: var(--lt-brand); font-size: 10px; font-weight: 600; letter-spacing: 0.3px; }
.file-chip-size { flex-shrink: 0; color: var(--lt-text-placeholder); font-size: 10px; }
.file-chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: none;
  background: transparent;
  color: var(--lt-text-placeholder);
  cursor: pointer;
  border-radius: 3px;
  flex-shrink: 0;
  padding: 0;
}
.file-chip-remove:hover {
  color: var(--lt-danger);
  background: rgba(255,59,48,0.1);
}

/* ===== File Upload ===== */
.upload-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: 8px;
  border: 1px solid var(--lt-border); background: transparent;
  color: var(--lt-text-auxiliary); cursor: pointer;
  transition: all var(--lt-transition-base); flex-shrink: 0;
}
.upload-btn:hover {
  border-color: var(--lt-brand-lighter);
  color: var(--lt-brand);
  background-color: var(--lt-brand-lightest);
}
.upload-btn:disabled {
  opacity: 0.4; cursor: not-allowed;
}
.upload-spinner {
  display: inline-block; width: 14px; height: 14px;
  border: 2px solid var(--lt-border);
  border-top-color: var(--lt-brand);
  border-radius: 50%;
  animation: file-upload-spin 0.6s linear infinite;
}
@keyframes file-upload-spin {
  to { transform: rotate(360deg); }
}



/* User message file attachments */
.user-files-row {
  display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;
  padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.2);
}
.user-file-chip {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 2px 6px; border-radius: 4px;
  font-size: 11px; line-height: 1.3;
  background: rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.9); max-width: 160px;
}
.user-file-chip.is-image {
  background: rgba(255,255,255,0.2);
}
.ufc-icon { display: flex; flex-shrink: 0; opacity: 0.8; }
.ufc-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ufc-ext { flex-shrink: 0; padding: 0 4px; border-radius: 3px; background: rgba(255,255,255,0.22); color: rgba(255,255,255,0.95); font-size: 10px; font-weight: 600; letter-spacing: 0.3px; }
.ufc-size { flex-shrink: 0; color: rgba(255,255,255,0.7); font-size: 10px; }
</style>
