<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { apiFetch } from '@/utils/api'
import type { AppNotification } from '@/types'
import { Bell } from '@element-plus/icons-vue'

const notifications = ref<AppNotification[]>([])
const loading = ref(false)
const loadError = ref(false)

onMounted(() => {
  fetchNotifications()
})

async function fetchNotifications() {
  loading.value = true
  loadError.value = false
  try {
    const res = await apiFetch<AppNotification[]>('/user/me/notifications?includeUnpushed=true')
    notifications.value = res.data || []
  } catch {
    notifications.value = []
    loadError.value = true
  } finally {
    loading.value = false
  }
}

async function markAsRead(id: string) {
  try {
    await apiFetch(`/user/me/notifications/${encodeURIComponent(id)}/read`, { method: 'PUT' })
    const n = notifications.value.find(item => item.id === id)
    if (n) n.isRead = true
  } catch { /* ignore */ }
}

async function markAllRead() {
  try {
    await apiFetch('/user/me/notifications/read-all', { method: 'PUT' })
    notifications.value.forEach(n => { n.isRead = true })
  } catch { /* ignore */ }
}

const grouped = computed(() => {
  const groups: Record<string, AppNotification[]> = {}
  for (const n of notifications.value) {
    const date = n.createdAt?.split('T')[0] || '未知日期'
    if (!groups[date]) groups[date] = []
    groups[date].push(n)
  }
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
})

const typeLabels: Record<string, string> = {
  resource_ready: '资源生成完成',
  review_flag: '审校提醒',
  profile_updated: '画像更新',
  task_done: '任务完成'
}
</script>

<template>
  <div class="max-w-lg">
    <!-- 加载中 -->
    <div v-if="loading" class="flex items-center justify-center h-48">
      <el-icon class="is-loading" :size="28" style="color: var(--lt-brand);"><Bell /></el-icon>
    </div>

    <!-- 加载失败 -->
    <div v-else-if="loadError" class="text-center py-8">
      <p class="text-sm mb-4" style="color: var(--lt-text-auxiliary);">通知加载失败</p>
      <el-button size="small" @click="fetchNotifications()">重试</el-button>
    </div>

    <!-- 空状态 -->
    <template v-else-if="!loading && notifications.length === 0">
      <div class="text-center py-12">
        <el-icon :size="48" style="color: var(--lt-text-placeholder);"><Bell /></el-icon>
        <p class="text-sm mt-3" style="color: var(--lt-text-auxiliary);">
          暂无消息。资源生成完成、画像更新等通知会出现在这里。
        </p>
      </div>
    </template>

    <!-- 列表 -->
    <template v-else>
      <div
        class="rounded-lg p-3 mb-4 flex items-center justify-between"
        style="background: linear-gradient(135deg, var(--lt-orange-light-9) 0%, rgba(255, 140, 66, 0.04) 100%); border: 1px solid var(--lt-orange-light-5);"
      >
        <div class="flex items-center gap-2">
          <span class="w-7 h-7 rounded-lg flex items-center justify-center" style="background-color: var(--lt-orange);">
            <el-icon :size="14" color="white"><Bell /></el-icon>
          </span>
          <span class="text-sm font-medium" style="color: var(--lt-text-primary);">
            消息通知 · {{ notifications.length }} 条
          </span>
        </div>
        <el-button link size="small" @click="markAllRead">全部已读</el-button>
      </div>

      <div v-for="[date, items] in grouped" :key="date" class="mb-4">
        <p class="text-xs mb-2" style="color: var(--lt-text-placeholder);">{{ date }}</p>
        <div
          v-for="n in items"
          :key="n.id"
          class="rounded-lg border p-3 mb-2 cursor-pointer transition-colors hover:bg-[var(--lt-brand-lightest)]"
          :class="{ 'border-l-2 border-l-[var(--lt-orange)]': !n.isPushed }"
          style="border-color: var(--lt-border);"
          @click="markAsRead(n.id)"
        >
          <div class="flex items-start gap-2">
            <span class="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" :style="{ backgroundColor: n.isRead ? 'transparent' : n.isPushed ? 'var(--lt-brand)' : 'var(--lt-orange)' }" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium" style="color: var(--lt-text-primary);">{{ typeLabels[n.type] || n.type }}</p>
              <p class="text-xs mt-0.5" style="color: var(--lt-text-secondary);">{{ n.title }}</p>
              <div class="flex items-center justify-between mt-1">
                <span class="text-xs" style="color: var(--lt-text-placeholder);">{{ n.createdAt?.split('T')[0] }}</span>
                <el-tag v-if="!n.isPushed" size="small" type="warning" effect="plain">离线通知</el-tag>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
