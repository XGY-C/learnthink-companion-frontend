<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useVideoLectureStore } from '@/stores/videoLecture'

const store = useVideoLectureStore()

const config = computed(() => store.currentInteractive)
const result = computed(() => store.interactionResult)

// 用户选中的选项 ID 列表
const selectedIds = ref<string[]>([])

// 场景切换时重置选择；store 中的 interactionResult 由 store 方法重置
watch(() => store.currentSceneIndex, () => {
  selectedIds.value = []
})

function toggleOption(id: string) {
  // 已答题则锁定，不可再改
  if (result.value) return

  if (config.value?.multiSelect) {
    const idx = selectedIds.value.indexOf(id)
    if (idx >= 0) selectedIds.value.splice(idx, 1)
    else selectedIds.value.push(id)
  } else {
    selectedIds.value = [id]
  }
}

function isSelected(id: string) {
  return selectedIds.value.includes(id)
}

function isCorrect(id: string) {
  return config.value?.correctIds?.includes(id) ?? false
}

function handleSubmit() {
  if (selectedIds.value.length === 0) return
  store.setInteractionResult(selectedIds.value)
}

function handleContinue() {
  store.resolveInteraction()
}
</script>

<template>
  <div v-if="config" class="interactive-overlay">
    <div class="quiz-panel">
      <!-- 标题栏 -->
      <div class="quiz-header">
        <svg class="quiz-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span class="quiz-title">检查你的理解</span>
      </div>

      <!-- 问题 -->
      <p class="quiz-question">{{ config.question }}</p>

      <!-- 选项列表 -->
      <div class="quiz-options">
        <button
          v-for="opt in config.options"
          :key="opt.id"
          class="quiz-option"
          :class="{
            selected: isSelected(opt.id),
            correct: result && isCorrect(opt.id),
            wrong: result && isSelected(opt.id) && !isCorrect(opt.id),
            locked: !!result,
          }"
          :disabled="!!result"
          @click="toggleOption(opt.id)"
        >
          <span class="option-marker">
            <svg v-if="result && isCorrect(opt.id)" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <svg v-else-if="result && isSelected(opt.id) && !isCorrect(opt.id)" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            <span v-else class="option-letter">{{ opt.id.toUpperCase() }}</span>
          </span>
          <span class="option-label">{{ opt.label }}</span>
        </button>
      </div>

      <!-- 答题反馈 -->
      <transition name="feedback-slide">
        <div v-if="result" class="quiz-feedback" :class="result.correct ? 'feedback-correct' : 'feedback-wrong'">
          <div class="feedback-banner">
            <svg v-if="result.correct" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <span>{{ result.correct ? '回答正确！' : '不太对，再想想' }}</span>
          </div>
          <p v-if="config.explanation" class="feedback-explanation">{{ config.explanation }}</p>
        </div>
      </transition>

      <!-- 底部操作区 -->
      <div class="quiz-actions">
        <!-- "请先选择答案"提示 -->
        <transition name="prompt-shake">
          <div v-if="store.showInteractionPrompt" class="interaction-prompt">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>请先选择一个答案</span>
          </div>
        </transition>

        <!-- 提交按钮（未答题时显示） -->
        <button
          v-if="!result"
          class="quiz-btn quiz-submit-btn"
          :disabled="selectedIds.length === 0"
          @click="handleSubmit"
        >
          提交答案
        </button>

        <!-- 继续播放按钮（答题后显示） -->
        <button
          v-else
          class="quiz-btn quiz-continue-btn"
          @click="handleContinue"
        >
          继续播放
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.interactive-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0 24px 80px;
  pointer-events: none;
  animation: overlay-fade-in 0.4s ease-out;
}

@keyframes overlay-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.quiz-panel {
  width: 100%;
  max-width: 640px;
  max-height: 75%;
  overflow-y: auto;
  background: rgba(18, 18, 28, 0.92);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 24px 28px;
  pointer-events: all;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
  animation: panel-slide-up 0.4s cubic-bezier(0.2, 0, 0, 1);
}

@keyframes panel-slide-up {
  from { transform: translateY(40px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* 标题栏 */
.quiz-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.quiz-icon {
  color: var(--lt-brand, #2B6FFF);
}
.quiz-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--lt-brand, #2B6FFF);
  letter-spacing: 0.03em;
}

/* 问题 */
.quiz-question {
  font-size: 17px;
  font-weight: 600;
  color: #e8e8ec;
  line-height: 1.6;
  margin: 0 0 16px;
}

/* 选项 */
.quiz-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.quiz-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  color: #e8e8ec;
  font-size: 15px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
}
.quiz-option:not(.locked):hover {
  border-color: rgba(43, 111, 255, 0.4);
  background: rgba(43, 111, 255, 0.06);
}
.quiz-option.selected {
  border-color: var(--lt-brand, #2B6FFF);
  background: rgba(43, 111, 255, 0.12);
}
.quiz-option.correct {
  border-color: var(--lt-success, #22c55e);
  background: rgba(34, 197, 94, 0.1);
}
.quiz-option.wrong {
  border-color: var(--lt-error, #ef4444);
  background: rgba(239, 68, 68, 0.1);
}
.quiz-option.locked {
  cursor: default;
}

.option-marker {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: #9ca3af;
  transition: all 0.2s;
}
.quiz-option.selected .option-marker {
  border-color: var(--lt-brand, #2B6FFF);
  background: var(--lt-brand, #2B6FFF);
  color: #fff;
}
.quiz-option.correct .option-marker {
  border-color: var(--lt-success, #22c55e);
  background: var(--lt-success, #22c55e);
  color: #fff;
}
.quiz-option.wrong .option-marker {
  border-color: var(--lt-error, #ef4444);
  background: var(--lt-error, #ef4444);
  color: #fff;
}
.option-letter {
  font-family: 'Inter', sans-serif;
}

.option-label {
  flex: 1;
  line-height: 1.5;
}

/* 答题反馈 */
.quiz-feedback {
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid;
}
.feedback-correct {
  border-color: rgba(34, 197, 94, 0.25);
  background: rgba(34, 197, 94, 0.08);
}
.feedback-wrong {
  border-color: rgba(239, 68, 68, 0.25);
  background: rgba(239, 68, 68, 0.08);
}
.feedback-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}
.feedback-correct .feedback-banner { color: var(--lt-success, #22c55e); }
.feedback-wrong .feedback-banner { color: var(--lt-error, #ef4444); }
.feedback-explanation {
  font-size: 13px;
  color: #9ca3af;
  line-height: 1.6;
  margin: 8px 0 0;
}

/* 底部操作区 */
.quiz-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 20px;
  position: relative;
  min-height: 44px;
}

/* "请先选择"提示 */
.interaction-prompt {
  position: absolute;
  top: -32px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 8px;
  color: var(--lt-error, #ef4444);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  animation: prompt-bounce 0.4s ease-out;
}
@keyframes prompt-bounce {
  0% { transform: translateX(-50%) translateY(8px); opacity: 0; }
  50% { transform: translateX(-50%) translateY(-2px); }
  100% { transform: translateX(-50%) translateY(0); opacity: 1; }
}

/* 按钮 */
.quiz-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 28px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.quiz-submit-btn {
  background: var(--lt-brand, #2B6FFF);
  color: #fff;
}
.quiz-submit-btn:not(:disabled):hover {
  background: var(--lt-brand-dark, #1a5ad7);
}
.quiz-submit-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.quiz-continue-btn {
  background: var(--lt-success, #22c55e);
  color: #fff;
}
.quiz-continue-btn:hover {
  background: #1ab548;
}

/* 过渡动画 */
.feedback-slide-enter-active {
  transition: all 0.3s ease-out;
}
.feedback-slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.prompt-shake-enter-active {
  transition: all 0.3s ease-out;
}
.prompt-shake-leave-active {
  transition: all 0.2s ease-in;
}
.prompt-shake-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
.prompt-shake-leave-to {
  opacity: 0;
}
</style>
