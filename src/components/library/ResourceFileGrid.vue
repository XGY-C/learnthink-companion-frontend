<template>
  <div class="file-grid">
    <!-- 子文件夹卡片（排在文件前面） -->
    <div
      v-for="folder in subFolders"
      :key="folder.id"
      class="file-grid__folder"
      @click="$emit('enter-folder', folder.id)"
    >
      <div class="file-grid__folder-icon">
        <el-icon :size="28"><Folder /></el-icon>
      </div>
      <div class="file-grid__folder-info">
        <span class="file-grid__folder-name">{{ folder.name }}</span>
        <span class="file-grid__folder-count">{{ folder.resourceCount }} 个资源</span>
      </div>
      <el-icon class="file-grid__folder-arrow"><ArrowRight /></el-icon>
    </div>

    <!-- 文件卡片 -->
    <ResourceFileCard
      v-for="file in files"
      :key="file.id"
      :file="file"
      @preview="$emit('preview', file)"
      @view-notes="$emit('view-notes', file)"
      @move="$emit('move', file)"
      @regenerate="$emit('regenerate', file)"
      @delete="$emit('delete', file)"
      @learn="$emit('learn', file)"
      @add-to-bank="$emit('add-to-bank', file)"
    />

    <!-- 空状态 -->
    <div v-if="files.length === 0 && subFolders.length === 0 && !loading" class="file-grid__empty">
      <el-icon :size="48" style="color: var(--lt-text-placeholder);"><FolderOpened /></el-icon>
      <p class="file-grid__empty-text">当前文件夹暂无资源</p>
      <p class="file-grid__empty-hint">生成的资源会自动出现在「未归档资源」中</p>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="file-grid__loading">
      <div v-for="n in 6" :key="n" class="file-grid__skeleton">
        <el-skeleton animated :rows="3" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Folder, FolderOpened, ArrowRight } from '@element-plus/icons-vue'
import ResourceFileCard from './ResourceFileCard.vue'
import type { ResourceFile, ResourceFolder } from '@/types'

defineProps<{
  files: ResourceFile[]
  subFolders: ResourceFolder[]
  loading: boolean
}>()

defineEmits<{
  (e: 'preview', file: ResourceFile): void
  (e: 'view-notes', file: ResourceFile): void
  (e: 'move', file: ResourceFile): void
  (e: 'regenerate', file: ResourceFile): void
  (e: 'delete', file: ResourceFile): void
  (e: 'enter-folder', folderId: string): void
  (e: 'learn', file: ResourceFile): void
  (e: 'add-to-bank', file: ResourceFile): void
}>()
</script>

<style scoped>
.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}
.file-grid__folder {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-lg);
  cursor: pointer;
  transition: all var(--lt-transition-smooth);
  grid-column: span 1;
}
.file-grid__folder:hover {
  border-color: var(--lt-brand-lighter);
  background-color: var(--lt-brand-lightest);
}
.file-grid__folder:active {
  transform: scale(0.995);
}
.file-grid__folder-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--lt-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--lt-brand-lightest);
  color: var(--lt-brand);
  flex-shrink: 0;
}
.file-grid__folder-info {
  flex: 1;
  min-width: 0;
}
.file-grid__folder-name {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--lt-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.file-grid__folder-count {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
}
.file-grid__folder-arrow {
  color: var(--lt-text-auxiliary);
  flex-shrink: 0;
}
.file-grid__empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 48px 16px;
}
.file-grid__empty-text {
  font-size: 15px;
  font-weight: 500;
  color: var(--lt-text-secondary);
  margin: 12px 0 4px;
}
.file-grid__empty-hint {
  font-size: 13px;
  color: var(--lt-text-placeholder);
}
.file-grid__loading {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}
.file-grid__skeleton {
  padding: 16px;
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-lg);
}
</style>
