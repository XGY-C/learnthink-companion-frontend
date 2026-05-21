<script setup lang="ts">
import { useNotificationStore } from '@/stores/notification'
import { useRouter } from 'vue-router'

const notification = useNotificationStore()
const router = useRouter()

function handleNotificationClick(item: any) {
  if (item.packId) {
    router.push(`/studio/${item.taskId || ''}?pack_id=${item.packId}`)
  } else if (item.taskId) {
    router.push(`/studio/${item.taskId}`)
  }
  notification.remove(item.id)
}
</script>

<template>
  <el-config-provider>
    <div class="app-router-wrap">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <div class="page-view">
            <component :is="Component" />
          </div>
        </transition>
      </router-view>
    </div>

    <!-- 全局通知栈 -->
    <TransitionGroup
      name="notif-stack"
      tag="div"
      class="notification-stack"
    >
      <div
        v-for="item in notification.visibleNotifications"
        :key="item.id"
        class="notification-toast"
        :class="`notif-${item.type}`"
        @click="handleNotificationClick(item)"
      >
        <!-- 左边框指示器 -->
        <div class="notif-indicator" :class="item.type === 'success' ? 'bg-green-500' : 'bg-red-500'" />
        <div class="notif-body">
          <div class="notif-header">
            <span class="notif-icon">{{ item.type === 'success' ? '🎉' : '⚠️' }}</span>
            <span class="notif-title">{{ item.title }}</span>
            <button class="notif-close" @click.stop="notification.remove(item.id)">✕</button>
          </div>
          <p class="notif-message">{{ item.message }}</p>
          <div v-if="item.resourceTypes" class="notif-tags">
            <span v-for="t in item.resourceTypes" :key="t" class="notif-tag">{{ t }}</span>
          </div>
        </div>
      </div>
    </TransitionGroup>
  </el-config-provider>
</template>

<style>
#app {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  text-align: left;
  max-width: none !important;
  background-color: var(--lt-bg-page, #f5f7fb);
}

body {
  margin: 0;
  padding: 0;
  background-color: var(--lt-bg-page, #f5f7fb);
}

.app-router-wrap {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.page-view {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.page-enter-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.page-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.99);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.995);
}

/* 全局通知栈 */
.notification-stack {
  position: fixed;
  top: calc(24px + env(safe-area-inset-top, 0px));
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none;
}

.notification-toast {
  width: min(360px, calc(100vw - 32px));
  display: flex;
  background: var(--lt-bg-card);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  pointer-events: auto;
  overflow: hidden;
  transition: box-shadow 0.15s;
}
.notification-toast:hover {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}

.notif-indicator {
  width: 4px;
  flex-shrink: 0;
}

.notif-body {
  flex: 1;
  padding: 16px;
  min-width: 0;
}

.notif-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.notif-icon { font-size: 16px; }

.notif-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--lt-text-primary);
  flex: 1;
}

.notif-close {
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--lt-text-auxiliary);
  font-size: 14px;
  padding: 2px;
}
.notif-close:hover { color: var(--lt-text-secondary); }

.notif-message {
  font-size: 13px;
  color: var(--lt-text-secondary);
  margin: 0 0 8px;
  line-height: 1.5;
}

.notif-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.notif-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(43, 111, 255, 0.06);
  color: var(--lt-brand);
}

/* 通知动画 */
.notif-stack-enter-active {
  transition: all 0.3s ease-out;
}
.notif-stack-leave-active {
  transition: all 0.2s ease-in;
}
.notif-stack-enter-from {
  opacity: 0;
  transform: translateX(120%);
}
.notif-stack-leave-to {
  opacity: 0;
  transform: translateX(120%);
}
</style>
