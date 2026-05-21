<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProfileStore } from '@/stores/profile'
import { DataBoard, ChatLineRound, MagicStick, User, ArrowLeft } from '@element-plus/icons-vue'

const profileStore = useProfileStore()

const route = useRoute()
const router = useRouter()

// ===== TabBar 配置 =====
interface TabItem {
  path: string
  label: string
  icon: any
  routeName: string
}

const tabs: TabItem[] = [
  { path: '/', label: '首页', icon: DataBoard, routeName: 'dashboard-m' },
  { path: '/chat', label: '对话', icon: ChatLineRound, routeName: 'chat-m' },
  { path: '/studio', label: '工作室', icon: MagicStick, routeName: 'studio-m' },
  { path: '/profile', label: '我的', icon: User, routeName: 'profile-m' },
]

// ===== TabBar 可见性 =====
const tabBarRoutes = ['/dashboard-m', '/chat-m', '/studio-m', '/profile-m']
const showTabBar = computed(() => {
  return tabBarRoutes.some(r => route.name === r) ||
    route.path === '/' || route.path === '/chat' || route.path === '/studio' || route.path === '/profile'
})

// ===== 导航栏 =====
const pageTitle = computed(() => {
  return (route.meta?.title as string) || ''
})

const showBack = computed(() => {
  // TabBar 入口页面不显示返回按钮
  const isTabRoot = route.path === '/' || route.path === '/chat' ||
    route.path === '/studio' || route.path === '/profile'
  return !isTabRoot
})

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/')
  }
}

function handleTabClick(tab: TabItem) {
  router.push(tab.path)
}

const isActive = (tab: TabItem) => {
  if (tab.path === '/') return route.path === '/'
  return route.path.startsWith(tab.path)
}
</script>

<template>
  <div class="mobile-shell">
    <!-- 顶部导航栏 -->
    <header class="mobile-nav" :style="{
      paddingTop: 'var(--mobile-safe-area-inset-top)',
    }">
      <div class="mobile-nav-inner">
        <!-- 左侧 -->
        <div class="mobile-nav-left">
          <button
            v-if="showBack"
            class="mobile-nav-back"
            @click="goBack"
            aria-label="返回"
          >
            <el-icon :size="20"><ArrowLeft /></el-icon>
          </button>
        </div>

        <!-- 中间标题 -->
        <h1 class="mobile-nav-title">{{ pageTitle || '学思伴行' }}</h1>

        <!-- 右侧 -->
        <div class="mobile-nav-right">
          <slot name="nav-actions" />
        </div>
      </div>
    </header>

    <!-- 内容区 -->
    <main class="mobile-content" :class="{ 'has-tabbar': showTabBar }">
      <router-view v-slot="{ Component }">
        <transition name="mobile-page" mode="out-in">
          <component :is="Component" :key="profileStore.activeCourseId" />
        </transition>
      </router-view>
    </main>

    <!-- 底部 TabBar -->
    <nav
      v-if="showTabBar"
      class="mobile-tabbar"
      :style="{ paddingBottom: 'var(--mobile-safe-area-inset-bottom)' }"
    >
      <button
        v-for="tab in tabs"
        :key="tab.path"
        class="mobile-tabbar-item"
        :class="{ active: isActive(tab) }"
        @click="handleTabClick(tab)"
      >
        <el-icon :size="24"><component :is="tab.icon" /></el-icon>
        <span class="mobile-tabbar-label">{{ tab.label }}</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.mobile-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

/* ===== 顶部导航栏 ===== */
.mobile-nav {
  flex-shrink: 0;
  position: relative;
  z-index: 40;
  background: var(--lt-bg-card);
  border-bottom: 0.5px solid var(--lt-border);
}

.mobile-nav-inner {
  display: flex;
  align-items: center;
  height: 48px;
  padding: 0 8px;
}

.mobile-nav-left,
.mobile-nav-right {
  width: 48px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-nav-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  background: transparent;
  color: var(--lt-text-secondary);
  cursor: pointer;
  border-radius: 8px;
  transition: background-color 150ms ease-out;
  touch-action: manipulation;
}

.mobile-nav-back:active {
  background-color: rgba(43, 111, 255, 0.06);
}

.mobile-nav-title {
  flex: 1;
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  color: var(--lt-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

/* ===== 内容区 ===== */
.mobile-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

.mobile-content.has-tabbar {
  padding-bottom: calc(56px + var(--mobile-safe-area-inset-bottom, 0px));
}

/* ===== 底部 TabBar ===== */
.mobile-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  display: flex;
  justify-content: space-around;
  align-items: flex-start;
  height: 56px;
  background: var(--lt-bg-card);
  border-top: 0.5px solid var(--lt-border);
}

.mobile-tabbar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  flex: 1;
  height: 56px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--lt-text-placeholder);
  transition: color 150ms ease-out;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.mobile-tabbar-item.active {
  color: var(--lt-brand);
}

.mobile-tabbar-label {
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
}

.mobile-tabbar-item.active .mobile-tabbar-label {
  font-weight: 600;
}

/* ===== 页面过渡动画 ===== */
.mobile-page-enter-active {
  transition: opacity 0.15s ease-out, transform 0.2s ease-out;
}

.mobile-page-leave-active {
  transition: opacity 0.12s ease-in, transform 0.15s ease-in;
}

.mobile-page-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.mobile-page-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}
</style>
