<template>
  <div class="code-toolbar">
    <div class="code-toolbar-left">
      <template v-if="mode === 'edit'">
        <el-button size="small" type="primary" :disabled="!canRun" @click="$emit('run')">
          <el-icon class="mr-1"><CaretRight /></el-icon> 运行
        </el-button>
        <el-button size="small" @click="$emit('reset')">重置</el-button>
      </template>
      <el-button size="small" plain @click="$emit('copy')">复制</el-button>
      <el-button size="small" plain @click="$emit('download')">下载</el-button>
    </div>
    <div v-if="mode === 'edit'" class="code-toolbar-right">
      <span class="code-toolbar-filename">{{ activeFilename }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CaretRight } from '@element-plus/icons-vue'

defineProps<{
  mode: 'read' | 'edit'
  runState: 'idle' | 'running' | 'success' | 'error' | 'timeout'
  canRun: boolean
  activeFilename: string
}>()

defineEmits<{
  (e: 'run'): void
  (e: 'reset'): void
  (e: 'copy'): void
  (e: 'download'): void
}>()
</script>

<style scoped>
.code-toolbar {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  opacity: 0;
  transition: opacity 0.2s ease;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  padding: 4px 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.code-toolbar-left {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.code-toolbar-right {
  display: flex;
  align-items: center;
}
.code-toolbar-filename {
  font-size: 12px;
  font-family: var(--lt-font-mono);
  color: var(--lt-text-auxiliary);
}
</style>
