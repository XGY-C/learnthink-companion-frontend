<script setup lang="ts">
import { ref } from 'vue'

const inputMessage = ref('')
const messages = ref([
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
    text: '收到！看来你的目标非常明确，侧重于**工程化规范**和**前端架构**。既然每天只有半小时，我会为你推送**高浓度的实操案例**与**速览版知识点**。\\n已为你更新能力雷达图与偏好标签。你可以随时在这里继续更新你的情况，或者直接进入工作室生成属于你的前端工程资源包。'
  }
])

const sendMessage = () => {
  if (!inputMessage.value.trim()) return
  messages.value.push({ role: 'user', text: '模拟发送：' + inputMessage.value })
  inputMessage.value = ''
  
  // 模拟助手回复
  setTimeout(() => {
    messages.value.push({ role: 'assistant', text: '（正在根据新对话持续更新画像...）' })
  }, 800)
}
</script>

<template>
  <div class="flex flex-col h-full bg-slate-50">
    <div class="p-5 border-b border-gray-200 bg-white flex justify-between items-center shadow-sm z-10">
      <div>
        <h1 class="text-xl font-bold text-gray-800">对话建画像</h1>
        <p class="text-sm text-gray-500 mt-1">越聊越懂你，资源推送越懂你</p>
      </div>
      <div>
        <el-button type="primary" class="shadow-sm">进入资源工作室 &rarr;</el-button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-6 space-y-6">
      <div v-for="(msg, idx) in messages" :key="idx" 
        class="flex"
        :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <div class="max-w-2xl px-4 py-3 rounded-2xl shadow-sm text-sm"
          :class="msg.role === 'user' ? 'bg-primary text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'"
          style="line-height: 1.6"
        >
          {{ msg.text }}
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
