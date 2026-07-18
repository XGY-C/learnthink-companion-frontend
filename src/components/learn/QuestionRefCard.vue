<script setup lang="ts">
import type { QuestionRef } from '@/types'

defineProps<{
  questionRef: QuestionRef
}>()

defineEmits<{
  dismiss: []
}>()

function stripLeadingLabel(opt: string): string {
  return opt.replace(/^[A-Z][.、]\s*/, '')
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '…'
}
</script>

<template>
  <div class="qref-card">
    <div class="qref-header">
      <div class="qref-badges">
        <span class="qref-badge qref-badge--type">{{ questionRef.typeLabel }}</span>
        <span
          v-if="questionRef.difficultyLabel"
          class="qref-badge qref-badge--difficulty"
        >{{ questionRef.difficultyLabel }}</span>
        <span
          v-if="questionRef.knowledgeTags?.length"
          class="qref-badge qref-badge--kp"
        >{{ questionRef.knowledgeTags[0] }}</span>
      </div>
      <button class="qref-dismiss" @click="$emit('dismiss')" title="移除引用">✕</button>
    </div>
    <div class="qref-body">
      <p class="qref-content">{{ truncate(questionRef.content, 200) }}</p>
      <div v-if="questionRef.options?.length" class="qref-options">
        <span
          v-for="(opt, oi) in questionRef.options.slice(0, 4)"
          :key="oi"
          class="qref-opt"
        >
          <span class="qref-opt-letter">{{ String.fromCharCode(65 + oi) }}</span>
          <span class="qref-opt-text">{{ truncate(stripLeadingLabel(opt), 80) }}</span>
        </span>
        <span v-if="questionRef.options.length > 4" class="qref-opt-more">
          +{{ questionRef.options.length - 4 }} 个选项
        </span>
      </div>
    </div>
    <div v-if="questionRef.userAnswer" class="qref-answer">
      <span class="qref-answer-label">我的答案</span>
      <span class="qref-answer-value">{{ questionRef.userAnswer }}</span>
    </div>
  </div>
</template>

<style scoped>
.qref-card {
  position: relative;
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-left: 3px solid var(--lt-brand);
  border-radius: var(--lt-radius-lg);
  overflow: hidden;
  transition: border-color 0.2s;
}
.qref-card:hover {
  border-color: var(--lt-brand-lighter);
}

.qref-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 10px 12px 4px;
  gap: 8px;
}

.qref-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.qref-badge {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 4px;
  white-space: nowrap;
}
.qref-badge--type {
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
}
.qref-badge--difficulty {
  background: var(--lt-orange-light-9);
  color: var(--lt-orange);
}
.qref-badge--kp {
  background: var(--lt-ai-light-9);
  color: var(--lt-ai);
}

.qref-dismiss {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--lt-text-auxiliary);
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
}
.qref-dismiss:hover {
  background: var(--lt-bg-page);
  color: var(--lt-text-primary);
}

.qref-body {
  padding: 6px 12px 10px;
}

.qref-content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--lt-text-primary);
  margin: 0;
}

.qref-options {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.qref-opt {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.qref-opt-letter {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  border-radius: 4px;
  background: var(--lt-bg-page);
  color: var(--lt-text-auxiliary);
}
.qref-opt-text {
  font-size: 12px;
  color: var(--lt-text-secondary);
  line-height: 1.4;
}
.qref-opt-more {
  font-size: 12px;
  color: var(--lt-text-placeholder);
  margin-top: 2px;
}

.qref-answer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--lt-border);
  background: var(--lt-bg-page);
}
.qref-answer-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--lt-text-auxiliary);
  white-space: nowrap;
}
.qref-answer-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--lt-brand);
  font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
}
</style>
