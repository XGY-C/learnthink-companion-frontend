<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed, ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { useProfileStore } from '@/stores/profile'
import type { CourseInfo } from '@/stores/profile'
import { Search, Fold, Expand, DataBoard, User, MagicStick, Guide, EditPen, DataLine, ArrowDown } from '@element-plus/icons-vue'

const route = useRoute()
const userStore = useUserStore()
const profileStore = useProfileStore()
const activeMenu = computed(() => route.path)
const isCollapsed = ref(false)

const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
}
</script>

<template>
  <div class="flex h-screen w-full overflow-hidden" style="background-color: var(--lt-bg-page);">
    <!--
      ============================================
      左侧导航（v2.2 浅色版）
      背景: 纯白 #FFFFFF
      激活态: #2B6FFF 文字 + #E8F0FE 浅蓝底 + 3px 蓝色左指示条
      与主内容区分割: 右侧阴影
      ============================================
    -->
    <div
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
            <template #title>驾驶舱 (Dashboard)</template>
          </el-menu-item>
          <el-menu-item index="/chat">
            <el-icon><ChatLineRound /></el-icon>
            <template #title>AI 学习助手</template>
          </el-menu-item>
          <el-menu-item index="/studio">
            <el-icon><MagicStick /></el-icon>
            <template #title>资源工作室</template>
          </el-menu-item>
          <el-menu-item index="/path">
            <el-icon><Guide /></el-icon>
            <template #title>学习路径</template>
          </el-menu-item>
          <el-menu-item index="/practice">
            <el-icon><EditPen /></el-icon>
            <template #title>针对练习</template>
          </el-menu-item>
          <el-menu-item index="/library">
            <el-icon><DataLine /></el-icon>
            <template #title>资源库</template>
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
          <el-avatar :size="28" style="background: linear-gradient(135deg, var(--lt-brand), var(--lt-brand-dark));">L</el-avatar>
        </template>
        <template v-else>
          <div class="flex items-center gap-3">
            <el-avatar :size="32" style="background: linear-gradient(135deg, var(--lt-brand), var(--lt-brand-dark));">L</el-avatar>
            <div class="flex-1 min-w-0 text-sm">
              <p class="font-medium truncate" style="color: var(--lt-text-primary);">{{ userStore.userInfo?.displayName || '测试用户' }}</p>
              <p class="text-xs truncate" style="color: var(--lt-text-auxiliary);">{{ userStore.userInfo?.major || '软件工程专业' }}</p>
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
          <el-icon class="text-gray-300 cursor-pointer hover:text-[#2B6FFF] transition-colors text-lg" @click="isCollapsed = !isCollapsed">
            <Fold />
          </el-icon>
          <div class="text-sm text-gray-500 flex items-center gap-1">
            当前课程
            <el-dropdown trigger="click" @command="(course: CourseInfo) => profileStore.switchCourse(course)">
              <span class="font-medium px-3 py-1.5 rounded-full text-sm ml-2 border cursor-pointer select-none hover:shadow-sm transition-all"
                style="color: #5A5A72; background-color: #E8F0FE; border-color: #D6E4FF;">
                <span class="mr-1">{{ profileStore.activeCourse.emoji }}</span>
                {{ profileStore.activeCourse.name }}
                <el-icon :size="10" class="ml-0.5 text-gray-400"><ArrowDown /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-for="c in profileStore.courses" :key="c.id" :command="c"
                    :class="{ 'is-active': c.id === profileStore.activeCourseId }">
                    <span class="mr-1">{{ c.emoji }}</span>{{ c.name }}
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
          <el-button
            circle
            icon="Bell"
            class="header-icon-btn !border-0 !bg-transparent hover:!bg-gray-100"
          >
            <span class="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white"></span>
          </el-button>
          <el-button
            circle
            icon="Setting"
            class="header-icon-btn !border-0 !bg-transparent hover:!bg-gray-100"
          />
          <el-divider direction="vertical" class="!h-5 !mx-1" />
          <el-avatar :size="32" class="cursor-pointer ring-2 ring-white shadow-sm" style="background: linear-gradient(135deg, var(--lt-brand), var(--lt-brand-dark));">
            L
          </el-avatar>
        </div>
      </header>

      <!-- 页面内容容器 -->
      <main class="flex-1 overflow-hidden relative">
        <!-- 路由匹配到的具体视图（如画像对话页/工作室页） -->
        <router-view v-slot="{ Component, route }">
          <transition name="page">
            <div class="page-view" :key="route.fullPath">
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
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
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
  padding: 0 8px !important;
  border-radius: 6px;
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
