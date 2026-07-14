<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProfileStore } from '@/stores/profile'
import { apiFetch } from '@/utils/api'
import type { AvailableCourse } from '@/types'
import { ElMessage } from 'element-plus'

const router = useRouter()
const profileStore = useProfileStore()

const availableCourses = ref<AvailableCourse[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const enrollingId = ref<string | null>(null)

const enrolledCount = computed(() => profileStore.courses.length)
const hasCourses = computed(() => profileStore.courses.length > 0)

const pageState = computed(() => {
  if (loading.value) return 'loading'
  if (loadError.value) return 'error'
  if (availableCourses.value.length > 0) return 'hasAvailable'
  if (enrolledCount.value === 0) return 'empty_noCourses'
  return 'enrolledOnly'
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

function enterCourse(course: { id: string }) {
  profileStore.switchCourse(profileStore.courses.find(c => c.id === course.id)!)
  router.push('/')
}

function isEnrolled(courseId: string) {
  return profileStore.courses.some(c => c.id === courseId)
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
  <div class="course-page">
    <!-- ===== 装饰性背景 ===== -->
    <div class="bg-decoration">
      <div class="bg-orb bg-orb--blue" />
      <div class="bg-orb bg-orb--purple" />
      <div class="bg-orb bg-orb--orange" />
      <div class="bg-grid" />
    </div>

    <!-- ===== Hero ===== -->
    <section class="hero">
      <div class="hero-content">
        <div class="hero-badge">
          <span class="hero-badge-dot" />
          个性化学习平台
        </div>
        <h1 class="hero-title">
          <span v-if="hasCourses">选择课程，</span>
          <span class="hero-title-highlight">开始你的学习之旅</span>
        </h1>
        <p class="hero-subtitle">
          {{ hasCourses ? '点击已选课程进入学习总览，或探索新课程' : '选择一个课程，开启你的个性化学习之旅' }}
        </p>
        <div v-if="hasCourses" class="hero-stats">
          <div class="hero-stat">
            <span class="hero-stat-value">{{ enrolledCount }}</span>
            <span class="hero-stat-label">已选课程</span>
          </div>
          <div class="hero-stat-divider" />
          <div class="hero-stat">
            <span class="hero-stat-value">{{ availableCourses.length }}</span>
            <span class="hero-stat-label">可选课程</span>
          </div>
        </div>
      </div>
      <div class="hero-visual">
        <div class="hero-shape hero-shape--1" />
        <div class="hero-shape hero-shape--2" />
        <div class="hero-shape hero-shape--3" />
        <div class="hero-icon-group">
          <div class="hero-icon-item" style="--hue: 0;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M16 2v20"/><path d="M8 7h4"/><path d="M8 11h4"/></svg>
          </div>
          <div class="hero-icon-item" style="--hue: 1;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </div>
          <div class="hero-icon-item" style="--hue: 2;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== 主体 ===== -->
    <main class="main">
      <!-- ====== 加载骨架 ====== -->
      <template v-if="pageState === 'loading'">
        <div class="skeleton-section">
          <div class="skeleton-header">
            <div class="skeleton-title-block" />
            <div class="skeleton-tag-block" />
          </div>
          <div class="card-grid card-grid--enrolled">
            <div v-for="i in 4" :key="i" class="skeleton-card">
              <div class="skeleton-avatar" />
              <div class="skeleton-line skeleton-line--lg" />
              <div class="skeleton-line skeleton-line--sm" />
              <div class="skeleton-line skeleton-line--md" />
              <div class="skeleton-btn" />
            </div>
          </div>
        </div>
      </template>

      <!-- ====== 加载错误 ====== -->
      <template v-else-if="pageState === 'error'">
        <div class="state-box">
          <div class="state-icon state-icon--error">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <h3 class="state-title">课程加载失败</h3>
          <p class="state-desc">{{ loadError }}</p>
          <button class="btn-primary" @click="retry">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            重新加载
          </button>
        </div>
      </template>

      <!-- ====== 正常展示 ====== -->
      <template v-else>
        <!-- 我的课程 -->
        <section v-if="hasCourses" class="section">
          <div class="section-header">
            <div class="section-header-left">
              <h2 class="section-title">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="section-title-icon"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                我的课程
              </h2>
              <span class="section-badge">{{ enrolledCount }} 门</span>
            </div>
          </div>
          <div class="card-grid card-grid--enrolled">
            <div
              v-for="(course, idx) in profileStore.courses"
              :key="course.id"
              class="enrolled-card"
              :style="{ '--i': idx }"
              @click.self="enterCourse(course)"
            >
              <div class="enrolled-emoji-box">{{ course.emoji || '📚' }}</div>
              <div class="enrolled-info">
                <h3 class="enrolled-name">{{ course.name }}</h3>
                <div class="enrolled-meta">
                  <span v-if="course.progress" class="enrolled-meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    {{ course.progress.tasksCompleted }} 任务
                  </span>
                  <span v-if="course.enrolledAt" class="enrolled-meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {{ course.enrolledAt.slice(0, 10) }}
                  </span>
                </div>
              </div>
              <button class="enrolled-enter" @click.stop="enterCourse(course)">
                <span>进入学习</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
            </div>
          </div>
        </section>

        <!-- 探索更多课程 -->
        <section v-if="pageState === 'hasAvailable'" class="section">
          <div class="section-divider">
            <span class="section-divider-line" />
            <span class="section-divider-text">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              探索更多课程
            </span>
            <span class="section-divider-line" />
          </div>
          <div class="card-grid card-grid--explore">
            <div
              v-for="course in availableCourses"
              :key="course.id"
              class="explore-card"
              :class="{ 'explore-card--enrolled': isEnrolled(course.id) }"
            >
              <div class="explore-emoji-wrap">
                <div class="explore-emoji-bg">
                  <span class="explore-emoji">{{ course.emoji || '📚' }}</span>
                </div>
              </div>
              <h3 class="explore-name">{{ course.name }}</h3>
              <p class="explore-desc">{{ course.description || '暂无描述' }}</p>
              <div class="explore-footer">
                <span class="explore-count">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  {{ course.enrolledCount }} 人已选
                </span>
                <button
                  v-if="isEnrolled(course.id)"
                  class="explore-btn explore-btn--enrolled"
                  disabled
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  已加入
                </button>
                <button
                  v-else
                  :disabled="enrollingId !== null"
                  class="explore-btn explore-btn--join"
                  :class="{ 'explore-btn--loading': enrollingId === course.id }"
                  @click.stop="handleEnroll(course.id)"
                >
                  <template v-if="enrollingId === course.id">
                    <svg class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
                    加入中
                  </template>
                  <template v-else>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    加入学习
                  </template>
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- ====== 空状态：系统无课程 ====== -->
        <div v-if="pageState === 'empty_noCourses'" class="state-box">
          <div class="state-icon state-icon--empty">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><line x1="8" y1="7" x2="14" y2="7"/><line x1="8" y1="11" x2="12" y2="11"/></svg>
          </div>
          <h3 class="state-title">暂无可选课程</h3>
          <p class="state-desc">系统中还没有课程，请联系管理员添加课程后再来选课</p>
          <button class="btn-secondary" @click="retry">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            刷新
          </button>
        </div>
      </template>
    </main>

    <!-- ===== Footer ===== -->
    <footer class="footer">
      <span>学思伴行 · 个性化学习平台</span>
    </footer>
  </div>
</template>

<style scoped>
/* ============================================================
   CourseSelectView — 顶尖UX设计
   设计系统：科技蓝 #2B6FFF / 暖心橙 #FF8C42 / AI紫 #7C5CFC
   ============================================================ */

/* ---------- 页面容器 ---------- */
.course-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  background: linear-gradient(180deg, #f8faff 0%, #f0eeff 40%, #fff8f0 100%);
  overflow: hidden;
}

/* ---------- 装饰性背景 ---------- */
.bg-decoration {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.bg-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.3;
}

.bg-orb--blue {
  width: 500px;
  height: 500px;
  background: var(--lt-brand);
  top: -150px;
  right: -100px;
  opacity: 0.12;
}

.bg-orb--purple {
  width: 400px;
  height: 400px;
  background: var(--lt-ai);
  bottom: 10%;
  left: -120px;
  opacity: 0.1;
}

.bg-orb--orange {
  width: 300px;
  height: 300px;
  background: var(--lt-orange);
  bottom: -80px;
  right: 20%;
  opacity: 0.08;
}

.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(43, 111, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(43, 111, 255, 0.03) 1px, transparent 1px);
  background-size: 64px 64px;
}

/* ---------- Hero ---------- */
.hero {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 48px 64px 40px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.hero-content {
  flex: 1;
  min-width: 0;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--lt-brand);
  background: var(--lt-brand-lightest);
  padding: 4px 14px;
  border-radius: 20px;
  margin-bottom: 16px;
  letter-spacing: 0.3px;
}

.hero-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lt-brand);
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.hero-title {
  font-size: 42px;
  font-weight: 800;
  line-height: 1.2;
  color: var(--lt-text-primary);
  margin: 0 0 12px;
  letter-spacing: -0.03em;
}

.hero-title-highlight {
  background: linear-gradient(135deg, var(--lt-brand) 0%, var(--lt-ai) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: 16px;
  color: var(--lt-text-auxiliary);
  margin: 0 0 24px;
  line-height: 1.6;
  max-width: 480px;
}

.hero-stats {
  display: inline-flex;
  align-items: center;
  gap: 20px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid var(--lt-border);
  border-radius: 16px;
  padding: 12px 24px;
}

.hero-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero-stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--lt-text-primary);
  line-height: 1.2;
}

.hero-stat-label {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  font-weight: 500;
}

.hero-stat-divider {
  width: 1px;
  height: 32px;
  background: var(--lt-border);
}

/* ---------- Hero 视觉区 ---------- */
.hero-visual {
  position: relative;
  width: 200px;
  height: 200px;
  flex-shrink: 0;
  margin-left: 40px;
}

.hero-shape {
  position: absolute;
  border-radius: 50%;
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.hero-shape--1 {
  width: 140px;
  height: 140px;
  background: linear-gradient(135deg, var(--lt-brand-lightest), var(--lt-brand-lighter));
  top: 10px;
  right: 0;
  animation: float-shape 6s ease-in-out infinite;
}

.hero-shape--2 {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, var(--lt-ai-light-7), var(--lt-ai-light-5));
  bottom: 10px;
  right: 20px;
  animation: float-shape 8s ease-in-out infinite reverse;
}

.hero-shape--3 {
  width: 50px;
  height: 50px;
  background: linear-gradient(135deg, var(--lt-orange-light-5), var(--lt-orange-light-3));
  top: 50%;
  left: 0;
  animation: float-shape 7s ease-in-out infinite 0.5s;
}

@keyframes float-shape {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-16px) scale(1.05); }
}

.hero-icon-group {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.hero-icon-item {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  background: var(--lt-brand);
  box-shadow: 0 4px 12px rgba(43, 111, 255, 0.25);
  animation: icon-entrance 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  animation-delay: calc(0.15s * var(--hue, 0));
}

.hero-icon-item:nth-child(2) {
  background: var(--lt-ai);
  box-shadow: 0 4px 12px rgba(124, 92, 252, 0.25);
  margin-top: -40px;
}

.hero-icon-item:nth-child(3) {
  background: var(--lt-orange);
  box-shadow: 0 4px 12px rgba(255, 140, 66, 0.25);
  margin-top: -20px;
}

@keyframes icon-entrance {
  from { opacity: 0; transform: translateY(20px) scale(0.8); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* ---------- 主体 ---------- */
.main {
  position: relative;
  z-index: 1;
  flex: 1;
  padding: 0 64px 48px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

/* ---------- Sections ---------- */
.section {
  margin-bottom: 40px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.section-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--lt-text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title-icon {
  color: var(--lt-brand);
}

.section-badge {
  font-size: 12px;
  font-weight: 600;
  color: var(--lt-brand);
  background: var(--lt-brand-lightest);
  padding: 2px 10px;
  border-radius: 12px;
  letter-spacing: 0.3px;
}

.section-divider {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 48px 0 32px;
}

.section-divider-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--lt-border) 30%, var(--lt-border) 70%, transparent);
}

.section-divider-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--lt-text-auxiliary);
  white-space: nowrap;
  letter-spacing: 0.5px;
}

.section-divider-text svg {
  color: var(--lt-ai);
}

/* ---------- 卡片网格 ---------- */
.card-grid {
  display: grid;
  gap: 16px;
}

.card-grid--enrolled {
  grid-template-columns: repeat(4, 1fr);
}

.card-grid--explore {
  grid-template-columns: repeat(3, 1fr);
}

/* ======== 已选课程卡片 ======== */
.enrolled-card {
  background: linear-gradient(135deg, #fafcff, #ffffff);
  border: 1px solid var(--lt-border);
  border-radius: 16px;
  padding: 20px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: card-enter 0.5s cubic-bezier(0.4, 0, 0.2, 1) both;
  animation-delay: calc(var(--i, 0) * 0.08s);
  display: flex;
  flex-direction: column;
}

.enrolled-card::before {
  content: '';
  position: absolute;
  inset: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--lt-brand), var(--lt-ai));
  clip-path: inset(0 0 calc(100% - 3px) 0 round 16px 16px 0 0);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.enrolled-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 8px 28px rgba(43, 111, 255, 0.12);
  border-color: var(--lt-brand-lighter);
}

.enrolled-card:hover::before {
  opacity: 1;
}

/* 进度环区域 */
.enrolled-emoji-box {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--lt-brand-lightest), var(--lt-ai-light-9));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
}

.enrolled-card:hover .enrolled-emoji-box {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(43, 111, 255, 0.12);
}

.enrolled-info {
  flex: 1;
  min-width: 0;
}

.enrolled-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--lt-text-primary);
  margin: 0 0 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.enrolled-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}

.enrolled-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--lt-text-auxiliary);
}

.enrolled-enter {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  padding: 8px 0;
  border: 1.5px solid var(--lt-brand-lightest);
  border-radius: 10px;
  background: transparent;
  color: var(--lt-brand);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
}

.enrolled-enter:hover {
  background: var(--lt-brand);
  color: white;
  border-color: var(--lt-brand);
}

.enrolled-enter svg {
  transition: transform 0.2s ease;
}

.enrolled-enter:hover svg {
  transform: translateX(3px);
}

/* ======== 探索课程卡片 ======== */
.explore-card {
  background: white;
  border: 1px solid var(--lt-border);
  border-radius: 16px;
  padding: 24px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: card-enter 0.5s cubic-bezier(0.4, 0, 0.2, 1) both;
  display: flex;
  flex-direction: column;
}

.explore-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 28px rgba(124, 92, 252, 0.1);
  border-color: var(--lt-ai-light-5);
}

.explore-card--enrolled {
  opacity: 0.5;
  pointer-events: none;
}

.explore-emoji-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.explore-emoji-bg {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--lt-ai-light-9), var(--lt-brand-lightest));
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.explore-card:hover .explore-emoji-bg {
  transform: scale(1.08) rotate(-4deg);
}

.explore-emoji {
  font-size: 26px;
  line-height: 1;
}

.explore-name {
  font-size: 17px;
  font-weight: 700;
  color: var(--lt-text-primary);
  margin: 0 0 6px;
}

.explore-desc {
  font-size: 13px;
  color: var(--lt-text-auxiliary);
  line-height: 1.6;
  margin: 0 0 auto;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.6em;
}

.explore-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--lt-border);
}

.explore-count {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--lt-text-placeholder);
  font-weight: 500;
}

.explore-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  font-family: inherit;
  transition: all 0.2s ease;
}

.explore-btn--join {
  background: linear-gradient(135deg, var(--lt-brand), var(--lt-brand-dark));
  color: white;
  box-shadow: 0 2px 8px rgba(43, 111, 255, 0.2);
}

.explore-btn--join:hover {
  box-shadow: 0 4px 16px rgba(43, 111, 255, 0.3);
  transform: translateY(-1px);
}

.explore-btn--join:active {
  transform: translateY(0);
}

.explore-btn--loading {
  opacity: 0.85;
  cursor: not-allowed;
}

.explore-btn--enrolled {
  background: var(--lt-success);
  color: white;
  opacity: 0.8;
  cursor: default;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ======== 状态通用 ======== */
.state-box {
  max-width: 420px;
  margin: 60px auto;
  text-align: center;
  background: white;
  border: 1px solid var(--lt-border);
  border-radius: 20px;
  padding: 48px 32px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
  animation: card-enter 0.5s ease both;
}

.state-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
}

.state-icon--error {
  background: rgba(255, 59, 48, 0.08);
  color: var(--lt-danger);
}

.state-icon--success {
  background: rgba(52, 199, 89, 0.08);
  color: var(--lt-success);
}

.state-icon--empty {
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
}

.state-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--lt-text-primary);
  margin: 0 0 8px;
}

.state-desc {
  font-size: 14px;
  color: var(--lt-text-auxiliary);
  line-height: 1.6;
  margin: 0 0 24px;
}

/* ---------- 自定義按鈕 ---------- */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 22px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--lt-brand), var(--lt-brand-dark));
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  box-shadow: 0 2px 8px rgba(43, 111, 255, 0.2);
  transition: all 0.2s ease;
}

.btn-primary:hover {
  box-shadow: 0 4px 16px rgba(43, 111, 255, 0.3);
  transform: translateY(-1px);
}

.btn-primary--large {
  padding: 12px 28px;
  font-size: 15px;
  border-radius: 14px;
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 22px;
  border: 1.5px solid var(--lt-border);
  border-radius: 12px;
  background: white;
  color: var(--lt-text-secondary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  border-color: var(--lt-brand-lighter);
  color: var(--lt-brand);
  background: var(--lt-brand-lightest);
}

/* ---------- 卡片入场 ---------- */
@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ======== 骨架屏 ======== */
.skeleton-section {
  max-width: 100%;
}

.skeleton-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.skeleton-title-block {
  width: 120px;
  height: 22px;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--lt-border) 25%, #eef2f7 50%, var(--lt-border) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

.skeleton-tag-block {
  width: 48px;
  height: 20px;
  border-radius: 10px;
  background: linear-gradient(90deg, var(--lt-border) 25%, #eef2f7 50%, var(--lt-border) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

.skeleton-card {
  background: white;
  border: 1px solid var(--lt-border);
  border-radius: 16px;
  padding: 20px;
  overflow: hidden;
}

.skeleton-avatar {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  margin-bottom: 14px;
  background: linear-gradient(90deg, var(--lt-border) 25%, #eef2f7 50%, var(--lt-border) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

.skeleton-line {
  border-radius: 4px;
  background: linear-gradient(90deg, var(--lt-border) 25%, #eef2f7 50%, var(--lt-border) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  margin-bottom: 8px;
}

.skeleton-line--lg {
  width: 75%;
  height: 16px;
}

.skeleton-line--sm {
  width: 50%;
  height: 12px;
}

.skeleton-line--md {
  width: 60%;
  height: 12px;
  margin-bottom: 16px;
}

.skeleton-btn {
  width: 100%;
  height: 34px;
  border-radius: 10px;
  background: linear-gradient(90deg, var(--lt-border) 25%, #eef2f7 50%, var(--lt-border) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ======== Footer ======== */
.footer {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 24px 64px;
  font-size: 12px;
  color: var(--lt-text-placeholder);
}

/* ============================================================
   响应式
   ============================================================ */

/* 平板 */
@media (max-width: 1024px) {
  .hero {
    padding: 40px 32px 32px;
  }
  .hero-title {
    font-size: 34px;
  }
  .hero-visual {
    width: 160px;
    height: 160px;
  }
  .hero-shape--1 {
    width: 110px;
    height: 110px;
  }
  .main {
    padding: 0 32px 40px;
  }
  .card-grid--enrolled {
    grid-template-columns: repeat(2, 1fr);
  }
  .card-grid--explore {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* 手机 */
@media (max-width: 767px) {
  .hero {
    flex-direction: column;
    align-items: flex-start;
    padding: 28px 16px 24px;
    gap: 24px;
  }
  .hero-title {
    font-size: 28px;
  }
  .hero-subtitle {
    font-size: 14px;
  }
  .hero-visual {
    width: 120px;
    height: 120px;
    margin-left: 0;
    align-self: center;
  }
  .hero-shape--1 {
    width: 80px;
    height: 80px;
  }
  .hero-shape--2 {
    width: 54px;
    height: 54px;
  }
  .hero-shape--3 {
    width: 36px;
    height: 36px;
  }
  .hero-icon-item {
    width: 34px;
    height: 34px;
  }
  .hero-icon-item svg {
    width: 20px;
    height: 20px;
  }
  .hero-stats {
    padding: 10px 18px;
    gap: 14px;
  }
  .hero-stat-value {
    font-size: 20px;
  }
  .hero-badge {
    font-size: 12px;
  }
  .main {
    padding: 0 16px 32px;
  }
  .section-title {
    font-size: 18px;
  }
  .card-grid--enrolled,
  .card-grid--explore {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .enrolled-card {
    flex-direction: row;
    align-items: center;
    gap: 14px;
    padding: 14px;
    animation: none;
  }
  .enrolled-emoji-box {
    width: 40px;
    height: 40px;
    font-size: 20px;
    flex-shrink: 0;
  }
  .enrolled-info {
    flex: 1;
  }
  .enrolled-name {
    font-size: 14px;
    margin-bottom: 4px;
  }
  .enrolled-meta {
    margin-bottom: 0;
  }
  .enrolled-meta-item {
    font-size: 11px;
  }
  .enrolled-enter {
    width: auto;
    padding: 6px 14px;
    flex-shrink: 0;
    font-size: 12px;
  }
  .enrolled-enter span {
    display: none;
  }
  .enrolled-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 3px;
    height: auto;
    background: linear-gradient(180deg, var(--lt-brand), var(--lt-ai));
    clip-path: inset(0 calc(100% - 3px) 0 0 round 16px 0 0 16px);
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  .enrolled-card:hover {
    transform: none;
  }
  .explore-card {
    padding: 18px;
    animation: none;
  }
  .explore-card:hover {
    transform: none;
  }
  .state-box {
    margin: 40px 0;
    padding: 32px 20px;
  }
  .section-divider {
    margin: 32px 0 20px;
  }
  .footer {
    padding: 16px;
  }
}
</style>
