<template>
  <div class="agent-activity-panel" v-if="agents.length > 0">
    <h3>Agent 活动</h3>
    <div class="agent-list">
      <div
        v-for="agent in agents"
        :key="agent.jobId"
        class="agent-row"
        :class="'status-' + agent.status"
      >
        <span class="agent-type-badge" :class="'type-' + agent.type">
          {{ typeLabel(agent.type) }}
        </span>
        <span class="agent-title">{{ agent.title }}</span>
        <span v-if="agent.status === 'generating'" class="spinner"></span>
        <span v-else-if="agent.status === 'done'" class="done-icon">&#10003;</span>
        <span v-else-if="agent.status === 'failed'" class="failed-icon">&#10007;</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface AgentActivity {
  jobId: string
  type: string
  title: string
  status: 'started' | 'generating' | 'done' | 'failed'
}

defineProps<{ agents: AgentActivity[] }>()

const typeLabel = (t: string) => {
  const m: Record<string, string> = { doc:'文档', quiz:'习题', reading:'阅读', code:'代码', mindmap:'思维导图' }
  return m[t] || t
}
</script>

<style scoped>
.agent-activity-panel {
  background: var(--el-bg-color);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  border: 1px solid var(--el-border-color-light);
}
.agent-activity-panel h3 { margin: 0 0 12px 0; font-size: 15px; font-weight: 600; }
.agent-list { display: flex; flex-direction: column; gap: 6px; }
.agent-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
  font-size: 13px;
}
.agent-row.status-generating { background: rgba(124, 92, 252, 0.06); }
.agent-row.status-done { opacity: 0.6; }
.agent-row.status-failed { background: rgba(245, 108, 108, 0.06); }
.agent-type-badge {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 4px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
}
.type-doc { background: #2B6FFF; }
.type-quiz { background: #FF8C42; }
.type-reading { background: #7C5CFC; }
.type-code { background: #2F855A; }
.type-mindmap { background: #E53E3E; }
.agent-title { flex: 1; color: var(--el-text-color-primary); }
.spinner {
  width: 14px; height: 14px;
  border: 2px solid var(--lt-brand); border-top-color: transparent;
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
.done-icon { color: #67c23a; font-size: 16px; }
.failed-icon { color: #f56c6c; font-size: 16px; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
