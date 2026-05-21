<script setup lang="ts">
/**
 * Mobile ProfileSheet — 用 BottomSheet 包装 ProfilePanel
 */
import BottomSheet from '@/components/mobile/BottomSheet.vue'
import ProfilePanel from '@/components/Profile/ProfilePanel.vue'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <BottomSheet
    :model-value="modelValue"
    height="large"
    :show-close="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <ProfilePanel />
  </BottomSheet>
</template>
