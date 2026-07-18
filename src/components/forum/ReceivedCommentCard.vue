<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { ReceivedCommentItem } from '@/types/forum'

const props = defineProps<{ comment: ReceivedCommentItem }>()
const router = useRouter()

function goPost() {
  router.push(`/forum/${props.comment.postId}`)
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
  <div class="received-comment-card" @click="goPost">
    <div class="card-body">
      <div class="card-header">
        <el-avatar :size="28" :src="comment.commenterAvatar" class="avatar">
          {{ comment.commenterName?.charAt(0) || 'U' }}
        </el-avatar>
        <span class="commenter-name">{{ comment.commenterName }}</span>
        <span class="action-text">{{ comment.isReply ? '回复了你的评论' : '回复了你的帖子' }}</span>
        <span class="post-ref">《{{ comment.postTitle }}》</span>
      </div>
      <p class="comment-content">{{ comment.content }}</p>
      <div class="card-footer">
        <span class="meta time">{{ formatDate(comment.createdAt) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.received-comment-card {
  padding: 14px 24px;
  cursor: pointer;
  transition: background var(--lt-transition-base);
  position: relative;
}
.received-comment-card:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 24px;
  right: 24px;
  bottom: 0;
  height: 1px;
  background: var(--lt-border);
}
.received-comment-card:hover {
  background: var(--lt-brand-lightest);
}
.card-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  flex-wrap: wrap;
}
.avatar {
  flex-shrink: 0;
  background: linear-gradient(135deg, var(--lt-brand), var(--lt-brand-dark));
  font-size: 12px;
}
.commenter-name {
  font-weight: 600;
  color: var(--lt-text-secondary);
}
.action-text {
  color: var(--lt-text-auxiliary);
  font-size: 12px;
}
.post-ref {
  color: var(--lt-brand);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.comment-content {
  font-size: 14px;
  color: var(--lt-text-primary);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
  padding-left: 34px;
}
.card-footer {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  padding-left: 34px;
}
.meta.time { white-space: nowrap; }
</style>
