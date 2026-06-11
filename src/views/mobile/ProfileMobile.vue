<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { User, Bell, Lock, Timer, Document, Medal, SwitchButton } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { useProfileStore } from '@/stores/profile'
import { useAuth } from '@/composables/useAuth'
import { apiFetch } from '@/utils/api'
import type { LearningStats } from '@/types'
import ProfileInfoTab from '@/views/profile/ProfileInfoTab.vue'
import NotificationTab from '@/views/profile/NotificationTab.vue'
import SecurityTab from '@/views/profile/SecurityTab.vue'

const userStore = useUserStore()
const profileStore = useProfileStore()
const { logout } = useAuth()
const route = useRoute()
const router = useRouter()
const activeTab = ref((route.query.tab as string) || 'info')

const displayName = computed(() =>
  userStore.userInfo?.displayName || userStore.userInfo?.username || '同学'
)
const avatarUrl = computed(() => userStore.userInfo?.avatarUrl || '')
const userMajor = computed(() => userStore.userInfo?.major || '')

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return { text: '夜深了', color: 'var(--lt-ai)' }
  if (hour < 12) return { text: '早上好', color: 'var(--lt-orange)' }
  if (hour < 18) return { text: '下午好', color: 'var(--lt-brand)' }
  return { text: '晚上好', color: 'var(--lt-ai)' }
})

const stats = ref<LearningStats | null>(null)

const statChips = computed(() => {
  if (!stats.value) return []
  return [
    { label: '本周学时', value: stats.value.weekHours, unit: 'h', icon: Timer, color: 'var(--lt-brand)' },
    { label: '累计资源', value: stats.value.resourcePackCount, unit: '个', icon: Document, color: 'var(--lt-success)' },
    { label: '路径进度', value: stats.value.pathProgressPercent, unit: '%', icon: Medal, color: 'var(--lt-orange)' },
  ]
})

async function fetchStats() {
  if (!profileStore.activeCourseId) return
  try {
    const res = await apiFetch<LearningStats>(
      `/user/me/stats?courseId=${encodeURIComponent(profileStore.activeCourseId)}`
    )
    stats.value = res.data
  } catch { /* silent */ }
}

async function handleLogout() {
  await logout()
  router.push('/login')
}

const tabs = [
  { name: 'info', label: '个人信息', icon: User },
  { name: 'notifications', label: '消息通知', icon: Bell },
  { name: 'security', label: '账号安全', icon: Lock },
]

onMounted(() => { fetchStats() })
</script>

<template>
  <div class="m-profile">
    <!-- 欢迎横幅 -->
    <div class="m-profile-banner">
      <div class="m-banner-top">
        <el-avatar
          :size="48"
          :src="avatarUrl"
          class="m-banner-avatar"
          style="background: linear-gradient(135deg, var(--lt-brand), var(--lt-brand-dark)); font-size: 20px;"
        >
          {{ displayName.charAt(0) }}
        </el-avatar>
        <div class="m-banner-text">
          <p class="m-banner-greeting">
            <span class="m-greeting-dot" :style="{ backgroundColor: greeting.color }" />
            {{ greeting.text }}，{{ displayName }}
          </p>
          <p class="m-banner-sub">{{ userMajor ? userMajor + ' · ' : '' }}欢迎回到你的学习空间</p>
        </div>
      </div>
      <!-- 统计芯片 -->
      <div v-if="statChips.length > 0" class="m-stat-chips">
        <div v-for="(chip, idx) in statChips" :key="chip.label" class="m-stat-chip" :style="{ animationDelay: (0.1 + idx * 0.08) + 's' }">
          <el-icon :size="14" :style="{ color: chip.color }"><component :is="chip.icon" /></el-icon>
          <p class="m-chip-value">{{ chip.value }}<span class="m-chip-unit">{{ chip.unit }}</span></p>
          <p class="m-chip-label">{{ chip.label }}</p>
        </div>
      </div>
    </div>

    <!-- Tab 内容卡片 -->
    <div class="m-profile-card">
      <!-- 横向滑动 Tab -->
      <div class="m-tab-bar">
        <button
          v-for="tab in tabs" :key="tab.name"
          class="m-tab-btn"
          :class="{ active: activeTab === tab.name }"
          @click="activeTab = tab.name"
        >
          <el-icon :size="16"><component :is="tab.icon" /></el-icon>
          {{ tab.label }}
        </button>
      </div>
      <div class="m-tab-content">
        <ProfileInfoTab v-if="activeTab === 'info'" />
        <NotificationTab v-else-if="activeTab === 'notifications'" />
        <SecurityTab v-else-if="activeTab === 'security'" />
      </div>
    </div>

    <!-- 退出登录 -->
    <div class="m-logout-wrap">
      <button class="m-logout-btn" @click="handleLogout">
        <el-icon :size="16"><SwitchButton /></el-icon>
        退出登录
      </button>
    </div>
  </div>
</template>

<style scoped>
.m-profile {
  padding: 16px;
  background: var(--lt-bg-page);
  min-height: 100%;
}

/* ===== Banner ===== */
.m-profile-banner {
  background: linear-gradient(135deg, var(--lt-brand-lightest) 0%, rgba(124,92,252,0.06) 100%);
  border: 1px solid var(--lt-brand-lighter);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}
.m-banner-top { display: flex; align-items: center; gap: 12px; }
.m-banner-avatar { flex-shrink: 0; box-shadow: 0 2px 12px rgba(43,111,255,0.15); }
.m-banner-text { min-width: 0; }
.m-banner-greeting { font-size: 17px; font-weight: 600; color: var(--lt-text-primary); margin: 0; display: flex; align-items: center; gap: 6px; }
.m-greeting-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
.m-banner-sub { font-size: 12px; color: var(--lt-text-auxiliary); margin: 2px 0 0; }

/* ===== Stat chips ===== */
.m-stat-chips { display: flex; gap: 10px; margin-top: 12px; }
.m-stat-chip {
  flex: 1; text-align: center; padding: 10px 6px;
  background: var(--lt-bg-card); border: 1px solid var(--lt-border); border-radius: 10px;
  opacity: 0; transform: translateY(6px);
  animation: chipFadeIn 0.4s ease-out forwards;
}
.m-chip-value { font-size: 18px; font-weight: 700; color: var(--lt-text-primary); margin: 4px 0 0; line-height: 1.2; }
.m-chip-unit { font-size: 11px; font-weight: 400; color: var(--lt-text-auxiliary); }
.m-chip-label { font-size: 11px; color: var(--lt-text-auxiliary); margin: 2px 0 0; }

@keyframes chipFadeIn { to { opacity: 1; transform: translateY(0); } }

/* ===== Tab card ===== */
.m-profile-card {
  background: var(--lt-bg-card); border: 1px solid var(--lt-border); border-radius: 12px;
  overflow: hidden; margin-bottom: 16px;
}
.m-tab-bar {
  display: flex; gap: 0; border-bottom: 1px solid var(--lt-border);
  overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none;
}
.m-tab-bar::-webkit-scrollbar { display: none; }
.m-tab-btn {
  flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 4px;
  padding: 12px 8px; border: none; background: transparent;
  font-size: 13px; color: var(--lt-text-secondary); cursor: pointer;
  touch-action: manipulation; white-space: nowrap; transition: color 0.15s;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.m-tab-btn.active { color: var(--lt-brand); font-weight: 600; border-bottom-color: var(--lt-brand); }
.m-tab-btn:active:not(.active) { color: var(--lt-brand); }
.m-tab-content { padding: 16px; }

/* ===== Logout ===== */
.m-logout-wrap { margin-bottom: 24px; }
.m-logout-btn {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 14px; border: 1px solid var(--lt-border); border-radius: 12px;
  background: var(--lt-bg-card); color: var(--lt-text-secondary); font-size: 15px;
  cursor: pointer; touch-action: manipulation;
}
.m-logout-btn:active { background: rgba(255,59,48,0.04); border-color: rgba(255,59,48,0.2); color: var(--lt-danger); }
</style>
