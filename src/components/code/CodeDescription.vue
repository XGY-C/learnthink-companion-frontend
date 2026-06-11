<template>
  <div class="code-description" :class="{ collapsed: isCollapsed }">
    <div class="code-description-header" @click="isCollapsed = !isCollapsed">
      <span class="code-description-label">问题描述</span>
      <el-icon class="code-description-arrow" :class="{ rotated: !isCollapsed }">
        <ArrowDown />
      </el-icon>
    </div>
    <div v-show="!isCollapsed" class="code-description-body">
      <MarkdownViewer :content="content" :showToc="false" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'

defineProps<{
  content: string
}>()

const isCollapsed = ref(false)
</script>

<style scoped>
.code-description {
  margin-bottom: 12px;
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-md);
  overflow: hidden;
}
.code-description-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  cursor: pointer;
  background: var(--lt-bg-page);
  user-select: none;
}
.code-description-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--lt-text-secondary);
}
.code-description-arrow {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  transition: transform 0.2s;
}
.code-description-arrow.rotated {
  transform: rotate(180deg);
}
.code-description-body {
  padding: 12px 14px;
}
</style>
