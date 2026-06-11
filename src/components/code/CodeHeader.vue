<template>
  <div class="code-header">
    <div class="code-header-left">
      <h3 class="code-title">{{ title }}</h3>
      <span class="code-lang-tag">{{ language }}</span>
    </div>
    <div class="code-header-right">
      <el-button size="small" :type="mode === 'edit' ? 'primary' : 'default'" @click="$emit('toggle-mode')">
        {{ mode === 'read' ? '编辑' : '阅读' }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  language: string
  mode: 'read' | 'edit'
}>()

defineEmits<{
  (e: 'toggle-mode'): void
}>()
</script>

<style scoped>
.code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--lt-border);
}
.code-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.code-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--lt-text-primary);
  margin: 0;
}
.code-lang-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--lt-radius-sm);
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
  font-family: var(--lt-font-mono);
  text-transform: uppercase;
}
</style>
