<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { ForumPost } from '@/types/forum'
import { ChatDotSquare } from '@element-plus/icons-vue'

const props = defineProps<{ post: ForumPost }>()
const router = useRouter()

function goDetail() {
  router.push(`/forum/${props.post.id}`)
}

function formatDate(d: string) {
  const date = new Date(d)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 172800000) return '昨天'
  return date.toLocaleDateString('zh-CN')
}
</script>

<template>
  <div class="post-card" @click="goDetail">
    <div class="card-left">
      <el-avatar :size="40" :src="post.userAvatar" class="avatar">
        {{ post.userName?.charAt(0) || 'U' }}
      </el-avatar>
    </div>

    <div class="card-body">
      <div class="card-header">
        <div class="title-row">
          <el-tag v-if="post.type !== 'post'" size="small" class="type-tag" :class="'type-' + post.type">
            {{ post.type === 'question' ? '问答' : '资源' }}
          </el-tag>
          <span v-if="post.isPinned" class="badge pinned">置顶</span>
          <span v-if="post.isFeatured" class="badge featured">精华</span>
          <h3 class="title">{{ post.title }}</h3>
        </div>
        <p class="summary">{{ post.summary }}</p>
        <div class="tags-row">
          <span v-for="tag in post.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </div>

      <div class="card-footer">
        <span class="meta author">{{ post.userName }}</span>
        <span class="meta dot">·</span>
        <span class="meta time">{{ formatDate(post.createdAt) }}</span>
        <div class="spacer" />
        <span class="stat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          {{ post.viewCount }}
        </span>
        <span class="stat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
          {{ post.likeCount }}
        </span>
        <span class="stat">
          <el-icon :size="14"><ChatDotSquare /></el-icon>
          {{ post.commentCount }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.post-card {
  display: flex;
  gap: 16px;
  padding: 18px 24px;
  cursor: pointer;
  transition: all var(--lt-transition-smooth);
  position: relative;
}
.post-card:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 24px;
  right: 24px;
  bottom: 0;
  height: 1px;
  background: var(--lt-border);
}
.post-card:hover {
  background: var(--lt-brand-lightest);
  z-index: 1;
}
.post-card:hover + .post-card::after,
.post-card:last-child::after {
  display: none;
}

/* Left avatar column */
.card-left {
  flex-shrink: 0;
  padding-top: 2px;
}
.avatar {
  background: linear-gradient(135deg, var(--lt-brand), var(--lt-brand-dark));
}

/* Body */
.card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Header */
.title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.type-tag {
  font-size: 11px;
  font-weight: 600;
  border: none;
  height: 20px;
  padding: 0 8px;
  border-radius: 4px;
}
.type-tag.type-question {
  background: rgba(255,159,10,0.12);
  color: var(--lt-warning);
}
.type-tag.type-resource {
  background: rgba(52,199,89,0.12);
  color: var(--lt-success);
}
.badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  line-height: 1.4;
}
.badge.pinned {
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
}
.badge.featured {
  background: var(--lt-orange-light-9);
  color: var(--lt-orange);
}
.title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: var(--lt-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
.title:hover {
  color: var(--lt-brand);
}

.summary {
  font-size: 13px;
  color: var(--lt-text-auxiliary);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
}

.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.tag {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 4px;
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
  line-height: 20px;
  transition: background var(--lt-transition-base);
}
.tag:hover {
  background: var(--lt-brand-lighter);
  color: #fff;
}

/* Footer */
.card-footer {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  flex-wrap: wrap;
}
.meta { white-space: nowrap; }
.meta.author {
  font-weight: 500;
  color: var(--lt-text-secondary);
}
.meta.dot { color: var(--lt-border); padding: 0 2px; }
.meta.time { white-space: nowrap; }
.spacer { flex: 1; min-width: 8px; }
.stat {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background var(--lt-transition-base);
  color: var(--lt-text-auxiliary);
}
.stat:hover {
  background: rgba(43,111,255,0.08);
  color: var(--lt-brand);
}

@media (max-width: 768px) {
  .post-card {
    padding: 14px 16px;
  }
  .post-card:not(:last-child)::after {
    left: 16px;
    right: 16px;
  }
  .title {
    font-size: 14px;
  }
}
</style>
