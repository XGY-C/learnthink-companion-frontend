<template>
  <!-- Legacy Markdown fallback -->
  <MarkdownViewer v-if="isLegacy" :content="content" :showToc="false" />

  <!-- New structured rendering -->
  <div v-else-if="parsed" class="code-learning-viewer">
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

    <CodeEditorPanel
      :content="activeFileContent"
      :language="parsed.language"
      :filename="activeFile?.filename ?? ''"
      :read-only="mode === 'read'"
      :highlighted-lines="highlightedLines"
      @update:content="onCodeChange"
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

    <CodeOutput
      v-if="runState !== 'idle'"
      :state="runState"
      :result="runResult"
      :expected="parsed.expectedOutput"
    />

    <CodeStepList
      v-if="mode === 'read' && parsed.steps.length > 0"
      :steps="parsed.steps"
      @hover-step="onStepHover"
      @click-step="onStepClick"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import CodeHeader from './CodeHeader.vue'
import CodeDescription from './CodeDescription.vue'
import CodeFileTabs from './CodeFileTabs.vue'
import CodeEditorPanel from './CodeEditorPanel.vue'
import CodeToolbar from './CodeToolbar.vue'
import CodeOutput from './CodeOutput.vue'
import CodeStepList from './CodeStepList.vue'
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

onMounted(() => {
  parsed.value = parseCodeContent(props.content)
  isLegacy.value = parsed.value === null
  parsed.value?.files.forEach(f => editedFiles.value.set(f.filename, f.content))
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
  if (step.references.length > 0) {
    const targetFile = step.references[0].filename
    const idx = parsed.value?.files.findIndex(f => f.filename === targetFile)
    if (idx !== undefined && idx >= 0) {
      activeFileIndex.value = idx
    }
  }
  const activeFilename = activeFile.value?.filename
  const lines: number[] = []
  for (const ref of step.references) {
    if (ref.filename === activeFilename) {
      for (let i = ref.startLine; i <= ref.endLine; i++) lines.push(i)
    }
  }
  highlightedLines.value = lines
}
</script>

<style scoped>
.code-learning-viewer {
  display: flex;
  flex-direction: column;
  gap: 0;
}
</style>
