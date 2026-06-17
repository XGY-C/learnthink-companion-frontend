<template>
  <div class="learning-goals-bar">
    <div class="goals-header" @click="expanded = !expanded">
      <span class="goals-toggle">{{ expanded ? '▾' : '▸' }}</span>
      <span class="goals-label">学习目标 · {{ goals.length }}个目标</span>
      <span class="goals-progress">
        <template v-for="(goal, i) in goals" :key="goal.id">
          <span class="goal-mini-icon" :class="{ achieved: achievedIds.has(goal.id) }">
            {{ achievedIds.has(goal.id) ? '✅' : '⬜' }}
          </span>
        </template>
        <span class="goals-count">{{ achievedIds.size }}/{{ goals.length }} 已达成</span>
      </span>
      <el-icon class="goals-arrow" :class="{ rotated: expanded }"><ArrowDown /></el-icon>
    </div>
    <div v-show="expanded" class="goals-body">
      <div
        v-for="goal in goals"
        :key="goal.id"
        class="goal-item"
        :class="{ achieved: achievedIds.has(goal.id), current: currentGoalId === goal.id }"
        @click="$emit('click-goal', goal.id)"
      >
        <span class="goal-icon">
          {{ achievedIds.has(goal.id) ? '✅' : currentGoalId === goal.id ? '🔄' : '⬜' }}
        </span>
        <span class="goal-text">{{ goal.description }}</span>
        <span class="goal-steps">
          Step {{ goal.relatedSteps.map(s => s + 1).join(', ') }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'
import type { LearningGoal } from '@/types/code'

defineProps<{
  goals: LearningGoal[]
  achievedIds: Set<string>
  currentGoalId: string | null
}>()

defineEmits<{
  'click-goal': [id: string]
}>()

const expanded = ref(false)
</script>

<style scoped>
.learning-goals-bar {
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-md);
  overflow: hidden;
  background: var(--lt-bg-card);
}
.goals-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}
.goals-header:hover {
  background: var(--lt-bg-page);
}
.goals-toggle {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  width: 12px;
}
.goals-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--lt-text-primary);
}
.goals-progress {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
}
.goal-mini-icon {
  font-size: 10px;
}
.goal-mini-icon.achieved {
  filter: none;
}
.goals-count {
  font-size: 11px;
  color: var(--lt-text-auxiliary);
  margin-left: 6px;
}
.goals-arrow {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  transition: transform 0.2s;
}
.goals-arrow.rotated {
  transform: rotate(180deg);
}
.goals-body {
  border-top: 1px solid var(--lt-border);
  padding: 8px 0;
}
.goal-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background 0.15s;
}
.goal-item:hover {
  background: var(--lt-bg-page);
}
.goal-item.current {
  background: rgba(43, 111, 255, 0.05);
}
.goal-icon {
  font-size: 14px;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}
.goal-text {
  font-size: 13px;
  color: var(--lt-text-primary);
  flex: 1;
}
.goal-steps {
  font-size: 11px;
  color: var(--lt-text-auxiliary);
  font-family: var(--lt-font-mono);
  white-space: nowrap;
}
</style>
