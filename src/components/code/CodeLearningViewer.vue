<template>
  <!-- Legacy Markdown fallback -->
  <MarkdownViewer v-if="isLegacy" :content="content" :showToc="false" />

  <!-- New structured rendering -->
  <div v-else-if="parsed" class="code-learning-viewer">
    <div class="clv-main">
      <div class="clv-code-pane">
        <CodeHeader
          :title="parsed.title"
          :language="parsed.language"
          :mode="mode"
          @toggle-mode="mode = mode === 'read' ? 'edit' : 'read'"
        />

        <CodeDescription :content="parsed.description" />

        <CodeFileTabs
          v-if="parsed.files.length > 1"
          :files="parsed.files"
          :active-index="activeFileIndex"
          :edited="editedFiles"
          @select="activeFileIndex = $event"
        />

        <div class="clv-editor-wrapper">
          <CodeEditorPanel
            ref="editorRef"
            :content="activeFileContent"
            :language="parsed.language"
            :filename="activeFile?.filename ?? ''"
            :read-only="mode === 'read'"
            :highlighted-lines="highlightedLines"
            :gutter-markers="editorGutterMarkers"
            @gutter-click="onGutterClick"
            @update:content="onCodeChange"
            @selection-change="onSelectionChange"
          />

          <SelectionFloatingMenu
            :visible="selectionMenu.visible"
            :x="selectionMenu.x"
            :y="selectionMenu.y"
            @smart-explain="onSelectionSmartExplain"
            @ask-ai="onSelectionAskAi"
          />

          <CodeToolbar
            :mode="mode"
            :run-state="runState"
            :can-run="canRun"
            :active-filename="activeFile?.filename ?? ''"
            @run="handleRun"
            @reset="handleReset"
            @copy="handleCopy"
            @download="handleDownload"
          />
        </div>

        <CodeOutput
          v-if="runState !== 'idle'"
          :state="runState"
          :result="runResult"
          :expected="parsed.expectedOutput"
        />
      </div>

      <CodeStepList
        v-if="mode === 'read' && parsed.steps.length > 0"
        class="clv-steps-pane"
        :steps="parsed.steps"
        @hover-step="onStepHover"
        @click-step="onStepClick"
      />
    </div>

    <TutoringDrawer
      :visible="showTutoringDrawer"
      :initial-question="tutoringInitQuestion"
      :quoted-text="tutoringQuotedText"
      @close="handleTutoringClose"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import CodeHeader from './CodeHeader.vue'
import CodeDescription from './CodeDescription.vue'
import CodeFileTabs from './CodeFileTabs.vue'
import CodeEditorPanel from './CodeEditorPanel.vue'
import type { GutterMarkerDef } from './CodeEditorPanel.vue'
import CodeToolbar from './CodeToolbar.vue'
import CodeOutput from './CodeOutput.vue'
import CodeStepList from './CodeStepList.vue'
import SelectionFloatingMenu from './SelectionFloatingMenu.vue'
import TutoringDrawer from '@/components/tutoring/TutoringDrawer.vue'
import { runCode } from '@/utils/codeRunner'
import type { CodeRunResult } from '@/types'

export interface CodeFile {
  filename: string
  content: string
  isEntry?: boolean
}

export interface CodeLineRef {
  filename: string
  startLine: number
  endLine: number
}

export interface CodeStep {
  title: string
  content: string
  references: CodeLineRef[]
}

export interface CodeContent {
  title: string
  language: string
  description: string
  files: CodeFile[]
  steps: CodeStep[]
  expectedOutput?: string
  extensionIdeas: string[]
}

const props = defineProps<{
  content: string
  title: string
  qualityScore?: number
  sourcesCount?: number
}>()

const mode = ref<'read' | 'edit'>('read')
const parsed = ref<CodeContent | null>(null)
const isLegacy = ref(false)
const activeFileIndex = ref(0)
const runState = ref<'idle' | 'running' | 'success' | 'error' | 'timeout'>('idle')
const runResult = ref<CodeRunResult | null>(null)
const editedFiles = ref<Map<string, string>>(new Map())
const highlightedLines = ref<number[]>([])
const currentStepIndex = ref<number | null>(null)
const breakpoints = reactive(new Set<string>())
const editorRef = ref<InstanceType<typeof CodeEditorPanel> | null>(null)

const selectionMenu = reactive({ visible: false, x: 0, y: 0, text: '' })
let selectionTimer: ReturnType<typeof setTimeout> | null = null

const showTutoringDrawer = ref(false)
const tutoringQuotedText = ref('')
const tutoringInitQuestion = ref('')

const activeFile = computed(() => parsed.value?.files[activeFileIndex.value])
const activeFileContent = computed(() =>
  editedFiles.value.get(activeFile.value?.filename ?? '') ?? activeFile.value?.content ?? ''
)
const canRun = computed(() => mode.value === 'edit' && runState.value !== 'running')

function parseCodeContent(raw: string): CodeContent | null {
  try {
    const obj = JSON.parse(raw)
    if (obj && typeof obj === 'object' && 'files' in obj && 'steps' in obj) {
      return obj as CodeContent
    }
    return null
  } catch {
    return null
  }
}

function applyContent(raw: string) {
  const next = parseCodeContent(raw)
  parsed.value = next
  isLegacy.value = next === null
  if (next) {
    activeFileIndex.value = 0
    editedFiles.value = new Map()
    next.files.forEach(f => editedFiles.value.set(f.filename, f.content))
    runState.value = 'idle'
    runResult.value = null
    highlightedLines.value = []
    currentStepIndex.value = null
    breakpoints.clear()
  }
}

onMounted(() => {
  applyContent(props.content)
})

// Re-parse when content changes after mount (e.g. async detail loading in preview dialogs)
watch(() => props.content, (raw) => {
  applyContent(raw)
})

function onCodeChange(value: string) {
  if (activeFile.value) {
    editedFiles.value.set(activeFile.value.filename, value)
  }
}

const LANGUAGE_EXT: Record<string, string> = {
  python: '.py', javascript: '.js', java: '.java', cpp: '.cpp', go: '.go', rust: '.rs',
}

async function handleRun() {
  if (!parsed.value || !activeFile.value) return
  runState.value = 'running'
  try {
    const result = await runCode({
      source_code: activeFileContent.value,
      language: parsed.value.language,
      expected_output: parsed.value.expectedOutput,
    })
    runResult.value = result
    if (result.status_code === 3) {
      runState.value = 'success'
    } else if (result.status_code === 5 || result.status_code === 11) {
      runState.value = 'timeout'
    } else {
      runState.value = 'error'
    }
  } catch (e: any) {
    runResult.value = {
      stdout: null,
      stderr: e?.message || '运行请求失败',
      compile_output: null,
      status: 'Error',
      status_code: 12,
      time: null,
      memory: null,
    }
    runState.value = 'error'
  }
}

function handleReset() {
  parsed.value?.files.forEach(f => editedFiles.value.set(f.filename, f.content))
  runState.value = 'idle'
  runResult.value = null
  ElMessage.success('代码已重置')
}

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(activeFileContent.value)
    ElMessage.success('代码已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

async function handleDownload() {
  const files = parsed.value?.files
  if (!files || files.length === 0) return
  if (files.length === 1) {
    const f = files[0]
    const content = editedFiles.value.get(f.filename) ?? f.content
    const ext = LANGUAGE_EXT[parsed.value?.language ?? ''] ?? '.py'
    downloadBlob(content, (parsed.value?.title ?? 'code') + ext)
  } else {
    await downloadAsZip(files)
  }
}

function downloadBlob(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

async function downloadAsZip(files: CodeFile[]) {
  try {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    files.forEach(f => {
      zip.file(f.filename, editedFiles.value.get(f.filename) ?? f.content)
    })
    const blob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(URL.createObjectURL(blob), (parsed.value?.title ?? 'code') + '.zip')
  } catch {
    ElMessage.error('ZIP 打包失败，请确保已安装 jszip 依赖')
  }
}

function onStepHover(refs: CodeLineRef[]) {
  if (refs.length === 0) {
    highlightedLines.value = []
    return
  }
  const activeFilename = activeFile.value?.filename
  const lines: number[] = []
  for (const ref of refs) {
    if (ref.filename === activeFilename) {
      for (let i = ref.startLine; i <= ref.endLine; i++) lines.push(i)
    }
  }
  highlightedLines.value = lines
}

function onStepClick(step: CodeStep) {
  const stepIdx = parsed.value?.steps.indexOf(step) ?? -1
  currentStepIndex.value = stepIdx >= 0 ? stepIdx : null
  if (step.references.length === 0) return
  const targetRef = step.references[0]
  const targetFile = targetRef.filename
  const idx = parsed.value?.files.findIndex(f => f.filename === targetFile)
  const needSwitchFile = idx !== undefined && idx >= 0 && idx !== activeFileIndex.value

  if (needSwitchFile && idx !== undefined) {
    activeFileIndex.value = idx
    nextTick(() => {
      nextTick(() => {
        editorRef.value?.scrollToLine(targetRef.startLine)
      })
    })
  } else {
    editorRef.value?.scrollToLine(targetRef.startLine)
  }

  const lines: number[] = []
  for (const ref of step.references) {
    if (ref.filename === targetFile) {
      for (let i = ref.startLine; i <= ref.endLine; i++) lines.push(i)
    }
  }
  highlightedLines.value = lines
}

const editorGutterMarkers = computed<GutterMarkerDef[]>(() => {
  const markers: GutterMarkerDef[] = []
  const activeFilename = activeFile.value?.filename
  if (currentStepIndex.value !== null && parsed.value) {
    const step = parsed.value.steps[currentStepIndex.value]
    if (step) {
      for (const ref of step.references) {
        if (ref.filename === activeFilename) {
          for (let l = ref.startLine; l <= ref.endLine; l++) {
            markers.push({ line: l, type: 'step-range', symbol: '┃' })
          }
        }
      }
    }
  }
  const prefix = (activeFilename ?? '') + ':'
  for (const key of breakpoints) {
    if (prefix && key.startsWith(prefix)) {
      const line = Number(key.slice(prefix.length))
      if (!Number.isNaN(line)) markers.push({ line, type: 'breakpoint', symbol: '◆' })
    }
  }
  return markers
})

function onGutterClick(line: number) {
  const filename = activeFile.value?.filename
  if (!filename) return
  const key = `${filename}:${line}`
  if (breakpoints.has(key)) breakpoints.delete(key)
  else breakpoints.add(key)
}

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

function onSelectionSmartExplain() {
  const code = selectionMenu.text
  selectionMenu.visible = false
  tutoringQuotedText.value = ''
  tutoringInitQuestion.value = `请解释以下代码：\n\`\`\`\n${code}\n\`\`\``
  showTutoringDrawer.value = true
}
function onSelectionAskAi() {
  selectionMenu.visible = false
  tutoringQuotedText.value = selectionMenu.text
  tutoringInitQuestion.value = ''
  showTutoringDrawer.value = true
}

function handleTutoringClose() {
  showTutoringDrawer.value = false
  tutoringQuotedText.value = ''
  tutoringInitQuestion.value = ''
}
</script>

<style scoped>
.code-learning-viewer {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.clv-main {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.clv-code-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.clv-editor-wrapper {
  position: relative;
}
.clv-editor-wrapper:hover :deep(.code-toolbar) {
  opacity: 1;
}

.clv-steps-pane {
  flex-shrink: 0;
  overflow-y: auto;
}

@media (min-width: 1200px) {
  .clv-main {
    flex-direction: row;
    align-items: flex-start;
    gap: var(--lt-space-loose);
  }

  .clv-code-pane {
    flex: 1 1 0;
    min-width: 0;
  }

  .clv-steps-pane {
    width: 380px;
    position: sticky;
    top: var(--lt-space-loose);
    max-height: calc(100vh - var(--lt-space-loose) * 2);
    overflow-y: auto;
    padding-left: var(--lt-space-loose);
    border-left: 1px solid var(--lt-border);
  }
}
</style>
