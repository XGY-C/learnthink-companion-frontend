<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useNoteStore } from '@/stores/note'
import { useNotebookStore } from '@/stores/notebook'
import type { Note } from '@/types'

const props = withDefaults(defineProps<{
  courseId: string
  sectionTitle?: string
  resourcePackId?: string
  resourceTitle?: string
  selectedText?: string
  anchorId?: string
  textRange?: string
  fullPage?: boolean
}>(), {})

const emit = defineEmits<{ saved: [note: Note] }>()

const noteStore = useNoteStore()
const notebookStore = useNotebookStore()
const content = ref('')
const saving = ref(false)

const isEditing = computed(() => !!noteStore.editingNote)

const DRAFT_KEY = computed(() =>
  noteStore.editingNote
    ? `lt-note-edit-${noteStore.editingNote.id}`
    : `lt-note-draft-${props.resourcePackId || 'global'}`
)

onMounted(() => {
  if (noteStore.editingNote) {
    content.value = noteStore.editingNote.content
  } else {
    const saved = localStorage.getItem(DRAFT_KEY.value)
    if (saved?.trim()) content.value = saved
  }
})

let draftTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  draftTimer = setInterval(() => {
    if (content.value.trim()) {
      localStorage.setItem(DRAFT_KEY.value, content.value)
    }
  }, 3000)
})
onUnmounted(() => {
  if (draftTimer) clearInterval(draftTimer)
})

async function handleSave() {
  if (!content.value.trim() || saving.value) return
  saving.value = true
  if (noteStore.editingNote) {
    const ok = await noteStore.updateNote(noteStore.editingNote.id, { content: content.value.trim() })
    if (ok) {
      content.value = ''
      localStorage.removeItem(DRAFT_KEY.value)
      emit('saved', noteStore.editingNote)
    }
  } else {
    const note = await noteStore.createNote({
      courseId: props.courseId,
      notebookId: notebookStore.activeNotebookId || undefined,
      resourcePackId: props.resourcePackId,
      resourceTitle: props.resourceTitle,
      sectionTitle: props.sectionTitle,
      content: content.value.trim(),
      selectedText: props.selectedText,
      anchorId: props.anchorId,
      textRange: props.textRange,
    })
    if (note) {
      content.value = ''
      localStorage.removeItem(DRAFT_KEY.value)
      emit('saved', note)
    }
  }
  saving.value = false
}

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    handleSave()
  }
}
</script>

<template>
  <div class="note-input" :class="{ 'note-input--full': fullPage }">
    <div v-if="props.sectionTitle" class="note-input-context">
      {{ props.sectionTitle }}
    </div>
    <div v-if="props.selectedText" class="note-input-selected">
      <span class="note-input-selected-label">📎 已引用:</span>
      <span class="note-input-selected-text">{{ props.selectedText }}</span>
    </div>
    <textarea
      v-model="content"
      class="note-textarea"
      :placeholder="'写笔记... (Ctrl+Enter 保存)'"
      :rows="fullPage ? undefined : 3"
      @keydown="onKeydown"
    />
    <div class="note-input-bar">
      <span v-if="content.trim()" class="note-draft-hint">内容已自动保存</span>
      <span v-else />
      <el-button
        size="small"
        type="primary"
        :disabled="!content.trim()"
        :loading="saving"
        @click="handleSave"
      >
        {{ isEditing ? '更新' : '保存' }}
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.note-input { padding: 12px 16px; }
.note-input--full {
  flex: 1; display: flex; flex-direction: column;
  padding: 16px;
}
.note-input--full .note-textarea { flex: 1; min-height: 120px; resize: vertical; }
.note-input-context {
  font-size: 11px; color: var(--lt-text-placeholder);
  margin-bottom: 6px; padding: 2px 6px;
  background: var(--lt-bg-page); border-radius: 4px;
  display: inline-block; max-width: 100%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.note-input-selected {
  display: flex; align-items: flex-start; gap: 4px;
  margin-bottom: 6px; padding: 4px 8px;
  background: #fff5e6; border-radius: 4px;
  font-size: 12px; line-height: 1.5;
}
.note-input-selected-label {
  color: var(--lt-orange); white-space: nowrap; flex-shrink: 0;
}
.note-input-selected-text {
  color: var(--lt-text-secondary);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.note-textarea {
  width: 100%; padding: 8px 10px;
  border: 1px solid var(--lt-border); border-radius: var(--lt-radius-sm);
  font-size: 13px; line-height: 1.6;
  resize: none; font-family: inherit;
  background: var(--lt-bg-page); color: var(--lt-text-primary);
  transition: border-color 0.2s, background 0.2s;
}
.note-textarea:focus {
  outline: none; border-color: var(--lt-brand);
  background: var(--lt-bg-card);
}
.note-input-bar {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 8px;
}
.note-draft-hint { font-size: 11px; color: var(--lt-text-placeholder); }
</style>
