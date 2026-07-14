<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useProfileStore } from '@/stores/profile'
import { usePushStore } from '@/stores/push'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Bell, Check, Delete, Right, Refresh,
  Reading, Aim, Promotion, Document as DocIcon, CircleCheck, EditPen, MagicStick, InfoFilled
} from '@element-plus/icons-vue'
import type { AppNotification } from '@/types'
import type { Component } from 'vue'

const router = useRouter()
const profileStore = useProfileStore()
const pushStore = usePushStore()

const loading = ref(false)
const loadError = ref(false)
const filter = ref<'all' | 'unread'>('all')

// 通知类型配置
const typeConfig: Record<string, { icon: Component; label: string; color: string; bg: string }> = {
  push_resource_ready: { icon: Reading, label: '新资源就绪', color: 'var(--lt-brand)', bg: 'rgba(43,111,255,0.08)' },
  push_weakness_found: { icon: Aim, label: '薄弱项推荐', color: 'var(--lt-orange)', bg: 'rgba(255,140,66,0.08)' },
  push_path_next: { icon: Promotion, label: '学习路径推荐', color: 'var(--lt-ai)', bg: 'rgba(124,92,252,0.08)' },
  resource_ready: { icon: DocIcon, label: '资源就绪', color: 'var(--lt-success)', bg: 'rgba(52,199,89,0.08)' },
  review_flag: { icon: CircleCheck, label: '审核完成', color: 'var(--lt-success)', bg: 'rgba(52,199,89,0.08)' },
  profile_updated: { icon: EditPen, label: '画像更新', color: 'var(--lt-ai)', bg: 'rgba(124,92,252,0.08)' },
  task_done: { icon: MagicStick, label: '任务完成', color: 'var(--lt-warning)', bg: 'rgba(255,159,10,0.08)' },
}

function getTypeIcon(type: string): Component {
  return typeConfig[type]?.icon ?? InfoFilled
}
function getTypeLabel(type: string): string {
  return typeConfig[type]?.label ?? type
}
function getTypeColor(type: string): string {
  return typeConfig[type]?.color ?? 'var(--lt-text-auxiliary)'
}
function getTypeBg(type: string): string {
  return typeConfig[type]?.bg ?? 'rgba(142,142,160,0.08)'
}

// 过滤后的通知
const filteredNotifications = computed(() => {
  if (filter.value === 'unread') {
    return pushStore.notifications.filter(n => !n.isRead)
  }
  return pushStore.notifications
})

// 按日期分组
const groupedNotifications = computed(() => {
  const groups: { date: string; items: AppNotification[] }[] = []
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)

  for (const n of filteredNotifications.value) {
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
  loadError.value = false
  try {
    await pushStore.fetchNotifications(profileStore.activeCourseId ?? '')
  } catch {
    loadError.value = true
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

async function handleDelete(notif: AppNotification) {
  try {
    await ElMessageBox.confirm('确定删除这条通知吗？', '提示', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await pushStore.deleteNotification(notif.id)
    ElMessage.success('已删除')
  } catch {
    // 用户取消
  }
}

function handleClick(notif: AppNotification) {
  if (!notif.isRead) {
    handleMarkRead(notif.id)
  }
  if (notif.refType === 'daily') {
    router.push('/dashboard?focus=recommendations')
  } else if (notif.refId) {
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

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="notification-page h-full overflow-y-auto">
    <div class="notification-inner">
      <!-- 页面标题 -->
      <div class="notif-header">
        <div class="notif-header-left">
          <h1 class="notif-title">
            <span class="notif-title-icon">
              <el-icon :size="22"><Bell /></el-icon>
            </span>
            消息通知
          </h1>
          <p class="notif-subtitle">
            共 {{ pushStore.notifications.length }} 条通知<span v-if="pushStore.unreadCount > 0">，{{ pushStore.unreadCount }} 条未读</span>
          </p>
        </div>
        <div class="notif-header-actions">
          <el-button
            text
            size="small"
            :icon="Refresh"
            @click="fetchData"
            :loading="loading"
          >
            刷新
          </el-button>
          <el-button
            v-if="pushStore.unreadCount > 0"
            plain
            size="small"
            :icon="Check"
            @click="handleMarkAllRead"
          >
            全部已读
          </el-button>
        </div>
      </div>

      <!-- 筛选标签 -->
      <div v-if="pushStore.notifications.length > 0" class="notif-filter-bar">
        <button
          class="notif-filter-btn"
          :class="{ active: filter === 'all' }"
          @click="filter = 'all'"
        >
          全部
          <span class="notif-filter-count">{{ pushStore.notifications.length }}</span>
        </button>
        <button
          class="notif-filter-btn"
          :class="{ active: filter === 'unread' }"
          @click="filter = 'unread'"
        >
          未读
          <span class="notif-filter-count" :class="{ unread: pushStore.unreadCount > 0 }">{{ pushStore.unreadCount }}</span>
        </button>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="notif-skeleton-list">
        <div v-for="i in 4" :key="i" class="notif-skeleton-item">
          <div class="notif-skeleton-icon" />
          <div class="notif-skeleton-body">
            <div class="notif-skeleton-line w-1/4" />
            <div class="notif-skeleton-line w-3/4" />
            <div class="notif-skeleton-line w-1/2" />
          </div>
        </div>
      </div>

      <!-- 加载失败 -->
      <div v-else-if="loadError" class="notif-empty-state">
        <div class="notif-empty-icon error">
          <el-icon :size="40"><Bell /></el-icon>
        </div>
        <p class="notif-empty-text">通知加载失败</p>
        <el-button size="small" @click="fetchData">重试</el-button>
      </div>

      <!-- 空状态 -->
      <div v-else-if="filteredNotifications.length === 0" class="notif-empty-state">
        <div class="notif-empty-icon">
          <el-icon :size="40"><Bell /></el-icon>
        </div>
        <p class="notif-empty-text">
          {{ filter === 'unread' ? '没有未读通知' : '暂无通知' }}
        </p>
        <p v-if="filter === 'all'" class="notif-empty-hint">
          资源生成完成、画像更新等通知会出现在这里
        </p>
      </div>

      <!-- 通知列表（按日期分组） -->
      <template v-else>
        <div
          v-for="group in groupedNotifications"
          :key="group.date"
          class="notif-group"
        >
          <div class="notif-group-header">
            <span class="notif-group-date">{{ group.date }}</span>
            <span class="notif-group-line" />
          </div>
          <div class="notif-group-items">
            <div
              v-for="(notif, idx) in group.items"
              :key="notif.id"
              class="notif-card"
              :class="{ 'is-read': notif.isRead }"
              :style="{ animationDelay: (idx * 0.04) + 's' }"
              @click="handleClick(notif)"
            >
              <!-- 未读指示条 -->
              <span v-if="!notif.isRead" class="notif-unread-bar" />

              <!-- 类型图标 -->
              <span
                class="notif-type-icon"
                :style="{ background: getTypeBg(notif.type), color: getTypeColor(notif.type) }"
              >
                <el-icon :size="18"><component :is="getTypeIcon(notif.type)" /></el-icon>
              </span>

              <!-- 内容 -->
              <div class="notif-content">
                <div class="notif-content-top">
                  <span
                    class="notif-type-label"
                    :style="{ color: getTypeColor(notif.type), background: getTypeBg(notif.type) }"
                  >
                    {{ getTypeLabel(notif.type) }}
                  </span>
                  <span class="notif-time">{{ formatTime(notif.createdAt) }}</span>
                </div>
                <p class="notif-card-title">{{ notif.title }}</p>
                <p class="notif-card-message">{{ notif.message }}</p>
              </div>

              <!-- 操作 -->
              <div class="notif-actions">
                <el-button
                  v-if="notif.refId"
                  link
                  size="small"
                  type="primary"
                  @click.stop="handleClick(notif)"
                >
                  去查看
                  <el-icon class="ml-0.5"><Right /></el-icon>
                </el-button>
                <el-button
                  v-if="!notif.isRead"
                  link
                  size="small"
                  @click.stop="handleIgnore(notif)"
                  style="color: var(--lt-text-auxiliary);"
                >
                  忽略
                </el-button>
                <el-button
                  link
                  size="small"
                  @click.stop="handleDelete(notif)"
                  class="notif-delete-btn"
                >
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.notification-page {
  padding: 24px;
  scrollbar-gutter: stable;
}
.notification-inner {
  max-width: 720px;
  margin: 0 auto;
}

/* ====== 页面标题 ====== */
.notif-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
}
.notif-header-left {
  min-width: 0;
}
.notif-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--lt-text-primary);
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  letter-spacing: -0.02em;
}
.notif-title-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--lt-brand), var(--lt-brand-dark));
  color: #fff;
  box-shadow: 0 4px 12px var(--lt-shadow-blue);
}
.notif-subtitle {
  font-size: 0.8125rem;
  color: var(--lt-text-auxiliary);
  margin: 6px 0 0 46px;
}
.notif-header-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

/* ====== 筛选栏 ====== */
.notif-filter-bar {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
}
.notif-filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  min-height: 40px;
  border: 1px solid var(--lt-border);
  border-radius: 20px;
  background: var(--lt-bg-card);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--lt-text-secondary);
  cursor: pointer;
  transition: color var(--lt-transition-base),
              border-color var(--lt-transition-base),
              background-color var(--lt-transition-base);
}
.notif-filter-btn:hover {
  border-color: var(--lt-brand-lighter);
  color: var(--lt-brand);
}
.notif-filter-btn.active {
  border-color: var(--lt-brand);
  color: var(--lt-brand);
  background: var(--lt-brand-lightest);
}
.notif-filter-count {
  font-size: 0.6875rem;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--lt-bg-page);
  color: var(--lt-text-auxiliary);
  font-weight: 600;
  min-width: 18px;
  text-align: center;
}
.notif-filter-count.unread {
  background: var(--lt-danger);
  color: #fff;
}

/* ====== 骨架屏 ====== */
.notif-skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.notif-skeleton-item {
  display: flex;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--lt-border);
  border-radius: 12px;
  background: var(--lt-bg-card);
}
.notif-skeleton-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--lt-bg-page);
  flex-shrink: 0;
  animation: skeletonPulse 1.5s ease-in-out infinite;
}
.notif-skeleton-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.notif-skeleton-line {
  height: 12px;
  border-radius: 4px;
  background: var(--lt-bg-page);
  animation: skeletonPulse 1.5s ease-in-out infinite;
}
.notif-skeleton-line.w-1\/4 { width: 25%; }
.notif-skeleton-line.w-3\/4 { width: 75%; }
.notif-skeleton-line.w-1\/2 { width: 50%; }
@keyframes skeletonPulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.9; }
}

/* ====== 空状态 / 错误 ====== */
.notif-empty-state {
  text-align: center;
  padding: 64px 20px;
}
.notif-empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--lt-bg-page);
  color: var(--lt-text-placeholder);
  margin-bottom: 16px;
}
.notif-empty-icon.error {
  color: var(--lt-danger);
  background: rgba(255, 59, 48, 0.06);
}
.notif-empty-text {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--lt-text-secondary);
  margin: 0 0 4px;
}
.notif-empty-hint {
  font-size: 0.8125rem;
  color: var(--lt-text-auxiliary);
  margin: 0 0 16px;
}

/* ====== 日期分组 ====== */
.notif-group {
  margin-bottom: 20px;
}
.notif-group-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  padding: 0 2px;
}
.notif-group-date {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--lt-text-auxiliary);
  flex-shrink: 0;
}
.notif-group-line {
  flex: 1;
  height: 1px;
  background: var(--lt-border);
}

/* ====== 通知卡片 ====== */
.notif-group-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.notif-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid var(--lt-border);
  border-radius: 12px;
  background: var(--lt-bg-card);
  cursor: pointer;
  transition: border-color var(--lt-transition-smooth),
              box-shadow var(--lt-transition-smooth),
              transform var(--lt-transition-smooth);
  animation: notifCardFadeIn 0.35s cubic-bezier(0.4, 0, 0.2, 1) both;
}
.notif-card:hover {
  border-color: var(--lt-brand-lighter);
  box-shadow: var(--lt-shadow-hover);
  transform: translateY(-1px);
}
.notif-card.is-read .notif-card-title {
  color: var(--lt-text-secondary);
  font-weight: 400;
}

@keyframes notifCardFadeIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.notif-card.is-read {
  animation: notifCardFadeInRead 0.35s cubic-bezier(0.4, 0, 0.2, 1) both;
}
@keyframes notifCardFadeInRead {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 未读指示条 */
.notif-unread-bar {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  border-radius: 0 3px 3px 0;
  background: var(--lt-brand);
}

/* 类型图标 */
.notif-type-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  flex-shrink: 0;
}

/* 内容 */
.notif-content {
  flex: 1;
  min-width: 0;
}
.notif-content-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}
.notif-type-label {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
}
.notif-time {
  font-size: 0.6875rem;
  color: var(--lt-text-placeholder);
  white-space: nowrap;
  flex-shrink: 0;
}
.notif-card-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--lt-text-primary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.notif-card-message {
  font-size: 0.75rem;
  color: var(--lt-text-auxiliary);
  margin: 2px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 操作 */
.notif-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity var(--lt-transition-base);
}
.notif-card:hover .notif-actions {
  opacity: 1;
}
.notif-delete-btn {
  color: var(--lt-text-placeholder) !important;
}
.notif-delete-btn:hover {
  color: var(--lt-danger) !important;
}

/* ====== 响应式 ====== */
@media (max-width: 768px) {
  .notification-page {
    padding: 16px;
  }
  .notif-header {
    flex-direction: column;
    gap: 12px;
  }
  .notif-header-actions {
    align-self: flex-end;
  }
  .notif-subtitle {
    margin-left: 0;
  }
  .notif-card {
    padding: 12px;
    gap: 10px;
  }
  .notif-type-icon {
    width: 36px;
    height: 36px;
  }
  .notif-type-icon :deep(.el-icon) {
    font-size: 16px;
  }
  .notif-actions {
    opacity: 1;
    flex-direction: column;
    gap: 0;
  }
  .notif-card-message {
    white-space: normal;
    -webkit-line-clamp: 2;
    display: -webkit-box;
    -webkit-box-orient: vertical;
  }
}

/* ====== 无障碍：减弱动画 ====== */
@media (prefers-reduced-motion: reduce) {
  .notif-card,
  .notif-card.is-read {
    animation: none;
  }
  .notif-skeleton-icon,
  .notif-skeleton-line {
    animation: none;
    opacity: 0.7;
  }
  .notif-card {
    transition: none;
  }
}
</style>
