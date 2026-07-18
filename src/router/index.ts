import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useProfileStore } from '@/stores/profile'
import { usePlanStore } from '@/stores/plan'
import { isMobile } from '@/utils/device'
import { recordNavigation } from '@/composables/useNavDirection'
import { ElMessage } from 'element-plus'
import type { Activity } from '@/types'

/** sequential 模式下拦截 locked activity 的路由守卫 */
const learnActivityGuard = (to: any) => {
  const planStore = usePlanStore()
  if (!planStore.plan || planStore.plan.lockMode !== 'sequential') return true
  const actId = to.params.activityId as string
  let activity: Activity | undefined
  for (const sp of planStore.subPlans.values()) {
    activity = sp.activities.find(a => a.activityId === actId)
    if (activity) break
  }
  if (activity && activity.status === 'locked') {
    ElMessage.warning('该活动尚未解锁，请先完成前置活动')
    return { name: isMobile() ? 'path-m' : 'path' }
  }
  return true
}

// ===== 移动端路由 =====
const mobileRoutes = [
  {
    path: '/',
    component: () => import('@/layouts/LayoutMobile.vue'),
    children: [
      {
        path: '',
        name: 'dashboard-m',
        component: () => import('@/views/mobile/DashboardMobile.vue'),
        meta: { title: '学习总览' }
      },
      {
        path: 'chat',
        name: 'chat-m',
        component: () => import('@/views/mobile/ChatViewMobile.vue'),
        meta: { title: 'AI 学习助手' }
      },
      {
        path: 'studio',
        name: 'studio-m',
        component: () => import('@/views/mobile/StudioTaskListMobile.vue'),
        meta: { title: '资源工作室' }
      },
      {
        path: 'studio/:taskId',
        name: 'studio-detail-m',
        component: () => import('@/views/mobile/StudioViewMobile.vue'),
        meta: { title: '资源生成详情' }
      },
      {
        path: 'path',
        name: 'path-m',
        component: () => import('@/views/mobile/PathMobile.vue'),
        meta: { title: '学习路径' }
      },
      {
        path: 'learn/:activityId',
        name: 'learn-m',
        component: () => import('@/views/LearnView.vue'),
        meta: { title: '学习' },
        beforeEnter: learnActivityGuard
      },
      {
        path: 'learn/resource/:packId',
        name: 'resource-learn-m',
        component: () => import('@/views/ResourceLearnView.vue'),
        meta: { title: '学习' }
      },
      {
        path: 'code',
        name: 'code-learn-m',
        component: () => import('@/views/mobile/CodeLearnMobile.vue'),
        meta: { title: '代码学习', hideMobileNav: true }
      },
      {
        path: 'library',
        name: 'library-m',
        component: () => import('@/views/mobile/LibraryMobile.vue'),
        meta: { title: '资源库' }
      },
      {
        path: 'practice',
        name: 'practice-m',
        component: () => import('@/views/mobile/PracticeMobile.vue'),
        meta: { title: '练习中心' }
      },
      {
        path: 'forum',
        name: 'forum-m',
        component: () => import('@/views/forum/ForumHome.vue'),
        meta: { title: '学习论坛' }
      },
      {
        path: 'forum/:id',
        name: 'forum-detail-m',
        component: () => import('@/views/forum/PostDetail.vue'),
        meta: { title: '帖子详情' }
      },
      {
        path: 'forum/create',
        name: 'forum-create-m',
        component: () => import('@/views/forum/CreatePost.vue'),
        meta: { title: '发布新帖' }
      },
      {
        path: 'forum/edit/:id',
        name: 'forum-edit-m',
        component: () => import('@/views/forum/EditPost.vue'),
        meta: { title: '编辑帖子' }
      },
      {
        path: 'report',
        name: 'report-m',
        component: () => import('@/views/mobile/ReportMobile.vue'),
        meta: { title: '学习报告' }
      },
      {
        path: 'profile',
        name: 'profile-m',
        component: () => import('@/views/mobile/ProfileMobile.vue'),
        meta: { title: '个人中心', requiresAuth: true }
      },
      {
        path: 'notifications',
        name: 'notifications-m',
        component: () => import('@/views/NotificationListView.vue'),
        meta: { title: '消息通知', requiresAuth: true }
      },
      {
        path: 'tutoring/:sessionId?',
        name: 'tutoring-m',
        component: () => import('@/views/mobile/TutoringPageMobile.vue'),
        meta: { title: '智能辅导', requiresAuth: true }
      },
      {
        path: 'answer/:sessionId',
        name: 'DirectAnswer-m',
        component: () => import('@/views/pc/DirectAnswerView.vue'),
        meta: { title: '完整解答', requiresAuth: true }
      },
    ]
  }
]

// ===== PC 端路由 =====
const pcRoutes = [
  {
    path: '/',
    component: () => import('@/layouts/LayoutPC.vue'),
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue')
      },
      {
        path: 'chat',
        name: 'chat',
        component: () => import('@/views/pc/ChatView.vue')
      },
      {
        path: 'studio',
        name: 'studio',
        component: () => import('@/views/pc/StudioTaskList.vue')
      },
      {
        path: 'studio/:taskId',
        name: 'studio-detail',
        component: () => import('@/views/pc/StudioView.vue')
      },
      {
        path: 'path',
        name: 'path',
        component: () => import('@/views/PathView.vue')
      },
      {
        path: 'learn/:activityId',
        name: 'learn',
        component: () => import('@/views/LearnView.vue'),
        meta: { title: '学习', hideSidebar: true },
        beforeEnter: learnActivityGuard
      },
      {
        path: 'learn/resource/:packId',
        name: 'resource-learn',
        component: () => import('@/views/ResourceLearnView.vue'),
        meta: { title: '学习', hideSidebar: true }
      },
      {
        path: 'code',
        name: 'code-learn',
        component: () => import('@/views/CodeLearnView.vue'),
        meta: { title: '代码学习', hideSidebar: true }
      },
      {
        path: 'library',
        name: 'library',
        component: () => import('@/views/LibraryView.vue')
      },
      {
        path: 'practice',
        name: 'practice',
        component: () => import('@/views/pc/PracticeView.vue'),
        meta: { title: '练习中心' }
      },
      {
        path: 'forum',
        name: 'forum',
        component: () => import('@/views/forum/ForumHome.vue'),
        meta: { title: '学习论坛' }
      },
      {
        path: 'forum/:id',
        name: 'forum-detail',
        component: () => import('@/views/forum/PostDetail.vue'),
        meta: { title: '帖子详情' }
      },
      {
        path: 'forum/create',
        name: 'forum-create',
        component: () => import('@/views/forum/CreatePost.vue'),
        meta: { title: '发布新帖' }
      },
      {
        path: 'forum/edit/:id',
        name: 'forum-edit',
        component: () => import('@/views/forum/EditPost.vue'),
        meta: { title: '编辑帖子' }
      },
      {
        path: 'report',
        name: 'report',
        component: () => import('@/views/ReportView.vue')
      },
      {
        path: 'profile',
        name: 'profile',
        component: () => import('@/views/ProfileView.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'notifications',
        name: 'notifications',
        component: () => import('@/views/NotificationListView.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'answer/:sessionId',
        name: 'DirectAnswer',
        component: () => import('@/views/pc/DirectAnswerView.vue'),
        meta: { title: '完整解答', requiresAuth: true }
      },
    ]
  }
]

// ===== 路由实例 =====
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue')
    },
    {
      path: '/courses',
      name: 'course-select',
      component: () => import('@/views/CourseSelectView.vue'),
      meta: { requiresAuth: true, requiresCourse: false }
    },
    ...(isMobile() ? mobileRoutes : pcRoutes)
  ]
})

// ===== 路由守卫 =====
router.beforeEach(async (to, from) => {
  // 记录导航方向（供 LayoutMobile 转场动画）
  recordNavigation(to.fullPath, from.fullPath)

  const userStore = useUserStore()

  // 登录页 — 已登录则跳转首页（触发课程分流）
  if (to.path === '/login') {
    if (userStore.isLoggedIn) return { path: '/' }
    return true
  }

  // 需要登录的页面
  if (!userStore.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  // ===== 课程上下文校验（选课分流） =====
  const profileStore = useProfileStore()
  if (profileStore.courses.length === 0) {
    await profileStore.initCourses()
  }

  const courseCount = profileStore.courses.length

  // 课程选择页特殊处理
  if (to.path === '/courses') {
    return true
  }

  // 其他页面需要课程上下文
  if (courseCount === 0) {
    return { path: '/courses' }
  }
  if (courseCount >= 2) {
    if (profileStore.activeCourseId) return true
    return { path: '/courses' }
  }
  // courseCount === 1，确保 activeCourseId 已设置
  if (!profileStore.activeCourseId) {
    profileStore.switchCourse(profileStore.courses[0])
  }

  return true
})

export default router
