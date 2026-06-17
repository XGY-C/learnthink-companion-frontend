<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTutoringStore } from '@/stores/tutoring'
import { useTutoringSSE } from '@/composables/useTutoringSSE'
import QuestionInput from './QuestionInput.vue'
import ClarificationCard from './ClarificationCard.vue'
import AnalysisBar from './AnalysisBar.vue'
import ContextAwarenessBar from './ContextAwarenessBar.vue'
import AnswerContainer from './AnswerContainer.vue'
import AnswerActionBar from './AnswerActionBar.vue'

const store = useTutoringStore()
const { startTutoring, regenerateSection } = useTutoringSSE()

const globalQuestion = ref('')
const clarificationRound = ref(1)

async function handleSend(question: string) {
  globalQuestion.value = question
  await startTutoring({ question })
}

async function handleClarify(response: {
  skipped: boolean
  selectedOptionId?: string
  freeInput?: string
}) {
  await startTutoring({
    question: globalQuestion.value,
    sessionId: store.sessionId,
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
  if (!store.sessionId) return
  await regenerateSection(store.sessionId, {
    sectionId,
    action: action as 'simplify' | 'switch_angle' | 'followup' | 'more_examples',
    instruction: instruction || null,
  })
}

async function handleRetry() {
  store.reset()
  await startTutoring({ question: globalQuestion.value })
}

const showError = computed(() => store.status === 'error' && !!store.error)
</script>

<template>
  <div
    class="tutoring-main"
    style="max-width: 860px; margin: 0 auto; width: 100%; padding: 24px 20px; flex: 1;"
  >
    <ContextAwarenessBar v-if="store.sessionId" />

    <div class="mb-6">
      <QuestionInput :disabled="store.isStreaming" @send="handleSend" />
    </div>

    <!-- IDLE: welcome -->
    <div
      v-if="store.status === 'idle'"
      class="text-center py-16"
      style="color: var(--lt-text-auxiliary);"
    >
      <div style="font-size: 48px; margin-bottom: 16px;">📖</div>
      <h2 style="font-size: 20px; font-weight: 700; color: var(--lt-text-primary); margin-bottom: 8px;">
        智能辅导
      </h2>
      <p style="font-size: 14px;">输入你的问题，获取 AI 辅导解答</p>
    </div>

    <!-- PLANNING -->
    <div v-if="store.status === 'planning'" class="text-center py-12">
      <div
        class="spinner"
        style="width: 32px; height: 32px; border: 3px solid var(--lt-border); border-top-color: var(--lt-brand); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 12px;"
      ></div>
      <p style="font-size: 14px; color: var(--lt-text-secondary);">正在分析问题...</p>
    </div>

    <!-- CLARIFYING -->
    <div v-if="store.status === 'clarifying' && store.clarification" class="mb-6">
      <ClarificationCard
        :clarification="store.clarification"
        :clarifyWaitSeconds="store.clarifyWaitSeconds"
        :round="clarificationRound"
        @submit="handleClarify"
      />
    </div>

    <!-- PREPARING / GENERATING / DONE -->
    <div
      v-if="['preparing', 'generating', 'done'].includes(store.status) || store.sectionList.length > 0"
    >
      <AnalysisBar v-if="store.analysis" class="mb-6" />

      <div v-if="store.status === 'preparing'" class="text-center py-4">
        <p style="font-size: 13px; color: var(--lt-text-auxiliary);">正在准备资料...</p>
      </div>

      <AnswerContainer @action="handleSectionAction" />

      <AnswerActionBar
        v-if="store.status === 'done' && store.sessionId"
        :sessionId="store.sessionId"
        class="mt-8"
      />

      <div v-if="store.status === 'done'" class="mt-6">
        <div style="font-size: 13px; color: var(--lt-text-auxiliary); margin-bottom: 8px;">
          ── 还有疑问？继续追问 ──
        </div>
        <QuestionInput placeholder="继续追问..." @send="handleSend" />
      </div>
    </div>

    <!-- ERROR -->
    <div
      v-if="showError"
      class="error-card"
      style="background: var(--lt-orange-light-9); border: 1px solid var(--lt-warning); border-radius: var(--lt-radius-lg); padding: 20px; text-align: center;"
    >
      <div style="font-size: 32px; margin-bottom: 8px;">⚠️</div>
      <h3 style="font-size: 16px; font-weight: 600; color: var(--lt-text-primary); margin-bottom: 4px;">
        {{ store.error?.message || '出错了' }}
      </h3>
      <p style="font-size: 13px; color: var(--lt-text-secondary); margin-bottom: 16px;">
        {{ store.error?.code }}
      </p>
      <el-button v-if="store.error?.retryable" type="primary" @click="handleRetry">
        重试
      </el-button>
      <el-button @click="store.reset()">返回</el-button>
    </div>
  </div>
</template>

<style scoped>
@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .tutoring-main {
    padding: 16px 12px !important;
  }
  .tutoring-main .mb-6 {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--lt-bg-page);
    padding-bottom: 8px;
  }
}
</style>
