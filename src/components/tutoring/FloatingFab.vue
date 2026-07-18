<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import lottie from 'lottie-web'
import animationData from '@/assets/animations/live-chatbot.json'

defineEmits<{
  click: []
}>()

const animContainer = ref<HTMLElement>()

onMounted(() => {
  if (animContainer.value) {
    lottie.loadAnimation({
      container: animContainer.value,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData
    })
  }
})

onUnmounted(() => {
  lottie.destroy()
})
</script>

<template>
  <button
    class="floating-fab"
    @click="$emit('click')"
    title="智能辅导"
  >
    <div ref="animContainer" class="lottie-container" />
  </button>
</template>

<style scoped>
.floating-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 96px;
  height: 96px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 100;
  padding: 0;
}
.floating-fab:hover {
  transform: scale(1.08);
}
.floating-fab:active {
  transform: scale(0.96);
}

.lottie-container {
  width: 96px;
  height: 96px;
}
</style>
