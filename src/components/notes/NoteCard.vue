<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Edit, Delete, Position, Clock } from '@element-plus/icons-vue'
import { formatTimeAgo } from '@/utils/formatters'
import type { Note } from '@/types'

const props = defineProps<{ note: Note }>()
const emit = defineEmits<{ deleted: []; edit: []; jumpToOriginal: [anchorId: string] }>()

const isTextLevel = computed(() => !!(props.note.selectedText && props.note.anchorId))

const detailVisible = ref(false)
function openDetail() {
  detailVisible.value = true
}

function handleJumpToOriginal() {
  if (!props.note.anchorId) return
  detailVisible.value = false
  emit('jumpToOriginal', props.note.anchorId)
}

function handleEdit() {
  detailVisible.value = false
  emit('edit')
}

async function confirmDelete() {
  try {
    await ElMessageBox.confirm('确定删除此笔记？', '删除笔记')
    detailVisible.value = false
    emit('deleted')
  } catch {
    // 用户取消删除
  }
}
</script>

<template>
  <div class="note-card" @click="openDetail">
    <div class="note-card-body">
      <div v-if="isTextLevel" class="note-quote">
        <span class="note-quote-text">{{ note.selectedText }}</span>
        <div class="note-quote-bar">
          <span class="note-quote-pos">{{ note.anchorId }}</span>
          <el-button text size="small" class="note-jump-btn" @click.stop="handleJumpToOriginal">
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
        <el-button text size="small" title="编辑" @click.stop="emit('edit')">
          <el-icon><Edit /></el-icon>
        </el-button>
        <el-button text size="small" style="color: var(--lt-danger)" title="删除" @click.stop="confirmDelete">
          <el-icon><Delete /></el-icon>
        </el-button>
      </div>
    </div>

    <el-dialog
      v-model="detailVisible"
      title="笔记详情"
      width="min(540px, 92vw)"
      :append-to-body="true"
      class="note-detail-dialog"
    >
      <div class="note-detail">
        <div v-if="note.sectionTitle || note.resourceTitle" class="note-detail-meta">
          <span v-if="note.sectionTitle" class="note-detail-section">{{ note.sectionTitle }}</span>
          <span v-if="note.resourceTitle" class="note-detail-resource">{{ note.resourceTitle }}</span>
        </div>
        <div v-if="isTextLevel" class="note-detail-quote">
          <span class="note-detail-quote-text">{{ note.selectedText }}</span>
          <div class="note-detail-quote-bar">
            <span class="note-detail-quote-pos">{{ note.anchorId }}</span>
            <el-button text size="small" class="note-jump-btn" @click="handleJumpToOriginal">
              <el-icon><Position /></el-icon>
              回到原文
            </el-button>
          </div>
        </div>
        <div class="note-detail-content">{{ note.content }}</div>
        <div class="note-detail-time">
          <el-icon><Clock /></el-icon>
          <span>{{ formatTimeAgo(note.createdAt) }}</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button type="primary" @click="handleEdit">
          <el-icon><Edit /></el-icon>
          编辑
        </el-button>
        <el-button type="danger" plain @click="confirmDelete">
          <el-icon><Delete /></el-icon>
          删除
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.note-card {
  margin: 4px 8px;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
  position: relative;
}
.note-card::before {
  content: '';
  position: absolute; left: 0; top: 10px; bottom: 10px;
  width: 3px; border-radius: 0 2px 2px 0;
  background: transparent;
  transition: background 0.2s;
}
.note-card:hover {
  background: var(--lt-bg-card);
  border-color: var(--lt-border);
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.note-card:hover::before { background: var(--lt-brand); }
.note-content {
  font-size: 15px; line-height: 1.7; color: var(--lt-text-primary);
  white-space: pre-wrap; word-break: break-word;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.note-card-footer {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 10px;
}
.note-time { font-size: 13px; color: var(--lt-text-placeholder); }
.note-card-actions {
  display: flex; gap: 4px; opacity: 0;
  transition: opacity 0.15s;
}
.note-card:hover .note-card-actions { opacity: 1; }
.note-card-actions :deep(.el-button) {
  width: 32px; height: 32px; padding: 0;
  border-radius: 8px;
}
.note-card-actions :deep(.el-button:hover) {
  background: var(--lt-bg-page);
}
.note-card-actions :deep(.el-icon) {
  font-size: 18px;
}
.note-quote {
  margin-bottom: 12px; padding: 12px 14px;
  background: var(--lt-bg-page);
  border-left: 3px solid var(--lt-orange);
  border-radius: var(--lt-radius-sm);
}
.note-quote-text {
  font-size: 14px; color: var(--lt-text-secondary);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  line-height: 1.6;
}
.note-quote-bar {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 8px;
}
.note-quote-pos { font-size: 12px; color: var(--lt-text-placeholder); }
.note-jump-btn { font-size: 14px; color: var(--lt-orange); }

/* ===== 详情对话框 ===== */
.note-detail { display: flex; flex-direction: column; }
.note-detail-meta {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin-bottom: 12px;
}
.note-detail-section {
  font-size: 12px; font-weight: 600;
  color: var(--lt-brand);
  background: var(--lt-brand-lightest);
  padding: 2px 8px; border-radius: var(--lt-radius-sm);
}
.note-detail-resource {
  font-size: 12px; color: var(--lt-text-secondary);
  background: var(--lt-bg-page);
  padding: 2px 8px; border-radius: var(--lt-radius-sm);
}
.note-detail-quote {
  margin-bottom: 16px; padding: 12px 14px;
  background: var(--lt-bg-page);
  border-left: 3px solid var(--lt-orange);
  border-radius: var(--lt-radius-sm);
}
.note-detail-quote-text {
  font-size: 13px; color: var(--lt-text-secondary);
  line-height: 1.6; white-space: pre-wrap; word-break: break-word;
}
.note-detail-quote-bar {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 8px;
}
.note-detail-quote-pos { font-size: 11px; color: var(--lt-text-placeholder); }
.note-detail-content {
  font-size: 14px; line-height: 1.8; color: var(--lt-text-primary);
  white-space: pre-wrap; word-break: break-word;
  min-height: 60px;
}
.note-detail-time {
  display: flex; align-items: center; gap: 4px;
  margin-top: 16px; padding-top: 12px;
  border-top: 1px solid var(--lt-border);
  font-size: 12px; color: var(--lt-text-placeholder);
}
</style>
