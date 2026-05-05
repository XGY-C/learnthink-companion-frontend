<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed, ref } from 'vue'

const route = useRoute()
const activeMenu = computed(() => route.path)
const isCollapsed = ref(false)

const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
}
</script>

<template>
  <div class="flex h-screen w-full overflow-hidden bg-gray-50">
    <!-- 左侧导航 -->
    <div
      class="bg-white border-r border-gray-200 flex flex-col flex-shrink-0 z-20 shadow-sm transition-all duration-300 relative"
      :class="isCollapsed ? 'w-16' : 'w-60'"
    >
      <!-- Logo 区域 -->
      <div
        class="h-16 flex items-center border-b border-gray-100 overflow-hidden transition-all duration-300"
        :class="isCollapsed ? 'justify-center px-0' : 'px-6'"
      >
        <template v-if="isCollapsed">
          <el-icon class="text-xl text-primary"><Monitor /></el-icon>
        </template>
        <template v-else>
          <h1 class="text-lg font-bold text-primary flex items-center gap-2 whitespace-nowrap">
            <el-icon class="text-xl"><Monitor /></el-icon>
            LearnThink
          </h1>
        </template>
      </div>

      <!-- 菜单区域 -->
      <div class="flex-1 overflow-y-auto py-4">
        <el-menu
          :default-active="activeMenu"
          class="border-none bg-transparent"
          router
          :collapse="isCollapsed"
        >
          <el-menu-item index="/">
            <el-icon><DataBoard /></el-icon>
            <template #title>驾驶舱 (Dashboard)</template>
          </el-menu-item>
          <el-menu-item index="/profile">
            <el-icon><User /></el-icon>
            <template #title>画像对话</template>
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
            <template #title>资源库库</template>
          </el-menu-item>
        </el-menu>
      </div>

      <!-- 用户信息 -->
      <div
        class="border-t border-gray-100 transition-all duration-300"
        :class="isCollapsed ? 'p-2 flex justify-center' : 'p-4'"
      >
        <template v-if="isCollapsed">
          <el-avatar :size="28" class="bg-primary text-white">L</el-avatar>
        </template>
        <template v-else>
          <div class="flex items-center gap-3">
            <el-avatar :size="32" class="bg-primary text-white">L</el-avatar>
            <div class="flex-1 min-w-0 text-sm">
              <p class="font-medium text-gray-800 truncate">测试用户</p>
              <p class="text-gray-500 text-xs truncate">软件工程专业</p>
            </div>
          </div>
        </template>
      </div>

      <!-- 收起/展开按钮 -->
      <div class="border-t border-gray-100 flex justify-center">
        <el-tooltip
          :content="isCollapsed ? '展开侧边栏' : '收起侧边栏'"
          :placement="isCollapsed ? 'right' : 'top'"
        >
          <button
            class="w-full py-2 flex items-center justify-center text-gray-400 hover:text-primary hover:bg-gray-50 transition-colors duration-200 outline-none cursor-pointer"
            @click="toggleSidebar"
          >
            <el-icon class="text-base">
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
      <header class="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-10 shadow-sm">
        <div class="text-gray-600 font-medium">
          当前课程: <span class="text-gray-900 border border-gray-200 px-2 py-1 rounded bg-gray-50 text-sm ml-2">👩‍💻 现代前端工程化基础</span>
        </div>
        <div class="flex items-center gap-4">
          <el-input placeholder="搜索资源/知识点..." prefix-icon="Search" style="width: 200px" />
          <el-button circle icon="Bell" />
          <el-button circle icon="Setting" />
        </div>
      </header>

      <!-- 页面内容容器 -->
      <main class="flex-1 overflow-hidden relative">
        <!-- 路由匹配到的具体视图（如画像对话页/工作室页） -->
        <router-view />
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
</style>
