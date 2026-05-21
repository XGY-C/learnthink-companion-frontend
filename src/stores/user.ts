import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiFetch } from '@/utils/api'
import type { UserInfo, UpdateProfileRequest } from '@/types'

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

  /** 从后端拉取最新用户信息 */
  async function fetchMe() {
    try {
      const res = await apiFetch<UserInfo>('/user/me')
      if (res.data) {
        userInfo.value = res.data
        localStorage.setItem('userInfo', JSON.stringify(res.data))
      }
    } catch (e) {
      console.error('Failed to fetch user info', e)
    }
  }

  /** 更新个人资料 */
  async function updateProfile(request: UpdateProfileRequest): Promise<UserInfo | null> {
    try {
      const res = await apiFetch<UserInfo>('/user/profile', {
        method: 'PUT',
        body: request
      })
      if (res.data) {
        userInfo.value = res.data
        localStorage.setItem('userInfo', JSON.stringify(res.data))
        return res.data
      }
      return null
    } catch (e) {
      console.error('Failed to update profile', e)
      return null
    }
  }

  /** 上传头像 */
  async function uploadAvatar(file: File): Promise<string | null> {
    try {
      const formData = new FormData()
      formData.append('file', file)
      const token = localStorage.getItem('token')
      const res = await fetch('/api/user/avatar', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
      const result = await res.json()
      if (result.code === 0 || result.code === 200) {
        const avatarUrl = result.data as string
        if (userInfo.value) {
          userInfo.value = { ...userInfo.value, avatarUrl }
          localStorage.setItem('userInfo', JSON.stringify(userInfo.value))
        }
        return avatarUrl
      }
      return null
    } catch (e) {
      console.error('Failed to upload avatar', e)
      return null
    }
  }

  return { token, userInfo, isLoggedIn, login, logout, fetchMe, updateProfile, uploadAvatar }
})
