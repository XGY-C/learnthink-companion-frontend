<script setup lang="ts">
defineProps<{
  sectionId: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  action: [type: 'simplify' | 'switch_angle' | 'followup' | 'more_examples']
}>()
</script>

<template>
  <div class="section-actions" :class="{ disabled }">
    <button class="action-btn" :disabled="disabled" @click="emit('action', 'simplify')">
      讲简单些
    </button>
    <button class="action-btn" :disabled="disabled" @click="emit('action', 'switch_angle')">
      换个角度
    </button>
    <button class="action-btn" :disabled="disabled" @click="emit('action', 'followup')">
      追问...
    </button>
    <button class="action-btn" :disabled="disabled" @click="emit('action', 'more_examples')">
      更多例子
    </button>
  </div>
</template>

<style scoped>
.section-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.section-actions.disabled { opacity: 0.5; pointer-events: none; }

.action-btn {
  padding: 4px 12px;
  font-size: 12px;
  color: var(--lt-text-secondary);
  background: transparent;
  border: 1px solid var(--lt-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}
.action-btn:hover:not(:disabled) {
  color: var(--lt-brand);
  border-color: var(--lt-brand);
  background: var(--lt-brand-lightest);
}
.action-btn:disabled { cursor: not-allowed; }

@media (max-width: 768px) {
  .action-btn { padding: 4px 8px; font-size: 11px; }
  .section-actions { gap: 4px; }
}
</style>
