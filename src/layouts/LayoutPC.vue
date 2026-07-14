<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { computed, ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { useProfileStore } from '@/stores/profile'
import { usePushStore } from '@/stores/push'
import type { CourseInfo } from '@/types'
import { Search, Fold, Expand, DataBoard, User, Guide, DataAnalysis, ArrowDown, SwitchButton, Bell } from '@element-plus/icons-vue'
import ForumIcon from '@/components/icons/ForumIcon.vue'
import LibraryIcon from '@/components/icons/LibraryIcon.vue'
import LayersIcon from '@/components/icons/LayersIcon.vue'
import { useAuth } from '@/composables/useAuth'
import { usePushSSE } from '@/composables/usePushSSE'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const profileStore = useProfileStore()
const pushStore = usePushStore()
const { logout } = useAuth()
const { connect: connectPushSSE } = usePushSSE()
const activeMenu = computed(() => route.path)
const isCollapsed = ref(false)
const hideSidebar = computed(() => route.meta.hideSidebar === true)

const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
}

async function handleCourseCommand(cmd: { type: string; course?: CourseInfo }) {
  if (cmd.type === 'switch' && cmd.course) {
    profileStore.switchCourse(cmd.course)
  } else if (cmd.type === 'add') {
    router.push('/courses')
  }
}

/** 处理通知下拉面板中的通知点击 */
async function handleNotificationClick(notif: { id: string; refId?: string; refType?: string; isRead: boolean }) {
  if (!notif.isRead) {
    await pushStore.markAsRead(notif.id)
  }
  if (notif.refType === 'daily') {
    router.push('/dashboard?focus=recommendations')
  } else if (notif.refId) {
    if (notif.refType === 'task') {
      router.push(`/studio/${notif.refId}`)
    } else {
      router.push(`/library?packId=${notif.refId}`)
    }
  }
}

function handleDropdownCommand(cmd: unknown) {
  if (cmd === 'all') {
    router.push('/notifications')
  }
}

async function handleUserMenuCommand(command: string) {
  if (command === 'profile') {
    router.push('/profile')
  } else if (command === 'logout') {
    await logout()
    router.push('/login')
  }
}

onMounted(() => {
  profileStore.refreshProfile()
  // 初始化推送通知数量
  if (profileStore.activeCourseId) {
    pushStore.fetchNotifications(profileStore.activeCourseId)
  }
  // 连接 SSE 实时推送
  connectPushSSE()
})
</script>

<template>
  <div class="flex h-screen w-full overflow-hidden">
    <!--
      ============================================
      左侧导航（v2.2 浅色版）
      背景: 纯白 #FFFFFF
      激活态: #2B6FFF 文字 + #E8F0FE 浅蓝底 + 3px 蓝色左指示条
      与主内容区分割: 右侧阴影
      ============================================
    -->
    <div
      v-if="!hideSidebar"
      class="flex flex-col flex-shrink-0 z-20 transition-all duration-300 relative"
      :class="isCollapsed ? 'w-16' : 'w-60'"
      style="background-color: var(--nav-bg); box-shadow: var(--nav-shadow);"
    >
            <!-- Logo 区域 -->
      <div
        class="h-16 flex items-center overflow-hidden transition-all duration-300"
        :class="isCollapsed ? 'justify-center px-0' : 'px-6'"
        style="border-bottom: 1px solid var(--nav-divider);"
      >
        <template v-if="isCollapsed">
          <img src="/logo.svg" alt="Logo" class="w-9 h-9 object-contain" />
        </template>
        <template v-else>
          <h1 class="text-xl font-bold flex items-center gap-2.5 whitespace-nowrap">
            <img src="/logo.svg" alt="Logo" class="w-9 h-9 object-contain" />
            <span class="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-blue-500 to-orange-400 tracking-wide" style="font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;">学思伴行</span>
          </h1>
        </template>
      </div>

      <!-- 菜单区域 -->
      <div class="flex-1 overflow-y-auto py-4">
        <el-menu
          :default-active="activeMenu"
          class="border-none"
          router
          :collapse="isCollapsed"
          style="background-color: transparent;"
        >
          <el-menu-item index="/">
            <el-icon><DataBoard /></el-icon>
            <template #title>学习总览</template>
          </el-menu-item>
          <el-menu-item index="/chat">
            <el-icon><ChatLineRound /></el-icon>
            <template #title>AI 学习助手</template>
          </el-menu-item>
          <el-menu-item index="/studio">
            <el-icon><LayersIcon /></el-icon>
            <template #title>资源工作室</template>
          </el-menu-item>
          <el-menu-item index="/path">
            <el-icon><Guide /></el-icon>
            <template #title>学习路径</template>
          </el-menu-item>
          <el-menu-item index="/library">
            <el-icon><LibraryIcon /></el-icon>
            <template #title>资源库</template>
          </el-menu-item>
          <el-menu-item index="/forum">
            <el-icon><ForumIcon /></el-icon>
            <template #title>学习论坛</template>
          </el-menu-item>
          <el-menu-item index="/report">
            <el-icon><DataAnalysis /></el-icon>
            <template #title>学习报告</template>
          </el-menu-item>

          <el-menu-item index="/profile">
            <el-icon><User /></el-icon>
            <template #title>个人中心</template>
          </el-menu-item>
        </el-menu>
      </div>

      <!-- 用户信息 -->
      <div
        class="transition-all duration-300"
        :class="isCollapsed ? 'p-2 flex justify-center' : 'p-4'"
        style="border-top: 1px solid var(--nav-divider);"
      >
        <template v-if="isCollapsed">
          <el-avatar :size="28" :src="userStore.userInfo?.avatarUrl" class="cursor-pointer" style="background: linear-gradient(135deg, var(--lt-brand), var(--lt-brand-dark));" @click="router.push('/profile')">
            {{ userStore.userInfo?.displayName?.charAt(0) || userStore.userInfo?.username?.charAt(0) || 'L' }}
          </el-avatar>
        </template>
        <template v-else>
          <div class="flex items-center gap-3 cursor-pointer rounded-lg p-1 -m-1 transition-colors hover:bg-[var(--lt-brand-lightest)]" @click="router.push('/profile')">
            <el-avatar :size="32" :src="userStore.userInfo?.avatarUrl" style="background: linear-gradient(135deg, var(--lt-brand), var(--lt-brand-dark));">
              {{ userStore.userInfo?.displayName?.charAt(0) || userStore.userInfo?.username?.charAt(0) || 'L' }}
            </el-avatar>
            <div class="flex-1 min-w-0 text-sm">
              <p class="font-medium truncate" style="color: var(--lt-text-primary);">{{ userStore.userInfo?.displayName || userStore.userInfo?.username || '测试用户' }}</p>
              <p class="text-xs truncate" style="color: var(--lt-text-auxiliary);">{{ userStore.userInfo?.major || '未设置专业' }}</p>
            </div>
          </div>
        </template>
      </div>

      <!-- 收起/展开按钮 -->
      <div style="border-top: 1px solid var(--nav-divider);">
        <el-tooltip
          :content="isCollapsed ? '展开侧边栏' : '收起侧边栏'"
          :placement="isCollapsed ? 'right' : 'top'"
        >
          <button
            class="w-full py-2.5 flex items-center justify-center transition-all duration-200 outline-none cursor-pointer group"
            style="color: var(--lt-text-auxiliary);"
            @click="toggleSidebar"
            @mouseenter="(e) => { (e.target as HTMLElement).style.color = 'var(--lt-brand)' }"
            @mouseleave="(e) => { (e.target as HTMLElement).style.color = 'var(--lt-text-auxiliary)' }"
          >
            <el-icon class="text-base transition-transform duration-300 group-hover:scale-110">
              <Fold v-if="!isCollapsed" />
              <Expand v-else />
            </el-icon>
          </button>
        </el-tooltip>
      </div>
    </div>

    <!-- 右侧主体 -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- 顶部 Header -->
      <header class="h-16 flex items-center justify-between px-6 z-10" style="background-color: rgba(255, 255, 255, 0.8); backdrop-filter: blur(12px); border-bottom: 1px solid var(--lt-border); box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
        <div class="flex items-center gap-3">
          <el-icon v-if="!hideSidebar" class="text-gray-300 cursor-pointer hover:text-[#2B6FFF] transition-colors text-lg" @click="isCollapsed = !isCollapsed">
            <Fold />
          </el-icon>
          <div class="text-sm text-gray-500 flex items-center gap-1">
            当前课程
            <el-dropdown trigger="click" @command="handleCourseCommand">
              <span class="font-medium px-3 py-1.5 rounded-full text-sm ml-2 border cursor-pointer select-none hover:shadow-sm transition-all"
                style="color: #5A5A72; background-color: #E8F0FE; border-color: #D6E4FF;">
                <span class="mr-1">{{ profileStore.activeCourse?.emoji || '📚' }}</span>
                {{ profileStore.activeCourse?.name || '未选择课程' }}
                <el-icon :size="10" class="ml-0.5 text-gray-400"><ArrowDown /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="c in profileStore.courses" :key="c.id"
                    :command="{ type: 'switch', course: c }"
                    :class="{ 'is-active': c.id === profileStore.activeCourseId }">
                    <span class="mr-1">{{ c.emoji }}</span>{{ c.name }}
                    <span v-if="c.id === profileStore.activeCourseId" class="ml-1 text-blue-500">✓</span>
                  </el-dropdown-item>
                  <el-dropdown-item divided :command="{ type: 'add' }">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--lt-ai)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: -2px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    管理课程
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="relative">
            <el-input
              placeholder="搜索资源 / 知识点..."
              :prefix-icon="Search"
              style="width: 220px"
              class="search-input"
            />
          </div>
          <el-dropdown trigger="click" @command="handleDropdownCommand">
            <el-button
              circle
              class="header-icon-btn !border-0 !bg-transparent hover:!bg-gray-100"
              @click="pushStore.fetchNotifications(profileStore.activeCourseId ?? '')"
            >
              <el-icon><Bell /></el-icon>
              <span
                v-if="pushStore.unreadCount > 0"
                class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 ring-2 ring-white"
              >
                {{ pushStore.unreadCount > 99 ? '99+' : pushStore.unreadCount }}
              </span>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu class="w-80 max-h-96 overflow-y-auto">
                <div class="px-3 py-2 border-b" style="border-color: var(--lt-border);">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-semibold" style="color: var(--lt-text-primary);">通知中心</span>
                    <el-button
                      v-if="pushStore.unreadCount > 0"
                      link
                      size="small"
                      type="primary"
                      @click="pushStore.markAllAsRead()"
                    >全部已读</el-button>
                  </div>
                </div>
                <div v-if="pushStore.notifications.length === 0" class="px-3 py-6 text-center text-sm" style="color: var(--lt-text-auxiliary);">
                  暂无推送通知
                </div>
                <el-dropdown-item
                  v-for="notif in pushStore.notifications.slice(0, 5)"
                  :key="notif.id"
                  :command="notif.id"
                  class="!py-2 !px-3"
                  @click="handleNotificationClick(notif)"
                >
                  <div class="flex flex-col gap-0.5">
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs" style="color: var(--lt-warning);">{{ notif.type.startsWith('push_') ? '🎯' : '📝' }}</span>
                      <span class="text-xs font-medium" style="color: var(--lt-text-primary);">{{ notif.title }}</span>
                      <span v-if="!notif.isRead" class="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"></span>
                    </div>
                    <span class="text-xs truncate" style="color: var(--lt-text-auxiliary);">{{ notif.message }}</span>
                  </div>
                </el-dropdown-item>
                <el-dropdown-item command="all" divided class="text-center">
                  <span class="text-xs" style="color: var(--lt-brand);">查看全部通知</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-divider direction="vertical" class="!h-5 !mx-1" />
          <el-dropdown trigger="click" @command="handleUserMenuCommand">
            <el-avatar :size="32" :src="userStore.userInfo?.avatarUrl" class="cursor-pointer ring-2 ring-white shadow-sm" style="background: linear-gradient(135deg, var(--lt-brand), var(--lt-brand-dark));">
              {{ userStore.userInfo?.displayName?.charAt(0) || userStore.userInfo?.username?.charAt(0) || 'L' }}
            </el-avatar>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><User /></el-icon> 个人中心
                </el-dropdown-item>
                <el-dropdown-item command="logout" divided>
                  <el-icon><SwitchButton /></el-icon> 退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <!-- 页面内容容器 -->
      <main class="flex-1 overflow-y-auto relative">
        <!-- 路由匹配到的具体视图（如画像对话页/工作室页） -->
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <div class="page-view" :key="profileStore.activeCourseId">
              <component :is="Component" />
            </div>
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<style scoped>
.text-primary {
  color: var(--el-color-primary);
}
.bg-primary {
  background-color: var(--el-color-primary);
}

/*
  ============================================
  v2.2 浅色导航栏菜单样式
  默认: #5A5A72 文字
  hover: rgba(43,111,255,0.06) 浅蓝底
  激活: #2B6FFF 文字 + #E8F0FE 浅蓝底 + 3px 左指示条
  ============================================
*/
:deep(.el-menu) {
  border: none !important;
}
:deep(.el-menu-item) {
  border-radius: 8px;
  margin: 2px 8px;
  padding: 0 12px !important;
  transition: color 150ms cubic-bezier(0.4, 0, 0.2, 1), background-color 150ms cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 0.9rem;
  color: var(--nav-item-default) !important;
}
:deep(.el-menu-item:hover) {
  background-color: var(--nav-item-hover-bg) !important;
  color: var(--lt-brand) !important;
}
:deep(.el-menu-item.is-active) {
  background-color: var(--nav-item-active-bg) !important;
  color: var(--nav-item-active) !important;
  font-weight: 600;
  box-shadow: inset 3px 0 0 var(--nav-indicator);
}
:deep(.el-menu--collapse .el-menu-item) {
  margin: 2px 6px;
  padding: 0 !important;
  justify-content: center;
  border-radius: 6px;
}
:deep(.el-menu--collapse .el-menu-item .el-menu-tooltip__trigger) {
  justify-content: center;
  width: 100%;
}
:deep(.el-menu--collapse .el-menu-item .el-icon) {
  margin: 0;
}
:deep(.el-menu--collapse .el-menu-item.is-active) {
  box-shadow: none;
  background-color: var(--nav-item-active-bg) !important;
}

/* 顶部搜索框美化 */
:deep(.search-input .el-input__wrapper) {
  background: var(--lt-bg-page);
  border-radius: 20px;
  box-shadow: none !important;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}
:deep(.search-input .el-input__wrapper:hover),
:deep(.search-input .el-input__wrapper.is-focus) {
  background: #ffffff;
  border-color: var(--lt-brand-lighter);
  box-shadow: 0 0 0 2px rgba(43, 111, 255, 0.1) !important;
}

/* Header 图标按钮 */
:deep(.header-icon-btn) {
  position: relative;
  font-size: 18px;
  color: var(--lt-text-auxiliary);
  transition: all 0.2s ease;
}
:deep(.header-icon-btn:hover) {
  color: var(--lt-brand) !important;
  background: var(--lt-brand-lightest) !important;
}
</style>
