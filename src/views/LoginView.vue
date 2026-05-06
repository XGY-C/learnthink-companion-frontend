<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { User, Lock, Message, Avatar } from '@element-plus/icons-vue'
import LottieAnimation from '@/components/LottieAnimation.vue'
import aiPulseLottie from '@/assets/lottie/ai-pulse.json'
import spinnerLottie from '@/assets/lottie/spinner.json'
import bgParticlesLottie from '@/assets/lottie/bg-particles.json'
import aiCoreLottie from '@/assets/lottie/ai-core.json'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

// 状态：login | register
const activeTab = ref<'login' | 'register'>('login')
const isTransitioning = ref(false) // 全屏转场状态

// 登录表单
const loginForm = ref({
  username: '',
  password: '',
  remember: false
})
const loginLoading = ref(false)

// 注册表单
const registerForm = ref({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  agreement: false
})
const registerLoading = ref(false)

// 轮播索引
const currentBanner = ref(0)
const banners = [
  '对话建画像：自动构建学习画像（演示≥6维）',
  '多智能体协同：流程可视化生成资源包（演示≥5类）',
  '证据可追溯：来源与置信度可见',
  '质量闭环：审校/评分/重生成（演示）'
]

// 定时轮播
setInterval(() => {
  currentBanner.value = (currentBanner.value + 1) % banners.length
}, 3500)

// 切换面板
const switchTab = (tab: 'login' | 'register') => {
  activeTab.value = tab
}

const handleLogin = () => {
  if (!loginForm.value.username || !loginForm.value.password) {
    ElMessage.warning('请输入账号和密码')
    return
  }
  loginLoading.value = true
  setTimeout(() => {
    const success = userStore.login(loginForm.value.username, loginForm.value.password)
    if (success) {
      ElMessage.success('登录成功')
      isTransitioning.value = true
      setTimeout(() => {
        const redirect = route.query.redirect as string
        router.push(redirect || '/')
      }, 1500) // 等待大转场动画播放
    } else {
      ElMessage.error('账号或密码不正确')
      loginLoading.value = false
    }
  }, 1000) // 模拟计算时长
}

const handleRegister = () => {
  if (!registerForm.value.username || !registerForm.value.password) {
    ElMessage.warning('请输入完整注册信息')
    return
  }
  if (registerForm.value.password !== registerForm.value.confirmPassword) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }
  if (!registerForm.value.agreement) {
    ElMessage.warning('请阅读并同意相关协议')
    return
  }
  registerLoading.value = true
  setTimeout(() => {
    // 模拟注册成功
    userStore.login(registerForm.value.username, registerForm.value.password)
    ElMessage.success('注册成功')
    isTransitioning.value = true
    setTimeout(() => {
      router.push('/profile')
    }, 1500) // 等待大转场动画播放
  }, 1000)
}
</script>

<template>
  <div class="min-h-screen w-full flex items-center justify-center relative overflow-hidden font-sans" style="background: linear-gradient(135deg, var(--lt-brand-lightest), var(--lt-bg-card), var(--lt-ai-light-9));">
    <!-- 背景光效装饰 -->
    <div class="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none" style="background-color: var(--lt-shadow-blue);"></div>
    <div class="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full blur-[120px] pointer-events-none" style="background-color: var(--lt-shadow-ai);"></div>

    <div class="w-full max-w-[1040px] h-[640px] flex mx-4 backdrop-blur-xl border overflow-hidden relative z-10" style="background-color: var(--lt-bg-card); border-radius: var(--lt-radius-lg, 28px); box-shadow: var(--lt-shadow-elevated, 0 24px 60px -12px rgba(0,0,0,0.08)); border-color: var(--lt-border);">
      
      <!-- 左侧：品牌 AI 舞台空间 -->
      <div class="hidden md:flex w-[46%] relative overflow-hidden flex-col justify-between p-12 text-white">
        <!-- 背景粒子/星云网络 Lottie -->
        <div class="absolute inset-0 z-0 opacity-40">
          <LottieAnimation :animationData="bgParticlesLottie" width="100%" height="100%" />
        </div>
        <!-- 沉浸式高级渐变背景 (覆盖在动画下层) -->
        <div class="absolute inset-0 -z-10 opacity-90" style="background: linear-gradient(135deg, var(--lt-brand), var(--lt-ai-dark-2));"></div>

        <!-- 悬浮 AI 核心 (Hero Lottie) -->
        <div class="absolute top-[5%] right-[-10%] w-[350px] h-[350px] z-0 opacity-80 mix-blend-screen pointer-events-none drop-shadow-2xl flex items-center justify-center">
          <LottieAnimation :animationData="aiCoreLottie" width="100%" height="100%" />
        </div>
        
        <!-- 辅助发光球体 -->
        <div class="absolute bottom-[-10%] left-[-10%] w-[250px] h-[250px] rounded-full mix-blend-overlay filter blur-[60px] opacity-40 z-0" style="background-color: var(--lt-ai-light-3);"></div>
        
        <div class="relative z-10">
          <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-8 shadow-sm">
            <div class="flex items-center justify-center opacity-90 -ml-1">
              <LottieAnimation :animationData="aiPulseLottie" width="20px" height="20px" />
            </div>
            <span class="text-xs font-medium tracking-wide text-white/90">智能体环境已就绪</span>
          </div>
          <h1 class="text-4xl font-extrabold tracking-tight mb-4 flex items-center gap-2">
            LearnThink
            <span class="px-2 py-0.5 rounded-md bg-white/20 text-[14px] font-bold tracking-normal backdrop-blur-sm">AI</span>
          </h1>
          <p class="text-lg text-blue-50/90 font-light tracking-wide leading-relaxed">基于学习画像驱动，<br/>为你打造专属的多智能体学习助手。</p>
        </div>
        
        <div class="relative z-10 w-full mb-4">
          <transition name="slide-up" mode="out-in">
            <div :key="currentBanner" class="text-white/95 text-xl font-medium mb-8 leading-snug drop-shadow-sm h-14 flex items-end">
              {{ banners[currentBanner] }}
            </div>
          </transition>
          <!-- 优雅的指示器 -->
          <div class="flex gap-2.5">
            <button 
              v-for="(_, idx) in banners" 
              :key="idx" 
              class="h-1.5 rounded-full transition-all duration-500 ease-out"
              :class="currentBanner === idx ? 'w-8 bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]' : 'w-2 bg-white/30 hover:bg-white/50'"
              @click="currentBanner = idx"
            ></button>
          </div>
        </div>
      </div>

      <!-- 右侧：表单侧 (绝对定位解决溢出和排版问题) -->
      <div class="w-full md:w-[54%] relative flex flex-col" style="background-color: var(--lt-bg-card);">
        
        <!-- 移动端顶部 -->
        <div class="md:hidden flex flex-col items-center pt-10 pb-2 z-20 relative">
          <h1 class="text-2xl font-bold" style="color: var(--lt-text-primary);">LearnThink <span style="color: var(--lt-brand);">AI</span></h1>
        </div>

        <!-- 悬浮切换头 -->
        <div class="flex justify-center mt-10 md:mt-14 mb-2 relative z-20 w-full px-8">
          <div class="p-1.5 rounded-2xl flex gap-1 w-full max-w-[260px] relative backdrop-blur-sm" style="background-color: var(--lt-bg-page);">
            <div class="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl shadow-sm transition-transform duration-400 ease-[cubic-bezier(0.34,1.15,0.64,1)]"
                 style="background-color: var(--lt-bg-card);"
                 :style="{ transform: activeTab === 'login' ? 'translateX(0)' : 'translateX(100%)' }"></div>
            
            <button class="flex-1 py-2 text-sm font-semibold transition-colors duration-300 relative z-10 rounded-xl"
              :style="{ color: activeTab === 'login' ? 'var(--lt-brand)' : 'var(--lt-text-secondary)' }"
              @click="activeTab = 'login'">登 录</button>
            <button class="flex-1 py-2 text-sm font-semibold transition-colors duration-300 relative z-10 rounded-xl"
              :style="{ color: activeTab === 'register' ? 'var(--lt-brand)' : 'var(--lt-text-secondary)' }"
              @click="activeTab = 'register'">注 册</button>
          </div>
        </div>

        <!-- 滑动内容区 (绝对定位重叠，彻底解决宽度撑破的问题) -->
        <div class="relative flex-1 w-full overflow-hidden">
          
          <!-- 登录面板 -->
          <div class="absolute inset-0 flex flex-col items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] px-8 sm:px-14 pb-8"
               :class="activeTab === 'login' ? 'translate-x-0 opacity-100 pointer-events-auto z-10' : '-translate-x-12 opacity-0 pointer-events-none z-0'">
            <div class="w-full max-w-[340px]">
              <div class="mb-8 text-center">
                <h2 class="text-2xl font-bold tracking-tight mb-2" style="color: var(--lt-text-primary);">欢迎回来</h2>
                <p class="text-sm" style="color: var(--lt-text-secondary);">登录以继续你的个性化学习之旅</p>
              </div>

              <el-form class="space-y-5" @submit.prevent="handleLogin">
                <el-form-item class="mb-0">
                  <el-input v-model="loginForm.username" placeholder="用户名或邮箱" size="large" :prefix-icon="User" clearable class="premium-input h-[46px]" />
                </el-form-item>
                <el-form-item class="mb-2">
                  <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" size="large" show-password :prefix-icon="Lock" @keyup.enter="handleLogin" class="premium-input h-[46px]" />
                </el-form-item>
                
                <div class="pt-3">
                  <el-button type="primary" size="large" class="w-full btn-gradient" :disabled="loginLoading" @click="handleLogin">
                    <span v-if="!loginLoading">进入系统</span>
                    <div v-else class="flex items-center justify-center gap-2">
                      <LottieAnimation :animationData="spinnerLottie" width="24px" height="24px" />
                      <span>登录中...</span>
                    </div>
                  </el-button>
                </div>
              </el-form>
            </div>
          </div>

          <!-- 注册面板 -->
          <div class="absolute inset-0 flex flex-col items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] px-8 sm:px-14 pb-8"
               :class="activeTab === 'register' ? 'translate-x-0 opacity-100 pointer-events-auto z-10' : 'translate-x-12 opacity-0 pointer-events-none z-0'">
            <div class="w-full max-w-[340px]">
              <div class="mb-6 text-center">
                <h2 class="text-2xl font-bold tracking-tight mb-2" style="color: var(--lt-text-primary);">创建账号</h2>
                <p class="text-sm" style="color: var(--lt-text-secondary);">2 分钟完成注册，开始对话建画像</p>
              </div>

              <el-form class="space-y-4" @submit.prevent="handleRegister">
                <el-form-item class="mb-0">
                  <el-input v-model="registerForm.username" placeholder="设置用户名" size="large" :prefix-icon="Avatar" clearable class="premium-input h-[46px]" />
                </el-form-item>
                <el-form-item class="mb-0">
                  <el-input v-model="registerForm.email" placeholder="邮箱地址 (可选)" size="large" :prefix-icon="Message" clearable class="premium-input h-[46px]" />
                </el-form-item>
                <el-form-item class="mb-0">
                  <el-input v-model="registerForm.password" type="password" placeholder="密码 (至少8位，包含字母与数字)" size="large" show-password :prefix-icon="Lock" class="premium-input h-[46px]" />
                </el-form-item>
                <el-form-item class="mb-2">
                  <el-input v-model="registerForm.confirmPassword" type="password" placeholder="确认密码" size="large" show-password :prefix-icon="Lock" @keyup.enter="handleRegister" class="premium-input h-[46px]" />
                </el-form-item>
                
                <div class="pt-2">
                  <el-button type="primary" size="large" class="w-full btn-gradient" :disabled="registerLoading" @click="handleRegister">
                    <span v-if="!registerLoading">注册并进入</span>
                    <div v-else class="flex items-center justify-center gap-2">
                      <LottieAnimation :animationData="spinnerLottie" width="24px" height="24px" />
                      <span>注册中...</span>
                    </div>
                  </el-button>
                </div>
                
                <div class="flex flex-col items-center mt-4">
                  <el-checkbox v-model="registerForm.agreement" size="small" class="custom-checkbox">
                    <span class="text-xs transition-colors" style="color: var(--lt-text-secondary);">我已阅读并同意《用户协议》和《隐私策略》</span>
                  </el-checkbox>
                </div>
              </el-form>
            </div>
          </div>

        </div>
      </div>
      
    </div>

    <!-- 成功后的全屏沉浸式转场 -->
    <transition name="fade-scale">
      <div v-show="isTransitioning" class="fixed inset-0 z-50 flex items-center justify-center pointer-events-none" style="background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px);">
        <div class="flex flex-col items-center">
          <!-- 这里可以是数据爆发、打勾、加载成功的融合大动效 -->
          <div class="w-32 h-32 mb-4 bg-blue-100 rounded-full flex items-center justify-center animate-pulse shadow-2xl shadow-blue-500/30">
            <span class="text-blue-500 font-bold">SUCCESS 🎉</span>
          </div>
          <h2 class="text-xl font-bold tracking-wider" style="color: var(--lt-brand);">正在激活您的专属智能体...</h2>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* 转场动效 */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.fade-scale-enter-from {
  opacity: 0;
  transform: scale(1.05);
}
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* 左侧动效 */
.animate-pulse-slow {
  animation: pulse-op 6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes pulse-op {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.05); }
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.slide-up-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

/* 高级输入框覆写 */
:deep(.premium-input .el-input__wrapper) {
  background-color: var(--lt-bg-page);
  box-shadow: none !important;
  border-radius: 12px;
  padding: 0 14px;
  transition: all 0.3s ease;
  border: 1px solid var(--lt-border);
}

:deep(.premium-input .el-input__wrapper:hover) {
  background-color: var(--lt-bg-page);
  border-color: var(--lt-brand-lighter);
}

:deep(.premium-input .el-input__wrapper.is-focus) {
  background-color: var(--lt-bg-card);
  border-color: var(--lt-brand);
  box-shadow: 0 0 0 3px var(--lt-shadow-blue) !important;
}

:deep(.premium-input .el-input__inner) {
  color: var(--lt-text-primary);
  font-weight: 500;
  height: 46px;
}

:deep(.premium-input .el-input__inner::placeholder) {
  color: var(--lt-text-placeholder);
  font-weight: 400;
}

:deep(.el-input__prefix-inner) {
  color: #64748b;
  font-size: 18px;
}

/* 主按钮渐变与阴影 */
:deep(.btn-gradient) {
  background: linear-gradient(135deg, var(--lt-brand, #3b82f6) 0%, #4f46e5 100%) !important;
  border: none !important;
  border-radius: 12px !important;
  height: 48px !important;
  font-size: 15px !important;
  font-weight: 600 !important;
  letter-spacing: 0.5px;
  box-shadow: 0 8px 16px -4px rgba(79, 70, 229, 0.3) !important;
  transition: all 0.3s ease !important;
}

:deep(.btn-gradient:hover) {
  box-shadow: 0 12px 24px -6px rgba(79, 70, 229, 0.4) !important;
  transform: translateY(-1px);
}

:deep(.btn-gradient:active) {
  transform: translateY(1px);
  box-shadow: 0 4px 8px -2px rgba(79, 70, 229, 0.3) !important;
}

/* 橙色演示按钮 */
:deep(.btn-outline-orange) {
  border: 1px dashed #fb923c !important;
  color: #ea580c !important;
  background-color: transparent !important;
  border-radius: 12px !important;
  height: 48px !important;
  font-size: 14px !important;
  font-weight: 600 !important;
  transition: all 0.3s ease !important;
}

:deep(.btn-outline-orange:hover) {
  background-color: #fff7ed !important;
  border-color: #ea580c !important;
  color: #c2410c !important;
}

/* 修复复选框与文字对齐 */
:deep(.custom-checkbox .el-checkbox__label) {
  display: flex !important;
  align-items: center;
  padding-left: 8px;
  white-space: normal;
  line-height: 1.4;
}

/* @media (prefers-reduced-motion: reduce) 降级动画 */
@media (prefers-reduced-motion: reduce) {
  .animate-pulse-slow {
    animation: none;
  }
}
</style>
