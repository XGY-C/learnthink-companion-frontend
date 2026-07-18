<script setup lang="ts">
defineProps<{
  tags: { id: string; name: string }[]
  selectedTagIds: string[]
}>()

const emit = defineEmits<{
  (e: 'toggle', tagId: string): void
}>()
</script>

<template>
  <div class="tag-chips flex flex-wrap gap-2">
    <button
      v-for="tag in tags" :key="tag.id"
      type="button"
      class="tag-chip"
      :class="{ selected: selectedTagIds.includes(tag.id) }"
      @click="emit('toggle', tag.id)"
    >
      {{ tag.name }}
    </button>
  </div>
</template>

<style scoped>
.tag-chip {
  padding: 4px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid var(--lt-border);
  cursor: pointer;
  transition: all var(--lt-transition-base);
  color: var(--lt-text-secondary);
  background: var(--lt-bg-card);
}
.tag-chip:hover {
  border-color: var(--lt-brand-lighter);
  color: var(--lt-brand);
  background: var(--lt-brand-lightest);
}
.tag-chip.selected {
  border-color: var(--lt-brand);
  color: var(--lt-brand);
  background: var(--lt-brand-lightest);
  font-weight: 600;
}
</style>
