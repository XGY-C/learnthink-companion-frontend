<script setup lang="ts">
defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    class="floating-fab"
    @click="$emit('click')"
    title="智能辅导"
  >
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  </button>
</template>

<style scoped>
.floating-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--lt-brand);
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px var(--lt-shadow-blue);
  transition: all 0.2s ease;
  z-index: 100;
}
.floating-fab:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 24px var(--lt-shadow-blue);
}
.floating-fab:active {
  transform: scale(0.96);
}
</style>
