<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()
const activeMenu = computed(() => route.path)
</script>

<template>
  <div class="flex h-screen w-full overflow-hidden bg-gray-50">
    <!-- 左侧导航 -->
    <div class="w-60 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 z-20 shadow-sm">
      <div class="h-16 flex items-center px-6 border-b border-gray-100">
        <h1 class="text-lg font-bold text-primary flex items-center gap-2">
          <el-icon class="text-xl"><Monitor /></el-icon>
          LearnThink
        </h1>
      </div>
      <div class="flex-1 overflow-y-auto py-4">
        <el-menu
          :default-active="activeMenu"
          class="border-none bg-transparent"
          router
        >
          <el-menu-item index="/">
            <el-icon><DataBoard /></el-icon>
            <span>驾驶舱 (Dashboard)</span>
          </el-menu-item>
          <el-menu-item index="/profile">
            <el-icon><User /></el-icon>
            <span>画像对话</span>
          </el-menu-item>
          <el-menu-item index="/studio">
            <el-icon><MagicStick /></el-icon>
            <span>资源工作室</span>
          </el-menu-item>
          <el-menu-item index="/path">
            <el-icon><Guide /></el-icon>
            <span>学习路径</span>
          </el-menu-item>
          <el-menu-item index="/practice">
            <el-icon><EditPen /></el-icon>
            <span>针对练习</span>
          </el-menu-item>
          <el-menu-item index="/library">
            <el-icon><DataLine /></el-icon>
            <span>资源库库</span>
          </el-menu-item>
        </el-menu>
      </div>
      <div class="p-4 border-t border-gray-100">
        <div class="flex items-center gap-3">
          <el-avatar :size="32" class="bg-primary text-white">L</el-avatar>
          <div class="flex-1 min-w-0 text-sm">
            <p class="font-medium text-gray-800 truncate">测试用户</p>
            <p class="text-gray-500 text-xs truncate">软件工程专业</p>
          </div>
        </div>
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
