<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDirectAnswerStore } from '@/stores/directAnswer'
import { useDirectAnswerSSE } from '@/composables/useDirectAnswerSSE'
import { useProfileStore } from '@/stores/profile'
import AnswerHero from '@/components/directanswer/AnswerHero.vue'
import ProblemAnalysis from '@/components/directanswer/ProblemAnalysis.vue'
import StrategyOverview from '@/components/directanswer/StrategyOverview.vue'
import ReasoningTimeline from '@/components/directanswer/ReasoningTimeline.vue'
import MethodSummary from '@/components/directanswer/MethodSummary.vue'
import ErrorWarning from '@/components/directanswer/ErrorWarning.vue'
import KnowledgeTree from '@/components/directanswer/KnowledgeTree.vue'

const route = useRoute()
const router = useRouter()
const store = useDirectAnswerStore()
const profile = useProfileStore()
const { startAnswer, cancelAnswer, error } = useDirectAnswerSSE()

const sessionId = computed(() => route.params.sessionId as string)
const question = computed(() => route.query.q as string || '')
const courseId = computed(() => route.query.courseId as string || profile.activeCourseId || '')
const mode = computed(() => route.query.mode as string || 'direct')

// 将 sections Map 转换为有序数组
const orderedSections = computed(() => {
  const order = ['answer_hero', 'problem_analysis', 'strategy_overview', 'reasoning_chain', 'method_summary', 'error_warning', 'prerequisite_knowledge']
  return order
    .map(id => store.sections.get(id))
    .filter(Boolean) as Array<{ id: string; title: string; status: string; content: string }>
})

onMounted(() => {
  if (sessionId.value && question.value) {
    startAnswer(sessionId.value, question.value, courseId.value, mode.value)
  } else {
    router.push('/chat')
  }
})

onUnmounted(() => {
  cancelAnswer()
})

function handleRetry() {
  if (sessionId.value && question.value) {
    startAnswer(sessionId.value, question.value, courseId.value, mode.value)
  }
}

function handleBack() {
  router.back()
}

// 根据 sectionId 渲染对应组件
function getSectionComponent(id: string) {
  const map: Record<string, any> = {
    answer_hero: AnswerHero,
    problem_analysis: ProblemAnalysis,
    strategy_overview: StrategyOverview,
    reasoning_chain: ReasoningTimeline,
    method_summary: MethodSummary,
    error_warning: ErrorWarning,
    prerequisite_knowledge: KnowledgeTree,
  }
  return map[id] || null
}
</script>

<template>
  <div class="direct-answer-page">
    <!-- 顶部栏 -->
    <header class="da-header">
      <button class="da-back-btn" @click="handleBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        返回
      </button>
      <div class="da-header-center">
        <h1 class="da-title">完整解答</h1>
        <div class="da-progress-bar" v-if="store.progress > 0">
          <div class="da-progress-fill" :style="{ width: (store.progress * 100) + '%' }"></div>
        </div>
      </div>
      <div class="da-header-right">
        <span v-if="store.status === 'generating'" class="da-generating-badge">生成中...</span>
        <span v-else-if="store.status === 'done'" class="da-done-badge">完成</span>
      </div>
    </header>

    <!-- 思考面板（可折叠） -->
    <div v-if="store.thoughtContent" class="da-thinking-panel">
      <details open>
        <summary class="da-thinking-header">
          <span>💭 思考过程</span>
          <span class="da-thinking-tag">AI 推理</span>
        </summary>
        <div class="da-thinking-content">
          {{ store.thoughtContent }}
        </div>
      </details>
    </div>

    <!-- 错误提示 -->
    <div v-if="store.status === 'error'" class="da-error-banner">
      <span class="da-error-icon">⚠️</span>
      <span class="da-error-msg">{{ error?.message || '生成失败' }}</span>
      <button v-if="error?.retryable" class="da-retry-btn" @click="handleRetry">重试</button>
    </div>

    <!-- 加载状态 -->
    <div v-if="store.status === 'analyzing'" class="da-loading">
      <div class="da-spinner"></div>
      <p>正在分析题目...</p>
    </div>

    <div v-if="store.status === 'planning'" class="da-loading">
      <div class="da-spinner"></div>
      <p>正在规划讲解结构...</p>
    </div>

    <!-- 7 段内容区 -->
    <main class="da-content">
      <template v-for="section in orderedSections" :key="section.id">
        <div class="da-section" :class="{ 'da-section-done': section.status === 'done', 'da-section-streaming': section.status === 'streaming' }">
          <div class="da-section-header">
            <span class="da-section-icon" :class="{ done: section.status === 'done' }">
              {{ section.status === 'done' ? '✓' : section.status === 'streaming' ? '⋯' : '' }}
            </span>
            <h2 class="da-section-title">{{ section.title }}</h2>
          </div>
          <div v-if="section.status === 'done' || section.status === 'streaming'" class="da-section-body">
            <component
              :is="getSectionComponent(section.id)"
              :content="section.content"
              :streaming="section.status === 'streaming'"
            />
          </div>
          <div v-else class="da-section-pending">
            <span class="da-pending-tag">等待中</span>
          </div>
        </div>
      </template>
    </main>

    <!-- 底部操作 -->
    <footer v-if="store.status === 'done'" class="da-footer">
      <button class="da-footer-btn" @click="handleBack">继续提问</button>
      <button class="da-footer-btn primary" @click="handleRetry">重新生成</button>
    </footer>
  </div>
</template>

<style scoped>
.direct-answer-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
}

/* Header */
.da-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  backdrop-filter: blur(12px);
  background: rgba(15, 23, 42, 0.8);
  position: sticky;
  top: 0;
  z-index: 100;
  flex-shrink: 0;
}

.da-back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: #94a3b8;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
  flex-shrink: 0;
}
.da-back-btn:hover { border-color: #6366f1; color: #a5b4fc; }

.da-header-center { flex: 1; }
.da-title { font-size: 18px; font-weight: 700; margin: 0 0 6px 0; }

.da-progress-bar {
  height: 3px;
  background: rgba(148, 163, 184, 0.15);
  border-radius: 2px;
  overflow: hidden;
}
.da-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  border-radius: 2px;
  transition: width 0.4s ease;
}

.da-header-right { flex-shrink: 0; }
.da-generating-badge {
  font-size: 12px;
  padding: 4px 10px;
  background: rgba(99, 102, 241, 0.15);
  color: #a5b4fc;
  border-radius: 12px;
  border: 1px solid rgba(99, 102, 241, 0.3);
}
.da-done-badge {
  font-size: 12px;
  padding: 4px 10px;
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
  border-radius: 12px;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

/* Thinking Panel */
.da-thinking-panel {
  margin: 16px 24px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 12px;
  overflow: hidden;
  background: rgba(30, 41, 59, 0.6);
}
.da-thinking-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  font-size: 14px;
  color: #cbd5e1;
}
.da-thinking-tag {
  font-size: 11px;
  padding: 2px 8px;
  background: rgba(99, 102, 241, 0.2);
  color: #a5b4fc;
  border-radius: 8px;
}
.da-thinking-content {
  padding: 0 16px 16px;
  font-size: 13px;
  color: #94a3b8;
  line-height: 1.6;
  white-space: pre-wrap;
  max-height: 240px;
  overflow-y: auto;
}

/* Error */
.da-error-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 24px;
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 10px;
}
.da-error-icon { font-size: 18px; }
.da-error-msg { flex: 1; font-size: 14px; color: #fca5a5; }
.da-retry-btn {
  padding: 6px 16px;
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #fca5a5;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

/* Loading */
.da-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  gap: 16px;
  flex: 1;
}
.da-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(148, 163, 184, 0.2);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.da-loading p { color: #94a3b8; font-size: 14px; }

/* Content */
.da-content {
  flex: 1;
  padding: 8px 24px 24px;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.da-section {
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s ease;
}
.da-section-done {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.08);
}
.da-section-streaming {
  background: rgba(99, 102, 241, 0.05);
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.da-section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.da-section-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  background: rgba(148, 163, 184, 0.1);
  color: #64748b;
}
.da-section-icon.done { background: rgba(34, 197, 94, 0.15); color: #4ade80; }
.da-section-title { font-size: 16px; font-weight: 600; margin: 0; color: #e2e8f0; }

.da-section-body {
  font-size: 14px;
  line-height: 1.75;
  color: #cbd5e1;
}

.da-section-pending {
  padding: 16px 0;
}
.da-pending-tag {
  font-size: 12px;
  color: #64748b;
  padding: 4px 12px;
  border-radius: 6px;
  background: rgba(148, 163, 184, 0.05);
}

/* Footer */
.da-footer {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
  justify-content: center;
  flex-shrink: 0;
}
.da-footer-btn {
  padding: 10px 28px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(148, 163, 184, 0.1);
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: #cbd5e1;
}
.da-footer-btn:hover { background: rgba(148, 163, 184, 0.2); }
.da-footer-btn.primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-color: transparent;
  color: #fff;
}
.da-footer-btn.primary:hover { opacity: 0.9; }

/* ===== 移动端响应式适配 ===== */
@media (max-width: 768px) {
  .direct-answer-page {
    background: linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
  }

  /* Header — 紧凑布局 */
  .da-header {
    padding: 10px 14px;
    gap: 10px;
  }
  .da-back-btn {
    padding: 6px 10px;
    font-size: 12px;
    gap: 2px;
  }
  .da-back-btn svg {
    width: 16px;
    height: 16px;
  }
  .da-title {
    font-size: 15px;
    margin-bottom: 4px;
  }
  .da-progress-bar {
    height: 2px;
  }
  .da-generating-badge,
  .da-done-badge {
    font-size: 11px;
    padding: 3px 8px;
  }

  /* Thinking Panel — 可折叠、更紧凑 */
  .da-thinking-panel {
    margin: 10px 14px;
    border-radius: 10px;
  }
  .da-thinking-header {
    padding: 10px 14px;
    font-size: 13px;
  }
  .da-thinking-content {
    padding: 0 14px 14px;
    font-size: 12px;
    max-height: 180px;
    line-height: 1.5;
  }

  /* Error Banner */
  .da-error-banner {
    margin: 10px 14px;
    padding: 10px 14px;
    gap: 8px;
    border-radius: 8px;
    flex-wrap: wrap;
  }
  .da-error-msg {
    font-size: 12px;
    flex: 1 1 100%;
  }
  .da-retry-btn {
    font-size: 12px;
    padding: 5px 14px;
  }

  /* Loading */
  .da-loading {
    padding: 40px 16px;
    gap: 12px;
  }
  .da-spinner {
    width: 28px;
    height: 28px;
    border-width: 2px;
  }
  .da-loading p {
    font-size: 13px;
  }

  /* Content — 单列、全宽 */
  .da-content {
    padding: 6px 14px 14px;
    max-width: 100%;
    gap: 6px;
  }

  /* Section — 减小内边距 */
  .da-section {
    padding: 14px;
    border-radius: 10px;
  }
  .da-section-header {
    gap: 8px;
    margin-bottom: 10px;
  }
  .da-section-icon {
    width: 20px;
    height: 20px;
    font-size: 10px;
  }
  .da-section-title {
    font-size: 14px;
  }
  .da-section-body {
    font-size: 13px;
    line-height: 1.65;
  }

  .da-pending-tag {
    font-size: 11px;
    padding: 3px 10px;
  }

  /* Footer — 底部固定 */
  .da-footer {
    padding: 10px 14px;
    gap: 8px;
    flex-wrap: wrap;
  }
  .da-footer-btn {
    padding: 8px 20px;
    font-size: 13px;
  }
}

/* 超小屏 (< 480px) 额外调整 */
@media (max-width: 480px) {
  .da-header {
    padding: 8px 10px;
    gap: 6px;
  }
  .da-back-btn {
    padding: 5px 8px;
    font-size: 11px;
  }
  .da-title {
    font-size: 14px;
  }
  .da-thinking-panel {
    margin: 8px 10px;
  }
  .da-content {
    padding: 4px 10px 10px;
    gap: 4px;
  }
  .da-section {
    padding: 12px;
  }
  .da-section-title {
    font-size: 13px;
  }
  .da-section-body {
    font-size: 12px;
  }
  .da-footer {
    padding: 8px 10px;
    gap: 6px;
  }
  .da-footer-btn {
    padding: 7px 16px;
    font-size: 12px;
    flex: 1;
  }
}
</style>
