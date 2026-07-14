export interface ForumTag {
  id: string
  name: string
  sortOrder: number
}

export interface ForumPost {
  id: string
  userId: string
  userName: string
  userAvatar: string
  courseId: string
  title: string
  summary: string
  tags: string[]
  type: string
  isPinned: boolean
  isFeatured: boolean
  viewCount: number
  likeCount: number
  dislikeCount: number
  commentCount: number
  favoriteCount: number
  shareCount: number
  userLiked: 'none' | 'like' | 'dislike'
  userFavorited: boolean
  lastActivityAt: string
  createdAt: string
}

export interface ForumPostDetail extends ForumPost {
  content: string
  resources: ForumResource[]
  files: ForumFile[]
  userFollowed: boolean
}

export interface ForumResource {
  id: string
  resourceItemId: string
  title: string
  type: string
  summary: string
}

export interface ForumFile {
  id: string
  fileName: string
  fileUrl: string
  fileSize: number
  fileType: string
}

export interface ForumComment {
  id: string
  postId: string
  parentId: string | null
  rootId: string | null
  userId: string
  userName: string
  userAvatar: string
  content: string
  likeCount: number
  dislikeCount: number
  replyCount: number
  userLiked: 'none' | 'like' | 'dislike'
  children: ForumComment[]
  createdAt: string
}

export interface CreatePostPayload {
  title: string
  content: string
  courseId: string
  tagIds: string[]
  type: string
  resourceItemIds: string[]
  files: { fileName: string; fileUrl: string; fileSize: number; fileType: string }[]
}

export interface CreateCommentPayload {
  content: string
  parentId?: string
  rootId?: string
}

export interface ForumQueryParams {
  courseId?: string
  tags?: string
  sort?: string
  tab?: string
  page?: number
  size?: number
  keyword?: string
}

export interface PageResult<T> {
  records: T[]
  total: number
  page: number
  size: number
}
