import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface UserInfo {
  username: string
  displayName: string
  major: string
  avatar?: string
}

export const useUserStore = defineStore('user', () => {
  const token = ref('')
  const userInfo = ref<UserInfo | null>(null)

  const isLoggedIn = computed(() => !!token.value)

  function login(username: string, password: string): boolean {
    // Mock 登录：实际应调后端 API
    if (username && password) {
      token.value = 'mock-token-' + Date.now()
      userInfo.value = {
        username,
        displayName: username,
        major: '软件工程',
      }
      return true
    }
    return false
  }

  function logout() {
    token.value = ''
    userInfo.value = null
  }

  return { token, userInfo, isLoggedIn, login, logout }
})
