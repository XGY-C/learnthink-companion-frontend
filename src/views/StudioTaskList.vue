<template>
  <div class="studio-list p-6">
    <!-- 页面标题栏 -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <div class="flex items-center gap-3">
          <StudioIcon :size="36" />
          <h2 class="text-2xl font-bold m-0" style="color: var(--lt-text-primary);">资源工作室</h2>
        </div>
        <p class="text-sm mt-1 ml-[44px]" style="color: var(--lt-text-auxiliary);">查看所有资源生成任务</p>
      </div>
    </div>

    <!-- 工具栏：搜索 + 筛选 + 视图切换 -->
    <div class="flex items-center gap-3 mb-6 flex-wrap">
      <el-input
        v-model="searchText"
        placeholder="搜索任务..."
        clearable
        class="!w-56"
        :prefix-icon="Search"
      />
      <el-radio-group v-model="statusFilter" size="small">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="RUNNING">生成中</el-radio-button>
        <el-radio-button value="SUCCEEDED">已完成</el-radio-button>
        <el-radio-button value="FAILED">失败</el-radio-button>
      </el-radio-group>
      <div class="ml-auto flex items-center bg-slate-100 rounded-lg p-0.5">
        <button
          class="px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors"
          :style="viewMode === 'card' ? activeToggleStyle : inactiveToggleStyle"
          @click="setViewMode('card')"
        >
          <el-icon size="14"><Grid /></el-icon>
          <span class="ml-1">卡片</span>
        </button>
        <button
          class="px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors"
          :style="viewMode === 'list' ? activeToggleStyle : inactiveToggleStyle"
          @click="setViewMode('list')"
        >
          <el-icon size="14"><List /></el-icon>
          <span class="ml-1">列表</span>
        </button>
      </div>
    </div>

    <!-- 加载骨架 -->
    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div v-for="i in 4" :key="i" class="rounded-xl p-5 animate-pulse" style="background-color: var(--lt-bg-card); border: 1px solid var(--lt-border);">
        <div class="h-3 w-16 rounded mb-3" style="background-color: var(--lt-bg-page);" />
        <div class="h-4 w-3/4 rounded mb-2" style="background-color: var(--lt-bg-page);" />
        <div class="h-3 w-1/2 rounded mb-4" style="background-color: var(--lt-bg-page);" />
        <div class="h-1.5 w-full rounded" style="background-color: var(--lt-bg-page);" />
      </div>
    </div>

    <!-- 空状态 -->
    <EmptyState
      v-else-if="filteredTasks.length === 0 && !loading"
      :icon="!searchText && !statusFilter ? MagicStick : FolderOpened"
      :title="!searchText && !statusFilter ? '还没有生成过资源包' : '没有匹配的任务'"
      :description="!searchText && !statusFilter ? '去对话页让 AI 帮你生成第一份学习资源' : '试试调整筛选条件'"
      :action-text="!searchText && !statusFilter ? '前往对话页' : ''"
      :action-icon="!searchText && !statusFilter ? ChatLineRound : undefined"
      size="large"
      @action="$router.push('/chat')"
    />

    <!-- 卡片视图 -->
    <div v-else-if="viewMode === 'card'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div
        v-for="(task, index) in filteredTasks"
        :key="task.taskId"
        class="stagger-fade-in"
        :style="{ animationDelay: `${index * 60}ms` }"
      >
        <TaskCard
          :task="task"
          :course-name="courseNameMap[task.courseId] || task.courseId"
          @click="goToDetail(task.taskId)"
        />
      </div>
    </div>

    <!-- 列表视图 -->
    <div v-else class="rounded-lg border overflow-hidden" style="border-color: var(--lt-border); background-color: var(--lt-bg-card);">
      <div class="grid grid-cols-12 gap-3 px-4 py-2.5 text-[11px] font-medium" style="color: var(--lt-text-auxiliary); background-color: var(--lt-bg-page); border-bottom: 1px solid var(--lt-border);">
        <span class="col-span-1">状态</span>
        <span class="col-span-3">知识点</span>
        <span class="col-span-2">进度</span>
        <span class="col-span-2">资源</span>
        <span class="col-span-2">时间</span>
        <span class="col-span-2">操作</span>
      </div>
      <div
        v-for="task in filteredTasks"
        :key="task.taskId"
        class="grid grid-cols-12 gap-3 px-4 py-3 items-center text-sm cursor-pointer transition-colors hover:bg-slate-50"
        style="border-bottom: 1px solid var(--lt-border);"
        @click="goToDetail(task.taskId)"
      >
        <!-- 状态 -->
        <span class="col-span-1 flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: getStatusConfig(task.status).color }" />
          <span class="text-[11px]" :style="{ color: getStatusConfig(task.status).color }">{{ getStatusConfig(task.status).label }}</span>
        </span>
        <!-- 知识点 -->
        <span class="col-span-3 font-medium truncate" style="color: var(--lt-text-primary);">{{ task.topic || '未命名' }}</span>
        <!-- 进度 -->
        <span class="col-span-2 text-[12px]" style="color: var(--lt-text-auxiliary);">
          <template v-if="task.status === 'RUNNING'">
            <div class="flex items-center gap-2">
              <div class="h-1.5 rounded-full flex-1" style="background-color: var(--lt-bg-page);">
                <div class="h-1.5 rounded-full" :style="{ width: (task.percent ?? 0) + '%', backgroundColor: getStatusConfig(task.status).color }" />
              </div>
              <span>{{ task.percent ?? 0 }}%</span>
            </div>
          </template>
          <template v-else-if="task.status === 'SUCCEEDED'">
            <span class="text-[11px]" style="color: var(--lt-success);">完成</span>
          </template>
          <template v-else-if="task.status === 'FAILED'">
            <span class="text-[11px]" style="color: var(--lt-danger);">—</span>
          </template>
          <template v-else>
            <span class="text-[11px]" style="color: var(--lt-text-placeholder);">等待中</span>
          </template>
        </span>
        <!-- 资源 -->
        <span class="col-span-2 text-[12px]" style="color: var(--lt-text-auxiliary);">
          <template v-if="task.status === 'SUCCEEDED'">{{ task.resourceCount }} 项</template>
          <template v-else-if="task.status === 'RUNNING'">{{ task.resourceTypes?.length || 0 }} 类待生成</template>
          <template v-else>—</template>
        </span>
        <!-- 时间 -->
        <span class="col-span-2 text-[11px]" style="color: var(--lt-text-placeholder);">{{ formatRelativeTime(task.createdAt) }}</span>
        <!-- 操作 -->
        <span class="col-span-2">
          <el-button link type="primary" size="small" @click.stop="goToDetail(task.taskId)">
            查看详情 →
          </el-button>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ChatLineRound, MagicStick, FolderOpened, Grid, List, Search } from '@element-plus/icons-vue'
import type { TaskSummary } from '@/types'
import { TASK_STATUS_CONFIG, formatRelativeTime } from '@/constants'
import { apiFetch } from '@/utils/api'
import { useProfileStore } from '@/stores/profile'
import TaskCard from '@/components/TaskCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import StudioIcon from '@/components/icons/StudioIcon.vue'

const router = useRouter()
const profileStore = useProfileStore()

const tasks = ref<TaskSummary[]>([])
const loading = ref(true)
const searchText = ref('')
const statusFilter = ref('')
const viewMode = ref<'card' | 'list'>(
  (localStorage.getItem('studioViewMode') as 'card' | 'list') || 'card'
)

const activeToggleStyle = {
  backgroundColor: 'white',
  color: 'var(--lt-brand)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  border: 'none',
}
const inactiveToggleStyle = {
  backgroundColor: 'transparent',
  color: 'var(--lt-text-auxiliary)',
  border: 'none',
}

const courseNameMap: Record<string, string> = {
  'course-ai-001': 'AI 导论',
  'course-db-001': '数据库原理',
}

function setViewMode(mode: 'card' | 'list') {
  viewMode.value = mode
  localStorage.setItem('studioViewMode', mode)
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
  } catch {
    // silently handle - show empty state
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadTasks()
})
</script>
