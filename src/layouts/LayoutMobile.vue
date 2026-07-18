<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProfileStore } from '@/stores/profile'
import { usePushStore } from '@/stores/push'
import { DataBoard, ChatLineRound, MagicStick, User, ArrowLeft, Bell } from '@element-plus/icons-vue'
import { usePushSSE } from '@/composables/usePushSSE'
import { navDirection } from '@/composables/useNavDirection'

const profileStore = useProfileStore()
const pushStore = usePushStore()
const { connect: connectPushSSE } = usePushSSE()

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
const hideNav = computed(() => route.meta?.hideMobileNav === true)

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

// ===== 页面转场方向 =====
const transitionName = computed(() => {
  if (navDirection.value === 'tab') return 'mobile-tab'
  if (navDirection.value === 'back') return 'mobile-pop'
  return 'mobile-push'
})

onMounted(() => {
  profileStore.refreshProfile()
  if (profileStore.activeCourseId) {
    pushStore.fetchNotifications(profileStore.activeCourseId)
  }
  connectPushSSE()
})
</script>

<template>
  <div class="mobile-shell">
    <!-- 顶部导航栏（页面可通过 route.meta.hideMobileNav 自带顶栏时隐藏） -->
    <header v-if="!hideNav" class="mobile-nav" :style="{
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
          <button
            class="mobile-nav-bell"
            @click="router.push('/notifications')"
            aria-label="通知"
          >
            <el-icon :size="20"><Bell /></el-icon>
            <span
              v-if="pushStore.unreadCount > 0"
              class="mobile-bell-badge"
            >
              {{ pushStore.unreadCount > 99 ? '99+' : pushStore.unreadCount }}
            </span>
          </button>
        </div>
      </div>
    </header>

    <!-- 内容区 -->
    <main class="mobile-content" :class="{ 'has-tabbar': showTabBar, 'nav-hidden': hideNav }">
      <router-view v-slot="{ Component }">
        <transition :name="transitionName" mode="out-in">
          <div class="mobile-page-view" :key="route.path">
            <component :is="Component" />
          </div>
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
        <span v-if="isActive(tab)" class="mobile-tabbar-indicator" />
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
  height: 40px;
  padding: 0 4px;
}

.mobile-nav-left,
.mobile-nav-right {
  width: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-nav-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
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

/* 通知铃铛 */
.mobile-nav-bell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--lt-text-secondary);
  cursor: pointer;
  border-radius: 8px;
  transition: background-color 150ms ease-out;
  touch-action: manipulation;
}

.mobile-nav-bell:active {
  background-color: rgba(43, 111, 255, 0.06);
}

.mobile-bell-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--lt-danger);
  color: white;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
}

.mobile-nav-title {
  flex: 1;
  text-align: center;
  font-size: 15px;
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
  display: flex;
  flex-direction: column;
}

.mobile-content.has-tabbar {
  padding-bottom: calc(56px + var(--mobile-safe-area-inset-bottom, 0px));
}

.mobile-page-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
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
  position: relative;
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

/* 选中态顶部指示条 */
.mobile-tabbar-indicator {
  position: absolute;
  top: 0;
  left: 50%;
  width: 16px;
  height: 3px;
  border-radius: 2px;
  background: var(--lt-brand);
  transform: translateX(-50%);
  animation: tabIndicatorIn 0.15s ease-out;
}

@keyframes tabIndicatorIn {
  from { opacity: 0; transform: translateX(-50%) scaleX(0); }
  to { opacity: 1; transform: translateX(-50%) scaleX(1); }
}

.mobile-tabbar-label {
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
}

.mobile-tabbar-item.active .mobile-tabbar-label {
  font-weight: 600;
}

/* ===== 方向性页面转场 ===== */
/* 前进 push：新页从右滑入，旧页向左微退淡出 */
.mobile-push-enter-active {
  transition: transform 0.22s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.22s ease-out;
}
.mobile-push-leave-active {
  transition: transform 0.15s ease-in, opacity 0.15s ease-in;
}
.mobile-push-enter-from {
  transform: translateX(100%);
  opacity: 0.5;
}
.mobile-push-leave-to {
  transform: translateX(-30%);
  opacity: 0;
}

/* 返回 pop：新页从左滑入，旧页向右滑出（退出快于进入） */
.mobile-pop-enter-active {
  transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease-out;
}
.mobile-pop-leave-active {
  transition: transform 0.15s ease-in, opacity 0.15s ease-in;
}
.mobile-pop-enter-from {
  transform: translateX(-30%);
  opacity: 0;
}
.mobile-pop-leave-to {
  transform: translateX(100%);
  opacity: 0.5;
}

/* Tab 切换：交叉淡入淡出（无位移） */
.mobile-tab-enter-active {
  transition: opacity 0.15s ease-out;
}
.mobile-tab-leave-active {
  transition: opacity 0.15s ease-in;
}
.mobile-tab-enter-from {
  opacity: 0;
}
.mobile-tab-leave-to {
  opacity: 0;
}
</style>
