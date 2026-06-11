<script setup lang="ts">
</script>

<template>
  <div class="dark-overlay">
    <div class="dark-overlay-bg" />
  </div>
</template>

<style scoped>
.dark-overlay {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}

.dark-overlay-bg {
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
}
</style>
