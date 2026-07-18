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
      <el-input
        v-model="searchText"
        placeholder="搜索任务..."
        clearable
        :prefix-icon="Search"
        class="m-search-el"
        size="default"
      />
      <div class="m-toolbar-row">
        <el-radio-group v-model="statusFilter" size="small" class="m-filter-group">
          <el-radio-button value="">全部</el-radio-button>
          <el-radio-button value="RUNNING">生成中</el-radio-button>
          <el-radio-button value="SUCCEEDED">已完成</el-radio-button>
          <el-radio-button value="FAILED">失败</el-radio-button>
        </el-radio-group>
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
    <EmptyState
      v-else-if="filteredTasks.length === 0"
      :icon="!searchText && !statusFilter ? MagicStick : FolderOpened"
      :title="!searchText && !statusFilter ? '还没有生成过资源包' : '没有匹配的任务'"
      :description="!searchText && !statusFilter ? '去对话页让 AI 帮你生成第一份学习资源' : '试试调整筛选条件'"
      :action-text="!searchText && !statusFilter ? '前往对话页' : ''"
      :action-icon="!searchText && !statusFilter ? ChatLineRound : undefined"
      size="large"
      @action="$router.push('/chat')"
    />

    <!-- Card view -->
    <div v-else class="m-studio-grid">
      <div
        v-for="(task, index) in filteredTasks"
        :key="task.taskId"
        class="stagger-fade-in"
        :style="{ animationDelay: `${index * 60}ms` }"
      >
        <TaskCard
          :task="task"
          :course-name="getCourseName(task.courseId)"
          @click="goToDetail(task.taskId)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ChatLineRound, MagicStick, FolderOpened, Search } from '@element-plus/icons-vue'
import type { TaskSummary } from '@/types'
import { apiFetch } from '@/utils/api'
import { useProfileStore } from '@/stores/profile'
import TaskCard from '@/components/TaskCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { usePullToRefresh } from '@/composables/usePullToRefresh'

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

const courseNameMap = ref<Record<string, string>>({})

function getCourseName(courseId: string): string {
  return courseNameMap.value[courseId] || profileStore.courses.find(c => c.id === courseId)?.name || courseId
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

const hasRunningTasks = computed(() => tasks.value.some(t => t.status === 'RUNNING'))

function goToDetail(taskId: string) {
  router.push(`/studio/${taskId}`)
}

async function loadCourseNames() {
  const ids = [...new Set(tasks.value.map(t => t.courseId).filter(Boolean))]
  const map: Record<string, string> = {}
  for (const id of ids) {
    const c = profileStore.courses.find(c => c.id === id)
    if (c) map[id] = c.name
  }
  for (const id of ids) {
    if (!map[id]) {
      try {
        const res = await apiFetch<{ id: string; name: string; emoji: string }>(`/courses/${id}`)
        if (res.data) map[id] = res.data.name
      } catch { /* ignore */ }
    }
  }
  courseNameMap.value = map
}

async function loadTasks(silent = false) {
  if (!silent) loading.value = true
  try {
    const courseId = profileStore.activeCourseId
    const url = courseId ? `/tasks?courseId=${courseId}` : '/tasks'
    const res = await apiFetch<TaskSummary[]>(url)
    if (res.data) {
      tasks.value = res.data
      if (!silent) loadCourseNames()
    }
  } catch { /* ignore */ }
  finally { if (!silent) loading.value = false }
}

let pollTimer: ReturnType<typeof setInterval> | null = null

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    if (!hasRunningTasks.value) return
    await loadTasks(true)
  }, 5000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onMounted(() => {
  loadTasks()
  startPolling()
})

onUnmounted(() => {
  stopPolling()
})
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

.m-search-el { --el-input-height: 44px; }
.m-search-el :deep(.el-input__wrapper) {
  background: var(--lt-bg-card);
  border-radius: 10px;
  border: 0.5px solid var(--lt-border);
  box-shadow: none;
  padding: 0 12px;
}
.m-search-el :deep(.el-input__inner) {
  font-size: 15px;
  color: var(--lt-text-primary);
}
.m-search-el :deep(.el-input__inner::placeholder) { color: var(--lt-text-placeholder); }
.m-search-el :deep(.el-input__prefix) { color: var(--lt-text-placeholder); }
.m-search-el :deep(.el-input__clear) { color: var(--lt-text-placeholder); }

.m-toolbar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.m-filter-group {
  flex: 1;
  overflow-x: auto;
  display: flex;
  white-space: nowrap;
}
.m-filter-group :deep(.el-radio-button__inner) {
  padding: 0 14px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  border-color: var(--lt-border);
  background: var(--lt-bg-card);
  color: var(--lt-text-secondary);
  border-radius: 0;
}
.m-filter-group :deep(.el-radio-button:first-child .el-radio-button__inner) {
  border-radius: 16px 0 0 16px;
  border-right: none;
}
.m-filter-group :deep(.el-radio-button:last-child .el-radio-button__inner) {
  border-radius: 0 16px 16px 0;
}
.m-filter-group :deep(.el-radio-button__orig-radio:checked + .el-radio-button__inner) {
  background: var(--lt-brand);
  border-color: var(--lt-brand);
  color: #fff;
  box-shadow: none;
}

/* ===== Loading skeleton ===== */
.m-studio-skeleton { display: flex; flex-direction: column; gap: 12px; }
.m-skeleton-card {
  background: var(--lt-bg-card); border-radius: 12px; padding: 16px;
  border: 0.5px solid var(--lt-border); animation: pulse 1.5s ease-in-out infinite;
}
.m-sk-title { height: 16px; width: 60%; background: var(--lt-bg-page); border-radius: 4px; margin-bottom: 8px; }
.m-sk-meta { height: 12px; width: 40%; background: var(--lt-bg-page); border-radius: 4px; margin-bottom: 10px; }
.m-sk-bar { height: 6px; width: 100%; background: var(--lt-bg-page); border-radius: 3px; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

/* ===== Card grid ===== */
.m-studio-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

/* ===== Stagger fade-in ===== */
.stagger-fade-in {
  animation: staggerIn 0.4s ease-out both;
}
@keyframes staggerIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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
