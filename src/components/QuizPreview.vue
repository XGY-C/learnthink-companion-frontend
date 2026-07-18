<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import type { QuizContent, QuestionType, Question } from '@/types'
import { parseQuiz } from '@/utils/quizExport'
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
const quiz = computed<QuizContent | null>(() => parseQuiz(props.content))

const questions = computed(() => quiz.value?.questions ?? [])

// ---- 题目导航 ----
const activeIdx = ref(0)
const activeQuestion = computed(() => questions.value[activeIdx.value] ?? null)

function goTo(idx: number) {
  if (idx >= 0 && idx < questions.value.length) activeIdx.value = idx
}

// ---- 用户作答状态 ----
// key: question id, value: 用户选择的答案（单选为 "A"，多选为 "AB"，填空/简答为文本）
const userAnswers = reactive<Record<number, string>>({})
// key: question id, value: 多选题暂存中的选项集合
const multiSelectTemp = reactive<Record<number, Set<string>>>({})
// 已确认提交的题目 id 集合
const submittedIds = reactive(new Set<number>())

function getUserAnswer(q: Question): string | undefined {
  return userAnswers[q.id]
}

function isSubmitted(q: Question): boolean {
  return submittedIds.has(q.id)
}

function isCorrect(q: Question): boolean {
  const ua = getUserAnswer(q)
  if (ua === undefined) return false
  return ua.trim().toUpperCase() === q.answer.trim().toUpperCase()
}

// ---- 单选题/判断题：点击选项 ----
function selectOption(q: Question, letter: string) {
  if (isSubmitted(q)) return // 已提交则不允许修改
  userAnswers[q.id] = letter
  submittedIds.add(q.id)
}

// ---- 多选题：切换选项 ----
function toggleMultiOption(q: Question, letter: string) {
  if (isSubmitted(q)) return
  if (!multiSelectTemp[q.id]) {
    multiSelectTemp[q.id] = new Set()
  }
  const set = multiSelectTemp[q.id]
  if (set.has(letter)) {
    set.delete(letter)
  } else {
    set.add(letter)
  }
}

function confirmMultiSelect(q: Question) {
  const set = multiSelectTemp[q.id]
  if (!set || set.size === 0) return
  // 排序后拼接，如 "ABD"
  userAnswers[q.id] = [...set].sort().join('')
  submittedIds.add(q.id)
}

// ---- 填空/简答：输入文本 ----
const openAnswerInputs = reactive<Record<number, string>>({})

function submitOpenAnswer(q: Question) {
  const text = openAnswerInputs[q.id]?.trim()
  if (!text) return
  userAnswers[q.id] = text
  submittedIds.add(q.id)
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
  return String.fromCharCode(65 + index)
}

// 统计
const answeredCount = computed(() => submittedIds.size)
const correctCount = computed(() => {
  let c = 0
  for (const q of questions.value) {
    if (isSubmitted(q) && isCorrect(q)) c++
  }
  return c
})
</script>

<template>
  <div v-if="quiz && questions.length > 0" class="quiz-preview">
    <!-- 顶部元信息 + 统计 -->
    <div class="quiz-meta">
      <span>共 {{ questions.length }} 题</span>
      <span>· 预计 {{ Math.round(questions.length * 1.5) }} 分钟</span>
      <span v-if="qualityScore != null">· 质量 {{ qualityScore }}/100</span>
      <span v-if="answeredCount > 0" class="quiz-score">
        · 已答 {{ answeredCount }}/{{ questions.length }}
        <template v-if="answeredCount > 0">
          · 正确 {{ correctCount }}/{{ answeredCount }}
        </template>
      </span>
    </div>

    <!-- 题目导航条（含作答状态） -->
    <div class="quiz-navbar">
      <button
        v-for="(q, i) in questions"
        :key="q.id ?? i"
        class="quiz-nav-dot"
        :class="{
          active: i === activeIdx,
          correct: isSubmitted(q) && isCorrect(q),
          wrong: isSubmitted(q) && !isCorrect(q),
        }"
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

      <!-- 选项（单选题/判断题/多选题） -->
      <div v-if="activeQuestion.options && activeQuestion.options.length > 0" class="question-options">
        <div
          v-for="(opt, oi) in activeQuestion.options"
          :key="oi"
          class="option-item"
          :class="{
            clickable: !isSubmitted(activeQuestion) && activeQuestion.type !== 'MULTIPLE_CHOICE',
            'multi-clickable': !isSubmitted(activeQuestion) && activeQuestion.type === 'MULTIPLE_CHOICE',
            selected: isSubmitted(activeQuestion)
              ? getUserAnswer(activeQuestion) === optionLabel(oi)
              : activeQuestion.type === 'MULTIPLE_CHOICE'
                ? multiSelectTemp[activeQuestion.id]?.has(optionLabel(oi))
                : getUserAnswer(activeQuestion) === optionLabel(oi),
            correct:
              isSubmitted(activeQuestion) &&
              optionLabel(oi) === activeQuestion.answer.trim().toUpperCase(),
            wrong:
              isSubmitted(activeQuestion) &&
              getUserAnswer(activeQuestion) === optionLabel(oi) &&
              optionLabel(oi) !== activeQuestion.answer.trim().toUpperCase(),
            dimmed:
              isSubmitted(activeQuestion) &&
              getUserAnswer(activeQuestion) !== optionLabel(oi) &&
              optionLabel(oi) !== activeQuestion.answer.trim().toUpperCase(),
          }"
          @click="activeQuestion.type === 'MULTIPLE_CHOICE'
            ? toggleMultiOption(activeQuestion, optionLabel(oi))
            : selectOption(activeQuestion, optionLabel(oi))"
        >
          <span class="option-letter">{{ optionLabel(oi) }}</span>
          <span class="option-text">{{ opt }}</span>
          <span v-if="isSubmitted(activeQuestion) && optionLabel(oi) === activeQuestion.answer.trim().toUpperCase()" class="option-mark correct-mark">✓</span>
          <span v-if="isSubmitted(activeQuestion) && getUserAnswer(activeQuestion) === optionLabel(oi) && optionLabel(oi) !== activeQuestion.answer.trim().toUpperCase()" class="option-mark wrong-mark">✗</span>
        </div>
        <!-- 多选确认按钮 -->
        <button
          v-if="activeQuestion.type === 'MULTIPLE_CHOICE' && !isSubmitted(activeQuestion)"
          class="multi-confirm-btn"
          :disabled="!multiSelectTemp[activeQuestion.id] || multiSelectTemp[activeQuestion.id]?.size === 0"
          @click="confirmMultiSelect(activeQuestion)"
        >
          确认选择
        </button>
      </div>

      <!-- 填空/简答输入 -->
      <div v-else class="question-open-input">
        <template v-if="!isSubmitted(activeQuestion)">
          <textarea
            v-model="openAnswerInputs[activeQuestion.id]"
            class="open-answer-textarea"
            :placeholder="activeQuestion.type === 'FILL_IN_BLANK' ? '请输入你的答案...' : '请输入你的回答...'"
            rows="3"
            @keydown.enter.ctrl="submitOpenAnswer(activeQuestion)"
          ></textarea>
          <button
            class="multi-confirm-btn"
            :disabled="!openAnswerInputs[activeQuestion.id]?.trim()"
            @click="submitOpenAnswer(activeQuestion)"
          >
            提交答案
          </button>
          <span class="shortcut-hint">Ctrl+Enter 提交</span>
        </template>
      </div>

      <!-- 作答结果反馈 + 解析 -->
      <div v-if="isSubmitted(activeQuestion)" class="answer-feedback" :class="{ correct: isCorrect(activeQuestion), wrong: !isCorrect(activeQuestion) }">
        <div class="feedback-header">
          <span v-if="isCorrect(activeQuestion)" class="feedback-badge correct">✓ 回答正确</span>
          <span v-else class="feedback-badge wrong">✗ 回答错误</span>
        </div>
        <div class="feedback-answer">
          <span class="feedback-label">正确答案：</span>
          <span class="feedback-value">{{ activeQuestion.answer }}</span>
          <span v-if="!isCorrect(activeQuestion) && getUserAnswer(activeQuestion)" class="feedback-your">
            （你的答案：{{ getUserAnswer(activeQuestion) }}）
          </span>
        </div>
        <div v-if="activeQuestion.analysis" class="feedback-analysis">
          <span class="feedback-label">解析：</span>
          <MarkdownViewer :content="activeQuestion.analysis" :showToc="false" />
        </div>
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
        下一题 ->
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
.quiz-score {
  color: var(--lt-brand);
  font-weight: 500;
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
.quiz-nav-dot.correct {
  border-color: var(--lt-success);
  background: color-mix(in srgb, var(--lt-success) 12%, transparent);
}
.quiz-nav-dot.wrong {
  border-color: var(--lt-danger);
  background: color-mix(in srgb, var(--lt-danger) 12%, transparent);
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
  transition: all var(--lt-transition-base);
  position: relative;
}
.option-item.clickable {
  cursor: pointer;
}
.option-item.clickable:hover {
  border-color: var(--lt-brand-lighter);
  background-color: var(--lt-brand-lightest);
}
.option-item.multi-clickable {
  cursor: pointer;
}
.option-item.multi-clickable:hover {
  border-color: var(--lt-brand-lighter);
  background-color: var(--lt-brand-lightest);
}
.option-item.selected {
  border-color: var(--lt-brand);
  background-color: var(--lt-brand-lightest);
}
.option-item.correct {
  border-color: var(--lt-success);
  background: color-mix(in srgb, var(--lt-success) 12%, transparent);
}
.option-item.wrong {
  border-color: var(--lt-danger);
  background: color-mix(in srgb, var(--lt-danger) 12%, transparent);
}
.option-item.dimmed {
  opacity: 0.5;
}
.option-letter {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 50%;
  background-color: var(--lt-bg-page); color: var(--lt-text-secondary);
  font-size: 13px; font-weight: 600; flex-shrink: 0;
  transition: all var(--lt-transition-base);
}
.option-item.correct .option-letter {
  background-color: var(--lt-success);
  color: #fff;
}
.option-item.wrong .option-letter {
  background-color: var(--lt-danger);
  color: #fff;
}
.option-item.selected:not(.correct):not(.wrong) .option-letter {
  background-color: var(--lt-brand);
  color: #fff;
}
.option-text {
  font-size: 14px; color: var(--lt-text-primary); line-height: 1.6;
  padding-top: 2px; flex: 1;
}
.option-mark {
  font-size: 16px; font-weight: 700;
  flex-shrink: 0; align-self: center;
}
.correct-mark { color: var(--lt-success); }
.wrong-mark { color: var(--lt-danger); }

/* ---- 多选确认按钮 ---- */
.multi-confirm-btn {
  margin-top: 4px;
  padding: 8px 20px; border-radius: 8px; border: none;
  background-color: var(--lt-brand); color: #fff;
  font-size: 13px; font-weight: 500; cursor: pointer;
  align-self: flex-start;
  transition: all var(--lt-transition-base);
}
.multi-confirm-btn:hover {
  background-color: var(--lt-brand-dark);
}
.multi-confirm-btn:disabled {
  opacity: 0.4; cursor: default;
}
.shortcut-hint {
  font-size: 11px; color: var(--lt-text-auxiliary);
  margin-left: 8px;
}

/* ---- 填空/简答输入 ---- */
.question-open-input {
  padding: 0 16px 16px;
  display: flex; flex-direction: column; gap: 8px;
}
.open-answer-textarea {
  width: 100%; padding: 10px 12px; border-radius: 8px;
  border: 1px solid var(--lt-border);
  font-size: 13px; line-height: 1.6; resize: vertical;
  background: var(--lt-bg-card); color: var(--lt-text-primary);
  outline: none; transition: border-color var(--lt-transition-base);
}
.open-answer-textarea:focus {
  border-color: var(--lt-brand);
}

/* ---- 答案反馈 ---- */
.answer-feedback {
  margin: 0 16px 16px;
  padding: 12px 16px; border-radius: 8px;
  border-left: 3px solid;
}
.answer-feedback.correct {
  background: color-mix(in srgb, var(--lt-success) 12%, transparent);
  border-color: var(--lt-success);
}
.answer-feedback.wrong {
  background: color-mix(in srgb, var(--lt-danger) 12%, transparent);
  border-color: var(--lt-danger);
}
.feedback-header {
  margin-bottom: 8px;
}
.feedback-badge {
  font-size: 14px; font-weight: 600;
}
.feedback-badge.correct { color: var(--lt-success); }
.feedback-badge.wrong { color: var(--lt-danger); }
.feedback-answer {
  font-size: 13px; color: var(--lt-text-primary); margin-bottom: 6px;
}
.feedback-label {
  font-weight: 600; color: var(--lt-text-primary);
}
.feedback-value {
  font-weight: 600;
}
.feedback-your {
  color: var(--lt-text-auxiliary);
}
.feedback-analysis {
  margin-top: 8px;
  font-size: 13px; color: var(--lt-text-secondary); line-height: 1.7;
}
.feedback-analysis :deep(.markdown-content) {
  font-size: 13px;
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
