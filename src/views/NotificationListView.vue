<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useProfileStore } from '@/stores/profile'
import { usePushStore } from '@/stores/push'
import { ElMessage } from 'element-plus'
import {
  Bell, Check, Delete, Document, Right
} from '@element-plus/icons-vue'
import type { AppNotification } from '@/types'

const router = useRouter()
const profileStore = useProfileStore()
const pushStore = usePushStore()

const loading = ref(false)

// 通知类型配置
const typeConfig: Record<string, { icon: string; label: string }> = {
  push_resource_ready: { icon: '📖', label: '新资源就绪' },
  push_weakness_found: { icon: '🎯', label: '薄弱项推荐' },
  push_path_next: { icon: '🚀', label: '学习路径推荐' },
  resource_ready: { icon: '📄', label: '资源就绪' },
  review_flag: { icon: '✅', label: '审核完成' },
  profile_updated: { icon: '📝', label: '画像更新' },
  task_done: { icon: '✨', label: '任务完成' },
}

function getTypeIcon(type: string): string {
  return typeConfig[type]?.icon ?? '📌'
}
function getTypeLabel(type: string): string {
  return typeConfig[type]?.label ?? type
}

// 按日期分组
const groupedNotifications = computed(() => {
  const groups: { date: string; items: AppNotification[] }[] = []
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)

  for (const n of pushStore.notifications) {
    const d = new Date(n.createdAt)
    let label: string
    if (d >= today) {
      label = '今天'
    } else if (d >= yesterday) {
      label = '昨天'
    } else {
      label = `${d.getMonth() + 1}月${d.getDate()}日`
    }

    let last = groups[groups.length - 1]
    if (!last || last.date !== label) {
      last = { date: label, items: [] }
      groups.push(last)
    }
    last.items.push(n)
  }
  return groups
})

async function fetchData() {
  loading.value = true
  try {
    await pushStore.fetchNotifications(profileStore.activeCourseId ?? '')
  } catch {
    // handled in store
  } finally {
    loading.value = false
  }
}

async function handleMarkRead(id: string) {
  await pushStore.markAsRead(id)
}

async function handleMarkAllRead() {
  await pushStore.markAllAsRead()
  ElMessage.success('已全部标为已读')
}

function handleClick(notif: AppNotification) {
  if (!notif.isRead) {
    handleMarkRead(notif.id)
  }
  if (notif.refId) {
    if (notif.refType === 'pack') {
      router.push(`/library?packId=${notif.refId}`)
    } else if (notif.refType === 'task') {
      router.push(`/studio/${notif.refId}`)
    }
  }
}

function handleIgnore(notif: AppNotification) {
  if (!notif.isRead) {
    handleMarkRead(notif.id)
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="notification-list-page h-full overflow-y-auto p-6">
    <!-- 页面标题 -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold flex items-center gap-2" style="color: var(--lt-text-primary);">
          <el-icon :size="24"><Bell /></el-icon>
          消息通知
        </h1>
        <p class="text-sm mt-1" style="color: var(--lt-text-auxiliary);">
          共 {{ pushStore.unreadCount }} 条未读
        </p>
      </div>
      <el-button
        v-if="pushStore.unreadCount > 0"
        plain
        size="small"
        @click="handleMarkAllRead"
      >
        <el-icon class="mr-1"><Check /></el-icon>
        全部标为已读
      </el-button>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="space-y-3">
      <div
        v-for="i in 3" :key="i"
        class="h-20 rounded-xl animate-pulse"
        style="background: var(--lt-bg-page);"
      />
    </div>

    <!-- 空状态 -->
    <div v-else-if="pushStore.notifications.length === 0" class="text-center py-16">
      <el-icon :size="48" style="color: var(--lt-text-auxiliary);"><Bell /></el-icon>
      <p class="mt-3 text-sm" style="color: var(--lt-text-auxiliary);">暂无通知</p>
    </div>

    <!-- 通知列表（按日期分组） -->
    <template v-else>
      <div
        v-for="group in groupedNotifications"
        :key="group.date"
        class="mb-6"
      >
        <p class="text-xs font-semibold mb-2 px-1" style="color: var(--lt-text-auxiliary);">
          {{ group.date }}
        </p>
        <div class="space-y-2">
          <div
            v-for="notif in group.items"
            :key="notif.id"
            class="flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all duration-150"
            :class="notif.isRead ? 'opacity-60' : ''"
            style="border: 1px solid var(--lt-border); background: var(--lt-bg-card);"
            :style="!notif.isRead ? { borderLeft: '3px solid var(--lt-brand)' } : {}"
            @click="handleClick(notif)"
          >
            <!-- 类型图标 -->
            <span class="text-xl flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                  style="background: var(--lt-bg-page);">
              {{ getTypeIcon(notif.type) }}
            </span>

            <!-- 内容 -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-0.5">
                <span class="text-xs px-1.5 py-0.5 rounded font-medium"
                      style="color: var(--lt-brand); background: rgba(43,111,255,0.08);">
                  {{ getTypeLabel(notif.type) }}
                </span>
                <span v-if="!notif.isRead" class="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
              </div>
              <p class="text-sm font-medium truncate" style="color: var(--lt-text-primary);">
                {{ notif.title }}
              </p>
              <p class="text-xs truncate mt-0.5" style="color: var(--lt-text-auxiliary);">
                {{ notif.message }}
              </p>
            </div>

            <!-- 时间 + 操作 -->
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="text-xs" style="color: var(--lt-text-auxiliary);">
                {{ new Date(notif.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}
              </span>
              <el-button
                link
                size="small"
                type="primary"
                @click.stop="handleClick(notif)"
              >
                去查看
                <el-icon class="ml-0.5"><Right /></el-icon>
              </el-button>
              <el-button
                link
                size="small"
                @click.stop="handleIgnore(notif)"
                style="color: var(--lt-text-auxiliary);"
              >
                忽略
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.notification-list-page {
  max-width: 780px;
  margin: 0 auto;
}
</style>
