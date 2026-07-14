<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useForumStore } from '@/stores/forum'
import { EditPen, Delete, Upload } from '@element-plus/icons-vue'

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void
  (e: 'update:files', val: any[]): void
  (e: 'update:resourceItemIds', val: string[]): void
}>()

const props = defineProps<{
  modelValue: string
  files: any[]
  resourceItemIds: string[]
}>()

const store = useForumStore()
const textareaRef = ref<HTMLTextAreaElement>()
const uploading = ref(false)

function wrapSelection(before: string, after: string = before) {
  const ta = textareaRef.value
  if (!ta) return
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const selected = ta.value.substring(start, end) || '文本'
  const newText = ta.value.substring(0, start) + before + selected + after + ta.value.substring(end)
  emit('update:modelValue', newText)
  nextTick(() => {
    ta.focus()
    ta.selectionStart = start + before.length
    ta.selectionEnd = start + before.length + selected.length
  })
}

function prependLine(prefix: string) {
  const ta = textareaRef.value
  if (!ta) return
  const start = ta.selectionStart
  const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1
  const newText = ta.value.substring(0, lineStart) + prefix + ta.value.substring(lineStart)
  emit('update:modelValue', newText)
  nextTick(() => {
    ta.focus()
    ta.selectionStart = ta.selectionEnd = start + prefix.length
  })
}

function insertBold() { wrapSelection('**') }
function insertItalic() { wrapSelection('*') }
function insertHeading(level: number) { prependLine('#'.repeat(level) + ' ') }
function insertBlockquote() { prependLine('> ') }
function insertInlineCode() { wrapSelection('`') }
function insertCodeBlock() { wrapSelection('```\n', '\n```') }
function insertUnorderedList() { prependLine('- ') }
function insertOrderedList() { prependLine('1. ') }

function insertLink() {
  const url = prompt('输入链接地址:', 'https://')
  if (url) wrapSelection('[', `](${url})`)
}

function insertImage() {
  const el = document.createElement('input')
  el.type = 'file'
  el.accept = 'image/*'
  el.onchange = async () => {
    const file = el.files?.[0]
    if (!file) return
    uploading.value = true
    try {
      const { url } = await store.uploadImage(file)
      wrapSelection('![', `](${url})`)
    } finally { uploading.value = false }
  }
  el.click()
}

function handleFileUpload() {
  const el = document.createElement('input')
  el.type = 'file'
  el.multiple = true
  el.accept = '.pdf,.doc,.docx,.xmind,.pptx,.txt,.zip,.rar'
  el.onchange = async () => {
    const fileList = Array.from(el.files || [])
    uploading.value = true
    try {
      for (const file of fileList) {
        const result = await store.uploadFile(file)
        props.files.push(result)
      }
      emit('update:files', [...props.files])
    } finally { uploading.value = false }
  }
  el.click()
}

function removeFile(index: number) {
  props.files.splice(index, 1)
  emit('update:files', [...props.files])
}

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <div class="forum-editor">
    <div class="toolbar flex items-center gap-1 flex-wrap p-2 rounded-t-lg" style="border: 1px solid var(--lt-border); border-bottom: none; background: var(--lt-bg-page);">
      <el-tooltip content="粗体"><button type="button" class="toolbar-btn" @click="insertBold"><b>B</b></button></el-tooltip>
      <el-tooltip content="斜体"><button type="button" class="toolbar-btn" @click="insertItalic"><i>I</i></button></el-tooltip>
      <div class="toolbar-divider" />
      <el-tooltip content="标题1"><button type="button" class="toolbar-btn text-sm font-bold" @click="insertHeading(1)">H1</button></el-tooltip>
      <el-tooltip content="标题2"><button type="button" class="toolbar-btn text-sm font-bold" @click="insertHeading(2)">H2</button></el-tooltip>
      <el-tooltip content="标题3"><button type="button" class="toolbar-btn text-sm font-bold" @click="insertHeading(3)">H3</button></el-tooltip>
      <div class="toolbar-divider" />
      <el-tooltip content="引用"><button type="button" class="toolbar-btn" @click="insertBlockquote">❝</button></el-tooltip>
      <el-tooltip content="行内代码"><button type="button" class="toolbar-btn text-sm font-mono" @click="insertInlineCode">&lt;/&gt;</button></el-tooltip>
      <el-tooltip content="代码块"><button type="button" class="toolbar-btn text-sm font-mono" @click="insertCodeBlock">{ }</button></el-tooltip>
      <el-tooltip content="无序列表"><button type="button" class="toolbar-btn" @click="insertUnorderedList">≡</button></el-tooltip>
      <el-tooltip content="有序列表"><button type="button" class="toolbar-btn" @click="insertOrderedList">#</button></el-tooltip>
      <div class="toolbar-divider" />
      <el-tooltip content="插入链接"><button type="button" class="toolbar-btn" @click="insertLink">🔗</button></el-tooltip>
      <el-tooltip content="插入图片"><button type="button" class="toolbar-btn" @click="insertImage">🖼</button></el-tooltip>
    </div>
    <textarea
      ref="textareaRef"
      :value="modelValue"
      @input="onInput"
      class="editor-textarea"
      placeholder="在这里输入正文（支持 Markdown 语法）..."
    />

    <div class="upload-section mt-3">
      <el-button size="small" :icon="Upload" @click="handleFileUpload" :loading="uploading">
        选择文件
      </el-button>
      <div v-if="files.length > 0" class="file-list mt-2 flex flex-wrap gap-2">
        <div
          v-for="(file, idx) in files" :key="idx"
          class="file-item flex items-center gap-2 px-3 py-1.5 rounded-md text-sm"
          style="background: var(--lt-brand-lightest); color: var(--lt-text-secondary);"
        >
          <el-icon :size="14"><EditPen /></el-icon>
          <span class="truncate max-w-[180px]">{{ file.fileName }}</span>
          <el-button :icon="Delete" text size="small" @click="removeFile(idx)" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: var(--lt-text-secondary);
  font-size: 14px;
  transition: all var(--lt-transition-base);
}
.toolbar-btn:hover {
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
}
.toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--lt-border);
  margin: 0 4px;
}
.editor-textarea {
  width: 100%;
  min-height: 240px;
  padding: 16px;
  border: 1px solid var(--lt-border);
  border-radius: 0 0 var(--lt-radius-md) var(--lt-radius-md);
  background: var(--lt-bg-card);
  color: var(--lt-text-primary);
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  font-family: inherit;
  transition: border-color var(--lt-transition-base);
}
.editor-textarea:focus {
  border-color: var(--lt-brand-lighter);
  box-shadow: 0 0 0 2px rgba(43, 111, 255, 0.08);
}
.editor-textarea::placeholder {
  color: var(--lt-text-placeholder);
}
</style>
