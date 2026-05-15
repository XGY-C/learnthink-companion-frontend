import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/components/Layout/MainLayout.vue'
import DashboardView from '@/views/DashboardView.vue'
import { useUserStore } from '@/stores/user'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue')
    },
    {
      path: '/',
      component: MainLayout,
      children: [
        {
          path: '',
          name: 'dashboard',
          component: DashboardView
        },
        {
          path: 'chat',
          name: 'chat',
          component: () => import('@/views/ChatView.vue')
        },
        {
          path: 'studio',
          name: 'studio',
          component: () => import('@/views/StudioTaskList.vue')
        },
        {
          path: 'studio/:taskId',
          name: 'studio-detail',
          component: () => import('@/views/StudioView.vue')
        },
        {
          path: 'path',
          name: 'path',
          component: () => import('@/views/PathView.vue')
        },
        {
          path: 'practice',
          name: 'practice',
          component: () => import('@/views/PracticeView.vue')
        },
        {
          path: 'library',
          name: 'library',
          component: () => import('@/views/LibraryView.vue')
        }
      ]
    }
  ]
})

router.beforeEach((to) => {
  const userStore = useUserStore()

  // 登录页不需要鉴权
  if (to.path === '/login') {
    if (userStore.isLoggedIn) return { path: '/' }
    return true
  }

  // 其他页面需要登录
  if (!userStore.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  return true
})

export default router
