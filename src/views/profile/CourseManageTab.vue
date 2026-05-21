<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProfileStore } from '@/stores/profile'
import { apiFetch } from '@/utils/api'
import type { AvailableCourse } from '@/types'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Notebook, Right } from '@element-plus/icons-vue'

const router = useRouter()
const profileStore = useProfileStore()

const availableCourses = ref<AvailableCourse[]>([])
const loading = ref(false)
const loadError = ref(false)

onMounted(() => {
  fetchAvailableCourses()
})

async function fetchAvailableCourses() {
  loading.value = true
  loadError.value = false
  try {
    const res = await apiFetch<AvailableCourse[]>('/courses/available')
    availableCourses.value = res.data || []
  } catch {
    availableCourses.value = []
    loadError.value = true
  } finally {
    loading.value = false
  }
}

async function handleSwitch(course: { id: string; name: string; emoji: string }) {
  profileStore.switchCourse(course as any)
  ElMessage.success(`已切换到「${course.name}」`)
  router.push('/')
}

async function handleLeave(course: { id: string; name: string }) {
  try {
    await ElMessageBox.confirm(`确定退出「${course.name}」吗？退出后该课程的学习数据将保留。`, '退课确认', {
      confirmButtonText: '确定退出',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await profileStore.leaveCourse(course.id)
    ElMessage.success(`已退出「${course.name}」`)
  } catch { /* 取消 */ }
}

async function handleEnroll(course: AvailableCourse) {
  try {
    await profileStore.enrollCourse(course.id)
    ElMessage.success(`已加入「${course.name}」`)
    router.push('/')
  } catch {
    ElMessage.error('选课失败')
  }
}

const availableToJoin = computed(() =>
  availableCourses.value.filter(c =>
    !profileStore.courses.find(mc => mc.id === c.id)
  )
)
</script>

<template>
  <div class="max-w-lg">
    <!-- 加载中 -->
    <div v-if="loading" class="flex items-center justify-center h-48">
      <el-icon class="is-loading" :size="28" style="color: var(--lt-brand);"><Notebook /></el-icon>
    </div>

    <!-- 加载失败 -->
    <div v-else-if="loadError" class="text-center py-8">
      <p class="text-sm mb-4" style="color: var(--lt-text-auxiliary);">课程数据加载失败</p>
      <el-button size="small" @click="fetchAvailableCourses()">重试</el-button>
    </div>

    <!-- 空状态 -->
    <template v-else-if="profileStore.courses.length === 0 && !loading">
      <div class="text-center py-12">
        <el-icon :size="48" style="color: var(--lt-text-placeholder);"><Notebook /></el-icon>
        <p class="text-sm mt-3 mb-6" style="color: var(--lt-text-auxiliary);">
          你还没有加入任何课程。选择一门课程开始学习。
        </p>
        <el-button type="primary" @click="router.push('/courses')">
          去选课
          <el-icon class="ml-1"><Right /></el-icon>
        </el-button>
      </div>
    </template>

    <template v-else>
      <!-- 已选课程 -->
      <p class="text-sm font-medium mb-3" style="color: var(--lt-text-secondary);">已选课程（{{ profileStore.courses.length }}门）</p>
      <div class="space-y-3 mb-6">
        <div
          v-for="c in profileStore.courses"
          :key="c.id"
          class="rounded-xl border p-4 flex items-center justify-between"
          :class="c.id === profileStore.activeCourseId ? 'border-l-2' : ''"
          style="border-color: var(--lt-border);"
          :style="c.id === profileStore.activeCourseId ? { borderLeftColor: 'var(--lt-brand)', backgroundColor: 'var(--lt-bg-card)' } : { backgroundColor: 'var(--lt-bg-card)' }"
        >
          <div class="flex items-center gap-3">
            <span class="text-xl">{{ c.emoji }}</span>
            <div>
              <p class="text-sm font-medium" style="color: var(--lt-text-primary);">{{ c.name }}</p>
              <p class="text-xs" style="color: var(--lt-text-auxiliary);">
                {{ c.id === profileStore.activeCourseId ? '当前课程' : c.progress ? `路径进度 ${c.progress.pathProgressPercent}%` : '未开始' }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <el-button
              v-if="c.id !== profileStore.activeCourseId"
              size="small"
              plain
              @click="handleSwitch(c)"
            >切换</el-button>
            <el-tag v-else size="small" type="success" effect="plain">当前</el-tag>
            <el-button
              size="small"
              type="danger"
              link
              @click="handleLeave(c)"
            >退出</el-button>
          </div>
        </div>
      </div>

      <!-- 可选课程 -->
      <div v-if="availableToJoin.length > 0">
        <p class="text-sm font-medium mb-3" style="color: var(--lt-text-secondary);">可选课程</p>
        <div class="space-y-2">
          <div
            v-for="c in availableToJoin"
            :key="c.id"
            class="rounded-lg border p-3 flex items-center justify-between"
            style="border-color: var(--lt-border); background-color: var(--lt-bg-card);"
          >
            <div class="flex items-center gap-2">
              <span>{{ c.emoji }}</span>
              <span class="text-sm" style="color: var(--lt-text-primary);">{{ c.name }}</span>
              <span class="text-xs" style="color: var(--lt-text-placeholder);">{{ c.enrolledCount }} 人已选</span>
            </div>
            <el-button size="small" type="primary" plain @click="handleEnroll(c)">加入</el-button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
