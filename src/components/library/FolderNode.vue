<template>
  <div>
    <div
      class="folder-node"
      :class="{ 'folder-node--active': isActive }"
      :style="{ paddingLeft: `${depth * 16 + 16}px` }"
      @click.stop="onSelect"
    >
      <!-- 展开/收起 -->
      <el-icon
        v-if="folder.children?.length"
        class="folder-node__chevron"
        @click.stop="folderStore.toggleExpand(folder.id)"
      >
        <ArrowRight v-if="!folderStore.isExpanded(folder.id)" />
        <ArrowDown v-else />
      </el-icon>
      <span v-else class="folder-node__chevron-placeholder" />

      <el-icon class="folder-node__icon">
        <Folder v-if="!folderStore.isExpanded(folder.id) || !folder.children?.length" />
        <FolderOpened v-else />
      </el-icon>

      <span class="folder-node__name">{{ folder.name }}</span>
      <span v-if="folder.resourceCount > 0" class="folder-node__count">{{ folder.resourceCount }}</span>

      <!-- 操作按钮 -->
      <el-dropdown trigger="click" @command="onCommand" @click.stop>
        <el-icon class="folder-node__more" @click.stop><MoreFilled /></el-icon>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="add-resource" :icon="Upload">添加系统资源</el-dropdown-item>
            <el-dropdown-item command="create" :icon="FolderAdd">新建子文件夹</el-dropdown-item>
            <el-dropdown-item command="rename" :icon="EditPen">重命名</el-dropdown-item>
            <el-dropdown-item command="delete" :icon="Delete" divided>删除文件夹</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <!-- 子文件夹 -->
    <div v-if="folderStore.isExpanded(folder.id)">
      <FolderNode
        v-for="child in folder.children"
        :key="child.id"
        :folder="child"
        :depth="depth + 1"
        @select="$emit('select', $event)"
        @create="$emit('create', $event)"
        @rename="$emit('rename', $event)"
        @delete="$emit('delete', $event)"
        @add-resource="$emit('add-resource', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowRight, ArrowDown, Folder, FolderOpened,
  MoreFilled, FolderAdd, EditPen, Delete, Upload,
} from '@element-plus/icons-vue'
import { useFolderStore } from '@/stores/folder'
import type { ResourceFolder } from '@/types'

const props = defineProps<{
  folder: ResourceFolder
  depth: number
}>()

const emit = defineEmits<{
  (e: 'select', folderId: string): void
  (e: 'create', parentId: string): void
  (e: 'rename', folderId: string): void
  (e: 'delete', folderId: string): void
  (e: 'add-resource', folderId: string): void
}>()

const folderStore = useFolderStore()

const isActive = computed(() => folderStore.currentFolderId === props.folder.id)

function onSelect() {
  emit('select', props.folder.id)
}

function onCommand(cmd: string) {
  if (cmd === 'add-resource') emit('add-resource', props.folder.id)
  else if (cmd === 'create') emit('create', props.folder.id)
  else if (cmd === 'rename') emit('rename', props.folder.id)
  else if (cmd === 'delete') emit('delete', props.folder.id)
}
</script>

<style scoped>
.folder-node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px 7px 8px;
  cursor: pointer;
  transition: background-color var(--lt-transition-base);
  user-select: none;
}
.folder-node:hover {
  background-color: var(--lt-brand-lightest);
}
.folder-node--active {
  background-color: var(--el-color-primary-light-9);
}
.folder-node--active .folder-node__name {
  color: var(--lt-brand);
  font-weight: 600;
}
.folder-node__chevron {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  flex-shrink: 0;
  cursor: pointer;
  width: 16px;
  height: 16px;
}
.folder-node__chevron-placeholder {
  width: 16px;
  flex-shrink: 0;
}
.folder-node__icon {
  font-size: 15px;
  color: var(--lt-text-auxiliary);
  flex-shrink: 0;
}
.folder-node--active .folder-node__icon {
  color: var(--lt-brand);
}
.folder-node__name {
  flex: 1;
  font-size: 13px;
  color: var(--lt-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.folder-node__count {
  font-size: 11px;
  color: var(--lt-text-auxiliary);
  background: var(--lt-bg-page);
  padding: 1px 6px;
  border-radius: var(--lt-radius-full);
  flex-shrink: 0;
}
.folder-node__more {
  font-size: 14px;
  color: var(--lt-text-auxiliary);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--lt-transition-base);
  flex-shrink: 0;
}
.folder-node:hover .folder-node__more {
  opacity: 1;
}
</style>
