<script setup lang="ts">
import { ref, watch } from 'vue'
import { useForumStore } from '@/stores/forum'
import type { ForumComment } from '@/types/forum'
import CommentItem from './CommentItem.vue'
import { ChatDotSquare } from '@element-plus/icons-vue'

const props = defineProps<{ postId: string }>()
const store = useForumStore()
const replyTarget = ref<ForumComment | null>(null)
const replyContent = ref('')
const submitting = ref(false)

watch(() => props.postId, (id) => {
  if (id) store.fetchComments(id)
}, { immediate: true })

async function submitComment() {
  if (!replyContent.value.trim() || submitting.value) return
  submitting.value = true
  try {
    await store.createComment(props.postId, {
      content: replyContent.value,
      parentId: replyTarget.value?.id,
      rootId: replyTarget.value?.rootId || replyTarget.value?.id,
    })
    replyContent.value = ''
    replyTarget.value = null
    store.fetchComments(props.postId)
  } finally { submitting.value = false }
}

function handleReply(comment: ForumComment) {
  replyTarget.value = comment
}

function cancelReply() {
  replyTarget.value = null
  replyContent.value = ''
}

async function handleLike(targetType: string, targetId: string, action: string) {
  try {
    await store.toggleLike(targetType as 'post' | 'comment', targetId, action as 'like' | 'dislike')
    store.fetchComments(props.postId)
  } catch {}
}

function handleReport(_targetType: string, _targetId: string) {
}
</script>

<template>
  <div class="comment-section">
    <h3 class="text-base font-semibold mb-4 flex items-center gap-2" style="color: var(--lt-text-primary);">
      <el-icon :size="18"><ChatDotSquare /></el-icon>
      评论 ({{ store.comments.length }})
    </h3>

    <div v-if="store.commentsLoading" class="flex justify-center py-8">
      <el-icon class="is-loading" :size="24"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></el-icon>
    </div>

    <div v-else-if="store.comments.length === 0" class="text-center py-8 text-sm" style="color: var(--lt-text-auxiliary);">
      暂无评论，来说两句吧~
    </div>

    <div v-else class="comments-list">
      <CommentItem
        v-for="comment in store.comments"
        :key="comment.id"
        :comment="comment"
        :depth="0"
        @reply="handleReply"
        @like="handleLike"
        @report="handleReport"
      />
    </div>

    <div class="reply-box mt-4 pt-4" style="border-top: 1px solid var(--lt-border);">
      <div v-if="replyTarget" class="flex items-center gap-2 mb-2 text-sm" style="color: var(--lt-text-auxiliary);">
        <span>回复 @{{ replyTarget.userName }}</span>
        <el-button link size="small" @click="cancelReply">取消</el-button>
      </div>
      <div class="flex gap-3">
        <el-input
          v-model="replyContent"
          :placeholder="replyTarget ? `回复 @${replyTarget.userName}...` : '发表评论...'"
          type="textarea"
          :rows="2"
          resize="none"
          class="flex-1"
        />
        <el-button
          type="primary"
          :loading="submitting"
          :disabled="!replyContent.trim()"
          @click="submitComment"
          class="self-end"
        >
          发送
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.comment-section {
  padding: 20px 0;
}
</style>
