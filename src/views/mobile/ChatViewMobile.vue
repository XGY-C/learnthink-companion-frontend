<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElDrawer } from 'element-plus'
import { useRouter } from 'vue-router'
import { useChatSSE } from '@/composables/useChatSSE'
import type { ChatMessage, Suggestion } from '@/composables/useChatSSE'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import ThoughtChainTimeline from '@/components/ThoughtChainTimeline.vue'
import LottieAnimation from '@/components/LottieAnimation.vue'
import liveChatbotLottie from '@/assets/lottie/live-chatbot.json'
import GenerationCard from '@/components/GenerationCard.vue'
import PlanOfferCard from '@/components/PlanOfferCard.vue'
import PlanEditor from '@/components/PlanEditor.vue'
import ProfilePanel from '@/components/Profile/ProfilePanel.vue'

const router = useRouter()
const chat = useChatSSE()

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

function scrollToBottom() {
  nextTick(() => {
    const el = messageListRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function handleSendMessage() {
  const text = inputMessage.value.trim()
  if (!text || chat.isStreaming.value) return
  inputMessage.value = ''
  chat.sendMessage(text)
}

// ===== Suggestion handlers =====
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

// ===== Toggle thought chain =====
function toggleThinking(msg: ChatMessage) {
  if (msg.thinking) {
    msg.thinking.expanded = !msg.thinking.expanded
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
onMounted(() => {
  cleanupReconnect = chat.setupMobileReconnection()
})
onBeforeUnmount(() => {
  if (cleanupReconnect) cleanupReconnect()
})
</script>

<template>
  <div class="mobile-chat">
    <!-- ===== 会话标题栏 ===== -->
    <div class="mobile-chat-header">
      <button class="mobile-chat-header-btn" @click="showSessions = true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <div class="mobile-chat-header-info" @click="showSessions = true">
        <h2 class="mobile-chat-title">{{ chat.activeSession.value?.title || 'AI 学习助手' }}</h2>
        <span class="mobile-chat-subtitle">
          <template v-if="chat.profileVersionId.value">画像已就绪</template>
          <template v-else>画像收集中</template>
          <template v-if="chat.generationReady.value"> · 可生成资源</template>
        </span>
      </div>
      <button class="mobile-chat-header-btn" @click="showProfile = true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
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
            <!-- 思考链：默认折叠，点击展开 -->
            <div
              v-if="msg.thinking && msg.thinking.steps.length > 0"
              class="mobile-thinking-toggle"
              @click="toggleThinking(msg)"
            >
              <span class="mobile-thinking-dots">
                <span v-for="s in msg.thinking.steps" :key="s.label" class="thinking-dot" :class="{ done: s.done }" />
              </span>
              <span class="mobile-thinking-label">{{ msg.thinking.expanded ? '收起思考' : '思考过程' }}</span>
              <svg
                class="mobile-thinking-arrow"
                :class="{ expanded: msg.thinking.expanded }"
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2"
              ><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <ThoughtChainTimeline
              v-if="msg.thinking?.expanded"
              :steps="msg.thinking.steps"
              :is-streaming="msg.isStreaming"
              :expanded="true"
              @update:expanded="msg.thinking.expanded = $event"
              class="mobile-thinking-detail"
            />

            <!-- 消息正文 -->
            <div v-if="!(msg as any)._generationCard" class="mobile-msg-bubble">
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

            <!-- 方案卡片 — 资源类型 -->
            <PlanOfferCard
              v-if="msg._planOffer && msg._planOffer.type === 'resource' && !msg._planOffer.accepted"
              :offer="msg._planOffer!"
              compact
              :loading="chat.isGenerating.value"
              @confirm="chat.acceptGenerationOffer()"
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
            <div class="mobile-user-bubble">{{ msg.text }}</div>
          </template>
        </div>
      </div>
    </div>

    <!-- ===== 输入区域 ===== -->
    <div class="mobile-chat-input" :style="{ paddingBottom: 'var(--mobile-safe-area-inset-bottom)' }">
      <div class="mobile-input-inner">
        <input
          v-model="inputMessage"
          class="mobile-input-field"
          placeholder="聊聊你的学习情况..."
          :disabled="chat.isStreaming.value"
          @keyup.enter="handleSendMessage"
        />
        <button
          class="mobile-send-btn"
          :class="{ active: inputMessage.trim() && !chat.isStreaming.value }"
          :disabled="!inputMessage.trim() || chat.isStreaming.value"
          @click="handleSendMessage"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- ===== 生成资源入口 FAB ===== -->
    <button
      v-if="chat.profileVersionId.value"
      class="mobile-gen-fab"
      @click="showGenerateSheet = true"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    </button>

    <!-- ===== 会话列表抽屉 ===== -->
    <ElDrawer
      v-model="showSessions"
      direction="ltr"
      size="75%"
      title="会话列表"
      :with-header="true"
    >
      <div class="mobile-session-list">
        <button class="mobile-new-session-btn" @click="chat.createSession(); showSessions = false">
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
          <div class="mobile-session-title">{{ sess.title }}</div>
          <div class="mobile-session-meta">{{ sess.lastMessagePreview || (sess.messageCount ? sess.messageCount + ' 条消息' : '') }} · {{ chat.formatSessionTime(sess.updatedAt) }}</div>
        </div>
      </div>
    </ElDrawer>

    <!-- ===== 画像面板抽屉 ===== -->
    <ElDrawer
      v-model="showProfile"
      direction="rtl"
      size="80%"
      :with-header="false"
    >
      <ProfilePanel />
    </ElDrawer>

    <!-- ===== 生成资源底部弹窗 ===== -->
    <ElDrawer
      v-model="showGenerateSheet"
      direction="btt"
      size="40%"
      :with-header="false"
      class="mobile-gen-drawer"
    >
      <div class="mobile-gen-sheet">
        <div class="mobile-gen-handle" />
        <h3 class="mobile-gen-title">生成个性化资源包</h3>
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
    </ElDrawer>
  </div>
</template>

<style scoped>
.mobile-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--lt-bg-page);
}

/* ===== 顶部标题栏 ===== */
.mobile-chat-header {
  display: flex;
  align-items: center;
  padding: 8px 4px;
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
  font-size: 16px;
  font-weight: 600;
  color: var(--lt-text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-chat-subtitle {
  font-size: 11px;
  color: var(--lt-text-auxiliary);
}

/* ===== 消息列表 ===== */
.mobile-chat-messages {
  flex: 1;
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

/* ===== 思考链 ===== */
.mobile-thinking-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 12px;
  background: var(--lt-bg-card);
  border: 0.5px solid var(--lt-border);
  cursor: pointer;
  margin-bottom: 8px;
  touch-action: manipulation;
}

.mobile-thinking-dots {
  display: flex;
  gap: 3px;
}

.thinking-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lt-text-placeholder);
}
.thinking-dot.done {
  background: var(--lt-brand);
}

.mobile-thinking-label {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
}

.mobile-thinking-arrow {
  color: var(--lt-text-auxiliary);
  transition: transform 0.2s ease;
}
.mobile-thinking-arrow.expanded {
  transform: rotate(180deg);
}

.mobile-thinking-detail {
  margin-bottom: 8px;
  font-size: 13px;
}

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
  padding: 8px 12px;
  background: var(--lt-bg-card);
  border-top: 0.5px solid var(--lt-border);
}

.mobile-input-inner {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--lt-bg-page);
  border-radius: 20px;
  padding: 4px 4px 4px 14px;
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
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--lt-text-placeholder);
  color: #fff;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
  touch-action: manipulation;
}
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

/* ===== 生成 FAB ===== */
.mobile-gen-fab {
  position: fixed;
  right: 20px;
  bottom: calc(72px + var(--mobile-safe-area-inset-bottom, 0px));
  z-index: 20;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: none;
  background: var(--lt-brand);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(43, 111, 255, 0.3);
  cursor: pointer;
  touch-action: manipulation;
  transition: transform 0.15s, box-shadow 0.15s;
}
.mobile-gen-fab:active {
  transform: scale(0.92);
  box-shadow: 0 2px 8px rgba(43, 111, 255, 0.2);
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
}

.mobile-session-meta {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
}

/* ===== 生成资源底部弹窗 ===== */
.mobile-gen-sheet {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mobile-gen-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--lt-border);
  margin: 0 auto;
}

.mobile-gen-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--lt-text-primary);
  margin: 0;
  text-align: center;
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
</style>
