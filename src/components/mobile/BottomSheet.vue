<script setup lang="ts">
/**
 * 通用 BottomSheet 组件
 * 移动端替代 el-dialog 的底部弹出面板
 * 三级高度：50vh / 70vh / 85vh
 */
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  height?: 'medium' | 'large' | 'full'
  title?: string
  showClose?: boolean
}>(), {
  height: 'medium',
  title: '',
  showClose: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const heightMap = { medium: '50vh', large: '70vh', full: '85vh' }
const sheetHeight = computed(() => heightMap[props.height])

function close() {
  emit('update:modelValue', false)
}

function onScrimClick() {
  close()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="btt">
      <div v-if="modelValue" class="btt-scrim" @click.self="onScrimClick">
        <div class="btt-sheet" :style="{ height: sheetHeight }">
          <div class="btt-handle-bar">
            <div class="btt-handle" />
          </div>
          <div v-if="title" class="btt-header">
            <h3 class="btt-title">{{ title }}</h3>
            <button v-if="showClose" class="btt-close" @click="close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="btt-body">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.btt-scrim {
  position: fixed;
  inset: 0;
  z-index: var(--mobile-sheet-scrim-z-index, 999);
  background: var(--mobile-sheet-scrim, rgba(0, 0, 0, 0.4));
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.btt-sheet {
  width: 100%;
  background: var(--mobile-sheet-bg, var(--lt-bg-card));
  border-radius: var(--mobile-sheet-radius, 12px) var(--mobile-sheet-radius, 12px) 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.btt-handle-bar {
  display: flex;
  justify-content: center;
  padding: 8px 0 4px;
  flex-shrink: 0;
}

.btt-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--lt-border);
}

.btt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 12px;
  flex-shrink: 0;
}

.btt-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--lt-text-primary);
  margin: 0;
}

.btt-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--lt-text-auxiliary);
  cursor: pointer;
  border-radius: 50%;
}

.btt-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0 16px 16px;
}

/* Animation */
.btt-enter-active { transition: all 0.25s ease-out; }
.btt-leave-active { transition: all 0.2s ease-in; }
.btt-enter-from { opacity: 0; }
.btt-leave-to { opacity: 0; }
.btt-enter-from .btt-sheet { transform: translateY(100%); }
.btt-leave-to .btt-sheet { transform: translateY(100%); }
</style>
