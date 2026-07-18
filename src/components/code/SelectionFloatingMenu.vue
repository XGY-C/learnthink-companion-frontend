<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="selection-floating-menu"
      :style="{ left: x + 'px', top: y + 'px' }"
    >
      <button class="float-btn" title="直接用智能模式解释这段代码" @click="$emit('smart-explain')">
        <el-icon><MagicStick /></el-icon>
        <span>智能解释</span>
      </button>
      <button class="float-btn float-btn-ask" title="引用选中文本提问" @click="$emit('ask-ai')">
        <el-icon><ChatLineSquare /></el-icon>
        <span>问 AI</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { MagicStick, ChatLineSquare } from '@element-plus/icons-vue'

defineProps<{
  visible: boolean
  x: number
  y: number
}>()

defineEmits<{
  'smart-explain': []
  'ask-ai': []
}>()
</script>

<style scoped>
.selection-floating-menu {
  position: fixed;
  z-index: 2000;
  display: flex;
  gap: 4px;
  padding: 5px 8px;
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-full);
  box-shadow: var(--lt-shadow-hover);
  transform: translateY(-100%) translateY(-8px);
  animation: float-in 150ms cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes float-in {
  from { opacity: 0; transform: translateY(-100%) translateY(-8px) scale(0.95); }
  to { opacity: 1; transform: translateY(-100%) translateY(-8px) scale(1); }
}
.float-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border: none;
  background: transparent;
  border-radius: var(--lt-radius-full);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--lt-text-secondary);
  white-space: nowrap;
  transition: all 0.15s;
}
.float-btn:hover {
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
}
.float-btn .el-icon {
  font-size: 15px;
}
.float-btn-ask {
  position: relative;
  background: linear-gradient(135deg, rgba(124, 92, 252, 0.06), rgba(43, 111, 255, 0.06));
}
.float-btn-ask::before {
  content: '';
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 1px;
  background: var(--lt-border);
}
.float-btn-ask:hover {
  background: linear-gradient(135deg, rgba(124, 92, 252, 0.12), rgba(43, 111, 255, 0.12));
  color: var(--lt-ai);
}
</style>
