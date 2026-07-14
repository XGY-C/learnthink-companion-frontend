<script setup lang="ts">
import { computed } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Edit, Delete, Position } from '@element-plus/icons-vue'
import { formatTimeAgo } from '@/utils/formatters'
import type { Note } from '@/types'

const props = defineProps<{ note: Note }>()
const emit = defineEmits<{ deleted: []; edit: []; jumpToOriginal: [anchorId: string] }>()

const isTextLevel = computed(() => !!(props.note.selectedText && props.note.anchorId))

function handleJumpToOriginal() {
  if (props.note.anchorId) emit('jumpToOriginal', props.note.anchorId)
}

async function confirmDelete() {
  await ElMessageBox.confirm('确定删除此笔记？', '删除笔记')
  emit('deleted')
}
</script>

<template>
  <div class="note-card">
    <div class="note-card-body">
      <div v-if="isTextLevel" class="note-quote">
        <span class="note-quote-text">{{ note.selectedText }}</span>
        <div class="note-quote-bar">
          <span class="note-quote-pos">{{ note.anchorId }}</span>
          <el-button text size="small" class="note-jump-btn" @click="handleJumpToOriginal">
            <el-icon><Position /></el-icon>
            回到原文
          </el-button>
        </div>
      </div>
      <div class="note-content">{{ note.content }}</div>
    </div>
    <div class="note-card-footer">
      <span class="note-time">{{ formatTimeAgo(note.createdAt) }}</span>
      <div class="note-card-actions">
        <el-button text size="small" title="编辑" @click="emit('edit')">
          <el-icon><Edit /></el-icon>
        </el-button>
        <el-button text size="small" style="color: var(--lt-danger)" title="删除" @click="confirmDelete">
          <el-icon><Delete /></el-icon>
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.note-card {
  padding: 10px 16px;
  border-bottom: 1px solid var(--lt-border);
  transition: background 0.15s;
}
.note-card:hover { background: var(--lt-bg-page); }
.note-content {
  font-size: 13px; line-height: 1.6; color: var(--lt-text-primary);
  white-space: pre-wrap; word-break: break-word;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.note-card:hover .note-content { -webkit-line-clamp: unset; }
.note-card-footer {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 6px;
}
.note-time { font-size: 11px; color: var(--lt-text-placeholder); }
.note-card-actions {
  display: flex; gap: 2px; opacity: 0;
  transition: opacity 0.15s;
}
.note-card:hover .note-card-actions { opacity: 1; }
.note-quote {
  margin-bottom: 8px; padding: 8px 10px;
  background: var(--lt-bg-page);
  border-left: 3px solid var(--lt-orange);
  border-radius: var(--lt-radius-sm);
}
.note-quote-text {
  font-size: 12px; color: var(--lt-text-secondary);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  line-height: 1.5;
}
.note-quote-bar {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 4px;
}
.note-quote-pos { font-size: 10px; color: var(--lt-text-placeholder); }
.note-jump-btn { font-size: 12px; color: var(--lt-orange); }
</style>
