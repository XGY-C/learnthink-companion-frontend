<script setup lang="ts">
/**
 * 学习画像面板（PC / 桌面）。
 *
 * 五层信息层级（详见 docs/画像展示设计方案_v2.md）：
 *   L1 概览：RadarOverview + ProfileSummary
 *   L2 核心：CoreLayerCard
 *   L3 风格：StyleLayerCard
 *   L4 知识：KnowledgeTreeCard
 *   L5 演进：Phase 3 实现，本轮占位
 *
 * 状态分支：空态 / 加载错误（stale-while-error）/ 低置信整体提示 / 正常。
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useProfileStore } from '@/stores/profile'
import { DArrowLeft, DArrowRight, RefreshRight } from '@element-plus/icons-vue'
import RadarOverview from './RadarOverview.vue'
import ProfileSummary from './ProfileSummary.vue'
import CoreLayerCard from './CoreLayerCard.vue'
import StyleLayerCard from './StyleLayerCard.vue'
import KnowledgeTreeCard from './KnowledgeTreeCard.vue'
import EmptyState from './EmptyState.vue'
import LowConfidenceBanner from './LowConfidenceBanner.vue'

defineProps<{ collapsed?: boolean }>()
const emit = defineEmits<{ toggle: [] }>()

const profile = useProfileStore()
const router = useRouter()

const versionText = computed(() => profile.profileVersion)
const updatedText = computed(() => profile.updatedAt)
const isEmpty = computed(() => profile.isEmpty)
const isLowConfidence = computed(() => profile.isLowConfidence)
const overall = computed(() => profile.overallConfidence)
const loadError = computed(() => profile.loadError)

function handleEmptyCta() {
  router.push('/chat')
}
function handleRetry() {
  profile.refreshProfile()
}
</script>

<template>
  <!-- 收起态：右侧细条 -->
  <div
    v-if="collapsed"
    class="pp-collapsed"
    @click="emit('toggle')"
  >
    <span class="pp-collapsed-label">学习画像</span>
    <div class="pp-collapsed-foot">
      <el-tag size="small" type="info" effect="plain" class="!text-[10px] !px-0.5">{{ versionText }}</el-tag>
      <el-icon :size="14" class="pp-collapsed-icon"><DArrowLeft /></el-icon>
    </div>
  </div>

  <!-- 展开态：完整面板 -->
  <div v-else class="pp-panel">
    <!-- 头部 -->
    <div class="pp-head">
      <div class="pp-head-row">
        <h2 class="pp-head-title">学习画像</h2>
        <el-button link class="!p-1 !min-w-0" @click="emit('toggle')">
          <el-icon :size="16" style="color: var(--lt-text-placeholder);"><DArrowRight /></el-icon>
        </el-button>
      </div>
      <div class="pp-head-meta">
        <p class="pp-head-time">{{ updatedText || '尚未生成' }}</p>
        <el-tag size="small" type="info" effect="plain">{{ versionText }}</el-tag>
      </div>
    </div>

    <div class="pp-body">
      <!-- stale-while-error：有数据时不阻塞展示，仅显示重试条 -->
      <div v-if="loadError && !isEmpty" class="pp-error-bar">
        <span>画像加载失败，显示的是上次缓存。</span>
        <el-button link type="primary" @click="handleRetry">
          <el-icon :size="13" class="mr-1"><RefreshRight /></el-icon>重试
        </el-button>
      </div>

      <!-- 空态 -->
      <EmptyState
        v-if="isEmpty"
        @cta="handleEmptyCta"
      />

      <template v-else>
        <!-- 整体置信度过低提示 -->
        <LowConfidenceBanner
          v-if="isLowConfidence"
          :confidence-percent="overall"
        />

        <!-- L1: 雷达图 -->
        <RadarOverview />

        <!-- L1: AI 摘要 -->
        <ProfileSummary />

        <!-- L2: 核心层 -->
        <CoreLayerCard />

        <!-- L3: 风格层 -->
        <StyleLayerCard />

        <!-- L4: 知识层 -->
        <KnowledgeTreeCard />

        <!-- L5: Phase 3 占位（避免抢眼，仅在桌面端显示） -->
        <!-- TODO(Phase3): 接入 ProfileTimeline 与 VersionDiff -->
      </template>
    </div>
  </div>
</template>

<style scoped>
/* ===== 收起态 ===== */
.pp-collapsed {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  cursor: pointer;
  height: 100%;
  width: 36px;
  background-color: var(--lt-bg-card);
  border-left: 1px solid var(--lt-border);
  transition: background-color 0.15s;
}
.pp-collapsed:hover {
  background-color: var(--lt-brand-lightest);
}
.pp-collapsed-label {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.05em;
  writing-mode: vertical-rl;
  color: var(--lt-text-auxiliary);
}
.pp-collapsed:hover .pp-collapsed-label,
.pp-collapsed:hover .pp-collapsed-icon {
  color: var(--lt-brand);
}
.pp-collapsed-foot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.pp-collapsed-icon {
  color: var(--lt-text-placeholder);
}

/* ===== 展开态 ===== */
.pp-panel {
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100%;
  background-color: var(--lt-bg-card);
  border-left: 1px solid var(--lt-border);
}
.pp-head {
  padding: 14px 16px;
  border-bottom: 1px solid var(--lt-border);
}
.pp-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.pp-head-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--lt-text-primary);
  margin: 0;
}
.pp-head-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}
.pp-head-time {
  font-size: 11px;
  color: var(--lt-text-auxiliary);
  margin: 0;
}
.pp-body {
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}
.pp-error-bar {
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
</style>
