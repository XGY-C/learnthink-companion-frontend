<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount, computed, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { useChatSSE } from '@/composables/useChatSSE'
import type { ChatMessage, Suggestion } from '@/composables/useChatSSE'
import { createTtsPlayer, type TtsSentenceState } from '@/utils/ttsSentence'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import ThoughtChainTimeline from '@/components/ThoughtChainTimeline.vue'
import LottieAnimation from '@/components/LottieAnimation.vue'
import liveChatbotLottie from '@/assets/lottie/live-chatbot.json'
import GenerationCard from '@/components/GenerationCard.vue'
import PlanOfferCard from '@/components/PlanOfferCard.vue'
import PlanEditor from '@/components/PlanEditor.vue'
import BottomSheet from '@/components/mobile/BottomSheet.vue'
import ProfileSheet from '@/components/mobile/ProfileSheet.vue'
import AnalysisBar from '@/components/tutoring/AnalysisBar.vue'
import AnswerContainer from '@/components/tutoring/AnswerContainer.vue'
import ClarificationCard from '@/components/tutoring/ClarificationCard.vue'
import GuidedDialogue from '@/components/tutoring/GuidedDialogue.vue'
import SmartVisualRenderer from '@/components/smart/SmartVisualRenderer.vue'
import DirectAnswerInline from '@/components/tutoring/DirectAnswerInline.vue'
import TutoringInput from '@/components/tutoring/TutoringInput.vue'
import VideoRecordCard from '@/components/video/VideoRecordCard.vue'
import { useVideoLectureStore } from '@/stores/videoLecture'
import type { TutoringMode } from '@/types/tutoring'
import { hapticLight } from '@/utils/haptics'

const router = useRouter()
const chat = useChatSSE()
const videoStore = useVideoLectureStore()

/** Mode options for mobile — simplified */
const modes = [
  { value: 'chat' as const, label: '💬 对话' },
  { value: 'lecture' as const, label: '📖 辅导' },
  { value: 'resource' as const, label: '📝 资源' },
  { value: 'plan' as const, label: '🗺 规划' },
]

function modeLabel(mode: string): string {
  switch (mode) {
    case 'lecture': return '辅导模式'
    case 'smart': return '智能辅导'
    case 'resource': return '资源生成'
    case 'plan': return '学习方案'
    default: return mode
  }
}

const tutoringActiveMessage = computed<ChatMessage | null>(() => {
  const msgs = chat.activeSession.value?.messages ?? []
  return [...msgs].reverse().find(m => m.role === 'assistant' && m._tutoring?.completed) || null
})

const tutoringVisibleAnalysis = computed(() => tutoringActiveMessage.value?._tutoring?.snapshot?.analysis ?? null)
const tutoringVisibleSections = computed(() => tutoringActiveMessage.value?._tutoring?.snapshot?.sections ?? null)
const tutoringVisibleThoughtSteps = computed(() => {
  const msg = tutoringActiveMessage.value
  if (msg?._tutoring?.completed) {
    return (msg._tutoring.snapshot?.reactThoughts ?? []).map((t, index) => ({
      label: `ReAct 第 ${t.iteration || index + 1} 轮`,
      icon: 'thought',
      done: true,
      phase: 'DECISION' as const,
      detail: `Action: ${t.action}`,
      thought: t.thought,
    }))
  }
  return msg?.thinking?.steps ?? []
})

// ===== Session drawer =====
const showSessions = ref(false)

// ===== Profile drawer =====
const showProfile = ref(false)

// ===== Generate sheet =====
const showGenerateSheet = ref(false)
const generateTopic = ref('')

// ===== Input =====
const inputMessage = ref('')
const messageListRef = ref<HTMLElement | null>(null)
const chatContainerRef = ref<HTMLElement | null>(null)
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

function scrollToBottom() {
  nextTick(() => {
    const el = messageListRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function handleSendMessage() {
  const text = inputMessage.value.trim()
  if ((!text && chat.pendingFiles.value.length === 0) || chat.isStreaming.value) return
  if (chat.isTutoringActive.value) return
  hapticLight()
  if (chat.isSmartActive.value) {
    inputMessage.value = ''
    chat.sendSmartAnswer(text)
    scrollToBottom()
    return
  }
  inputMessage.value = ''
  chat.sendMessage(text)
}

// ===== Suggestion handlers =====
function handleSuggestionClick(suggestion: Suggestion, msg: ChatMessage) {
  if (suggestion.sendAs.startsWith('__generate_plan__:')) {
    const topic = suggestion.sendAs.slice('__generate_plan__:'.length)
    msg.suggestions = undefined
    chat.confirmPlanGeneration(topic, '')
  } else if (suggestion.sendAs.startsWith('__generate__:')) {
    const topic = suggestion.sendAs.slice('__generate__:'.length)
    msg.suggestions = undefined
    chat.confirmGeneration(topic)
  } else if (suggestion.sendAs.startsWith('/studio')) {
    msg.suggestions = undefined
    router.push(suggestion.sendAs)
  } else if (suggestion.sendAs) {
    msg.suggestions = undefined
    chat.sendMessage(suggestion.sendAs)
  } else {
    msg.suggestions = undefined
    msg.text = (msg.text || '') + '\n\n_（已了解，随时可以说「生成」来启动）_'
  }
}

async function handleGenerate() {
  const topic = generateTopic.value.trim()
  if (!topic) { ElMessage.warning('请输入知识点'); return }
  try {
    await chat.triggerGenerate(topic)
    generateTopic.value = ''
    showGenerateSheet.value = false
  } catch (err: any) {
    ElMessage.warning(err.message || '生成失败')
  }
}

// ===== Computed placeholder =====
const inputPlaceholder = computed(() => {
  if (chat.isSmartActive.value) return '继续对话，回答 AI 老师的问题...'
  if (chat.chatMode.value === 'resource') return '描述你想生成的资料内容...'
  if (chat.chatMode.value === 'plan') return '聊聊你的学习目标和基础...'
  return '聊聊你的学习情况...'
})

// ===== Action bar =====
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
  const newFeedback: 'liked' | undefined = msg.feedback === 'liked' ? undefined : 'liked'
  msg.feedback = newFeedback
  msg._feedback = newFeedback
  if (msg.messageId) {
    try {
      await fetch(import.meta.env.VITE_API_BASE + `/chat/messages/${msg.messageId}/feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ feedback: newFeedback }),
      })
    } catch { /* non-blocking */ }
  }
}
async function toggleDislike(msg: ChatMessage) {
  const newFeedback: 'disliked' | undefined = msg.feedback === 'disliked' ? undefined : 'disliked'
  msg.feedback = newFeedback
  msg._feedback = newFeedback
  if (msg.messageId) {
    try {
      await fetch(import.meta.env.VITE_API_BASE + `/chat/messages/${msg.messageId}/feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ feedback: newFeedback }),
      })
    } catch { /* non-blocking */ }
  }
}
async function shareMessage(msg: ChatMessage) {
  try {
    await navigator.clipboard.writeText(msg.text)
    ElMessage.success('内容已复制，可粘贴分享')
  } catch { ElMessage.error('分享失败') }
}

// ===== TTS — sentence-by-sentence streaming =====
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
  if (audioState.playingMsgIdx === idx) { stopAudio(); return }
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

// ===== Tutoring handlers =====
const tutoringVisibleStatus = computed(() => {
  const msg = tutoringActiveMessage.value
  if (msg?.role === 'assistant' && msg._tutoring?.completed) return 'done'
  return chat.tutoringStore.status
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
  if (question) chat.sendTutoringMessage(question)
}

function handleTutoringInputSend(text: string, mode: TutoringMode, isVideo: boolean) {
  if (chat.isStreaming.value || chat.isTutoringActive.value) return
  if (chat.isSmartActive.value) {
    chat.sendSmartAnswer(text); scrollToBottom(); return
  }
  if (isVideo) chat.sendLectureMessage(text)
  else chat.sendTutoringMessage(text, mode)
  scrollToBottom()
}

function handleVideoReplay() {
  const card = videoStore.lastRecord
  if (card) videoStore.replayFromCard(card)
}

async function handleNewSession() {
  inputMessage.value = ''
  await chat.createSession()
  showSessions.value = false
}

async function handleDeleteSession(sessionId: string) {
  if (chat.sessions.value.length <= 1) { ElMessage.info('至少保留一个会话'); return }
  if (!window.confirm('确定删除该会话？')) return
  await chat.deleteSession(sessionId)
  ElMessage.success('会话已删除')
}

// ===== Init =====
onMounted(() => {
  chat.setCallbacks({
    onStreamChunk: () => { scrollToBottom() },
    onGenerationOffer: () => { scrollToBottom() },
  })
  chat.initChat()
})

// ===== SSE reconnection for mobile =====
let cleanupReconnect: (() => void) | null = null

// ===== visualViewport keyboard handling (iOS) =====
let prevViewportHeight = 0

function handleViewportResize() {
  const vv = window.visualViewport
  if (!vv || !chatContainerRef.value) return
  const isKeyboardOpen = vv.height < prevViewportHeight - 100
  const isKeyboardClosed = vv.height > prevViewportHeight + 100
  prevViewportHeight = vv.height
  if (isKeyboardOpen) {
    // 键盘弹出时，设置容器高度为可视区域高度，确保输入框不被遮挡
    chatContainerRef.value.style.height = vv.height + 'px'
    setTimeout(() => {
      const inputEl = messageListRef.value
      if (inputEl) inputEl.scrollTop = inputEl.scrollHeight
    }, 300)
  } else if (isKeyboardClosed) {
    // 键盘收起时，恢复容器高度
    chatContainerRef.value.style.height = ''
  }
}

onMounted(() => {
  cleanupReconnect = chat.setupMobileReconnection()
  prevViewportHeight = window.visualViewport?.height || window.innerHeight
  window.visualViewport?.addEventListener('resize', handleViewportResize)
})
onBeforeUnmount(() => {
  chat.fireEndSessionOnLeave()
  window.removeEventListener('beforeunload', onBeforeUnload)
  if (cleanupReconnect) cleanupReconnect()
  window.visualViewport?.removeEventListener('resize', handleViewportResize)
})

function onBeforeUnload() {
  chat.fireEndSessionOnLeave()
}
window.addEventListener('beforeunload', onBeforeUnload)
</script>

<template>
  <div class="mobile-chat" ref="chatContainerRef">
    <!-- ===== 会话标题栏 ===== -->
    <div class="mobile-chat-header">
      <button class="mobile-chat-header-btn" aria-label="会话列表" @click="showSessions = true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <div class="mobile-chat-header-info" @click="showSessions = true">
        <h2 class="mobile-chat-title">{{ chat.activeSession.value?.title || 'AI 学习助手' }}</h2>
      </div>
      <div class="mobile-header-actions">
        <button class="mobile-chat-header-btn" aria-label="学习画像" @click="showProfile = true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      </button>
      </div>
    </div>
    <!-- ===== 模式选择行 ===== -->
    <div class="mobile-mode-row">
      <button
        v-for="m in modes" :key="m.value"
        class="mobile-mode-btn"
        :class="{ 'is-active': chat.chatMode.value === m.value }"
        :disabled="chat.isStreaming.value || chat.isTutoringActive.value"
        @click="chat.chatMode.value = m.value"
      >
        {{ m.label }}
      </button>
      <button class="mobile-studio-link" @click="router.push('/studio')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        工作室
      </button>
    </div>

    <!-- ===== 消息列表 ===== -->
    <div ref="messageListRef" class="mobile-chat-messages">
      <div v-if="chat.showWelcomePage.value" class="mobile-welcome">
        <div class="mobile-welcome-avatar">
          <LottieAnimation :animationData="liveChatbotLottie" width="100%" height="100%" />
        </div>
        <h2 class="mobile-welcome-title">Hi，我是你的 AI 学习助手</h2>
        <p class="mobile-welcome-desc">在学习对话中我会逐渐了解你的情况，为你定制个性化学习体验</p>
        <div class="mobile-welcome-suggestions">
          <button class="mobile-welcome-suggestion" @click="chat.sendMessage('我是计算机大三，在学人工智能导论')">
            我是计算机大三，在学AI导论
          </button>
          <button class="mobile-welcome-suggestion" @click="chat.sendMessage('我概率基础还行但贝叶斯公式不太懂')">
            概率还行，贝叶斯不太懂
          </button>
          <button class="mobile-welcome-suggestion" @click="chat.sendMessage('我每天能学60分钟，目标是期末考到85分')">
            每天60分钟，目标85分
          </button>
        </div>
      </div>

      <div v-else class="mobile-msg-list">
        <div
          v-for="(msg, idx) in chat.activeSession.value?.messages ?? []"
          :key="idx"
          class="mobile-msg-item"
          :class="msg.role === 'user' ? 'is-user' : 'is-assistant'"
        >
          <!-- AI 消息 -->
          <template v-if="msg.role === 'assistant'">
            <!-- 辅导模式标签 -->
            <div v-if="msg.mode && msg.mode !== 'chat'" class="mobile-mode-tag" :class="`mobile-mode-tag--${msg.mode}`">
              {{ modeLabel(msg.mode) }}
            </div>

            <!-- ═══ 图文辅导内联渲染（活跃中或已完成）═══ -->
            <div v-if="(idx === chat.activeTutoringMsgIdx.value && chat.tutoringStore.status !== 'idle') || msg._tutoring?.completed" class="mobile-tutoring-inline">
              <ThoughtChainTimeline
                :steps="tutoringVisibleThoughtSteps"
                :is-streaming="tutoringVisibleStatus === 'planning'"
                :expanded="msg._tutoring?.snapshot?.expanded ?? false"
                @update:expanded="msg._tutoring!.snapshot!.expanded = $event"
                class="mobile-thinking-detail"
              />
              <ClarificationCard
                v-if="chat.tutoringStore.status === 'clarifying' && chat.tutoringStore.clarification"
                :clarification="chat.tutoringStore.clarification"
                :clarifyWaitSeconds="chat.tutoringStore.clarifyWaitSeconds"
                :round="chat.tutoringRound.value"
                @submit="handleClarifySubmit"
              />
              <AnalysisBar v-if="tutoringVisibleAnalysis && ['preparing','generating','done','guided'].includes(tutoringVisibleStatus)" :analysis="tutoringVisibleAnalysis" class="mb-3" />
              <div v-if="chat.tutoringStore.status === 'preparing'" class="mobile-tutoring-status"><p>正在准备资料...</p></div>
              <GuidedDialogue
                v-if="chat.isTutoringActive.value && (chat.tutoringStore.status === 'guided' || chat.tutoringStore.guidedSteps.length > 0)"
                :inline-submit="chat.submitGuidedAnswerInline"
              />
              <GuidedDialogue
                v-else-if="msg._tutoring?.completed && msg._tutoring?.subMode === 'guided' && msg._tutoring?.snapshot?.guidedSteps"
                :snapshot="msg._tutoring.snapshot"
              />
              <AnswerContainer
                v-if="(chat.tutoringStore.sectionList.length > 0 || tutoringVisibleSections)"
                :sections="tutoringVisibleSections || undefined"
                :read-only="!!tutoringVisibleSections"
                @action="handleSectionAction"
              />
              <div v-if="chat.tutoringStore.status === 'error'" class="mobile-tutoring-error">
                <div style="font-size: 24px; margin-bottom: 4px;">⚠️</div>
                <p>{{ chat.tutoringStore.error?.message || '出错了' }}</p>
                <button v-if="chat.tutoringStore.error?.retryable" class="mobile-tutoring-retry-btn" @click="handleTutoringRetry">重试</button>
              </div>
            </div>

            <!-- ═══ DirectAnswer 内联渲染 ═══ -->
            <div v-if="(idx === chat.activeDirectAnswerMsgIdx.value && chat.directAnswerStore.status !== 'idle') || msg._directAnswer?.completed" class="mobile-da-inline">
              <DirectAnswerInline
                :store="chat.directAnswerStore"
                :is-completed="!!msg._directAnswer?.completed"
                :snapshot="msg._directAnswer?.snapshot"
              />
            </div>

            <!-- ═══ Smart v2 智能模式内联渲染 ═══ -->
            <div v-if="msg._smart && (msg._smart.active || msg._smart.completed)" class="mobile-smart-inline">
              <ThoughtChainTimeline
                v-if="msg._smart.thinkingSteps.length > 0"
                :steps="msg._smart.thinkingSteps"
                :is-streaming="msg.isStreaming"
                :expanded="msg._smart.thinkingExpanded || false"
                @update:expanded="msg._smart!.thinkingExpanded = $event"
                class="mb-3"
              />
              <template v-for="(block, bi) in msg._smart.blocks" :key="bi">
                <div v-if="block.type === 'text'" class="mobile-smart-text">
                  <MarkdownViewer :content="block.content" :showToc="false" />
                </div>
                <div v-else-if="block.type === 'visual'" class="mobile-smart-visual">
                  <SmartVisualRenderer
                    :render-type="block.renderType"
                    :code="block.code"
                    :description="block.description"
                    :status="block.status"
                  />
                </div>
              </template>
              <div v-if="msg.isStreaming && msg.text" class="mobile-smart-text">
                <pre class="mobile-streaming-text">{{ msg.text }}<span class="mobile-cursor" /></pre>
              </div>
              <div v-if="msg.isStreaming && !msg.text && msg._smart.blocks.length === 0" class="mobile-smart-loading">
                <span class="mobile-cursor" />
              </div>
            </div>

            <ThoughtChainTimeline
              v-if="msg.thinking && !msg._tutoring?.completed && !msg._smart?.completed"
              :steps="msg.thinking.steps"
              :is-streaming="msg.isStreaming"
              :expanded="msg.thinking.expanded || false"
              @update:expanded="msg.thinking.expanded = $event"
            />

            <!-- 消息正文 -->
            <div v-if="!(msg as any)._generationCard && !(msg as any)._videoRecord && !(msg as any)._directAnswer && !(msg as any)._smart && !(idx === chat.activeTutoringMsgIdx.value && chat.tutoringStore.status !== 'idle') && !(msg.role === 'assistant' && msg._tutoring?.completed)" class="mobile-msg-bubble">
              <MarkdownViewer v-if="!msg.isStreaming" :content="msg.text" :showToc="false" />
              <pre v-else class="mobile-streaming-text">{{ msg.text }}<span class="mobile-cursor" /></pre>
            </div>

            <!-- 生成卡片 -->
            <template v-if="(msg as any)._generationCard">
              <div class="mobile-msg-bubble">
                <p class="mobile-msg-text">{{ msg.text }}</p>
              </div>
              <GenerationCard
                v-bind="chat.taskCards.value[(msg as any)._generationCard.taskId] || (msg as any)._generationCard"
                class="mobile-gen-card"
              />
            </template>

            <!-- 视频讲解记录卡片 -->
            <div v-if="(msg as any)._videoRecord" class="mobile-video-record-wrapper">
              <VideoRecordCard
                :topic="(msg as any)._videoRecord.topic"
                :scene-count="(msg as any)._videoRecord.sceneCount"
                :completed="(msg as any)._videoRecord.completed"
                @replay="handleVideoReplay"
              />
            </div>

            <!-- 方案确认卡片 — 资源类型 -->
            <PlanOfferCard
              v-if="msg._planOffer && msg._planOffer.type === 'resource' && !msg._planOffer.dismissed"
              :offer="msg._planOffer!"
              compact
              :loading="chat.isGenerating.value"
              @confirm="chat.acceptGenerationOffer(msg)"
              @dismiss="chat.dismissGenerationOffer()"
              class="mobile-plan-offer"
            />

            <!-- 可编辑计划编辑器 — 计划类型（已确认的方案不消失，但禁用编辑） -->
            <!-- v3.1: 支持 _pendingPlan（DB 加载）和 _planOffer（实时流）两种数据源 -->
            <PlanEditor
              v-if="(msg._planOffer && msg._planOffer.type === 'plan' && !msg._planOffer.dismissed) || (msg as any)._pendingPlan"
              :modules="((msg as any)._pendingPlan?.modules?.length ? (msg as any)._pendingPlan.modules : (chat.planPreviewData.value?.modules || []))"
              :edges="((msg as any)._pendingPlan?.edges?.length ? (msg as any)._pendingPlan.edges : (chat.planPreviewData.value?.edges || []))"
              :loading="chat.planPreviewLoading.value && !(msg as any)._pendingPlan"
              :confirmed="!!(msg._planOffer?.confirmed || (msg as any)._pendingPlan?.confirmed)"
              :on-save="(planJson: string) => chat.updatePlanDraft(planJson)"
              @confirm="(planJson: string) => chat.confirmEditedPlan(planJson, msg._planOffer?.requirementText || '', msg._planOffer?.launchTopic || '学习计划')"
              @cancel="chat.dismissPlanOffer()"
            />

            <!-- Action Bar -->
            <div v-if="!(msg as any)._videoRecord && !(idx === chat.activeTutoringMsgIdx.value && chat.tutoringStore.status !== 'idle')" class="mobile-action-bar">
              <button class="mobile-action-btn" title="复制" aria-label="复制" @click="copyMessage(msg)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
              <button class="mobile-action-btn" title="重新生成" aria-label="重新生成" :disabled="chat.isStreaming.value" @click="regenerateMessage(msg, idx)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              </button>
              <button class="mobile-action-btn" :class="{ 'is-liked': msg.feedback === 'liked' || msg._feedback === 'liked' }" title="喜欢" aria-label="喜欢" @click="toggleLike(msg)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
              </button>
              <button class="mobile-action-btn" :class="{ 'is-disliked': msg.feedback === 'disliked' || msg._feedback === 'disliked' }" title="不喜欢" aria-label="不喜欢" @click="toggleDislike(msg)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 2h3a2 2 0 0 0 2 2v7a2 2 0 0 1-2 2h-3"/></svg>
              </button>
              <button class="mobile-action-btn" title="分享" aria-label="分享" @click="shareMessage(msg)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              </button>
              <button
                class="mobile-action-btn"
                :class="{ 'is-playing': audioState.playingMsgIdx === idx, 'is-loading': audioState.loading && audioState.playingMsgIdx === idx }"
                :disabled="audioState.loading && audioState.playingMsgIdx === idx"
                title="朗读"
                aria-label="朗读"
                @click="toggleAudio(msg, idx)"
              >
                <svg v-if="audioState.playingMsgIdx === idx" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              </button>
            </div>

            <!-- 建议按钮 -->
            <div v-if="msg.suggestions && msg.suggestions.length > 0" class="mobile-suggestions">
              <button
                v-for="(sug, si) in msg.suggestions"
                :key="si"
                class="mobile-suggestion-btn"
                :class="{ primary: msg.suggestionStyle === 'primary' }"
                @click="handleSuggestionClick(sug, msg)"
              >{{ sug.text }}</button>
            </div>
          </template>

          <!-- 用户消息 -->
          <template v-else>
            <div class="mobile-user-wrap">
              <div class="mobile-user-bubble">
                <div>{{ msg.text }}</div>
                <div v-if="msg._files && msg._files.length > 0" class="mobile-user-files-row">
                <div v-for="(f, fi) in msg._files" :key="fi" class="mobile-user-file-chip">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  {{ f.fileName.length > 15 ? f.fileName.slice(0, 13) + '…' : f.fileName }}
                </div>
              </div>
            </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- ===== 输入区域 ===== -->
    <div class="mobile-chat-input" :style="{ paddingBottom: 'var(--mobile-safe-area-inset-bottom, 0px)' }">
      <!-- 辅导模式：集成式输入 -->
      <TutoringInput
        v-if="chat.chatMode.value === 'lecture'"
        :disabled="chat.isStreaming.value || chat.isTutoringActive.value || chat.isGenerating.value"
        :placeholder="'输入你的问题，获取 AI 辅导解答...'"
        @send="handleTutoringInputSend"
      />
      <!-- 其他模式：简化的输入框 -->
      <template v-else>
        <div v-if="chat.pendingFiles.value.length > 0" class="mobile-file-chips-row">
          <div v-for="(f, fi) in chat.pendingFiles.value" :key="fi" class="mobile-file-chip" :class="{ 'is-image': f.isImage }">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span class="mobile-file-chip-name">{{ f.fileName.length > 15 ? f.fileName.slice(0, 13) + '…' : f.fileName }}</span>
            <button class="mobile-file-chip-remove" @click="chat.removePendingFile(f.fileUrl)">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div class="mobile-input-inner">
          <button
            class="mobile-upload-btn"
            :disabled="chat.isStreaming.value || isUploading"
            @click="fileInputRef?.click()"
          >
            <svg v-if="!isUploading" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5.5498 9.75V5H6.9502V9.75C6.9502 10.3299 7.4201 10.7998 8 10.7998C8.5799 10.7998 9.0498 10.3299 9.0498 9.75V4.5C9.0498 2.9536 7.7964 1.7002 6.25 1.7002C4.7036 1.7002 3.4502 2.9536 3.4502 4.5V9.75C3.4502 12.2629 5.4871 14.2998 8 14.2998C10.5129 14.2998 12.5498 12.2629 12.5498 9.75V4H13.9502V9.75C13.9502 13.0361 11.2861 15.7002 8 15.7002C4.71391 15.7002 2.0498 13.0361 2.0498 9.75V4.5C2.04981 2.1804 3.9304 0.299806 6.25 0.299805C8.5696 0.299805 10.4502 2.1804 10.4502 4.5V9.75C10.4502 11.1031 9.3531 12.2002 8 12.2002C6.6469 12.2002 5.5498 11.1031 5.5498 9.75Z" fill="currentColor"></path>
            </svg>
            <span v-else class="mobile-upload-spinner"></span>
          </button>
          <input ref="fileInputRef" type="file" multiple :accept="ACCEPTED_TYPES" style="display:none" @change="handleFileSelect" />
          <input
            v-model="inputMessage"
            class="mobile-input-field"
            :placeholder="inputPlaceholder"
            :disabled="chat.isStreaming.value"
            autocomplete="off"
            @keyup.enter="handleSendMessage"
          />
          <button
            class="mobile-send-btn"
            :class="{ active: inputMessage.trim() && !chat.isStreaming.value }"
            :disabled="(!inputMessage.trim() || chat.isStreaming.value) && chat.pendingFiles.value.length === 0"
            @click="handleSendMessage"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </template>
    </div>

    <!-- ===== 会话列表 BottomSheet ===== -->
    <BottomSheet
      v-model="showSessions"
      height="large"
      title="会话列表"
      :show-close="true"
    >
      <div class="mobile-session-list">
        <button class="mobile-new-session-btn" @click="handleNewSession">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          新建会话
        </button>
        <div
          v-for="sess in chat.courseSessions.value"
          :key="sess.id"
          class="mobile-session-item"
          :class="{ active: sess.id === chat.activeSessionId.value }"
          @click="chat.switchSession(sess.id); showSessions = false"
        >
          <div class="mobile-session-title-row">
            <div class="mobile-session-title">
              <span v-if="sess.type === 'lecture'" class="flex-shrink-0">📖</span>
              <span v-else-if="sess.type === 'resource'" class="flex-shrink-0">📝</span>
              <span v-else-if="sess.type === 'plan'" class="flex-shrink-0">🗺</span>
              <span v-else class="flex-shrink-0">💬</span>
              {{ sess.title }}
            </div>
            <button class="mobile-session-delete" @click.stop="handleDeleteSession(sess.id)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
          <div class="mobile-session-meta">{{ sess.lastMessagePreview || (sess.messageCount ? sess.messageCount + ' 条消息' : '') }} · {{ chat.formatSessionTime(sess.updatedAt) }}</div>
        </div>
      </div>
    </BottomSheet>

    <!-- ===== 画像面板 ProfileSheet ===== -->
    <ProfileSheet v-model="showProfile" />

    <!-- ===== 生成资源 BottomSheet ===== -->
    <BottomSheet
      v-model="showGenerateSheet"
      height="medium"
      title="生成个性化资源包"
      :show-close="true"
    >
      <div class="mobile-gen-sheet">
        <input
          v-model="generateTopic"
          class="mobile-gen-input"
          placeholder="例如：贝叶斯分类器"
          @keyup.enter="handleGenerate"
        />
        <p class="mobile-gen-hint">Planner 会根据你的画像自主决策生成哪些资源类型（3-5 类）</p>
        <button
          class="mobile-gen-submit"
          :disabled="!generateTopic.trim() || chat.isGenerating.value"
          @click="handleGenerate"
        >
          {{ chat.isGenerating.value ? '生成中...' : '启动生成' }}
        </button>
      </div>
    </BottomSheet>
  </div>
</template>

<style scoped>
.mobile-chat {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background-color: var(--lt-bg-page);
  position: relative;
}

/* ===== 顶部标题栏 ===== */
.mobile-chat-header {
  display: flex;
  align-items: center;
  padding: 4px;
  background: var(--lt-bg-card);
  border-bottom: 0.5px solid var(--lt-border);
  flex-shrink: 0;
}

.mobile-chat-header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  background: transparent;
  color: var(--lt-text-secondary);
  cursor: pointer;
  border-radius: 8px;
  flex-shrink: 0;
  touch-action: manipulation;
}
.mobile-chat-header-btn:active {
  background-color: var(--mobile-active-bg);
}

.mobile-chat-header-info {
  flex: 1;
  text-align: center;
  cursor: pointer;
  padding: 0 4px;
}

.mobile-chat-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--lt-text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ===== 消息列表 ===== */
.mobile-chat-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 12px 12px 8px;
}

.mobile-msg-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.mobile-msg-item {
  /* each message block */
}

.mobile-msg-item.is-user {
  display: flex;
  justify-content: flex-end;
}

.mobile-user-wrap {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  flex-direction: row-reverse;
}

/* ===== 用户气泡 ===== */
.mobile-user-bubble {
  max-width: 80%;
  padding: 10px 14px;
  background-color: var(--lt-brand);
  color: #fff;
  border-radius: 16px 4px 16px 16px;
  font-size: 15px;
  line-height: 1.5;
  word-break: break-word;
}

/* ===== AI 消息 ===== */
.mobile-msg-bubble {
  font-size: 15px;
  line-height: 1.6;
  color: var(--lt-text-primary);
  word-break: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
}
.mobile-msg-bubble :deep(pre) {
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.mobile-msg-bubble :deep(.markdown-content) { font-size: 15px; line-height: 1.7; }
.mobile-msg-bubble :deep(.markdown-content p) { margin: 8px 0; }
.mobile-msg-bubble :deep(.markdown-content pre) { margin: 10px 0; font-size: 13px; }

.mobile-streaming-text {
  white-space: pre-wrap;
  font-family: inherit;
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--lt-text-primary);
}

.mobile-cursor {
  display: inline-block;
  width: 6px;
  height: 14px;
  background-color: var(--lt-brand);
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: cursor-blink 0.8s ease-in-out infinite;
}

@keyframes cursor-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

/* ===== 建议按钮 ===== */
.mobile-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.mobile-suggestion-btn {
  padding: 6px 14px;
  border-radius: 16px;
  border: 0.5px solid var(--lt-border);
  background: var(--lt-bg-card);
  color: var(--lt-text-secondary);
  font-size: 13px;
  cursor: pointer;
  touch-action: manipulation;
  white-space: nowrap;
}
.mobile-suggestion-btn:active {
  background: var(--lt-brand-lightest);
}
.mobile-suggestion-btn.primary {
  border-color: var(--lt-brand-lighter);
  color: var(--lt-brand);
  background: var(--lt-brand-lightest);
  font-weight: 500;
}

/* ===== 生成卡片 ===== */
.mobile-gen-card {
  margin-top: 8px;
}

/* ===== 输入区域 ===== */
.mobile-chat-input {
  flex-shrink: 0;
  padding: 6px 10px;
  background: var(--lt-bg-card);
  border-top: 0.5px solid var(--lt-border);
}

.mobile-input-inner {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--lt-bg-page);
  border-radius: 20px;
  padding: 3px 3px 3px 12px;
}

.mobile-input-field {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 16px;
  color: var(--lt-text-primary);
  outline: none;
  min-height: 36px;
  line-height: 1.4;
}
.mobile-input-field::placeholder {
  color: var(--lt-text-placeholder);
}
.mobile-input-field:disabled {
  opacity: 0.5;
}

.mobile-send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--lt-text-placeholder);
  color: #fff;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, transform 0.1s;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.mobile-send-btn:active { transform: scale(0.92); }
.mobile-send-btn.active {
  background: var(--lt-brand);
}
.mobile-send-btn:disabled {
  opacity: 0.5;
}

/* ===== 欢迎页 ===== */
.mobile-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 0 24px;
  text-align: center;
}

.mobile-welcome-avatar {
  width: 80px;
  height: 80px;
  margin-bottom: 20px;
}

.mobile-welcome-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--lt-text-primary);
  margin: 0 0 8px;
}

.mobile-welcome-desc {
  font-size: 14px;
  color: var(--lt-text-auxiliary);
  line-height: 1.5;
  margin: 0 0 24px;
}

.mobile-welcome-suggestions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.mobile-welcome-suggestion {
  padding: 12px 16px;
  border-radius: 12px;
  border: 0.5px solid var(--lt-border);
  background: var(--lt-bg-card);
  color: var(--lt-text-secondary);
  font-size: 14px;
  cursor: pointer;
  text-align: left;
  touch-action: manipulation;
}
.mobile-welcome-suggestion:active {
  background: var(--lt-brand-lightest);
  border-color: var(--lt-brand-lighter);
}

/* ===== 会话列表抽屉 ===== */
.mobile-session-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mobile-new-session-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border: 1px dashed var(--lt-brand-lighter);
  border-radius: 10px;
  background: transparent;
  color: var(--lt-brand);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  margin-bottom: 8px;
  touch-action: manipulation;
}
.mobile-new-session-btn:active {
  background: var(--lt-brand-lightest);
}

.mobile-session-item {
  padding: 12px 16px;
  border-radius: 10px;
  cursor: pointer;
  touch-action: manipulation;
}
.mobile-session-item.active {
  background: var(--lt-brand-lightest);
  border-left: 3px solid var(--lt-brand);
}
.mobile-session-item:not(.active):active {
  background: var(--lt-bg-page);
}

.mobile-session-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--lt-text-primary);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.mobile-session-meta {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
}

/* ===== 生成资源底部弹窗 ===== */
.mobile-gen-sheet {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mobile-gen-input {
  width: 100%;
  padding: 12px 14px;
  border: 0.5px solid var(--lt-border);
  border-radius: 12px;
  font-size: 16px;
  color: var(--lt-text-primary);
  background: var(--lt-bg-page);
  outline: none;
  box-sizing: border-box;
}
.mobile-gen-input:focus {
  border-color: var(--lt-brand);
}

.mobile-gen-hint {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  margin: 0;
  text-align: center;
}

.mobile-gen-submit {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 12px;
  background: var(--lt-brand);
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  touch-action: manipulation;
}
.mobile-gen-submit:disabled {
  opacity: 0.5;
}
.mobile-gen-submit:not(:disabled):active {
  background: var(--lt-brand-dark);
}

/* ===== Mobile file upload ===== */
.mobile-upload-btn {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border: none; background: transparent;
  color: var(--lt-text-auxiliary); cursor: pointer; flex-shrink: 0;
  touch-action: manipulation; border-radius: 50%;
}
.mobile-upload-btn:active {
  background: var(--mobile-active-bg);
}
.mobile-upload-btn:disabled {
  opacity: 0.4;
}
.mobile-upload-spinner {
  display: inline-block; width: 14px; height: 14px;
  border: 2px solid var(--lt-border);
  border-top-color: var(--lt-brand);
  border-radius: 50%;
  animation: mobile-upload-spin 0.6s linear infinite;
}
@keyframes mobile-upload-spin {
  to { transform: rotate(360deg); }
}
.mobile-file-chips-row {
  display: flex; flex-wrap: wrap; gap: 3px;
  padding: 0 0 4px;
}
.mobile-file-chip {
  display: inline-flex; align-items: center; gap: 2px;
  padding: 1px 3px 1px 5px; border-radius: 3px;
  font-size: 10px; line-height: 1.4;
  background: var(--lt-bg-page);
  border: 0.5px solid var(--lt-border-light);
  color: var(--lt-text-secondary);
}
.mobile-file-chip.is-image {
  background: rgba(43,111,255,0.05);
  border-color: var(--lt-brand-light-7);
}
.mobile-file-chip svg { flex-shrink: 0; color: var(--lt-text-auxiliary); }
.mobile-file-chip.is-image svg { color: var(--lt-brand); }
.mobile-file-chip-name {
  max-width: 80px; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}
.mobile-file-chip-remove {
  display: inline-flex; align-items: center; justify-content: center;
  width: 44px; height: 44px; margin: -15px -10px;
  border: none; background: transparent;
  color: var(--lt-text-placeholder); cursor: pointer;
  border-radius: 8px; flex-shrink: 0; padding: 0;
  position: relative;
}
.mobile-file-chip-remove:active { color: var(--lt-danger); background: rgba(255,59,48,0.1); }
.mobile-user-files-row {
  display: flex; flex-wrap: wrap; gap: 3px; margin-top: 4px;
  padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.2);
}
.mobile-user-file-chip {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 1px 5px; border-radius: 3px;
  font-size: 10px; background: rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.9);
}

/* ===== Mode row ===== */
.mobile-mode-row {
  display: flex; align-items: center; gap: 4px;
  padding: 2px 12px;
  background: var(--lt-bg-card);
  border-bottom: 0.5px solid var(--lt-border);
  overflow-x: auto;
  flex-shrink: 0;
  -webkit-overflow-scrolling: touch;
}
.mobile-mode-row::-webkit-scrollbar { display: none; }
.mobile-mode-btn {
  padding: 4px 10px; height: 30px; border: none; background: transparent;
  border-radius: 6px; font-size: 12px; cursor: pointer;
  color: var(--lt-text-auxiliary); white-space: nowrap;
  touch-action: manipulation; transition: all 0.15s;
  display: inline-flex; align-items: center; justify-content: center;
}
.mobile-mode-btn.is-active {
  background: var(--lt-brand); color: #fff; font-weight: 600;
  box-shadow: 0 1px 4px rgba(43,111,255,0.25);
}
.mobile-mode-btn:not(.is-active):active {
  background: var(--lt-bg-page);
}
.mobile-mode-btn:disabled { opacity: 0.4; }
.mobile-studio-link {
  margin-left: auto; display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 8px; border: none; background: transparent;
  color: var(--lt-text-auxiliary); font-size: 11px; cursor: pointer;
  touch-action: manipulation; white-space: nowrap;
}
.mobile-studio-link:active { color: var(--lt-brand); }

/* ===== Mode tag ===== */
.mobile-mode-tag {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 10px;
  font-size: 11px; font-weight: 500; margin-bottom: 8px;
}
.mobile-mode-tag--lecture { background: rgba(43,111,255,0.12); color: var(--lt-brand); }
.mobile-mode-tag--smart { background: rgba(124,92,252,0.12); color: var(--lt-ai); }
.mobile-mode-tag--resource { background: rgba(52,199,89,0.12); color: var(--lt-success); }
.mobile-mode-tag--plan { background: rgba(230,162,60,0.12); color: var(--lt-orange); }

/* ===== Action bar ===== */
.mobile-action-bar {
  display: flex; align-items: center; gap: 8px;
  margin-top: 10px; padding-top: 8px;
  border-top: 0.5px solid var(--lt-border);
}
.mobile-action-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 44px; height: 44px; border-radius: 8px;
  border: none; background: transparent;
  color: var(--lt-text-auxiliary); cursor: pointer;
  touch-action: manipulation; transition: all 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.mobile-action-btn:active { background: var(--lt-brand-lightest); color: var(--lt-brand); }
.mobile-action-btn:disabled { opacity: 0.35; }
.mobile-action-btn.is-liked { color: var(--lt-success); background: rgba(52,199,89,0.08); }
.mobile-action-btn.is-disliked { color: var(--lt-danger); background: rgba(255,59,48,0.08); }
.mobile-action-btn.is-playing { color: var(--lt-brand); background: var(--lt-brand-lightest); }
.mobile-action-btn.is-loading { opacity: 0.5; pointer-events: none; }

/* ===== Tutoring inline ===== */
.mobile-tutoring-inline { width: 100%; }
.mobile-tutoring-status { text-align: center; padding: 8px 0; }
.mobile-tutoring-status p { font-size: 13px; color: var(--lt-text-auxiliary); margin: 0; }
.mobile-tutoring-error {
  background: var(--lt-orange-light-9); border: 1px solid var(--lt-warning);
  border-radius: 12px; padding: 16px; text-align: center;
}
.mobile-tutoring-error p { font-size: 14px; color: var(--lt-text-primary); margin: 4px 0; }
.mobile-tutoring-retry-btn {
  margin-top: 8px; padding: 6px 16px; border: none; border-radius: 8px;
  background: var(--lt-brand); color: #fff; font-size: 13px; cursor: pointer;
  touch-action: manipulation;
}

/* ===== Smart v2 inline ===== */
.mobile-smart-inline { width: 100%; }
.mobile-smart-text { font-size: 15px; line-height: 1.7; color: var(--lt-text-primary); margin: 8px 0; }
.mobile-smart-visual { margin: 8px 0; }
.mobile-smart-loading { padding: 8px 0; }

/* ===== DirectAnswer inline ===== */
.mobile-da-inline { width: 100%; }

/* ===== Video record ===== */
.mobile-video-record-wrapper { margin-top: 8px; }

/* ===== Session delete ===== */
.mobile-session-title-row {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 4px;
}
.mobile-session-delete {
  display: flex; align-items: center; justify-content: center;
  width: 44px; height: 44px; border-radius: 8px;
  border: none; background: transparent;
  color: var(--lt-text-placeholder); cursor: pointer;
  flex-shrink: 0; touch-action: manipulation;
}
.mobile-session-delete:active { color: var(--lt-danger); background: rgba(255,59,48,0.08); }

/* ===== Header actions ===== */
.mobile-header-actions { display: flex; align-items: center; flex-shrink: 0; }
</style>
