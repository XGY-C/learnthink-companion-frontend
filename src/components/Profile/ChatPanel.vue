<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ChatLineRound, Plus, Delete, Fold, Expand, MagicStick } from '@element-plus/icons-vue'
import { useProfileStore } from '@/stores/profile'
import { useRouter } from 'vue-router'
import { apiFetch } from '@/utils/api'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import LottieAnimation from '@/components/LottieAnimation.vue'
import liveChatbotLottie from '@/assets/lottie/live-chatbot.json'

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
}

// ===== 会话模型 =====
interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  courseId: string
  createdAt: string
  updatedAt: string
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
  set: () => { /* no-op */ },
})

const inputMessage = ref('')
const isStreaming = ref(false)
const showGeneratePanel = ref(false)
const generateTopic = ref('')
const isGenerating = ref(false)
const chatId = ref('')
const profileVersionId = ref<string | null>(null)
const totalFilled = ref(0)
const sseStatus = ref<'connected' | 'connecting' | 'disconnected'>('connected')

// ===== API: 开始或恢复会话 =====
async function startChat(courseId: string) {
  try {
    const res = await apiFetch<{
      chatId: string
      courseId: string
      messages: { role: string; content: string; at: string }[]
      profileReady: boolean
      profileVersionId: string | null
    }>('/chat/start', { method: 'POST', body: { courseId } })

    if (!res.data) throw new Error('No data')

    chatId.value = res.data.chatId
    profileVersionId.value = res.data.profileVersionId

    const msgs: ChatMessage[] = (res.data.messages || []).map(m => ({
      role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
      text: m.content,
    }))

    // Create or update session
    const existing = sessions.value.find(s => s.id === chatId.value)
    if (existing) {
      existing.messages = msgs
      existing.updatedAt = new Date().toISOString()
    } else {
      sessions.value.unshift({
        id: chatId.value,
        title: msgs.length > 0 ? autoTitle(msgs) : '新会话',
        messages: msgs,
        courseId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }
    activeSessionId.value = chatId.value

    if (res.data.profileReady) {
      loadProfileFromBackend()
    }
  } catch (err) {
    ElMessage.error('无法连接对话服务')
    console.error('startChat failed:', err)
  }
}

// ===== API: 发送消息 =====
async function sendMessage(text?: string) {
  const content = (text ?? inputMessage.value.trim())
  if (!content || !chatId.value) return
  if (isStreaming.value) return

  activeSession.value.messages.push({ role: 'user', text: content })
  if (activeSession.value.title === '新会话') {
    activeSession.value.title = autoTitle(activeSession.value.messages)
  }
  activeSession.value.updatedAt = new Date().toISOString()
  inputMessage.value = ''
  isStreaming.value = true

  try {
    const res = await apiFetch<{
      chatId: string
      newMessages: { role: string; content: string; at: string }[]
      profileReady: boolean
      profileVersionId: string | null
    }>(`/chat/${chatId.value}/send`, { method: 'POST', body: { content } })

    if (!res.data) throw new Error('No data')

    for (const m of res.data.newMessages) {
      activeSession.value.messages.push({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        text: m.content,
      })
    }
    activeSession.value.updatedAt = new Date().toISOString()

    if (res.data.profileReady) {
      profileVersionId.value = res.data.profileVersionId
      loadProfileFromBackend()
      ElMessage.success('画像分析完成！可以生成个性化资源了')
    }
  } catch (err) {
    ElMessage.error('消息发送失败，请重试')
    console.error('sendMessage failed:', err)
  } finally {
    isStreaming.value = false
  }
}

// ===== API: 触发资源生成 =====
async function triggerGenerate(topic?: string) {
  const topicText = topic || generateTopic.value.trim()
  if (!topicText) {
    ElMessage.warning('请输入知识点')
    return
  }
  if (totalFilled.value < 4) {
    ElMessage.warning('画像信息还不够完善（至少需要 4 个维度），请先多聊几句')
    return
  }

  isGenerating.value = true
  showGeneratePanel.value = false

  try {
    const res = await apiFetch<{ taskId: string }>('/tasks/generate', {
      method: 'POST',
      body: {
        course_id: profile.activeCourseId,
        topic: topicText,
        profile_version: profile.fullProfile?.version || 1,
      },
    })

    if (res.data?.taskId) {
      const taskId = res.data.taskId
      activeSession.value.messages.push({
        role: 'assistant',
        text: `好的！我已经为你启动了「**${topicText}**」的资源包生成。\n\nPlanner 正在分析你的学习画像，自主判断最适合你的资源组合…\n\n预计 1-2 分钟完成。`,
        suggestions: [
          { text: '前往工作室查看进度', sendAs: `/studio?task_id=${taskId}` },
          { text: '继续聊天', sendAs: '' },
        ],
        suggestionStyle: 'primary',
      })
      activeSession.value.updatedAt = new Date().toISOString()
      ElMessage.success(`资源生成任务已创建 #${taskId}`)
      generateTopic.value = ''
    } else {
      ElMessage.error('创建生成任务失败')
    }
  } catch (err) {
    ElMessage.error('创建生成任务失败，请稍后重试')
  } finally {
    isGenerating.value = false
  }
}

// ===== API: 加载画像 =====
async function loadProfileFromBackend() {
  try {
    const res = await apiFetch<any>(`/chat/${chatId.value}/analyze`, { method: 'POST' })
    if (res.data && res.data.dimensions?.dimensions) {
      profile.loadFromProfile({
        profile_id: res.data.profileVersionId,
        user_id: '',
        course_id: profile.activeCourseId,
        version: res.data.version,
        dimensions: res.data.dimensions.dimensions,
        updated_at: new Date().toISOString(),
        last_trigger: 'chat',
      })
      totalFilled.value = res.data.dimensions.dimensions.length
    }
  } catch (err) {
    console.error('loadProfile failed:', err)
  }
}

// ===== API: 加载会话列表 =====
async function loadSessions(courseId: string) {
  try {
    const res = await apiFetch<{
      chatId: string; courseId: string; messageCount: number
      analyzed: boolean; profileVersionId: string | null; createdAt: string
    }[]>('/chat/sessions', { method: 'GET' })
    // GET with query param
  } catch {
    // Sessions are managed locally
  }
}

// ===== 会话管理 =====
const courseSessions = computed(() =>
  [...sessions.value]
    .filter(s => s.courseId === profile.activeCourseId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
)

function createSession() {
  chatId.value = ''
  activeSessionId.value = ''
  // Start a new chat via API
  startChat(profile.activeCourseId)
}

function switchSession(sessionId: string) {
  if (activeSessionId.value === sessionId) return
  activeSessionId.value = sessionId
  chatId.value = sessionId
  profileVersionId.value = null
}

async function deleteSession(sessionId: string) {
  if (sessions.value.length <= 1) {
    ElMessage.info('至少保留一个会话')
    return
  }
  try {
    await ElMessageBox.confirm('确定删除该会话？', '删除确认', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
    })
  } catch { return }
  const idx = sessions.value.findIndex(s => s.id === sessionId)
  if (idx === -1) return
  sessions.value.splice(idx, 1)
  if (activeSessionId.value === sessionId) {
    activeSessionId.value = sessions.value[0]?.id ?? ''
    chatId.value = activeSessionId.value
  }
  ElMessage.success('会话已删除')
}

function formatSessionTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 86400000) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  if (diff < 172800000) return '昨天'
  return `${d.getMonth() + 1}-${d.getDate().toString().padStart(2, '0')}`
}

function sessionPreview(msgs: ChatMessage[]): string {
  const lastAi = [...msgs].reverse().find(m => m.role === 'assistant')
  if (!lastAi) return ''
  const t = lastAi.text.replace(/\*\*/g, '').replace(/\n/g, ' ').trim()
  return t.length > 30 ? t.slice(0, 30) + '…' : t
}

function handleSuggestionClick(suggestion: { text: string; sendAs: string }) {
  if (suggestion.sendAs.startsWith('/studio')) {
    router.push(suggestion.sendAs)
  } else if (suggestion.sendAs) {
    sendMessage(suggestion.sendAs)
  }
}

// ===== 冷启动空状态 =====
const showWelcomePage = computed(() => !activeSession.value || activeSession.value.messages.length === 0)

// 课程切换时重新加载
watch(() => profile.activeCourseId, (newCourseId) => {
  sessions.value = []
  chatId.value = ''
  activeSessionId.value = ''
  startChat(newCourseId)
})

onMounted(() => {
  startChat(profile.activeCourseId)
})
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
                <div class="text-xs mt-0.5 truncate" style="color: var(--lt-text-auxiliary);">{{ sessionPreview(sess.messages) }}</div>
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
        </div>
        <div class="flex items-center gap-3">
          <span class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: sseStatus === 'connected' ? 'var(--lt-success)' : 'var(--lt-warning)' }" />
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
            <div v-if="msg.role === 'assistant'" class="max-w-[72%] rounded-xl text-sm leading-relaxed" style="border: 1px solid var(--lt-border); border-left: 3px solid var(--lt-brand); background-color: var(--lt-bg-card); border-radius: 12px; overflow: hidden;">
              <div class="px-4 py-3 assistant-message-body">
                <MarkdownViewer :content="msg.text" :showToc="false" />
                <span v-if="msg.isStreaming" class="streaming-cursor" />
              </div>
              <div v-if="msg.suggestions && msg.suggestions.length > 0" class="px-4 pb-3 flex flex-wrap gap-2">
                <el-button v-for="(sug, si) in msg.suggestions" :key="si" size="small" :type="msg.suggestionStyle === 'primary' ? 'primary' : undefined" plain @click="handleSuggestionClick(sug)">{{ sug.text }}</el-button>
              </div>
            </div>
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
.session-item {
  transition: all 0.15s ease;
}
.session-item:hover {
  background-color: var(--lt-bg-page);
}
.session-active {
  font-weight: 500;
}
.streaming-cursor {
  display: inline-block;
  width: 8px;
  height: 16px;
  background-color: var(--lt-brand);
  margin-left: 2px;
  vertical-align: text-bottom;
  border-radius: 1px;
  animation: cursor-blink 0.8s ease-in-out infinite;
}
@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
.assistant-message-body :deep(.markdown-viewer) { display: block; }
.assistant-message-body :deep(.markdown-content) { font-size: 14px; line-height: 1.7; }
.assistant-message-body :deep(.markdown-content p) { margin: 4px 0; }
.assistant-message-body :deep(.markdown-content pre) { margin: 8px 0; }
</style>
