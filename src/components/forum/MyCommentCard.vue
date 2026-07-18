<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { MyCommentItem } from '@/types/forum'
import { ChatLineSquare } from '@element-plus/icons-vue'

const props = defineProps<{ comment: MyCommentItem }>()
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
  <div class="my-comment-card" @click="goPost">
    <div class="card-body">
      <div class="post-ref">
        <el-icon :size="12"><ChatLineSquare /></el-icon>
        <span class="post-title">在《{{ comment.postTitle }}》中评论</span>
      </div>
      <p class="comment-content">{{ comment.content }}</p>
      <div class="card-footer">
        <span class="meta time">{{ formatDate(comment.createdAt) }}</span>
        <div class="spacer" />
        <span class="stat">赞 {{ comment.likeCount }}</span>
        <span class="stat">回复 {{ comment.replyCount }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.my-comment-card {
  padding: 14px 24px;
  cursor: pointer;
  transition: background var(--lt-transition-base);
  position: relative;
}
.my-comment-card:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 24px;
  right: 24px;
  bottom: 0;
  height: 1px;
  background: var(--lt-border);
}
.my-comment-card:hover {
  background: var(--lt-brand-lightest);
}
.card-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.post-ref {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--lt-text-auxiliary);
}
.post-title {
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
}
.card-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--lt-text-auxiliary);
}
.spacer { flex: 1; }
.stat { white-space: nowrap; }
.meta.time { white-space: nowrap; }
</style>
