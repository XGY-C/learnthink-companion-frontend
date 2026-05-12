import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiFetch } from '@/utils/api'

export interface UserInfo {
  id: string
  username: string
  role?: string
  displayName?: string
  major?: string
  avatar?: string
}

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userInfo = ref<UserInfo | null>(JSON.parse(localStorage.getItem('userInfo') || 'null'))

  const isLoggedIn = computed(() => !!token.value)

  async function login(email: string, password: string): Promise<boolean> {
    try {
      const result = await apiFetch<{ accessToken: string; refreshToken?: string; user: UserInfo }>(
        '/auth/login',
        {
          method: 'POST',
          body: { email, password },
          skipAuth: true
        }
      )

      if (result.code === 0 || result.code === 200) {
        token.value = result.data.accessToken
        localStorage.setItem('token', token.value)
        if (result.data.refreshToken) {
          localStorage.setItem('refreshToken', result.data.refreshToken)
        }
        userInfo.value = result.data.user
        localStorage.setItem('userInfo', JSON.stringify(userInfo.value))
        return true
      }
      return false
    } catch (e) {
      console.error('Login failed', e)
      return false
    }
  }

  function logout() {
    token.value = ''
    userInfo.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('userInfo')
  }

  return { token, userInfo, isLoggedIn, login, logout }
})
