<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useForumStore } from '@/stores/forum'
import { useUserStore } from '@/stores/user'
import ForumContent from '@/components/forum/ForumContent.vue'
import CommentSection from '@/components/forum/CommentSection.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import { ArrowLeft, Edit, Delete, Star, Share } from '@element-plus/icons-vue'
import { apiFetch } from '@/utils/api'
import type { ForumResource } from '@/types/forum'

const route = useRoute()
const router = useRouter()
const store = useForumStore()
const userStore = useUserStore()
const postId = computed(() => route.params.id as string)
const isOwner = computed(() => store.currentPost?.userId === userStore.userInfo?.id)

onMounted(async () => {
  if (postId.value) {
    await store.fetchPostDetail(postId.value)
    store.recordView(postId.value)
    store.fetchComments(postId.value)
  }
})

async function handleLike(action: 'like' | 'dislike') {
  if (!store.currentPost) return
  const current = store.currentPost.userLiked
  if (current === action) {
    await store.removeLike('post', store.currentPost.id)
    store.currentPost.userLiked = 'none'
    if (action === 'like') store.currentPost.likeCount--
    else store.currentPost.dislikeCount--
  } else {
    if (current !== 'none') {
      if (current === 'like') store.currentPost.likeCount--
      else store.currentPost.dislikeCount--
    }
    await store.toggleLike('post', store.currentPost.id, action)
    store.currentPost.userLiked = action
    if (action === 'like') store.currentPost.likeCount++
    else store.currentPost.dislikeCount++
  }
}

async function handleFavorite() {
  if (!store.currentPost) return
  if (store.currentPost.userFavorited) {
    await store.removeFavorite(store.currentPost.id)
    store.currentPost.userFavorited = false
    store.currentPost.favoriteCount--
  } else {
    await store.addFavorite(store.currentPost.id)
    store.currentPost.userFavorited = true
    store.currentPost.favoriteCount++
  }
}

async function handleFollow() {
  if (!store.currentPost) return
  if (store.currentPost.userFollowed) {
    await store.unfollowUser(store.currentPost.userId)
    store.currentPost.userFollowed = false
  } else {
    await store.followUser(store.currentPost.userId)
    store.currentPost.userFollowed = true
  }
}

async function handleDelete() {
  if (!store.currentPost) return
  await store.deletePost(store.currentPost.id)
  router.push('/forum')
}

function handleShare() {
  navigator.clipboard.writeText(window.location.href)
  ElMessage.success({ message: '链接已复制' })
}

function handleReport() {
  if (!store.currentPost) return
  store.report('post', store.currentPost.id, '举报理由')
  ElMessage.success({ message: '举报已提交' })
}

function goEdit() {
  router.push(`/forum/edit/${store.currentPost?.id}`)
}

function goBack() {
  router.push('/forum')
}

const drawerVisible = ref(false)
const previewResource = ref<any>(null)
const previewContent = ref('')
const previewLoading = ref(false)

async function handleResourcePreview(resource: ForumResource) {
  previewResource.value = resource
  previewLoading.value = true
  drawerVisible.value = true
  try {
    const res: any = await apiFetch(`/forum/resources/${resource.resourceItemId}`)
    previewContent.value = res.data?.content || ''
    previewResource.value = { ...resource, ...res.data }
  } catch {
    previewContent.value = ''
    ElMessage.error('无法加载资源内容')
  } finally {
    previewLoading.value = false
  }
}

async function handleResourceNavigate(resource: ForumResource) {
  try {
    await ElMessageBox.confirm(
      `「${resource.title}」为 ${resource.type} 类型资源，将在资源库中查看完整内容。`,
      '跳转到资源库',
      { confirmButtonText: '前往查看', cancelButtonText: '取消', type: 'info' }
    )
    router.push(`/learn/resource/${resource.packId}?resourceId=${resource.resourceItemId}`)
  } catch {
    // user cancelled
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function getFileTypeLabel(mimeType: string): string {
  if (!mimeType) return '文件'
  if (mimeType.startsWith('image/')) return '图片'
  if (mimeType.includes('pdf')) return 'PDF'
  if (mimeType.includes('word') || mimeType.includes('document')) return '文档'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '表格'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '幻灯片'
  if (mimeType.startsWith('text/')) return '文本'
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('compress')) return '压缩包'
  return mimeType.split('/').pop() || '文件'
}
</script>

<template>
  <div class="post-detail-page">
    <div class="max-w-[860px] mx-auto">
      <!-- 面包屑 -->
      <div class="flex items-center gap-2 text-sm mb-4" style="color: var(--lt-text-auxiliary);">
        <el-button text :icon="ArrowLeft" @click="goBack">返回列表</el-button>
        <span>/</span>
        <span class="truncate max-w-[300px]">{{ store.currentPost?.title || '帖子详情' }}</span>
      </div>

      <div v-if="store.postLoading" class="flex justify-center py-20">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
      </div>

      <template v-else-if="store.currentPost">
        <div class="detail-card card-elevated p-6 rounded-lg">
          <!-- 操作栏 -->
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <el-tag v-if="store.currentPost.isPinned" type="primary" size="small">📌 置顶</el-tag>
              <el-tag v-if="store.currentPost.isFeatured" type="warning" size="small">🌟 精华</el-tag>
            </div>
            <div class="flex items-center gap-1">
              <el-button v-if="isOwner" text :icon="Edit" size="small" @click="goEdit">编辑</el-button>
              <el-button v-if="isOwner" text :icon="Delete" size="small" type="danger" @click="handleDelete">删除</el-button>
              <el-button
                text
                size="small"
                :type="store.currentPost.userFavorited ? 'warning' : 'default'"
                :icon="Star"
                @click="handleFavorite"
              >{{ store.currentPost.userFavorited ? '已收藏' : '收藏' }}</el-button>
              <el-button text size="small" :icon="Share" @click="handleShare">分享</el-button>
              <el-dropdown trigger="click">
                <el-button text size="small">···</el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="handleReport">举报</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>

          <!-- 帖子标题与元信息 -->
          <h1 class="text-2xl font-bold mb-3" style="color: var(--lt-text-primary);">{{ store.currentPost.title }}</h1>

          <div class="flex items-center gap-3 mb-4 text-sm" style="color: var(--lt-text-auxiliary);">
            <div class="flex items-center gap-2">
              <el-avatar :size="24" :src="store.currentPost.userAvatar">
                {{ store.currentPost.userName?.charAt(0) || 'U' }}
              </el-avatar>
              <span style="color: var(--lt-text-secondary); font-weight: 500;">{{ store.currentPost.userName }}</span>
              <el-button
                v-if="!isOwner"
                text
                size="small"
                :type="store.currentPost.userFollowed ? 'default' : 'primary'"
                @click="handleFollow"
              >
                {{ store.currentPost.userFollowed ? '已关注' : '+ 关注' }}
              </el-button>
            </div>
            <span>{{ new Date(store.currentPost.createdAt).toLocaleDateString('zh-CN') }}</span>
          </div>

          <!-- 标签 -->
          <div class="flex flex-wrap gap-1.5 mb-4">
            <el-tag
              v-for="tag in store.currentPost.tags" :key="tag"
              size="small"
              class="forum-tag"
            ># {{ tag }}</el-tag>
          </div>

          <!-- 正文 -->
          <div class="post-body py-4" style="border-top: 1px solid var(--lt-border);">
            <ForumContent
              :content="store.currentPost.content"
              :resources="store.currentPost.resources"
              @resource-preview="handleResourcePreview"
              @resource-navigate="handleResourceNavigate"
            />
          </div>

          <!-- 文件附件 -->
          <div v-if="store.currentPost.files?.length" class="mt-4" style="border-top: 1px solid var(--lt-border); padding-top: 16px;">
            <h4 class="text-sm font-semibold mb-3 flex items-center gap-1" style="color: var(--lt-text-secondary);">
              📎 附件
            </h4>
            <div class="flex flex-col gap-2">
              <a
                v-for="file in store.currentPost.files" :key="file.id"
                :href="file.fileUrl" target="_blank"
                class="file-card flex items-center gap-3 px-4 py-3 rounded-lg text-sm"
                style="background: var(--lt-brand-lightest); color: var(--lt-text-primary); text-decoration: none;"
              >
                <div class="file-icon flex items-center justify-center rounded-lg w-10 h-10 flex-shrink-0" style="background: var(--lt-brand); color: #fff;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium truncate m-0" style="color: var(--lt-text-primary);">{{ file.fileName }}</p>
                  <p class="text-xs m-0" style="color: var(--lt-text-auxiliary);">{{ getFileTypeLabel(file.fileType) }} · {{ formatFileSize(file.fileSize) }}</p>
                </div>
              </a>
            </div>
          </div>

          <!-- 互动统计 -->
          <div class="flex items-center gap-6 mt-6 pt-4" style="border-top: 1px solid var(--lt-border);">
            <button
              class="stat-action"
              :class="{ active: store.currentPost.userLiked === 'like' }"
              @click="handleLike('like')"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
              {{ store.currentPost.likeCount }}
            </button>
            <button
              class="stat-action"
              :class="{ active: store.currentPost.userLiked === 'dislike' }"
              @click="handleLike('dislike')"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10zM17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg>
              {{ store.currentPost.dislikeCount }}
            </button>
            <span class="stat-action static">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              {{ store.currentPost.commentCount }} 条回复
            </span>
            <span class="stat-action static">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              {{ store.currentPost.favoriteCount }} 人收藏
            </span>
          </div>
        </div>

        <!-- 评论区 -->
        <div class="comment-card card-elevated rounded-lg p-6 mt-4">
          <CommentSection :post-id="postId" />
        </div>

        <!-- 资源预览抽屉 -->
        <el-drawer
          v-model="drawerVisible"
          :title="previewResource?.title || '资源预览'"
          size="680px"
          direction="rtl"
        >
          <div v-loading="previewLoading" style="min-height: 200px">
            <MarkdownViewer
              v-if="previewContent"
              :content="previewContent"
              :show-toc="false"
            />
            <div v-else-if="!previewLoading" class="text-center" style="color: var(--lt-text-auxiliary); padding: 40px 0">
              无法加载资源内容
            </div>
          </div>
          <template v-if="previewResource?.packId" #footer>
            <el-button @click="router.push(`/learn/resource/${previewResource.packId}?resourceId=${previewResource.resourceItemId}`)">
              在资源库中查看完整资源
            </el-button>
          </template>
        </el-drawer>
      </template>
    </div>
  </div>
</template>

<style scoped>
.post-detail-page {
  padding: 24px 32px;
}
.detail-card, .comment-card {
  background: var(--lt-bg-card);
}
.stat-action {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border-radius: 20px;
  border: none;
  cursor: pointer;
  font-size: 13px;
  color: var(--lt-text-auxiliary);
  background: transparent;
  transition: all var(--lt-transition-base);
}
.stat-action:hover {
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
}
.stat-action.active {
  color: var(--lt-brand);
  font-weight: 600;
}
.stat-action.static {
  cursor: default;
}
.stat-action.static:hover {
  background: transparent;
  color: var(--lt-text-auxiliary);
}
.file-card {
  text-decoration: none;
  transition: all var(--lt-transition-base);
}
.file-card:hover {
  box-shadow: var(--lt-shadow-blue);
}
.forum-tag {
  --el-tag-bg-color: var(--lt-brand-lightest);
  --el-tag-text-color: var(--lt-brand);
  --el-tag-border-color: transparent;
  height: 22px;
  line-height: 22px;
  font-size: 11px;
  border-radius: 4px;
}

@media (max-width: 768px) {
  .post-detail-page {
    padding: 12px 16px;
    padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  }
  .detail-card, .comment-card {
    padding: 12px;
    border-radius: var(--lt-radius-lg);
  }
  .detail-card h1 {
    font-size: 18px;
  }
  .stat-action {
    padding: 10px 14px;
    min-height: 44px;
    font-size: 14px;
  }
  .file-card {
    padding: 10px 12px;
    min-height: 44px;
    box-sizing: border-box;
  }
}
</style>
