<template>
  <Teleport to="body">
    <div
      class="variable-hover-card"
      :style="{ left: x + 'px', top: y + 'px' }"
      @mouseenter="clearTimer"
      @mouseleave="startTimer"
    >
      <div class="vhc-type">{{ variable.type }}</div>
      <div class="vhc-line">定义于 Line {{ variable.definitionLine }} · {{ variable.scope }}</div>
      <div class="vhc-value" v-if="variable.initialValue">
        当前值: <code>{{ variable.initialValue }}</code>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onUnmounted } from 'vue'
import type { VariableInfo } from '@/types/code'

const props = defineProps<{
  variable: VariableInfo
  x: number
  y: number
}>()

const emit = defineEmits<{
  close: []
}>()

let timer: ReturnType<typeof setTimeout> | null = null

function clearTimer() {
  if (timer) { clearTimeout(timer); timer = null }
}

function startTimer() {
  timer = setTimeout(() => emit('close'), 300)
}

onUnmounted(() => {
  if (timer) clearTimeout(timer)
})
</script>

<style scoped>
.variable-hover-card {
  position: fixed;
  z-index: 2001;
  max-width: 320px;
  padding: 8px 12px;
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-md);
  box-shadow: var(--lt-shadow-hover);
  font-size: 12px;
  line-height: 1.5;
  animation: hover-in 150ms ease-out;
}
@keyframes hover-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.vhc-type {
  font-family: var(--lt-font-mono);
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
  display: inline-block;
  margin-bottom: 4px;
}
.vhc-line {
  color: var(--lt-text-auxiliary);
  font-size: 11px;
}
.vhc-value {
  margin-top: 4px;
  color: var(--lt-text-secondary);
}
.vhc-value code {
  font-family: var(--lt-font-mono);
  font-size: 11px;
  color: var(--lt-text-primary);
  background: var(--lt-bg-page);
  padding: 1px 4px;
  border-radius: 3px;
}
</style>
