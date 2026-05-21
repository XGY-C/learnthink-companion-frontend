<script setup lang="ts">
import { ref, computed, watch, reactive, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ChatLineRound, Plus, Delete, Fold, Expand, MagicStick } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { useChatSSE } from '@/composables/useChatSSE'
import type { ChatMessage, Suggestion } from '@/composables/useChatSSE'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import { apiFetch } from '@/utils/api'
import ThoughtChainTimeline from '@/components/ThoughtChainTimeline.vue'
import LottieAnimation from '@/components/LottieAnimation.vue'
import liveChatbotLottie from '@/assets/lottie/live-chatbot.json'
import GenerationCard from '@/components/GenerationCard.vue'
import ProfilePanel from '@/components/Profile/ProfilePanel.vue'

const router = useRouter()
const chat = useChatSSE()

/** Mode options for the chat mode toggle */
const modes = [
  { value: 'chat' as const, label: '💬 对话' },
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
const showGeneratePanel = ref(false)
const generateTopic = ref('')

function scrollToBottom() {
  nextTick(() => {
    const el = messageListRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

// ===== Action bar handlers =====
function handleSuggestionClick(suggestion: Suggestion, msg: ChatMessage) {
  if (suggestion.sendAs.startsWith('__generate_plan__:')) {
    const topic = suggestion.sendAs.slice('__generate_plan__:'.length)
    msg.suggestions = undefined
    chat.confirmPlanGeneration(topic)
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

async function copyMessage(msg: ChatMessage) {
  try {
    await navigator.clipboard.writeText(msg.text)
    ElMessage.success('已复制到剪贴板')
  } catch { ElMessage.error('复制失败') }
}

function regenerateMessage(_msg: ChatMessage, idx: number) {
  const session = chat.activeSession.value
  if (!session || chat.isStreaming.value) return
  let userText = ''
  for (let i = idx - 1; i >= 0; i--) {
    if (session.messages[i]?.role === 'user') {
      userText = session.messages[i].text
      break
    }
  }
  if (userText) chat.sendMessage(userText)
}

function toggleLike(msg: ChatMessage) {
  msg._feedback = msg._feedback === 'liked' ? undefined : 'liked'
}
function toggleDislike(msg: ChatMessage) {
  msg._feedback = msg._feedback === 'disliked' ? undefined : 'disliked'
}
async function shareMessage(msg: ChatMessage) {
  try {
    await navigator.clipboard.writeText(msg.text)
    ElMessage.success('内容已复制，可粘贴分享')
  } catch { ElMessage.error('分享失败') }
}

// ===== TTS (Text-to-Speech) =====
const audioState = reactive({
  playingMsgIdx: -1,
  loading: false,
  el: null as HTMLAudioElement | null,
})

function stopAudio() {
  if (audioState.el) {
    audioState.el.pause()
    audioState.el = null
  }
  audioState.playingMsgIdx = -1
  audioState.loading = false
}

async function toggleAudio(msg: ChatMessage, idx: number) {
  // Stop if already playing this message
  if (audioState.playingMsgIdx === idx) {
    stopAudio()
    return
  }

  // Stop any previous audio
  if (audioState.el) {
    audioState.el.pause()
    audioState.el = null
  }
  audioState.playingMsgIdx = -1

  // Use cached audio URL if available
  const cachedUrl = (msg as any)._audioUrl
  if (cachedUrl) {
    audioState.el = new Audio(cachedUrl)
    audioState.el.onended = () => { audioState.el = null; audioState.playingMsgIdx = -1 }
    audioState.el.play()
    audioState.playingMsgIdx = idx
    return
  }

  // Call backend TTS API
  audioState.loading = true
  try {
    const res = await apiFetch<{ audioUrl: string }>('/chat/tts', {
      method: 'POST',
      body: { text: msg.text },
    })
    if (res.data?.audioUrl) {
      (msg as any)._audioUrl = res.data.audioUrl
      audioState.el = new Audio(res.data.audioUrl)
      audioState.el.onended = () => { audioState.el = null; audioState.playingMsgIdx = -1 }
      audioState.el.play()
      audioState.playingMsgIdx = idx
    }
  } catch (err) {
    console.error('TTS error:', err)
    ElMessage.error('语音合成失败')
  } finally {
    audioState.loading = false
  }
}

async function handleDeleteSession(sessionId: string) {
  if (chat.sessions.value.length <= 1) { ElMessage.info('至少保留一个会话'); return }
  try {
    await ElMessageBox.confirm('确定删除该会话？', '删除确认', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
    })
  } catch { return }
  await chat.deleteSession(sessionId)
  ElMessage.success('会话已删除')
}

function handleSendMessage() {
  const text = inputMessage.value.trim()
  if (!text || chat.isStreaming.value) return
  inputMessage.value = ''
  chat.sendMessage(text)
}

async function handleTriggerGenerate() {
  const topic = generateTopic.value.trim()
  if (!topic) { ElMessage.warning('请输入知识点'); return }
  try {
    await chat.triggerGenerate(topic)
    generateTopic.value = ''
    showGeneratePanel.value = false
  } catch (err: any) {
    ElMessage.warning(err.message || '生成失败')
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
  if (messageObserver) { messageObserver.disconnect(); messageObserver = null }
  stopAudio()
})

// Watch messages to re-setup minimap observer
watch([() => chat.activeSession.value?.messages.length, chat.showWelcomePage], ([, isWelcome]) => {
  if (isWelcome) {
    if (messageObserver) { messageObserver.disconnect(); messageObserver = null }
    return
  }
  nextTick(() => setupNavObserver())
})
</script>

<template>
  <div style="display: flex; height: 100%; background-color: var(--lt-bg-page);">
    <!-- ===== 会话列表侧栏 ===== -->
    <div class="session-sidebar-wrapper flex-shrink-0 relative" :style="{ width: isSessionListCollapsed ? '0px' : '260px', transition: 'width 0.25s ease', overflow: 'hidden' }">
      <div class="session-sidebar flex flex-col h-full" style="width: 260px; min-width: 260px; background-color: var(--lt-bg-card); border-right: 1px solid var(--lt-border);">
        <div class="px-3 pt-3 pb-2 flex items-center justify-between">
          <el-button size="default" class="flex-1" style="border-radius: 10px; border: 1px dashed var(--lt-brand-lighter); color: var(--lt-brand); background-color: rgba(43, 111, 255, 0.04); font-weight: 500;" @click="chat.createSession">
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
            @click="chat.switchSession(sess.id)"
          >
            <div class="flex items-start justify-between">
              <div class="min-w-0 flex-1">
                <div class="text-sm font-medium truncate" :style="{ color: sess.id === chat.activeSessionId.value ? 'var(--lt-text-primary)' : 'var(--lt-text-secondary)' }">{{ sess.title }}</div>
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
            <el-button size="large" class="text-sm" style="border-radius: 14px; padding: 12px 22px;" @click="chat.sendMessage('我是计算机大三，在学人工智能导论，平时喜欢看代码')">
              我是计算机大三，在学AI导论
            </el-button>
            <el-button size="large" class="text-sm" style="border-radius: 14px; padding: 12px 22px;" @click="chat.sendMessage('我概率基础还行但贝叶斯公式和A*搜索不太懂')">
              概率还行，贝叶斯不太懂
            </el-button>
            <el-button size="large" class="text-sm" style="border-radius: 14px; padding: 12px 22px;" @click="chat.sendMessage('我每天能学60分钟，目标是期末考到85分')">
              每天60分钟，目标85分
            </el-button>
          </div>
        </div>

        <div v-else class="px-5 py-4">
          <div
            v-for="(msg, idx) in chat.activeSession.value?.messages ?? []"
            :key="idx"
            class="flex"
            :class="msg.role === 'user' ? 'justify-end' : 'justify-center'"
            :style="{ marginBottom: idx === (chat.activeSession.value?.messages.length ?? 1) - 1 ? '0' : (msg.role === 'user' ? '24px' : '40px') }"
          >
            <!-- AI 消息 -->
            <div v-if="msg.role === 'assistant'" class="ai-response-block" style="max-width: 860px; width: 100%;">
              <ThoughtChainTimeline
                v-if="msg.thinking"
                :steps="msg.thinking.steps"
                :is-streaming="msg.isStreaming"
                :expanded="msg.thinking.expanded || false"
                @update:expanded="msg.thinking.expanded = $event"
                class="mb-3"
              />
              <div v-if="!(msg as any)._generationCard" class="assistant-message-body">
                <MarkdownViewer v-if="!msg.isStreaming" :content="msg.text" :showToc="false" />
                <pre v-else class="streaming-text whitespace-pre-wrap text-sm leading-relaxed" style="color: var(--lt-text-primary); font-family: inherit; margin: 0;">{{ msg.text }}</pre>
                <span v-if="msg.isStreaming && msg.text" class="streaming-cursor" />
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
              <div class="ai-action-bar">
                <button class="ai-action-btn" title="复制" @click="copyMessage(msg)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
                <button class="ai-action-btn" title="重新生成" :disabled="chat.isStreaming.value" @click="regenerateMessage(msg, idx)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                </button>
                <button class="ai-action-btn" :class="{ 'is-liked': msg._feedback === 'liked' }" title="喜欢" @click="toggleLike(msg)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                </button>
                <button class="ai-action-btn" :class="{ 'is-disliked': msg._feedback === 'disliked' }" title="不喜欢" @click="toggleDislike(msg)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 2h3a2 2 0 0 0 2 2v7a2 2 0 0 1-2 2h-3"/></svg>
                </button>
                <button class="ai-action-btn" title="分享" @click="shareMessage(msg)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                </button>
                <button
                  class="ai-action-btn"
                  :class="{
                    'is-playing': audioState.playingMsgIdx === idx,
                    'is-loading': audioState.loading && audioState.playingMsgIdx === -1
                  }"
                  :disabled="audioState.loading"
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
              {{ msg.text }}
            </div>
          </div>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="px-4 py-3 bg-white border-t" style="grid-row: 3; border-color: var(--lt-border);">
        <div class="flex gap-3">
          <el-input
            v-model="inputMessage"
            :placeholder="chat.chatMode.value === 'resource' ? '描述你想生成的资料内容...'
              : chat.chatMode.value === 'plan' ? '聊聊你的学习目标和基础...'
              : '聊聊你的学习情况，我会帮你定制学习方案...'"
            :disabled="chat.isStreaming.value || chat.isGenerating.value"
            @keyup.enter="handleSendMessage"
            size="large"
            class="flex-1"
          >
            <template #prefix><el-icon><ChatLineRound /></el-icon></template>
          </el-input>
          <el-button type="primary" size="large" :disabled="chat.isStreaming.value || !inputMessage.trim()" @click="handleSendMessage">发送</el-button>
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

.assistant-message-body :deep(.markdown-viewer) { display: block; }
.assistant-message-body :deep(.markdown-content) { font-size: 15px; line-height: 1.75; }
.assistant-message-body :deep(.markdown-content p) { margin: 10px 0; }
.assistant-message-body :deep(.markdown-content h1),
.assistant-message-body :deep(.markdown-content h2),
.assistant-message-body :deep(.markdown-content h3) { margin-top: 20px; margin-bottom: 10px; }
.assistant-message-body :deep(.markdown-content pre) { margin: 12px 0; }

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
</style>
