<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useProfileStore } from '@/stores/profile'
import { useRouter } from 'vue-router'

const router = useRouter()
const profile = useProfileStore()

const inputMessage = ref('')
interface ChatMessage {
  role: 'assistant' | 'user'
  text: string
  isTyping?: boolean
}

const messages = ref<ChatMessage[]>([
  {
    role: 'assistant',
    text: '你好！我是你的专属学习智能导师。要为你量身定制学习路径，我需要先了解一下你的专业背景、当前的学习目标，以及每天能抽出的学习时间。'
  },
  {
    role: 'user',
    text: '我是大二软件工程的，想学前端，但不知道怎么搭建工程，每天大概有半小时。'
  },
  {
    role: 'assistant',
    text: '收到！看来你的目标非常明确，侧重于**工程化规范**和**前端架构**。既然每天只有半小时，我会为你推送**高浓度的实操案例**与**速览版知识点**。\n\n已为你更新能力雷达图与偏好标签。你可以随时在这里继续更新你的情况，或者直接进入工作室生成属于你的前端工程资源包。'
  }
])

/** 模拟流式打字效果 */
const typeText = (fullText: string, callback?: () => void) => {
  const msg: ChatMessage = { role: 'assistant', text: '', isTyping: true }
  messages.value.push(msg)
  let idx = 0
  const interval = setInterval(() => {
    if (idx < fullText.length) {
      msg.text += fullText[idx]
      idx++
    } else {
      clearInterval(interval)
      msg.isTyping = false
      callback?.()
    }
  }, 20)
}

const sendMessage = () => {
  if (!inputMessage.value.trim()) return
  const userMsg = inputMessage.value.trim()
  messages.value.push({ role: 'user', text: userMsg })
  inputMessage.value = ''

  setTimeout(() => {
    // 更新画像（模拟对话分析）
    profile.updateFromDialog([userMsg])

    let reply = ''
    if (/薄弱|不足|不会|差/.test(userMsg)) {
      reply = '已记录你的薄弱点反馈。根据你提到的内容，我更新了能力雷达图中对应维度，并调整了学习路径中的前置节点优先级。'
      ElMessage.info('画像已更新：薄弱项识别完成')
    } else if (/兴趣|想学|喜欢/.test(userMsg)) {
      reply = '收到你的兴趣方向！已为你在画像中标记新的兴趣标签，后续资源推荐将优先覆盖这些领域。'
      ElMessage.success('画像已更新：兴趣标签 +1')
    } else if (/时间|每天|节奏/.test(userMsg)) {
      reply = '已根据你的时间安排调整了学习节奏。后续生成的资源将以适配你当前节奏的版本为主，同时保留深入版供有余力时学习。'
      ElMessage.success('画像已更新：学习节奏调整')
    } else {
      reply = '已收到你的补充信息，正在综合分析并更新画像维度。能力雷达图与偏好标签已同步更新。'
    }

    typeText(reply)
  }, 600)
}

const goToStudio = () => {
  router.push('/studio')
}
</script>

<template>
  <div class="flex flex-col h-full bg-slate-50">
        <div class="p-5 border-b border-gray-200 bg-white flex justify-between items-center shadow-sm z-10">
      <div>
        <h1 class="text-xl font-bold" style="color: #1A1A2E;">对话建画像</h1>
        <p class="text-sm mt-1" style="color: #8E8EA0;">越聊越懂你，资源推送越懂你</p>
      </div>
      <div>
        <el-button type="primary" class="shadow-sm" @click="goToStudio">
          进入资源工作室 &rarr;
        </el-button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-6 space-y-6">
      <div v-for="(msg, idx) in messages" :key="idx" 
        class="flex"
        :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
      >
                        <!-- AI 气泡：紫色底 #F5F0FF + 左侧紫色竖条 #7C5CFC + AI 标签 -->
        <div v-if="msg.role === 'assistant'"
          class="max-w-2xl px-4 py-3 rounded-2xl text-sm leading-relaxed"
          style="border-radius: 12px; border: 1px solid #CBB5FF; border-left: 3px solid #7C5CFC; background-color: #F5F0FF;"
        >
          <template v-if="msg.isTyping">
            {{ msg.text }}<span class="inline-block w-1.5 h-4 ml-0.5" style="background-color: #FF8C42; animation: cursor-pulse 800ms ease-in-out infinite;" />
          </template>
          <template v-else>
            {{ msg.text }}
          </template>
          <div class="inline-flex items-center gap-1 mt-1.5 text-xs" style="color: #7C5CFC;">
            🤖 AI
          </div>
        </div>
        <!-- 用户气泡：白底 + 灰色边框 #E8ECF0 -->
        <div v-else
          class="max-w-2xl px-4 py-3 rounded-2xl text-sm leading-relaxed"
          style="border-radius: 12px; border: 1px solid #E8ECF0; background-color: #FFFFFF;"
        >
          <template v-if="msg.isTyping">
            {{ msg.text }}<span class="inline-block w-1.5 h-4 ml-0.5" style="background-color: #FF8C42; animation: cursor-pulse 800ms ease-in-out infinite;" />
          </template>
          <template v-else>
            {{ msg.text }}
          </template>
          <div class="inline-flex items-center gap-1 mt-1.5 text-xs" style="color: #8E8EA0;">
            🙋 我
          </div>
        </div>
      </div>
    </div>

    <div class="p-4 bg-white border-t border-gray-200">
      <div class="max-w-4xl mx-auto flex gap-3">
        <el-input
          v-model="inputMessage"
          placeholder="补充你的专业/基础/目标/短板..."
          @keyup.enter="sendMessage"
          size="large"
          class="flex-1"
        >
          <template #prefix>
            <el-icon><ChatLineRound /></el-icon>
          </template>
        </el-input>
        <el-button type="primary" size="large" @click="sendMessage">发送</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-primary {
  background-color: var(--el-color-primary);
}
</style>
