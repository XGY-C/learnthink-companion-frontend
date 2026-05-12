<script setup lang="ts">
import ChatPanel from '@/components/Profile/ChatPanel.vue'
import ProfilePanel from '@/components/Profile/ProfilePanel.vue'
</script>

<template>
  <div style="display: flex; height: 100%; width: 100%;">
    <!-- ChatPanel 容器高度设为 100%，适配父容器实际可用高度 -->
    <div style="flex: 1; min-width: 0; height: 100%; overflow: hidden;">
      <ChatPanel style="height: 100%;" />
    </div>
    <div style="width: 280px; flex-shrink: 0; height: 100%; overflow: hidden;">
      <ProfilePanel style="height: 100%;" />
    </div>
  </div>
</template>
