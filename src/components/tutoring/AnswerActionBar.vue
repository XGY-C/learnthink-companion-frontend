<script setup lang="ts">
import { ref } from 'vue'
import { useTutoringStore } from '@/stores/tutoring'
import { submitTutoringFeedback } from '@/api/tutoring'

const props = defineProps<{
  sessionId: string
  disabled?: boolean
}>()

const store = useTutoringStore()

const liked = ref(false)
const disliked = ref(false)
const copyTooltip = ref('')
const shareTooltip = ref('')

function toggleLike() {
  if (disliked.value) disliked.value = false
  liked.value = !liked.value
  submitTutoringFeedback(props.sessionId, {
    rating: liked.value ? 'like' : 'dislike',
  }).catch(() => {})
}

function toggleDislike() {
  if (liked.value) liked.value = false
  disliked.value = !disliked.value
  submitTutoringFeedback(props.sessionId, {
    rating: disliked.value ? 'dislike' : 'like',
  }).catch(() => {})
}

async function handleCopy() {
  const allContent = store.sectionList
    .map(s => `## ${s.title}\n\n${s.content}`)
    .join('\n\n---\n\n')
  try {
    await navigator.clipboard.writeText(allContent)
    copyTooltip.value = '已复制'
    setTimeout(() => { copyTooltip.value = '' }, 2000)
  } catch {
    copyTooltip.value = '复制失败'
    setTimeout(() => { copyTooltip.value = '' }, 2000)
  }
}

async function handleShare() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    shareTooltip.value = '链接已复制'
    setTimeout(() => { shareTooltip.value = '' }, 2000)
  } catch {
    shareTooltip.value = '复制失败'
    setTimeout(() => { shareTooltip.value = '' }, 2000)
  }
}
</script>

<template>
  <div class="answer-action-bar" :class="{ disabled }">
    <button
      class="action-item"
      :class="{ active: liked }"
      :disabled="disabled"
      @click="toggleLike"
    >
      👍 有帮助
    </button>
    <button
      class="action-item"
      :class="{ 'active-dislike': disliked }"
      :disabled="disabled"
      @click="toggleDislike"
    >
      👎 不准确
    </button>

    <div class="action-divider"></div>

    <div class="action-tooltip-wrap">
      <button class="action-item" :disabled="disabled" @click="handleCopy">
        📋 复制
      </button>
      <span v-if="copyTooltip" class="tooltip">{{ copyTooltip }}</span>
    </div>

    <div class="action-tooltip-wrap">
      <button class="action-item" :disabled="disabled" @click="handleShare">
        🔗 分享
      </button>
      <span v-if="shareTooltip" class="tooltip">{{ shareTooltip }}</span>
    </div>
  </div>
</template>

<style scoped>
.answer-action-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 0;
}
.answer-action-bar.disabled { opacity: 0.5; pointer-events: none; }

.action-item {
  font-size: 13px;
  color: var(--lt-text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 8px;
  transition: all 0.15s;
}
.action-item:hover:not(:disabled) {
  color: var(--lt-text-primary);
  background: var(--lt-bg-page);
}
.action-item.active {
  color: var(--lt-success);
  background: rgba(52, 199, 89, 0.08);
}
.action-item.active-dislike {
  color: var(--lt-danger);
  background: rgba(255, 59, 48, 0.08);
}

.action-divider {
  width: 1px;
  height: 16px;
  background: var(--lt-border);
}

.action-tooltip-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  color: #fff;
  background: var(--lt-text-primary);
  padding: 3px 8px;
  border-radius: 4px;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .answer-action-bar { gap: 8px; padding: 10px 0; }
  .action-item { font-size: 12px; padding: 5px 8px; }
  .action-divider { display: none; }
}
</style>
