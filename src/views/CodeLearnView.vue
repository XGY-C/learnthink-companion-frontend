<template>
  <div class="code-learn-view" :class="{ fullscreen: isFullscreen }">
    <CodeTopBar
      :title="content.title"
      :difficulty="content.difficulty || 'intermediate'"
      :estimated-minutes="content.estimatedMinutes || 30"
      :completed-steps="completedSteps.size"
      :total-steps="content.steps.length"
      :mode="mode"
      :has-trajectory="traces.length > 0"
      :trajectory-active="showTrajectory"
      :fullscreen="isFullscreen"
      @back="handleBack"
      @update:mode="onModeChange"
      @jump-step="onJumpStep"
      @toggle-trajectory="showTrajectory = !showTrajectory"
      @toggle-fullscreen="isFullscreen = !isFullscreen"
    />

    <div class="code-body">
      <!-- Left: Code Main Area -->
      <div class="code-main-area" :class="{
        'trajectory-mode': showTrajectory,
        'edit-mode': mode === 'edit'
      }">
        <LearningGoalsBar
          :goals="content.learningGoals || []"
          :achieved-ids="achievedGoalIds"
          :current-goal-id="currentGoalId"
          @click-goal="onGoalClick"
        />

        <div class="code-editor-container">
          <div class="editor-wrapper" ref="editorWrapperRef">
            <!-- Skeleton Fold Overlays (only for folded regions) -->
            <div
              v-for="region in visibleFoldRegions"
              :key="region.startLine"
              class="fold-overlay"
              :class="{ 'fold-animate-in': foldAnimating.has(region.startLine) }"
              :style="getFoldStyle(region)"
              @click="toggleFold(region.startLine)"
            >
              <div class="fold-placeholder">
                <span class="fold-icon">📎</span>
                <span class="fold-title">{{ region.title }}</span>
                <span class="fold-desc">{{ region.description }}</span>
              </div>
            </div>

            <CodeEditorPanel
              ref="editorRef"
              :content="displayContent"
              :language="content.language"
              :read-only="mode !== 'edit'"
              :highlighted-lines="highlightedLines"
              :gutter-markers="editorGutterMarkers"
              :guided-blanks="guidedBlanksData"
              :trace-active-line="traceActiveLine"
              @update:content="onCodeChange"
              @selection-change="onSelectionChange"
              @hover-variable="onHoverVariable"
              @gutter-click="onEditorGutterClick"
            />
          </div>

          <VariableHoverCard
            v-if="hoverVarData"
            :variable="hoverVarData"
            :x="hoverX"
            :y="hoverY"
            @close="hoverVarData = null"
          />

          <SelectionFloatingMenu
            :visible="selectionMenu.visible"
            :x="selectionMenu.x"
            :y="selectionMenu.y"
            @explain="onSelectionExplain"
            @find-similar="onSelectionFindSimilar"
            @ask="onSelectionAsk"
          />

          <!-- Toolbar -->
          <div class="code-toolbar-row">
            <div class="toolbar-left">
              <el-button size="small" type="primary"
                :disabled="mode === 'read' || runState === 'running'" @click="handleRun">
                <el-icon class="mr-1"><CaretRight /></el-icon> 运行
              </el-button>
              <el-button size="small" @click="handleReset">↺ 重置</el-button>
              <el-button size="small" plain @click="handleCopy">📋 复制</el-button>
              <el-button size="small" plain @click="handleDownload">⬇ 下载</el-button>
              <el-button v-if="mode === 'guide'" size="small"
                :disabled="hintLevel >= 3" @click="showNextHint">
                💡 提示 {{ hintLevel < 3 ? `(${hintLevel + 1}/3)` : '(已用完)' }}
              </el-button>
            </div>
            <div class="toolbar-right">
              <span class="file-info">{{ activeFile?.filename || '' }}</span>
            </div>
          </div>

          <CodeOutputEnhanced
            :state="outputState"
            :stdout="runResult?.stdout"
            :stderr="runResult?.stderr"
            :compile-output="runResult?.compile_output"
            :expected-output="content.expectedOutput"
            :time="runResult?.time"
            :memory="runResult?.memory"
            :test-cases="testResults"
            @collapse="outputState = 'collapsed'"
            @expand="outputState = lastRunState"
          />
        </div>
      </div>

      <!-- Right: Context Panel -->
      <div class="right-panel-wrapper" :class="{ compressed: mode === 'edit' }">
        <CodeContextPanel
          ref="contextPanelRef"
          :steps="content.steps"
          :current-step-index="currentStepIndex"
          :completed-steps="completedSteps"
          :selected-variable="selectedVariable"
          :traces="traces"
          :total-trace-duration="totalTraceDuration"
          :current-trace-step="currentTraceStep"
          :trace-playing="tracePlaying"
          :trace-speed="traceSpeed"
          :current-concept="currentConcept"
          :tutor-messages="tutorMessages"
          :mode="mode"
          @step-click="onStepClick"
          @goto-line="onGotoLine"
          @trace-jump-start="onTraceJumpStart"
          @trace-toggle="onTraceToggle"
          @trace-step="onTraceStep"
          @trace-speed="onTraceSpeed"
          @concept-click="onConceptClick"
          @start-challenge="onStartChallenge"
          @tutor-send="onTutorSend"
          @tab-change="onContextTabChange"
        />
      </div>
    </div>

    <Teleport to="body">
      <div v-if="hintVisible" class="hint-popover" :style="hintStyle" @click="hintVisible = false">
        <div class="hint-level">提示等级 {{ currentHintLevel + 1 }}</div>
        <div class="hint-content">{{ currentHint?.content }}</div>
        <div v-if="currentHint?.codeSnippet" class="hint-code"><pre>{{ currentHint.codeSnippet }}</pre></div>
      </div>
    </Teleport>

    <!-- 离开提示遮罩 -->
    <Transition name="fade">
      <div v-if="isLearningAway" class="learning-away-overlay">
        <div class="learning-away-card">
          <p class="text-lg font-semibold mb-2">你已离开一会儿了</p>
          <p class="text-sm mb-4" style="color: var(--lt-text-auxiliary);">学习计时已暂停</p>
          <el-button type="primary" @click="resumeTracking">继续学习</el-button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { CaretRight } from '@element-plus/icons-vue'
import CodeTopBar from '@/components/code/CodeTopBar.vue'
import LearningGoalsBar from '@/components/code/LearningGoalsBar.vue'
import CodeEditorPanel from '@/components/code/CodeEditorPanel.vue'
import type { GutterMarkerDef, GuidedBlankDef } from '@/components/code/CodeEditorPanel.vue'
import CodeOutputEnhanced from '@/components/code/CodeOutputEnhanced.vue'
import SelectionFloatingMenu from '@/components/code/SelectionFloatingMenu.vue'
import VariableHoverCard from '@/components/code/VariableHoverCard.vue'
import CodeContextPanel from '@/components/code/CodeContextPanel.vue'
import { runCode } from '@/utils/codeRunner'
import type {
  CodeContentExtended, CodeFile, LearningMode, ContextTab,
  VariableInfo, TraceStep, FoldableRegion, StepHint
} from '@/types/code'
import type { CodeRunResult } from '@/types'
import { useProfileStore } from '@/stores/profile'
import { useLearningTracker } from '@/composables/useLearningTracker'

const router = useRouter()
const profileStore = useProfileStore()

// 学习心跳追踪
const { isAway: isLearningAway, resumeTracking } = useLearningTracker({
  courseId: profileStore.activeCourseId,
})

const LINE_H = 22

// ─── Demo Content ───
const ORIGINAL_CODE = `def squares(n):
    result = [x**2 for x in range(n)]
    return result

def main():
    numbers = [1, 2, 3, 4, 5]
    squared = [x**2 for x in numbers]
    print(squared)

if __name__ == "__main__":
    main()
`

const GUIDE_TEMPLATE = `def squares(n):
    result = [x**2 for x in range(n)]
    return result

def main():
    numbers = [1, 2, 3, 4, 5]
    squared = [______ for x in numbers]
    print(squared)

if __name__ == "__main__":
    main()
`

const content = reactive<CodeContentExtended>({
  title: '列表推导式入门',
  language: 'python',
  description: '学习 Python 列表推导式的基本语法和用法',
  difficulty: 'intermediate',
  estimatedMinutes: 25,
  files: [{ filename: 'main.py', content: ORIGINAL_CODE, isEntry: true }],
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
  hints: [
    { stepIndex: 1, level: 0, content: '思考需要处理哪些数字？', codeSnippet: '# 提示：先定义一个列表' },
    { stepIndex: 1, level: 1, content: '使用 x**2 对每个元素求平方', codeSnippet: 'x**2' },
    { stepIndex: 1, level: 2, content: '完整的推导式：[x**2 for x in numbers]', codeSnippet: 'squared = [x**2 for x in numbers]' },
  ],
  guidedBlanks: [
    { stepIndex: 1, filename: 'main.py', line: 7, placeholder: '______', answer: 'x**2', hints: ['思考每个元素需要做什么运算', '平方运算是 x**2', '[x**2 for x in numbers]'] },
  ],
})

// ─── State ───
const mode = ref<LearningMode>('read')
const isFullscreen = ref(false)
const showTrajectory = ref(false)
const activeFileIndex = ref(0)
const currentStepIndex = ref(0)
const completedSteps = reactive(new Set<number>())
const runState = ref<'idle' | 'running' | 'success' | 'error' | 'timeout'>('idle')
const runResult = ref<CodeRunResult | null>(null)
const outputState = ref<'idle' | 'running' | 'success' | 'error' | 'timeout' | 'collapsed'>('idle')
const lastRunState = ref<'success' | 'error'>('success')
const editedFiles = ref<Map<string, string>>(new Map())
const highlightedLines = ref<number[]>([])
const foldedRegions = reactive(new Set<number>())
const foldAnimating = reactive(new Set<number>())
const hintLevel = ref(0)
const hintVisible = ref(false)
const hintStyle = ref({ top: '0px', left: '0px' })
const currentHintLevel = ref(0)
const editorWrapperRef = ref<HTMLElement | null>(null)
const editorRef = ref<InstanceType<typeof CodeEditorPanel> | null>(null)
const contextPanelRef = ref<InstanceType<typeof CodeContextPanel> | null>(null)
const breakpoints = reactive(new Set<number>())
let autoCollapseTimer: ReturnType<typeof setTimeout> | null = null
let hovering = false
let hoverTimer: ReturnType<typeof setTimeout> | null = null

// Trace
const traces = ref<TraceStep[]>([])
const totalTraceDuration = ref(0)
const currentTraceStep = ref(0)
const tracePlaying = ref(false)
const traceSpeed = ref(1)
let traceTimer: ReturnType<typeof setInterval> | null = null

// Variable hover
const hoverVarData = ref<VariableInfo | null>(null)
const hoverX = ref(0)
const hoverY = ref(0)

// Selection menu
const selectionMenu = reactive({ visible: false, x: 0, y: 0, text: '' })
let selectionTimer: ReturnType<typeof setTimeout> | null = null

// Tutor
const tutorMessages = ref<{ role: string; content: string }[]>([
  { role: 'assistant', content: '你好！我是 AI 助教，可以回答你关于这段代码的任何问题。' },
])

// Concept
const currentConcept = ref<{
  context: string; name: string; description: string
  syntax?: string[]; complexity?: string; mistakes?: string[]
  related?: string[]; challenges?: { description: string }[]
} | null>({
  context: 'Step 2 · 推导语法',
  name: '列表推导式 (List Comprehension)',
  description: '列表推导式是 Python 中创建列表的简洁语法，等价于 for 循环 + append。',
  syntax: ['[表达式 for 变量 in 可迭代对象]', '[表达式 for 变量 in 可迭代 if 条件]'],
  complexity: '时间: O(n) · 空间: O(n)',
  mistakes: ['忘记方括号', '在表达式中使用未定义的变量', '可迭代对象为空时得到空列表（非报错）'],
  related: ['生成器表达式', '字典推导', '集合推导'],
  challenges: [
    { description: '用生成器表达式替代列表推导（省内存）' },
    { description: '实现嵌套推导：矩阵转置' },
    { description: '用推导式读取 CSV 并过滤数据' },
  ],
})

const selectedVariable = ref<VariableInfo | null>(null)
const testResults = ref<{ name: string; passed?: boolean }[]>([])

// ─── Computed ───
const activeFile = computed(() => content.files[activeFileIndex.value])

const displayContent = computed(() => {
  const base = editedFiles.value.get(activeFile.value?.filename ?? '') ?? activeFile.value?.content ?? ''
  if (mode.value === 'guide') return GUIDE_TEMPLATE
  return base
})

const activeFileContent = computed(() =>
  editedFiles.value.get(activeFile.value?.filename ?? '') ?? activeFile.value?.content ?? ''
)

const achievedGoalIds = computed(() => {
  const ids = new Set<string>()
  for (const g of content.learningGoals || []) {
    if (g.relatedSteps.every(s => completedSteps.has(s))) ids.add(g.id)
  }
  return ids
})

const currentGoalId = computed(() => {
  for (const g of content.learningGoals || []) {
    if (g.relatedSteps.some(s => s === currentStepIndex.value)) return g.id
  }
  return null
})

const currentHint = computed<StepHint | undefined>(() =>
  content.hints?.find(h => h.stepIndex === currentStepIndex.value && h.level === currentHintLevel.value)
)

// ─── Editor gutter markers ───
const editorGutterMarkers = computed<GutterMarkerDef[]>(() => {
  const markers: GutterMarkerDef[] = []
  const refs = content.steps[currentStepIndex.value]?.references || []
  const seen = new Set<number>()
  for (const ref of refs) {
    for (let l = ref.startLine; l <= ref.endLine; l++) {
      if (!seen.has(l)) { seen.add(l); markers.push({ line: l, type: 'step-range', symbol: '┃' }) }
    }
  }
  const firstRefLine = refs[0]?.startLine
  if (firstRefLine && !seen.has(firstRefLine)) {
    markers.unshift({ line: firstRefLine, type: 'entry', symbol: '●' })
  }
  breakpoints.forEach(line => {
    markers.push({ line, type: 'breakpoint', symbol: '◆' })
  })
  return markers
})

// ─── Guided blanks ───
const guidedBlanksData = computed<GuidedBlankDef[]>(() => {
  if (mode.value !== 'guide') return []
  return (content.guidedBlanks || [])
    .filter(b => b.stepIndex === currentStepIndex.value)
    .map(b => ({ line: b.line, placeholder: b.placeholder, answer: b.answer }))
})

// ─── Trace active line ───
const traceActiveLine = computed<number | null>(() => {
  if (!tracePlaying.value && currentTraceStep.value === 0) return null
  if (currentTraceStep.value >= traces.value.length) return null
  return traces.value[currentTraceStep.value]?.line ?? null
})

// ─── Fold regions ───
const visibleFoldRegions = computed(() => {
  if (mode.value === 'edit') return []
  return (content.foldableRegions || []).filter(r => foldedRegions.has(r.startLine))
})

function getFoldStyle(region: FoldableRegion) {
  return { top: ((region.startLine - 1) * LINE_H) + 'px', height: ((region.endLine - region.startLine + 1) * LINE_H) + 'px' }
}

// ─── Init ───
onMounted(() => {
  content.files.forEach(f => editedFiles.value.set(f.filename, f.content))
  content.foldableRegions?.forEach(r => { if (r.autoFold) foldedRegions.add(r.startLine) })
})

// ─── Mode Change ───
function onModeChange(newMode: LearningMode) {
  mode.value = newMode
  if (newMode === 'edit') {
    foldedRegions.clear()
    editedFiles.value.set(activeFile.value?.filename ?? '', ORIGINAL_CODE)
  } else {
    content.foldableRegions?.forEach(r => { if (r.autoFold) foldedRegions.add(r.startLine) })
    if (newMode === 'guide') {
      editedFiles.value.set(activeFile.value?.filename ?? '', GUIDE_TEMPLATE)
      hintLevel.value = 0
      hintVisible.value = false
    }
  }
}

// ─── Step Navigation (with transition animation) ───
let stepTransitioning = false

function onStepClick(index: number) {
  if (stepTransitioning || index === currentStepIndex.value) return
  stepTransitioning = true
  const refs = content.steps[index]?.references || []
  const lines: number[] = []
  refs.forEach(r => { for (let l = r.startLine; l <= r.endLine; l++) lines.push(l) })
  highlightedLines.value = []

  setTimeout(() => {
    currentStepIndex.value = index
    highlightedLines.value = lines
    scrollToFirstRef(refs)
    updatePanelForStep(index)
    nextTick(() => { stepTransitioning = false })
  }, 200)
}

function onJumpStep(index: number) {
  if (index < content.steps.length) onStepClick(index)
}

function scrollToFirstRef(refs: { startLine: number }[]) {
  if (!refs[0] || !editorWrapperRef.value) return
  editorWrapperRef.value.scrollTo({ top: (refs[0].startLine - 3) * LINE_H, behavior: 'smooth' })
}

function updatePanelForStep(stepIndex: number) {
  const kp = content.knowledgePoints?.[stepIndex % (content.knowledgePoints?.length || 1)]
  if (kp) {
    currentConcept.value = {
      context: `Step ${stepIndex + 1} · ${content.steps[stepIndex]?.title || ''}`,
      name: kp.name, description: kp.definition || '',
      complexity: kp.complexity, mistakes: kp.commonMistakes,
      challenges: content.extensionIdeas.map(d => ({ description: d })),
    }
  }
}

// ─── Fold ───
function toggleFold(startLine: number) {
  if (foldedRegions.has(startLine)) {
    foldAnimating.add(startLine)
    setTimeout(() => { foldAnimating.delete(startLine); foldedRegions.delete(startLine) }, 250)
  } else {
    foldedRegions.add(startLine)
    setTimeout(() => foldAnimating.delete(startLine), 300)
  }
}

// ─── Hover Variable ───
function onHoverVariable(info: { name: string; from: number; to: number; x: number; y: number } | null) {
  if (!info) {
    if (!hovering) return
    hovering = false
    if (hoverTimer) clearTimeout(hoverTimer)
    hoverTimer = setTimeout(() => { hoverVarData.value = null }, 300)
    return
  }
  hovering = true
  if (hoverTimer) clearTimeout(hoverTimer)
  hoverVarData.value = {
    name: info.name,
    type: 'unknown',
    scope: '局部',
    definitionLine: info.from,
    definition: info.name,
    references: [],
  }
  hoverX.value = info.x
  hoverY.value = info.y
}

// ─── Selection Change ───
function onSelectionChange(info: { text: string; from: number; to: number; x: number; y: number } | null) {
  if (selectionTimer) clearTimeout(selectionTimer)
  if (!info) { selectionMenu.visible = false; return }
  selectionTimer = setTimeout(() => {
    selectionMenu.visible = true
    selectionMenu.x = info.x
    selectionMenu.y = info.y
    selectionMenu.text = info.text
  }, 200)
}

function onSelectionExplain() {
  selectionMenu.visible = false
  currentConcept.value = {
    context: '选区代码',
    name: '代码分析',
    description: selectionMenu.text || '选中代码的解释...',
  }
}
function onSelectionFindSimilar() { selectionMenu.visible = false }
function onSelectionAsk() {
  selectionMenu.visible = false
  tutorMessages.value.push({ role: 'user', content: selectionMenu.text || '这段代码有什么问题吗？' })
}

// ─── Editor Gutter Click ───
function onEditorGutterClick(line: number) {
  if (breakpoints.has(line)) { breakpoints.delete(line); return }
  breakpoints.add(line)
  currentConcept.value = {
    context: `行 ${line} 代码`,
    name: content.knowledgePoints?.[0]?.name || '代码分析',
    description: `AI 对第 ${line} 行代码的详细原理解释\n\n这是一个思维断点，你可以在这里探索更多。`,
  }
}

// ─── Run ───
async function handleRun() {
  if (!activeFile.value) return
  runState.value = 'running'
  outputState.value = 'running'
  try {
    const result = await runCode({
      source_code: activeFileContent.value,
      language: content.language,
      expected_output: content.expectedOutput,
    })
    runResult.value = result
    if (result.status_code === 3) {
      runState.value = 'success'; outputState.value = 'success'; lastRunState.value = 'success'
      completeCurrentStep()
      scheduleAutoCollapse()
    } else if (result.status_code === 5 || result.status_code === 11) {
      runState.value = 'timeout'; outputState.value = 'timeout'
    } else {
      runState.value = 'error'; outputState.value = 'error'; lastRunState.value = 'error'
    }
    generateTraces(result)
    showTrajectory.value = true
    startTracePlayback()
  } catch {
    runState.value = 'error'; outputState.value = 'error'
  }
}

function completeCurrentStep() {
  completedSteps.add(currentStepIndex.value)
  if (currentStepIndex.value < content.steps.length - 1) {
    setTimeout(() => onStepClick(currentStepIndex.value + 1), 600)
  }
}

function scheduleAutoCollapse() {
  if (autoCollapseTimer) clearTimeout(autoCollapseTimer)
  autoCollapseTimer = setTimeout(() => {
    if (outputState.value === 'success' || outputState.value === 'error') {
      outputState.value = 'collapsed'
    }
  }, 5000)
}

function generateTraces(result: CodeRunResult) {
  traces.value = [
    { order: 1, line: 6, scope: { numbers: [1, 2, 3, 4, 5] } },
    { order: 2, line: 7, scope: { x: 1 } },
    { order: 3, line: 7, scope: { x: 2 } },
    { order: 4, line: 7, scope: { x: 3 } },
    { order: 5, line: 7, scope: { x: 4 } },
    { order: 6, line: 7, scope: { x: 5 } },
    { order: 7, line: 8, scope: { squared: [1, 4, 9, 16, 25] } },
  ]
  totalTraceDuration.value = result.time || 0.02
  currentTraceStep.value = 0
}

// ─── Trace Playback ───
function startTracePlayback() {
  stopTracePlayback()
  currentTraceStep.value = 0
  tracePlaying.value = true
  const interval = Math.max(200, Math.round((totalTraceDuration.value * 1000) / traces.value.length / traceSpeed.value))
  traceTimer = setInterval(() => {
    if (currentTraceStep.value < traces.value.length - 1) {
      currentTraceStep.value++
    } else {
      stopTracePlayback()
    }
  }, interval)
}

function stopTracePlayback() {
  if (traceTimer) { clearInterval(traceTimer); traceTimer = null }
  tracePlaying.value = false
}

function onTraceToggle() {
  if (tracePlaying.value) { stopTracePlayback(); return }
  if (currentTraceStep.value >= traces.value.length - 1) currentTraceStep.value = 0
  startTracePlayback()
}

function onTraceStep() {
  stopTracePlayback()
  if (currentTraceStep.value < traces.value.length - 1) currentTraceStep.value++
}

function onTraceJumpStart() {
  stopTracePlayback()
  currentTraceStep.value = 0
}

function onTraceSpeed(speed: number) {
  traceSpeed.value = speed
  if (tracePlaying.value) startTracePlayback()
}

// ─── Reset ───
function handleReset() {
  if (autoCollapseTimer) clearTimeout(autoCollapseTimer)
  content.files.forEach(f => editedFiles.value.set(f.filename, f.content))
  runState.value = 'idle'; outputState.value = 'idle'; runResult.value = null
  traces.value = []; stopTracePlayback()
  ElMessage.success('代码已重置')
}

// ─── Copy / Download ───
async function handleCopy() {
  try { await navigator.clipboard.writeText(activeFileContent.value); ElMessage.success('代码已复制') }
  catch { ElMessage.error('复制失败') }
}
async function handleDownload() {
  const files = content.files
  if (!files?.length) return
  if (files.length === 1) downloadBlob(editedFiles.value.get(files[0].filename) ?? files[0].content, content.title + '.py')
  else await downloadAsZip(files)
}
function downloadBlob(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click()
}
async function downloadAsZip(files: CodeFile[]) {
  try {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    files.forEach(f => zip.file(f.filename, editedFiles.value.get(f.filename) ?? f.content))
    const blob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(URL.createObjectURL(blob), content.title + '.zip')
  } catch { ElMessage.error('ZIP 打包失败') }
}

// ─── Hints ───
function showNextHint(event: MouseEvent) {
  if (hintLevel.value >= 3) return
  currentHintLevel.value = hintLevel.value
  hintLevel.value++
  hintVisible.value = true
  hintStyle.value = { top: (event.clientY - 200) + 'px', left: (event.clientX - 150) + 'px' }
}

// ─── Concept / Tutor / Nav ───
function onConceptClick(name: string) {
  currentConcept.value = { context: '关联概念', name, description: `关于 "${name}" 的详细解释...` }
}
function onStartChallenge(_challenge: any) { mode.value = 'edit' }
function onTutorSend(text: string) {
  tutorMessages.value.push({ role: 'user', content: text })
  setTimeout(() => {
    tutorMessages.value.push({ role: 'assistant', content: `关于 "${text}" 的问题，这里是 AI 助教的回答。\n\n这是一个很好的问题！让我为你详细解释...` })
  }, 500)
}
function onContextTabChange(_tab: ContextTab) { /* noop */ }
function onGoalClick(id: string) {
  const goal = content.learningGoals?.find(g => g.id === id)
  if (goal?.relatedSteps.length) onStepClick(goal.relatedSteps[0])
}
function onGotoLine(line: number) {
  if (!editorWrapperRef.value) return
  editorWrapperRef.value.scrollTo({ top: (line - 3) * LINE_H, behavior: 'smooth' })
  highlightedLines.value = [line]
}
function onCodeChange(value: string) {
  if (activeFile.value) editedFiles.value.set(activeFile.value.filename, value)
}
function handleBack() { router.back() }

onUnmounted(() => {
  if (autoCollapseTimer) clearTimeout(autoCollapseTimer)
  stopTracePlayback()
  if (hoverTimer) clearTimeout(hoverTimer)
  if (selectionTimer) clearTimeout(selectionTimer)
})
</script>

<style scoped>
.code-learn-view { display: flex; flex-direction: column; height: 100vh; background: var(--lt-bg-page); overflow: hidden; }
.code-learn-view.fullscreen { position: fixed; inset: 0; z-index: 1000; }
.code-body { display: flex; flex: 1; min-height: 0; }

/* Left: Code Main Area */
.code-main-area {
  flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px;
  padding: 12px 0 12px 16px; overflow: hidden; transition: flex 0.3s;
}
.code-main-area.trajectory-mode { flex: 0 0 60%; }
.code-main-area.edit-mode { flex: 0 0 75%; }

.code-editor-container { flex: 1; display: flex; flex-direction: column; position: relative; min-height: 0; }
.editor-wrapper {
  flex: 1; position: relative; overflow: auto;
  border: 1px solid var(--lt-border); border-radius: var(--lt-radius-md); min-height: 200px;
}

/* Fold Overlay */
.fold-overlay {
  position: absolute; left: 44px; right: 0; z-index: 5; pointer-events: auto;
  animation: fold-slide-in 250ms cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes fold-slide-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.fold-placeholder {
  height: 100%; display: flex; align-items: center; gap: 8px;
  padding: 0 16px; border: 1px dashed var(--lt-border);
  border-radius: var(--lt-radius-sm); background: rgba(0, 0, 0, 0.03);
  cursor: pointer; transition: background 0.15s;
}
.fold-placeholder:hover { background: rgba(0, 0, 0, 0.06); }
.fold-icon { font-size: 14px; }
.fold-title { font-size: 12px; font-weight: 500; color: var(--lt-text-secondary); }
.fold-desc { font-size: 11px; color: var(--lt-text-auxiliary); }

/* Toolbar */
.code-toolbar-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 0; flex-shrink: 0;
}
.toolbar-left { display: flex; align-items: center; gap: 6px; }
.toolbar-right { font-size: 12px; font-family: var(--lt-font-mono); color: var(--lt-text-auxiliary); }

/* Right Panel */
.right-panel-wrapper { width: 35%; min-width: 280px; transition: width 0.3s; }
.right-panel-wrapper.compressed { width: 25%; min-width: 200px; }

/* Hint Popover */
.hint-popover {
  position: fixed; z-index: 2001; width: 300px;
  background: var(--lt-bg-card); border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-md); box-shadow: var(--lt-shadow-elevated);
  padding: 12px; cursor: pointer;
}
.hint-level { font-size: 11px; font-weight: 500; color: var(--lt-brand); margin-bottom: 6px; }
.hint-content { font-size: 13px; color: var(--lt-text-primary); line-height: 1.6; }
.hint-code { margin-top: 8px; padding: 6px 10px; background: #1e1e2e; border-radius: var(--lt-radius-sm); }
.hint-code pre { margin: 0; font-family: var(--lt-font-mono); font-size: 12px; color: #d4d4d4; }

/* 离开提示遮罩 */
.learning-away-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 3000; backdrop-filter: blur(4px);
}
.learning-away-card {
  background: var(--lt-bg-card); border-radius: 16px;
  padding: 32px 48px; text-align: center;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
