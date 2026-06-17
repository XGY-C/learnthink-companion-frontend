<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTutoringStore } from '@/stores/tutoring'
import { useProfileStore } from '@/stores/profile'

const props = withDefaults(defineProps<{
  courseName?: string
  chapterLabel?: string
  knowledgeBase?: string
  weakPoints?: string[]
}>(), {
  courseName: undefined,
  chapterLabel: undefined,
  knowledgeBase: undefined,
  weakPoints: () => [],
})

const store = useTutoringStore()
const profileStore = useProfileStore()
const expanded = ref(false)

const resourceText = computed(() => {
  if (store.resources) {
    const r = store.resources
    let text = `已准备 ${r.resolvedCount} 份资料`
    if (r.unavailableCount > 0) {
      text += `（${r.unavailableCount} 份缺失）`
    }
    return text
  }
  if (store.resourceCount > 0) {
    return `正在准备 ${store.resourceCount} 个资料源...`
  }
  return null
})

const hasWarning = computed(() =>
  store.resources ? store.resources.unavailableCount > 0 : false
)
</script>

<template>
  <div class="context-bar" @click="expanded = !expanded">
    <div class="context-main">
      <span v-if="chapterLabel" class="context-item">
        📍 当前章节: {{ chapterLabel }}
      </span>
      <span v-if="knowledgeBase" class="context-item">
        知识基础: {{ knowledgeBase }}
      </span>
      <span v-if="weakPoints && weakPoints.length > 0" class="context-item">
        薄弱点: {{ weakPoints.join(', ') }}
      </span>
    </div>

    <div class="context-resource">
      <template v-if="resourceText">
        <span v-if="store.resourceCount > 0 && !store.resources" class="resource-spinner"></span>
        <span
          class="resource-text"
          :class="{ warning: hasWarning }"
        >
          {{ resourceText }}
        </span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.context-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 0;
  font-size: 13px;
  color: var(--lt-text-secondary);
  border-bottom: 1px solid var(--lt-border);
  margin-bottom: 16px;
}

.context-main {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.context-item {
  white-space: nowrap;
}

.context-resource {
  display: flex;
  align-items: center;
  gap: 6px;
}

.resource-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--lt-border);
  border-top-color: var(--lt-brand);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.resource-text {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
}
.resource-text.warning {
  color: var(--lt-warning);
}

@media (max-width: 768px) {
  .context-bar {
    padding: 8px 0;
    cursor: pointer;
  }
  .context-main {
    overflow: hidden;
    max-height: 20px;
    transition: max-height 0.2s;
  }
}
</style>
