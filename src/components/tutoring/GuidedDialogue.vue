<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTutoringStore } from '@/stores/tutoring'
import { useTutoringSSE } from '@/composables/useTutoringSSE'
import StreamingMarkdown from './StreamingMarkdown.vue'
import type { GuidedStepState, GuidedStage } from '@/types/tutoring'

const props = defineProps<{
  inlineSubmit?: (stepId: string, action: 'answer' | 'reveal', answer?: string) => Promise<void>
  snapshot?: {
    guidedSteps?: GuidedStepState[]
    guidedSummary?: string
  }
}>()

const store = useTutoringStore()
const tutoringSSE = useTutoringSSE()

const pendingAnswer = ref('')
const submitting = ref(false)
const revealedStepIds = ref<Set<string>>(new Set())

const isSnapshot = computed(() => !!props.snapshot)
const steps = computed(() => props.snapshot?.guidedSteps ?? store.guidedSteps)
const summary = computed(() => props.snapshot?.guidedSummary ?? store.guidedSummary)
const currentStepIdx = computed(() => props.snapshot ? -1 : store.currentGuidedStepIdx)

const currentStep = computed(() => {
  if (isSnapshot.value) return null
  if (currentStepIdx.value < 0) return null
  return store.guidedSteps[currentStepIdx.value] || null
})

const activeStage = computed<GuidedStage | null>(() => {
  if (isSnapshot.value) return null
  if (!currentStep.value) {
    for (let i = steps.value.length - 1; i >= 0; i--) {
      if (steps.value[i].status === 'done') return steps.value[i].stage
    }
    if (steps.value.length > 0) return steps.value[0].stage
    return null
  }
  return currentStep.value.stage
})

function stageMeta(stage: GuidedStage) {
  const map: Record<GuidedStage, { icon: string; label: string; narrative: string }> = {
    understanding: { icon: 'book', label: '理解问题', narrative: '我们先一起读懂问题，明确题目在问什么' },
    analysis: { icon: 'search', label: '分析要素', narrative: '拆解关键条件，找到解题的突破口' },
    recall: { icon: 'network', label: '回忆关联', narrative: '联想已学过的知识和解题方法' },
    execution: { icon: 'edit', label: '执行解答', narrative: '一步步推演，把思路变成完整答案' },
    verification: { icon: 'check', label: '验证反思', narrative: '检查答案，回顾解题过程，提炼方法' },
  }
  return map[stage]
}

function isStepDone(idx: number): boolean {
  if (isSnapshot.value) return true
  return idx < currentStepIdx.value || (currentStepIdx.value >= 0 && steps.value[idx]?.status === 'done')
}

function isStepActive(idx: number): boolean {
  if (isSnapshot.value) return false
  const step = steps.value[idx]
  if (!step) return false
  return idx === currentStepIdx.value && step.status !== 'done'
}

function isStepPending(idx: number): boolean {
  if (isSnapshot.value) return false
  const step = steps.value[idx]
  if (!step) return true
  return step.status !== 'done' && idx > currentStepIdx.value
}

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

async function handleReveal(stepId: string) {
  if (!store.sessionId) return
  if (revealedStepIds.value.has(stepId)) return
  submitting.value = true
  try {
    if (props.inlineSubmit) {
      await props.inlineSubmit(stepId, 'reveal')
    } else {
      await tutoringSSE.submitGuidedAnswer({
        sessionId: store.sessionId,
        stepId,
        action: 'reveal',
      })
    }
    revealedStepIds.value.add(stepId)
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

function feedbackMeta(step: GuidedStepState) {
  if (step.evaluation === 'correct') return { icon: 'circle-check', text: '回答正确，很棒！' }
  if (step.evaluation === 'revealed') return { icon: 'info', text: '参考答案已揭示' }
  if (step.evaluation === 'incorrect') return { icon: 'refresh', text: '还差一点点，看看解析吧' }
  return { icon: 'loading', text: '正在评估...' }
}

const stageTimeline = computed(() => {
  const seen = new Set<GuidedStage>()
  const items: { stage: GuidedStage; steps: GuidedStepState[] }[] = []
  for (const step of steps.value) {
    if (!seen.has(step.stage)) {
      seen.add(step.stage)
      items.push({ stage: step.stage, steps: [] })
    }
    items[items.length - 1].steps.push(step)
  }
  return items
})
</script>

<template>
  <div class="guided-dialogue">
    <!-- ===== 竖版阶段时间线 (宽屏) ===== -->
    <div v-if="steps.length > 0" class="stage-timeline wide-only">
      <div
        v-for="(group, gi) in stageTimeline"
        :key="group.stage"
        class="timeline-group"
      >
        <div class="timeline-rail">
          <div
            class="timeline-node"
            :class="{
              done: isStepDone(steps.indexOf(group.steps[0])),
              active: isStepActive(steps.indexOf(group.steps[0])),
              pending: isStepPending(steps.indexOf(group.steps[0])),
            }"
          >
            <el-icon :size="18">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <template v-if="stageMeta(group.stage).icon === 'book'">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </template>
                <template v-else-if="stageMeta(group.stage).icon === 'search'">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.3-4.3"/>
                </template>
                <template v-else-if="stageMeta(group.stage).icon === 'network'">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <path d="M6.5 10v4M17.5 10v4M10 6.5h4M10 17.5h4"/>
                </template>
                <template v-else-if="stageMeta(group.stage).icon === 'edit'">
                  <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                </template>
                <template v-else>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </template>
              </svg>
            </el-icon>
          </div>
          <div
            v-if="gi < stageTimeline.length - 1"
            class="timeline-line"
            :class="{ done: isStepDone(steps.indexOf(group.steps[0])) }"
          ></div>
        </div>
        <div class="timeline-info">
          <div class="timeline-stage-label" :class="{ active: isStepActive(steps.indexOf(group.steps[0])) }">
            {{ stageMeta(group.stage).label }}
          </div>
          <div
            v-for="step in group.steps"
            :key="step.id"
            class="timeline-step-tag"
            :class="{
              done: step.status === 'done',
              active: !isSnapshot && step.id === currentStep?.id,
            }"
          >
            {{ step.title }}
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 窄屏横版步骤条 ===== -->
    <div v-if="steps.length > 0" class="stage-timeline narrow-only">
      <div class="narrow-progress">
        <template v-for="(step, idx) in steps" :key="step.id">
          <div
            class="narrow-step-dot"
            :class="{
              done: isStepDone(idx),
              active: isStepActive(idx),
              pending: isStepPending(idx),
            }"
          >
            <el-icon v-if="step.status === 'done'" :size="14"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></el-icon>
            <span v-else class="narrow-dot-num">{{ idx + 1 }}</span>
          </div>
          <div v-if="idx < steps.length - 1" class="narrow-connector" :class="{ done: isStepDone(idx + 1) }"></div>
        </template>
      </div>
    </div>

    <!-- ===== 当前阶段引导横幅 (活跃模式) ===== -->
    <div v-if="!isSnapshot && activeStage" class="stage-banner">
      <div class="stage-banner-icon-wrap">
        <el-icon :size="22">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <template v-if="stageMeta(activeStage).icon === 'book'">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </template>
            <template v-else-if="stageMeta(activeStage).icon === 'search'">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </template>
            <template v-else-if="stageMeta(activeStage).icon === 'network'">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><path d="M6.5 10v4M17.5 10v4M10 6.5h4M10 17.5h4"/>
            </template>
            <template v-else-if="stageMeta(activeStage).icon === 'edit'">
              <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
            </template>
            <template v-else>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </template>
          </svg>
        </el-icon>
      </div>
      <div>
        <div class="stage-banner-title">{{ stageMeta(activeStage).label }}</div>
        <div class="stage-banner-desc">{{ stageMeta(activeStage).narrative }}</div>
      </div>
    </div>

    <!-- ===== 步骤列表 ===== -->
    <div v-for="(step, idx) in steps" :key="step.id" class="guided-step">
      <!-- AI 引导讲解 -->
      <div v-if="step.guidanceContent" class="message ai-guidance">
        <div class="msg-header">
          <div class="msg-avatar guidance">
            <el-icon :size="14">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <template v-if="stageMeta(step.stage).icon === 'book'">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </template>
                <template v-else-if="stageMeta(step.stage).icon === 'search'">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </template>
                <template v-else-if="stageMeta(step.stage).icon === 'network'">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><path d="M6.5 10v4M17.5 10v4M10 6.5h4M10 17.5h4"/>
                </template>
                <template v-else-if="stageMeta(step.stage).icon === 'edit'">
                  <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                </template>
                <template v-else>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </template>
              </svg>
            </el-icon>
          </div>
          <span class="msg-sender">{{ stageMeta(step.stage).label }}</span>
          <span v-if="!isSnapshot && step.status === 'guiding'" class="msg-streaming-badge">
            <span class="streaming-dot"></span>生成中
          </span>
        </div>
        <div class="msg-body">
          <StreamingMarkdown :content="step.guidanceContent" :streaming="!isSnapshot && step.status === 'guiding'" />
        </div>
      </div>

      <!-- AI 提问 -->
      <div v-if="step.question" class="message ai-question">
        <div class="question-cue">思考一下</div>
        <div class="question-text">{{ step.question }}</div>
        <div v-if="!isSnapshot && step.status === 'waiting_answer' && step.attempt > 1" class="retry-indicator">
          第 {{ step.attempt }} 次尝试（最多 {{ step.maxAttempts }} 次）
        </div>
      </div>

      <!-- 学生作答 -->
      <div v-if="step.studentAnswer" class="message student-message">
        <div class="msg-header student">
          <div class="msg-avatar student-avatar">
            <el-icon :size="14">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </el-icon>
          </div>
          <span class="msg-sender">我的回答</span>
        </div>
        <div class="msg-body">
          {{ step.studentAnswer }}
        </div>
      </div>

      <!-- AI 反馈 -->
      <div v-if="step.feedback" class="message ai-feedback" :class="feedbackClass(step)">
        <div v-if="step.evaluation || !isSnapshot" class="feedback-banner-band">
          <el-icon :size="16">
            <template v-if="feedbackMeta(step).icon === 'circle-check'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </template>
            <template v-else-if="feedbackMeta(step).icon === 'info'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </template>
            <template v-else-if="feedbackMeta(step).icon === 'refresh'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            </template>
            <template v-else>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="loading-spin-svg"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </template>
          </el-icon>
          <span>{{ feedbackMeta(step).text }}</span>
        </div>
        <div class="msg-body feedback-body" :class="{ 'no-banner': !step.evaluation && isSnapshot }">
          <StreamingMarkdown :content="step.feedback" />
        </div>
        <div v-if="step.hint" class="hint-box">
          <el-icon :size="14" class="hint-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          </el-icon>
          <span class="hint-text">{{ step.hint }}</span>
        </div>
        <div v-if="step.allowReveal && step.evaluation !== 'correct' && step.evaluation !== 'revealed'" class="reveal-hint-area">
          <div class="reveal-hint-text">还是想不出来？我可以给你更多帮助</div>
          <button
            class="reveal-hint-btn"
            :disabled="submitting || revealedStepIds.has(step.id)"
            @click="handleReveal(step.id)"
          >
            {{ revealedStepIds.has(step.id) ? '已揭示' : '给我提示' }}
          </button>
        </div>
      </div>

      <!-- 作答输入区（仅活跃模式的当前等待步骤显示） -->
      <div
        v-if="!isSnapshot && step.status === 'waiting_answer' && step.id === currentStep?.id"
        class="answer-input-area"
      >
        <div class="input-header">
          <div class="input-avatar">
            <el-icon :size="12">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </el-icon>
          </div>
          <span class="input-label">在此写下你的思考...</span>
        </div>
        <textarea
          v-model="pendingAnswer"
          placeholder="输入你的答案、思路或推理过程..."
          rows="3"
          :disabled="submitting"
          @keydown.enter.ctrl="handleSubmitAnswer"
        />
        <div class="answer-actions">
          <button
            v-if="step.allowReveal"
            class="reveal-link"
            :disabled="submitting"
            @click="handleReveal(step.id)"
          >
            不太确定？给我提示
          </button>
          <button
            class="submit-answer-btn"
            :disabled="!pendingAnswer.trim() || submitting"
            @click="handleSubmitAnswer"
          >
            <span>{{ submitting ? '提交中...' : '提交回答' }}</span>
            <el-icon :size="16" v-if="!submitting">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </el-icon>
            <el-icon v-else :size="16" class="is-loading"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></el-icon>
          </button>
        </div>
      </div>
    </div>

    <!-- ===== 总结 ===== -->
    <div v-if="summary" class="guided-summary">
      <div class="summary-header">
        <div class="summary-icon-wrap">
          <el-icon :size="20">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
            </svg>
          </el-icon>
        </div>
        <span class="summary-title">学习回顾</span>
      </div>
      <div class="summary-body">
        <StreamingMarkdown :content="summary" :streaming="!isSnapshot && store.status === 'guided'" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===== 竖版时间线 (≥768px) ===== */
.stage-timeline.wide-only {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 24px 20px;
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-lg);
  margin-bottom: 32px;
  box-shadow: 0 1px 3px var(--lt-shadow);
}

.timeline-group {
  display: flex;
  align-items: flex-start;
  position: relative;
}

.timeline-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 48px;
  flex-shrink: 0;
}

.timeline-node {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  z-index: 1;
  position: relative;
  color: var(--lt-text-auxiliary);
}
.timeline-node.pending {
  background: var(--lt-bg-page);
  border: 2px solid var(--lt-border);
  color: var(--lt-text-placeholder);
}
.timeline-node.active {
  background: var(--lt-brand);
  color: #fff;
  box-shadow: 0 0 0 6px var(--lt-shadow-blue);
  animation: node-pulse 2s ease-in-out infinite;
}
@keyframes node-pulse {
  0%, 100% { box-shadow: 0 0 0 4px var(--lt-shadow-blue); }
  50% { box-shadow: 0 0 0 8px var(--lt-shadow-blue); }
}
.timeline-node.done {
  background: var(--lt-success);
  color: #fff;
}

.timeline-line {
  width: 2px;
  flex: 1;
  min-height: 28px;
  background: var(--lt-border);
  transition: background 0.4s ease;
  margin: 4px 0;
  border-radius: 1px;
}
.timeline-line.done {
  background: var(--lt-success);
}

.timeline-info {
  flex: 1;
  padding-left: 16px;
  padding-top: 4px;
  padding-bottom: 20px;
}

.timeline-stage-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--lt-text-secondary);
  margin-bottom: 8px;
  transition: color 0.25s;
}
.timeline-stage-label.active {
  color: var(--lt-brand);
}

.timeline-step-tag {
  display: inline-block;
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 12px;
  background: var(--lt-bg-page);
  color: var(--lt-text-auxiliary);
  margin-right: 8px;
  margin-bottom: 4px;
  transition: all 0.25s;
  font-weight: 500;
}
.timeline-step-tag.done {
  background: var(--lt-success-bg);
  color: var(--lt-success-text);
}
.timeline-step-tag.active {
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
  font-weight: 600;
}

/* ===== 窄屏步骤条 (<768px) ===== */
.stage-timeline.narrow-only {
  display: none;
}

.narrow-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 16px 20px;
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-lg);
  margin-bottom: 24px;
  box-shadow: 0 1px 3px var(--lt-shadow);
}

.narrow-step-dot {
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}
.narrow-step-dot.pending {
  background: var(--lt-bg-page);
  border: 2px solid var(--lt-border);
  color: var(--lt-text-auxiliary);
}
.narrow-step-dot.active {
  background: var(--lt-brand);
  color: #fff;
  box-shadow: 0 0 0 4px var(--lt-shadow-blue);
  animation: node-pulse 2s ease-in-out infinite;
}
.narrow-step-dot.done {
  background: var(--lt-success);
  color: #fff;
}
.narrow-dot-num {
  line-height: 1;
}

.narrow-connector {
  width: 28px;
  height: 2px;
  background: var(--lt-border);
  transition: background 0.4s ease;
  flex-shrink: 0;
  border-radius: 1px;
}
.narrow-connector.done {
  background: var(--lt-success);
}

/* ===== 阶段横幅 ===== */
.stage-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  background: linear-gradient(135deg, var(--lt-ai-light-9) 0%, var(--lt-brand-lightest) 100%);
  border: 1px solid var(--lt-ai-light-7);
  border-radius: var(--lt-radius-lg);
  margin-bottom: 28px;
}
.stage-banner-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--lt-ai-light-7), var(--lt-brand-lightest));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--lt-ai);
  flex-shrink: 0;
}
.stage-banner-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--lt-text-primary);
  margin-bottom: 2px;
}
.stage-banner-desc {
  font-size: 13px;
  color: var(--lt-text-secondary);
}

/* ===== 步骤容器 ===== */
.guided-step {
  margin-bottom: 0;
  position: relative;
}
.guided-step + .guided-step {
  margin-top: 32px;
}

/* ===== 消息通用 ===== */
.message {
  margin-bottom: 16px;
}

.msg-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.msg-header.student {
  justify-content: flex-end;
}

.msg-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.msg-avatar.guidance {
  background: var(--lt-ai-light-9);
  color: var(--lt-ai);
}
.msg-avatar.student-avatar {
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
}

.msg-sender {
  font-size: 12px;
  font-weight: 600;
  color: var(--lt-text-auxiliary);
}

.msg-streaming-badge {
  font-size: 11px;
  color: var(--lt-ai);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: var(--lt-ai-light-9);
  border-radius: 8px;
}
.streaming-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--lt-ai);
  animation: stream-pulse 0.8s ease-in-out infinite;
}
@keyframes stream-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.7); }
}

/* ===== AI 引导讲解 ===== */
.ai-guidance {
  padding: 20px 24px;
  background: linear-gradient(135deg, var(--lt-ai-light-9) 0%, var(--lt-bg-card) 100%);
  border-radius: 20px 20px 20px 6px;
  border: 1px solid var(--lt-ai-light-7);
}
.ai-guidance .msg-body {
  font-size: 14px;
  line-height: 1.75;
  color: var(--lt-text-primary);
}

/* ===== AI 提问 ===== */
.ai-question {
  padding: 20px 24px;
  background: var(--lt-brand-lightest);
  border-radius: 16px;
  border-left: 4px solid var(--lt-brand);
  margin-left: 8px;
}
.question-cue {
  font-size: 11px;
  font-weight: 600;
  color: var(--lt-brand);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}
.question-text {
  font-size: 15px;
  font-weight: 500;
  line-height: 1.7;
  color: var(--lt-text-primary);
}
.retry-indicator {
  margin-top: 12px;
  font-size: 12px;
  color: var(--lt-orange);
  padding: 6px 12px;
  background: var(--lt-orange-light-9);
  border-radius: 8px;
  display: inline-block;
}

/* ===== 学生作答 ===== */
.student-message {
  padding: 16px 20px;
  background: var(--lt-bg-card);
  border: 1.5px solid var(--lt-brand-lighter);
  border-radius: 20px 20px 6px 20px;
  margin-left: 56px;
  box-shadow: 0 1px 4px var(--lt-shadow);
  transition: box-shadow 0.2s;
}
.student-message:hover {
  box-shadow: 0 2px 8px var(--lt-shadow);
}
.student-message .msg-body {
  font-size: 14px;
  line-height: 1.7;
  color: var(--lt-text-primary);
}

/* ===== AI 反馈 ===== */
.ai-feedback {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid transparent;
  transition: border-color 0.3s;
}
.ai-feedback:not(.feedback-correct):not(.feedback-incorrect):not(.feedback-revealed) {
  border-color: var(--lt-border);
}
.feedback-correct {
  border-color: var(--lt-success);
}
.feedback-incorrect {
  border-color: var(--lt-orange);
}
.feedback-revealed {
  border-color: var(--lt-ai-light-5);
}

.feedback-banner-band {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  background: var(--lt-bg-page);
  color: var(--lt-text-secondary);
}
.feedback-correct .feedback-banner-band {
  background: var(--lt-success);
  color: #fff;
}
.feedback-incorrect .feedback-banner-band {
  background: var(--lt-orange);
  color: #fff;
}
.feedback-revealed .feedback-banner-band {
  background: var(--lt-ai);
  color: #fff;
}

.feedback-body {
  padding: 16px 20px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--lt-text-primary);
}
.feedback-body.no-banner {
  padding-top: 20px;
}
.feedback-correct .feedback-body {
  background: var(--lt-success-bg);
}
.feedback-incorrect .feedback-body {
  background: var(--lt-orange-light-9);
}
.feedback-revealed .feedback-body {
  background: var(--lt-ai-light-9);
}

.hint-box {
  margin: 0 16px 12px;
  padding: 10px 14px;
  background: var(--lt-brand-lightest);
  border-radius: var(--lt-radius-md);
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--lt-text-secondary);
  border: 1px solid var(--lt-brand-light-7);
}
.hint-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--lt-brand);
}

.reveal-hint-area {
  margin: 0 16px 12px;
  padding: 12px 16px;
  background: var(--lt-bg-page);
  border-radius: var(--lt-radius-md);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.reveal-hint-text {
  font-size: 13px;
  color: var(--lt-text-auxiliary);
}
.reveal-hint-btn {
  font-size: 13px;
  font-weight: 500;
  color: var(--lt-ai);
  background: var(--lt-ai-light-9);
  border: 1px solid var(--lt-ai-light-5);
  border-radius: 8px;
  padding: 8px 16px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  min-height: 36px;
}
.reveal-hint-btn:hover:not(:disabled) {
  background: var(--lt-ai-light-7);
  color: var(--lt-ai-dark-2);
}
.reveal-hint-btn:active:not(:disabled) {
  transform: scale(0.97);
}
.reveal-hint-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== 作答输入区 ===== */
.answer-input-area {
  margin-top: 4px;
  padding: 20px 24px;
  background: var(--lt-bg-card);
  border: 1.5px solid var(--lt-brand-lighter);
  border-radius: 20px 20px 20px 6px;
  margin-left: 8px;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-shadow: 0 1px 4px var(--lt-shadow);
}
.answer-input-area:focus-within {
  border-color: var(--lt-brand);
  box-shadow: 0 0 0 4px var(--lt-shadow-blue);
}

.input-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.input-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
  display: flex;
  align-items: center;
  justify-content: center;
}
.input-label {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  font-weight: 500;
}

.answer-input-area textarea {
  width: 100%;
  border: 1.5px solid var(--lt-border);
  outline: none;
  background: var(--lt-bg-page);
  border-radius: var(--lt-radius-md);
  padding: 12px 14px;
  font-size: 14px;
  font-family: inherit;
  color: var(--lt-text-primary);
  resize: vertical;
  line-height: 1.6;
  box-sizing: border-box;
  transition: border-color 0.2s;
  min-height: 80px;
}
.answer-input-area textarea::placeholder {
  color: var(--lt-text-placeholder);
}
.answer-input-area textarea:focus {
  border-color: var(--lt-brand-light);
}

.answer-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  justify-content: space-between;
}

.reveal-link {
  font-size: 13px;
  color: var(--lt-text-auxiliary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px 0;
  min-height: 36px;
  transition: color 0.15s;
}
.reveal-link:hover:not(:disabled) {
  color: var(--lt-ai);
}
.reveal-link:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.submit-answer-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 22px;
  background: var(--lt-brand);
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
  min-height: 44px;
  box-shadow: 0 2px 8px var(--lt-shadow-blue);
}
.submit-answer-btn:hover:not(:disabled) {
  background: var(--lt-brand-dark);
  transform: translateY(-1px);
  box-shadow: 0 4px 14px var(--lt-shadow-blue);
}
.submit-answer-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 1px 3px var(--lt-shadow-blue);
}
.submit-answer-btn:disabled {
  background: var(--lt-brand-disabled);
  cursor: not-allowed;
  box-shadow: none;
}

/* loading spinner for clock icon */
.loading-spin-svg {
  animation: spinning 1.5s linear infinite;
}
@keyframes spinning {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ===== 总结 ===== */
.guided-summary {
  margin-top: 36px;
  padding: 24px;
  background: linear-gradient(135deg, var(--lt-bg-card) 0%, var(--lt-brand-lightest) 100%);
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-lg);
}
.summary-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--lt-border);
}
.summary-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--lt-brand-lightest), var(--lt-ai-light-9));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--lt-brand);
}
.summary-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--lt-text-primary);
}
.summary-body {
  font-size: 14px;
  line-height: 1.75;
  color: var(--lt-text-secondary);
}

/* ===== 响应式 ===== */
@media (max-width: 767px) {
  .stage-timeline.wide-only {
    display: none;
  }
  .stage-timeline.narrow-only {
    display: block;
  }

  .stage-banner {
    padding: 14px 16px;
    gap: 10px;
  }
  .stage-banner-icon-wrap {
    width: 38px;
    height: 38px;
    border-radius: 10px;
  }
  .stage-banner-title {
    font-size: 14px;
  }
  .stage-banner-desc {
    font-size: 12px;
  }

  .ai-guidance {
    padding: 16px;
    border-radius: 16px 16px 16px 4px;
  }
  .ai-question {
    padding: 16px;
    margin-left: 0;
  }
  .student-message {
    margin-left: 32px;
    padding: 14px 16px;
  }
  .answer-input-area {
    margin-left: 0;
    padding: 16px;
    border-radius: 16px 16px 16px 4px;
  }
  .answer-input-area textarea {
    font-size: 13px;
    min-height: 72px;
  }
  .submit-answer-btn {
    font-size: 13px;
    padding: 10px 18px;
    min-height: 42px;
  }
  .reveal-hint-area {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .guided-summary {
    padding: 18px;
  }
  .narrow-progress {
    justify-content: flex-start;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .narrow-progress::-webkit-scrollbar {
    display: none;
  }
}

@media (min-width: 768px) {
  .stage-timeline.narrow-only {
    display: none;
  }
}
</style>
