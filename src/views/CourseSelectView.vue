<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProfileStore } from '@/stores/profile'
import { apiFetch } from '@/utils/api'
import type { AvailableCourse } from '@/types'
import { ElMessage } from 'element-plus'
import { Right, Refresh } from '@element-plus/icons-vue'

const router = useRouter()
const profileStore = useProfileStore()

const availableCourses = ref<AvailableCourse[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const enrollingId = ref<string | null>(null)

const enrolledCount = computed(() => profileStore.courses.length)
const hasCourses = computed(() => profileStore.courses.length > 0)

/** 页面状态：loading | error | hasAvailable | empty_noCourses | empty_allEnrolled */
const pageState = computed(() => {
  if (loading.value) return 'loading'
  if (loadError.value) return 'error'
  if (availableCourses.value.length > 0) return 'hasAvailable'
  // 无可选课程：判断是系统无课还是用户全选了
  if (enrolledCount.value === 0) return 'empty_noCourses'
  return 'empty_allEnrolled'
})

async function loadAvailable() {
  loading.value = true
  loadError.value = null
  try {
    const res = await apiFetch<AvailableCourse[]>('/courses')
    availableCourses.value = res.data ?? []
  } catch (e: any) {
    loadError.value = e.message || '加载失败，请检查网络连接'
    availableCourses.value = []
  } finally {
    loading.value = false
  }
}

async function handleEnroll(courseId: string) {
  enrollingId.value = courseId
  try {
    await profileStore.enrollCourse(courseId)
    ElMessage.success('已加入课程！')
    await loadAvailable()
  } catch (e: any) {
    ElMessage.error(e.message || '选课失败')
  } finally {
    enrollingId.value = null
  }
}

function goToDashboard() {
  router.push('/')
}

async function retry() {
  await profileStore.fetchMyCourses()
  await loadAvailable()
}

onMounted(async () => {
  if (profileStore.courses.length === 0) {
    await profileStore.fetchMyCourses()
  }
  await loadAvailable()
})
</script>

<template>
  <div class="min-h-screen flex flex-col" style="background: linear-gradient(135deg, #f0f5ff 0%, #faf5ff 50%, #fefce8 100%);">
    <!-- Header -->
    <header class="h-16 flex items-center justify-between px-8 border-b bg-white/80 backdrop-blur-md">
      <div class="flex items-center gap-2">
        <img src="/logo.svg" alt="Logo" class="w-8 h-8" />
        <span class="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-orange-400">
          学思伴行
        </span>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-sm text-gray-500">已选 {{ enrolledCount }} 门课程</span>
        <el-button
          v-if="hasCourses"
          type="primary"
          :icon="Right"
          @click="goToDashboard"
        >
          进入学习总览
        </el-button>
      </div>
    </header>

    <!-- 主体 -->
    <div class="flex-1 flex flex-col items-center px-6 py-12">
      <!-- 标题 -->
      <div class="text-center mb-10">
        <h1 class="text-3xl font-bold mb-3" style="color: var(--lt-text-primary);">
          ✨ 选择你想学习的课程
        </h1>
        <p class="text-base" style="color: var(--lt-text-auxiliary);">
          选择一个课程，开启你的个性化学习之旅
        </p>
      </div>

      <!-- ====== 加载骨架 ====== -->
      <div v-if="pageState === 'loading'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full">
        <div v-for="i in 3" :key="i" class="rounded-2xl p-6 animate-pulse border" style="background-color: white; border-color: var(--lt-border);">
          <div class="w-12 h-12 rounded-xl mb-4" style="background-color: var(--lt-bg-page);" />
          <div class="h-5 w-3/4 rounded mb-2" style="background-color: var(--lt-bg-page);" />
          <div class="h-3 w-full rounded mb-1" style="background-color: var(--lt-bg-page);" />
          <div class="h-3 w-2/3 rounded mb-4" style="background-color: var(--lt-bg-page);" />
          <div class="h-4 w-1/3 rounded mb-4" style="background-color: var(--lt-bg-page);" />
          <div class="h-9 w-full rounded-lg" style="background-color: var(--lt-bg-page);" />
        </div>
      </div>

      <!-- ====== 加载错误 ====== -->
      <div v-else-if="pageState === 'error'" class="text-center py-16">
        <div class="text-5xl mb-4">⚠️</div>
        <h3 class="text-xl font-bold mb-2" style="color: var(--lt-text-primary);">课程加载失败</h3>
        <p class="mb-6" style="color: var(--lt-text-auxiliary);">{{ loadError }}</p>
        <el-button type="primary" :icon="Refresh" size="large" @click="retry">
          重新加载
        </el-button>
      </div>

      <!-- ====== 可选课程网格 ====== -->
      <div v-else-if="pageState === 'hasAvailable'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full">
        <div
          v-for="course in availableCourses"
          :key="course.id"
          class="course-card rounded-2xl p-6 border transition-all duration-200 hover:shadow-lg hover:-translate-y-1"
          style="background-color: white; border-color: var(--lt-border);"
        >
          <div class="w-14 h-14 rounded-xl flex items-center justify-center text-3xl mb-4"
            style="background: linear-gradient(135deg, #eef2ff, #f5f3ff);">
            {{ course.emoji || '📚' }}
          </div>
          <h3 class="text-lg font-bold mb-1.5" style="color: var(--lt-text-primary);">
            {{ course.name }}
          </h3>
          <p class="text-sm mb-4 line-clamp-2 min-h-[2.5rem]" style="color: var(--lt-text-auxiliary);">
            {{ course.description || '暂无描述' }}
          </p>
          <div class="flex items-center gap-1.5 text-xs mb-5" style="color: var(--lt-text-placeholder);">
            <span>{{ course.enrolledCount }} 人已选</span>
          </div>
          <el-button
            :loading="enrollingId === course.id"
            :disabled="enrollingId !== null"
            class="w-full !rounded-xl"
            type="primary"
            plain
            @click="handleEnroll(course.id)"
          >
            {{ enrollingId === course.id ? '加入中...' : '加入学习' }}
          </el-button>
        </div>
      </div>

      <!-- ====== 空状态1：用户全选了所有课程 ====== -->
      <div v-else-if="pageState === 'empty_allEnrolled'" class="text-center py-16">
        <div class="text-5xl mb-4">🎉</div>
        <h3 class="text-xl font-bold mb-2" style="color: var(--lt-text-primary);">你已经加入了所有可用课程</h3>
        <p class="mb-6" style="color: var(--lt-text-auxiliary);">
          已加入 {{ enrolledCount }} 门课程，开始你的学习之旅吧
        </p>
        <el-button type="primary" :icon="Right" size="large" @click="goToDashboard">
          进入学习总览
        </el-button>
      </div>

      <!-- ====== 空状态2：系统中暂无课程 ====== -->
      <div v-else-if="pageState === 'empty_noCourses'" class="text-center py-16">
        <div class="text-5xl mb-4">📚</div>
        <h3 class="text-xl font-bold mb-2" style="color: var(--lt-text-primary);">暂无可选课程</h3>
        <p class="mb-6 max-w-md" style="color: var(--lt-text-auxiliary);">
          系统中还没有课程，请联系管理员添加课程后再来选课
        </p>
        <el-button :icon="Refresh" size="large" @click="retry">
          刷新
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.course-card {
  transition: all 0.2s ease;
}
.course-card:hover {
  border-color: var(--lt-brand-lighter) !important;
}
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
