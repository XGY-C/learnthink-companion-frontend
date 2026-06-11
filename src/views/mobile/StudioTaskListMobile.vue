<template>
  <div ref="pullContainer" class="m-studio-list">
    <!-- 下拉刷新指示器 -->
    <div class="m-pull-indicator" :class="{ visible: pullState !== 'idle', refreshing: pullState === 'refreshing' }" :style="{ height: pullDistance + 'px' }">
      <template v-if="pullState === 'refreshing'">
        <div class="m-pull-spinner" />
        <span>刷新中...</span>
      </template>
      <template v-else-if="pullDistance >= 60">
        <span>释放刷新</span>
      </template>
      <template v-else>
        <span>下拉刷新</span>
      </template>
    </div>
    <div class="m-studio-header">
      <h2 class="m-studio-title">资源工作室</h2>
      <p class="m-studio-subtitle">查看所有资源生成任务</p>
    </div>

    <div class="m-studio-toolbar">
      <div class="m-search-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="m-search-icon"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input v-model="searchText" class="m-search-input" placeholder="搜索任务..." />
      </div>
      <div class="m-filter-tabs">
        <button v-for="opt in filterOptions" :key="opt.value" class="m-filter-tab" :class="{ active: statusFilter === opt.value }" @click="statusFilter = opt.value">{{ opt.label }}</button>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="m-studio-skeleton">
      <div v-for="i in 3" :key="i" class="m-skeleton-card">
        <div class="m-sk-title" />
        <div class="m-sk-meta" />
        <div class="m-sk-bar" />
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="filteredTasks.length === 0" class="m-studio-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--lt-text-placeholder)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
      <p class="m-empty-title">{{ searchText || statusFilter ? '没有匹配的任务' : '还没有生成过资源包' }}</p>
      <p class="m-empty-desc">{{ searchText || statusFilter ? '试试调整筛选条件' : '去对话页让 AI 帮你生成第一份学习资源' }}</p>
      <button v-if="!searchText && !statusFilter" class="m-empty-action" @click="$router.push('/chat')">前往对话页</button>
    </div>

    <!-- Task cards -->
    <div v-else class="m-studio-cards">
      <div
        v-for="task in filteredTasks"
        :key="task.taskId"
        class="m-task-card"
        @click="goToDetail(task.taskId)"
      >
        <div class="m-task-top">
          <span class="m-task-status" :style="{ color: getStatusConfig(task.status).color }">
            <span class="m-status-dot" :style="{ backgroundColor: getStatusConfig(task.status).color }" />
            {{ getStatusConfig(task.status).label }}
          </span>
          <span class="m-task-time">{{ formatRelativeTime(task.createdAt) }}</span>
        </div>
        <h3 class="m-task-topic">{{ task.topic || '未命名' }}</h3>
        <div class="m-task-meta">
          <template v-if="task.status === 'RUNNING'">
            <div class="m-task-progress">
              <div class="m-progress-bar">
                <div class="m-progress-fill" :style="{ width: (task.percent ?? 0) + '%' }" />
              </div>
              <span>{{ task.percent ?? 0 }}%</span>
            </div>
          </template>
          <template v-else-if="task.status === 'SUCCEEDED'">
            <span>{{ task.resourceCount }} 项资源 · {{ getCourseName(task.courseId) }}</span>
          </template>
          <template v-else-if="task.status === 'FAILED'">
            <span style="color: var(--lt-danger);">生成失败</span>
          </template>
          <template v-else>
            <span style="color: var(--lt-text-placeholder);">等待中</span>
          </template>
        </div>
        <div v-if="task.status === 'RUNNING' && task.resourceTypes?.length" class="m-task-types">
          <span v-for="t in task.resourceTypes" :key="t" class="m-task-type-tag">{{ typeLabel(t) }}</span>
        </div>
        <div class="m-task-arrow">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePullToRefresh } from '@/composables/usePullToRefresh'
import type { TaskSummary } from '@/types'
import { TASK_STATUS_CONFIG, formatRelativeTime } from '@/constants'
import { apiFetch } from '@/utils/api'
import { useProfileStore } from '@/stores/profile'
import { typeLabel } from '@/composables/useTaskStream'

const router = useRouter()
const profileStore = useProfileStore()

const tasks = ref<TaskSummary[]>([])
const loading = ref(true)
const searchText = ref('')
const statusFilter = ref('')

const pullContainer = ref<HTMLElement | null>(null)
const { pullState, pullDistance } = usePullToRefresh(pullContainer, async () => {
  await loadTasks()
})

const filterOptions = [
  { label: '全部', value: '' },
  { label: '生成中', value: 'RUNNING' },
  { label: '已完成', value: 'SUCCEEDED' },
  { label: '失败', value: 'FAILED' },
]

const courseNameMap = ref<Record<string, string>>({})

function getCourseName(courseId: string): string {
  return courseNameMap.value[courseId] || profileStore.courses.find(c => c.id === courseId)?.name || courseId
}

function getStatusConfig(status: string) {
  return TASK_STATUS_CONFIG[status] ?? TASK_STATUS_CONFIG.PENDING
}

const filteredTasks = computed(() => {
  let result = tasks.value
  if (searchText.value) {
    const q = searchText.value.toLowerCase()
    result = result.filter(t => (t.topic || '').toLowerCase().includes(q))
  }
  if (statusFilter.value) {
    result = result.filter(t => t.status === statusFilter.value)
  }
  return result
})

function goToDetail(taskId: string) {
  router.push(`/studio/${taskId}`)
}

async function loadTasks() {
  loading.value = true
  try {
    const courseId = profileStore.activeCourseId
    const url = courseId ? `/tasks?courseId=${courseId}` : '/tasks'
    const res = await apiFetch<TaskSummary[]>(url)
    if (res.data) {
      tasks.value = res.data
    }
  } catch { /* ignore */ }
  finally { loading.value = false }
}

onMounted(() => { loadTasks() })
</script>

<style scoped>
.m-studio-list {
  padding: 16px;
  min-height: 100%;
  background: var(--lt-bg-page);
}

.m-studio-header { margin-bottom: 16px; }
.m-studio-title { font-size: 20px; font-weight: 700; color: var(--lt-text-primary); margin: 0; }
.m-studio-subtitle { font-size: 13px; color: var(--lt-text-auxiliary); margin: 4px 0 0; }

.m-studio-toolbar { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }

.m-search-wrap {
  display: flex; align-items: center; gap: 8px;
  background: var(--lt-bg-card); border-radius: 10px;
  padding: 0 12px; border: 0.5px solid var(--lt-border);
}
.m-search-icon { flex-shrink: 0; color: var(--lt-text-placeholder); }
.m-search-input {
  flex: 1; border: none; background: transparent;
  font-size: 15px; color: var(--lt-text-primary);
  padding: 10px 0; outline: none;
}
.m-search-input::placeholder { color: var(--lt-text-placeholder); }

.m-filter-tabs { display: flex; gap: 6px; overflow-x: auto; }
.m-filter-tab {
  padding: 6px 14px; border-radius: 16px; border: 0.5px solid var(--lt-border);
  background: var(--lt-bg-card); font-size: 12px; color: var(--lt-text-secondary);
  white-space: nowrap; cursor: pointer; touch-action: manipulation;
}
.m-filter-tab.active { border-color: var(--lt-brand); color: var(--lt-brand); background: var(--lt-brand-lightest); font-weight: 500; }

.m-studio-skeleton { display: flex; flex-direction: column; gap: 12px; }
.m-skeleton-card {
  background: var(--lt-bg-card); border-radius: 12px; padding: 16px;
  border: 0.5px solid var(--lt-border); animation: pulse 1.5s ease-in-out infinite;
}
.m-sk-title { height: 16px; width: 60%; background: var(--lt-bg-page); border-radius: 4px; margin-bottom: 8px; }
.m-sk-meta { height: 12px; width: 40%; background: var(--lt-bg-page); border-radius: 4px; margin-bottom: 10px; }
.m-sk-bar { height: 6px; width: 100%; background: var(--lt-bg-page); border-radius: 3px; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

.m-studio-empty { display: flex; flex-direction: column; align-items: center; padding: 60px 24px; text-align: center; }
.m-empty-title { font-size: 15px; font-weight: 500; color: var(--lt-text-secondary); margin: 12px 0 4px; }
.m-empty-desc { font-size: 13px; color: var(--lt-text-placeholder); margin: 0 0 16px; }
.m-empty-action {
  padding: 10px 24px; border-radius: 20px; border: none;
  background: var(--lt-brand); color: #fff; font-size: 14px; cursor: pointer; touch-action: manipulation;
}

.m-studio-cards { display: flex; flex-direction: column; gap: 12px; }

.m-task-card {
  position: relative; background: var(--lt-bg-card); border-radius: 12px;
  padding: 16px; border: 0.5px solid var(--lt-border);
  cursor: pointer; touch-action: manipulation;
  transition: box-shadow 0.15s;
}
.m-task-card:active { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }

.m-task-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.m-task-status { font-size: 11px; font-weight: 500; display: flex; align-items: center; gap: 4px; }
.m-status-dot { width: 6px; height: 6px; border-radius: 50%; }
.m-task-time { font-size: 11px; color: var(--lt-text-placeholder); }

.m-task-topic { font-size: 16px; font-weight: 600; color: var(--lt-text-primary); margin: 0 0 8px; }

.m-task-meta { font-size: 13px; color: var(--lt-text-auxiliary); margin-bottom: 8px; }
.m-task-progress { display: flex; align-items: center; gap: 8px; }
.m-progress-bar { flex: 1; height: 6px; background: var(--lt-bg-page); border-radius: 3px; overflow: hidden; }
.m-progress-fill { height: 100%; background: var(--lt-brand); border-radius: 3px; transition: width 0.3s; }

.m-task-types { display: flex; flex-wrap: wrap; gap: 4px; }
.m-task-type-tag {
  font-size: 10px; padding: 2px 8px; border-radius: 8px;
  background: var(--lt-brand-lightest); color: var(--lt-brand);
}

.m-task-arrow {
  position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
  color: var(--lt-text-placeholder);
}

/* ===== Pull-to-refresh ===== */
.m-pull-indicator {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  font-size: 12px; color: var(--lt-text-auxiliary);
  overflow: hidden; transition: height 0.1s;
  height: 0;
}
.m-pull-indicator.visible { min-height: 0; }
.m-pull-indicator.refreshing { color: var(--lt-brand); }
.m-pull-spinner {
  width: 16px; height: 16px;
  border: 2px solid var(--lt-border); border-top-color: var(--lt-brand);
  border-radius: 50%; animation: pull-spin 0.6s linear infinite;
}
@keyframes pull-spin { to { transform: rotate(360deg); } }
</style>
