<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { User, Lock, Timer, Document, Medal, SwitchButton, DataAnalysis, ChatDotSquare } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { useProfileStore } from '@/stores/profile'
import { useAuth } from '@/composables/useAuth'
import { apiFetch } from '@/utils/api'
import type { LearningStats } from '@/types'
import ProfileInfoTab from './profile/ProfileInfoTab.vue'
import SecurityTab from './profile/SecurityTab.vue'
import LearningProfileTab from './profile/LearningProfileTab.vue'
import ForumActivityTab from './profile/ForumActivityTab.vue'

const userStore = useUserStore()
const profileStore = useProfileStore()
const { logout } = useAuth()
const route = useRoute()
const router = useRouter()
const activeTab = ref((route.query.tab as string) || 'info')
const isSmallScreen = ref(false)

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
  } catch {
    // 静默失败，不展示统计区
  }
}

async function handleLogout() {
  await logout()
  router.push('/login')
}

function checkScreen() {
  isSmallScreen.value = window.innerWidth < 768
}

onMounted(() => {
  checkScreen()
  window.addEventListener('resize', checkScreen)
  fetchStats()
})

onUnmounted(() => {
  window.removeEventListener('resize', checkScreen)
})
</script>

<template>
  <div class="profile-container h-full overflow-y-auto">
    <div class="max-w-4xl mx-auto p-6">
      <!-- 欢迎横幅 -->
      <div
        class="rounded-xl p-5 mb-6 flex items-center gap-4 welcome-banner"
        style="background: linear-gradient(135deg, var(--lt-brand-lightest) 0%, rgba(124, 92, 252, 0.06) 100%); border: 1px solid var(--lt-brand-light-7);"
      >
        <!-- 头像 -->
        <div class="flex-shrink-0">
          <el-avatar
            :size="56"
            :src="avatarUrl"
            class="banner-avatar"
            style="background: linear-gradient(135deg, var(--lt-brand), var(--lt-brand-dark)); font-size: 22px;"
          >
            {{ displayName.charAt(0) }}
          </el-avatar>
        </div>

        <!-- 问候文字 -->
        <div class="flex-1 min-w-0">
          <p class="greeting-line">
            <span
              class="greeting-dot inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
              :style="{ backgroundColor: greeting.color }"
            />
            <span class="text-lg font-semibold" style="color: var(--lt-text-primary);">
              {{ greeting.text }}，{{ displayName }}
            </span>
          </p>
          <p class="text-xs mt-0.5" style="color: var(--lt-text-auxiliary);">
            {{ userMajor ? userMajor + ' · ' : '' }}欢迎回到你的学习空间
          </p>
        </div>

        <!-- 统计卡片（大屏展示） -->
        <div v-if="statChips.length > 0 && !isSmallScreen" class="stat-chips-row flex-shrink-0 hidden md:flex items-center gap-3">
          <div
            v-for="(chip, idx) in statChips"
            :key="chip.label"
            class="stat-chip text-center px-4 py-2 rounded-lg"
            :style="{
              animationDelay: (0.1 + idx * 0.08) + 's',
              backgroundColor: 'var(--lt-bg-card)',
              border: '1px solid var(--lt-border)',
            }"
          >
            <el-icon :size="14" :style="{ color: chip.color }"><component :is="chip.icon" /></el-icon>
            <p class="stat-value" style="color: var(--lt-text-primary);">
              {{ chip.value }}<span class="stat-unit">{{ chip.unit }}</span>
            </p>
            <p class="text-xs mt-0.5" style="color: var(--lt-text-auxiliary);">{{ chip.label }}</p>
          </div>
        </div>
      </div>

      <!-- 小屏统计区：横幅下方横排展示 -->
      <div v-if="statChips.length > 0 && isSmallScreen" class="stat-chips-row-mobile flex gap-3 mb-6">
        <div
          v-for="(chip, idx) in statChips"
          :key="chip.label"
          class="stat-chip flex-1 text-center px-3 py-3 rounded-lg"
          :style="{
            animationDelay: (0.1 + idx * 0.08) + 's',
            backgroundColor: 'var(--lt-bg-card)',
            border: '1px solid var(--lt-border)',
          }"
        >
          <el-icon :size="14" :style="{ color: chip.color }"><component :is="chip.icon" /></el-icon>
          <p class="stat-value" style="color: var(--lt-text-primary);">
            {{ chip.value }}<span class="stat-unit">{{ chip.unit }}</span>
          </p>
          <p class="text-xs mt-0.5" style="color: var(--lt-text-auxiliary);">{{ chip.label }}</p>
        </div>
      </div>

      <!-- 内容卡片 -->
      <el-card class="!rounded-xl" style="border: 1px solid var(--lt-border); box-shadow: var(--lt-shadow-card);">
        <!-- 小屏：顶部横向 Tab -->
        <template v-if="isSmallScreen">
          <el-tabs v-model="activeTab" class="profile-tabs-horizontal">
            <el-tab-pane name="info" label="个人信息" />
            <el-tab-pane name="learning_profile" label="学习画像" />
            <el-tab-pane name="forum_activity" label="我的论坛" />
            <el-tab-pane name="security" label="账号安全" />
          </el-tabs>
          <div class="p-4">
            <ProfileInfoTab v-if="activeTab === 'info'" />
            <LearningProfileTab v-else-if="activeTab === 'learning_profile'" />
            <ForumActivityTab v-else-if="activeTab === 'forum_activity'" />
            <SecurityTab v-else-if="activeTab === 'security'" />
          </div>
        </template>

        <!-- 大屏：左侧纵向 Tab + 右侧内容 -->
        <template v-else>
          <div class="flex">
            <div class="flex-shrink-0 border-r pt-3" style="width: 180px; border-color: var(--lt-border);">
              <div class="h-0.5 rounded-full mx-4 mb-2" style="background: linear-gradient(90deg, var(--lt-brand), var(--lt-ai), var(--lt-orange));" />
              <el-tabs
                v-model="activeTab"
                tab-position="left"
                class="profile-tabs"
              >
                <el-tab-pane name="info">
                  <template #label>
                    <span class="flex items-center gap-2">
                      <el-icon :size="16"><User /></el-icon>
                      个人信息
                    </span>
                  </template>
                </el-tab-pane>
                <el-tab-pane name="learning_profile">
                  <template #label>
                    <span class="flex items-center gap-2">
                      <el-icon :size="16"><DataAnalysis /></el-icon>
                      学习画像
                    </span>
                  </template>
                </el-tab-pane>
                <el-tab-pane name="forum_activity">
                  <template #label>
                    <span class="flex items-center gap-2">
                      <el-icon :size="16"><ChatDotSquare /></el-icon>
                      我的论坛
                    </span>
                  </template>
                </el-tab-pane>
                <el-tab-pane name="security">
                  <template #label>
                    <span class="flex items-center gap-2">
                      <el-icon :size="16"><Lock /></el-icon>
                      账号安全
                    </span>
                  </template>
                </el-tab-pane>
              </el-tabs>
            </div>

            <div class="flex-1 min-w-0 p-6">
              <ProfileInfoTab v-if="activeTab === 'info'" />
              <LearningProfileTab v-else-if="activeTab === 'learning_profile'" />
              <ForumActivityTab v-else-if="activeTab === 'forum_activity'" />
              <SecurityTab v-else-if="activeTab === 'security'" />
            </div>
          </div>
        </template>
      </el-card>

      <!-- 移动端：退出登录 -->
      <div v-if="isSmallScreen" class="mt-6">
        <el-button
          class="w-full !rounded-xl"
          size="large"
          @click="handleLogout"
        >
          <el-icon :size="16" class="mr-1"><SwitchButton /></el-icon>
          退出登录
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-container {
  background: transparent;
}

/* ========== 欢迎横幅 ========== */
.banner-avatar {
  box-shadow: 0 2px 12px rgba(43, 111, 255, 0.15);
}

.greeting-dot {
  animation: dotPulse 2s ease-in-out infinite;
}

/* ========== 统计芯片 ========== */
.stat-chip {
  opacity: 0;
  transform: translateY(6px);
  animation: chipFadeIn 0.4s ease-out forwards;
  min-width: 80px;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.stat-chip:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  transform: translateY(-2px);
}

.stat-value {
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
}

.stat-unit {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--lt-text-auxiliary);
  margin-left: 1px;
}

.stat-chips-row-mobile .stat-chip {
  min-width: 0;
}

/* ========== 动画关键帧 ========== */
@keyframes chipFadeIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes dotPulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

/* ========== 大屏：左侧纵向 Tab ========== */
:deep(.profile-tabs .el-tabs__item) {
  padding: 12px 16px !important;
  font-size: 0.9rem;
  color: var(--lt-text-secondary);
  height: auto;
  line-height: 1.5;
  border-radius: 6px;
  margin: 2px 4px;
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

:deep(.profile-tabs .el-tabs__item:hover) {
  color: var(--lt-brand);
  background-color: var(--lt-brand-lightest);
}

:deep(.profile-tabs .el-tabs__item.is-active) {
  color: var(--lt-brand);
  font-weight: 600;
  background-color: var(--lt-brand-lightest);
}

:deep(.profile-tabs .el-tabs__active-bar) {
  background-color: var(--lt-brand);
}

:deep(.profile-tabs .el-tabs__header) {
  margin-right: 0;
}

/* ========== 小屏：顶部横向 Tab ========== */
:deep(.profile-tabs-horizontal .el-tabs__nav-wrap::after) {
  height: 1px;
  background-color: var(--lt-border);
}

:deep(.profile-tabs-horizontal .el-tabs__item) {
  font-size: 0.85rem;
  color: var(--lt-text-secondary);
  padding: 0 14px !important;
  transition: color 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

:deep(.profile-tabs-horizontal .el-tabs__item.is-active) {
  color: var(--lt-brand);
  font-weight: 600;
}

:deep(.profile-tabs-horizontal .el-tabs__active-bar) {
  background-color: var(--lt-brand);
}

/* ========== 响应式断点 ========== */
@media (max-width: 767px) {
  .profile-container :deep(.max-w-4xl) {
    padding: 12px;
  }

  .welcome-banner {
    flex-wrap: wrap;
  }
}
</style>
