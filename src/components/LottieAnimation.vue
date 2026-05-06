<template>
  <div ref="lottieContainer" :style="{ width: width || '100%', height: height || '100%' }"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import lottie, { type AnimationItem } from 'lottie-web'

const props = defineProps<{
  animationData: any, // The imported JSON data
  width?: string,
  height?: string,
  loop?: boolean,
  autoplay?: boolean,
  speed?: number
}>()

const lottieContainer = ref<HTMLElement | null>(null)
let animationInstance: AnimationItem | null = null

const initAnimation = () => {
  if (lottieContainer.value && props.animationData) {
    animationInstance = lottie.loadAnimation({
      container: lottieContainer.value,
      renderer: 'svg',
      loop: props.loop !== undefined ? props.loop : true,
      autoplay: props.autoplay !== undefined ? props.autoplay : true,
      animationData: props.animationData
    })
    
    if (props.speed) {
      animationInstance.setSpeed(props.speed)
    }
  }
}

onMounted(() => {
  initAnimation()
})

onUnmounted(() => {
  if (animationInstance) {
    animationInstance.destroy()
  }
})

// Allow updating data dynamically if needed
watch(() => props.animationData, () => {
  if (animationInstance) {
    animationInstance.destroy()
  }
  initAnimation()
})
</script>