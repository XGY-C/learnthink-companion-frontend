<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTutoringStore } from '@/stores/tutoring'
import { useTutoringSSE } from '@/composables/useTutoringSSE'
import { useSmartSSE } from '@/composables/useSmartSSE'
import { useDirectAnswerInlineSSE } from '@/composables/useDirectAnswerInlineSSE'
import { useDirectAnswerStore } from '@/stores/directAnswer'
import TutoringInput from './TutoringInput.vue'
import ClarificationCard from './ClarificationCard.vue'
import AnalysisBar from './AnalysisBar.vue'
import ContextAwarenessBar from './ContextAwarenessBar.vue'
import AnswerContainer from './AnswerContainer.vue'
import AnswerActionBar from './AnswerActionBar.vue'
import GuidedDialogue from './GuidedDialogue.vue'
import DirectAnswerInline from './DirectAnswerInline.vue'
import ThoughtChainTimeline from '@/components/ThoughtChainTimeline.vue'
import SmartVisualRenderer from '@/components/smart/SmartVisualRenderer.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import type { TutoringMode } from '@/types/tutoring'

const props = defineProps<{
  visible: boolean
  initialQuestion?: string
  courseId?: string
}>()

const emit = defineEmits<{
  close: []
}>()

// ── Three separate pipelines ──
const tutoringStore = useTutoringStore()
const { startTutoring, regenerateSection, cancel: cancelTutoring } = useTutoringSSE()
const smart = useSmartSSE()
const directAnswerStore = useDirectAnswerStore()
const { start: directStart, cancel: directCancel, error: directError } = useDirectAnswerInlineSSE()

// ── Shared state ──
const activeMode = ref<TutoringMode | null>(null)
const globalQuestion = ref('')
const clarificationRound = ref(1)

// ── Computed: busy / error / done ──
const isBusy = computed(() => {
  if (activeMode.value === 'smart') return smart.isStreaming.value
  if (activeMode.value === 'direct') {
    return ['analyzing', 'planning', 'generating'].includes(directAnswerStore.status)
  }
  if (activeMode.value === 'guided') return tutoringStore.isStreaming
  return false
})

const showError = computed(() => {
  if (activeMode.value === 'smart') return !!smart.error.value
  if (activeMode.value === 'direct') return !!directError.value
  if (activeMode.value === 'guided') return tutoringStore.status === 'error' && !!tutoringStore.error
  return false
})

const errorMessage = computed(() => {
  if (activeMode.value === 'smart') return smart.error.value?.message || '出错了'
  if (activeMode.value === 'direct') return directError.value?.message || '出错了'
  if (activeMode.value === 'guided') return tutoringStore.error?.message || '出错了'
  return '出错了'
})

const errorCode = computed(() => {
  if (activeMode.value === 'smart') return smart.error.value?.code || ''
  if (activeMode.value === 'direct') return directError.value?.code || ''
  if (activeMode.value === 'guided') return tutoringStore.error?.code || ''
  return ''
})

const errorRetryable = computed(() => {
  if (activeMode.value === 'smart') return smart.error.value?.retryable ?? true
  if (activeMode.value === 'direct') return directError.value?.retryable ?? true
  if (activeMode.value === 'guided') return tutoringStore.error?.retryable ?? true
  return true
})

const isDone = computed(() => {
  if (activeMode.value === 'smart') return smart.isCompleted.value
  if (activeMode.value === 'direct') return directAnswerStore.status === 'done'
  if (activeMode.value === 'guided') return tutoringStore.status === 'done'
  return false
})

// ── Reset all when drawer closes ──
watch(() => props.visible, (val) => {
  if (!val) {
    cancelTutoring()
    smart.cancel()
    directCancel()
    tutoringStore.reset()
    smart.reset()
    directAnswerStore.reset()
    activeMode.value = null
    globalQuestion.value = ''
    clarificationRound.value = 1
  }
})

// ── Dispatch by mode ──
async function handleSend(question: string, mode: TutoringMode, isVideo: boolean) {
  globalQuestion.value = question
  activeMode.value = mode

  if (mode === 'smart' || isVideo) {
    smart.reset()
    await smart.start(question, props.courseId || '')
    return
  }

  if (mode === 'direct') {
    directAnswerStore.reset()
    await directStart(question, props.courseId || '', 'direct')
    return
  }

  // guided (and any other mode) -> tutoring pipeline
  tutoringStore.reset()
  await startTutoring({ question, mode, courseId: props.courseId || null })
}

async function handleClarify(response: {
  skipped: boolean
  selectedOptionId?: string
  freeInput?: string
}) {
  await startTutoring({
    question: globalQuestion.value,
    sessionId: tutoringStore.sessionId,
    courseId: props.courseId || null,
    clarificationResponse: {
      skipped: response.skipped,
      selectedOptionId: response.selectedOptionId || null,
      freeInput: response.freeInput || null,
    },
  })
  clarificationRound.value++
}

async function handleSectionAction(
  sectionId: string,
  action: string,
  instruction?: string
) {
  if (!tutoringStore.sessionId) return
  await regenerateSection(tutoringStore.sessionId, {
    sectionId,
    action: action as 'simplify' | 'switch_angle' | 'followup' | 'more_examples',
    instruction: instruction || null,
  })
}

async function handleRetry() {
  const q = globalQuestion.value
  if (activeMode.value === 'smart') {
    smart.reset()
    await smart.start(q, props.courseId || '')
  } else if (activeMode.value === 'direct') {
    directAnswerStore.reset()
    await directStart(q, props.courseId || '', 'direct')
  } else {
    tutoringStore.reset()
    await startTutoring({ question: q, courseId: props.courseId || null })
  }
}

function handleClose() {
  emit('close')
}

// Whether guided tutoring has content to show
const guidedActive = computed(() =>
  activeMode.value === 'guided' ||
  (activeMode.value === null && tutoringStore.status !== 'idle')
)
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="visible" class="drawer-overlay" @click.self="handleClose">
        <div class="drawer-panel">
          <div class="drawer-header">
            <span class="drawer-title">智能辅导</span>
            <button class="drawer-close" @click="handleClose">✕</button>
          </div>

          <div class="drawer-body">
            <!-- ═══ IDLE: welcome ═══ -->
            <div v-if="!activeMode" class="drawer-idle">
              <div class="idle-icon">📖</div>
              <h3 class="idle-title">智能辅导</h3>
              <p class="idle-desc">输入你的问题，获取 AI 辅导解答</p>
            </div>

            <!-- ═══ SMART mode ═══ -->
            <template v-if="activeMode === 'smart'">
              <ContextAwarenessBar v-if="smart.sessionId.value" />
              <!-- Thinking chain -->
              <ThoughtChainTimeline
                v-if="smart.thinkingSteps.value.length > 0"
                :steps="smart.thinkingSteps.value"
                :is-streaming="smart.isStreaming.value"
                :expanded="smart.thinkingExpanded.value"
                @update:expanded="smart.thinkingExpanded.value = $event"
                class="drawer-section-spacing"
              />
              <!-- Content blocks -->
              <template v-for="(block, bi) in smart.blocks.value" :key="bi">
                <div v-if="block.type === 'text'" class="smart-text-block">
                  <MarkdownViewer :content="block.content" :show-toc="false" />
                </div>
                <div v-else-if="block.type === 'visual'" class="smart-visual-block">
                  <SmartVisualRenderer
                    :render-type="block.renderType"
                    :code="block.code"
                    :description="block.description"
                    :status="block.status"
                  />
                </div>
              </template>
              <!-- Streaming text -->
              <div v-if="smart.isStreaming.value && smart.streamingText.value" class="smart-text-block">
                <pre class="streaming-text">{{ smart.streamingText.value }}</pre>
                <span class="streaming-cursor" />
              </div>
              <!-- Loading cursor -->
              <div v-if="smart.isStreaming.value && !smart.streamingText.value && smart.blocks.value.length === 0" class="smart-loading">
                <span class="streaming-cursor" />
              </div>
            </template>

            <!-- ═══ DIRECT mode ═══ -->
            <template v-if="activeMode === 'direct' && directAnswerStore.status !== 'idle'">
              <DirectAnswerInline
                :store="directAnswerStore"
                :is-completed="directAnswerStore.status === 'done'"
                :snapshot="null"
              />
            </template>

            <!-- ═══ GUIDED mode (tutoring pipeline) ═══ -->
            <template v-if="guidedActive">
              <ContextAwarenessBar v-if="tutoringStore.sessionId" />

              <!-- Planning -->
              <div v-if="tutoringStore.status === 'planning'" class="drawer-loading">
                <div class="spinner"></div>
                <p>正在分析问题...</p>
              </div>

              <!-- Clarifying -->
              <div v-if="tutoringStore.status === 'clarifying' && tutoringStore.clarification">
                <ClarificationCard
                  :clarification="tutoringStore.clarification"
                  :clarify-wait-seconds="tutoringStore.clarifyWaitSeconds"
                  :round="clarificationRound"
                  @submit="handleClarify"
                />
              </div>

              <!-- Preparing / Generating / Done -->
              <div
                v-if="['preparing', 'generating', 'done'].includes(tutoringStore.status) || tutoringStore.sectionList.length > 0"
              >
                <AnalysisBar v-if="tutoringStore.analysis" class="drawer-section-spacing" />

                <div v-if="tutoringStore.status === 'preparing'" class="drawer-loading-sm">
                  <p>正在准备资料...</p>
                </div>

                <AnswerContainer @action="handleSectionAction" />

                <AnswerActionBar
                  v-if="tutoringStore.status === 'done' && tutoringStore.sessionId"
                  :session-id="tutoringStore.sessionId"
                  class="drawer-section-spacing"
                />
              </div>

              <!-- Guided dialogue -->
              <div v-if="tutoringStore.status === 'guided' || tutoringStore.guidedSteps.length > 0">
                <AnalysisBar v-if="tutoringStore.analysis" class="drawer-section-spacing" />
                <GuidedDialogue />
              </div>
            </template>

            <!-- ═══ ERROR (all modes) ═══ -->
            <div v-if="showError" class="drawer-error-card">
              <div class="error-icon">⚠️</div>
              <h4 class="error-title">{{ errorMessage }}</h4>
              <p v-if="errorCode" class="error-code">{{ errorCode }}</p>
              <div class="error-actions">
                <el-button v-if="errorRetryable" type="primary" size="small" @click="handleRetry">
                  重试
                </el-button>
                <el-button size="small" @click="activeMode = null; tutoringStore.reset(); smart.reset(); directAnswerStore.reset()">返回</el-button>
              </div>
            </div>
          </div>

          <div class="drawer-footer">
            <div v-if="isDone" class="followup-hint">
              ── 还有疑问？继续追问 ──
            </div>
            <TutoringInput
              :placeholder="isDone ? '继续追问...' : '输入你的问题...'"
              :disabled="isBusy"
              :hide-test-mode="true"
              :initial-text="!activeMode ? initialQuestion : ''"
              @send="handleSend"
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 1500;
  display: flex;
  justify-content: flex-end;
}

.drawer-panel {
  width: 480px;
  max-width: 100vw;
  height: 100vh;
  background: var(--lt-bg-page);
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--lt-border);
  flex-shrink: 0;
  background: var(--lt-bg-card);
}

.drawer-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--lt-text-primary);
}

.drawer-close {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--lt-text-auxiliary);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.15s;
}
.drawer-close:hover { color: var(--lt-text-primary); background: var(--lt-bg-page); }

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.drawer-section-spacing {
  margin-bottom: 16px;
}

/* IDLE */
.drawer-idle {
  text-align: center;
  padding: 48px 0;
  color: var(--lt-text-auxiliary);
}
.idle-icon {
  font-size: 48px;
  margin-bottom: 16px;
}
.idle-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--lt-text-primary);
  margin-bottom: 8px;
}
.idle-desc {
  font-size: 14px;
}

/* Loading */
.drawer-loading {
  text-align: center;
  padding: 40px 0;
}
.drawer-loading p {
  font-size: 14px;
  color: var(--lt-text-secondary);
  margin-top: 12px;
}
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--lt-border);
  border-top-color: var(--lt-brand);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.drawer-loading-sm {
  text-align: center;
  padding: 16px 0;
}
.drawer-loading-sm p {
  font-size: 13px;
  color: var(--lt-text-auxiliary);
}

/* Smart mode */
.smart-text-block {
  margin-bottom: 12px;
}
.smart-visual-block {
  margin-bottom: 16px;
  border-radius: var(--lt-radius-lg);
  overflow: hidden;
}
.streaming-text {
  white-space: pre-wrap;
  font-size: 14px;
  line-height: 1.7;
  color: var(--lt-text-primary);
  font-family: inherit;
  margin: 0;
}
.streaming-cursor {
  display: inline-block;
  width: 8px;
  height: 16px;
  background: var(--lt-brand);
  animation: cursor-blink 1s step-end infinite;
  vertical-align: text-bottom;
  border-radius: 1px;
}
@keyframes cursor-blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
.smart-loading {
  padding: 20px 0;
  text-align: center;
}

/* Follow-up hint */
.followup-hint {
  font-size: 13px;
  color: var(--lt-text-auxiliary);
  text-align: center;
  margin-bottom: 8px;
}

/* Error */
.drawer-error-card {
  background: var(--lt-orange-light-9);
  border: 1px solid var(--lt-warning);
  border-radius: var(--lt-radius-lg);
  padding: 20px;
  text-align: center;
}
.error-icon {
  font-size: 32px;
  margin-bottom: 8px;
}
.error-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--lt-text-primary);
  margin-bottom: 4px;
}
.error-code {
  font-size: 13px;
  color: var(--lt-text-secondary);
  margin-bottom: 16px;
}
.error-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.drawer-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--lt-border);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--lt-bg-card);
}

/* 过渡动画 */
.drawer-enter-active { transition: all 0.3s ease; }
.drawer-leave-active { transition: all 0.2s ease; }
.drawer-enter-from { opacity: 0; }
.drawer-enter-from .drawer-panel { transform: translateX(100%); }
.drawer-enter-to { opacity: 1; }
.drawer-enter-to .drawer-panel { transform: translateX(0); }
.drawer-leave-from { opacity: 1; }
.drawer-leave-from .drawer-panel { transform: translateX(0); }
.drawer-leave-to { opacity: 0; }
.drawer-leave-to .drawer-panel { transform: translateX(100%); }

@media (max-width: 768px) {
  .drawer-overlay { align-items: flex-end; }
  .drawer-panel {
    width: 100vw;
    height: 80vh;
    border-radius: 20px 20px 0 0;
  }
  .drawer-enter-from .drawer-panel { transform: translateY(100%); }
  .drawer-enter-to .drawer-panel { transform: translateY(0); }
  .drawer-leave-from .drawer-panel { transform: translateY(0); }
  .drawer-leave-to .drawer-panel { transform: translateY(100%); }
}
</style>
