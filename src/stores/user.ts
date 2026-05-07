import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

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

  async function login(username: string, password: string): Promise<boolean> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ username, password })
      })
      const data = await res.json()
      if (res.ok && (data.code === 0 || data.code === 200)) {
        token.value = data.data.accessToken
        localStorage.setItem('token', token.value)
        if (data.data.refreshToken) {
          localStorage.setItem('refreshToken', data.data.refreshToken)
        }
        userInfo.value = data.data.user
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
