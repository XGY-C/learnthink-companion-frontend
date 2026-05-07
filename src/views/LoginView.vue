<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { User, Lock, Message, Avatar } from '@element-plus/icons-vue'
import LottieAnimation from '@/components/LottieAnimation.vue'
import aiPulseLottie from '@/assets/lottie/ai-pulse.json'
import aiSpinnerLottie from '@/assets/lottie/ai-spinner.json'
import bgParticlesLottie from '@/assets/lottie/bg-particles.json'
import aiCoreLottie from '@/assets/lottie/ai-core.json'
import successTransitionLottie from '@/assets/lottie/success-transition.json'
// 从 LottieFiles 官方 CDN 加载免费动画（运行时浏览器请求）
const aiAssistantLottieUrl = 'https://assets2.lottiefiles.com/packages/lf20_tivyci5s.json'
import shieldLockLottie from '@/assets/lottie/shield-lock.json'
import checkBounceLottie from '@/assets/lottie/check-bounce.json'
import inputGlowLottie from '@/assets/lottie/input-glow.json'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

// 状态：login | register
const activeTab = ref<'login' | 'register'>('login')
const isTransitioning = ref(false) // 全屏转场状态

// 动效降级检测
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// 登录表单
const loginForm = ref({
  username: '',
  password: '',
  remember: false
})
const loginLoading = ref(false)
const loginError = ref('')           // 表单级错误（鉴权失败/网络错误）
const loginFieldErrors = ref({ username: '', password: '' })  // 字段级错误

// 注册表单
const registerForm = ref({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  agreement: false
})
const registerLoading = ref(false)
const registerError = ref('')
const registerFieldErrors = ref({ username: '', email: '', password: '', confirmPassword: '' })

// 输入框引用（焦点管理）
const loginUsernameRef = ref<InstanceType<any> | null>(null)
const loginPasswordRef = ref<InstanceType<any> | null>(null)
const registerUsernameRef = ref<InstanceType<any> | null>(null)
const registerPasswordRef = ref<InstanceType<any> | null>(null)

// 密码框聚焦状态（控制 shield-lock 动画显示）
const loginPasswordFocused = ref(false)
const registerPasswordFocused = ref(false)

// 校验通过状态（控制 check-bounce 动画）
const loginUsernameValid = ref(false)
const loginPasswordValid = ref(false)
const registerUsernameValid = ref(false)
const registerPasswordValid = ref(false)
const registerConfirmValid = ref(false)

// 轮播索引
const currentBanner = ref(0)
const banners = [
  '对话建画像：自动构建学习画像（演示≥6维）',
  '多智能体协同：流程可视化生成资源包（演示≥5类）',
  '证据可追溯：来源与置信度可见',
  '质量闭环：审校/评分/重生成（演示）'
]

// 定时轮播（动效降级时不轮播）
let bannerTimer: ReturnType<typeof setInterval> | undefined
const startBannerLoop = () => {
  stopBannerLoop()
  if (!prefersReducedMotion) {
    bannerTimer = setInterval(() => {
      currentBanner.value = (currentBanner.value + 1) % banners.length
    }, 3500)
  }
}
const stopBannerLoop = () => {
  if (bannerTimer !== undefined) clearInterval(bannerTimer)
}
startBannerLoop()

// 切换面板（左右滑动切换）
const switchTab = async (tab: 'login' | 'register') => {
  if (activeTab.value === tab) return
  activeTab.value = tab
  
  // 切换时清空另一 panel 的错误提示
  loginError.value = ''
  registerError.value = ''
  loginFieldErrors.value = { username: '', password: '' }
  registerFieldErrors.value = { username: '', email: '', password: '', confirmPassword: '' }
  
  // 切换后焦点自动落到新 panel 首个输入框
  await nextTick()
  if (tab === 'login') {
    loginUsernameRef.value?.focus()
  } else {
    registerUsernameRef.value?.focus()
  }
}

// 密码校验规则：8-32位，包含字母与数字
const validatePassword = (password: string): string => {
  if (!password) return '请输入密码'
  if (password.length < 8) return '密码至少 8 位'
  if (password.length > 32) return '密码不超过 32 位'
  if (!/[a-zA-Z]/.test(password)) return '需同时包含字母和数字'
  if (!/[0-9]/.test(password)) return '需同时包含字母和数字'
  return ''
}

const handleLogin = () => {
  // 内联校验
  const errors = { username: '', password: '' }
  if (!loginForm.value.username) errors.username = '请输入账号'
  if (!loginForm.value.password) errors.password = '请输入密码'
  loginFieldErrors.value = errors
  loginError.value = ''
  
  if (errors.username || errors.password) return
  
    // 模拟校验通过动画触发
  loginUsernameValid.value = true
  loginPasswordValid.value = true
  
  loginLoading.value = true
  setTimeout(() => {
    const success = userStore.login(loginForm.value.username, loginForm.value.password)
    if (success) {
      isTransitioning.value = true
      setTimeout(() => {
        const redirect = route.query.redirect as string
        router.push(redirect || '/')
      }, 1500)
    } else {
      loginError.value = '账号或密码不正确'
      loginLoading.value = false
    }
  }, 1000)
}

const handleRegister = () => {
  // 内联校验
  const errors = { username: '', email: '', password: '', confirmPassword: '' }
  if (!registerForm.value.username) errors.username = '请输入用户名'
  
  const pwdErr = validatePassword(registerForm.value.password)
  if (pwdErr) errors.password = pwdErr
  
  if (registerForm.value.password !== registerForm.value.confirmPassword) {
    errors.confirmPassword = '两次输入的密码不一致'
  }
  
  registerFieldErrors.value = errors
  registerError.value = ''
  
  if (!registerForm.value.agreement) {
    registerError.value = '请阅读并同意相关协议'
  }
  
  if (Object.values(errors).some(Boolean) || registerError.value) return
  
    // 模拟校验通过动画触发
  registerUsernameValid.value = true
  registerPasswordValid.value = true
  registerConfirmValid.value = true
  
  registerLoading.value = true
  setTimeout(() => {
    userStore.login(registerForm.value.username, registerForm.value.password)
    isTransitioning.value = true
    setTimeout(() => {
      router.push('/profile')
    }, 1500)
  }, 1000)
}
</script>

<template>
  <div class="min-h-screen w-full flex items-center justify-center relative overflow-hidden font-sans" style="background: linear-gradient(135deg, var(--lt-brand-lightest), var(--lt-bg-card), var(--lt-ai-light-9));">
    <!-- 背景光效装饰 -->
    <div class="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none" style="background-color: var(--lt-shadow-blue);"></div>
    <div class="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full blur-[120px] pointer-events-none" style="background-color: var(--lt-shadow-ai);"></div>

    <div class="w-full max-w-[1040px] min-h-[640px] flex mx-4 backdrop-blur-xl border overflow-hidden relative z-10" style="background-color: var(--lt-bg-card); border-radius: var(--lt-radius-lg, 28px); box-shadow: var(--lt-shadow-elevated, 0 24px 60px -12px rgba(0,0,0,0.08)); border-color: var(--lt-border);">
      
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
                    <!-- 浮动 AI 小助手（LottieFiles 官方动画） -->
          <div class="absolute bottom-6 right-4 w-20 h-20 z-10 opacity-50 pointer-events-none drop-shadow-lg">
          <LottieAnimation :path="aiAssistantLottieUrl" width="100%" height="100%" />
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

                <!-- 滑动内容区：左右滑动切换（200~300ms） -->
        <div class="relative flex-1 w-full overflow-hidden">
                    <!-- 滑动容器：登录在左（translateX(0)），注册在右（translateX(-100%)） -->
          <div class="flex h-full w-full transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
               :class="{ '!transition-none !duration-0': prefersReducedMotion }"
               :style="{ transform: activeTab === 'login' ? 'translateX(0)' : 'translateX(-100%)' }">
            
            <!-- 登录面板 -->
            <div class="min-w-full h-full flex-shrink-0 flex flex-col items-center justify-center px-8 sm:px-14 pb-8"
                 role="tabpanel"
                 aria-label="登录表单"
                 v-show="!prefersReducedMotion || activeTab === 'login'">
              <div class="w-full max-w-[340px]">
                                <div class="mb-8 text-center">
                                    <h2 class="text-2xl font-bold tracking-tight mb-2" style="color: var(--lt-text-primary);">欢迎回来</h2>
                                    <p class="text-sm" style="color: var(--lt-text-secondary);">登录以继续你的个性化学习之旅</p>
                                  </div>

                <!-- 表单级错误提示 -->
                <div v-if="loginError" class="mb-4 px-4 py-2.5 rounded-xl text-sm font-medium border"
                     role="alert"
                     style="background-color: var(--lt-ai-light-9); border-color: var(--lt-ai-light-5); color: var(--lt-ai-dark-2);">
                  {{ loginError }}
                </div>

                                <el-form @submit.prevent="handleLogin">
                                  <el-form-item class="mb-4" :error="loginFieldErrors.username || ''">
                                    <div class="relative w-full">
                                      <!-- 校验通过对勾 -->
                                      <div v-if="loginUsernameValid && !loginFieldErrors.username" 
                                           class="absolute -right-9 top-1/2 -translate-y-1/2 w-6 h-6 z-10 pointer-events-none">
                                        <LottieAnimation :animationData="checkBounceLottie" width="100%" height="100%" :loop="false" />
                                      </div>
                                      <el-input v-model="loginForm.username"
                                                placeholder="用户名 / 邮箱"
                                                size="large"
                                                :prefix-icon="User"
                                                clearable
                                                class="premium-input h-[46px]"
                                                ref="loginUsernameRef"
                                                aria-label="用户名或邮箱" />
                                    </div>
                                  </el-form-item>

                                    <!-- 密码安全守护小盾牌 -->
                  <div class="relative">
                    <div v-if="loginPasswordFocused && !loginFieldErrors.password" 
                         class="absolute -right-8 top-1/2 -translate-y-1/2 w-7 h-7 z-10 pointer-events-none">
                      <LottieAnimation :animationData="shieldLockLottie" width="100%" height="100%" />
                    </div>
                                        <el-form-item class="mb-2" :error="loginFieldErrors.password || ''">
                      <div class="relative w-full">
                        <!-- 校验通过对勾 -->
                        <div v-if="loginPasswordValid && !loginFieldErrors.password" 
                             class="absolute -right-9 top-1/2 -translate-y-1/2 w-6 h-6 z-10 pointer-events-none">
                          <LottieAnimation :animationData="checkBounceLottie" width="100%" height="100%" :loop="false" />
                        </div>
                        <el-input v-model="loginForm.password"
                                  type="password"
                                  placeholder="请输入密码"
                                  size="large"
                                  show-password
                                  :prefix-icon="Lock"
                                  class="premium-input h-[46px]"
                                  aria-label="密码"
                                  ref="loginPasswordRef"
                                  @focus="loginPasswordFocused = true"
                                  @blur="loginPasswordFocused = false" />
                      </div>
                    </el-form-item>
                  </div>

                  <div class="flex items-center justify-between mb-4">
                    <el-checkbox v-model="loginForm.remember" size="small" class="custom-checkbox">
                      <span class="text-xs" style="color: var(--lt-text-secondary);">记住我</span>
                    </el-checkbox>
                  </div>

                  <el-form-item class="mb-0">
                    <el-button type="primary" size="large" class="w-full btn-gradient" :disabled="loginLoading" @click="handleLogin" aria-label="登录">
                      <span v-if="!loginLoading">登录</span>
                      <div v-else class="flex items-center justify-center gap-2">
                                                <LottieAnimation :animationData="aiSpinnerLottie" width="24px" height="24px" />
                        <span>登录中…</span>
                      </div>
                    </el-button>
                  </el-form-item>
                </el-form>
              </div>
            </div>

                        <!-- 注册面板 -->
            <div class="min-w-full h-full flex-shrink-0 flex flex-col items-center justify-center px-8 sm:px-14 pb-8"
                 role="tabpanel"
                 aria-label="注册表单"
                 v-show="!prefersReducedMotion || activeTab === 'register'">
              <div class="w-full max-w-[340px]">
                                <div class="mb-6 text-center">
                                    <h2 class="text-2xl font-bold tracking-tight mb-2" style="color: var(--lt-text-primary);">创建你的学思伴行账号</h2>
                                    <p class="text-sm" style="color: var(--lt-text-secondary);">2 分钟完成注册，开始对话建画像</p>
                                  </div>

                <!-- 表单级错误提示 -->
                <div v-if="registerError" class="mb-4 px-4 py-2.5 rounded-xl text-sm font-medium border"
                     role="alert"
                     style="background-color: var(--lt-ai-light-9); border-color: var(--lt-ai-light-5); color: var(--lt-ai-dark-2);">
                  {{ registerError }}
                </div>

                                <el-form @submit.prevent="handleRegister">
                                  <el-form-item class="mb-4" :error="registerFieldErrors.username || ''">
                                    <div class="relative w-full">
                                      <!-- 校验通过对勾 -->
                                      <div v-if="registerUsernameValid && !registerFieldErrors.username" 
                                           class="absolute -right-9 top-1/2 -translate-y-1/2 w-6 h-6 z-10 pointer-events-none">
                                        <LottieAnimation :animationData="checkBounceLottie" width="100%" height="100%" :loop="false" />
                                      </div>
                                      <el-input v-model="registerForm.username"
                                                placeholder="设置用户名"
                                                size="large"
                                                :prefix-icon="Avatar"
                                                clearable
                                                class="premium-input h-[46px]"
                                                ref="registerUsernameRef"
                                                aria-label="用户名" />
                                    </div>
                                  </el-form-item>

                  <el-form-item class="mb-4">
                    <el-input v-model="registerForm.email"
                              placeholder="邮箱地址 (可选)"
                              size="large"
                              :prefix-icon="Message"
                              clearable
                              class="premium-input h-[46px]"
                              aria-label="邮箱地址" />
                  </el-form-item>

                                    <!-- 密码安全守护小盾牌 -->
                  <div class="relative">
                    <div v-if="registerPasswordFocused && !registerFieldErrors.password" 
                         class="absolute -right-8 top-1/2 -translate-y-1/2 w-7 h-7 z-10 pointer-events-none">
                      <LottieAnimation :animationData="shieldLockLottie" width="100%" height="100%" />
                    </div>
                                        <el-form-item class="mb-4" :error="registerFieldErrors.password || ''">
                      <div class="relative w-full">
                        <!-- 校验通过对勾 -->
                        <div v-if="registerPasswordValid && !registerFieldErrors.password" 
                             class="absolute -right-9 top-1/2 -translate-y-1/2 w-6 h-6 z-10 pointer-events-none">
                          <LottieAnimation :animationData="checkBounceLottie" width="100%" height="100%" :loop="false" />
                        </div>
                        <el-input v-model="registerForm.password"
                                  type="password"
                                  placeholder="密码 (至少8位，包含字母与数字)"
                                  size="large"
                                  show-password
                                  :prefix-icon="Lock"
                                  class="premium-input h-[46px]"
                                  aria-label="密码"
                                  ref="registerPasswordRef"
                                  @focus="registerPasswordFocused = true"
                                  @blur="registerPasswordFocused = false" />
                      </div>
                    </el-form-item>
                  </div>

                                                                        <el-form-item class="mb-2" :error="registerFieldErrors.confirmPassword || ''">
                    <div class="relative w-full">
                      <!-- 校验通过对勾 -->
                      <div v-if="registerConfirmValid && !registerFieldErrors.confirmPassword" 
                           class="absolute -right-9 top-1/2 -translate-y-1/2 w-6 h-6 z-10 pointer-events-none">
                        <LottieAnimation :animationData="checkBounceLottie" width="100%" height="100%" :loop="false" />
                      </div>
                      <el-input v-model="registerForm.confirmPassword"
                                type="password"
                                placeholder="确认密码"
                                size="large"
                                show-password
                                :prefix-icon="Lock"
                                class="premium-input h-[46px]"
                                aria-label="确认密码" />
                    </div>
                  </el-form-item>

                  <!-- 流光底部装饰（输入框聚焦动效延伸） -->
                  <div class="mb-1 -mt-1 h-2 w-full overflow-hidden rounded-full opacity-30">
                    <LottieAnimation :animationData="inputGlowLottie" width="100%" height="100%" />
                  </div>

                  <el-form-item class="mb-0">
                    <el-button type="primary" size="large" class="w-full btn-gradient" :disabled="registerLoading" @click="handleRegister" aria-label="注册并进入">
                      <span v-if="!registerLoading">注册并进入</span>
                      <div v-else class="flex items-center justify-center gap-2">
                                                <LottieAnimation :animationData="aiSpinnerLottie" width="24px" height="24px" />
                        <span>注册中…</span>
                      </div>
                    </el-button>
                  </el-form-item>

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
      
    </div>

        <!-- 成功后的全屏沉浸式转场（Lottie 驱动） -->
    <transition name="fade-scale">
      <div v-show="isTransitioning" class="fixed inset-0 z-50 flex items-center justify-center pointer-events-none" style="background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px);">
        <div class="flex flex-col items-center">
          <div class="w-56 h-56 mb-4">
            <LottieAnimation :animationData="successTransitionLottie" width="100%" height="100%" :loop="false" />
          </div>
          <h2 class="text-xl font-bold tracking-wider" style="color: var(--lt-brand);">正在激活您的专属智能体...</h2>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* 转场动效 - 全屏沉浸转场 */
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

/* ======================== */
/* 高级输入框覆写（token化） */
/* ======================== */
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
  border-color: var(--el-color-primary);
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
  color: var(--lt-text-auxiliary);
  font-size: 18px;
}

/* ======================== */
/* 主按钮（使用 token 色） */
/* ======================== */
:deep(.btn-gradient) {
  background: linear-gradient(135deg, var(--lt-brand) 0%, var(--lt-brand-dark) 100%) !important;
  border: none !important;
  border-radius: 12px !important;
  height: 48px !important;
  font-size: 15px !important;
  font-weight: 600 !important;
  letter-spacing: 0.5px;
  box-shadow: 0 8px 16px -4px var(--lt-shadow-blue) !important;
  transition: all 0.3s ease !important;
}

:deep(.btn-gradient:hover) {
  box-shadow: 0 12px 24px -6px var(--lt-shadow-ai) !important;
  transform: translateY(-1px);
}

:deep(.btn-gradient:active) {
  transform: translateY(1px);
  box-shadow: 0 4px 8px -2px var(--lt-shadow-blue) !important;
}

:deep(.btn-gradient[disabled]) {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none !important;
}

/* ======================== */
/* 复选框与文字对齐 */
/* ======================== */
:deep(.custom-checkbox .el-checkbox__label) {
  display: flex !important;
  align-items: center;
  padding-left: 8px;
  white-space: normal;
  line-height: 1.4;
}

/* ======================== */
/* Element Plus 表单错误覆写 */
/* ======================== */
:deep(.el-form-item.is-error .premium-input .el-input__wrapper) {
  border-color: var(--el-color-danger);
  box-shadow: 0 0 0 3px rgba(255, 59, 48, 0.08) !important;
}

:deep(.el-form-item__error) {
  color: var(--el-color-danger);
  font-size: 12px;
  padding-top: 4px;
}

/* ======================== */
/* 动效降级：prefers-reduced-motion */
/* ======================== */
@media (prefers-reduced-motion: reduce) {
  /* 禁止所有位移动画 */
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

    /* 切换不滑动，直接用显示/隐藏 */
  .\!transition-none {
    transition: none !important;
  }

  .\!duration-0 {
    transition-duration: 0ms !important;
  }

  /* 轮播只保留淡入，不位移 */
  .slide-up-enter-active,
  .slide-up-leave-active {
    transition: opacity 0.2s ease !important;
  }
  .slide-up-enter-from {
    opacity: 0;
    transform: none;
  }
  .slide-up-leave-to {
    opacity: 0;
    transform: none;
  }

  /* 全屏转场禁用缩放 */
  .fade-scale-enter-active,
  .fade-scale-leave-active {
    transition: opacity 0.3s ease !important;
  }
  .fade-scale-enter-from {
    opacity: 0;
    transform: none;
  }
  .fade-scale-leave-to {
    opacity: 0;
    transform: none;
  }
}
</style>
