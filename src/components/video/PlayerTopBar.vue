<script setup lang="ts">
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div class="player-topbar">
    <button class="topbar-btn" @click="emit('close')" title="返回聊天">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
      </svg>
    </button>
    <button class="topbar-btn topbar-close" @click="emit('close')" title="退出讲解 (ESC)">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
      <span class="close-label">退出</span>
    </button>
  </div>
</template>

<style scoped>
.player-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 12px;
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(12px);
  opacity: 0.8;
  transition: opacity 0.2s;
  z-index: 5;
}
.player-topbar:hover {
  opacity: 1;
}
.topbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.15s;
}
.topbar-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}
.topbar-close {
  width: auto;
  padding: 0 10px;
  gap: 4px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 8px;
}
.topbar-close:hover {
  background: rgba(255, 80, 80, 0.25);
  color: #ff6b6b;
}
.close-label {
  font-size: 13px;
  font-weight: 500;
}
</style>
