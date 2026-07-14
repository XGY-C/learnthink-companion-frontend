<template>
  <div class="code-steps">
    <div class="code-steps-title">分步讲解</div>
    <div
      v-for="(step, index) in steps"
      :key="index"
      class="code-step-card"
      :class="{ hovered: hoveredIndex === index }"
      @mouseenter="$emit('hover-step', step.references)"
      @mouseleave="$emit('hover-step', [])"
      @click="emit('click-step', step)"
    >
      <div class="code-step-header">
        <span class="code-step-num">{{ index + 1 }}</span>
        <span class="code-step-title">{{ step.title }}</span>
      </div>
      <div class="code-step-body">
        <MarkdownViewer :content="step.content" :showToc="false" />
      </div>
      <div v-if="step.references.length" class="code-step-refs">
        关联：
        <span v-for="ref in step.references" :key="ref.filename" class="code-step-ref">
          {{ ref.filename }}:{{ ref.startLine }}-{{ ref.endLine }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import type { CodeStep, CodeLineRef } from './CodeLearningViewer.vue'

const hoveredIndex = ref<number | null>(null)

const emit = defineEmits<{
  (e: 'hover-step', refs: CodeLineRef[]): void
  (e: 'click-step', step: CodeStep): void
}>()

defineProps<{
  steps: CodeStep[]
}>()
</script>

<style scoped>
.code-steps {
  margin-top: 20px;
}
.code-steps-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--lt-text-primary);
  margin-bottom: 12px;
  position: sticky;
  top: 0;
  background: var(--lt-bg-page);
  z-index: 1;
  padding-top: 4px;
  padding-bottom: 8px;
}
.code-step-card {
  padding: 12px 14px;
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-md);
  margin-bottom: 10px;
  cursor: pointer;
  transition: border-color var(--lt-transition-base), box-shadow var(--lt-transition-base);
  background: var(--lt-bg-card);
}
.code-step-card:hover,
.code-step-card.hovered {
  border-color: var(--lt-brand);
  box-shadow: var(--lt-shadow-hover);
}
.code-step-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.code-step-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}
.code-step-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--lt-text-primary);
}
.code-step-body {
  font-size: 13px;
  color: var(--lt-text-secondary);
  line-height: 1.6;
}
.code-step-refs {
  margin-top: 8px;
  font-size: 12px;
  color: var(--lt-text-auxiliary);
}
.code-step-ref {
  display: inline-block;
  margin: 2px 4px 2px 0;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--lt-bg-page);
  font-family: var(--lt-font-mono);
  font-size: 11px;
  color: var(--lt-brand);
}

@media (min-width: 1200px) {
  .code-steps {
    margin-top: 0;
  }
  .code-steps-title {
    background: var(--lt-bg-page);
  }
}
</style>
