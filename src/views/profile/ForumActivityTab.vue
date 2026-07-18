<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useForumStore } from '@/stores/forum'
import PostCard from '@/components/forum/PostCard.vue'
import MyCommentCard from '@/components/forum/MyCommentCard.vue'
import ReceivedCommentCard from '@/components/forum/ReceivedCommentCard.vue'
import { Document, Star, ChatDotRound, EditPen } from '@element-plus/icons-vue'

const store = useForumStore()

const activeSubTab = ref<'posts' | 'comments' | 'received'>('posts')

const statChips = ref([
  { key: 'postCount', label: '发帖数', value: 0, icon: Document, color: 'var(--lt-brand)' },
  { key: 'likeReceivedCount', label: '获赞数', value: 0, icon: Star, color: 'var(--lt-orange)' },
  { key: 'receivedCommentCount', label: '收到的评论', value: 0, icon: ChatDotRound, color: 'var(--lt-success)' },
  { key: 'commentCount', label: '我的评论', value: 0, icon: EditPen, color: 'var(--lt-ai)' },
])

function updateStatChips() {
  if (!store.myOverview) return
  statChips.value = statChips.value.map(chip => ({
    ...chip,
    value: (store.myOverview as Record<string, number>)[chip.key] ?? 0,
  }))
}

function switchSubTab(tab: 'posts' | 'comments' | 'received') {
  activeSubTab.value = tab
  if (tab === 'posts') {
    store.myPostsPage = 1
    store.fetchMyPosts(1)
  } else if (tab === 'comments') {
    store.myCommentsPage = 1
    store.fetchMyComments(1)
  } else {
    store.receivedCommentsPage = 1
    store.fetchReceivedComments(1)
  }
}

function handleMyPostsPageChange(page: number) {
  store.fetchMyPosts(page)
}

function handleMyCommentsPageChange(page: number) {
  store.fetchMyComments(page)
}

function handleReceivedCommentsPageChange(page: number) {
  store.fetchReceivedComments(page)
}

onMounted(async () => {
  await store.fetchMyOverview()
  updateStatChips()
  store.fetchMyPosts(1)
})
</script>

<template>
  <div class="forum-activity-tab">
    <!-- 统计芯片 -->
    <div class="stat-chips-row">
      <div
        v-for="(chip, idx) in statChips"
        :key="chip.key"
        class="stat-chip"
        :style="{
          animationDelay: (0.1 + idx * 0.08) + 's',
          backgroundColor: 'var(--lt-bg-card)',
          border: '1px solid var(--lt-border)',
        }"
      >
        <el-icon :size="16" :style="{ color: chip.color }"><component :is="chip.icon" /></el-icon>
        <p class="stat-value" style="color: var(--lt-text-primary);">
          {{ chip.value }}
        </p>
        <p class="text-xs mt-0.5" style="color: var(--lt-text-auxiliary);">{{ chip.label }}</p>
      </div>
    </div>

    <!-- 子 Tab 切换 -->
    <div class="sub-tab-bar">
      <button
        class="sub-tab-btn"
        :class="{ active: activeSubTab === 'posts' }"
        @click="switchSubTab('posts')"
      >
        我的帖子
      </button>
      <button
        class="sub-tab-btn"
        :class="{ active: activeSubTab === 'comments' }"
        @click="switchSubTab('comments')"
      >
        我的评论
      </button>
      <button
        class="sub-tab-btn"
        :class="{ active: activeSubTab === 'received' }"
        @click="switchSubTab('received')"
      >
        别人给我的评论
      </button>
    </div>

    <!-- 列表内容 -->
    <div class="list-container">
      <!-- 我的帖子 -->
      <template v-if="activeSubTab === 'posts'">
        <div v-if="store.myPostsLoading" class="loading-state">
          <div v-for="n in 3" :key="n" class="skeleton-card">
            <div class="skeleton-line w-75" />
            <div class="skeleton-line w-50" />
          </div>
        </div>
        <div v-else-if="store.myPosts.length === 0" class="empty-state">
          <div class="empty-icon">📝</div>
          <p class="empty-title">还没有发布过帖子</p>
          <p class="empty-desc">去论坛分享你的学习心得吧~</p>
        </div>
        <div v-else class="post-list">
          <PostCard
            v-for="post in store.myPosts"
            :key="post.id"
            :post="post"
          />
        </div>
        <div v-if="store.myPostsTotal > store.myPostsPageSize" class="pagination-wrap">
          <el-pagination
            :current-page="store.myPostsPage"
            :page-size="store.myPostsPageSize"
            :total="store.myPostsTotal"
            layout="prev, pager, next"
            background
            @current-change="handleMyPostsPageChange"
          />
        </div>
      </template>

      <!-- 我的评论 -->
      <template v-else-if="activeSubTab === 'comments'">
        <div v-if="store.myCommentsLoading" class="loading-state">
          <div v-for="n in 3" :key="n" class="skeleton-card">
            <div class="skeleton-line w-75" />
            <div class="skeleton-line w-50" />
          </div>
        </div>
        <div v-else-if="store.myComments.length === 0" class="empty-state">
          <div class="empty-icon">💬</div>
          <p class="empty-title">还没有发表过评论</p>
          <p class="empty-desc">去论坛参与讨论吧~</p>
        </div>
        <div v-else class="comment-list">
          <MyCommentCard
            v-for="comment in store.myComments"
            :key="comment.id"
            :comment="comment"
          />
        </div>
        <div v-if="store.myCommentsTotal > store.myCommentsPageSize" class="pagination-wrap">
          <el-pagination
            :current-page="store.myCommentsPage"
            :page-size="store.myCommentsPageSize"
            :total="store.myCommentsTotal"
            layout="prev, pager, next"
            background
            @current-change="handleMyCommentsPageChange"
          />
        </div>
      </template>

      <!-- 别人给我的评论 -->
      <template v-else>
        <div v-if="store.receivedCommentsLoading" class="loading-state">
          <div v-for="n in 3" :key="n" class="skeleton-card">
            <div class="skeleton-line w-75" />
            <div class="skeleton-line w-50" />
          </div>
        </div>
        <div v-else-if="store.receivedComments.length === 0" class="empty-state">
          <div class="empty-icon">🔔</div>
          <p class="empty-title">还没有收到评论</p>
          <p class="empty-desc">发布更多帖子，吸引大家来讨论吧~</p>
        </div>
        <div v-else class="comment-list">
          <ReceivedCommentCard
            v-for="comment in store.receivedComments"
            :key="comment.id"
            :comment="comment"
          />
        </div>
        <div v-if="store.receivedCommentsTotal > store.receivedCommentsPageSize" class="pagination-wrap">
          <el-pagination
            :current-page="store.receivedCommentsPage"
            :page-size="store.receivedCommentsPageSize"
            :total="store.receivedCommentsTotal"
            layout="prev, pager, next"
            background
            @current-change="handleReceivedCommentsPageChange"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.forum-activity-tab {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ===== Stat Chips ===== */
.stat-chips-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.stat-chip {
  flex: 1;
  min-width: 100px;
  text-align: center;
  padding: 12px 8px;
  border-radius: var(--lt-radius-lg);
  opacity: 0;
  transform: translateY(6px);
  animation: chipFadeIn 0.4s ease-out forwards;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.stat-chip:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  transform: translateY(-2px);
}
.stat-value {
  font-size: 1.4rem;
  font-weight: 700;
  line-height: 1.3;
  margin: 2px 0 0;
  font-variant-numeric: tabular-nums;
}
@keyframes chipFadeIn {
  to { opacity: 1; transform: translateY(0); }
}

/* ===== Sub Tab Bar ===== */
.sub-tab-bar {
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: var(--lt-radius-md);
  background: var(--lt-bg-page);
}
.sub-tab-btn {
  flex: 1;
  padding: 7px 14px;
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
.sub-tab-btn:hover {
  color: var(--lt-brand);
}
.sub-tab-btn.active {
  background: var(--lt-bg-card);
  color: var(--lt-brand);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

/* ===== List Container ===== */
.list-container {
  min-height: 200px;
}
.post-list, .comment-list {
  border-radius: var(--lt-radius-lg);
  background: var(--lt-bg-card);
  box-shadow: var(--lt-shadow-card);
  overflow: hidden;
}
.pagination-wrap {
  display: flex;
  justify-content: center;
  padding: 20px 0 0;
}

/* ===== Loading ===== */
.loading-state {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--lt-bg-card);
  border-radius: var(--lt-radius-lg);
  overflow: hidden;
}
.skeleton-card {
  padding: 18px 24px;
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
@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ===== Empty ===== */
.empty-state {
  text-align: center;
  padding: 48px 0;
}
.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.25;
}
.empty-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--lt-text-secondary);
  margin: 0 0 4px;
}
.empty-desc {
  font-size: 13px;
  color: var(--lt-text-auxiliary);
  margin: 0;
}

/* ===== Mobile ===== */
@media (max-width: 767px) {
  .stat-chips-row {
    gap: 8px;
  }
  .stat-chip {
    min-width: 0;
    padding: 10px 4px;
  }
  .stat-value {
    font-size: 1.15rem;
  }
  .sub-tab-btn {
    padding: 6px 8px;
    font-size: 12px;
  }
}
</style>
