<script setup lang="ts">
import ProfileChat from '@/components/Profile/ProfileChat.vue'
import ProfilePanel from '@/components/Profile/ProfilePanel.vue'
</script>

<template>
  <div class="flex h-screen w-full overflow-hidden bg-gray-50">
    <!-- 左侧主区：画像对话 -->
    <div class="flex-1 min-w-0">
      <ProfileChat />
    </div>

    <!-- 右侧：雷达图与偏好面板（遵循设计文档 320~360 宽度） -->
    <div class="w-80 lg:w-96 flex-shrink-0">
      <ProfilePanel />
    </div>
  </div>
</template>
