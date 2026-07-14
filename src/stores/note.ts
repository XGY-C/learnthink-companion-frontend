import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { apiFetch } from '@/utils/api'
import { ElMessage } from 'element-plus'
import type { Note, CreateNoteRequest, UpdateNoteRequest } from '@/types'

export const useNoteStore = defineStore('note', () => {
  const notes = ref<Note[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const sidebarOpen = ref(false)

  const SIDEBAR_KEY = 'lt-note-sidebar'
  const saved = localStorage.getItem(SIDEBAR_KEY)
  if (saved === 'true') sidebarOpen.value = true
  watch(sidebarOpen, (val) => {
    localStorage.setItem(SIDEBAR_KEY, String(val))
  })

  const availableCount = computed(() => notes.value.length)

  async function fetchNotes(params: { courseId: string; resourcePackId?: string; resourceItemId?: string; notebookId?: string }) {
    loading.value = true
    error.value = null
    try {
      const query = new URLSearchParams({ courseId: params.courseId })
      if (params.resourcePackId) query.set('resourcePackId', params.resourcePackId)
      if (params.resourceItemId) query.set('resourceItemId', params.resourceItemId)
      if (params.notebookId) query.set('notebookId', params.notebookId)
      const res = await apiFetch<Note[]>(`/notes?${query}`)
      if (res.data) notes.value = res.data
    } catch {
      error.value = '笔记加载失败'
    } finally {
      loading.value = false
    }
  }

  async function createNote(req: CreateNoteRequest): Promise<Note | null> {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const tempNote: Note = {
      id: tempId,
      userId: '',
      courseId: req.courseId,
      resourcePackId: req.resourcePackId,
      resourceItemId: req.resourceItemId,
      resourceTitle: req.resourceTitle,
      sectionTitle: req.sectionTitle,
      content: req.content,
      selectedText: req.selectedText,
      anchorId: req.anchorId,
      textRange: req.textRange,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    notes.value.unshift(tempNote)

    try {
      const res = await apiFetch<Note>('/notes', { method: 'POST', body: req })
      if (res.data) {
        const idx = notes.value.findIndex(n => n.id === tempId)
        if (idx >= 0) notes.value[idx] = res.data
        return res.data
      }
      throw new Error('create returned empty')
    } catch {
      notes.value = notes.value.filter(n => n.id !== tempId)
      ElMessage.error('笔记保存失败')
      return null
    }
  }

  async function updateNote(id: string, req: UpdateNoteRequest): Promise<boolean> {
    const idx = notes.value.findIndex(n => n.id === id)
    if (idx < 0) return false

    const original = { ...notes.value[idx] }
    notes.value[idx] = { ...original, content: req.content }

    try {
      const res = await apiFetch<Note>(`/notes/${id}`, { method: 'PUT', body: req })
      if (res.data) { notes.value[idx] = res.data; return true }
      throw new Error('update failed')
    } catch {
      notes.value[idx] = original
      ElMessage.error('笔记更新失败')
      return false
    }
  }

  async function deleteNote(id: string): Promise<boolean> {
    const snapshot = notes.value.map(n => ({ ...n }))
    notes.value = notes.value.filter(n => n.id !== id)
    try {
      await apiFetch(`/notes/${id}`, { method: 'DELETE' })
      return true
    } catch {
      notes.value = snapshot
      ElMessage.error('删除失败')
      return false
    }
  }

  function resetNotes() { notes.value = []; error.value = null }

  const sidebarView = ref<'list' | 'notebook' | 'editor'>('list')
  const editingNote = ref<Note | null>(null)

  function toggleSidebar() {
    sidebarView.value = 'list'
    sidebarOpen.value = !sidebarOpen.value
  }
  function openSidebar() {
    editingNote.value = null
    sidebarView.value = 'editor'
    sidebarOpen.value = true
  }
  function closeSidebar() { sidebarOpen.value = false }
  function showList() { sidebarView.value = 'list' }
  function enterNotebookView() { sidebarView.value = 'notebook' }
  function showNoteEditor() {
    editingNote.value = null
    sidebarView.value = 'editor'
  }
  function startEditNote(note: Note) {
    editingNote.value = note
    sidebarView.value = 'editor'
  }
  function hideNoteEditor() {
    editingNote.value = null
    sidebarView.value = 'notebook'
  }

  return {
    notes, loading, error, sidebarOpen, sidebarView, editingNote, availableCount,
    fetchNotes, createNote, updateNote, deleteNote,
    resetNotes, toggleSidebar, openSidebar, closeSidebar, showList, enterNotebookView,
    showNoteEditor, startEditNote, hideNoteEditor,
  }
})
