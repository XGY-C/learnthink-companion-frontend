import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiFetch } from '@/utils/api'
import { ElMessage } from 'element-plus'
import type { Notebook, CreateNotebookRequest, UpdateNotebookRequest } from '@/types'

export const useNotebookStore = defineStore('notebook', () => {
  const notebooks = ref<Notebook[]>([])
  const activeNotebookId = ref<string | null>(null)
  const loading = ref(false)
  const loadedCourseId = ref<string | null>(null)

  const activeNotebook = computed(() =>
    notebooks.value.find(n => n.id === activeNotebookId.value) || null
  )

  const hasNotebooks = computed(() => notebooks.value.length > 0)

  async function ensureLoaded(courseId: string) {
    if (!courseId) return
    if (loadedCourseId.value === courseId && notebooks.value.length > 0) {
      if (!activeNotebookId.value) selectDefault()
      return
    }
    loading.value = true
    try {
      const res = await apiFetch<Notebook[]>(`/notebooks?courseId=${encodeURIComponent(courseId)}`)
      if (res.data) {
        notebooks.value = res.data
        loadedCourseId.value = courseId
        if (!activeNotebookId.value || !notebooks.value.find(n => n.id === activeNotebookId.value)) {
          selectDefault()
        }
      }
    } catch {
      ElMessage.error('笔记本加载失败')
    } finally {
      loading.value = false
    }
  }

  function selectDefault() {
    const def = notebooks.value.find(n => n.isDefault) || notebooks.value[0]
    activeNotebookId.value = def?.id || null
  }

  function setActive(id: string) {
    if (notebooks.value.find(n => n.id === id)) {
      activeNotebookId.value = id
    }
  }

  async function create(req: CreateNotebookRequest): Promise<Notebook | null> {
    try {
      const res = await apiFetch<Notebook>('/notebooks', { method: 'POST', body: req })
      if (res.data) {
        notebooks.value.push(res.data)
        if (res.data.isDefault) {
          notebooks.value.forEach(n => {
            if (n.id !== res.data.id) n.isDefault = false
          })
        }
        activeNotebookId.value = res.data.id
        return res.data
      }
      throw new Error('create returned empty')
    } catch {
      ElMessage.error('笔记本创建失败')
      return null
    }
  }

  async function update(id: string, req: UpdateNotebookRequest): Promise<boolean> {
    try {
      const res = await apiFetch<Notebook>(`/notebooks/${id}`, { method: 'PUT', body: req })
      if (res.data) {
        const idx = notebooks.value.findIndex(n => n.id === id)
        if (idx >= 0) notebooks.value[idx] = res.data
        if (res.data.isDefault) {
          notebooks.value.forEach(n => {
            if (n.id !== id) n.isDefault = false
          })
        }
        return true
      }
      return false
    } catch {
      ElMessage.error('笔记本更新失败')
      return false
    }
  }

  async function remove(id: string): Promise<boolean> {
    try {
      await apiFetch(`/notebooks/${id}`, { method: 'DELETE' })
      notebooks.value = notebooks.value.filter(n => n.id !== id)
      if (activeNotebookId.value === id) selectDefault()
      return true
    } catch {
      ElMessage.error('笔记本删除失败')
      return false
    }
  }

  function reset() {
    notebooks.value = []
    activeNotebookId.value = null
    loadedCourseId.value = null
  }

  return {
    notebooks, activeNotebookId, activeNotebook, loading, hasNotebooks, loadedCourseId,
    ensureLoaded, setActive, selectDefault, create, update, remove, reset,
  }
})
