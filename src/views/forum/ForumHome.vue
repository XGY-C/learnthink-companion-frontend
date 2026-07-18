<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useForumStore } from '@/stores/forum'
import { useProfileStore } from '@/stores/profile'
import PostCard from '@/components/forum/PostCard.vue'
import { Search, Plus, User } from '@element-plus/icons-vue'
import ForumIcon from '@/components/icons/ForumIcon.vue'

const router = useRouter()
const store = useForumStore()
const profileStore = useProfileStore()
const searchKeyword = ref('')

const sortOptions = [
  { label: '最新', value: 'latest' },
  { label: '最热', value: 'hottest' },
  { label: '精华', value: 'featured' },
]

function handleCourseChange() {
  store.currentPage = 1
  store.fetchPosts()
}

function handleSortChange(sort: string) {
  store.activeSort = sort
  store.currentPage = 1
  store.fetchPosts()
}

function handleTagSelect(tag: string) {
  store.setFilter('tag', tag)
  store.fetchPosts()
}

function handleSearch() {
  store.keyword = searchKeyword.value
  store.currentPage = 1
  store.fetchPosts()
}

function handlePageChange(page: number) {
  store.currentPage = page
  store.fetchPosts()
}

function goCreatePost() {
  router.push('/forum/create')
}

function handleMineToggle() {
  store.activeMine = !store.activeMine
  store.currentPage = 1
  store.fetchPosts()
}

watch(() => profileStore.activeCourseId, (newId) => {
  const target = newId || 'all'
  if (store.activeCourse === target) {
    store.fetchPosts()
    return
  }
  store.activeCourse = target
  store.currentPage = 1
  store.fetchPosts()
})

onMounted(async () => {
  if (profileStore.courses.length === 0) {
    profileStore.fetchMyCourses()
  }
  if (profileStore.activeCourseId) {
    store.activeCourse = profileStore.activeCourseId
  }
  await store.fetchTags()
  store.fetchPosts({ silent: true })
})
</script>

<template>
  <div class="forum-page">
    <!-- Hero -->
    <div class="forum-hero">
      <div class="hero-inner">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <el-icon :size="36" style="color: var(--lt-brand);"><ForumIcon /></el-icon>
            <div>
              <h2 class="text-2xl font-bold m-0" style="color: var(--lt-text-primary);">学习论坛</h2>
              <p class="text-sm mt-1 m-0" style="color: var(--lt-text-auxiliary);">分享学习资源、笔记和方法</p>
            </div>
          </div>
          <el-button type="primary" :icon="Plus" @click="goCreatePost" class="create-btn">
            发布新帖
          </el-button>
        </div>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <div class="filter-inner">
        <div class="filter-row">
          <div class="filter-group">
            <el-select
              v-model="store.activeCourse"
              size="small"
              filterable
              placeholder="全部课程"
              style="width: 150px;"
              @change="handleCourseChange"
            >
              <el-option label="全部课程" value="all" />
              <el-option v-for="c in profileStore.courses" :key="c.id" :label="c.name" :value="c.id" />
            </el-select>
            <el-select
              v-model="store.activeTag"
              size="small"
              filterable
              placeholder="全部标签"
              style="width: 140px;"
              @change="handleTagSelect(store.activeTag)"
            >
              <el-option label="全部标签" value="all" />
              <el-option v-for="t in store.tags" :key="t.id" :label="t.name" :value="t.id" />
            </el-select>
          </div>
          <div class="filter-mine-group">
            <button
              class="mine-btn"
              :class="{ active: store.activeMine }"
              @click="handleMineToggle"
            >
              <el-icon :size="14"><User /></el-icon>
              我的发布
            </button>
          </div>
          <div class="sort-group">
            <button
              v-for="opt in sortOptions" :key="opt.value"
              class="sort-btn"
              :class="{ active: store.activeSort === opt.value }"
              @click="handleSortChange(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
        <div class="filter-row secondary">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索帖子标题和内容..."
            :prefix-icon="Search"
            clearable
            class="search-input"
            @keyup.enter="handleSearch"
          />
          <div class="filter-stats">
            <span class="text-xs" style="color: var(--lt-text-auxiliary);">
              共 <strong style="color: var(--lt-text-secondary);">{{ store.total }}</strong> 个帖子
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Post List -->
    <div class="list-area">
      <Transition name="list-fade" mode="out-in">
        <div v-if="store.loading" key="loading" class="loading-state">
          <div class="skeleton-list">
            <div v-for="n in 5" :key="n" class="skeleton-card">
              <div class="skeleton-avatar" />
              <div class="skeleton-body">
                <div class="skeleton-line w-75" />
                <div class="skeleton-line w-50" />
                <div class="skeleton-line w-25" />
              </div>
            </div>
          </div>
        </div>

        <div v-else key="content" class="list-content">
          <div v-if="store.posts.length === 0" class="empty-state">
            <div class="empty-icon">📭</div>
            <p class="empty-title">还没有帖子</p>
            <p class="empty-desc">快来发布第一条帖子，与大家分享你的学习心得吧~</p>
            <el-button type="primary" :icon="Plus" @click="goCreatePost">发布新帖</el-button>
          </div>

          <div v-else class="post-list">
            <div
              v-for="(post, index) in store.posts"
              :key="post.id"
              class="stagger-fade-in"
              :style="{ animationDelay: `${index * 50}ms` }"
            >
              <PostCard :post="post" />
            </div>
          </div>

          <div v-if="store.total > store.pageSize" class="pagination-wrap">
            <el-pagination
              :current-page="store.currentPage"
              :page-size="store.pageSize"
              :total="store.total"
              layout="prev, pager, next"
              background
              @current-change="handlePageChange"
            />
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.forum-page {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

/* ===== Hero ===== */
.forum-hero {
  background: var(--lt-bg-card);
  border-bottom: 1px solid var(--lt-border);
}
.hero-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px 40px;
}
.create-btn {
  border-radius: var(--lt-radius-full);
  padding: 8px 22px;
  font-weight: 600;
  box-shadow: 0 4px 14px rgba(43,111,255,0.25);
  transition: all var(--lt-transition-smooth);
}
.create-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(43,111,255,0.3);
}

/* ===== Filter Bar ===== */
.filter-bar {
  background: var(--lt-bg-card);
  border-bottom: 1px solid var(--lt-border);
}
.filter-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 10px 40px;
}
.filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.filter-row.secondary {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--lt-border);
}
.filter-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: var(--lt-radius-md);
  background: var(--lt-bg-page);
}
.filter-label {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  font-weight: 500;
  white-space: nowrap;
  margin-right: 2px;
}
.sort-group {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: var(--lt-radius-md);
  background: var(--lt-bg-page);
}
.sort-btn {
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  background: transparent;
  color: var(--lt-text-secondary);
  transition: all var(--lt-transition-base);
  white-space: nowrap;
}
.sort-btn:hover {
  color: var(--lt-brand);
  background: var(--lt-brand-lightest);
}
.sort-btn.active {
  background: var(--lt-bg-card);
  color: var(--lt-brand);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

/* ===== Mine Toggle Button ===== */
.filter-mine-group {
  display: flex;
  align-items: center;
  padding: 2px;
}
.mine-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 14px;
  border-radius: var(--lt-radius-full);
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--lt-border);
  cursor: pointer;
  background: var(--lt-bg-card);
  color: var(--lt-text-secondary);
  transition: all var(--lt-transition-base);
  white-space: nowrap;
}
.mine-btn:hover {
  color: var(--lt-brand);
  border-color: var(--lt-brand-lighter);
  background: var(--lt-brand-lightest);
}
.mine-btn.active {
  background: var(--lt-brand);
  color: #fff;
  border-color: var(--lt-brand);
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(43, 111, 255, 0.25);
}
.search-input {
  flex: 0 1 320px;
  min-width: 0;
}
.search-input :deep(.el-input__wrapper) {
  border-radius: var(--lt-radius-full);
  background: var(--lt-bg-page);
  box-shadow: none;
  border: 1px solid transparent;
  transition: all var(--lt-transition-base);
}
.search-input :deep(.el-input__wrapper:hover),
.search-input :deep(.el-input__wrapper.is-focus) {
  border-color: var(--lt-brand-lighter);
  background: var(--lt-bg-card);
  box-shadow: 0 0 0 2px rgba(43, 111, 255, 0.08);
}
.filter-stats {
  white-space: nowrap;
  flex-shrink: 0;
}

/* ===== List Area ===== */
.list-area {
  flex: 1;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  padding: 0 40px 32px;
}
.post-list {
  margin-top: 16px;
  border-radius: var(--lt-radius-lg);
  background: var(--lt-bg-card);
  box-shadow: var(--lt-shadow-card);
  overflow: hidden;
}
.pagination-wrap {
  display: flex;
  justify-content: center;
  padding: 24px 0 0;
}

/* ===== Loading / Empty ===== */
.loading-state {
  padding: 32px 0;
}
.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--lt-bg-card);
  border-radius: var(--lt-radius-lg);
  overflow: hidden;
}
.skeleton-card {
  display: flex;
  gap: 16px;
  padding: 20px 24px;
  background: var(--lt-bg-card);
}
.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--lt-border);
  flex-shrink: 0;
}
.skeleton-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.skeleton-line {
  height: 14px;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--lt-border) 0%, var(--lt-bg-page) 50%, var(--lt-border) 100%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
}
.skeleton-line.w-75 { width: 75%; }
.skeleton-line.w-50 { width: 50%; }
.skeleton-line.w-25 { width: 25%; }

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.empty-state {
  text-align: center;
  padding: 64px 0;
}
.empty-icon {
  font-size: 56px;
  margin-bottom: 16px;
  opacity: 0.25;
}
.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--lt-text-secondary);
  margin: 0 0 4px;
}
.empty-desc {
  font-size: 13px;
  color: var(--lt-text-auxiliary);
  margin: 0 0 20px;
}

/* ===== List Fade Transition ===== */
.list-fade-enter-active,
.list-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.list-fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.list-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ===== Mobile Responsive ===== */
@media (max-width: 768px) {
  .hero-inner {
    padding: 14px var(--mobile-page-padding-x);
  }
  .filter-inner {
    padding: 8px var(--mobile-page-padding-x);
  }
  .list-area {
    padding: 0 var(--mobile-page-padding-x) 24px;
  }
  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }
  .filter-row.secondary {
    flex-direction: row;
    flex-wrap: wrap;
  }
  .filter-actions {
    justify-content: space-between;
  }
  .search-input {
    flex: 1;
    min-width: 0;
  }
  .skeleton-card {
    padding: 16px;
  }
}
</style>
