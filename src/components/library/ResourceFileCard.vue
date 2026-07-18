<template>
  <div
    class="file-card"
    @click="$emit('preview')"
  >
    <!-- 类型图标 -->
    <div class="file-card__icon" :style="{ backgroundColor: iconBg, color: iconColor }">
      <el-icon :size="22"><component :is="typeIcon" /></el-icon>
    </div>

    <!-- 标题 -->
    <div class="file-card__body">
      <h4 class="file-card__title">{{ file.title }}</h4>
      <p v-if="file.topic" class="file-card__topic">{{ file.topic }}</p>
    </div>

    <!-- 状态角标 -->
    <div v-if="file.status === 'ready'" class="file-card__badge file-card__badge--ready" title="已就绪"></div>
    <div v-else-if="file.status === 'pending'" class="file-card__badge file-card__badge--pending" title="生成中"></div>
    <div v-else-if="file.status === 'failed' || file.status === 'rejected'" class="file-card__badge file-card__badge--failed" title="生成失败"></div>

    <!-- 底部信息 -->
    <div class="file-card__meta">
      <el-tag size="small" :type="confidenceTagType" effect="plain" class="!text-xs">
        {{ confidenceLabel }}
      </el-tag>
      <span class="file-card__quality">质量 {{ file.qualityScore }}</span>
      <span v-if="file.noteCount > 0" class="file-card__notes" @click.stop="$emit('view-notes')">
        <el-icon :size="12"><EditPen /></el-icon>
        {{ file.noteCount }} 条笔记
      </span>
      <span v-if="file.isLearning" class="file-card__learning">
        <el-icon :size="12"><Reading /></el-icon>
        学习中
      </span>
    </div>

    <!-- 操作按钮 -->
    <div class="file-card__actions" @click.stop>
      <el-dropdown trigger="click" @command="onCommand">
        <el-button text size="small" :icon="MoreFilled" />
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="learn" :icon="Reading" v-if="file.packId">开始学习</el-dropdown-item>
            <el-dropdown-item command="preview" :icon="View">预览</el-dropdown-item>
            <el-dropdown-item command="add-to-bank" :icon="Tickets" v-if="file.type === 'quiz'">加入题库</el-dropdown-item>
            <el-dropdown-item command="move" :icon="Rank" divided>移动到...</el-dropdown-item>
            <el-dropdown-item command="regenerate" :icon="Refresh">重新生成</el-dropdown-item>
            <el-dropdown-item command="delete" :icon="Delete" divided>删除</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, markRaw } from 'vue'
import {
  Document, Reading, DataBoard, EditPen, VideoPlay,
  MoreFilled, View, Rank, Refresh, Delete, Tickets,
} from '@element-plus/icons-vue'
import { CONFIDENCE_CONFIG } from '@/constants'
import type { ResourceFile } from '@/types'

const props = defineProps<{
  file: ResourceFile
}>()

const emit = defineEmits<{
  (e: 'preview'): void
  (e: 'view-notes'): void
  (e: 'move'): void
  (e: 'regenerate'): void
  (e: 'delete'): void
  (e: 'learn'): void
  (e: 'add-to-bank'): void
}>()

const typeIcon = computed(() => {
  const map: Record<string, any> = {
    doc: markRaw(Document),
    reading: markRaw(Reading),
    quiz: markRaw(EditPen),
    mindmap: markRaw(DataBoard),
    code: markRaw(DataBoard),
    video: markRaw(VideoPlay),
  }
  return map[props.file.type] || markRaw(Document)
})

const iconBg = computed(() => {
  const map: Record<string, string> = {
    doc: 'rgba(43, 111, 255, 0.08)',
    reading: 'rgba(107, 123, 157, 0.08)',
    quiz: 'rgba(52, 199, 89, 0.08)',
    mindmap: 'rgba(255, 159, 10, 0.08)',
    code: 'rgba(255, 59, 48, 0.08)',
    video: 'rgba(124, 92, 252, 0.08)',
  }
  return map[props.file.type] || 'rgba(43, 111, 255, 0.08)'
})

const iconColor = computed(() => {
  const map: Record<string, string> = {
    doc: 'var(--lt-brand)',
    reading: 'var(--el-color-info)',
    quiz: 'var(--lt-success)',
    mindmap: 'var(--lt-warning)',
    code: 'var(--lt-danger)',
    video: 'var(--lt-ai)',
  }
  return map[props.file.type] || 'var(--lt-brand)'
})

const confidenceTagType = computed(() => {
  return props.file.confidence ? (CONFIDENCE_CONFIG[props.file.confidence]?.type ?? 'info') : 'info'
})

const confidenceLabel = computed(() => {
  return props.file.confidence ? (CONFIDENCE_CONFIG[props.file.confidence]?.label ?? '未知') : '未知'
})

function onCommand(cmd: string) {
  if (cmd === 'learn') emit('learn')
  else if (cmd === 'preview') emit('preview')
  else if (cmd === 'add-to-bank') emit('add-to-bank')
  else if (cmd === 'move') emit('move')
  else if (cmd === 'regenerate') emit('regenerate')
  else if (cmd === 'delete') emit('delete')
}
</script>

<style scoped>
.file-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-lg);
  cursor: pointer;
  transition: all var(--lt-transition-smooth);
  height: 100%;
}
.file-card:hover {
  border-color: var(--lt-brand-lighter);
  box-shadow: var(--lt-shadow-hover);
  transform: translateY(-1px);
}
.file-card:active {
  transform: scale(0.995);
}
.file-card__icon {
  width: 40px;
  height: 40px;
  border-radius: var(--lt-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.file-card__body {
  flex: 1;
  min-width: 0;
}
.file-card__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--lt-text-primary);
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.file-card__topic {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  margin: 4px 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.file-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding-top: 8px;
  border-top: 1px solid var(--lt-border);
}
.file-card__quality {
  font-size: 12px;
  color: var(--lt-text-secondary);
}
.file-card__notes {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: var(--lt-ai);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--lt-radius-sm);
  transition: background-color var(--lt-transition-base);
}
.file-card__notes:hover {
  background-color: var(--lt-ai-light-9);
}
.file-card__learning {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: var(--lt-success);
}
.file-card__badge {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 2px solid var(--lt-bg-card);
}
.file-card__badge--ready {
  background-color: var(--lt-success);
}
.file-card__badge--pending {
  background-color: var(--lt-warning);
  animation: pulse 1.5s ease-in-out infinite;
}
.file-card__badge--failed {
  background-color: var(--lt-danger);
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.file-card__actions {
  position: absolute;
  bottom: 12px;
  right: 12px;
  opacity: 0;
  transition: opacity var(--lt-transition-base);
}
.file-card:hover .file-card__actions {
  opacity: 1;
}
</style>
