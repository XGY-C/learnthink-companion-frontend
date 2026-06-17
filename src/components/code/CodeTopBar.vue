<template>
  <div class="code-topbar">
    <div class="code-topbar-left">
      <el-button text size="small" class="back-btn" @click="$emit('back')">
        <el-icon><ArrowLeft /></el-icon>
      </el-button>
      <span class="code-topbar-title">📘 {{ title }}</span>
    </div>

    <div class="code-topbar-center">
      <div class="progress-dots">
        <span
          v-for="i in totalSteps"
          :key="i"
          class="progress-dot"
          :class="{
            done: i <= completedSteps,
            current: i === completedSteps + 1 && completedSteps < totalSteps
          }"
          @click="$emit('jump-step', i - 1)"
        />
        <span class="progress-text">{{ completedSteps }}/{{ totalSteps }}</span>
      </div>
      <span class="difficulty-badge" :class="'diff-' + difficulty">
        {{ difficultyLabel }}
      </span>
      <span class="estimated-time">⏱{{ estimatedMinutes }}min</span>
    </div>

    <div class="code-topbar-right">
      <el-dropdown trigger="click" @command="onModeChange">
        <el-button size="small">
          {{ modeLabel }}<el-icon class="el-icon--right"><ArrowDown /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="read" :class="{ active: mode === 'read' }">
              ● 阅读模式
              <span class="mode-desc">代码只读，骨架展开，步骤引导</span>
            </el-dropdown-item>
            <el-dropdown-item command="guide" :class="{ active: mode === 'guide' }">
              ○ 引导模式
              <span class="mode-desc">关键行留空，填空练习，即时验证</span>
            </el-dropdown-item>
            <el-dropdown-item command="edit" :class="{ active: mode === 'edit' }">
              ○ 编辑模式
              <span class="mode-desc">完全可编辑，运行调试，参考面板</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-button
        size="small"
        :disabled="!hasTrajectory"
        :type="trajectoryActive ? 'primary' : 'default'"
        @click="$emit('toggle-trajectory')"
      >
        轨迹
      </el-button>
      <el-button
        size="small"
        :type="fullscreen ? 'primary' : 'default'"
        @click="$emit('toggle-fullscreen')"
      >
        {{ fullscreen ? '退出全屏' : '全屏' }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeft, ArrowDown } from '@element-plus/icons-vue'
import type { LearningMode } from '@/types/code'

const props = defineProps<{
  title: string
  difficulty: string
  estimatedMinutes: number
  completedSteps: number
  totalSteps: number
  mode: LearningMode
  hasTrajectory: boolean
  trajectoryActive: boolean
  fullscreen: boolean
}>()

const emit = defineEmits<{
  back: []
  'update:mode': [mode: LearningMode]
  'jump-step': [index: number]
  'toggle-trajectory': []
  'toggle-fullscreen': []
}>()

const difficultyLabel = computed(() => {
  const map: Record<string, string> = { beginner: '⭐初级', intermediate: '⭐中级', advanced: '⭐⭐高级' }
  return map[props.difficulty] || props.difficulty
})

const modeLabel = computed(() => {
  const map: Record<string, string> = { read: '阅读', guide: '引导', edit: '编辑' }
  return map[props.mode] || props.mode
})

function onModeChange(cmd: string) {
  emit('update:mode', cmd as LearningMode)
}
</script>

<style scoped>
.code-topbar {
  display: flex;
  align-items: center;
  height: 52px;
  padding: 0 16px;
  border-bottom: 1px solid var(--lt-border);
  background: var(--lt-bg-card);
  gap: 12px;
  flex-shrink: 0;
}
.code-topbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.back-btn {
  font-size: 16px;
}
.code-topbar-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--lt-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.code-topbar-center {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 auto;
}
.progress-dots {
  display: flex;
  align-items: center;
  gap: 4px;
}
.progress-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--lt-border);
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}
.progress-dot.done {
  background: var(--lt-success);
}
.progress-dot.current {
  background: var(--lt-brand);
  transform: scale(1.3);
}
.progress-text {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  margin-left: 4px;
  font-family: var(--lt-font-mono);
}
.difficulty-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: var(--lt-radius-sm);
  font-weight: 500;
}
.diff-beginner { background: #e8f5e9; color: #2e7d32; }
.diff-intermediate { background: #fff3e0; color: #e65100; }
.diff-advanced { background: #fce4ec; color: #c62828; }
.estimated-time {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
}
.code-topbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
}
:deep(.mode-desc) {
  font-size: 11px;
  color: var(--lt-text-auxiliary);
  display: block;
  margin-top: 2px;
}
:deep(.el-dropdown-menu__item.active) {
  color: var(--lt-brand);
  font-weight: 500;
}
</style>
