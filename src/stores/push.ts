import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ScoredPack, RecommendationResponse, AppNotification, PushEvent } from '@/types'
import { apiFetch } from '@/utils/api'

/**
 * 精准推送 Store — 管理 Dashboard 推荐和推送通知
 */
export const usePushStore = defineStore('push', () => {
  // ===== Dashboard 推荐 =====
  const mainRecommendation = ref<ScoredPack | null>(null)
  const secondaryRecommendations = ref<ScoredPack[]>([])
  const recommendationsLoading = ref(false)

  // ===== 推送通知 =====
  const notifications = ref<AppNotification[]>([])
  const unreadCount = ref(0)
  const notificationsLoading = ref(false)

  // ===== SSE 实时推送事件缓存 =====
  const latestPushEvent = ref<PushEvent | null>(null)

  // ===== Actions =====

  /** 获取 Dashboard 推荐（主动查看场景） */
  async function fetchRecommendations(courseId: string) {
    if (!courseId) return
    recommendationsLoading.value = true
    try {
      const res = await apiFetch<RecommendationResponse>(
        `/resources/recommendations?course_id=${courseId}&limit=5`
      )
      if (res.data) {
        mainRecommendation.value = res.data.main
        secondaryRecommendations.value = res.data.secondary ?? []
      }
    } catch (e) {
      console.warn('Failed to fetch recommendations:', e)
    } finally {
      recommendationsLoading.value = false
    }
  }

  /** 获取推送通知列表 */
  async function fetchNotifications(courseId: string) {
    if (!courseId) return
    notificationsLoading.value = true
    try {
      const res = await apiFetch<{ notifications: AppNotification[]; unreadCount: number }>(
        `/resources/recommendations/notifications?course_id=${courseId}`
      )
      if (res.data) {
        notifications.value = res.data.notifications
        unreadCount.value = res.data.unreadCount
      }
    } catch (e) {
      console.warn('Failed to fetch push notifications:', e)
    } finally {
      notificationsLoading.value = false
    }
  }

  /** 处理 SSE push 事件 */
  function onPushEvent(event: PushEvent) {
    latestPushEvent.value = event
    unreadCount.value++

    // 插入到通知列表头部
    notifications.value.unshift({
      id: event.notificationId,
      type: event.type,
      title: event.title,
      message: event.message,
      isRead: false,
      isPushed: true,
      refId: event.refId,
      refType: event.refType,
      createdAt: event.createdAt,
    })

    // 最多保留 50 条
    if (notifications.value.length > 50) {
      notifications.value = notifications.value.slice(0, 50)
    }
  }

  /** 标记单条通知已读 */
  async function markAsRead(notificationId: string) {
    try {
      await apiFetch(`/resources/recommendations/notifications/${notificationId}/read`, {
        method: 'PUT',
      })
      const idx = notifications.value.findIndex(n => n.id === notificationId)
      if (idx >= 0) {
        notifications.value[idx] = { ...notifications.value[idx], isRead: true }
        if (unreadCount.value > 0) unreadCount.value--
      }
    } catch (e) {
      console.warn('Failed to mark notification as read:', e)
    }
  }

  /** 全部标为已读 */
  async function markAllAsRead() {
    try {
      await apiFetch('/resources/recommendations/notifications/read-all', { method: 'PUT' })
      notifications.value = notifications.value.map(n => ({ ...n, isRead: true }))
      unreadCount.value = 0
    } catch (e) {
      console.warn('Failed to mark all notifications as read:', e)
    }
  }

  /** 清除推荐数据 */
  function clearRecommendations() {
    mainRecommendation.value = null
    secondaryRecommendations.value = []
  }

  return {
    mainRecommendation,
    secondaryRecommendations,
    recommendationsLoading,
    notifications,
    unreadCount,
    notificationsLoading,
    latestPushEvent,
    fetchRecommendations,
    fetchNotifications,
    onPushEvent,
    markAsRead,
    markAllAsRead,
    clearRecommendations,
  }
})
