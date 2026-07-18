<template>
  <div class="folder-tree" style="border-right: 1px solid var(--lt-border); height: 100%; display: flex; flex-direction: column;">
    <!-- 树头 -->
    <div class="px-4 py-3 flex items-center justify-between" style="border-bottom: 1px solid var(--lt-border);">
      <span class="text-sm font-semibold" style="color: var(--lt-text-primary);">文件夹</span>
      <el-button text size="small" :icon="FolderAdd" @click="$emit('create', null)"
        style="color: var(--lt-brand);" />
    </div>

    <!-- 树体 -->
    <div class="flex-1 overflow-y-auto py-2">
      <!-- 全部资源 -->
      <div
        class="folder-item"
        :class="{ 'folder-item--active': folderStore.currentFolderId === 'all' }"
        @click="folderStore.navigateTo('all')"
      >
        <el-icon class="folder-item__icon"><Files /></el-icon>
        <span class="folder-item__name">全部资源</span>
        <span class="folder-item__count">{{ totalAll }}</span>
      </div>

      <!-- 未归档 -->
      <div
        class="folder-item"
        :class="{ 'folder-item--active': folderStore.currentFolderId === null }"
        @click="folderStore.navigateTo(null)"
      >
        <el-icon class="folder-item__icon"><FolderOpened /></el-icon>
        <span class="folder-item__name">未归档资源</span>
      </div>

      <div class="px-4 py-1.5">
        <span class="text-xs font-medium" style="color: var(--lt-text-auxiliary);">已归档</span>
      </div>

      <!-- 文件夹树 -->
      <FolderNode
        v-for="folder in folderStore.folders"
        :key="folder.id"
        :folder="folder"
        :depth="0"
        @select="onSelect"
        @create="$emit('create', $event)"
        @rename="$emit('rename', $event)"
        @delete="$emit('delete', $event)"
        @add-resource="$emit('add-resource', $event)"
      />

      <!-- 空文件夹 -->
      <div v-if="folderStore.folders.length === 0 && !folderStore.loading" class="px-4 py-3 text-center">
        <span class="text-xs" style="color: var(--lt-text-placeholder);">暂无文件夹</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Files, FolderOpened, FolderAdd } from '@element-plus/icons-vue'
import { useFolderStore } from '@/stores/folder'
import FolderNode from './FolderNode.vue'

defineEmits<{
  (e: 'create', parentId: string | null): void
  (e: 'rename', folderId: string): void
  (e: 'delete', folderId: string): void
  (e: 'add-resource', folderId: string): void
}>()

const folderStore = useFolderStore()

const totalAll = computed(() => {
  return folderStore.folders.reduce((sum, f) => sum + folderStore.totalResourceCount(f), 0)
})

function onSelect(id: string) {
  folderStore.navigateTo(id)
}
</script>

<style scoped>
.folder-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 16px;
  cursor: pointer;
  transition: background-color var(--lt-transition-base);
  user-select: none;
}
.folder-item:hover {
  background-color: var(--lt-brand-lightest);
}
.folder-item--active {
  background-color: var(--el-color-primary-light-9);
}
.folder-item--active .folder-item__name {
  color: var(--lt-brand);
  font-weight: 600;
}
.folder-item__icon {
  font-size: 16px;
  color: var(--lt-text-auxiliary);
  flex-shrink: 0;
}
.folder-item--active .folder-item__icon {
  color: var(--lt-brand);
}
.folder-item__name {
  flex: 1;
  font-size: 13px;
  color: var(--lt-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.folder-item__count {
  font-size: 11px;
  color: var(--lt-text-auxiliary);
  background: var(--lt-bg-page);
  padding: 1px 6px;
  border-radius: var(--lt-radius-full);
  flex-shrink: 0;
}
</style>
