<script setup lang="ts">
import { computed } from 'vue'
import { useTutoringStore } from '@/stores/tutoring'
import type { QuestionAnalysis } from '@/types/tutoring'

const store = useTutoringStore()

const props = defineProps<{
  analysis?: QuestionAnalysis | null
}>()

const analysis = computed(() => props.analysis ?? store.analysis)

const typeColorMap: Record<string, string> = {
  conceptual: 'var(--lt-brand)',
  procedural: '#34C759',
  debugging: 'var(--lt-ai)',
  theoretical: 'var(--lt-warm)',
  application: '#0EA5E9',
}

const difficultyStyle = computed(() => {
  const d = analysis.value?.difficulty
  if (d === '初级' || d === 'beginner') return { color: '#34C759', border: '1px solid #34C759' }
  if (d === '高级' || d === 'advanced') return { color: '#FF3B30', border: '1px solid #FF3B30' }
  return { color: 'var(--lt-warm)', border: '1px solid var(--lt-warm)' }
})
</script>

<template>
  <div class="analysis-bar">
    <!-- 骨架屏 -->
    <template v-if="!analysis">
      <div class="skeleton-tag"></div>
      <div class="skeleton-tag short"></div>
      <div class="skeleton-text"></div>
    </template>

    <template v-else>
      <span
        class="type-tag"
        :style="{ backgroundColor: typeColorMap[analysis.questionType] || 'var(--lt-text-auxiliary)' }"
      >
        {{ analysis.questionType }}
      </span>

      <span class="difficulty-tag" :style="difficultyStyle">
        {{ analysis.difficulty }}
      </span>

      <span class="domain-text">
        领域: {{ analysis.domain }}<span v-if="analysis.subDomain"> › {{ analysis.subDomain }}</span>
      </span>

      <div class="concepts-wrap">
        <el-tag
          v-for="(concept, i) in analysis.keyConcepts?.slice(0, 6)"
          :key="i"
          size="small"
          type="info"
        >
          {{ concept }}
        </el-tag>
      </div>

      <span class="intent-text" v-if="analysis.realIntent">
        真实意图: {{ analysis.realIntent }}
      </span>
    </template>
  </div>
</template>

<style scoped>
.analysis-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
}

.type-tag {
  padding: 3px 10px;
  border-radius: 20px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.difficulty-tag {
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 12px;
  background: transparent;
  white-space: nowrap;
}

.domain-text {
  font-size: 13px;
  color: var(--lt-text-auxiliary);
}

.concepts-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.intent-text {
  font-size: 12px;
  color: var(--lt-text-placeholder);
  font-style: italic;
  width: 100%;
}

.skeleton-tag {
  width: 60px;
  height: 22px;
  background: #F3F4F6;
  border-radius: 11px;
  animation: pulse 1.5s ease-in-out infinite;
}
.skeleton-tag.short { width: 40px; }
.skeleton-text {
  width: 120px;
  height: 16px;
  background: #F3F4F6;
  border-radius: 4px;
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

@media (max-width: 768px) {
  .analysis-bar { padding: 8px 0; gap: 6px; }
  .domain-text { font-size: 12px; width: 100%; }
}
</style>
