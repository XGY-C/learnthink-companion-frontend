<template>
  <div class="text-center py-16 px-8 rounded-lg border border-dashed empty-state-card">
    <div v-if="icon" class="empty-icon mb-4">
      <el-icon :size="size === 'large' ? '48' : '36'" :style="{ color: 'var(--lt-brand-lighter)' }">
        <component :is="icon" />
      </el-icon>
    </div>
    <h3 class="font-semibold mb-2" :class="size === 'large' ? 'text-lg' : 'text-base'" style="color: var(--lt-text-secondary);">
      {{ title }}
    </h3>
    <p v-if="description" class="text-sm mb-6 mx-auto" :style="{ maxWidth: '400px', color: 'var(--lt-text-placeholder)' }">
      {{ description }}
    </p>
    <slot name="action">
      <el-button
        v-if="actionText"
        type="primary"
        :size="size === 'large' ? 'large' : 'default'"
        @click="$emit('action')"
      >
        <el-icon v-if="actionIcon" class="mr-1"><component :is="actionIcon" /></el-icon>
        {{ actionText }}
      </el-button>
    </slot>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(defineProps<{
  icon?: Component
  title: string
  description?: string
  actionText?: string
  actionIcon?: Component
  size?: 'default' | 'large'
}>(), {
  size: 'default',
})

defineEmits<{
  action: []
}>()
</script>

<style scoped>
.empty-state-card {
  background-color: var(--lt-bg-card);
  border-color: var(--lt-brand-lighter);
  transition: border-color var(--lt-transition-smooth), box-shadow var(--lt-transition-smooth);
}
.empty-state-card:hover {
  border-color: var(--lt-brand-light);
  box-shadow: var(--lt-shadow-card);
}
</style>
