<script setup lang="ts">
import { computed, watch, ref } from 'vue'
import type { ThinkingStep } from '@/types'
import MarkdownViewer from '@/components/MarkdownViewer.vue'

const props = withDefaults(defineProps<{
  steps: ThinkingStep[]
  isStreaming?: boolean
  expanded?: boolean
}>(), {
  isStreaming: false,
  expanded: false,
})

const emit = defineEmits<{
  (e: 'update:expanded', val: boolean): void
  (e: 'done'): void
}>()

// ── 步骤分类 ──
const REASONING_PHASES = new Set(['CONTEXT', 'DECISION', 'PLANNING'])
const TOOL_CALL_PHASES = new Set(['RETRIEVE', 'REFLECT', 'RAG'])
const ERROR_PHASES = new Set(['ERROR'])

function stepCategory(step: ThinkingStep): 'reasoning' | 'tool_call' | 'error' | 'unknown' {
  if (step.phase && ERROR_PHASES.has(step.phase)) return 'error'
  if (step.phase && REASONING_PHASES.has(step.phase)) return 'reasoning'
  if (step.phase && TOOL_CALL_PHASES.has(step.phase)) return 'tool_call'
  if (step.observation || step.thought || step.decision) return 'reasoning'
  return 'unknown'
}

function confidenceLabel(level: string): string {
  if (level === 'high') return '确信度高'
  if (level === 'medium') return '确信度中'
  if (level === 'low') return '确信度低'
  return level
}

function relevanceLabel(rel: number | string): string {
  const n = typeof rel === 'string' ? parseFloat(rel) : rel
  if (n >= 0.7) return '高'
  if (n >= 0.4) return '中'
  return '低'
}

// ── 衍生状态 ──
const completedCount = computed(() => props.steps.filter(s => s.done).length)
const totalCount = computed(() => props.steps.length)
const allDone = computed(() => totalCount.value > 0 && completedCount.value >= totalCount.value && !props.isStreaming)
const progressPercent = computed(() =>
  totalCount.value === 0 ? 0 : Math.round((completedCount.value / totalCount.value) * 100)
)

const headerText = computed(() => {
  if (totalCount.value === 0) return '正在思考...'
  if (props.isStreaming) return `思考中 · ${completedCount.value}/${totalCount.value} 步`
  return `思考完成 · ${completedCount.value}/${totalCount.value} 步`
})

function stepStatus(index: number): 'done' | 'active' | 'pending' {
  const step = props.steps[index]
  if (step.done) return 'done'
  const firstIncomplete = props.steps.findIndex(s => !s.done)
  if (index === firstIncomplete) return 'active'
  return 'pending'
}

// ── 搜索来源展开状态 ──
const expandedSources = ref<Record<number, boolean>>({})

function toggleSourcesExpanded(index: number) {
  expandedSources.value[index] = !expandedSources.value[index]
}

function isSourcesExpanded(index: number): boolean {
  return !!expandedSources.value[index]
}

// ── favicon 工具函数 ──
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function getFaviconUrl(url: string): string {
  const domain = extractDomain(url)
  return `https://${domain}/favicon.ico`
}

function onFaviconError(e: Event) {
  const img = e.target as HTMLImageElement
  const container = img.parentElement
  if (container) {
    img.style.display = 'none'
    container.classList.add('favicon-failed')
  }
}

// ── 自动折叠 ──
watch(allDone, (val) => {
  if (val) {
    setTimeout(() => {
      if (!props.expanded) return
      emit('update:expanded', false)
      emit('done')
    }, 600)
  }
})

function toggleExpanded() {
  emit('update:expanded', !props.expanded)
}
</script>

<template>
  <div class="tct" :class="{ 'tct-done': allDone }">
    <!-- 头部：状态 + 进度条 + 折叠 -->
    <button class="tct-header" @click="toggleExpanded">
      <span class="tct-h-left">
        <svg class="tct-h-thinking" :class="{ 'is-done': allDone }" width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path class="tct-think-blades" fill-rule="evenodd" clip-rule="evenodd" d="M9.97165 1.29981C11.5853 0.718916 13.271 0.642197 14.3144 1.68555C15.3577 2.72902 15.2811 4.41466 14.7002 6.02833C14.4707 6.66561 14.1504 7.32937 13.75 8.00001C14.1504 8.67062 14.4707 9.33444 14.7002 9.97169C15.2811 11.5854 15.3578 13.271 14.3144 14.3145C13.271 15.3579 11.5854 15.2811 9.97165 14.7002C9.3344 14.4708 8.67059 14.1505 7.99997 13.75C7.32933 14.1505 6.66558 14.4708 6.02829 14.7002C4.41461 15.2811 2.72899 15.3578 1.68552 14.3145C0.642155 13.271 0.71887 11.5854 1.29977 9.97169C1.52915 9.33454 1.84865 8.67049 2.24899 8.00001C1.84866 7.32953 1.52915 6.66544 1.29977 6.02833C0.718852 4.41459 0.64207 2.729 1.68552 1.68555C2.72897 0.642112 4.41456 0.718887 6.02829 1.29981C6.66541 1.52918 7.32949 1.8487 7.99997 2.24903C8.67045 1.84869 9.33451 1.52919 9.97165 1.29981ZM12.9404 9.2129C12.4391 9.893 11.8616 10.5681 11.2148 11.2149C10.568 11.8616 9.89296 12.4391 9.21286 12.9404C9.62532 13.1579 10.0271 13.338 10.4121 13.4766C11.9146 14.0174 12.9172 13.8738 13.3955 13.3955C13.8737 12.9173 14.0174 11.9146 13.4765 10.4121C13.3379 10.0271 13.1578 9.62535 12.9404 9.2129ZM3.05856 9.2129C2.84121 9.62523 2.66197 10.0272 2.52341 10.4121C1.98252 11.9146 2.12627 12.9172 2.60446 13.3955C3.08278 13.8737 4.08544 14.0174 5.58786 13.4766C5.97264 13.338 6.37389 13.1577 6.7861 12.9404C6.10624 12.4393 5.43168 11.8614 4.78513 11.2149C4.13823 10.5679 3.55992 9.89313 3.05856 9.2129ZM7.99899 3.792C7.23179 4.31419 6.45306 4.95512 5.70407 5.70411C4.95509 6.45309 4.31415 7.23184 3.79196 7.99903C4.3143 8.76666 4.95471 9.54653 5.70407 10.2959C6.45309 11.0449 7.23271 11.6848 7.99997 12.207C8.76725 11.6848 9.54683 11.0449 10.2959 10.2959C11.0449 9.54686 11.6848 8.76729 12.207 8.00001C11.6848 7.23275 11.0449 6.45312 10.2959 5.70411C9.5465 4.95475 8.76662 4.31434 7.99899 3.792ZM5.58786 2.52344C4.08533 1.98255 3.08272 2.12625 2.60446 2.6045C2.12621 3.08275 1.98252 4.08536 2.52341 5.5879C2.66189 5.97253 2.8414 6.37409 3.05856 6.78614C3.55983 6.10611 4.1384 5.43189 4.78513 4.78516C5.43186 4.13843 6.10606 3.55987 6.7861 3.0586C6.37405 2.84144 5.97249 2.66192 5.58786 2.52344ZM13.3955 2.6045C12.9172 2.12631 11.9146 1.98257 10.4121 2.52344C10.0272 2.66201 9.62519 2.84125 9.21286 3.0586C9.8931 3.55996 10.5679 4.13827 11.2148 4.78516C11.8614 5.43172 12.4392 6.10627 12.9404 6.78614C13.1577 6.37393 13.338 5.97267 13.4765 5.5879C14.0174 4.08549 13.8736 3.08281 13.3955 2.6045Z" />
          <path class="tct-think-dot" d="M8.00192 6.64454C8.75026 6.64454 9.35732 7.25169 9.35739 8.00001C9.35739 8.74838 8.7503 9.35548 8.00192 9.35548C7.25367 9.35533 6.64743 8.74829 6.64743 8.00001C6.6475 7.25178 7.25371 6.64468 8.00192 6.64454Z" />
        </svg>
        <span class="tct-h-title">{{ headerText }}</span>
      </span>
      <span v-if="totalCount > 0" class="tct-h-progress">
        <span class="tct-h-track">
          <span class="tct-h-fill" :style="{ width: progressPercent + '%' }" />
        </span>
      </span>
      <span class="tct-h-arrow" :class="{ rotated: props.expanded }">▾</span>
    </button>

    <!-- 时间线体 -->
    <Transition name="tct-slide">
      <div v-if="props.expanded && totalCount > 0" class="tct-body">
        <div
          v-for="(step, i) in props.steps"
          :key="i"
          class="tct-row"
          :class="[
            'tct-' + stepStatus(i),
            'tct-cat-' + stepCategory(step),
          ]"
        >
          <!-- 左侧标记列 -->
          <div class="tct-marker">
            <div class="tct-dot" :class="{ 'tct-dot-green': step.done }">
              <span class="tct-dot-icon">{{ step.icon }}</span>
              <span v-if="step.done" class="tct-dot-badge">✓</span>
              <span v-if="stepStatus(i) === 'active'" class="tct-ring" />
            </div>
            <div v-if="i < totalCount - 1" class="tct-line" :class="{ 'tct-line-done': step.done }" />
          </div>

          <!-- 右侧内容 -->
          <div class="tct-content">
            <div class="tct-label-row">
              <span class="tct-label">{{ step.label }}</span>
              <span
                v-if="step.done && step.confidenceLevel"
                class="tct-badge"
                :class="'badge-' + step.confidenceLevel"
              >{{ confidenceLabel(step.confidenceLevel) }}</span>
            </div>

            <!-- 推理卡片（reasoning 类型步骤 + 有 details） -->
            <div
              v-if="step.done && stepCategory(step) === 'reasoning' && (step.context || step.observation || step.thought || step.decision)"
              class="tct-card"
            >
              <div v-if="step.context" class="tct-r-line">
                <span class="tct-r-key">上下文</span>
                <MarkdownViewer :content="step.context" :showToc="false" />
              </div>
              <div v-if="step.observation" class="tct-r-line">
                <span class="tct-r-key">观察</span>
                <MarkdownViewer :content="step.observation" :showToc="false" />
              </div>
              <div v-if="step.thought" class="tct-r-line">
                <span class="tct-r-key">思考</span>
                <MarkdownViewer :content="step.thought" :showToc="false" />
              </div>
              <div v-if="step.decision" class="tct-r-line">
                <span class="tct-r-key">决策</span>
                <MarkdownViewer :content="step.decision" :showToc="false" />
              </div>
            </div>

            <!-- 工具步骤详情 + 搜索来源 -->
            <div v-else-if="step.done && (step.detail || (step.sources && step.sources.length))">
              <p v-if="step.detail" class="tct-detail">{{ step.detail }}</p>

              <!-- 来源展示：web_search 工具（URL 来源）或 rag_retrieve 工具（知识库来源） -->
              <div v-if="step.sources && step.sources.length > 0">
                <!-- web_search：网页来源 -->
                <div v-if="step.sources[0]?.type === 'web' || step.sources[0]?.url" class="tct-search-sources">
                  <div class="tct-search-summary">
                    <svg class="tct-search-icon" width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.5"/>
                      <path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    <span class="tct-search-count">搜索到 {{ step.sources.length }} 个网页</span>
                    <div class="tct-favicon-stack">
                      <span
                        v-for="(src, si) in step.sources.slice(0, 4)"
                        :key="si"
                        class="tct-favicon-item"
                        :style="{ '--icon-index': si }"
                      >
                        <img :src="getFaviconUrl(src.url!)" @error="onFaviconError" />
                        <span class="tct-favicon-fallback">{{ extractDomain(src.url!)[0]?.toUpperCase() || '?' }}</span>
                      </span>
                    </div>
                  </div>

                  <div class="tct-pages-section">
                    <div class="tct-pages-header">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <rect x="3" y="2" width="10" height="12" rx="1" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                      </svg>
                      <span>浏览 {{ step.sources.length }} 个页面</span>
                    </div>
                    <div class="tct-pages-list">
                      <a
                        v-for="(src, si) in (isSourcesExpanded(i) ? step.sources : step.sources.slice(0, 3))"
                        :key="si"
                        :href="src.url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="tct-page-link"
                      >
                        <span class="tct-page-icon">
                          <img :src="getFaviconUrl(src.url!)" @error="onFaviconError" />
                          <span class="tct-page-icon-fallback">{{ extractDomain(src.url!)[0]?.toUpperCase() || '?' }}</span>
                        </span>
                        <span class="tct-page-title">{{ src.title }}</span>
                        <svg class="tct-page-arrow" width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M3 7L7 3M7 3H4M7 3V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </a>
                    </div>
                    <button
                      v-if="step.sources.length > 3"
                      class="tct-pages-toggle"
                      @click="toggleSourcesExpanded(i)"
                    >
                      {{ isSourcesExpanded(i) ? '收起' : '查看全部' }}
                    </button>
                  </div>
                </div>

                <!-- rag_retrieve：知识库来源 -->
                <div v-else class="tct-rag-sources">
                  <div class="tct-rag-summary">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M2 3.5v9A1.5 1.5 0 003.5 14h9a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0012.5 2h-9A1.5 1.5 0 002 3.5z" stroke="currentColor" stroke-width="1.2"/>
                      <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                    </svg>
                    <span class="tct-rag-count">检索到 {{ step.sources.length }} 条知识库资料</span>
                  </div>
                  <div class="tct-rag-list">
                    <div
                      v-for="(src, si) in (isSourcesExpanded(i) ? step.sources : step.sources.slice(0, 3))"
                      :key="si"
                      class="tct-rag-item"
                    >
                      <div class="tct-rag-item-header">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                          <path d="M2 3v10a1 1 0 001 1h10a1 1 0 001-1V5l-3-3H3a1 1 0 00-1 1z" stroke="currentColor" stroke-width="1.2"/>
                          <path d="M11 2v3h3" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
                        </svg>
                        <span class="tct-rag-item-title">{{ src.title }}</span>
                        <span v-if="src.relevance != null" class="tct-rag-relevance" :class="'rel-' + relevanceLabel(src.relevance)">
                          {{ relevanceLabel(src.relevance) }}
                        </span>
                      </div>
                      <p v-if="src.snippet" class="tct-rag-item-quote">{{ src.snippet }}</p>
                      <span v-if="src.locator" class="tct-rag-item-locator">{{ src.locator }}</span>
                    </div>
                  </div>
                  <button
                    v-if="step.sources.length > 3"
                    class="tct-rag-toggle"
                    @click="toggleSourcesExpanded(i)"
                  >
                    {{ isSourcesExpanded(i) ? '收起' : '查看全部' }}
                  </button>
                </div>
              </div>
            </div>

            <!-- 等待中 -->
            <p v-else-if="stepStatus(i) === 'pending'" class="tct-waiting">等待中...</p>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ===== 容器 ===== */
.tct {
  border-radius: 12px;
  border: 1px solid var(--lt-border);
  background-color: var(--lt-bg-card);
  overflow: hidden;
  user-select: none;
  transition: border-color 0.3s;
}
.tct.tct-done {
  border-color: rgba(52, 199, 89, 0.15);
  background-color: rgba(52, 199, 89, 0.03);
}

/* ===== 头部 ===== */
.tct-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 14px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
}
.tct-header:hover {
  background-color: rgba(0,0,0,0.02);
}
.tct-h-left {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
/* 思考图标：思考中旋转蓝色，完成态静止绿色 */
.tct-h-thinking {
  flex-shrink: 0;
}
.tct-h-thinking .tct-think-blades {
  fill: var(--lt-brand);
  transform-box: fill-box;
  transform-origin: center;
  animation: tct-think-spin 6s linear infinite;
}
.tct-h-thinking .tct-think-dot {
  fill: var(--lt-brand-light-2);
  transform-box: fill-box;
  transform-origin: center;
  animation: tct-think-pulse 2s ease-in-out infinite;
}
/* 完成态：停止动画，改为成功绿，中心点降低透明度形成两色调 */
.tct-h-thinking.is-done .tct-think-blades {
  fill: var(--lt-success);
  animation: none;
}
.tct-h-thinking.is-done .tct-think-dot {
  fill: var(--lt-success);
  opacity: 0.5;
  animation: none;
}
@keyframes tct-think-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes tct-think-pulse {
  0%, 100% { transform: scale(1); opacity: 0.85; }
  50% { transform: scale(1.25); opacity: 1; }
}
.tct-h-title {
  font-weight: 600;
  color: var(--lt-text-secondary);
  white-space: nowrap;
}
.tct-done .tct-h-title {
  color: var(--lt-text-auxiliary);
}
.tct-h-progress {
  flex: 1;
  min-width: 40px;
}
.tct-h-track {
  display: block;
  height: 3px;
  border-radius: 4px;
  background-color: var(--lt-border);
  overflow: hidden;
}
.tct-h-fill {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--lt-brand), var(--lt-brand-light-2));
  transition: width 0.5s ease;
}
.tct-h-arrow {
  font-size: 12px;
  color: var(--lt-text-placeholder);
  transition: transform 0.25s ease;
  flex-shrink: 0;
}
.tct-h-arrow.rotated {
  transform: rotate(180deg);
}

/* ===== 时间线体 ===== */
.tct-body {
  padding: 0 14px 10px;
  display: flex;
  flex-direction: column;
}

/* ===== 行 ===== */
.tct-row {
  display: flex;
  gap: 10px;
}

/* ===== 标记列 ===== */
.tct-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 28px;
  flex-shrink: 0;
}
.tct-row:last-child .tct-marker {
  /* last row — no padding needed after line */
}
.tct-dot {
  position: relative;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}
.tct-dot-icon {
  font-size: 13px;
  line-height: 1;
  position: relative;
  z-index: 1;
  transition: transform 0.3s ease;
}
.tct-dot-green {
  background-color: rgba(52, 199, 89, 0.12) !important;
}
.tct-dot-badge {
  position: absolute;
  bottom: -2px;
  right: -3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: var(--lt-success);
  color: #fff;
  font-size: 8px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  z-index: 2;
  box-shadow: 0 0 0 2px var(--lt-bg-card);
}
.tct-line {
  width: 2px;
  flex: 1;
  min-height: 20px;
  border-radius: 2px;
  margin-top: 4px;
  background-color: var(--lt-border);
  transition: background-color 0.35s;
}
.tct-line.tct-line-done {
  background-color: rgba(52, 199, 89, 0.2);
}
.tct-ring {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  animation: ring-pulse 1.5s ease-out infinite;
}
@keyframes ring-pulse {
  0% { box-shadow: 0 0 0 0 rgba(43, 111, 255, 0.2); }
  100% { box-shadow: 0 0 0 10px rgba(43, 111, 255, 0); }
}

/* ===== 内容列 ===== */
.tct-content {
  flex: 1;
  min-width: 0;
  padding-top: 3px;
  padding-bottom: 10px;
}
.tct-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.tct-label {
  font-size: 13px;
  font-weight: 500;
  transition: color 0.3s;
}

/* ===== 确信度徽章 ===== */
.tct-badge {
  flex-shrink: 0;
  font-size: 10px;
  padding: 0 6px;
  border-radius: 4px;
  line-height: 1.6;
}
.badge-high {
  background-color: rgba(52, 199, 89, 0.12);
  color: var(--lt-success);
}
.badge-medium {
  background-color: rgba(255, 159, 10, 0.12);
  color: var(--lt-warning);
}
.badge-low {
  background-color: rgba(245, 108, 108, 0.12);
  color: var(--lt-danger);
}

/* ===== 推理卡片 ===== */
.tct-card {
  margin-top: 6px;
  background-color: var(--lt-bg-page);
  border: 1px solid var(--lt-border);
  border-radius: 8px;
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.tct-r-line {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  font-size: 12px;
  line-height: 1.5;
}
.tct-r-key {
  flex-shrink: 0;
  font-weight: 600;
  font-size: 10px;
  padding: 0 4px;
  border-radius: 3px;
  line-height: 1.6;
  background-color: rgba(43, 111, 255, 0.08);
  color: var(--lt-brand);
}
.tct-r-line :deep(.markdown-content) {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--lt-text-secondary);
}
.tct-r-line :deep(.markdown-content p) {
  margin: 4px 0;
}
.tct-r-line :deep(.markdown-content code) {
  font-size: 11px;
}
.tct-r-line :deep(.markdown-content pre) {
  font-size: 11px;
  padding: 8px;
  margin: 6px 0;
}

/* ===== 工具步骤详情 ===== */
.tct-detail {
  margin-top: 4px;
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  line-height: 1.5;
}

/* ===== 搜索来源展示 ===== */
.tct-search-sources {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 搜索概要行 */
.tct-search-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--lt-text-secondary);
}
.tct-search-icon {
  color: var(--lt-text-auxiliary);
  flex-shrink: 0;
}
.tct-search-count {
  font-weight: 500;
}

/* favicon 叠加栈 */
.tct-favicon-stack {
  display: flex;
  align-items: center;
  margin-left: auto;
}
.tct-favicon-item {
  position: relative;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1.5px solid var(--lt-bg-card);
  background-color: var(--lt-bg-page);
  overflow: hidden;
  margin-left: -6px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tct-favicon-item:first-child {
  margin-left: 0;
}
.tct-favicon-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.tct-favicon-fallback {
  display: none;
  font-size: 8px;
  font-weight: 700;
  color: var(--lt-text-auxiliary);
}
.tct-favicon-item.favicon-failed img {
  display: none;
}
.tct-favicon-item.favicon-failed .tct-favicon-fallback {
  display: flex;
}

/* 浏览页面列表 */
.tct-pages-section {
  border: 1px solid var(--lt-border);
  border-radius: 8px;
  overflow: hidden;
}
.tct-pages-header {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--lt-text-secondary);
  background-color: var(--lt-bg-page);
  border-bottom: 1px solid var(--lt-border);
}
.tct-pages-list {
  display: flex;
  flex-direction: column;
}
.tct-page-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--lt-text-secondary);
  text-decoration: none;
  border-bottom: 1px solid var(--lt-border);
  transition: background-color 0.15s;
  cursor: pointer;
}
.tct-page-link:last-child {
  border-bottom: none;
}
.tct-page-link:hover {
  background-color: var(--lt-bg-page);
  color: var(--lt-brand);
}
.tct-page-icon {
  position: relative;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--lt-bg-page);
}
.tct-page-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.tct-page-icon-fallback {
  display: none;
  font-size: 9px;
  font-weight: 700;
  color: var(--lt-text-auxiliary);
}
.tct-page-icon.favicon-failed img {
  display: none;
}
.tct-page-icon.favicon-failed .tct-page-icon-fallback {
  display: flex;
}
.tct-page-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tct-page-arrow {
  color: var(--lt-text-placeholder);
  flex-shrink: 0;
  transition: color 0.15s;
}
.tct-page-link:hover .tct-page-arrow {
  color: var(--lt-brand);
}

/* 查看全部 / 收起 按钮 */
.tct-pages-toggle {
  width: 100%;
  padding: 5px;
  border: none;
  border-top: 1px solid var(--lt-border);
  background-color: var(--lt-bg-page);
  font-size: 11px;
  color: var(--lt-brand);
  cursor: pointer;
  transition: background-color 0.15s;
}
.tct-pages-toggle:hover {
  background-color: rgba(43, 111, 255, 0.05);
}

/* ===== 知识库来源展示（rag_retrieve） ===== */
.tct-rag-sources {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tct-rag-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--lt-text-secondary);
}
.tct-rag-count {
  font-weight: 500;
}
.tct-rag-list {
  border: 1px solid var(--lt-border);
  border-radius: 8px;
  overflow: hidden;
}
.tct-rag-item {
  padding: 8px 10px;
  border-bottom: 1px solid var(--lt-border);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tct-rag-item:last-child {
  border-bottom: none;
}
.tct-rag-item-header {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--lt-text-secondary);
}
.tct-rag-item-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}
.tct-rag-relevance {
  flex-shrink: 0;
  font-size: 10px;
  padding: 0 5px;
  border-radius: 3px;
  line-height: 1.6;
}
.rel-高 {
  background-color: rgba(52, 199, 89, 0.12);
  color: var(--lt-success);
}
.rel-中 {
  background-color: rgba(255, 159, 10, 0.12);
  color: var(--lt-warning);
}
.rel-低 {
  background-color: rgba(245, 108, 108, 0.12);
  color: var(--lt-danger);
}
.tct-rag-item-quote {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--lt-text-auxiliary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tct-rag-item-locator {
  font-size: 10px;
  color: var(--lt-text-placeholder);
}
.tct-rag-toggle {
  width: 100%;
  padding: 5px;
  border: none;
  border-top: 1px solid var(--lt-border);
  background-color: var(--lt-bg-page);
  font-size: 11px;
  color: var(--lt-brand);
  cursor: pointer;
  transition: background-color 0.15s;
}
.tct-rag-toggle:hover {
  background-color: rgba(43, 111, 255, 0.05);
}

/* ===== 等待中 ===== */
.tct-waiting {
  margin-top: 4px;
  font-size: 11px;
  color: var(--lt-text-disabled);
}

/* ===== 步骤状态样式 ===== */
/* pending */
.tct-pending .tct-dot {
  background-color: var(--lt-bg-page);
}
.tct-pending .tct-dot-icon {
  opacity: 0.35;
  filter: grayscale(1);
}
.tct-pending .tct-label {
  color: var(--lt-text-placeholder);
}

/* active — 推理步骤（蓝色） */
.tct-cat-reasoning.tct-active .tct-dot {
  background-color: var(--lt-brand-light-9);
  box-shadow: 0 0 0 4px rgba(43, 111, 255, 0.12);
}
.tct-cat-reasoning.tct-active .tct-dot-icon {
  transform: scale(1.15);
}
.tct-cat-reasoning.tct-active .tct-label {
  color: var(--lt-brand);
  font-weight: 600;
}

/* active — 工具步骤（紫色） */
.tct-cat-tool_call.tct-active .tct-dot {
  background-color: var(--lt-ai-light-9, rgba(124, 92, 252, 0.08));
  box-shadow: 0 0 0 4px rgba(124, 92, 252, 0.15);
}
.tct-cat-tool_call.tct-active .tct-dot-icon {
  transform: scale(1.15);
}
.tct-cat-tool_call.tct-active .tct-label {
  color: var(--lt-ai, #7C5CFC);
  font-weight: 600;
}

/* error — 红色（done 状态覆盖） */
.tct-cat-error .tct-dot {
  background-color: rgba(245, 108, 108, 0.12);
}
.tct-cat-error .tct-dot-icon {
  color: var(--lt-danger);
}
.tct-cat-error .tct-label {
  color: var(--lt-danger);
  font-weight: 600;
}
.tct-cat-error .tct-detail {
  color: var(--lt-danger);
}

/* done */
.tct-done .tct-dot {
  background-color: rgba(52, 199, 89, 0.08);
}
.tct-done .tct-dot-icon {
  filter: none;
  opacity: 1;
}
.tct-done .tct-label {
  color: var(--lt-text-auxiliary);
}

/* ===== 过渡动画 ===== */
.tct-slide-enter-active,
.tct-slide-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}
.tct-slide-enter-from,
.tct-slide-leave-to {
  opacity: 0;
  max-height: 0;
}
.tct-slide-enter-to,
.tct-slide-leave-from {
  opacity: 1;
  max-height: 600px;
}
</style>
