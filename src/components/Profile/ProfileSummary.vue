<script setup lang="ts">
/**
 * L1 AI 摘要 + 版本号 + 更新时间。
 */
import { computed } from 'vue'
import { useProfileStore } from '@/stores/profile'

const profile = useProfileStore()

const summary = computed(() => profile.coreSummary)
const version = computed(() => profile.profileVersion)
const updatedAt = computed(() => profile.updatedAt)
</script>

<template>
  <div v-if="summary" class="summary-card">
    <div class="summary-head">
      <span class="summary-icon" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      </span>
      <span class="summary-title">画像摘要</span>
      <span class="summary-meta">{{ version }} · {{ updatedAt || '—' }}</span>
    </div>
    <p class="summary-body">{{ summary }}</p>
  </div>
</template>

<style scoped>
.summary-card {
  background: linear-gradient(135deg, rgba(124, 92, 252, 0.05), rgba(43, 111, 255, 0.04));
  border: 1px solid var(--lt-ai-light-7, rgba(124,92,252,0.2));
  border-radius: 12px;
  padding: 12px;
}
.summary-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  color: var(--lt-ai);
}
.summary-icon { display: inline-flex; align-items: center; }
.summary-title {
  font-size: 12px;
  font-weight: 600;
}
.summary-meta {
  margin-left: auto;
  font-size: 11px;
  color: var(--lt-text-auxiliary);
  font-variant-numeric: tabular-nums;
}
.summary-body {
  font-size: 13px;
  line-height: 1.6;
  color: var(--lt-text-secondary);
  margin: 0;
}
</style>
