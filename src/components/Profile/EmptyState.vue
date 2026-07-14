<script setup lang="ts">
/**
 * 画像空态：首次进入或全维度未采集。
 */
import { ChatLineRound } from '@element-plus/icons-vue'

withDefaults(defineProps<{
  title?: string
  description?: string
  ctaLabel?: string
}>(), {
  title: '画像建设中',
  description: '多聊几句让 AI 了解你，画像会自动生成',
  ctaLabel: '开始对话',
})

const emit = defineEmits<{ cta: [] }>()
</script>

<template>
  <div class="profile-empty">
    <div class="profile-empty-icon">
      <el-icon :size="32"><ChatLineRound /></el-icon>
    </div>
    <p class="profile-empty-title">{{ title }}</p>
    <p class="profile-empty-desc">{{ description }}</p>
    <el-button
      type="primary"
      class="profile-empty-cta"
      @click="emit('cta')"
    >
      {{ ctaLabel }}
    </el-button>
  </div>
</template>

<style scoped>
.profile-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 36px 24px;
  text-align: center;
  background: var(--lt-bg-page);
  border: 1px dashed var(--lt-border);
  border-radius: 12px;
}
.profile-empty-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
  margin-bottom: 12px;
}
.profile-empty-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--lt-text-primary);
  margin: 0 0 6px;
}
.profile-empty-desc {
  font-size: 13px;
  color: var(--lt-text-auxiliary);
  margin: 0 0 16px;
  line-height: 1.6;
}
.profile-empty-cta {
  border-radius: 8px;
}
</style>
