import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { NotificationItem } from '@/types'

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<NotificationItem[]>([])
  let seq = 0

  const visibleNotifications = computed(() =>
    notifications.value.slice(0, 3)
  )

  function push(item: Omit<NotificationItem, 'id' | 'timestamp'>) {
    const id = `notif_${Date.now()}_${++seq}`
    notifications.value.unshift({
      ...item,
      id,
      timestamp: Date.now(),
    })

    // 成功通知 8s 后自动消失，失败通知不自动消失
    if (item.type === 'success') {
      setTimeout(() => remove(id), 8000)
    }
  }

  function remove(id: string) {
    const idx = notifications.value.findIndex(n => n.id === id)
    if (idx !== -1) notifications.value.splice(idx, 1)
  }

  function clear() {
    notifications.value = []
  }

  return { notifications, visibleNotifications, push, remove, clear }
})
