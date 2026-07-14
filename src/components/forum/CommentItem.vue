<script setup lang="ts">
import type { ForumComment } from '@/types/forum'

const props = defineProps<{
  comment: ForumComment
  depth?: number
}>()

const emit = defineEmits<{
  (e: 'reply', comment: ForumComment): void
  (e: 'like', targetType: 'post' | 'comment', targetId: string, action: 'like' | 'dislike'): void
  (e: 'report', targetType: 'post' | 'comment', targetId: string): void
}>()

function formatDate(d: string) {
  const date = new Date(d)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return date.toLocaleDateString('zh-CN')
}
</script>

<template>
  <div class="comment-item" :class="{ 'is-reply': (depth || 0) > 0 }">
    <div class="flex gap-3">
      <el-avatar :size="32" :src="props.comment.userAvatar" class="flex-shrink-0">
        {{ props.comment.userName?.charAt(0) || 'U' }}
      </el-avatar>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-sm font-medium" style="color: var(--lt-text-primary);">{{ props.comment.userName }}</span>
          <span class="text-xs" style="color: var(--lt-text-auxiliary);">{{ formatDate(props.comment.createdAt) }}</span>
        </div>
        <p class="text-sm mb-2 leading-relaxed" style="color: var(--lt-text-secondary);">
          {{ props.comment.content }}
        </p>
        <div class="flex items-center gap-3 text-xs">
          <button
            class="comment-action"
            :class="{ liked: props.comment.userLiked === 'like' }"
            @click="emit('like', 'comment', props.comment.id, props.comment.userLiked === 'like' ? 'like' : 'like' as any)"
          >
            👍 {{ props.comment.likeCount || '' }}
          </button>
          <button class="comment-action" @click="emit('reply', props.comment)">💬 回复</button>
          <button
            v-if="props.comment.replyCount > 0 && (!props.comment.children || props.comment.children.length === 0)"
            class="comment-action"
            style="color: var(--lt-brand);"
          >
            {{ props.comment.replyCount }} 条回复 →
          </button>
          <el-dropdown trigger="click" size="small">
            <button class="comment-action">···</button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="emit('report', 'comment', props.comment.id)">举报</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <div v-if="props.comment.children?.length" class="mt-3 pl-2" style="border-left: 2px solid var(--lt-border);">
          <CommentItem
            v-for="child in props.comment.children"
            :key="child.id"
            :comment="child"
            :depth="(depth || 0) + 1"
            @reply="emit('reply', $event)"
              @like="(t: any, id: any, a: any) => emit('like', t, id, a)"
              @report="(t: any, id: any) => emit('report', t, id)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.comment-item {
  padding: 12px 0;
}
.comment-item.is-reply {
  padding: 8px 0 8px 12px;
}
.comment-item + .comment-item {
  border-top: 1px solid var(--lt-border);
}
.comment-item.is-reply + .comment-item.is-reply {
  border-top: 1px solid var(--lt-border);
}
.comment-action {
  border: none;
  background: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  transition: all var(--lt-transition-base);
}
.comment-action:hover {
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
}
.comment-action.liked {
  color: var(--lt-brand);
  font-weight: 600;
}
</style>
