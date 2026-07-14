<script setup lang="ts">
/**
 * "学习画像"Tab：复用 ProfilePanel 内容（去掉头部和侧边收起条），
 * 嵌入个人中心页中。详见 docs/画像展示设计方案_v2.md §六。
 */
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProfileStore } from '@/stores/profile'
import { RefreshRight } from '@element-plus/icons-vue'
import RadarOverview from '@/components/Profile/RadarOverview.vue'
import ProfileSummary from '@/components/Profile/ProfileSummary.vue'
import CoreLayerCard from '@/components/Profile/CoreLayerCard.vue'
import StyleLayerCard from '@/components/Profile/StyleLayerCard.vue'
import KnowledgeTreeCard from '@/components/Profile/KnowledgeTreeCard.vue'
import EmptyState from '@/components/Profile/EmptyState.vue'
import LowConfidenceBanner from '@/components/Profile/LowConfidenceBanner.vue'

const profile = useProfileStore()
const router = useRouter()

const isEmpty = computed(() => profile.isEmpty)
const isLowConfidence = computed(() => profile.isLowConfidence)
const overall = computed(() => profile.overallConfidence)
const loadError = computed(() => profile.loadError)
const versionText = computed(() => profile.profileVersion)
const updatedText = computed(() => profile.updatedAt)
const courseLabel = computed(() => profile.activeCourse?.name ?? '')

function handleEmptyCta() {
  router.push('/chat')
}
function handleRefresh() {
  profile.refreshProfile()
}

onMounted(() => {
  // 进入 Tab 时如果尚未加载过画像，主动拉一次
  if (profile.activeCourseId && !profile.fullProfile) {
    profile.refreshProfile()
  }
})
</script>

<template>
  <div class="lp-tab">
    <!-- 头部信息条 -->
    <div class="lp-head">
      <div class="lp-head-text">
        <h3 class="lp-head-title">学习画像</h3>
        <p class="lp-head-sub">
          <span v-if="courseLabel">{{ courseLabel }} · </span>
          <span>{{ updatedText || '尚未生成' }}</span>
        </p>
      </div>
      <div class="lp-head-action">
        <el-tag size="small" type="info" effect="plain">{{ versionText }}</el-tag>
        <el-button link @click="handleRefresh">
          <el-icon :size="14"><RefreshRight /></el-icon>
        </el-button>
      </div>
    </div>

    <div v-if="loadError && !isEmpty" class="lp-error-bar">
      <span>画像加载失败，显示的是上次缓存。</span>
      <el-button link type="primary" @click="handleRefresh">
        <el-icon :size="13" class="mr-1"><RefreshRight /></el-icon>重试
      </el-button>
    </div>

    <EmptyState v-if="isEmpty" @cta="handleEmptyCta" />

    <div v-else class="lp-stack">
      <LowConfidenceBanner v-if="isLowConfidence" :confidence-percent="overall" />
      <RadarOverview />
      <ProfileSummary />
      <CoreLayerCard />
      <StyleLayerCard />
      <KnowledgeTreeCard />
    </div>
  </div>
</template>

<style scoped>
.lp-tab {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.lp-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.lp-head-text {
  min-width: 0;
}
.lp-head-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--lt-text-primary);
  margin: 0;
}
.lp-head-sub {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  margin: 2px 0 0;
}
.lp-head-action {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.lp-error-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: rgba(255,59,48,0.06);
  border: 1px solid rgba(255,59,48,0.2);
  border-radius: 8px;
  font-size: 12px;
  color: var(--lt-danger);
}
.lp-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
