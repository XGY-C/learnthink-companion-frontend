<script setup lang="ts">
import { ref, computed } from 'vue'
import type { QuizContent, QuestionType } from '@/types'
import MarkdownViewer from '@/components/MarkdownViewer.vue'

const props = defineProps<{
  content: string | QuizContent
  qualityScore?: number
  reviewerNotes?: string
}>()

defineEmits<{
  (e: 'open-practice'): void
}>()

// ---- 解析 content ----
const quiz = computed<QuizContent | null>(() => {
  if (!props.content) return null
  if (typeof props.content === 'string') {
    try { return JSON.parse(props.content) as QuizContent }
    catch { return null }
  }
  return props.content
})

const questions = computed(() => quiz.value?.questions ?? [])

// ---- 题目导航 ----
const activeIdx = ref(0)
const activeQuestion = computed(() => questions.value[activeIdx.value] ?? null)

function goTo(idx: number) {
  if (idx >= 0 && idx < questions.value.length) activeIdx.value = idx
}

// ---- 工具 ----
const QUESTION_TYPE_CONFIG: Record<QuestionType, { label: string; icon: string }> = {
  SINGLE_CHOICE:   { label: '单选题', icon: '○' },
  MULTIPLE_CHOICE: { label: '多选题', icon: '☑' },
  TRUE_FALSE:      { label: '判断题', icon: '⇄' },
  FILL_IN_BLANK:   { label: '填空题', icon: '▢' },
  SHORT_ANSWER:    { label: '简答题', icon: '☰' },
}

const DIFFICULTY_CONFIG: Record<number, { label: string; color: string }> = {
  1: { label: '很简单', color: 'var(--lt-success)' },
  2: { label: '简单',   color: 'var(--lt-success)' },
  3: { label: '中等',   color: 'var(--lt-warning)' },
  4: { label: '困难',   color: 'var(--lt-orange)' },
  5: { label: '很难',   color: 'var(--lt-danger)' },
}

function optionLabel(index: number): string {
  return String.fromCharCode(65 + index) // A, B, C, D...
}
</script>

<template>
  <div v-if="quiz && questions.length > 0" class="quiz-preview">
    <!-- 顶部元信息 -->
    <div class="quiz-meta">
      <span>共 {{ questions.length }} 题</span>
      <span>· 预计 {{ Math.round(questions.length * 1.5) }} 分钟</span>
      <span v-if="qualityScore != null">· 质量 {{ qualityScore }}/100</span>
    </div>

    <!-- 题目导航条 -->
    <div class="quiz-navbar">
      <button
        v-for="(q, i) in questions"
        :key="q.id ?? i"
        class="quiz-nav-dot"
        :class="{ active: i === activeIdx }"
        :title="`第${i + 1}题 · ${QUESTION_TYPE_CONFIG[q.type]?.label ?? q.type}`"
        @click="goTo(i)"
      >
        <span class="nav-num">{{ i + 1 }}</span>
        <span class="nav-icon">{{ QUESTION_TYPE_CONFIG[q.type]?.icon ?? '●' }}</span>
        <span
          class="nav-difficulty"
          :style="{ backgroundColor: DIFFICULTY_CONFIG[q.difficulty]?.color ?? 'var(--lt-text-auxiliary)' }"
        ></span>
      </button>
    </div>

    <!-- 当前题目 -->
    <div v-if="activeQuestion" class="quiz-question-card">
      <!-- 题目标题栏 -->
      <div class="question-header">
        <span class="question-num">第 {{ activeIdx + 1 }} 题</span>
        <span class="question-type-tag">{{ QUESTION_TYPE_CONFIG[activeQuestion.type]?.label ?? activeQuestion.type }}</span>
        <span
          class="question-difficulty-tag"
          :style="{ color: DIFFICULTY_CONFIG[activeQuestion.difficulty]?.color ?? 'var(--lt-text-auxiliary)' }"
        >
          {{ DIFFICULTY_CONFIG[activeQuestion.difficulty]?.label ?? '难度 ' + activeQuestion.difficulty }}
        </span>
        <span v-if="activeQuestion.knowledgePoint" class="question-kp">
          {{ activeQuestion.knowledgePoint }}
        </span>
      </div>

      <!-- 题干 -->
      <div class="question-body">
        <MarkdownViewer :content="activeQuestion.content" :showToc="false" />
      </div>

      <!-- 选项（选择题/判断题） -->
      <div v-if="activeQuestion.options && activeQuestion.options.length > 0" class="question-options">
        <div
          v-for="(opt, oi) in activeQuestion.options"
          :key="oi"
          class="option-item"
        >
          <span class="option-letter">{{ optionLabel(oi) }}</span>
          <span class="option-text">{{ opt }}</span>
        </div>
      </div>

      <!-- 填空/简答占位 -->
      <div v-else class="question-open-placeholder">
        <div class="placeholder-box">
          {{ activeQuestion.type === 'FILL_IN_BLANK' ? '填空作答区域' : '简答作答区域' }}
        </div>
      </div>

      <!-- 答案隐藏 -->
      <div class="answer-locked">
        🔒 答案与解析在练习模式下查看
      </div>

      <!-- Reviewer 审校记录（如果有） -->
      <div v-if="reviewerNotes" class="reviewer-trail">
        <div class="reviewer-label">Reviewer 审校记录</div>
        <div class="reviewer-content">{{ reviewerNotes }}</div>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="quiz-actions">
      <button class="quiz-action-btn secondary" @click="activeIdx > 0 ? goTo(activeIdx - 1) : null" :disabled="activeIdx === 0">
        ← 上一题
      </button>
      <span class="quiz-progress">{{ activeIdx + 1 }} / {{ questions.length }}</span>
      <button class="quiz-action-btn secondary" @click="activeIdx < questions.length - 1 ? goTo(activeIdx + 1) : null" :disabled="activeIdx === questions.length - 1">
        下一题 →
      </button>
      <span class="flex-1" />
      <button class="quiz-action-btn primary" @click="$emit('open-practice')">
        在练习模式中打开 →
      </button>
    </div>
  </div>

  <!-- 无题目或解析失败 -->
  <div v-else class="quiz-empty">
    <p>暂无可预览的题目内容</p>
  </div>
</template>

<style scoped>
.quiz-preview {
  display: flex; flex-direction: column; gap: 16px;
  min-height: 400px;
}

/* ---- 元信息 ---- */
.quiz-meta {
  display: flex; gap: 4px; flex-wrap: wrap;
  font-size: 13px; color: var(--lt-text-secondary);
}

/* ---- 导航条 ---- */
.quiz-navbar {
  display: flex; gap: 6px; flex-wrap: wrap;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--lt-border);
}
.quiz-nav-dot {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 8px; border-radius: 6px;
  border: 1px solid var(--lt-border); background: transparent;
  cursor: pointer; transition: all var(--lt-transition-base);
  font-size: 12px; color: var(--lt-text-secondary);
}
.quiz-nav-dot:hover {
  border-color: var(--lt-brand-lighter);
  background-color: var(--lt-brand-lightest);
}
.quiz-nav-dot.active {
  border-color: var(--lt-brand);
  background-color: var(--lt-brand-lightest);
  color: var(--lt-brand);
  font-weight: 600;
}
.nav-num { min-width: 16px; text-align: center; }
.nav-icon { font-size: 10px; }
.nav-difficulty {
  width: 6px; height: 6px; border-radius: 50%;
}

/* ---- 题目卡片 ---- */
.quiz-question-card {
  border: 1px solid var(--lt-border); border-radius: 12px;
  background: var(--lt-bg-card); overflow: hidden;
}

.question-header {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 12px 16px;
  background-color: var(--lt-bg-page);
  border-bottom: 1px solid var(--lt-border);
}
.question-num {
  font-size: 14px; font-weight: 600; color: var(--lt-text-primary);
}
.question-type-tag {
  font-size: 11px; padding: 1px 6px; border-radius: 4px;
  background-color: var(--lt-brand-lightest); color: var(--lt-brand);
}
.question-difficulty-tag {
  font-size: 11px; font-weight: 500;
}
.question-kp {
  font-size: 11px; color: var(--lt-text-auxiliary);
  margin-left: auto;
}

.question-body {
  padding: 16px 16px 12px;
}
.question-body :deep(.markdown-content) {
  font-size: 15px; line-height: 1.7;
}

/* ---- 选项 ---- */
.question-options {
  padding: 0 16px 16px;
  display: flex; flex-direction: column; gap: 8px;
}
.option-item {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 12px; border-radius: 8px;
  border: 1px solid var(--lt-border);
  transition: background-color var(--lt-transition-base);
}
.option-letter {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 50%;
  background-color: var(--lt-bg-page); color: var(--lt-text-secondary);
  font-size: 13px; font-weight: 600; flex-shrink: 0;
}
.option-text {
  font-size: 14px; color: var(--lt-text-primary); line-height: 1.6;
  padding-top: 2px;
}

/* ---- 填空/简答占位 ---- */
.question-open-placeholder {
  padding: 0 16px 16px;
}
.placeholder-box {
  border: 2px dashed var(--lt-border); border-radius: 8px;
  padding: 24px; text-align: center;
  font-size: 13px; color: var(--lt-text-placeholder);
}

/* ---- 答案隐藏 ---- */
.answer-locked {
  margin: 0 16px 16px;
  padding: 12px 16px; border-radius: 8px;
  background-color: var(--lt-bg-page);
  border: 1px dashed var(--lt-border);
  text-align: center; font-size: 13px; color: var(--lt-text-auxiliary);
}

/* ---- Reviewer 审校 ---- */
.reviewer-trail {
  margin: 0 16px 16px;
  padding: 10px 12px; border-radius: 8px;
  background-color: var(--lt-ai-light-9);
  border-left: 3px solid var(--lt-ai);
}
.reviewer-label {
  font-size: 12px; font-weight: 600; color: var(--lt-ai-dark-2);
  margin-bottom: 4px;
}
.reviewer-content {
  font-size: 13px; color: var(--lt-text-secondary); line-height: 1.6;
}

/* ---- 底部操作栏 ---- */
.quiz-actions {
  display: flex; align-items: center; gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--lt-border);
}
.quiz-action-btn {
  padding: 8px 16px; border-radius: 8px; border: none;
  font-size: 13px; cursor: pointer;
  transition: all var(--lt-transition-base);
}
.quiz-action-btn:disabled {
  opacity: 0.4; cursor: default;
}
.quiz-action-btn.secondary {
  background: transparent; border: 1px solid var(--lt-border);
  color: var(--lt-text-secondary);
}
.quiz-action-btn.secondary:hover:not(:disabled) {
  border-color: var(--lt-brand-lighter);
  color: var(--lt-brand);
}
.quiz-action-btn.primary {
  background-color: var(--lt-brand);
  color: #fff; font-weight: 500;
}
.quiz-action-btn.primary:hover {
  background-color: var(--lt-brand-dark);
}
.quiz-progress {
  font-size: 13px; color: var(--lt-text-auxiliary);
}

/* ---- 空状态 ---- */
.quiz-empty {
  display: flex; align-items: center; justify-content: center;
  min-height: 200px; color: var(--lt-text-placeholder); font-size: 14px;
}
</style>
