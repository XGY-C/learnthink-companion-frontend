<script setup lang="ts">
/**
 * 移动端画像展示。
 *
 * 形态：
 *  - inline 模式（默认）：作为页面内一段内容直接渲染（用于 ProfileMobile 的"学习画像"Tab）
 *  - sheet 模式：BottomSheet 弹出（用于 ChatViewMobile 等需要随时唤起的场景）
 *
 * 内容与 ProfilePanel 保持一致，复用同 store getter 与同一组卡片组件，避免分支。
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useProfileStore } from '@/stores/profile'
import BottomSheet from '@/components/mobile/BottomSheet.vue'
import RadarOverview from './RadarOverview.vue'
import ProfileSummary from './ProfileSummary.vue'
import CoreLayerCard from './CoreLayerCard.vue'
import StyleLayerCard from './StyleLayerCard.vue'
import KnowledgeTreeCard from './KnowledgeTreeCard.vue'
import EmptyState from './EmptyState.vue'
import LowConfidenceBanner from './LowConfidenceBanner.vue'
import { RefreshRight } from '@element-plus/icons-vue'

const props = withDefaults(defineProps<{
  /** sheet 模式：v-model 控制 BottomSheet 显隐；inline 模式下忽略 */
  modelValue?: boolean
  /** 'sheet' = BottomSheet; 'inline' = 直接渲染（默认） */
  mode?: 'sheet' | 'inline'
  /** sheet 模式高度 */
  height?: 'medium' | 'large' | 'full'
}>(), {
  modelValue: false,
  mode: 'inline',
  height: 'large',
})

const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()

const profile = useProfileStore()
const router = useRouter()

const isEmpty = computed(() => profile.isEmpty)
const isLowConfidence = computed(() => profile.isLowConfidence)
const overall = computed(() => profile.overallConfidence)
const loadError = computed(() => profile.loadError)

function handleEmptyCta() {
  emit('update:modelValue', false)
  router.push('/chat')
}
function handleRetry() {
  profile.refreshProfile()
}

const sheetVisible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})
</script>

<template>
  <!-- sheet 模式：BottomSheet -->
  <BottomSheet
    v-if="mode === 'sheet'"
    v-model="sheetVisible"
    :height="height"
    title="学习画像"
  >
    <div class="ps-body">
      <div v-if="loadError && !isEmpty" class="ps-error-bar">
        <span>画像加载失败，显示的是上次缓存。</span>
        <el-button link type="primary" @click="handleRetry">
          <el-icon :size="13" class="mr-1"><RefreshRight /></el-icon>重试
        </el-button>
      </div>

      <EmptyState v-if="isEmpty" @cta="handleEmptyCta" />

      <template v-else>
        <LowConfidenceBanner v-if="isLowConfidence" :confidence-percent="overall" />
        <RadarOverview />
        <ProfileSummary />
        <CoreLayerCard />
        <StyleLayerCard />
        <KnowledgeTreeCard />
      </template>
    </div>
  </BottomSheet>

  <!-- inline 模式：直接渲染 -->
  <div v-else class="ps-inline">
    <div v-if="loadError && !isEmpty" class="ps-error-bar">
      <span>画像加载失败，显示的是上次缓存。</span>
      <el-button link type="primary" @click="handleRetry">
        <el-icon :size="13" class="mr-1"><RefreshRight /></el-icon>重试
      </el-button>
    </div>

    <EmptyState v-if="isEmpty" @cta="handleEmptyCta" />

    <template v-else>
      <LowConfidenceBanner v-if="isLowConfidence" :confidence-percent="overall" />
      <RadarOverview />
      <ProfileSummary />
      <CoreLayerCard />
      <StyleLayerCard />
      <KnowledgeTreeCard />
    </template>
  </div>
</template>

<style scoped>
.ps-body,
.ps-inline {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ps-body {
  padding: 4px 14px 16px;
}
.ps-error-bar {
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
