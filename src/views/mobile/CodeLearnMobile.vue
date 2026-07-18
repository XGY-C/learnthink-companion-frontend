<template>
  <div class="code-learn-mobile">
    <!-- Top Navigation -->
    <div class="mob-topbar">
      <div class="mob-topbar-left">
        <button class="mob-back-btn" aria-label="返回" @click="handleBack">
          <el-icon :size="20"><ArrowLeft /></el-icon>
        </button>
      </div>
      <div class="mob-topbar-center">
        <div class="mob-title-row">
          <span class="mob-title">📘 {{ content.title }}</span>
          <span class="mob-difficulty">{{ diffLabel }}</span>
        </div>
        <div class="mob-progress-row">
          <div class="mob-progress-dots">
            <span
              v-for="i in content.steps.length"
              :key="i"
              class="mob-dot"
              :class="{
                done: i <= completedSteps.size,
                current: i === currentStepIndex + 1 && !completedSteps.has(i - 1)
              }"
              @click="jumpToStep(i - 1)"
            />
          </div>
          <span class="mob-progress-text">{{ completedSteps.size }}/{{ content.steps.length }}</span>
        </div>
      </div>
      <div class="mob-topbar-right">
        <button class="mob-menu-btn" aria-label="菜单" @click="showMenu = !showMenu">
          <el-icon :size="20"><MoreFilled /></el-icon>
        </button>
      </div>
    </div>

    <!-- Dropdown Menu -->
    <Transition name="mob-dropdown">
      <div v-if="showMenu" class="mob-dropdown-overlay" @click="showMenu = false">
        <div class="mob-dropdown-menu" @click.stop>
          <button class="mob-dropdown-item" :class="{ active: mode === 'read' }" @click="setMode('read')">
            <span>● 阅读模式</span>
            <span class="mob-dropdown-desc">代码只读，骨架展开</span>
          </button>
          <button class="mob-dropdown-item" :class="{ active: mode === 'guide' }" @click="setMode('guide')">
            <span>○ 引导模式</span>
            <span class="mob-dropdown-desc">关键行留空填空</span>
          </button>
          <button class="mob-dropdown-item" :class="{ active: mode === 'edit' }" @click="setMode('edit')">
            <span>○ 编辑模式</span>
            <span class="mob-dropdown-desc">完全可编辑运行</span>
          </button>
          <div class="mob-dropdown-divider" />
          <button class="mob-dropdown-item" :disabled="runState === 'running'" @click="handleRun">
            ▶ 运行代码
          </button>
          <button class="mob-dropdown-item" @click="handleReset">
            ↺ 重置代码
          </button>
          <button class="mob-dropdown-item" @click="handleCopy">
            📋 复制代码
          </button>
        </div>
      </div>
    </Transition>

    <!-- Split Pane -->
    <div class="mob-split" ref="splitRef" @touchstart="onSplitTouchStart" @touchmove="onSplitTouchMove">
      <!-- Code Area (top) -->
      <div class="mob-code-area" :style="{ height: codeAreaHeight + 'px' }">
        <!-- Learning Goals (collapsible) -->
        <div class="mob-goals-bar" @click="goalsExpanded = !goalsExpanded">
          <span>{{ goalsExpanded ? '▾' : '▸' }} 学习目标 · {{ content.learningGoals?.length || 0 }}个</span>
          <span class="mob-goals-status">{{ achievedGoalIds.size }}/{{ content.learningGoals?.length || 0 }} 已达成</span>
        </div>
        <div v-if="goalsExpanded" class="mob-goals-body">
          <div
            v-for="g in content.learningGoals"
            :key="g.id"
            class="mob-goal-item"
            :class="{ achieved: achievedGoalIds.has(g.id) }"
            @click="onGoalClick(g.id)"
          >
            <span>{{ achievedGoalIds.has(g.id) ? '✅' : '⬜' }}</span>
            <span class="mob-goal-text">{{ g.description }}</span>
          </div>
        </div>

        <!-- Code Editor -->
        <div class="mob-editor-wrap" ref="editorWrapRef"
          @touchstart="onSwipeStart"
          @touchend="onSwipeEnd">
          <!-- Skeleton Fold Overlays -->
          <div
            v-for="r in visibleFolds"
            :key="r.startLine"
            class="mob-fold-overlay"
            :style="foldStyle(r)"
            @click="toggleFold(r.startLine)"
          >
            <div class="mob-fold-placeholder">
              <span>📎</span>
              <span class="mob-fold-title">{{ r.title }}</span>
            </div>
          </div>

          <CodeEditorPanel
            :content="editedContent"
            :language="content.language"
            :read-only="mode !== 'edit'"
            :highlighted-lines="highlightedLines"
            :gutter-markers="editorGutterMarkers"
            :guided-blanks="guidedBlanksData"
            @update:content="onCodeEdit"
            @gutter-click="onEditorGutterClick"
            @selection-change="onSelectionChange"
          />
        </div>

        <!-- Mini toolbar (only run + step nav) -->
        <div class="mob-mini-toolbar">
          <div class="mob-step-nav">
            <button class="mob-step-btn" :disabled="currentStepIndex === 0" @click="prevStep">
              ◀
            </button>
            <span class="mob-step-label">Step {{ currentStepIndex + 1 }}/{{ content.steps.length }}</span>
            <button class="mob-step-btn" :disabled="currentStepIndex >= content.steps.length - 1" @click="nextStep">
              ▶
            </button>
          </div>
          <button
            class="mob-run-btn"
            :class="{ running: runState === 'running' }"
            :disabled="mode === 'read' || runState === 'running'"
            @click="handleRun"
          >
            ▶
          </button>
        </div>
      </div>

      <!-- Draggable Divider -->
      <div class="mob-divider" ref="dividerRef">
        <div class="mob-divider-line" />
      </div>

      <!-- Context Panel (bottom) -->
      <div class="mob-panel-area" :style="{ height: panelAreaHeight + 'px' }">
        <div class="mob-panel-tabs">
          <button
            v-for="t in panelTabs"
            :key="t.key"
            class="mob-panel-tab"
            :class="{ active: activeTab === t.key }"
            @click="activeTab = t.key"
          >
            {{ t.icon }} {{ t.label }}
          </button>
        </div>

        <div class="mob-panel-content">
          <!-- Steps Tab -->
          <div v-if="activeTab === 'steps'" class="mob-tab-body">
            <div
              v-for="(step, i) in content.steps"
              :key="i"
              class="mob-step-card"
              :class="{ current: currentStepIndex === i, done: completedSteps.has(i), locked: i > currentStepIndex && !completedSteps.has(i) }"
              @click="jumpToStep(i)"
            >
              <div class="mob-step-header">
                <span class="mob-step-icon">{{ completedSteps.has(i) ? '✅' : currentStepIndex === i ? '●' : i > currentStepIndex ? '🔒' : '○' }}</span>
                <span class="mob-step-title">{{ step.title }}</span>
              </div>
              <div class="mob-step-body">{{ stripHtml(step.content) }}</div>
            </div>
          </div>

          <!-- Variables Tab -->
          <div v-if="activeTab === 'variables'" class="mob-tab-body">
            <div v-if="selectedVar" class="mob-var-detail">
              <div class="mob-var-def">
                <div class="mob-var-line">{{ selectedVar.definition }}</div>
                <div class="mob-var-meta">
                  <span class="mob-var-type">{{ selectedVar.type }}</span>
                  <span>{{ selectedVar.scope }}</span>
                </div>
              </div>
              <div v-if="selectedVar.references.length" class="mob-var-refs">
                <div class="mob-section-title">引用 ({{ selectedVar.references.length }})</div>
                <div v-for="(ref, i) in selectedVar.references" :key="i" class="mob-var-ref" @click="gotoLine(ref.line)">
                  L{{ ref.line }} {{ ref.text }}
                </div>
              </div>
            </div>
            <div v-else class="mob-empty">点击代码中的变量名查看详情</div>
          </div>

          <!-- Concepts Tab -->
          <div v-if="activeTab === 'concepts'" class="mob-tab-body">
            <div v-if="currentConcept" class="mob-concept">
              <div class="mob-concept-title">📖 {{ currentConcept.name }}</div>
              <div class="mob-concept-desc">{{ currentConcept.description }}</div>
              <div v-if="currentConcept.syntax?.length" class="mob-concept-section">
                <div class="mob-section-title">语法结构</div>
                <div v-for="(s, i) in currentConcept.syntax" :key="i" class="mob-syntax-line">
                  <code>{{ s }}</code>
                </div>
              </div>
              <div v-if="currentConcept.mistakes?.length" class="mob-concept-section">
                <div class="mob-section-title">常见错误</div>
                <ul class="mob-mistakes">
                  <li v-for="(m, i) in currentConcept.mistakes" :key="i">{{ m }}</li>
                </ul>
              </div>
            </div>
            <div v-else class="mob-empty">点击行号查看概念解释</div>
          </div>

          <!-- AI Tutor Tab -->
          <div v-if="activeTab === 'tutor'" class="mob-tab-body mob-tutor-tab">
            <div class="mob-tutor-msgs" ref="tutorRef">
              <div v-for="(msg, i) in tutorMsgs" :key="i" class="mob-tutor-msg" :class="msg.role">
                <div class="mob-tutor-bubble">{{ msg.content }}</div>
              </div>
            </div>
            <div class="mob-tutor-quick">
              <button v-for="q in quickQs" :key="q" class="mob-q-btn" @click="sendTutor(q)">{{ q }}</button>
            </div>
            <div class="mob-tutor-input">
              <input v-model="tutorInput" placeholder="输入问题..." @keyup.enter="sendTutor(tutorInput)" />
              <button @click="sendTutor(tutorInput)">发送</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Output BottomSheet -->
    <BottomSheet v-model="showOutput" title="运行输出" :height="outputHeight">
      <div class="mob-output">
        <div class="mob-output-status" :class="runState">
          {{ runState === 'running' ? '⏳ 运行中...' : runState === 'success' ? '✓ 运行成功' : runState === 'error' ? '✗ 运行失败' : '⚠ 运行超时' }}
          <span v-if="runResult?.time" class="mob-output-time">{{ runResult.time.toFixed(2) }}s</span>
        </div>
        <div class="mob-output-tabs">
          <button v-for="t in outputTabs" :key="t" class="mob-out-tab" :class="{ active: activeOutTab === t }" @click="activeOutTab = t">{{ t }}</button>
        </div>
        <pre v-if="activeOutTab === 'stdout'" class="mob-out-body stdout">{{ runResult?.stdout || '(无输出)' }}</pre>
        <pre v-else-if="activeOutTab === 'stderr'" class="mob-out-body stderr">{{ runResult?.stderr || '(无错误)' }}</pre>
        <pre v-else-if="activeOutTab === 'diff' && diffText" class="mob-out-body diff">{{ diffText }}</pre>
        <div v-else-if="activeOutTab === 'diff'" class="mob-out-body">✓ 输出与预期一致</div>
      </div>
    </BottomSheet>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, MoreFilled } from '@element-plus/icons-vue'
import CodeEditorPanel from '@/components/code/CodeEditorPanel.vue'
import BottomSheet from '@/components/mobile/BottomSheet.vue'
import { runCode } from '@/utils/codeRunner'
import type { CodeRunResult } from '@/types'
import type { CodeContentExtended, LearningMode, FoldableRegion, VariableInfo } from '@/types/code'
import type { GutterMarkerDef, GuidedBlankDef } from '@/components/code/CodeEditorPanel.vue'

const router = useRouter()

const LINE_H = 22

const ORIGINAL_CODE_M = `def squares(n):
    result = [x**2 for x in range(n)]
    return result

def main():
    numbers = [1, 2, 3, 4, 5]
    squared = [x**2 for x in numbers]
    print(squared)

if __name__ == "__main__":
    main()
`

const GUIDE_TEMPLATE_M = `def squares(n):
    result = [x**2 for x in range(n)]
    return result

def main():
    numbers = [1, 2, 3, 4, 5]
    squared = [______ for x in numbers]
    print(squared)

if __name__ == "__main__":
    main()
`

// ─── Demo Content (same as PC) ───
const content = reactive<CodeContentExtended>({
  title: '列表推导式入门',
  language: 'python',
  description: '学习 Python 列表推导式的基本语法和用法',
  difficulty: 'intermediate',
  estimatedMinutes: 25,
  files: [{
    filename: 'main.py',
    content: ORIGINAL_CODE_M,
    isEntry: true,
  }],
  steps: [
    { title: '变量与赋值', content: '定义列表 numbers = [1,2,3,4,5]', references: [{ filename: 'main.py', startLine: 6, endLine: 6 }] },
    { title: '推导语法', content: '使用 [x**2 for x in numbers] 语法', references: [{ filename: 'main.py', startLine: 7, endLine: 7 }] },
    { title: '条件过滤', content: '添加 if 条件筛选元素', references: [{ filename: 'main.py', startLine: 2, endLine: 2 }] },
    { title: '函数封装', content: '将推导式封装为函数', references: [{ filename: 'main.py', startLine: 1, endLine: 4 }] },
    { title: '输出结果', content: '调用函数并打印结果', references: [{ filename: 'main.py', startLine: 9, endLine: 11 }] },
  ],
  expectedOutput: '[1, 4, 9, 16, 25]',
  extensionIdeas: ['用生成器表达式替代列表推导', '实现嵌套推导：矩阵转置', '用推导式读取 CSV 并过滤数据'],
  learningGoals: [
    { id: 'g1', description: '理解列表推导式的基本语法结构', relatedSteps: [0, 1] },
    { id: 'g2', description: '掌握条件过滤的写法', relatedSteps: [2] },
    { id: 'g3', description: '能独立用推导式优化循环代码', relatedSteps: [3, 4] },
  ],
  knowledgePoints: [{
    name: '列表推导式', category: 'loop' as const,
    references: [{ filename: 'main.py', startLine: 2, endLine: 2 }],
    definition: '列表推导式是 Python 中创建列表的简洁语法',
    complexity: '时间: O(n) · 空间: O(n)',
    commonMistakes: ['忘记方括号', '在表达式中使用未定义的变量', '可迭代对象为空时得到空列表'],
  }],
  foldableRegions: [
    { startLine: 1, endLine: 4, title: 'squares() 函数体 · 3行', description: '列表推导生成平方数，返回结果列表', autoFold: true },
    { startLine: 6, endLine: 11, title: 'main() 主程序体 · 5行', description: '调用 + 打印结果', autoFold: true },
  ],
})

// ─── State ───
const mode = ref<LearningMode>('read')
const showMenu = ref(false)
const currentStepIndex = ref(0)
const completedSteps = reactive(new Set<number>())
const goalsExpanded = ref(false)
const editedFiles = ref<Map<string, string>>(new Map())
const highlightedLines = ref<number[]>([])
const foldedRegions = reactive(new Set<number>())
const runState = ref<'idle' | 'running' | 'success' | 'error' | 'timeout'>('idle')
const runResult = ref<CodeRunResult | null>(null)
const showOutput = ref(false)
const outputHeight = ref<'medium' | 'large'>('large')
const activeOutTab = ref('stdout')
const activeTab = ref('steps')
const selectedVar = ref<VariableInfo | null>(null)
const tutorInput = ref('')
const tutorMsgs = ref<{ role: string; content: string }[]>([
  { role: 'assistant', content: '你好！关于这段代码有什么问题吗？' },
])
const quickQs = ['解释这段', '为什么报错', '如何优化']
const editorWrapRef = ref<HTMLElement | null>(null)
const splitRef = ref<HTMLElement | null>(null)
const dividerRef = ref<HTMLElement | null>(null)
const tutorRef = ref<HTMLElement | null>(null)

const currentConcept = ref<{
  name: string; description: string; syntax?: string[]; mistakes?: string[]
} | null>({
  name: '列表推导式',
  description: '列表推导式是 Python 中创建列表的简洁语法，等价于 for 循环 + append。',
  syntax: ['[表达式 for 变量 in 可迭代对象]', '[表达式 for 变量 in 可迭代 if 条件]'],
  mistakes: ['忘记方括号', '表达式中使用未定义变量', '可迭代对象为空时得到空列表'],
})

const panelTabs = [
  { key: 'steps', icon: '📖', label: '步骤' },
  { key: 'variables', icon: '🔍', label: '变量' },
  { key: 'concepts', icon: '📝', label: '概念' },
  { key: 'tutor', icon: '💬', label: '助教' },
]

const outputTabs = ['stdout', 'stderr', 'diff']

// ─── Swipe Gesture ───
const swipeStartX = ref(0)
const SWIPE_THRESHOLD = 50

function onSwipeStart(e: TouchEvent) {
  swipeStartX.value = e.touches[0].clientX
}
function onSwipeEnd(e: TouchEvent) {
  const dx = e.changedTouches[0].clientX - swipeStartX.value
  if (Math.abs(dx) < SWIPE_THRESHOLD) return
  if (dx > 0) prevStep()
  else nextStep()
}

// ─── Split Pane ───
const totalHeight = ref(window.innerHeight - 48)
const codeRatio = ref(0.55)
const codeAreaHeight = computed(() => Math.round(totalHeight.value * codeRatio.value))
const panelAreaHeight = computed(() => totalHeight.value - codeAreaHeight.value - 16)

function onSplitTouchStart(e: TouchEvent) {
}
function onSplitTouchMove(e: TouchEvent) {
  const touch = e.touches[0]
  const splitRect = splitRef.value?.getBoundingClientRect()
  if (!splitRect) return
  let offset = touch.clientY - splitRect.top
  const minCode = 160
  const maxCode = totalHeight.value - 160
  offset = Math.max(minCode, Math.min(maxCode, offset))
  codeRatio.value = offset / totalHeight.value
}

// ─── Editor Gutter Markers ───
const breakpoints = reactive(new Set<number>())
const editorGutterMarkers = computed<GutterMarkerDef[]>(() => {
  const markers: GutterMarkerDef[] = []
  const refs = content.steps[currentStepIndex.value]?.references || []
  const seen = new Set<number>()
  for (const ref of refs) {
    for (let l = ref.startLine; l <= ref.endLine; l++) {
      if (!seen.has(l)) { seen.add(l); markers.push({ line: l, type: 'step-range', symbol: '┃' }) }
    }
  }
  breakpoints.forEach(line => { markers.push({ line, type: 'breakpoint', symbol: '◆' }) })
  return markers
})

const guidedBlanksData = computed<GuidedBlankDef[]>(() => {
  if (mode.value !== 'guide') return []
  return (content.guidedBlanks || [])
    .filter(b => b.stepIndex === currentStepIndex.value)
    .map(b => ({ line: b.line, placeholder: b.placeholder, answer: b.answer }))
})

function onEditorGutterClick(line: number) {
  if (breakpoints.has(line)) { breakpoints.delete(line); return }
  breakpoints.add(line)
  const kp = content.knowledgePoints?.[0]
  currentConcept.value = {
    name: kp?.name || '代码分析',
    description: `AI 对第 ${line} 行代码的详细原理解释`,
    syntax: kp ? ['[表达式 for 变量 in 可迭代对象]', '[表达式 for 变量 in 可迭代 if 条件]'] : undefined,
    mistakes: kp?.commonMistakes,
  }
}

function onSelectionChange(info: { text: string; from: number; to: number } | null) {
  if (!info || !info.text.trim()) {
    selectedVar.value = null
    return
  }
  selectedVar.value = {
    name: info.text,
    type: 'unknown',
    scope: '局部',
    definitionLine: info.from,
    definition: info.text,
    references: [],
  }
}

// ─── Computed ───
const diffLabel = computed(() => {
  const map: Record<string, string> = { beginner: '初级', intermediate: '中级', advanced: '高级' }
  return map[content.difficulty || ''] || ''
})

const editedContent = computed(() =>
  editedFiles.value.get('main.py') ?? content.files[0].content
)

const achievedGoalIds = computed(() => {
  const ids = new Set<string>()
  for (const g of content.learningGoals || []) {
    if (g.relatedSteps.every(s => completedSteps.has(s))) ids.add(g.id)
  }
  return ids
})

const visibleFolds = computed(() => {
  if (mode.value === 'edit') return []
  return (content.foldableRegions || []).filter(r => foldedRegions.has(r.startLine))
})

const diffText = computed(() => {
  if (!content.expectedOutput || !runResult.value?.stdout) return null
  const a = runResult.value.stdout.trim()
  const e = content.expectedOutput.trim()
  return a === e ? null : `预期:\n${e}\n\n实际:\n${a}`
})

// ─── Mode ───
function setMode(m: LearningMode) {
  mode.value = m
  showMenu.value = false
  if (m === 'edit') {
    foldedRegions.clear()
    editedFiles.value.set('main.py', ORIGINAL_CODE_M)
  } else {
    content.foldableRegions?.forEach(r => { if (r.autoFold) foldedRegions.add(r.startLine) })
    if (m === 'guide') {
      editedFiles.value.set('main.py', GUIDE_TEMPLATE_M)
    }
  }
}

// ─── Steps ───
function updatePanelForStep(stepIndex: number) {
  const kp = content.knowledgePoints?.[stepIndex % (content.knowledgePoints?.length || 1)]
  if (kp) {
    currentConcept.value = {
      name: kp.name,
      description: kp.definition || '',
      syntax: ['[表达式 for 变量 in 可迭代对象]', '[表达式 for 变量 in 可迭代 if 条件]'],
      mistakes: kp.commonMistakes,
    }
  }
}

function jumpToStep(i: number) {
  if (i > currentStepIndex.value && !completedSteps.has(i)) return
  currentStepIndex.value = i
  const refs = content.steps[i]?.references || []
  const lines: number[] = []
  refs.forEach(r => { for (let l = r.startLine; l <= r.endLine; l++) lines.push(l) })
  highlightedLines.value = lines
  if (editorWrapRef.value && refs[0]) {
    editorWrapRef.value.scrollTo({ top: (refs[0].startLine - 3) * LINE_H, behavior: 'smooth' })
  }
  updatePanelForStep(i)
}

function prevStep() {
  if (currentStepIndex.value > 0) jumpToStep(currentStepIndex.value - 1)
}

function nextStep() {
  if (currentStepIndex.value < content.steps.length - 1) jumpToStep(currentStepIndex.value + 1)
}

// ─── Fold ───
function toggleFold(startLine: number) {
  if (foldedRegions.has(startLine)) foldedRegions.delete(startLine)
  else foldedRegions.add(startLine)
}

function foldStyle(r: FoldableRegion) {
  return { top: (r.startLine - 1) * LINE_H + 'px', height: (r.endLine - r.startLine + 1) * LINE_H + 'px' }
}

// ─── Code ───
function onCodeEdit(val: string) {
  editedFiles.value.set('main.py', val)
}

// ─── Run ───
async function handleRun() {
  showMenu.value = false
  if (runState.value === 'running') return
  runState.value = 'running'
  showOutput.value = true
  activeOutTab.value = 'stdout'
  try {
    const result = await runCode({
      source_code: editedContent.value,
      language: content.language,
      expected_output: content.expectedOutput,
    })
    runResult.value = result
    runState.value = result.status_code === 3 ? 'success' : result.status_code === 5 || result.status_code === 11 ? 'timeout' : 'error'
    if (result.stdout?.trim() === content.expectedOutput?.trim()) {
      completedSteps.add(currentStepIndex.value)
      if (currentStepIndex.value < content.steps.length - 1) {
        currentStepIndex.value++
      }
    }
  } catch {
    runState.value = 'error'
  }
}

// ─── Actions ───
function handleReset() {
  showMenu.value = false
  content.files.forEach(f => editedFiles.value.set(f.filename, f.content))
  runState.value = 'idle'
  runResult.value = null
  showOutput.value = false
  ElMessage.success('已重置')
}

async function handleCopy() {
  showMenu.value = false
  try {
    await navigator.clipboard.writeText(editedContent.value)
    ElMessage.success('已复制')
  } catch { ElMessage.error('复制失败') }
}

function handleBack() { router.back() }
function onGoalClick(id: string) {
  const g = content.learningGoals?.find(x => x.id === id)
  if (g?.relatedSteps.length) jumpToStep(g.relatedSteps[0])
}
function gotoLine(line: number) {
  highlightedLines.value = [line]
  if (editorWrapRef.value) editorWrapRef.value.scrollTo({ top: (line - 3) * LINE_H, behavior: 'smooth' })
}

function sendTutor(text: string) {
  if (!text.trim()) return
  tutorMsgs.value.push({ role: 'user', content: text })
  tutorInput.value = ''
  setTimeout(() => {
    tutorMsgs.value.push({ role: 'assistant', content: `关于 "${text}" 的问题，这里是 AI 助教的回答。\n\n这是一个很好的问题！让我为你详细解释...` })
    if (tutorRef.value) tutorRef.value.scrollTop = tutorRef.value.scrollHeight
  }, 500)
}

function stripHtml(s: string) {
  const div = document.createElement('div')
  div.innerHTML = s
  return div.textContent || div.innerText || ''
}

onMounted(() => {
  content.files.forEach(f => editedFiles.value.set(f.filename, f.content))
  content.foldableRegions?.forEach(r => { if (r.autoFold) foldedRegions.add(r.startLine) })
  totalHeight.value = window.innerHeight - 48
})
</script>

<style scoped>
.code-learn-mobile {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--lt-bg-page);
  overflow: hidden;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

/* ─── Top Bar ─── */
.mob-topbar {
  display: flex;
  align-items: center;
  min-height: 48px;
  padding: var(--mobile-safe-area-inset-top, 0px) 8px 0;
  background: var(--lt-bg-card);
  border-bottom: 0.5px solid var(--lt-border);
  flex-shrink: 0;
  gap: 4px;
  z-index: 10;
}
.mob-back-btn {
  width: var(--mobile-touch-min, 44px);
  height: var(--mobile-touch-min, 44px);
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--lt-text-primary);
  border-radius: 50%;
}
.mob-back-btn:active {
  background: var(--mobile-active-bg, rgba(43,111,255,0.06));
}
.mob-topbar-center {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mob-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.mob-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--lt-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mob-difficulty {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--lt-orange-light-9);
  color: var(--lt-orange-text);
  white-space: nowrap;
  flex-shrink: 0;
}
.mob-progress-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.mob-progress-dots {
  display: flex;
  gap: 3px;
}
.mob-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lt-border);
}
.mob-dot.done { background: var(--lt-success); }
.mob-dot.current { background: var(--lt-brand); transform: scale(1.2); }
.mob-progress-text {
  font-size: 10px;
  color: var(--lt-text-auxiliary);
  font-family: var(--lt-font-mono);
}
.mob-topbar-right {
  display: flex;
  align-items: center;
}
.mob-menu-btn {
  width: var(--mobile-touch-min, 44px);
  height: var(--mobile-touch-min, 44px);
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--lt-text-primary);
  border-radius: 50%;
}
.mob-menu-btn:active {
  background: var(--mobile-active-bg, rgba(43,111,255,0.06));
}

/* ─── Dropdown Menu ─── */
.mob-dropdown-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: var(--mobile-sheet-scrim);
}
.mob-dropdown-menu {
  position: absolute;
  top: 52px;
  right: 8px;
  width: 200px;
  background: var(--lt-bg-card);
  border-radius: var(--lt-radius-lg);
  box-shadow: var(--lt-shadow-elevated);
  padding: 6px 0;
}
.mob-dropdown-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 10px 14px;
  border: none;
  background: transparent;
  font-size: 14px;
  color: var(--lt-text-primary);
  text-align: left;
  cursor: pointer;
}
.mob-dropdown-item:active { background: var(--lt-bg-page); }
.mob-dropdown-item.active { color: var(--lt-brand); font-weight: 500; }
.mob-dropdown-desc { font-size: 11px; color: var(--lt-text-auxiliary); font-weight: 400; }
.mob-dropdown-divider { height: 0.5px; background: var(--lt-border); margin: 4px 12px; }

.mob-dropdown-enter-active { transition: opacity 0.15s; }
.mob-dropdown-leave-active { transition: opacity 0.1s; }
.mob-dropdown-enter-from, .mob-dropdown-leave-to { opacity: 0; }

/* ─── Split Pane ─── */
.mob-split {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* ─── Code Area ─── */
.mob-code-area {
  display: flex;
  flex-direction: column;
  min-height: 160px;
  overflow: hidden;
}
.mob-goals-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  font-size: 12px;
  color: var(--lt-text-secondary);
  background: var(--lt-bg-card);
  border-bottom: 0.5px solid var(--lt-border);
  cursor: pointer;
  flex-shrink: 0;
}
.mob-goals-bar:active { background: var(--lt-bg-page); }
.mob-goals-status {
  margin-left: auto;
  font-size: 11px;
  color: var(--lt-text-auxiliary);
}
.mob-goals-body {
  padding: 4px 12px;
  background: var(--lt-bg-card);
  border-bottom: 0.5px solid var(--lt-border);
  flex-shrink: 0;
}
.mob-goal-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  font-size: 12px;
  cursor: pointer;
}
.mob-goal-text { color: var(--lt-text-secondary); }
.mob-goal-item.achieved .mob-goal-text { color: var(--lt-success); text-decoration: line-through; }

.mob-editor-wrap {
  flex: 1;
  position: relative;
  overflow: auto;
  min-height: 100px;
}

/* Fold overlays */
.mob-fold-overlay {
  position: absolute;
  left: 32px;
  right: 0;
  z-index: 5;
}
.mob-fold-placeholder {
  height: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px dashed var(--lt-border);
  border-radius: 4px;
  background: rgba(0,0,0,0.02);
  font-size: 12px;
  cursor: pointer;
  pointer-events: auto;
}
.mob-fold-placeholder:active { background: rgba(0,0,0,0.05); }
.mob-fold-title { color: var(--lt-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Gutters */
/* Mini toolbar */
.mob-mini-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  background: var(--lt-bg-card);
  border-top: 0.5px solid var(--lt-border);
  flex-shrink: 0;
}
.mob-step-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mob-step-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--lt-border);
  border-radius: 50%;
  background: var(--lt-bg-card);
  font-size: 14px;
  color: var(--lt-text-primary);
  cursor: pointer;
}
.mob-step-btn:active:not(:disabled) { background: var(--lt-bg-page); transform: scale(0.95); }
.mob-step-btn:disabled { opacity: 0.3; }
.mob-step-label {
  font-size: 12px;
  color: var(--lt-text-secondary);
  font-weight: 500;
}
.mob-run-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: var(--lt-brand);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(43,111,255,0.3);
}
.mob-run-btn:active:not(:disabled) { transform: scale(0.93); }
.mob-run-btn:disabled { opacity: 0.4; }
.mob-run-btn.running { opacity: 0.7; }

/* ─── Divider ─── */
.mob-divider {
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: row-resize;
  flex-shrink: 0;
  touch-action: none;
}
.mob-divider-line {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: var(--lt-border);
}

/* ─── Panel Area ─── */
.mob-panel-area {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.mob-panel-tabs {
  display: flex;
  overflow-x: auto;
  gap: 0;
  border-bottom: 0.5px solid var(--lt-border);
  background: var(--lt-bg-card);
  flex-shrink: 0;
  -webkit-overflow-scrolling: touch;
}
.mob-panel-tab {
  flex-shrink: 0;
  padding: 10px 14px;
  font-size: 13px;
  border: none;
  background: transparent;
  color: var(--lt-text-auxiliary);
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
}
.mob-panel-tab.active {
  color: var(--lt-brand);
  border-bottom-color: var(--lt-brand);
  font-weight: 500;
}
.mob-panel-tab:active { background: var(--lt-bg-page); }

.mob-panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  -webkit-overflow-scrolling: touch;
}
.mob-tab-body { display: flex; flex-direction: column; gap: 4px; }

/* Step cards */
.mob-step-card {
  padding: 10px 12px;
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-md);
  background: var(--lt-bg-card);
  cursor: pointer;
  transition: border-color 0.15s;
}
.mob-step-card.current { border-color: var(--lt-brand); }
.mob-step-card.locked { opacity: 0.4; }
.mob-step-card:active { transform: scale(0.98); }
.mob-step-header { display: flex; align-items: center; gap: 6px; }
.mob-step-icon { font-size: 12px; width: 16px; }
.mob-step-title { font-size: 13px; font-weight: 500; color: var(--lt-text-primary); }
.mob-step-body { font-size: 12px; color: var(--lt-text-secondary); margin-top: 2px; }

/* Variable */
.mob-var-detail { display: flex; flex-direction: column; gap: 8px; }
.mob-var-def { padding: 8px 10px; background: var(--lt-bg-card); border: 1px solid var(--lt-border); border-radius: var(--lt-radius-md); }
.mob-var-line { font-family: var(--lt-font-mono); font-size: 12px; }
.mob-var-meta { display: flex; gap: 6px; font-size: 11px; color: var(--lt-text-auxiliary); margin-top: 4px; }
.mob-var-type { background: var(--lt-brand-lightest); color: var(--lt-brand); padding: 1px 6px; border-radius: 3px; font-family: var(--lt-font-mono); }
.mob-var-ref { padding: 4px 8px; font-size: 12px; font-family: var(--lt-font-mono); color: var(--lt-text-primary); }

/* Concept */
.mob-concept { display: flex; flex-direction: column; gap: 8px; }
.mob-concept-title { font-size: 15px; font-weight: 600; color: var(--lt-text-primary); }
.mob-concept-desc { font-size: 13px; color: var(--lt-text-secondary); line-height: 1.6; }
.mob-concept-section { margin-top: 4px; }
.mob-section-title { font-size: 12px; font-weight: 500; color: var(--lt-text-secondary); margin-bottom: 4px; }
.mob-syntax-line { margin-bottom: 4px; }
.mob-syntax-line code { padding: 4px 8px; background: var(--lt-bg-page); border-radius: 4px; font-size: 12px; border: 1px solid var(--lt-border); display: block; }
.mob-mistakes { margin: 0; padding-left: 16px; font-size: 12px; color: var(--lt-text-secondary); line-height: 1.8; }

/* Tutor */
.mob-tutor-tab { display: flex; flex-direction: column; gap: 8px; }
.mob-tutor-msgs { flex: 1; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; max-height: 200px; }
.mob-tutor-msg { display: flex; }
.mob-tutor-msg.user { justify-content: flex-end; }
.mob-tutor-bubble {
  max-width: 80%;
  padding: 8px 12px;
  border-radius: var(--lt-radius-md);
  font-size: 13px;
  line-height: 1.5;
}
.mob-tutor-msg.user .mob-tutor-bubble { background: var(--lt-brand); color: #fff; }
.mob-tutor-msg.assistant .mob-tutor-bubble { background: var(--lt-bg-page); color: var(--lt-text-primary); }
.mob-tutor-quick { display: flex; gap: 6px; }
.mob-q-btn {
  padding: 6px 12px;
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-full);
  background: var(--lt-bg-card);
  font-size: 12px;
  color: var(--lt-text-secondary);
  cursor: pointer;
}
.mob-q-btn:active { background: var(--lt-brand-lightest); color: var(--lt-brand); }
.mob-tutor-input {
  display: flex;
  gap: 6px;
}
.mob-tutor-input input {
  flex: 1;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-md);
  font-size: 14px;
  background: var(--lt-bg-card);
  color: var(--lt-text-primary);
  outline: none;
}
.mob-tutor-input input:focus { border-color: var(--lt-brand); }
.mob-tutor-input button {
  height: 36px;
  padding: 0 14px;
  border: none;
  border-radius: var(--lt-radius-md);
  background: var(--lt-brand);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
}
.mob-tutor-input button:active { opacity: 0.8; }

/* Empty */
.mob-empty {
  text-align: center;
  padding: 32px 16px;
  font-size: 13px;
  color: var(--lt-text-auxiliary);
}

/* ─── Output BottomSheet ─── */
.mob-output { display: flex; flex-direction: column; gap: 8px; }
.mob-output-status {
  font-size: 14px;
  font-weight: 500;
}
.mob-output-status.success { color: var(--lt-success); }
.mob-output-status.error { color: var(--lt-danger); }
.mob-output-status.running { color: var(--lt-brand); }
.mob-output-status.timeout { color: var(--lt-warning); }
.mob-output-time {
  margin-left: 8px;
  font-family: var(--lt-font-mono);
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  font-weight: 400;
}
.mob-output-tabs { display: flex; gap: 0; border-bottom: 0.5px solid var(--lt-border); }
.mob-out-tab {
  padding: 6px 14px;
  font-size: 12px;
  border: none;
  background: transparent;
  color: var(--lt-text-auxiliary);
  border-bottom: 2px solid transparent;
  cursor: pointer;
}
.mob-out-tab.active { color: var(--lt-brand); border-bottom-color: var(--lt-brand); }
.mob-out-body {
  padding: 8px 0;
  margin: 0;
  font-family: var(--lt-font-mono);
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
}
.mob-out-body.stdout { color: var(--lt-success); }
.mob-out-body.stderr { color: var(--lt-danger); }
.mob-out-body.diff { color: var(--lt-warning); }
</style>
