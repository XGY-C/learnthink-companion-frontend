<template>
  <div ref="lottieContainer" :style="{ width: width || '100%', height: height || '100%' }" :aria-hidden="true"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import lottie, { type AnimationItem } from 'lottie-web'

const props = withDefaults(defineProps<{
  /** 动画 JSON 数据（本地导入） */
  animationData?: any
  /** 动画 URL 路径（LottieFiles CDN 等远程地址） */
  path?: string
  width?: string
  height?: string
  loop?: boolean
  autoplay?: boolean
  speed?: number
  paused?: boolean
}>(), {
  loop: true,
  autoplay: true,
  speed: 1,
  paused: false
})

const lottieContainer = ref<HTMLElement | null>(null)
let animationInstance: AnimationItem | null = null

// 检测 prefers-reduced-motion
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const initAnimation = () => {
  if (!lottieContainer.value) return
  if (!props.animationData && !props.path) return

  const shouldAutoplay = props.autoplay && !prefersReducedMotion && !props.paused
  
  const loadOptions: any = {
    container: lottieContainer.value,
    renderer: 'svg',
    loop: prefersReducedMotion ? false : props.loop,
    autoplay: shouldAutoplay
  }

  if (props.animationData) {
    loadOptions.animationData = props.animationData
  } else if (props.path) {
    loadOptions.path = props.path
  }

  animationInstance = lottie.loadAnimation(loadOptions)
  animationInstance.setSpeed(props.speed)

  // 如果动效降级，只显示首帧
  if (prefersReducedMotion || props.paused) {
    animationInstance.goToAndStop(0, true)
  }
}

const updatePlayState = () => {
  if (!animationInstance) return
  const shouldPause = prefersReducedMotion || props.paused
  if (shouldPause) {
    animationInstance.pause()
  } else {
    animationInstance.play()
  }
}

onMounted(() => {
  initAnimation()
  // 监听 prefers-reduced-motion 动态变化
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  const handleChange = () => {
    if (animationInstance) {
      if (mediaQuery.matches) {
        animationInstance.pause()
        animationInstance.goToAndStop(0, true)
      } else {
        animationInstance.play()
      }
    }
  }
  mediaQuery.addEventListener('change', handleChange)
})

onUnmounted(() => {
  if (animationInstance) {
    animationInstance.destroy()
  }
})

watch(() => props.animationData, () => {
  if (animationInstance) {
    animationInstance.destroy()
  }
  initAnimation()
})

watch(() => props.path, () => {
  if (animationInstance) {
    animationInstance.destroy()
  }
  initAnimation()
})

watch(() => props.paused, () => {
  updatePlayState()
})
</script>