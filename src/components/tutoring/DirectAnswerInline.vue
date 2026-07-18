<script setup lang="ts">
/**
 * 直接模式内联渲染组件。
 * 视觉对标 demo/direct-answer-demo.v1.html。
 */
import { ref, computed } from 'vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import ThoughtChainTimeline from '@/components/ThoughtChainTimeline.vue'
import DirectAnswerStructured from '@/components/tutoring/DirectAnswerStructured.vue'
import type {
  DirectAnswerSectionState,
  DirectAnswerStatus,
  ProblemAnalysis,
  ConditionMapping,
  AnswerMetadata,
} from '@/types/directAnswer'

interface DirectAnswerSnapshot {
  sections: DirectAnswerSectionState[]
  thoughtContent?: string
  metadata?: AnswerMetadata | null
  analysis?: ProblemAnalysis | null
}

const props = defineProps<{
  store: {
    status: DirectAnswerStatus
    thoughtContent: string
    sections: Map<string, DirectAnswerSectionState> | { forEach: (fn: (v: DirectAnswerSectionState) => void) => void }
    analysis?: ProblemAnalysis | null
    metadata?: AnswerMetadata | null
  }
  isCompleted: boolean
  snapshot: DirectAnswerSnapshot | null
}>()

const analysisData = computed<ProblemAnalysis | null>(() =>
  props.snapshot?.analysis ?? props.store.analysis ?? null
)
const metaData = computed<AnswerMetadata | null>(() =>
  props.snapshot?.metadata ?? props.store.metadata ?? null
)

const thoughtExpanded = ref(false)

const sectionList = computed<DirectAnswerSectionState[]>(() => {
  if (props.snapshot?.sections?.length) return props.snapshot.sections
  const map = props.store.sections
  if (map instanceof Map) return Array.from(map.values())
  const arr: DirectAnswerSectionState[] = []
  if (map && typeof map.forEach === 'function') map.forEach((v: DirectAnswerSectionState) => arr.push(v))
  return arr
})

const thoughtText = computed(() => props.snapshot?.thoughtContent ?? props.store.thoughtContent)

const statusText = computed(() => {
  const s = props.store.status
  const map: Record<string, string> = {
    analyzing: '正在分析题目类型...',
    planning: '正在规划讲解结构...',
    generating: '正在生成解答...',
    done: '',
    error: '出错了',
  }
  return map[s] || ''
})

const sectionOrder = ['answer_hero', 'problem_analysis', 'strategy_overview', 'reasoning_chain', 'method_summary', 'error_warning', 'prerequisite_knowledge']

const orderedSections = computed(() =>
  [...sectionList.value].sort((a, b) => sectionOrder.indexOf(a.id) - sectionOrder.indexOf(b.id))
)

const answerSection = computed(() => orderedSections.value.find(s => s.id === 'answer_hero'))
const bodySections = computed(() => orderedSections.value.filter(s => s.id !== 'answer_hero'))

/** 去重：按段落检测重复（以空行为分隔） */
function dedupParagraphs(content: string): string {
  const paragraphs = content.split(/\n{2,}/)
  const seen = new Set<string>()
  const result: string[] = []
  for (const p of paragraphs) {
    const key = p.replace(/\s+/g, ' ').trim().slice(0, 120)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(p)
  }
  return result.join('\n\n')
}

const dedupContent = computed(() => dedupParagraphs(answerSection.value?.content || ''))

// ─── helpers for metadata bar ───
function typeLabel(t: string | undefined | null): string {
  if (!t) return ''
  const m: Record<string, string> = { '求解': '求解', '证明': '证明', '探索': '探索' }
  return m[t] || t
}
function typeClass(t: string | undefined | null): string {
  if (!t) return 'solve'
  const m: Record<string, string> = { '求解': 'solve', '证明': 'prove', '探索': 'explore' }
  return m[t] || 'solve'
}
function diffLabel(d: string | undefined | null): string {
  if (!d) return ''
  const m: Record<string, string> = { 'beginner': '基础', 'intermediate': '进阶', 'advanced': '高级' }
  return m[d] || d
}
function diffColor(d: string | undefined | null): string {
  if (!d) return '#8C8478'
  const m: Record<string, string> = { 'beginner': 'var(--lt-success)', 'intermediate': '#faad14', 'advanced': '#ff4d4f' }
  return m[d] || '#8C8478'
}
</script>

<template>
  <div class="da-inline">
    <!-- 思考过程 -->
    <ThoughtChainTimeline
      v-if="thoughtText"
      :steps="[{ label: 'AI 思考轨迹', icon: 'thought', done: isCompleted, phase: 'DECISION' as const, detail: '', thought: thoughtText }]"
      :is-streaming="!isCompleted"
      v-model:expanded="thoughtExpanded"
      class="da-thought"
    />

    <!-- 状态 -->
    <div v-if="!isCompleted && statusText" class="da-status">
      <span class="da-status-dot" /> {{ statusText }}
    </div>

    <!-- Step 1: 答案先行 -->
    <div v-if="answerSection" class="da-hero">
      <div class="da-hero-badge">✦ 最终答案</div>
      <div class="da-hero-body">
        <MarkdownViewer :content="dedupContent || answerSection.title" :showToc="false" />
      </div>
      <div class="da-hero-hint">带着答案看过程 —— 每一步推理你都清楚终点在哪里</div>
    </div>

    <!-- ═══ 题目分析卡片 ═══ -->
    <div v-if="analysisData || metaData" class="da-meta-bar">
      <div class="da-meta-row">
        <span v-if="analysisData?.problemType || metaData?.problemType" class="da-meta-type" :class="'da-meta-type--' + typeClass(analysisData?.problemType || metaData?.problemType)">
          {{ typeLabel(analysisData?.problemType || metaData?.problemType) }}
        </span>
        <span v-if="analysisData?.difficulty || metaData?.difficulty" class="da-meta-diff" :style="{ color: diffColor(analysisData?.difficulty || metaData?.difficulty) }">
          {{ diffLabel(analysisData?.difficulty || metaData?.difficulty) }}
        </span>
        <span v-if="analysisData?.subject || metaData?.subject" class="da-meta-subject">{{ analysisData?.subject || metaData?.subject }}</span>
      </div>
      <div v-if="(analysisData?.tags || metaData?.tags)?.length" class="da-meta-tags">
        <span v-for="t in (analysisData?.tags || metaData?.tags || [])" :key="t" class="da-meta-tag">{{ t }}</span>
      </div>
      <div v-if="analysisData?.overallSummary" class="da-meta-summary">{{ analysisData.overallSummary }}</div>
    </div>

    <!-- Step 2-7 -->
    <div v-for="(s, i) in bodySections" :key="s.id" class="da-section">
      <div class="da-section-head">
        <span class="da-step-num">{{ i + 2 }}</span>
        <span class="da-step-title">{{ s.title }}</span>
        <span v-if="s.status === 'streaming' && !s.content" class="da-section-badge">生成中...</span>
      </div>
      <div class="da-section-body">
        <!-- 流式骨架 -->
        <div v-if="s.status === 'streaming' && !s.content" class="da-stream-skeleton">
          <div class="da-sk-line" />
          <div class="da-sk-line short" />
          <div class="da-sk-line medium" />
        </div>
        <!-- 内容 -->
        <template v-else>
          <!-- problem_analysis / reasoning_chain: 结构化渲染 -->
          <DirectAnswerStructured
            v-if="s.id === 'problem_analysis' || s.id === 'reasoning_chain'"
            :section="s"
          />
          <!-- 其他 section: markdown -->
          <MarkdownViewer v-else :content="s.content" :showToc="false" />
          <span v-if="s.status === 'streaming' && s.content" class="da-cursor" />
        </template>
      </div>
    </div>

    <!-- 无section时的全骨架 -->
    <div v-if="orderedSections.length === 0 && !isCompleted" class="da-empty">
      <div class="da-skeleton" />
      <div class="da-skeleton short" />
      <div class="da-skeleton medium" />
    </div>
  </div>
</template>

<style scoped>
/* ═══ 容器 ═══ */
.da-inline {
  width: 100%;
  font-family: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
  padding: 4px 0 0;
}

/* ═══ 思考 ═══ */
.da-thought { margin-bottom: 20px; }

/* ═══ 状态 ═══ */
.da-status {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: #8C8478;
  margin-bottom: 18px;
}
.da-status-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #C4820E;
  animation: da-pulse 1.2s ease-in-out infinite;
}
@keyframes da-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.15; } }

/* ═══ Answer Hero ═══ */
.da-hero {
  text-align: center;
  padding: 32px 12px 28px;
  margin-bottom: 36px;
  position: relative;
}
.da-hero::after {
  content: '';
  position: absolute;
  bottom: 0; left: 20%; width: 60%; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.05) 20%, rgba(0, 0, 0, 0.05) 80%, transparent);
}
.da-hero-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 600; letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #1B7A4A;
  margin-bottom: 14px;
  padding: 3px 12px; border-radius: 9999px;
  background: rgba(27, 122, 74, 0.05);
  border: 1px solid rgba(27, 122, 74, 0.07);
}
.da-hero-body :deep(.markdown-content) {
  font-family: "Fraunces", Georgia, serif;
  font-size: clamp(1.05rem, 2.5vw, 1.3rem);
  font-weight: 700;
  letter-spacing: -0.015em;
  line-height: 1.4;
  color: #1C1814;
  max-width: 500px; margin: 0 auto;
}
.da-hero-body :deep(.markdown-content strong),
.da-hero-body :deep(.markdown-content .katex) {
  color: #C4820E;
}
.da-hero-hint {
  margin-top: 12px;
  font-size: 11px;
  color: #8C8478;
  max-width: 360px; margin-left: auto; margin-right: auto;
  line-height: 1.5;
}

/* ═══ Metadata Bar ═══ */
.da-meta-bar {
  margin-bottom: 36px;
  padding-bottom: 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}
.da-meta-row {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  margin-bottom: 8px;
}
.da-meta-type {
  display: inline-flex; align-items: center;
  padding: 3px 12px; border-radius: 9999px;
  font-size: 10px; font-weight: 600; letter-spacing: 0.04em;
  border: 1px solid;
}
.da-meta-type--solve {
  color: #C4820E; background: rgba(196, 130, 14, 0.05);
  border-color: rgba(196, 130, 14, 0.08);
}
.da-meta-type--prove {
  color: #1B7A4A; background: rgba(27, 122, 74, 0.05);
  border-color: rgba(27, 122, 74, 0.08);
}
.da-meta-type--explore {
  color: #1B4F8A; background: rgba(27, 79, 138, 0.05);
  border-color: rgba(27, 79, 138, 0.08);
}
.da-meta-diff {
  font-size: 10px; font-weight: 600;
}
.da-meta-subject {
  font-size: 11px; color: #8C8478;
}
.da-meta-tags {
  display: flex; flex-wrap: wrap; gap: 5px;
  margin-bottom: 8px;
}
.da-meta-tag {
  font-size: 10px; padding: 2px 9px; border-radius: 9999px;
  background: rgba(196, 130, 14, 0.04);
  color: #C4820E; border: 1px solid rgba(196, 130, 14, 0.06);
}
.da-meta-summary {
  font-size: 12px; color: #6B6358; line-height: 1.6;
}

/* ═══ Section Blocks ═══ */
.da-section {
  margin-bottom: 36px;
}
.da-section:last-child { margin-bottom: 0; }

.da-section-head {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 14px;
}
.da-step-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 50%;
  font-size: 11px; font-weight: 700;
  background: rgba(196, 130, 14, 0.06);
  color: #C4820E;
  border: 1px solid rgba(196, 130, 14, 0.06);
  flex-shrink: 0;
}
.da-step-title {
  font-family: "Fraunces", Georgia, serif;
  font-size: 16px; font-weight: 700;
  letter-spacing: -0.01em;
  color: #1C1814;
}

/* streaming badge */
.da-section-badge {
  font-size: 10px; font-weight: 500; color: #C4820E;
  animation: da-pulse 1.2s ease-in-out infinite;
}
.da-stream-skeleton {
  padding: 4px 0;
}
.da-sk-line {
  height: 12px; border-radius: 3px; margin-bottom: 8px;
  background: linear-gradient(90deg, rgba(196,130,14,0.06) 25%, rgba(196,130,14,0.12) 50%, rgba(196,130,14,0.06) 75%);
  background-size: 200% 100%;
  animation: sk-shimmer 1.4s ease-in-out infinite;
  width: 100%;
}
.da-sk-line.short { width: 55%; }
.da-sk-line.medium { width: 80%; }
@keyframes sk-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.da-section-body {
  padding-left: 36px;
  font-size: 14px;
  line-height: 1.85;
  color: #4A443C;
}
.da-section-body :deep(.markdown-content) {
  font-size: inherit; line-height: inherit; color: inherit;
}
.da-section-body :deep(.markdown-content p) {
  margin: 8px 0;
}
.da-section-body :deep(.markdown-content strong) {
  color: #C4820E; font-weight: 600;
}
.da-section-body :deep(.markdown-content code) {
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  background: rgba(196, 130, 14, 0.06);
  color: #C4820E;
  padding: 1px 6px; border-radius: 4px;
}
.da-section-body :deep(.markdown-content h1),
.da-section-body :deep(.markdown-content h2),
.da-section-body :deep(.markdown-content h3) {
  font-family: "Fraunces", Georgia, serif;
  color: #1C1814;
  margin: 16px 0 8px;
}
.da-section-body :deep(.markdown-content table) {
  border-collapse: collapse; margin: 10px 0; font-size: 13px;
}
.da-section-body :deep(.markdown-content th),
.da-section-body :deep(.markdown-content td) {
  padding: 6px 12px; border: 1px solid rgba(0, 0, 0, 0.05);
}
.da-section-body :deep(.markdown-content th) {
  background: rgba(196, 130, 14, 0.03); font-weight: 600; font-size: 11px;
}
.da-section-body :deep(.markdown-content ul),
.da-section-body :deep(.markdown-content ol) {
  padding-left: 20px; margin: 8px 0;
}
.da-section-body :deep(.markdown-content li) {
  margin: 4px 0; line-height: 1.7;
}

/* ═══ Cursor ═══ */
.da-cursor {
  display: inline-block; width: 8px; height: 16px;
  background: #C4820E; margin-left: 2px;
  vertical-align: text-bottom; border-radius: 1px;
  animation: da-blink 0.8s ease-in-out infinite;
}
@keyframes da-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.1; } }

/* ═══ Skeleton ═══ */
.da-empty { padding: 8px 0; }
.da-skeleton {
  height: 14px; border-radius: 4px;
  background: linear-gradient(90deg, rgba(196,130,14,0.04) 25%, rgba(196,130,14,0.08) 50%, rgba(196,130,14,0.04) 75%);
  background-size: 200% 100%;
  animation: da-shimmer 1.5s ease-in-out infinite;
  margin-bottom: 10px; width: 100%;
}
.da-skeleton.short { width: 55%; }
.da-skeleton.medium { width: 75%; }
@keyframes da-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
