<script setup lang="ts">
import { computed } from 'vue'
import { RESOURCE_TYPE_LABEL } from '@/constants'

const TYPE_COLOR: Record<string, string> = {
  doc: '#2B6FFF', mindmap: '#7C5CFC', quiz: '#FF8C42',
  reading: '#34C759', code: '#FF3B30', video: '#FF9F0A',
}

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: '入门', basic: '基础', intermediate: '中级', advanced: '高级', expert: '专家',
}

interface OfferItem { type: string; focus: string }

const props = defineProps<{
  offer: {
    type: 'resource' | 'plan'
    topic?: string
    goalSummary?: string
    difficulty?: string
    items?: OfferItem[]
    totalHours?: number
    focusAreas?: string[]
    coveredCount?: number
    confidence?: number
    requirementText?: string
    accepted?: boolean
    dismissed?: boolean
  }
  compact?: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  dismiss: []
}>()

const title = computed(() => props.offer.type === 'resource' ? 'AI 为你规划了以下学习方案' : 'AI 为你规划了以下学习路径')

const typeGroups = computed(() => {
  if (!props.offer.items) return []
  const map = new Map<string, OfferItem[]>()
  for (const item of props.offer.items) {
    if (!map.has(item.type)) map.set(item.type, [])
    map.get(item.type)!.push(item)
  }
  return [...map.entries()].map(([type, entries]) => ({
    type,
    label: RESOURCE_TYPE_LABEL[type] || type,
    color: TYPE_COLOR[type] || '#8E8EA0',
    count: entries.length,
    entries,
  }))
})

const totalCount = computed(() => {
  if (props.offer.items) return props.offer.items.length
  return 0
})

const isResource = computed(() => props.offer.type === 'resource')
const isInteractive = computed(() => !props.offer.accepted && !props.offer.dismissed)
</script>

<template>
  <div class="plan-offer-card" :class="{ 'is-compact': compact }">
    <!-- 头部 -->
    <div class="plan-offer-header">
      <div class="plan-offer-header-icon" :class="isResource ? 'icon-resource' : 'icon-plan'">
        <svg v-if="isResource" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 11 12 14 22 4"/>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
      </div>
      <div>
        <div class="plan-offer-title">{{ title }}</div>
      </div>
    </div>

    <!-- 主题信息卡片 — 资源类型 -->
    <div v-if="isResource" class="plan-offer-topic-card">
      <div class="plan-offer-topic">{{ offer.topic }}</div>
      <div v-if="offer.goalSummary" class="plan-offer-goal">{{ offer.goalSummary }}</div>
      <div class="plan-offer-meta-pills">
        <span v-if="offer.difficulty" class="plan-offer-pill pill-difficulty">
          {{ DIFFICULTY_LABEL[offer.difficulty] || offer.difficulty }}
        </span>
        <span v-if="totalCount" class="plan-offer-pill pill-count">
          共 {{ totalCount }} 份
        </span>
        <span v-if="offer.totalHours" class="plan-offer-pill pill-hours">
          约 {{ offer.totalHours }} 学时
        </span>
        <span v-if="offer.coveredCount != null" class="plan-offer-pill pill-profile">
          画像覆盖 {{ offer.coveredCount }}/7
        </span>
      </div>
    </div>

    <!-- 需求描述卡片 — 学习计划类型 -->
    <div v-else class="plan-offer-topic-card">
      <div class="plan-offer-topic">学习计划需求</div>
      <div class="plan-offer-goal">{{ offer.requirementText || '根据你的学习情况和目标制定个性化学习路径' }}</div>
      <div class="plan-offer-meta-pills">
        <span v-if="offer.coveredCount != null" class="plan-offer-pill pill-profile">
          画像覆盖 {{ offer.coveredCount }}/7
        </span>
      </div>
    </div>

    <!-- 执行计划 — 资源类型分组 -->
    <div v-if="isResource && typeGroups.length > 0" class="plan-offer-plan-section">
      <div class="plan-offer-plan-title">执行计划</div>

      <div class="plan-timeline">
        <div v-for="(group, gi) in typeGroups" :key="group.type" class="plan-timeline-group" :class="{ 'is-last': gi === typeGroups.length - 1 }">
          <!-- 类型头部 -->
          <div class="plan-timeline-type-header">
            <div class="plan-timeline-dot" :style="{ backgroundColor: group.color }"></div>
            <span class="plan-timeline-type-label" :style="{ color: group.color }">{{ group.label }}</span>
            <span class="plan-timeline-type-count">×{{ group.count }}</span>
          </div>
          <!-- 子项 -->
          <div class="plan-timeline-subs">
            <div v-for="(sub, si) in group.entries" :key="si" class="plan-timeline-sub">
              <div class="plan-timeline-sub-line" :class="{ 'is-last': si === group.entries.length - 1 }"></div>
              <span class="plan-timeline-sub-text">{{ sub.focus }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 重点领域 -->
    <div v-if="offer.focusAreas && offer.focusAreas.length > 0" class="plan-offer-focus">
      <span class="plan-offer-focus-label">重点领域</span>
      <div class="plan-offer-focus-tags">
        <span v-for="fa in offer.focusAreas" :key="fa" class="plan-offer-focus-tag">{{ fa }}</span>
      </div>
    </div>

    <!-- 操作区 -->
    <div v-if="isInteractive" class="plan-offer-actions">
      <button class="plan-offer-btn plan-offer-btn-primary" :disabled="loading" @click="emit('confirm')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        确认启动
      </button>
      <button class="plan-offer-btn plan-offer-btn-ghost" @click="emit('dismiss')">
        继续聊天
      </button>
    </div>

    <!-- 已确认状态 -->
    <div v-else-if="offer.accepted" class="plan-offer-actions">
      <div class="plan-offer-done-badge">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        已启动生成
      </div>
    </div>
  </div>
</template>

<style scoped>
.plan-offer-card {
  background: #F5F7FA;
  border-radius: 16px;
  padding: 24px;
  margin: 0;
  border-left: 3px solid var(--lt-brand);
}
.plan-offer-card.is-compact {
  padding: 16px;
}

/* 头部 */
.plan-offer-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.plan-offer-header-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.icon-resource {
  background: rgba(43, 111, 255, 0.1);
  color: var(--lt-brand);
}
.icon-plan {
  background: rgba(124, 92, 252, 0.1);
  color: var(--lt-ai);
}
.plan-offer-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--lt-text-primary);
}

/* 主题卡片 */
.plan-offer-topic-card {
  background: #fff;
  border: 1px solid var(--lt-border);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}
.plan-offer-topic {
  font-size: 16px;
  font-weight: 700;
  color: var(--lt-brand);
  margin-bottom: 6px;
}
.plan-offer-goal {
  font-size: 13px;
  color: var(--lt-text-secondary);
  line-height: 1.5;
  margin-bottom: 10px;
}
.plan-offer-meta-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.plan-offer-pill {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 20px;
  font-weight: 500;
}
.pill-difficulty {
  background: rgba(43, 111, 255, 0.08);
  color: var(--lt-brand);
}
.pill-count {
  background: rgba(255, 140, 66, 0.08);
  color: var(--lt-orange);
}
.pill-hours {
  background: rgba(124, 92, 252, 0.08);
  color: var(--lt-ai);
}
.pill-profile {
  background: rgba(52, 199, 89, 0.08);
  color: var(--lt-success);
}

/* 执行计划 */
.plan-offer-plan-section {
  margin-bottom: 16px;
}
.plan-offer-plan-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--lt-text-auxiliary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

/* 垂直时间线 */
.plan-timeline {
  position: relative;
}
.plan-timeline-group {
  position: relative;
  padding-bottom: 14px;
}
.plan-timeline-group.is-last {
  padding-bottom: 0;
}

/* 类型行头部 */
.plan-timeline-type-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.plan-timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.04);
}
.plan-timeline-type-label {
  font-size: 14px;
  font-weight: 600;
}
.plan-timeline-type-count {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  background: rgba(0, 0, 0, 0.04);
  padding: 1px 8px;
  border-radius: 10px;
}
.plan-timeline-stage-label {
  font-size: 11px;
  color: var(--lt-text-auxiliary);
  font-weight: 600;
  text-transform: uppercase;
}

/* 子项 */
.plan-timeline-subs {
  margin-left: 5px;
  padding-left: 22px;
  border-left: 2px solid #E8ECF0;
}
.plan-timeline-sub {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
  position: relative;
}
.plan-timeline-sub-text {
  font-size: 13px;
  color: var(--lt-text-secondary);
  line-height: 1.45;
}

/* 重点领域 */
.plan-offer-focus {
  margin-bottom: 16px;
}
.plan-offer-focus-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--lt-text-auxiliary);
  display: block;
  margin-bottom: 6px;
}
.plan-offer-focus-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.plan-offer-focus-tag {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 14px;
  background: rgba(124, 92, 252, 0.06);
  color: var(--lt-ai);
}

/* 按钮 */
.plan-offer-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}
.plan-offer-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  padding: 10px 20px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}
.plan-offer-btn-primary {
  background: var(--lt-brand);
  color: #fff;
}
.plan-offer-btn-primary:hover {
  background: var(--lt-brand-dark);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(43, 111, 255, 0.3);
}
.plan-offer-btn-ghost {
  background: transparent;
  color: var(--lt-text-auxiliary);
  font-weight: 500;
}
.plan-offer-btn-ghost:hover {
  color: var(--lt-text-secondary);
  background: rgba(0, 0, 0, 0.04);
}
.plan-offer-done-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--lt-success);
}
</style>
