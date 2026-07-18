<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, computed } from 'vue'
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
const { codeSending, codeSent, countdown, sendVerificationCode, login: authLogin, register: authRegister } = useAuth()

const activeTab = ref<'login' | 'register'>('login')
const isCardHovered = ref(false)

let hoverTimer: ReturnType<typeof setTimeout> | null = null

const handleCardMouseEnter = () => {
  if (hoverTimer) clearTimeout(hoverTimer)
  hoverTimer = setTimeout(() => {
    isCardHovered.value = true
  }, 300)
}

const handleCardMouseLeave = () => {
  if (hoverTimer) clearTimeout(hoverTimer)
  hoverTimer = null
  isCardHovered.value = false
  handleMouseLeave()
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const cardRef = ref<HTMLElement | null>(null)
const parallaxStyle = ref({ transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)' })
const isDesktop = ref(window.innerWidth >= 768)
const isMobile = computed(() => !isDesktop.value)

let rafPending = false
let lastMouseEvent: MouseEvent | null = null
let cachedRect: { left: number; top: number; width: number; height: number } | null = null

const handleMouseMove = (e: MouseEvent) => {
  if (!cardRef.value || !isDesktop.value) return
  if (document.activeElement?.tagName === 'INPUT') return
  lastMouseEvent = e
  if (rafPending) return
  rafPending = true
  requestAnimationFrame(() => {
    rafPending = false
    if (!lastMouseEvent) return
    if (!cachedRect) {
      const rawRect = cardRef.value!.getBoundingClientRect()
      cachedRect = { left: rawRect.left, top: rawRect.top, width: rawRect.width, height: rawRect.height }
    }
    const centerX = cachedRect.left + cachedRect.width / 2
    const centerY = cachedRect.top + cachedRect.height / 2
    const deltaX = (lastMouseEvent.clientX - centerX) / cachedRect.width
    const deltaY = (lastMouseEvent.clientY - centerY) / cachedRect.height
    const rotateY = deltaX * 4
    const rotateX = -deltaY * 4
    parallaxStyle.value = {
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
    }
  })
}

const handleMouseLeave = () => {
  if (!isDesktop.value) return
  lastMouseEvent = null
  cachedRect = null
  parallaxStyle.value = { transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)' }
}

let resizeTimer: ReturnType<typeof setTimeout> | undefined
const checkDesktop = () => {
  isDesktop.value = window.innerWidth >= 768
}
window.addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(checkDesktop, 200)
})

const loginForm = ref({
  email: '',
  password: '',
  remember: false
})
const loginLoading = ref(false)
const loginError = ref('')
const loginFieldErrors = ref({ email: '', password: '' })

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

async function handleSendCode() {
  const { success, error } = await sendVerificationCode(registerForm.value.email)
  if (!success) {
    registerFieldErrors.value.email = error
  } else {
    registerFieldErrors.value.email = ''
  }
}

const loginEmailRef = ref<InstanceType<any> | null>(null)
const registerUsernameRef = ref<InstanceType<any> | null>(null)

const loginPasswordFocused = ref(false)
const registerPasswordFocused = ref(false)

const loginEmailValid = ref(false)
const loginPasswordValid = ref(false)
const registerUsernameValid = ref(false)
const registerPasswordValid = ref(false)
const registerConfirmValid = ref(false)

const knowledgeChars = [
  { char: '学', x: '8%', y: '22%', size: '42px', delay: '0s', duration: '28s' },
  { char: '思', x: '85%', y: '15%', size: '36px', delay: '-5s', duration: '32s' },
  { char: '知', x: '72%', y: '70%', size: '48px', delay: '-12s', duration: '26s' },
  { char: '行', x: '15%', y: '78%', size: '32px', delay: '-8s', duration: '30s' },
  { char: '智', x: '50%', y: '8%', size: '40px', delay: '-3s', duration: '35s' },
  { char: 'K', x: '92%', y: '45%', size: '30px', delay: '-10s', duration: '24s' },
]

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

const goToBanner = (idx: number) => {
  currentBanner.value = idx
  startBannerLoop()
}

onMounted(() => startBannerLoop())
onUnmounted(() => stopBannerLoop())

const switchTab = async (tab: 'login' | 'register') => {
  if (activeTab.value === tab) return
  activeTab.value = tab
  loginError.value = ''
  registerError.value = ''
  loginFieldErrors.value = { email: '', password: '' }
  registerFieldErrors.value = { username: '', email: '', password: '', confirmPassword: '', verificationCode: '' }
  await nextTick()
  if (tab === 'login') {
    loginEmailRef.value?.focus()
  } else {
    registerUsernameRef.value?.focus()
  }
}

// ========================================
// 移动端滑动切换手势
// ========================================
const swipeContainer = ref<HTMLElement | null>(null)
const touchStartX = ref(0)
const touchStartY = ref(0)
const touchEndX = ref(0)
const touchEndY = ref(0)
const swipeThreshold = 60

const onTouchStart = (e: TouchEvent) => {
  if (!isMobile.value) return
  touchStartX.value = e.touches[0].clientX
  touchStartY.value = e.touches[0].clientY
  touchEndX.value = e.touches[0].clientX
  touchEndY.value = e.touches[0].clientY
}

const onTouchMove = (e: TouchEvent) => {
  if (!isMobile.value) return
  touchEndX.value = e.touches[0].clientX
  touchEndY.value = e.touches[0].clientY
}

const onTouchEnd = () => {
  if (!isMobile.value) return
  const dx = touchStartX.value - touchEndX.value
  const dy = touchStartY.value - touchEndY.value
  if (Math.abs(dx) < swipeThreshold) return
  if (Math.abs(dy) > Math.abs(dx) * 1.5) return
  if (dx > 0 && activeTab.value === 'login') {
    switchTab('register')
  } else if (dx < 0 && activeTab.value === 'register') {
    switchTab('login')
  }
}

const handleLogin = async () => {
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
    router.push(redirect || '/courses')
  } else {
    loginError.value = error
  }
}

const handleRegister = async () => {
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
    router.push('/courses')
  } else {
    registerError.value = error
  }
}
</script>

<template>
  <div class="min-h-screen w-full flex items-center justify-center relative overflow-hidden font-sans animated-gradient">
    <div class="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[80px] pointer-events-none aurora-1" style="background-color: var(--lt-shadow-blue);"></div>
    <div class="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full blur-[80px] pointer-events-none aurora-2" style="background-color: var(--lt-shadow-ai);"></div>
    <div class="absolute top-[40%] left-[30%] w-[35%] h-[35%] rounded-full blur-[60px] pointer-events-none aurora-3" style="background-color: var(--lt-ai-light-3); opacity: 0.15;"></div>

    <InteractiveParticles v-if="isDesktop" />

    <div class="absolute inset-0 z-0 pointer-events-none opacity-[0.04]"
         style="background-image: linear-gradient(rgba(43,111,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(43,111,255,0.5) 1px, transparent 1px); background-size: 60px 60px;">
    </div>

    <div ref="cardRef"
         class="login-card-wrapper w-full max-w-[1040px] min-h-[640px] flex mx-4 border overflow-hidden relative z-10 card-breathing"
         style="background-color: var(--lt-bg-card); border-radius: var(--lt-radius-lg, 28px); box-shadow: var(--lt-shadow-elevated, 0 24px 60px -12px rgba(0,0,0,0.08)); border-color: var(--lt-border); will-change: transform;"
         :style="[parallaxStyle, { transition: 'transform 0.15s ease-out' }]"
         @mouseenter="handleCardMouseEnter"
         @mousemove="handleMouseMove"
         @mouseleave="handleCardMouseLeave">

      <!-- 左侧：品牌 AI 舞台空间（桌面） -->
      <div class="hidden md:flex w-[46%] relative overflow-hidden flex-col justify-between p-12 text-white login-left-stage">
        <div class="absolute inset-0 z-0 opacity-40">
          <LottieAnimation :animationData="bgParticlesLottie" width="100%" height="100%" :speed="0.5" :paused="!isCardHovered" />
        </div>
        <div class="absolute inset-0 -z-10 opacity-90" style="background: linear-gradient(135deg, var(--lt-brand), var(--lt-ai-dark-2));"></div>

        <div class="absolute top-[5%] right-[-10%] w-[350px] h-[350px] z-0 opacity-80 mix-blend-screen pointer-events-none drop-shadow-2xl flex items-center justify-center">
          <LottieAnimation :animationData="aiCoreLottie" width="100%" height="100%" :speed="0.6" :paused="!isCardHovered" />
        </div>

        <div class="absolute bottom-[-10%] left-[-10%] w-[250px] h-[250px] rounded-full mix-blend-overlay filter blur-[60px] opacity-40 z-0" style="background-color: var(--lt-ai-light-3);"></div>

        <div class="relative z-10">
            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 mb-8 shadow-sm">
            <div class="flex items-center justify-center opacity-90 -ml-1">
              <LottieAnimation :animationData="aiPulseLottie" width="20px" height="20px" />
            </div>
            <span class="text-xs font-medium tracking-wide text-white/90">智能体环境已就绪</span>
          </div>
          <div class="absolute bottom-6 right-4 w-20 h-20 z-10 opacity-50 pointer-events-none drop-shadow-lg">
            <LottieAnimation :animationData="aiAssistantLottie" width="100%" height="100%" />
          </div>
          <h1 class="text-4xl font-extrabold tracking-tight mb-4 flex items-center gap-2">
            LearnThink
            <span class="px-2 py-0.5 rounded-md bg-white/20 text-[14px] font-bold tracking-normal">AI</span>
          </h1>
          <p class="text-lg text-blue-50/90 font-light tracking-wide leading-relaxed">基于学习画像驱动，<br/>为你打造专属的多智能体学习助手。</p>
        </div>

        <div class="relative z-10 w-full mb-4 flex flex-col">
          <transition name="banner-fade" mode="out-in">
            <div :key="currentBanner" class="flex flex-col items-center justify-center">
              <div class="w-[100px] h-[100px] mb-4 opacity-85 drop-shadow-lg">
                <LottieAnimation
                  :animationData="banners[currentBanner].lottie"
                  width="100%"
                  height="100%"
                />
              </div>
              <h3 class="text-white text-xl font-bold tracking-tight mb-2 drop-shadow-sm">
                {{ banners[currentBanner].title }}
              </h3>
              <p class="text-white/80 text-sm font-light tracking-wide leading-relaxed text-center max-w-[260px]">
                {{ banners[currentBanner].subtitle }}
              </p>
            </div>
          </transition>
          <div class="flex gap-2.5 mt-4 justify-center">
            <button
              v-for="(_, idx) in banners"
              :key="idx"
              class="h-1.5 rounded-full transition-[width,background-color,box-shadow] duration-500 ease-out cursor-pointer"
              :class="currentBanner === idx ? 'w-8 bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]' : 'w-2 bg-white/30 hover:bg-white/50'"
              @click="goToBanner(idx)"
            ></button>
          </div>
        </div>
      </div>

      <!-- 右侧：表单侧 -->
      <div class="w-full md:w-[54%] relative flex flex-col" style="background-color: var(--lt-bg-card);">

        <!-- ========= 移动端品牌头部（紧凑轮播） ========= -->
        <div class="mobile-brand md:hidden relative overflow-hidden pt-5 pb-2 z-20 px-6">
          <div class="flex items-center gap-3 mb-2">
            <img src="/logo.svg" alt="LearnThink Logo" class="w-8 h-8" />
            <h1 class="text-lg font-bold" style="color: var(--lt-text-primary);">
              LearnThink <span style="color: var(--lt-brand);">AI</span>
            </h1>
          </div>
          <transition name="banner-fade" mode="out-in">
            <div :key="currentBanner" class="flex items-center gap-3 min-h-[44px]">
              <div class="w-9 h-9 flex-shrink-0 opacity-85">
                <LottieAnimation
                  :animationData="banners[currentBanner].lottie"
                  width="100%"
                  height="100%"
                />
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold truncate" style="color: var(--lt-text-primary);">
                  {{ banners[currentBanner].title }}
                </p>
                <p class="text-xs truncate" style="color: var(--lt-text-auxiliary);">
                  {{ banners[currentBanner].subtitle }}
                </p>
              </div>
            </div>
          </transition>
          <div class="flex gap-1.5 mt-2">
            <button
              v-for="(_, idx) in banners"
              :key="idx"
              class="h-1 rounded-full transition-[width,background-color] duration-500 ease-out"
              :class="currentBanner === idx ? 'w-5 bg-[var(--lt-brand)]' : 'w-1 bg-[var(--lt-border)]'"
              @click="goToBanner(idx)"
            ></button>
          </div>
        </div>

        <!-- 悬浮切换头 -->
        <div class="flex justify-center mt-3 md:mt-14 mb-2 relative z-20 w-full px-6 sm:px-14">
          <div class="p-1.5 rounded-2xl flex gap-1 w-full md:max-w-[260px] relative" style="background-color: var(--lt-bg-page);">
            <div class="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl shadow-sm transition-transform duration-400 ease-[cubic-bezier(0.34,1.15,0.64,1)]"
                 style="background-color: var(--lt-bg-card);"
                 :style="{ transform: activeTab === 'login' ? 'translateX(0)' : 'translateX(100%)' }"></div>

            <button class="flex-1 py-2.5 text-sm font-semibold transition-[color] duration-300 relative z-10 rounded-xl"
              :style="{ color: activeTab === 'login' ? 'var(--lt-brand)' : 'var(--lt-text-secondary)' }"
              @click="switchTab('login')">登 录</button>
            <button class="flex-1 py-2.5 text-sm font-semibold transition-[color] duration-300 relative z-10 rounded-xl"
              :style="{ color: activeTab === 'register' ? 'var(--lt-brand)' : 'var(--lt-text-secondary)' }"
              @click="switchTab('register')">注 册</button>
          </div>
        </div>

        <!-- 滑动内容区（移动端支持滑动切换） -->
        <div ref="swipeContainer"
             class="relative flex-1 w-full overflow-hidden"
             @touchstart="onTouchStart"
             @touchmove="onTouchMove"
             @touchend="onTouchEnd">
          <div class="flex h-full w-full transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
               :class="{ '!transition-none !duration-0': prefersReducedMotion }"
               :style="{ transform: activeTab === 'login' ? 'translateX(0)' : 'translateX(-100%)' }">

            <!-- 登录面板 -->
            <div class="min-w-full h-full flex-shrink-0 flex flex-col items-center justify-start md:justify-center px-6 sm:px-14 pt-4 md:pt-0 pb-8"
                 role="tabpanel"
                 aria-label="登录表单"
                 v-show="!prefersReducedMotion || activeTab === 'login'">
              <div class="w-full max-w-[340px]">
                <div class="mb-5 md:mb-8 text-center">
                  <h2 class="text-xl md:text-2xl font-bold tracking-tight mb-1.5" style="color: var(--lt-text-primary);">欢迎回来</h2>
                  <p class="text-sm" style="color: var(--lt-text-secondary);">登录以继续你的个性化学习之旅</p>
                </div>

                <div v-if="loginError" class="mb-4 px-4 py-2.5 rounded-xl text-sm font-medium border"
                     role="alert"
                     style="background-color: var(--lt-ai-light-9); border-color: var(--lt-ai-light-5); color: var(--lt-ai-dark-2);">
                  {{ loginError }}
                </div>

                <el-form @submit.prevent="handleLogin">
                  <!-- 邮箱 -->
                  <div class="mb-4">
                    <label class="input-label" :class="{ 'input-label-error': !!loginFieldErrors.email }">邮箱地址</label>
                    <el-form-item class="mb-0" :error="loginFieldErrors.email || ''">
                      <div class="relative w-full">
                        <div v-if="loginEmailValid && !loginFieldErrors.email"
                             class="absolute -right-9 top-1/2 -translate-y-1/2 w-6 h-6 z-10 pointer-events-none">
                          <LottieAnimation :animationData="checkBounceLottie" width="100%" height="100%" :loop="false" />
                        </div>
                        <el-input v-model="loginForm.email"
                                  placeholder="请输入邮箱地址"
                                  size="large"
                                  :prefix-icon="Message"
                                  clearable
                                  class="premium-input h-[46px]"
                                  ref="loginEmailRef"
                                  aria-label="邮箱地址" />
                      </div>
                    </el-form-item>
                  </div>

                  <!-- 密码 -->
                  <div class="relative mb-2">
                    <label class="input-label" :class="{ 'input-label-error': !!loginFieldErrors.password }">密码</label>
                    <div v-show="loginPasswordFocused && !loginFieldErrors.password"
                         class="hidden md:block absolute -right-16 top-7 w-16 h-16 z-10 pointer-events-none">
                      <LottieAnimation :animationData="cyberSecurityLottie" width="100%" height="100%" :paused="!loginPasswordFocused" />
                    </div>
                    <el-form-item class="mb-0" :error="loginFieldErrors.password || ''">
                      <div class="relative w-full">
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
            <div class="min-w-full h-full flex-shrink-0 flex flex-col items-center justify-start md:justify-center px-6 sm:px-14 pt-4 md:pt-0 pb-8"
                 role="tabpanel"
                 aria-label="注册表单"
                 v-show="!prefersReducedMotion || activeTab === 'register'">
              <div class="w-full max-w-[340px]">
                <div class="mb-5 md:mb-6 text-center">
                  <h2 class="text-xl md:text-2xl font-bold tracking-tight mb-1.5" style="color: var(--lt-text-primary);">创建你的学思伴行账号</h2>
                  <p class="text-sm" style="color: var(--lt-text-secondary);">开始你的 AI 学习之旅</p>
                </div>

                <div v-if="registerError" class="mb-4 px-4 py-2.5 rounded-xl text-sm font-medium border"
                     role="alert"
                     style="background-color: var(--lt-ai-light-9); border-color: var(--lt-ai-light-5); color: var(--lt-ai-dark-2);">
                  {{ registerError }}
                </div>

                <el-form @submit.prevent="handleRegister">
                  <!-- 用户名 -->
                  <div class="mb-4">
                    <label class="input-label" :class="{ 'input-label-error': !!registerFieldErrors.username }">用户名</label>
                    <el-form-item class="mb-0" :error="registerFieldErrors.username || ''">
                      <div class="relative w-full">
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
                  </div>

                  <!-- 邮箱 + 验证码 -->
                  <div class="mb-4">
                    <label class="input-label" :class="{ 'input-label-error': !!registerFieldErrors.email }">邮箱地址</label>
                    <el-form-item class="mb-0" :error="registerFieldErrors.email || ''">
                      <el-input v-model="registerForm.email"
                                placeholder="请输入邮箱地址"
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
                  </div>

                  <!-- 密码 -->
                  <div class="relative mb-1">
                    <label class="input-label" :class="{ 'input-label-error': !!registerFieldErrors.password }">密码</label>
                    <div v-show="registerPasswordFocused && !registerFieldErrors.password"
                         class="hidden md:block absolute -right-16 top-7 w-16 h-16 z-10 pointer-events-none">
                      <LottieAnimation :animationData="cyberSecurityLottie" width="100%" height="100%" :paused="!registerPasswordFocused" />
                    </div>
                    <el-form-item class="mb-0" :error="registerFieldErrors.password || ''">
                      <div class="relative w-full">
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
                    <p class="mt-1 px-1 text-xs leading-relaxed" style="color: var(--lt-text-auxiliary);">
                      密码至少 8 个字符，包含大、小写字母和数字
                    </p>
                  </div>

                  <!-- 确认密码 -->
                  <div class="mb-4">
                    <label class="input-label" :class="{ 'input-label-error': !!registerFieldErrors.confirmPassword }">确认密码</label>
                    <el-form-item class="mb-0" :error="registerFieldErrors.confirmPassword || ''">
                      <div class="relative w-full">
                        <div v-if="registerConfirmValid && !registerFieldErrors.confirmPassword"
                             class="absolute -right-9 top-1/2 -translate-y-1/2 w-6 h-6 z-10 pointer-events-none">
                          <LottieAnimation :animationData="checkBounceLottie" width="100%" height="100%" :loop="false" />
                        </div>
                        <el-input v-model="registerForm.confirmPassword"
                                  type="password"
                                  placeholder="再次输入密码"
                                  size="large"
                                  show-password
                                  :prefix-icon="Lock"
                                  class="premium-input h-[46px]"
                                  aria-label="确认密码" />
                      </div>
                    </el-form-item>
                  </div>

                  <!-- 验证码 -->
                  <div class="mb-4">
                    <label class="input-label" :class="{ 'input-label-error': !!registerFieldErrors.verificationCode }">邮箱验证码</label>
                    <el-form-item class="mb-0" :error="registerFieldErrors.verificationCode || ''">
                      <div class="relative w-full">
                        <el-input v-model="registerForm.verificationCode"
                                  placeholder="请输入6位验证码"
                                  size="large"
                                  maxlength="6"
                                  class="premium-input h-[46px]"
                                  aria-label="邮箱验证码" />
                      </div>
                    </el-form-item>
                  </div>

                  <div class="mb-1 -mt-1 h-2 w-full overflow-hidden rounded-full opacity-30">
                    <LottieAnimation :animationData="inputGlowLottie" width="100%" height="100%" :speed="0.3" :paused="!isCardHovered" />
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

    <!-- 知识元素：漂浮字符（桌面端） -->
    <div v-for="(item, idx) in knowledgeChars" :key="'char-'+idx"
         class="mobile-hidden absolute z-0 pointer-events-none select-none floating-knowledge-char"
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

    <!-- 知识元素：迷你知识图谱 SVG（桌面端） -->
    <svg class="mobile-hidden absolute inset-0 z-0 pointer-events-none select-none"
         style="opacity: 0.09; width: 100%; height: 100%;"
         viewBox="0 0 100 100" preserveAspectRatio="none">
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
  will-change: background-position;
}

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

@keyframes card-shadow-breathe {
  0%, 100% {
    border-color: var(--lt-border);
  }
  50% {
    border-color: rgba(43,111,255,0.08);
  }
}

.card-breathing {
  animation: card-shadow-breathe 4s ease-in-out infinite;
  contain: layout style;
}

.login-left-stage {
  contain: layout style paint;
  content-visibility: auto;
}

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

:deep(.premium-input .el-input__wrapper) {
  background-color: var(--lt-bg-page);
  box-shadow: none !important;
  border-radius: 12px;
  padding: 0 14px;
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
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

:deep(.btn-gradient) {
  background: linear-gradient(135deg, var(--lt-brand) 0%, var(--lt-brand-dark) 100%) !important;
  border: none !important;
  border-radius: 12px !important;
  height: 48px !important;
  font-size: 15px !important;
  font-weight: 600 !important;
  letter-spacing: 0.5px;
  box-shadow: 0 8px 16px -4px var(--lt-shadow-blue) !important;
  transition: box-shadow 0.3s ease, transform 0.3s ease, opacity 0.3s ease !important;
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
  transition: box-shadow 0.3s ease, opacity 0.3s ease !important;
  min-width: 100px;
  min-height: 44px;
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

:deep(.el-input-group__append) {
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  border-radius: 0 !important;
}

:deep(.custom-checkbox .el-checkbox__label) {
  display: flex !important;
  align-items: center;
  padding-left: 8px;
  white-space: normal;
  line-height: 1.4;
}

:deep(.el-form-item.is-error .premium-input .el-input__wrapper) {
  border-color: var(--el-color-danger);
  box-shadow: 0 0 0 3px rgba(255, 59, 48, 0.08) !important;
}

:deep(.el-form-item__error) {
  color: var(--el-color-danger);
  font-size: 12px;
  padding-top: 4px;
}

/* ==================== */
/* 输入框可见 Label (spec 7.3) */
/* ==================== */
.input-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--lt-text-secondary);
  margin-bottom: 6px;
  padding-left: 2px;
  transition: color 0.2s ease;
}
.input-label-error {
  color: var(--lt-danger);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  .\!transition-none {
    transition: none !important;
  }

  .\!duration-0 {
    transition-duration: 0ms !important;
  }

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

  .animated-gradient {
    animation: none !important;
    background: linear-gradient(135deg, var(--lt-brand-lightest), var(--lt-bg-card), var(--lt-ai-light-9)) !important;
    background-size: 100% 100% !important;
  }

  .card-breathing {
    animation: none !important;
    box-shadow: var(--lt-shadow-elevated) !important;
    border-color: var(--lt-border) !important;
    transform: none !important;
  }

  .floating-knowledge-char {
    animation: none !important;
    opacity: 0.06 !important;
  }

  .aurora-1, .aurora-2, .aurora-3 {
    will-change: auto;
    animation: none !important;
    opacity: 0.5 !important;
    transform: none !important;
  }
}

/* ==================== */
/* 移动端响应式 */
/* ==================== */
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
    animation: none !important;
    box-shadow: none !important;
    border: none !important;
    will-change: auto !important;
    contain: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    padding-top: env(safe-area-inset-top, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  .animated-gradient {
    animation: none !important;
    background: linear-gradient(180deg, var(--lt-bg-card) 0%, var(--lt-brand-lightest) 100%) !important;
    background-size: 100% 100% !important;
  }

  .aurora-1, .aurora-2, .aurora-3 {
    display: none !important;
  }

  .card-breathing {
    animation: none !important;
    box-shadow: none !important;
    border: none !important;
  }

  :deep(.premium-input .el-input__wrapper) {
    min-height: 48px;
    border-radius: 10px;
  }

  :deep(.premium-input .el-input__inner) {
    height: 48px !important;
    font-size: 16px !important;
  }

  :deep(.btn-gradient) {
    height: 52px !important;
    font-size: 16px !important;
    border-radius: 10px !important;
  }

  :deep(.send-code-btn) {
    height: 48px !important;
    font-size: 12px !important;
    padding: 0 12px !important;
    min-width: 88px;
  }

  /* 移动端隐藏装饰元素 */
  .mobile-hidden {
    display: none !important;
  }

  /* 移动端品牌头部 */
  .mobile-brand {
    background: linear-gradient(180deg, var(--lt-brand-lightest) 0%, transparent 100%);
  }

  .input-label {
    font-size: 14px;
    margin-bottom: 6px;
  }
}

/* 桌面端恢复显示 */
@media (min-width: 768px) {
  .mobile-hidden {
    display: block;
  }
  .mobile-brand {
    display: none;
  }
}
</style>
