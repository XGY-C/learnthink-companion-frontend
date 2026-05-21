<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Lock, Message, Avatar } from '@element-plus/icons-vue'
import LottieAnimation from '@/components/LottieAnimation.vue'
import InteractiveParticles from '@/components/InteractiveParticles.vue'
import aiPulseLottie from '@/assets/lottie/ai-pulse.json'
import aiSpinnerLottie from '@/assets/lottie/ai-spinner.json'
import bgParticlesLottie from '@/assets/lottie/bg-particles.json'
import aiCoreLottie from '@/assets/lottie/ai-core.json'
import aiAssistantLottie from '@/assets/lottie/ai-assistant.json'
import cyberSecurityLottie from '@/assets/lottie/cyber-security.json'
import checkBounceLottie from '@/assets/lottie/check-bounce.json'
import inputGlowLottie from '@/assets/lottie/input-glow.json'
import chatPulseLottie from '@/assets/lottie/chat-pulse-v2.json'
import agentNetworkLottie from '@/assets/lottie/agent-network-v2.json'
import trustShieldLottie from '@/assets/lottie/trust-shield-v2.json'
import qualityLoopLottie from '@/assets/lottie/quality-loop-v2.json'
import { useAuth, validateEmail, validatePassword } from '@/composables/useAuth'

const router = useRouter()
const route = useRoute()
const { codeSending, codeSent, countdown, codeError, sendVerificationCode, login: authLogin, register: authRegister } = useAuth()

// 状态：login | register
const activeTab = ref<'login' | 'register'>('login')


// 动效降级检测
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// 鼠标视差
const cardRef = ref<HTMLElement | null>(null)
const parallaxStyle = ref({ transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)' })
const isDesktop = ref(window.innerWidth >= 768)

const handleMouseMove = (e: MouseEvent) => {
  if (prefersReducedMotion || !cardRef.value || !isDesktop.value) return
  const rect = cardRef.value.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const deltaX = (e.clientX - centerX) / rect.width
  const deltaY = (e.clientY - centerY) / rect.height
  const rotateY = deltaX * 4   // 最大 ±4°
  const rotateX = -deltaY * 4
  parallaxStyle.value = {
    transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
  }
}

const handleMouseLeave = () => {
  if (prefersReducedMotion || !isDesktop.value) return
  parallaxStyle.value = { transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)' }
}

// 背景鼠标响应（用于后续扩展交互）
const handleBgMouseMove = () => {
  // 可用于驱动背景渐变跟随鼠标轻微偏转
  // 留作扩展
}

// 响应式监听窗口尺寸
let resizeTimer: ReturnType<typeof setTimeout> | undefined
const checkDesktop = () => {
  isDesktop.value = window.innerWidth >= 768
}
window.addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(checkDesktop, 200)
})

// 登录表单
const loginForm = ref({
  email: '',
  password: '',
  remember: false
})
const loginLoading = ref(false)
const loginError = ref('')           // 表单级错误（鉴权失败/网络错误）
const loginFieldErrors = ref({ email: '', password: '' })  // 字段级错误

// 注册表单
const registerForm = ref({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  verificationCode: '',
  agreement: false
})
const registerLoading = ref(false)
const registerError = ref('')
const registerFieldErrors = ref({ username: '', email: '', password: '', confirmPassword: '', verificationCode: '' })

/** 发送验证码（包装 composable，处理字段错误映射） */
async function handleSendCode() {
  const { success, error } = await sendVerificationCode(registerForm.value.email)
  if (!success) {
    registerFieldErrors.value.email = error
  } else {
    registerFieldErrors.value.email = ''
  }
}

// 输入框引用（焦点管理）
const loginEmailRef = ref<InstanceType<any> | null>(null)
const registerUsernameRef = ref<InstanceType<any> | null>(null)

// 密码框聚焦状态（控制 shield-lock 动画显示）
const loginPasswordFocused = ref(false)
const registerPasswordFocused = ref(false)

// 校验通过状态（控制 check-bounce 动画）
const loginEmailValid = ref(false)
const loginPasswordValid = ref(false)
const registerUsernameValid = ref(false)
const registerPasswordValid = ref(false)
const registerConfirmValid = ref(false)

// 知识元素数据
const knowledgeChars = [
  { char: '学', x: '8%', y: '22%', size: '42px', delay: '0s', duration: '28s' },
  { char: '思', x: '85%', y: '15%', size: '36px', delay: '-5s', duration: '32s' },
  { char: '知', x: '72%', y: '70%', size: '48px', delay: '-12s', duration: '26s' },
  { char: '行', x: '15%', y: '78%', size: '32px', delay: '-8s', duration: '30s' },
  { char: '智', x: '50%', y: '8%', size: '40px', delay: '-3s', duration: '35s' },
  { char: 'K', x: '92%', y: '45%', size: '30px', delay: '-10s', duration: '24s' },
]

// ========================================
// 轮播 — 卖点展示（动画 + 标题 + 描述）
// ========================================
const currentBanner = ref(0)
const banners = [
  {
    title: '学习即画像',
    subtitle: '在学习对话中画像自动积累，无需填表',
    lottie: agentNetworkLottie
  },
  {
    title: '智能体协同',
    subtitle: '多智能体无缝协作，让知识生成清晰可控',
    lottie: chatPulseLottie
  },
  {
    title: '可信可追溯',
    subtitle: '每一份结果，来源与置信度都清晰可见',
    lottie: trustShieldLottie
  },
  {
    title: '质量闭环',
    subtitle: '从生成到优化，不断逼近最佳答案',
    lottie: qualityLoopLottie
  }
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

// 手动点击时重置定时器，让用户有完整阅读时间
const goToBanner = (idx: number) => {
  currentBanner.value = idx
  startBannerLoop()
}

onMounted(() => startBannerLoop())
onUnmounted(() => stopBannerLoop())

// 切换面板（左右滑动切换）
const switchTab = async (tab: 'login' | 'register') => {
  if (activeTab.value === tab) return
  activeTab.value = tab
  
  // 切换时清空另一 panel 的错误提示
  loginError.value = ''
  registerError.value = ''
  loginFieldErrors.value = { email: '', password: '' }
  registerFieldErrors.value = { username: '', email: '', password: '', confirmPassword: '', verificationCode: '' }
  
  // 切换后焦点自动落到新 panel 首个输入框
  await nextTick()
  if (tab === 'login') {
    loginEmailRef.value?.focus()
  } else {
    registerUsernameRef.value?.focus()
  }
}

const handleLogin = async () => {
  // 内联校验
  const errors = { email: '', password: '' }
  errors.email = validateEmail(loginForm.value.email)
  if (!loginForm.value.password) errors.password = '请输入密码'
  loginFieldErrors.value = errors
  loginError.value = ''

  if (errors.email || errors.password) return

  loginLoading.value = true
  const { success, error } = await authLogin(loginForm.value.email, loginForm.value.password)
  loginLoading.value = false

  if (success) {
    loginEmailValid.value = true
    loginPasswordValid.value = true
    const redirect = route.query.redirect as string
    router.push(redirect || '/')
  } else {
    loginError.value = error
  }
}

const handleRegister = async () => {
  // 内联校验
  const errors = { username: '', email: '', password: '', confirmPassword: '', verificationCode: '' }
  if (!registerForm.value.username) errors.username = '请输入用户名'

  errors.email = validateEmail(registerForm.value.email)

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

  // 校验验证码
  if (!registerForm.value.verificationCode) {
    errors.verificationCode = '请输入验证码'
  } else if (registerForm.value.verificationCode.length !== 6) {
    errors.verificationCode = '验证码长度应为6位'
  }

  if (Object.values(errors).some(Boolean) || registerError.value) return

  registerLoading.value = true
  const { success, error } = await authRegister({
    username: registerForm.value.username,
    email: registerForm.value.email,
    password: registerForm.value.password,
    verificationCode: registerForm.value.verificationCode,
  })
  registerLoading.value = false

  if (success) {
    registerUsernameValid.value = true
    registerPasswordValid.value = true
    registerConfirmValid.value = true
    router.push('/chat')
  } else {
    registerError.value = error
  }
}
</script>

<template>
  <div class="min-h-screen w-full flex items-center justify-center relative overflow-hidden font-sans animated-gradient"
       @mousemove="handleBgMouseMove">
    <!-- 背景光效装饰 — 极光流光动效 -->
    <div class="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none aurora-1" style="background-color: var(--lt-shadow-blue);"></div>
    <div class="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full blur-[120px] pointer-events-none aurora-2" style="background-color: var(--lt-shadow-ai);"></div>
    <div class="absolute top-[40%] left-[30%] w-[35%] h-[35%] rounded-full blur-[100px] pointer-events-none aurora-3" style="background-color: var(--lt-ai-light-3); opacity: 0.15;"></div>

        <!-- 交互式 Canvas 粒子网络（移动端禁用，性能优化） -->
    <InteractiveParticles v-if="isDesktop" />

    <!-- 微井网格背景 -->
    <div class="absolute inset-0 z-0 pointer-events-none opacity-[0.04]"
         style="background-mage: linear-gradient(rgba(43,111,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(43,111,255,0.5) 1px, transparent 1px); background-size: 60px 60px;">
    </div>

    <div ref="cardRef"
         class="login-card-wrapper w-full max-w-[1040px] min-h-[640px] flex mx-4 backdrop-blur-sm border overflow-hidden relative z-10 card-breathing"
         style="background-color: var(--lt-bg-card); border-radius: var(--lt-radius-lg, 28px); box-shadow: var(--lt-shadow-elevated, 0 24px 60px -12px rgba(0,0,0,0.08)); border-color: var(--lt-border);"
         :style="[parallaxStyle, { transition: 'transform 0.15s ease-out' }]"
         @mousemove="handleMouseMove"
         @mouseleave="handleMouseLeave">
      
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
          <LottieAnimation :animationData="aiAssistantLottie" width="100%" height="100%" />
          </div>
          <h1 class="text-4xl font-extrabold tracking-tight mb-4 flex items-center gap-2">
            LearnThink
            <span class="px-2 py-0.5 rounded-md bg-white/20 text-[14px] font-bold tracking-normal backdrop-blur-sm">AI</span>
          </h1>
          <p class="text-lg text-blue-50/90 font-light tracking-wide leading-relaxed">基于学习画像驱动，<br/>为你打造专属的多智能体学习助手。</p>
        </div>
        
                <div class="relative z-10 w-full mb-4 flex flex-col">
          <!-- 轮播内容区 -->
          <transition name="banner-fade" mode="out-in">
            <div :key="currentBanner" class="flex flex-col items-center justify-center">
              <!-- 主题动画 -->
              <div class="w-[100px] h-[100px] mb-4 opacity-85 drop-shadow-lg">
                <LottieAnimation
                  :animationData="banners[currentBanner].lottie"
                  width="100%"
                  height="100%"
                />
              </div>
              <!-- 标题 -->
              <h3 class="text-white text-xl font-bold tracking-tight mb-2 drop-shadow-sm">
                {{ banners[currentBanner].title }}
              </h3>
              <!-- 描述文案 -->
              <p class="text-white/80 text-sm font-light tracking-wide leading-relaxed text-center max-w-[260px]">
                {{ banners[currentBanner].subtitle }}
              </p>
            </div>
          </transition>
          <!-- 优雅的指示器 -->
          <div class="flex gap-2.5 mt-4 justify-center">
            <button 
              v-for="(_, idx) in banners" 
              :key="idx" 
              class="h-1.5 rounded-full transition-all duration-500 ease-out cursor-pointer"
              :class="currentBanner === idx ? 'w-8 bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]' : 'w-2 bg-white/30 hover:bg-white/50'"
              @click="goToBanner(idx)"
            ></button>
          </div>
        </div>
      </div>

      <!-- 右侧：表单侧 (绝对定位解决溢出和排版问题) -->
      <div class="w-full md:w-[54%] relative flex flex-col" style="background-color: var(--lt-bg-card);">
        
                <!-- 移动端顶部 -->
        <div class="md:hidden flex flex-col items-center pt-10 pb-2 z-20 relative">
          <img src="/logo.svg" alt="LearnThink Logo" class="w-10 h-10 mb-2" />
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
              @click="switchTab('login')">登 录</button>
            <button class="flex-1 py-2 text-sm font-semibold transition-colors duration-300 relative z-10 rounded-xl"
              :style="{ color: activeTab === 'register' ? 'var(--lt-brand)' : 'var(--lt-text-secondary)' }"
              @click="switchTab('register')">注 册</button>
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
                                  <el-form-item class="mb-4" :error="loginFieldErrors.email || ''">
                                    <div class="relative w-full">
                                      <!-- 校验通过对勾 -->
                                      <div v-if="loginEmailValid && !loginFieldErrors.email" 
                                           class="absolute -right-9 top-1/2 -translate-y-1/2 w-6 h-6 z-10 pointer-events-none">
                                        <LottieAnimation :animationData="checkBounceLottie" width="100%" height="100%" :loop="false" />
                                      </div>
                                      <el-input v-model="loginForm.email"
                                                placeholder="邮箱地址"
                                                size="large"
                                                :prefix-icon="Message"
                                                clearable
                                                class="premium-input h-[46px]"
                                                ref="loginEmailRef"
                                                aria-label="邮箱地址" />
                                    </div>
                                  </el-form-item>

                                    <!-- 密码安全守护小盾牌 -->
                  <div class="relative">
                    <div v-if="loginPasswordFocused && !loginFieldErrors.password" 
                         class="absolute -right-16 top-1/2 -translate-y-1/2 w-16 h-16 z-10 pointer-events-none">
                                               <LottieAnimation :animationData="cyberSecurityLottie" width="100%" height="100%" />
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
                                    <p class="text-sm" style="color: var(--lt-text-secondary);">开始你的 AI 学习之旅</p>
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
                                                            placeholder="邮箱地址"
                              size="large"
                              :prefix-icon="Message"
                              clearable
                              class="premium-input h-[46px]"
                              aria-label="邮箱地址">
                        <template #append>
                          <el-button
                            :disabled="codeSending || codeSent"
                            @click="handleSendCode"
                            size="default"
                            class="send-code-btn"
                          >
                            <template v-if="codeSending">发送中…</template>
                            <template v-else-if="codeSent">{{ countdown }}s</template>
                            <template v-else>发送验证码</template>
                          </el-button>
                        </template>
                      </el-input>
                  </el-form-item>

                                                                        <!-- 密码安全守护小盾牌 -->
                                    <div class="relative">
                    <div v-if="registerPasswordFocused && !registerFieldErrors.password" 
                         class="absolute -right-16 top-1/2 -translate-y-1/2 w-16 h-16 z-10 pointer-events-none">
                                               <LottieAnimation :animationData="cyberSecurityLottie" width="100%" height="100%" />
                                             </div>
                                                                 <el-form-item class="mb-1" :error="registerFieldErrors.password || ''">
                      <div class="relative w-full">
                        <!-- 校验通过对勾 -->
                        <div v-if="registerPasswordValid && !registerFieldErrors.password" 
                             class="absolute -right-9 top-1/2 -translate-y-1/2 w-6 h-6 z-10 pointer-events-none">
                          <LottieAnimation :animationData="checkBounceLottie" width="100%" height="100%" :loop="false" />
                        </div>
                        <el-input v-model="registerForm.password"
                                  type="password"
                                  placeholder="密码 (至少8位，包含大小写字母与数字)"
                                  size="large"
                                  show-password
                                  :prefix-icon="Lock"
                                  class="premium-input h-[46px]"
                                  aria-label="密码"
                                  @focus="registerPasswordFocused = true"
                                  @blur="registerPasswordFocused = false" />
                      </div>
                    </el-form-item>
                  </div>
                    <!-- 密码强度提示 -->
                    <div class="mb-4 px-1">
                      <p class="text-xs leading-relaxed" style="color: var(--lt-text-auxiliary);">
                        密码至少 8 个字符，包含大、小写字母和数字
                      </p>
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

                  <!-- 验证码 -->
                  <el-form-item class="mb-4" :error="registerFieldErrors.verificationCode || ''">
                    <div class="relative w-full">
                      <el-input v-model="registerForm.verificationCode"
                                placeholder="邮箱验证码"
                                size="large"
                                maxlength="6"
                                class="premium-input h-[46px]"
                                aria-label="邮箱验证码" />
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

        <!-- 知识元素：漂浮字符（极淡潜意识层） -->
    <div v-for="(item, idx) in knowledgeChars" :key="'char-'+idx"
         class="absolute z-0 pointer-events-none select-none floating-knowledge-char"
         :style="{
           left: item.x,
           top: item.y,
           fontSize: item.size,
           animationDelay: item.delay,
           animationDuration: item.duration,
           color: idx < 5 ? 'var(--lt-brand)' : 'var(--lt-ai)',
                      opacity: 0.09
         }">
      {{ item.char }}
    </div>

    <!-- 知识元素：迷你知识图谱 SVG -->
    <svg class="absolute inset-0 z-0 pointer-events-none select-none"
         style="opacity: 0.09; width: 100%; height: 100%;"
         viewBox="0 0 100 100" preserveAspectRatio="none">
      <!-- 边（连接线） -->
      <line x1="28" y1="55" x2="38" y2="48" stroke="var(--lt-brand)" stroke-width="0.3" opacity="0.5">
        <animate attributeName="opacity" values="0.3;0.7;0.3" dur="6s" repeatCount="indefinite" begin="0s" />
      </line>
      <line x1="28" y1="55" x2="34" y2="65" stroke="var(--lt-brand)" stroke-width="0.3" opacity="0.5">
        <animate attributeName="opacity" values="0.3;0.7;0.3" dur="5s" repeatCount="indefinite" begin="-1s" />
      </line>
      <line x1="38" y1="48" x2="48" y2="52" stroke="var(--lt-ai)" stroke-width="0.3" opacity="0.5">
        <animate attributeName="opacity" values="0.3;0.7;0.3" dur="7s" repeatCount="indefinite" begin="-2s" />
      </line>
      <line x1="34" y1="65" x2="45" y2="68" stroke="var(--lt-ai)" stroke-width="0.3" opacity="0.5">
        <animate attributeName="opacity" values="0.3;0.7;0.3" dur="4s" repeatCount="indefinite" begin="-3s" />
      </line>
      <line x1="48" y1="52" x2="45" y2="68" stroke="var(--lt-brand)" stroke-width="0.3" opacity="0.5">
        <animate attributeName="opacity" values="0.3;0.7;0.3" dur="6.5s" repeatCount="indefinite" begin="-1.5s" />
      </line>
      <!-- 节点（圆点） -->
      <circle cx="28" cy="55" r="0.8" fill="var(--lt-brand)">
        <animate attributeName="r" values="0.6;1.2;0.6" dur="4s" repeatCount="indefinite" begin="0s" />
        <animate attributeName="opacity" values="0.4;1;0.4" dur="4s" repeatCount="indefinite" begin="0s" />
      </circle>
      <circle cx="38" cy="48" r="0.8" fill="var(--lt-brand)">
        <animate attributeName="r" values="0.6;1.2;0.6" dur="5s" repeatCount="indefinite" begin="-1s" />
        <animate attributeName="opacity" values="0.4;1;0.4" dur="5s" repeatCount="indefinite" begin="-1s" />
      </circle>
      <circle cx="34" cy="65" r="0.8" fill="var(--lt-ai)">
        <animate attributeName="r" values="0.6;1.2;0.6" dur="3.5s" repeatCount="indefinite" begin="-0.5s" />
        <animate attributeName="opacity" values="0.4;1;0.4" dur="3.5s" repeatCount="indefinite" begin="-0.5s" />
      </circle>
      <circle cx="48" cy="52" r="0.8" fill="var(--lt-ai)">
        <animate attributeName="r" values="0.6;1.2;0.6" dur="6s" repeatCount="indefinite" begin="-2s" />
        <animate attributeName="opacity" values="0.4;1;0.4" dur="6s" repeatCount="indefinite" begin="-2s" />
      </circle>
      <circle cx="45" cy="68" r="0.8" fill="var(--lt-brand)">
        <animate attributeName="r" values="0.6;1.2;0.6" dur="4.5s" repeatCount="indefinite" begin="-3s" />
        <animate attributeName="opacity" values="0.4;1;0.4" dur="4.5s" repeatCount="indefinite" begin="-3s" />
      </circle>
    </svg>

  </div>
</template>

<style scoped>
/* ========================
/* 动态渐变背景流动 */
/* ======================== */
@keyframes gradient-flow {
  0% { background-position: 0% 50%; }
  25% { background-position: 100% 0%; }
  50% { background-position: 100% 100%; }
  75% { background-position: 0% 100%; }
  100% { background-position: 0% 50%; }
}

.animated-gradient {
  background: linear-gradient(
    135deg,
    var(--lt-brand-lightest) 0%,
    var(--lt-bg-card) 25%,
    var(--lt-ai-light-9) 50%,
    var(--lt-brand-light-7) 75%,
    var(--lt-ai-light-7) 100%
  ) !important;
  background-size: 300% 300% !important;
  animation: gradient-flow 25s ease-in-out infinite;
}

/* ======================== */
/* 极光流光动效 */
/* ======================== */
@keyframes aurora-drift-1 {
  0% { transform: translate(0, 0) scale(1); opacity: 0.6; }
  33% { transform: translate(4%, 3%) scale(1.08); opacity: 0.8; }
  66% { transform: translate(-2%, -2%) scale(0.95); opacity: 0.5; }
  100% { transform: translate(2%, -1%) scale(1.03); opacity: 0.7; }
}
@keyframes aurora-drift-2 {
  0% { transform: translate(0, 0) scale(1); opacity: 0.6; }
  33% { transform: translate(-4%, -3%) scale(1.06); opacity: 0.8; }
  66% { transform: translate(3%, 2%) scale(0.95); opacity: 0.5; }
  100% { transform: translate(-2%, 1%) scale(1.02); opacity: 0.7; }
}
@keyframes aurora-drift-3 {
  0% { transform: translate(0, 0) scale(1); opacity: 0.10; }
  50% { transform: translate(-3%, 4%) scale(1.12); opacity: 0.20; }
  100% { transform: translate(2%, -2%) scale(0.95); opacity: 0.12; }
}

.aurora-1 {
  will-change: transform;
  animation: aurora-drift-1 14s ease-in-out infinite alternate;
}
.aurora-2 {
  will-change: transform;
  animation: aurora-drift-2 18s ease-in-out infinite alternate;
}
.aurora-3 {
  will-change: transform;
  animation: aurora-drift-3 12s ease-in-out infinite alternate;
}

/* ======================== */
/* 知识字符漂浮动效 */
/* ======================== */
@keyframes float-knowledge {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  20% { transform: translate(18px, -22px) rotate(4deg) scale(1.04); }
  40% { transform: translate(-12px, -10px) rotate(-3deg) scale(0.97); }
  60% { transform: translate(8px, 16px) rotate(2deg) scale(1.02); }
  80% { transform: translate(-16px, 8px) rotate(-2deg) scale(0.98); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}

.floating-knowledge-char {
  will-change: transform;
  animation: float-knowledge 30s ease-in-out infinite;
  text-shadow: 0 0 30px currentColor, 0 0 70px currentColor, 0 0 140px currentColor;
}

/* ======================== */
/* 浮动几何体动效 */
/* ======================== */
@keyframes float-ring {
  0%, 100% { transform: translateY(0) rotate(0deg) scale(1); opacity: 0.12; }
  33% { transform: translateY(-12px) rotate(120deg) scale(1.04); opacity: 0.18; }
  66% { transform: translateY(6px) rotate(240deg) scale(0.97); opacity: 0.10; }
}
@keyframes float-hex {
  0%, 100% { transform: translateY(0) rotate(0deg) scale(1); opacity: 0.10; }
  50% { transform: translateY(-16px) rotate(-180deg) scale(1.06); opacity: 0.16; }
}

.floating-ring {
  will-change: transform;
  animation: float-ring 20s ease-in-out infinite;
}
.floating-hex {
  will-change: transform;
  animation: float-hex 15s ease-in-out infinite;
}

/* ======================== */
/* 卡片呼吸光晕 */
/* ======================== */
@keyframes card-shadow-breathe {
  0%, 100% {
    box-shadow: var(--lt-shadow-elevated, 0 24px 60px -12px rgba(0,0,0,0.08));
    border-color: var(--lt-border);
  }
  50% {
    box-shadow: 0 24px 64px -8px rgba(43,111,255,0.14), 0 0 0 1px rgba(43,111,255,0.04);
    border-color: rgba(43,111,255,0.08);
  }
}

.card-breathing {
  animation: card-shadow-breathe 4s ease-in-out infinite;
}

/* 左侧动效 */
@keyframes pulse-op {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.05); }
}

/* 轮播淡入淡出过渡 */
.banner-fade-enter-active,
.banner-fade-leave-active {
  transition: opacity 0.45s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.banner-fade-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.96);
}
.banner-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.96);
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
/* 发送验证码按钮 */
/* ======================== */
:deep(.send-code-btn) {
  border: none !important;
  background: linear-gradient(135deg, var(--lt-brand) 0%, var(--lt-brand-dark) 100%) !important;
  color: #fff !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  border-radius: 0 12px 12px 0 !important;
  height: 46px !important;
  padding: 0 16px !important;
  white-space: nowrap;
  transition: all 0.3s ease !important;
}

:deep(.send-code-btn:hover) {
  box-shadow: 0 4px 12px var(--lt-shadow-blue) !important;
  opacity: 0.92;
}

:deep(.send-code-btn:active) {
  opacity: 0.85;
}

:deep(.send-code-btn.is-disabled) {
  background: var(--lt-brand-disabled) !important;
  color: #fff !important;
  opacity: 0.7;
  cursor: not-allowed;
}

/* El-Input 搭配 append slot 时去除内边框合并缝隙 */
:deep(.el-input-group__append) {
  background-color: transparent !important;
  border: none !important;
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
  .banner-fade-enter-active,
  .banner-fade-leave-active {
    transition: opacity 0.2s ease !important;
    transform: none !important;
  }
  .banner-fade-enter-from {
    opacity: 0;
    transform: none;
  }
  .banner-fade-leave-to {
    opacity: 0;
    transform: none;
  }

    /* 动态渐变停止 */
    .animated-gradient {
      animation: none !important;
      background: linear-gradient(135deg, var(--lt-brand-lightest), var(--lt-bg-card), var(--lt-ai-light-9)) !important;
      background-size: 100% 100% !important;
    }

    /* 卡片呼吸停止 + 无视差 */
    .card-breathing {
      animation: none !important;
      box-shadow: var(--lt-shadow-elevated) !important;
      border-color: var(--lt-border) !important;
      transform: none !important;
    }

    /* 知识字符固定 */
    .floating-knowledge-char {
            animation: none !important;
      opacity: 0.06 !important;
    }

    /* 极光固定居中不飘移 */
    .aurora-1, .aurora-2, .aurora-3 {
      will-change: auto;
      animation: none !important;
      opacity: 0.5 !important;
      transform: none !important;
    }

    /* 几何体固定 */
    .floating-ring, .floating-hex {
      will-change: auto;
      animation: none !important;
      opacity: 0.08 !important;
      transform: none !important;
    }

  
}

/* ======================== */
/* 移动端响应式调整 */
/* ======================== */
@media (max-width: 767px) {
  .min-h-screen {
    padding: 0;
    align-items: flex-start;
  }

  .login-card-wrapper {
    min-height: 100vh;
    min-height: 100dvh;
    margin: 0 !important;
    border-radius: 0 !important;
    max-width: 100% !important;
  }

  :deep(.premium-input .el-input__wrapper) {
    min-height: 48px;
  }

  :deep(.premium-input .el-input__inner) {
    height: 48px !important;
    font-size: 16px !important;
  }

  :deep(.btn-gradient) {
    height: 52px !important;
    font-size: 16px !important;
  }

  :deep(.send-code-btn) {
    height: 48px !important;
    font-size: 12px !important;
    padding: 0 12px !important;
  }
}
</style>
