import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useProfileStore } from '@/stores/profile'
import { isMobile } from '@/utils/device'

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
        meta: { title: '学习' }
      },
      {
        path: 'code',
        name: 'code-learn-m',
        component: () => import('@/views/CodeLearnView.vue'),
        meta: { title: '代码学习' }
      },
      {
        path: 'library',
        name: 'library-m',
        component: () => import('@/views/mobile/LibraryMobile.vue'),
        meta: { title: '资源库' }
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
router.beforeEach(async (to) => {
  const userStore = useUserStore()

  // 登录页 — 已登录则跳转首页
  if (to.path === '/login') {
    if (userStore.isLoggedIn) return { path: '/' }
    return true
  }

  // 需要登录的页面
  if (!userStore.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  // 需要课程上下文的页面 — 检查是否有已选课程
  if (to.meta.requiresCourse !== false && to.path !== '/courses') {
    const profileStore = useProfileStore()
    // 如果课程列表尚未加载，先初始化
    if (profileStore.courses.length === 0) {
      await profileStore.initCourses()
    }
    // 确实没有已选课程 → 引导至选课页
    if (profileStore.courses.length === 0) {
      return { path: '/courses' }
    }
    // 有课程但未设置 activeCourseId
    if (!profileStore.activeCourseId) {
      profileStore.switchCourse(profileStore.courses[0])
    }
  }

  return true
})

export default router
