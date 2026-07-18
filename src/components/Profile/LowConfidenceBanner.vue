<script setup lang="ts">
/**
 * 整体置信度低于水位时的全局横幅提示。
 * 详见 §3.6。
 */
import { WarningFilled } from '@element-plus/icons-vue'

defineProps<{
  confidencePercent: number
}>()
</script>

<template>
  <div class="low-conf-banner" role="status">
    <el-icon class="low-conf-icon" :size="14"><WarningFilled /></el-icon>
    <span class="low-conf-text">
      当前画像置信度 <b>{{ confidencePercent }}%</b>，仅供参考。建议补充对话以提升准确度。
    </span>
  </div>
</template>

<style scoped>
.low-conf-banner {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(255, 159, 10, 0.08);
  border: 1px solid var(--lt-warning, #FF9F0A);
  border-radius: 8px;
  color: var(--lt-warning, #FF9F0A);
  font-size: 12px;
  line-height: 1.5;
}
.low-conf-icon {
  flex-shrink: 0;
}
.low-conf-text b {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
</style>
