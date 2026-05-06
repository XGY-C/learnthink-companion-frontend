<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { User, Lock, MagicStick, DataBoard } from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()

const username = ref('')
const password = ref('')
const loading = ref(false)

const handleLogin = () => {
  if (!username.value || !password.value) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  loading.value = true
  // 模拟登录
  setTimeout(() => {
    const success = userStore.login(username.value, password.value)
    if (success) {
      ElMessage.success('登录成功')
      router.push('/')
    } else {
      ElMessage.error('登录失败，请重试')
    }
    loading.value = false
  }, 500)
}
</script>

<template>
    <div class="h-screen w-screen flex items-center justify-center" style="background: linear-gradient(135deg, #E8F0FE, #FFFFFF, #F5F0FF);">
    <div class="flex max-w-4xl w-full mx-4 bg-white rounded-2xl shadow-xl overflow-hidden" style="box-shadow: 0 8px 32px rgba(43, 111, 255, 0.18);">
      <!-- 左侧：品牌展示（蓝渐变 #2B6FFF → #1A4FCC） -->
      <div class="hidden md:flex w-1/2 p-10 text-white flex-col justify-center" style="background: linear-gradient(135deg, #2B6FFF, #1A4FCC);">
        <h1 class="text-3xl font-bold mb-4">LearnThink</h1>
        <p class="text-xl font-light mb-6" style="color: rgba(255, 255, 255, 0.9);">学思伴行</p>
        <p class="text-sm leading-relaxed" style="color: rgba(255, 255, 255, 0.8);">
          画像驱动的多智能体学习助手
        </p>
        <div class="mt-8 space-y-3">
          <div class="flex items-center gap-3 text-sm" style="color: rgba(255, 255, 255, 0.8);">
            <el-icon><MagicStick /></el-icon>
            <span>多智能体协同生成≥5类个性化资源</span>
          </div>
          <div class="flex items-center gap-3 text-sm" style="color: rgba(255, 255, 255, 0.8);">
            <el-icon><User /></el-icon>
            <span>对话建画像，动态更新学习路径</span>
          </div>
          <div class="flex items-center gap-3 text-sm" style="color: rgba(255, 255, 255, 0.8);">
            <el-icon><DataBoard /></el-icon>
            <span>证据可追溯，置信度、来源一一可见</span>
          </div>
        </div>
      </div>

            <!-- 右侧：登录卡片 -->
      <div class="w-full md:w-1/2 p-10 flex flex-col justify-center">
        <div class="max-w-sm mx-auto w-full">
          <h2 class="text-2xl font-bold mb-2" style="color: var(--lt-text-primary);">欢迎回来</h2>
          <p class="text-sm mb-8" style="color: var(--lt-text-auxiliary);">登录以继续你的个性化学习之旅</p>

          <el-form class="space-y-5" @submit.prevent="handleLogin">
            <el-form-item>
              <el-input
                v-model="username"
                placeholder="用户名"
                size="large"
                :prefix-icon="User"
                clearable
              />
            </el-form-item>
            <el-form-item>
              <el-input
                v-model="password"
                type="password"
                placeholder="密码"
                size="large"
                show-password
                :prefix-icon="Lock"
                @keyup.enter="handleLogin"
              />
            </el-form-item>
            <div class="pt-2">
              <el-button
                type="primary"
                size="large"
                class="w-full"
                :loading="loading"
                @click="handleLogin"
              >
                登 录
              </el-button>
            </div>
          </el-form>

          <div class="mt-6 text-center">
            <span class="text-xs text-gray-400">
              仅供比赛演示 · 任意账号密码即可登录
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-primary {
  background-color: var(--el-color-primary);
}
</style>
