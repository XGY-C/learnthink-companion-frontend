<script setup lang="ts">
/**
 * 维度级置信度徽章。
 * 三档语义见 §4.1：
 *   高 (≥0.85)：实心、不带 tooltip
 *   中 (0.6-0.84)：虚线边框、hover 提示"系统推断"
 *   低 (<0.6)：问号 + 闪烁，hover 提示"置信度较低"
 */
import { computed } from 'vue'
import { BADGE_CONFIDENCE } from '@/constants/profile'

const props = defineProps<{
  confidence: number
  source?: 'explicit' | 'inferred' | string
}>()

const level = computed<'high' | 'medium' | 'low'>(() => {
  if (props.confidence >= BADGE_CONFIDENCE.HIGH) return 'high'
  if (props.confidence >= BADGE_CONFIDENCE.MEDIUM) return 'medium'
  return 'low'
})

const displayValue = computed(() => `${Math.round(props.confidence * 100)}%`)

const tooltipText = computed(() => {
  if (level.value === 'low') return `置信度较低（${displayValue.value}），该信息可能不准确`
  if (props.source === 'inferred') return `该信息来自系统推断（置信度 ${displayValue.value}）`
  return `置信度 ${displayValue.value}`
})
</script>

<template>
  <el-tooltip
    :content="tooltipText"
    placement="top"
    :disabled="level === 'high' && source !== 'inferred'"
  >
    <span
      class="conf-badge"
      :class="`conf-${level}`"
      role="status"
      :aria-label="`置信度 ${displayValue}`"
    >
      <span v-if="level === 'low'" class="conf-icon">?</span>
      <span class="conf-value">{{ displayValue }}</span>
    </span>
  </el-tooltip>
</template>

<style scoped>
.conf-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  font-variant-numeric: tabular-nums;
}

.conf-high {
  background-color: var(--lt-success-light-9, rgba(34,197,94,0.1));
  color: var(--lt-success);
  border: 1px solid transparent;
}

.conf-medium {
  background-color: transparent;
  color: var(--lt-warning);
  border: 1px dashed var(--lt-warning);
  opacity: 0.85;
}

.conf-low {
  background-color: rgba(255, 59, 48, 0.06);
  color: var(--lt-danger);
  border: 1px solid var(--lt-danger);
  animation: confLowPulse 2s ease-in-out infinite;
}

.conf-icon {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: currentColor;
  color: var(--lt-bg-card);
  font-size: 9px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

@keyframes confLowPulse {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
}
</style>
