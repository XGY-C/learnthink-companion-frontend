<template>
  <div
    class="page-icon shrink-0 flex items-center justify-center shadow-sm"
    :class="sizeClass"
    :style="gradientStyle"
  >
    <slot>
      <!-- 默认占位 -->
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" />
      </svg>
    </slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg'
  gradient?: 'brand' | 'ai' | 'success' | 'orange'
}>(), {
  size: 'md',
  gradient: 'brand',
})

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm': return 'w-7 h-7 rounded-lg'
    case 'lg': return 'w-11 h-11 rounded-2xl'
    default: return 'w-9 h-9 rounded-xl'
  }
})

const gradientStyle = computed(() => {
  const gradients: Record<string, string> = {
    brand: 'linear-gradient(135deg, var(--lt-brand), var(--lt-brand-dark))',
    ai: 'linear-gradient(135deg, var(--lt-ai), var(--lt-ai-dark-2))',
    success: 'linear-gradient(135deg, var(--lt-success), #28A745)',
    orange: 'linear-gradient(135deg, var(--lt-orange), #E07830)',
  }
  return { background: gradients[props.gradient] || gradients.brand }
})
</script>
