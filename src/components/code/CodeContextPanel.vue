<template>
  <div class="code-context-panel">
    <!-- Tabs -->
    <div class="context-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="context-tab"
        :class="{ active: activeTab === tab.key, locked: lockedTab === tab.key }"
        @click="onTabClick(tab.key)"
      >
        <span class="context-tab-icon">{{ tab.icon }}</span>
        <span class="context-tab-label">{{ tab.label }}</span>
        <span v-if="lockedTab === tab.key" class="lock-icon">🔒</span>
      </button>
    </div>

    <!-- Tab Content -->
    <div class="context-content">
      <!-- Steps Tab -->
      <div v-show="activeTab === 'steps'" class="tab-pane steps-pane">
        <div class="steps-progress-bar">
          <div class="steps-progress-fill" :style="{ width: (currentStepIndex / Math.max(steps.length - 1, 1)) * 100 + '%' }" />
        </div>
        <div class="steps-progress-text">{{ currentStepIndex + 1 }} / {{ steps.length }}</div>

        <div
          v-for="(step, i) in steps"
          :key="i"
          class="step-card"
          :class="{
            completed: completedSteps.has(i),
            current: currentStepIndex === i,
            locked: !completedSteps.has(i) && i > currentStepIndex
          }"
          @click="onStepClick(i)"
        >
          <div class="step-card-header">
            <span class="step-status-icon">
              <template v-if="completedSteps.has(i)">✅</template>
              <template v-else-if="currentStepIndex === i">●</template>
              <template v-else-if="i > currentStepIndex">🔒</template>
              <template v-else>○</template>
            </span>
            <span class="step-card-title">{{ step.title }}</span>
          </div>
          <div class="step-card-body">
            <div class="step-card-desc">{{ stepContentPreview(step.content) }}</div>
            <div v-if="step.references.length" class="step-refs">
              <span v-for="ref in step.references" :key="ref.filename + ref.startLine" class="step-ref">
                {{ ref.filename }}:{{ ref.startLine }}-{{ ref.endLine }}
              </span>
            </div>
            <!-- Understanding check -->
            <div v-if="currentStepIndex === i && !completedSteps.has(i)" class="understanding-check">
              <div class="check-label">── 理解检查 ──</div>
              <div class="check-question">{{ getCheckQuestion(i) }}</div>
              <div class="check-options">
                <button
                  v-for="(opt, oi) in getCheckOptions(i)"
                  :key="oi"
                  class="check-option"
                  :class="{
                    correct: checkAnswer === oi && checkCorrect,
                    wrong: checkAnswer === oi && !checkCorrect
                  }"
                  @click="onCheckAnswer(i, oi)"
                >
                  {{ opt }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="steps-nav">
          <el-button
            size="small"
            :disabled="currentStepIndex === 0"
            @click="onStepClick(currentStepIndex - 1)"
          >
            ◀ 上一步
          </el-button>
          <el-button
            size="small"
            :disabled="currentStepIndex >= steps.length - 1"
            @click="onStepClick(currentStepIndex + 1)"
          >
            下一步 ▶
          </el-button>
        </div>
      </div>

      <!-- Variables Tab -->
      <div v-show="activeTab === 'variables'" class="tab-pane variables-pane">
        <div v-if="selectedVariable" class="variable-detail">
          <div class="var-section">
            <div class="var-section-title">📋 定义</div>
            <div class="var-card">
              <div class="var-line">{{ selectedVariable.definition }}</div>
              <div class="var-meta">
                <span class="var-type-tag">{{ selectedVariable.type }}</span>
                <span class="var-scope">{{ selectedVariable.scope }}</span>
              </div>
            </div>
          </div>

          <div class="var-section">
            <div class="var-section-title">🔗 所有引用 ({{ selectedVariable.references.length }}处)</div>
            <div
              v-for="(ref, i) in selectedVariable.references"
              :key="i"
              class="var-ref-row"
              :class="ref.kind"
              @click="$emit('goto-line', ref.line)"
            >
              <span class="var-ref-line">Line {{ ref.line }}</span>
              <span class="var-ref-text">{{ ref.text }}</span>
              <span class="var-ref-kind">{{ ref.kind === 'read' ? '读取' : '写入' }}</span>
            </div>
          </div>

          <div v-if="selectedVariable.initialValue" class="var-section">
            <div class="var-section-title">📊 值变化</div>
            <div class="var-value-row">
              <span class="var-value-label">初始:</span>
              <code class="var-value">{{ selectedVariable.initialValue }}</code>
            </div>
            <div v-if="selectedVariable.finalValue" class="var-value-row">
              <span class="var-value-label">最终:</span>
              <code class="var-value">{{ selectedVariable.finalValue }}</code>
            </div>
          </div>
        </div>

        <div v-else class="tab-empty">
          <div class="empty-title">变量探索</div>
          <div class="empty-desc">点击代码中的变量名查看详情</div>
        </div>
      </div>

      <!-- Trajectory Tab -->
      <div v-show="activeTab === 'trajectory'" class="tab-pane trajectory-pane">
        <div v-if="traces && traces.length > 0" class="trace-content">
          <div class="trace-header">
            执行轨迹 · {{ traces.length }}步 · {{ totalTraceDuration.toFixed(2) }}s
          </div>
          <div class="trace-table">
            <div class="trace-row trace-header-row">
              <span class="trace-col-step">步骤</span>
              <span class="trace-col-line">行号</span>
              <span class="trace-col-scope">作用域变量值</span>
            </div>
            <div
              v-for="(t, i) in traces"
              :key="i"
              class="trace-row"
              :class="{ active: i === currentTraceStep }"
              @click="$emit('goto-line', t.line)"
            >
              <span class="trace-col-step">{{ t.order }}</span>
              <span class="trace-col-line">{{ t.line }}</span>
              <span class="trace-col-scope">{{ formatScope(t.scope) }}</span>
            </div>
          </div>
          <div class="trace-controls">
            <el-button size="small" @click="$emit('trace-jump-start')">⏮</el-button>
            <el-button size="small" @click="$emit('trace-toggle')">
              {{ tracePlaying ? '⏸' : '▶' }}
            </el-button>
            <el-button size="small" @click="$emit('trace-step')">⏭</el-button>
            <div class="trace-speed">
              <button
                v-for="s in [1, 2, 4]"
                :key="s"
                class="speed-btn"
                :class="{ active: traceSpeed === s }"
                @click="$emit('trace-speed', s)"
              >
                {{ s }}x
              </button>
            </div>
          </div>
        </div>
        <div v-else class="tab-empty">
          <div class="empty-title">执行轨迹</div>
          <div class="empty-desc">运行代码后将显示执行路径</div>
        </div>
      </div>

      <!-- Concepts Tab -->
      <div v-show="activeTab === 'concepts'" class="tab-pane concepts-pane">
        <div v-if="currentConcept" class="concept-content">
          <div class="concept-context">当前上下文: {{ currentConcept.context }}</div>
          <div class="concept-title">📖 {{ currentConcept.name }}</div>
          <div class="concept-body">{{ currentConcept.description }}</div>

          <div v-if="currentConcept.syntax" class="concept-section">
            <div class="concept-section-title">📝 语法结构</div>
            <div class="concept-syntax">
              <code v-for="(s, i) in currentConcept.syntax" :key="i">{{ s }}</code>
            </div>
          </div>

          <div v-if="currentConcept.complexity" class="concept-section">
            <div class="concept-section-title">⏱ 复杂度</div>
            <div class="concept-complexity">{{ currentConcept.complexity }}</div>
          </div>

          <div v-if="currentConcept.mistakes && currentConcept.mistakes.length" class="concept-section">
            <div class="concept-section-title">⚠️ 常见错误</div>
            <ul class="concept-mistakes">
              <li v-for="(m, i) in currentConcept.mistakes" :key="i">{{ m }}</li>
            </ul>
          </div>

          <div v-if="currentConcept.related && currentConcept.related.length" class="concept-section">
            <div class="concept-section-title">🔗 相关概念</div>
            <div class="concept-related">
              <button
                v-for="(r, i) in currentConcept.related"
                :key="i"
                class="related-btn"
                @click="$emit('concept-click', r)"
              >
                {{ r }}
              </button>
            </div>
          </div>

          <!-- Extension Challenges -->
          <div v-if="currentConcept.challenges && currentConcept.challenges.length" class="concept-section">
            <div class="concept-section-title challenge-title">
              🏅 扩展挑战
              <span class="challenge-subtitle">完成基础后，尝试:</span>
            </div>
            <div class="challenge-list">
              <div v-for="(ch, i) in currentConcept.challenges" :key="i" class="challenge-item">
                <span class="challenge-desc">{{ ch.description }}</span>
                <el-button size="small" text type="primary" @click="$emit('start-challenge', ch)">
                  [开始挑战]
                </el-button>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="tab-empty">
          <div class="empty-title">概念解释</div>
          <div class="empty-desc">点击行号或选中代码请求解释</div>
        </div>
      </div>

      <!-- AI Tutor Tab -->
      <div v-show="activeTab === 'tutor'" class="tab-pane tutor-pane">
        <div ref="tutorMessages" class="tutor-messages">
          <div
            v-for="(msg, i) in tutorMessages"
            :key="i"
            class="tutor-msg"
            :class="msg.role"
          >
            <div class="tutor-msg-avatar">{{ msg.role === 'user' ? '💬' : '🤖' }}</div>
            <div class="tutor-msg-content">{{ msg.content }}</div>
          </div>
        </div>

        <div class="tutor-quick-questions">
          <button
            v-for="(q, i) in quickQuestions"
            :key="i"
            class="quick-q-btn"
            @click="onQuickQuestion(q)"
          >
            {{ q }}
          </button>
        </div>

        <div class="tutor-input">
          <el-input
            v-model="tutorInput"
            placeholder="输入你的问题..."
            size="small"
            @keyup.enter="sendTutorMsg"
          >
            <template #append>
              <el-button @click="sendTutorMsg" :disabled="!tutorInput.trim()">发送</el-button>
            </template>
          </el-input>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import type { CodeStep, TraceStep, VariableInfo, ContextTab, LearningMode } from '@/types/code'

interface ConceptDisplay {
  context: string
  name: string
  description: string
  syntax?: string[]
  complexity?: string
  mistakes?: string[]
  related?: string[]
  challenges?: { description: string; code?: string; validation?: string }[]
}

const props = defineProps<{
  steps: CodeStep[]
  currentStepIndex: number
  completedSteps: Set<number>
  selectedVariable: VariableInfo | null
  traces: TraceStep[]
  totalTraceDuration: number
  currentTraceStep: number
  tracePlaying: boolean
  traceSpeed: number
  currentConcept: ConceptDisplay | null
  tutorMessages: { role: string; content: string }[]
  mode: LearningMode
}>()

const emit = defineEmits<{
  'step-click': [index: number]
  'goto-line': [line: number]
  'trace-jump-start': []
  'trace-toggle': []
  'trace-step': []
  'trace-speed': [speed: number]
  'concept-click': [name: string]
  'start-challenge': [challenge: any]
  'tutor-send': [text: string]
  'tab-change': [tab: ContextTab]
}>()

const activeTab = ref<ContextTab>('steps')
const lockedTab = ref<ContextTab | null>(null)
const tutorInput = ref('')
const checkAnswer = ref<number | null>(null)
const checkCorrect = ref(false)

const tabs = [
  { key: 'steps' as ContextTab, icon: '📖', label: '步骤' },
  { key: 'variables' as ContextTab, icon: '🔍', label: '变量' },
  { key: 'trajectory' as ContextTab, icon: '📊', label: '轨迹' },
  { key: 'concepts' as ContextTab, icon: '📝', label: '概念' },
  { key: 'tutor' as ContextTab, icon: '💬', label: '助教' },
]

const quickQuestions = ['解释这段', '为什么报错', '如何优化']

function onTabClick(key: ContextTab) {
  if (lockedTab.value === key) {
    lockedTab.value = null
  } else if (activeTab.value === key) {
    lockedTab.value = key
  }
  activeTab.value = key
  emit('tab-change', key)
}

function onStepClick(i: number) {
  if (i > props.currentStepIndex && !props.completedSteps.has(i)) return
  emit('step-click', i)
}

function onCheckAnswer(stepIndex: number, optionIndex: number) {
  checkAnswer.value = optionIndex
  checkCorrect.value = optionIndex === 0
  if (checkCorrect.value) {
    emit('step-click', stepIndex)
  }
}

function onQuickQuestion(q: string) {
  emit('tutor-send', q)
}

function sendTutorMsg() {
  if (!tutorInput.value.trim()) return
  emit('tutor-send', tutorInput.value)
  tutorInput.value = ''
}

const tutorMessages = ref(props.tutorMessages)

function stepContentPreview(content: string): string {
  return content.replace(/<[^>]*>/g, '').substring(0, 60) + (content.length > 60 ? '...' : '')
}

function getCheckQuestion(stepIndex: number): string {
  const questions = [
    'for 关键字在推导式中的作用？',
    '条件过滤如何使用 if 关键字？',
    '如何定义函数参数？',
  ]
  return questions[stepIndex % questions.length]
}

function getCheckOptions(stepIndex: number): string[] {
  const options = [
    ['迭代', '过滤', '映射'],
    ['过滤元素', '排序', '聚合'],
    ['在括号内写参数', '使用 def 关键字', '不需要任何语法'],
  ]
  return options[stepIndex % options.length]
}

function formatScope(scope: Record<string, any>): string {
  try {
    return Object.entries(scope).slice(0, 3).map(([k, v]) => {
      const val = typeof v === 'string' ? v : JSON.stringify(v)
      return `${k}=${val.length > 20 ? val.substring(0, 20) + '...' : val}`
    }).join(', ')
  } catch {
    return ''
  }
}
</script>

<style scoped>
.code-context-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--lt-bg-card);
  border-left: 1px solid var(--lt-border);
}
.context-tabs {
  display: flex;
  border-bottom: 1px solid var(--lt-border);
  flex-shrink: 0;
  overflow-x: auto;
}
.context-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 12px;
  font-size: 13px;
  color: var(--lt-text-auxiliary);
  border: none;
  background: transparent;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}
.context-tab:hover {
  color: var(--lt-text-secondary);
}
.context-tab.active {
  color: var(--lt-brand);
  border-bottom-color: var(--lt-brand);
  font-weight: 500;
}
.context-tab.locked::after {
  content: '🔒';
  font-size: 10px;
  margin-left: 2px;
}
.lock-icon {
  font-size: 10px;
  margin-left: 2px;
}
.context-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}
.tab-pane {
  height: 100%;
}

/* Steps Tab */
.steps-progress-bar {
  height: 4px;
  background: var(--lt-border);
  border-radius: 2px;
  margin-bottom: 4px;
  overflow: hidden;
}
.steps-progress-fill {
  height: 100%;
  background: var(--lt-brand);
  transition: width 0.3s;
}
.steps-progress-text {
  font-size: 11px;
  color: var(--lt-text-auxiliary);
  text-align: right;
  margin-bottom: 12px;
  font-family: var(--lt-font-mono);
}
.step-card {
  padding: 10px 12px;
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-md);
  margin-bottom: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.step-card:hover {
  border-color: var(--lt-brand-lighter);
}
.step-card.current {
  border-color: var(--lt-brand);
  background: rgba(43, 111, 255, 0.04);
}
.step-card.locked {
  opacity: 0.5;
  cursor: default;
}
.step-card.completed {
  border-color: transparent;
  background: var(--lt-bg-page);
}
.step-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
}
.step-status-icon {
  font-size: 12px;
  width: 16px;
  text-align: center;
}
.step-card-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--lt-text-primary);
}
.step-card-body {
  margin-top: 4px;
  font-size: 12px;
  color: var(--lt-text-secondary);
  line-height: 1.5;
}
.step-refs {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.step-ref {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--lt-bg-page);
  font-family: var(--lt-font-mono);
  color: var(--lt-brand);
}
.understanding-check {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--lt-border);
}
.check-label {
  font-size: 11px;
  color: var(--lt-text-auxiliary);
  margin-bottom: 4px;
}
.check-question {
  font-size: 12px;
  color: var(--lt-text-primary);
  margin-bottom: 6px;
  font-weight: 500;
}
.check-options {
  display: flex;
  gap: 6px;
}
.check-option {
  padding: 3px 10px;
  border-radius: var(--lt-radius-sm);
  border: 1px solid var(--lt-border);
  background: var(--lt-bg-card);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.check-option:hover {
  border-color: var(--lt-brand);
  color: var(--lt-brand);
}
.check-option.correct {
  border-color: var(--lt-success);
  background: rgba(52, 199, 89, 0.1);
  color: var(--lt-success);
}
.check-option.wrong {
  border-color: var(--lt-danger);
  background: rgba(255, 59, 48, 0.1);
  color: var(--lt-danger);
}
.steps-nav {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

/* Variables Tab */
.variable-detail { display: flex; flex-direction: column; gap: 12px; }
.var-section-title { font-size: 12px; font-weight: 500; color: var(--lt-text-secondary); margin-bottom: 6px; }
.var-card {
  padding: 8px 10px;
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-md);
  background: var(--lt-bg-page);
}
.var-line {
  font-family: var(--lt-font-mono);
  font-size: 12px;
  color: var(--lt-text-primary);
  margin-bottom: 4px;
}
.var-meta { display: flex; gap: 6px; }
.var-type-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
  font-family: var(--lt-font-mono);
}
.var-scope {
  font-size: 10px;
  color: var(--lt-text-auxiliary);
}
.var-ref-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: var(--lt-radius-sm);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}
.var-ref-row:hover { background: var(--lt-bg-page); }
.var-ref-row.write { border-left: 2px solid var(--lt-orange); }
.var-ref-row.read { border-left: 2px solid var(--lt-brand); }
.var-ref-line { font-family: var(--lt-font-mono); color: var(--lt-text-auxiliary); }
.var-ref-text { flex: 1; color: var(--lt-text-primary); }
.var-ref-kind { font-size: 10px; color: var(--lt-text-auxiliary); }
.var-value-row { display: flex; gap: 6px; padding: 2px 0; font-size: 12px; }
.var-value-label { color: var(--lt-text-secondary); }
.var-value { font-family: var(--lt-font-mono); color: var(--lt-text-primary); }

/* Trajectory Tab */
.trace-header {
  font-size: 12px;
  font-weight: 500;
  color: var(--lt-text-secondary);
  margin-bottom: 8px;
}
.trace-table {
  font-size: 11px;
  font-family: var(--lt-font-mono);
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-md);
  overflow: hidden;
}
.trace-row {
  display: flex;
  padding: 4px 8px;
  border-bottom: 1px solid var(--lt-border);
  transition: background 0.15s;
}
.trace-row:last-child { border-bottom: none; }
.trace-row:hover, .trace-row.active { background: rgba(16, 185, 129, 0.08); }
.trace-header-row {
  background: var(--lt-bg-page);
  font-weight: 500;
  color: var(--lt-text-auxiliary);
}
.trace-col-step { width: 40px; flex-shrink: 0; }
.trace-col-line { width: 40px; flex-shrink: 0; }
.trace-col-scope { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trace-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}
.trace-speed {
  display: flex;
  gap: 2px;
  margin-left: auto;
}
.speed-btn {
  padding: 2px 8px;
  font-size: 11px;
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-sm);
  background: transparent;
  color: var(--lt-text-auxiliary);
  cursor: pointer;
}
.speed-btn.active {
  background: var(--lt-brand);
  color: #fff;
  border-color: var(--lt-brand);
}

/* Concepts Tab */
.concept-content { display: flex; flex-direction: column; gap: 12px; }
.concept-context {
  font-size: 11px;
  color: var(--lt-text-auxiliary);
  margin-bottom: 4px;
}
.concept-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--lt-text-primary);
}
.concept-body {
  font-size: 13px;
  color: var(--lt-text-secondary);
  line-height: 1.7;
}
.concept-section { margin-top: 4px; }
.concept-section-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--lt-text-secondary);
  margin-bottom: 6px;
}
.concept-syntax {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.concept-syntax code {
  padding: 6px 10px;
  background: var(--lt-bg-page);
  border-radius: var(--lt-radius-md);
  font-family: var(--lt-font-mono);
  font-size: 12px;
  border: 1px solid var(--lt-border);
}
.concept-complexity {
  font-size: 12px;
  color: var(--lt-text-primary);
  font-family: var(--lt-font-mono);
}
.concept-mistakes {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  color: var(--lt-text-secondary);
  line-height: 1.8;
}
.concept-related {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.related-btn {
  padding: 3px 10px;
  border: 1px solid var(--lt-brand-lighter);
  border-radius: var(--lt-radius-full);
  background: transparent;
  font-size: 12px;
  color: var(--lt-brand);
  cursor: pointer;
  transition: background 0.15s;
}
.related-btn:hover { background: var(--lt-brand-lightest); }
.challenge-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.challenge-subtitle {
  font-weight: 400;
  font-size: 11px;
  color: var(--lt-text-auxiliary);
}
.challenge-list { display: flex; flex-direction: column; gap: 6px; }
.challenge-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-md);
}
.challenge-desc {
  font-size: 12px;
  color: var(--lt-text-secondary);
  flex: 1;
}

/* AI Tutor Tab */
.tutor-pane { display: flex; flex-direction: column; gap: 8px; }
.tutor-messages {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  max-height: 400px;
}
.tutor-msg {
  display: flex;
  gap: 8px;
  font-size: 13px;
  line-height: 1.6;
}
.tutor-msg.user { flex-direction: row-reverse; }
.tutor-msg-avatar { font-size: 20px; flex-shrink: 0; }
.tutor-msg-content {
  padding: 8px 12px;
  border-radius: var(--lt-radius-md);
  max-width: 85%;
}
.tutor-msg.user .tutor-msg-content {
  background: var(--lt-brand);
  color: #fff;
}
.tutor-msg.assistant .tutor-msg-content {
  background: var(--lt-bg-page);
  color: var(--lt-text-primary);
}
.tutor-quick-questions {
  display: flex;
  gap: 6px;
}
.quick-q-btn {
  padding: 4px 10px;
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-full);
  background: transparent;
  font-size: 12px;
  color: var(--lt-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}
.quick-q-btn:hover {
  border-color: var(--lt-brand);
  color: var(--lt-brand);
}
.tutor-input { flex-shrink: 0; }

/* Empty */
.tab-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}
.empty-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--lt-text-secondary);
  margin-bottom: 6px;
}
.empty-desc {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
}
</style>
