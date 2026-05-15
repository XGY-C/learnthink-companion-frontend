<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = withDefaults(defineProps<{
  topic: string
  taskId: string
  status?: 'generating' | 'done' | 'failed'
  progress?: number
  resourceTypes?: string[]
  readyCount?: number
  totalCount?: number
  message?: string
  errorMessage?: string
}>(), {
  status: 'generating',
  progress: 0,
  resourceTypes: () => [],
  readyCount: 0,
  totalCount: 0,
  message: '准备中...',
})

const router = useRouter()

const typeIcons: Record<string, string> = {
  doc: '📄', quiz: '📝', mindmap: '🧠', code: '💻', reading: '📚',
}
const typeLabels: Record<string, string> = {
  doc: '讲解文档', quiz: '练习题', mindmap: '思维导图', code: '代码实操', reading: '拓展阅读',
}

const resourceBadges = computed(() =>
  (props.resourceTypes || []).map(t => ({
    icon: typeIcons[t] || '📄',
    label: typeLabels[t] || t,
  }))
)

function handleClick() {
  router.push(`/studio/${props.taskId}`)
}
</script>

<template>
  <div
    class="gen-card"
    :class="'gen-' + status"
    @click="handleClick"
  >
    <!-- 头部 -->
    <div class="gen-header">
      <span class="gen-icon">{{ status === 'generating' ? '🔄' : status === 'done' ? '✅' : '❌' }}</span>
      <span class="gen-topic">{{ topic }}</span>
      <span class="gen-badge" :class="'badge-' + status">
        {{ status === 'generating' ? '生成中' : status === 'done' ? '已就绪' : '失败' }}
      </span>
    </div>

    <!-- Planner 资源类型标签（异步回填） -->
    <div v-if="resourceBadges.length > 0" class="gen-types">
      <span v-for="badge in resourceBadges" :key="badge.label" class="gen-type-tag">
        {{ badge.icon }} {{ badge.label }}
      </span>
    </div>

    <!-- 生成中：进度条 -->
    <div v-if="status === 'generating'" class="gen-body">
      <div class="gen-progress-track">
        <div class="gen-progress-fill" :style="{ width: (progress || 0) + '%' }" />
      </div>
      <div class="gen-stats">
        <span v-if="message">{{ message }}</span>
        <span v-else>准备中...</span>
      </div>
    </div>

    <!-- 完成态 -->
    <div v-else-if="status === 'done'" class="gen-body gen-body-done">
      <span>✅ 已生成 {{ resourceTypes?.length || 0 }} 类资源，点击查看详情</span>
    </div>

    <!-- 失败态 -->
    <div v-else-if="status === 'failed'" class="gen-body gen-body-failed">
      <span>{{ errorMessage || '生成失败，点击查看详情' }}</span>
    </div>
  </div>
</template>

<style scoped>
.gen-card {
  margin: 8px 0;
  border-radius: 12px;
  border: 1px solid var(--lt-border);
  background-color: var(--lt-bg-card);
  cursor: pointer;
  transition: box-shadow 0.2s, border-color 0.2s;
  overflow: hidden;
  user-select: none;
}
.gen-card:hover {
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}
.gen-card.gen-generating { border-left: 3px solid var(--lt-brand); }
.gen-card.gen-done { border-left: 3px solid var(--lt-success); }
.gen-card.gen-failed { border-left: 3px solid var(--lt-danger); }

.gen-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px 0;
  font-size: 14px;
}
.gen-icon { font-size: 16px; }
.gen-topic { font-weight: 600; color: var(--lt-text-primary); flex: 1; }
.gen-badge {
  flex-shrink: 0;
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 10px;
  line-height: 1.6;
}
.badge-generating { background-color: rgba(43,111,255,0.1); color: var(--lt-brand); }
.badge-done { background-color: rgba(52,199,89,0.1); color: var(--lt-success); }
.badge-failed { background-color: rgba(245,108,108,0.1); color: var(--lt-danger); }

.gen-types {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 14px 0;
}
.gen-type-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background-color: var(--lt-bg-page);
  color: var(--lt-text-secondary);
}

.gen-body {
  padding: 8px 14px 10px;
}
.gen-progress-track {
  height: 4px;
  border-radius: 4px;
  background-color: var(--lt-border);
  overflow: hidden;
  margin-bottom: 4px;
}
.gen-progress-fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--lt-brand), var(--lt-brand-light-2));
  transition: width 0.4s ease;
}
.gen-stats {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
}
.gen-body-done {
  font-size: 13px;
  color: var(--lt-success);
}
.gen-body-failed {
  font-size: 13px;
  color: var(--lt-danger);
}
</style>
