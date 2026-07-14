<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTutoringStore } from '@/stores/tutoring'
import { useTutoringSSE } from '@/composables/useTutoringSSE'
import StreamingMarkdown from './StreamingMarkdown.vue'
import type { GuidedStepState } from '@/types/tutoring'

const props = defineProps<{
  /** 聊天内联模式下传入的作答提交回调；不传则走独立 TutoringMain 的 useTutoringSSE */
  inlineSubmit?: (stepId: string, action: 'answer' | 'reveal', answer?: string) => Promise<void>
  /** 完成后的快照数据（只读模式） */
  snapshot?: {
    guidedSteps: GuidedStepState[]
    guidedSummary: string
  }
}>()

const store = useTutoringStore()
const tutoringSSE = useTutoringSSE()

const pendingAnswer = ref('')
const submitting = ref(false)

// 快照模式 vs 活跃模式
const isSnapshot = computed(() => !!props.snapshot)
const steps = computed(() => props.snapshot?.guidedSteps ?? store.guidedSteps)
const summary = computed(() => props.snapshot?.guidedSummary ?? store.guidedSummary)
const currentStepIdx = computed(() => props.snapshot ? -1 : store.currentGuidedStepIdx)

const currentStep = computed(() => {
  if (isSnapshot.value) return null
  if (currentStepIdx.value < 0) return null
  return store.guidedSteps[currentStepIdx.value] || null
})

async function handleSubmitAnswer() {
  if (!pendingAnswer.value.trim() || submitting.value) return
  if (!currentStep.value || !store.sessionId) return
  submitting.value = true
  try {
    if (props.inlineSubmit) {
      await props.inlineSubmit(currentStep.value.id, 'answer', pendingAnswer.value)
    } else {
      await tutoringSSE.submitGuidedAnswer({
        sessionId: store.sessionId,
        stepId: currentStep.value.id,
        action: 'answer',
        answer: pendingAnswer.value,
      })
    }
    pendingAnswer.value = ''
  } finally {
    submitting.value = false
  }
}

async function handleReveal() {
  if (!currentStep.value || !store.sessionId) return
  submitting.value = true
  try {
    if (props.inlineSubmit) {
      await props.inlineSubmit(currentStep.value.id, 'reveal')
    } else {
      await tutoringSSE.submitGuidedAnswer({
        sessionId: store.sessionId,
        stepId: currentStep.value.id,
        action: 'reveal',
      })
    }
  } finally {
    submitting.value = false
  }
}

function feedbackClass(step: GuidedStepState) {
  if (step.evaluation === 'correct') return 'feedback-correct'
  if (step.evaluation === 'revealed') return 'feedback-revealed'
  if (step.evaluation === 'incorrect') return 'feedback-incorrect'
  return ''
}

function stageIcon(stage: string) {
  const icons: Record<string, string> = {
    understanding: '📖',
    analysis: '🔍',
    recall: '💡',
    execution: '✏️',
    verification: '✅',
  }
  return icons[stage] || '📋'
}
</script>

<template>
  <div class="guided-dialogue">
    <!-- 进度条 -->
    <div v-if="steps.length > 0" class="guided-progress">
      <div
        v-for="(step, idx) in steps"
        :key="step.id"
        class="progress-node"
        :class="{
          done: step.status === 'done',
          active: !isSnapshot && idx === currentStepIdx && step.status !== 'done',
          pending: !isSnapshot && idx > currentStepIdx
        }"
      >
        <span class="node-icon">
          <template v-if="step.status === 'done'">✓</template>
          <template v-else>{{ idx + 1 }}</template>
        </span>
        <span class="node-title">{{ step.title }}</span>
      </div>
    </div>

    <!-- 步骤列表 -->
    <div v-for="step in steps" :key="step.id" class="guided-step">
      <!-- AI 引导讲解 -->
      <div v-if="step.guidanceContent" class="message ai-message">
        <div class="message-role">
          <span class="stage-icon">{{ stageIcon(step.stage) }}</span>
          {{ step.title }}
        </div>
        <StreamingMarkdown :content="step.guidanceContent" :streaming="!isSnapshot && step.status === 'guiding'" />
      </div>

      <!-- AI 提问 -->
      <div v-if="step.question" class="message ai-question">
        <div class="question-icon">💡</div>
        <div class="question-text">{{ step.question }}</div>
      </div>

      <!-- 学生作答 -->
      <div v-if="step.studentAnswer" class="message student-message">
        <div class="message-role">我的回答</div>
        <div class="message-content">{{ step.studentAnswer }}</div>
      </div>

      <!-- AI 反馈 -->
      <div v-if="step.feedback" class="message ai-feedback" :class="feedbackClass(step)">
        <div class="feedback-icon">
          {{ step.evaluation === 'correct' ? '✓' : '💡' }}
        </div>
        <div class="feedback-content">
          <StreamingMarkdown :content="step.feedback" />
          <div v-if="step.hint" class="hint-box">
            <strong>提示：</strong>{{ step.hint }}
          </div>
        </div>
      </div>

      <!-- 作答输入区（仅活跃模式的当前等待步骤显示） -->
      <div
        v-if="!isSnapshot && step.status === 'waiting_answer' && step.id === currentStep?.id"
        class="answer-input-area"
      >
        <textarea
          v-model="pendingAnswer"
          placeholder="在此输入你的思考..."
          rows="3"
          :disabled="submitting"
        />
        <div class="answer-actions">
          <el-button
            type="primary"
            @click="handleSubmitAnswer"
            :disabled="!pendingAnswer.trim() || submitting"
          >
            提交回答
          </el-button>
          <el-button
            v-if="step.allowReveal"
            text
            type="warning"
            @click="handleReveal"
            :disabled="submitting"
          >
            查看答案
          </el-button>
        </div>
      </div>
    </div>

    <!-- 总结 -->
    <div v-if="summary" class="guided-summary">
      <div class="summary-title">解题回顾</div>
      <StreamingMarkdown :content="summary" :streaming="!isSnapshot && store.status === 'guided'" />
    </div>
  </div>
</template>

<style scoped>
.guided-progress {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
  padding: 16px;
  background: var(--lt-bg-card);
  border-radius: var(--lt-radius-lg);
}
.progress-node {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  transition: all 0.3s;
}
.progress-node.done {
  background: var(--lt-success-light);
  color: var(--lt-success);
}
.progress-node.active {
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
  font-weight: 600;
}
.progress-node.pending {
  color: var(--lt-text-auxiliary);
}
.node-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 11px;
}
.done .node-icon {
  background: var(--lt-success);
  color: white;
}
.active .node-icon {
  background: var(--lt-brand);
  color: white;
}

.guided-step {
  margin-bottom: 24px;
}
.message {
  margin-bottom: 16px;
  padding: 16px;
  border-radius: var(--lt-radius-lg);
}
.ai-message {
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
}
.ai-question {
  background: var(--lt-brand-lightest);
  border-left: 3px solid var(--lt-brand);
}
.message-role {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.stage-icon {
  font-size: 14px;
}
.question-icon {
  font-size: 18px;
  margin-bottom: 4px;
}
.question-text {
  font-size: 15px;
  font-weight: 500;
  color: var(--lt-text-primary);
}
.student-message {
  background: var(--lt-brand-lightest);
  margin-left: 40px;
}
.message-content {
  font-size: 14px;
  line-height: 1.7;
  color: var(--lt-text-primary);
}
.ai-feedback.feedback-correct {
  background: var(--lt-success-light);
  border-left: 3px solid var(--lt-success);
}
.ai-feedback.feedback-incorrect {
  background: var(--lt-orange-light-9);
  border-left: 3px solid var(--lt-warning);
}
.ai-feedback.feedback-revealed {
  background: var(--lt-bg-card);
  border-left: 3px solid var(--lt-text-auxiliary);
}
.feedback-content {
  font-size: 14px;
  line-height: 1.7;
}
.hint-box {
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(255, 193, 7, 0.1);
  border-radius: var(--lt-radius-md);
  font-size: 13px;
}

.answer-input-area {
  margin-top: 16px;
  padding: 16px;
  background: var(--lt-bg-card);
  border-radius: var(--lt-radius-lg);
  border: 1px solid var(--lt-border);
}
.answer-input-area textarea {
  width: 100%;
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-md);
  padding: 12px;
  font-size: 14px;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}
.answer-input-area textarea:focus {
  border-color: var(--lt-brand);
}
.answer-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.guided-summary {
  margin-top: 24px;
  padding: 20px;
  background: var(--lt-bg-card);
  border-radius: var(--lt-radius-lg);
  border: 1px solid var(--lt-border);
}
.summary-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--lt-text-primary);
}
</style>
