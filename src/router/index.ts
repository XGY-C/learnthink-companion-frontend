import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/components/Layout/MainLayout.vue'
import DashboardView from '@/views/DashboardView.vue'

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
          path: 'profile',
          name: 'profile',
          component: () => import('@/views/ProfileView.vue')
        },
        {
          path: 'studio',
          name: 'studio',
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

export default router
