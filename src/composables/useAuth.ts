import { ref, onUnmounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { apiFetch } from '@/utils/api'

/**
 * 认证相关逻辑：验证码发送、登录、注册、登出、表单校验
 * 供 PC 和 Mobile 双端共用
 */

export function validateEmail(email: string): string {
  if (!email) return '请输入邮箱地址'
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) return '邮箱格式不正确'
  return ''
}

export function validatePassword(password: string): string {
  if (!password) return '请输入密码'
  if (password.length < 8) return '密码至少 8 个字符'
  if (password.length > 32) return '密码不超过 32 位'
  if (!/[a-z]/.test(password)) return '需包含小写字母'
  if (!/[A-Z]/.test(password)) return '需包含大写字母'
  if (!/[0-9]/.test(password)) return '需包含数字'
  return ''
}

export function useAuth() {
  const userStore = useUserStore()

  // ===== 验证码 =====
  const codeSending = ref(false)
  const codeSent = ref(false)
  const countdown = ref(0)
  const codeError = ref('')
  let countdownTimer: ReturnType<typeof setInterval> | undefined

  function clearCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = undefined
    }
  }

  function startCountdown() {
    countdown.value = 60
    codeSent.value = true
    clearCountdown()
    countdownTimer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearCountdown()
        codeSent.value = false
      }
    }, 1000)
  }

  async function sendVerificationCode(email: string): Promise<{ success: boolean; error: string }> {
    codeError.value = ''
    if (!email) {
      codeError.value = '请先输入邮箱地址'
      return { success: false, error: codeError.value }
    }

    const emailErr = validateEmail(email)
    if (emailErr) {
      codeError.value = emailErr
      return { success: false, error: emailErr }
    }

    codeSending.value = true
    try {
      const data = await apiFetch<Record<string, unknown>>('/auth/send-verification-code', {
        method: 'POST',
        body: { email },
        skipAuth: true,
      })

      if (data.code === 0 || data.code === 200) {
        startCountdown()
        return { success: true, error: '' }
      }
      codeError.value = (data.message as string) || '验证码发送失败'
      return { success: false, error: codeError.value }
    } catch {
      codeError.value = '验证码发送失败，请重试'
      return { success: false, error: codeError.value }
    } finally {
      codeSending.value = false
    }
  }

  // ===== 登录 =====
  async function login(email: string, password: string): Promise<{ success: boolean; error: string }> {
    const success = await userStore.login(email, password)
    return { success, error: success ? '' : '邮箱或密码不正确' }
  }

  // ===== 注册 =====
  async function register(params: {
    username: string
    email: string
    password: string
    verificationCode: string
  }): Promise<{ success: boolean; error: string }> {
    try {
      const data = await apiFetch<{ access_token: string; refresh_token?: string; user: unknown }>('/auth/register', {
        method: 'POST',
        body: {
          username: params.username,
          email: params.email,
          password: params.password,
          verificationCode: params.verificationCode,
        },
        skipAuth: true,
      })

      if (data.code === 0 || data.code === 200) {
        // 注册成功后自动登录
        await userStore.login(params.email, params.password)
        return { success: true, error: '' }
      }
      return { success: false, error: (data.message as string) || '注册失败' }
    } catch {
      return { success: false, error: '网络错误，请重试' }
    }
  }

  // ===== 登出 =====
  async function logout(): Promise<void> {
    try {
      await apiFetch('/auth/logout', { method: 'POST', skipAuth: true })
    } catch {
      // 即使 API 失败也清理本地状态
    }
    userStore.logout()
  }

  onUnmounted(() => {
    clearCountdown()
  })

  return {
    codeSending,
    codeSent,
    countdown,
    codeError,
    sendVerificationCode,
    login,
    register,
    logout,
  }
}
