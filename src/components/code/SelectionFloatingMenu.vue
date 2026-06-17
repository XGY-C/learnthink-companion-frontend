<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="menuRef"
      class="selection-floating-menu"
      :style="{ left: x + 'px', top: y + 'px' }"
    >
      <button class="float-btn" title="解释这段代码" @click="$emit('explain')">
        <el-icon><ChatDotRound /></el-icon>
        <span>解释这段代码</span>
      </button>
      <button class="float-btn" title="找相似模式" @click="$emit('find-similar')">
        <el-icon><Search /></el-icon>
        <span>找相似模式</span>
      </button>
      <button class="float-btn" title="有啥问题吗？" @click="$emit('ask')">
        <el-icon><QuestionFilled /></el-icon>
        <span>有啥问题吗？</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ChatDotRound, Search, QuestionFilled } from '@element-plus/icons-vue'

defineProps<{
  visible: boolean
  x: number
  y: number
}>()

defineEmits<{
  explain: []
  'find-similar': []
  ask: []
}>()

const menuRef = ref<HTMLElement | null>(null)
</script>

<style scoped>
.selection-floating-menu {
  position: fixed;
  z-index: 2000;
  display: flex;
  gap: 2px;
  padding: 4px 6px;
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
  gap: 4px;
  padding: 4px 10px;
  border: none;
  background: transparent;
  border-radius: var(--lt-radius-md);
  cursor: pointer;
  font-size: 12px;
  color: var(--lt-text-secondary);
  white-space: nowrap;
  transition: background 0.15s;
}
.float-btn:hover {
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
}
.float-btn .el-icon {
  font-size: 14px;
}
</style>
