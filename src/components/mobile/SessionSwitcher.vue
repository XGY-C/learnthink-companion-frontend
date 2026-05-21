<script setup lang="ts">
/**
 * Mobile SessionSwitcher — 移动端会话切换组件
 * 以 el-drawer 形式展示会话列表
 */
import { ElDrawer } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import type { ChatSession } from '@/composables/useChatSSE'

defineProps<{
  modelValue: boolean
  sessions: ChatSession[]
  activeSessionId: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'create': []
  'switch': [sessionId: string]
}>()

function close() {
  emit('update:modelValue', false)
}

function handleSwitch(id: string) {
  emit('switch', id)
  close()
}

function formatSessionTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 86400000) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (diff < 172800000) return '昨天'
  return `${d.getMonth() + 1}-${d.getDate().toString().padStart(2, '0')}`
}
</script>

<template>
  <ElDrawer
    :model-value="modelValue"
    direction="ltr"
    size="75%"
    title="会话列表"
    :with-header="true"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="mobile-switcher">
      <button class="mobile-switcher-new" @click="emit('create'); close()">
        <el-icon :size="16"><Plus /></el-icon>
        新建会话
      </button>
      <div
        v-for="sess in sessions"
        :key="sess.id"
        class="mobile-switcher-item"
        :class="{ active: sess.id === activeSessionId }"
        @click="handleSwitch(sess.id)"
      >
        <div class="mobile-switcher-title">{{ sess.title }}</div>
        <div class="mobile-switcher-meta">
          {{ sess.lastMessagePreview || (sess.messageCount ? sess.messageCount + ' 条消息' : '') }}
          · {{ formatSessionTime(sess.updatedAt) }}
        </div>
      </div>
    </div>
  </ElDrawer>
</template>

<style scoped>
.mobile-switcher {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mobile-switcher-new {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border: 1px dashed var(--lt-brand-lighter);
  border-radius: 10px;
  background: transparent;
  color: var(--lt-brand);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  margin-bottom: 8px;
  touch-action: manipulation;
}
.mobile-switcher-new:active {
  background: var(--lt-brand-lightest);
}

.mobile-switcher-item {
  padding: 12px 16px;
  border-radius: 10px;
  cursor: pointer;
  touch-action: manipulation;
  transition: background 0.15s;
}
.mobile-switcher-item.active {
  background: var(--lt-brand-lightest);
  border-left: 3px solid var(--lt-brand);
}
.mobile-switcher-item:not(.active):active {
  background: var(--lt-bg-page);
}

.mobile-switcher-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--lt-text-primary);
  margin-bottom: 4px;
}

.mobile-switcher-meta {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
}
</style>
