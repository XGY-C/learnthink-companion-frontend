import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiFetch } from '@/utils/api'
import type { ForumTag, ForumPost, ForumPostDetail, ForumComment, ForumResource, PageResult, ForumActivityOverview, MyCommentItem, ReceivedCommentItem } from '@/types/forum'

export const useForumStore = defineStore('forum', () => {
  const tags = ref<ForumTag[]>([])
  const posts = ref<ForumPost[]>([])
  const total = ref(0)
  const loading = ref(false)
  const postLoading = ref(false)
  const currentPost = ref<ForumPostDetail | null>(null)
  const comments = ref<ForumComment[]>([])
  const commentsLoading = ref(false)

  const activeCourse = ref('all')
  const activeSort = ref('latest')
  const activeTag = ref('all')
  const activeTab = ref('all')
  const activeMine = ref(false)
  const keyword = ref('')
  const currentPage = ref(1)
  const pageSize = ref(20)

  const favorites = ref<string[]>([])
  const following = ref<string[]>([])

  const availableResources = ref<ForumResource[]>([])

  // ===== My Forum Activity state =====
  const myOverview = ref<ForumActivityOverview | null>(null)
  const myPosts = ref<ForumPost[]>([])
  const myPostsTotal = ref(0)
  const myPostsPage = ref(1)
  const myPostsPageSize = ref(10)
  const myPostsLoading = ref(false)

  const myComments = ref<MyCommentItem[]>([])
  const myCommentsTotal = ref(0)
  const myCommentsPage = ref(1)
  const myCommentsPageSize = ref(10)
  const myCommentsLoading = ref(false)

  const receivedComments = ref<ReceivedCommentItem[]>([])
  const receivedCommentsTotal = ref(0)
  const receivedCommentsPage = ref(1)
  const receivedCommentsPageSize = ref(10)
  const receivedCommentsLoading = ref(false)

  function setFilter(key: string, value: string) {
    switch (key) {
      case 'course': activeCourse.value = value; break
      case 'sort': activeSort.value = value; break
      case 'tag': activeTag.value = value; break
      case 'tab': activeTab.value = value; break
    }
    currentPage.value = 1
  }

  async function fetchTags() {
    try {
      const res = await apiFetch<ForumTag[]>('/forum/tags')
      tags.value = res.data || []
    } catch { /* ignore */ }
  }

  async function fetchPosts(opts?: { silent?: boolean }) {
    if (!(opts?.silent && posts.value.length > 0)) {
      loading.value = true
    }
    try {
      const query: Record<string, string | number> = {
        page: currentPage.value,
        size: pageSize.value,
        sort: activeSort.value,
      }
      if (keyword.value) query.keyword = keyword.value
      if (activeCourse.value !== 'all') query.courseId = activeCourse.value
      if (activeTag.value !== 'all') query.tags = activeTag.value
      if (activeMine.value) query.tab = 'mine'
      else if (activeTab.value === 'featured') query.tab = 'featured'

      const qs = new URLSearchParams()
      Object.entries(query).forEach(([k, v]) => v !== undefined && v !== '' && qs.set(k, String(v)))
      const res = await apiFetch<PageResult<ForumPost>>(`/forum/posts?${qs.toString()}`)
      posts.value = res.data?.records || []
      total.value = res.data?.total || 0
    } catch { /* ignore */ }
    finally { loading.value = false }
  }

  async function fetchPostDetail(id: string) {
    postLoading.value = true
    try {
      const res = await apiFetch<ForumPostDetail>(`/forum/posts/${id}`)
      currentPost.value = res.data
      return res.data
    } finally { postLoading.value = false }
  }

  async function createPost(payload: {
    title: string; content: string; courseId: string
    tagIds: string[]; type: string; resourceItemIds: string[]; files: any[]
  }) {
    const res = await apiFetch<ForumPostDetail>('/forum/posts', { method: 'POST', body: payload })
    return res.data
  }

  async function updatePost(id: string, payload: Partial<{
    title: string; content: string; tagIds: string[]; type: string
    resourceItemIds: string[]; files: any[]
  }>) {
    await apiFetch(`/forum/posts/${id}`, { method: 'PUT', body: payload })
  }

  async function deletePost(id: string) {
    await apiFetch(`/forum/posts/${id}`, { method: 'DELETE' })
  }

  async function recordView(id: string) {
    await apiFetch(`/forum/posts/${id}/view`, { method: 'POST' }).catch(() => {})
  }

  async function fetchComments(postId: string) {
    commentsLoading.value = true
    try {
      const res = await apiFetch<ForumComment[]>(`/forum/posts/${postId}/comments`)
      comments.value = res.data || []
    } finally { commentsLoading.value = false }
  }

  async function createComment(postId: string, payload: { content: string; parentId?: string; rootId?: string }) {
    const res = await apiFetch<ForumComment>(`/forum/posts/${postId}/comments`, { method: 'POST', body: payload })
    return res.data
  }

  async function deleteComment(commentId: string) {
    await apiFetch(`/forum/comments/${commentId}`, { method: 'DELETE' })
  }

  async function toggleLike(targetType: 'post' | 'comment', targetId: string, action: 'like' | 'dislike') {
    const res = await apiFetch<{ action: string | null }>('/forum/like', { method: 'POST', body: { targetType, targetId, action } })
    return res.data
  }

  async function removeLike(targetType: 'post' | 'comment', targetId: string) {
    await apiFetch('/forum/like', { method: 'DELETE', body: { targetType, targetId } })
  }

  async function addFavorite(postId: string) {
    await apiFetch(`/forum/favorites/${postId}`, { method: 'POST' })
    favorites.value.push(postId)
  }

  async function removeFavorite(postId: string) {
    await apiFetch(`/forum/favorites/${postId}`, { method: 'DELETE' })
    favorites.value = favorites.value.filter(id => id !== postId)
  }

  async function fetchFavorites() {
    try {
      const res = await apiFetch<ForumPost[]>(`/forum/favorites`)
      posts.value = res.data || []
      total.value = res.data?.length || 0
    } catch {}
  }

  async function followUser(userId: string) {
    await apiFetch(`/forum/follows/${userId}`, { method: 'POST' })
    if (!following.value.includes(userId)) following.value.push(userId)
  }

  async function unfollowUser(userId: string) {
    await apiFetch(`/forum/follows/${userId}`, { method: 'DELETE' })
    following.value = following.value.filter(id => id !== userId)
  }

  async function report(targetType: 'post' | 'comment', targetId: string, reason: string) {
    await apiFetch('/forum/reports', { method: 'POST', body: { targetType, targetId, reason } })
  }

  async function fetchAvailableResources() {
    try {
      const res = await apiFetch<ForumResource[]>('/forum/available-resources')
      availableResources.value = res.data || []
    } catch {}
  }

  async function uploadImage(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/forum/upload/image', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      body: formData,
    })
    const json = await res.json()
    return json.data as { url: string }
  }

  async function uploadFile(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/forum/upload/file', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      body: formData,
    })
    const json = await res.json()
    return { fileUrl: json.data.url, fileName: json.data.fileName, fileSize: json.data.fileSize, fileType: json.data.fileType }
  }

  // ===== My Forum Activity =====

  async function fetchMyOverview() {
    try {
      const res = await apiFetch<ForumActivityOverview>('/forum/me/overview')
      myOverview.value = res.data
    } catch { /* ignore */ }
  }

  async function fetchMyPosts(page?: number, size?: number) {
    myPostsLoading.value = true
    try {
      const p = page ?? myPostsPage.value
      const s = size ?? myPostsPageSize.value
      const res = await apiFetch<PageResult<ForumPost>>(`/forum/me/posts?page=${p}&size=${s}`)
      myPosts.value = res.data?.records || []
      myPostsTotal.value = res.data?.total || 0
      myPostsPage.value = p
    } catch { /* ignore */ }
    finally { myPostsLoading.value = false }
  }

  async function fetchMyComments(page?: number, size?: number) {
    myCommentsLoading.value = true
    try {
      const p = page ?? myCommentsPage.value
      const s = size ?? myCommentsPageSize.value
      const res = await apiFetch<PageResult<MyCommentItem>>(`/forum/me/comments?page=${p}&size=${s}`)
      myComments.value = res.data?.records || []
      myCommentsTotal.value = res.data?.total || 0
      myCommentsPage.value = p
    } catch { /* ignore */ }
    finally { myCommentsLoading.value = false }
  }

  async function fetchReceivedComments(page?: number, size?: number) {
    receivedCommentsLoading.value = true
    try {
      const p = page ?? receivedCommentsPage.value
      const s = size ?? receivedCommentsPageSize.value
      const res = await apiFetch<PageResult<ReceivedCommentItem>>(`/forum/me/received-comments?page=${p}&size=${s}`)
      receivedComments.value = res.data?.records || []
      receivedCommentsTotal.value = res.data?.total || 0
      receivedCommentsPage.value = p
    } catch { /* ignore */ }
    finally { receivedCommentsLoading.value = false }
  }

  const hasMore = computed(() => posts.value.length < total.value)

  return {
    tags, posts, total, loading, postLoading, currentPost, comments, commentsLoading,
    activeCourse, activeSort, activeTag, activeTab, activeMine, keyword,
    currentPage, pageSize, favorites, following, availableResources, hasMore,
    setFilter, fetchTags, fetchPosts, fetchPostDetail,
    createPost, updatePost, deletePost, recordView,
    fetchComments, createComment, deleteComment,
    toggleLike, removeLike, addFavorite, removeFavorite, fetchFavorites,
    followUser, unfollowUser, report,
    fetchAvailableResources, uploadImage, uploadFile,
    // My Forum Activity
    myOverview, myPosts, myPostsTotal, myPostsPage, myPostsPageSize, myPostsLoading,
    myComments, myCommentsTotal, myCommentsPage, myCommentsPageSize, myCommentsLoading,
    receivedComments, receivedCommentsTotal, receivedCommentsPage, receivedCommentsPageSize, receivedCommentsLoading,
    fetchMyOverview, fetchMyPosts, fetchMyComments, fetchReceivedComments,
  }
})
