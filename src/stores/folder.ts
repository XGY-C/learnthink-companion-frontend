import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiFetch } from '@/utils/api'
import { ElMessage } from 'element-plus'
import type { ResourceFolder } from '@/types'

export const useFolderStore = defineStore('folder', () => {
  const folders = ref<ResourceFolder[]>([])
  const currentFolderId = ref<string | null>(null)
  const expandedIds = ref<Set<string>>(new Set())
  const loading = ref(false)

  /** 扁平化所有文件夹（用于面包屑查找） */
  const flatFolders = computed(() => {
    const result: ResourceFolder[] = []
    function walk(list: ResourceFolder[]) {
      for (const f of list) {
        result.push(f)
        if (f.children?.length) walk(f.children)
      }
    }
    walk(folders.value)
    return result
  })

  const currentFolder = computed(() =>
    currentFolderId.value
      ? flatFolders.value.find(f => f.id === currentFolderId.value) ?? null
      : null
  )

  /** 递归统计某文件夹下所有子文件夹的资源总数 */
  function totalResourceCount(folder: ResourceFolder): number {
    let count = folder.resourceCount || 0
    if (folder.children) {
      for (const child of folder.children) {
        count += totalResourceCount(child)
      }
    }
    return count
  }

  /** 获取面包屑路径 */
  function getBreadcrumb(folderId: string | null): ResourceFolder[] {
    if (!folderId) return []
    const path: ResourceFolder[] = []
    let current = flatFolders.value.find(f => f.id === folderId)
    while (current) {
      path.unshift(current)
      current = current.parentId
        ? flatFolders.value.find(f => f.id === current!.parentId)
        : undefined
    }
    return path
  }

  async function fetchTree(courseId: string) {
    if (!courseId) return
    loading.value = true
    try {
      const res = await apiFetch<ResourceFolder[]>(`/resources/folders?courseId=${encodeURIComponent(courseId)}`)
      if (res.data && Array.isArray(res.data)) {
        folders.value = res.data
      }
    } catch (e) {
      console.error('[FolderStore] fetchTree failed:', e)
    } finally {
      loading.value = false
    }
  }

  async function createFolder(courseId: string, parentId: string | null, name: string): Promise<ResourceFolder | null> {
    try {
      const res = await apiFetch<ResourceFolder>('/resources/folders', {
        method: 'POST',
        body: { courseId, parentId, name },
      })
      if (res.data) {
        const newFolder: ResourceFolder = {
          id: (res.data as any).id,
          parentId: (res.data as any).parentId,
          name: (res.data as any).name,
          sortOrder: (res.data as any).sortOrder ?? 0,
          resourceCount: (res.data as any).resourceCount ?? 0,
          children: (res.data as any).children ?? [],
        }
        if (parentId) {
          const parent = flatFolders.value.find(f => f.id === parentId)
          if (parent) {
            if (!parent.children) parent.children = []
            parent.children.push(newFolder)
            expandedIds.value = new Set([...expandedIds.value, parentId])
          }
        } else {
          folders.value.push(newFolder)
        }
        ElMessage.success(`文件夹「${name}」已创建`)
        return newFolder
      }
    } catch (e) {
      console.error('[FolderStore] createFolder failed:', e)
      ElMessage.error('文件夹创建失败')
    }
    return null
  }

  async function updateFolder(id: string, updates: { name?: string; parentId?: string; sortOrder?: number }) {
    try {
      await apiFetch(`/resources/folders/${id}`, {
        method: 'PUT',
        body: updates,
      })
      await refetchTree()
    } catch (e) {
      console.error('[FolderStore] updateFolder failed:', e)
      ElMessage.error('文件夹更新失败')
    }
  }

  async function deleteFolder(id: string) {
    try {
      await apiFetch(`/resources/folders/${id}`, { method: 'DELETE' })
      removeFolderFromTree(folders.value, id)
      if (currentFolderId.value === id) {
        currentFolderId.value = null
      }
      ElMessage.success('文件夹已删除')
    } catch (e) {
      console.error('[FolderStore] deleteFolder failed:', e)
      ElMessage.error('文件夹删除失败')
    }
  }

  function removeFolderFromTree(list: ResourceFolder[], id: string) {
    const idx = list.findIndex(f => f.id === id)
    if (idx >= 0) {
      list.splice(idx, 1)
      return true
    }
    for (const f of list) {
      if (f.children?.length && removeFolderFromTree(f.children, id)) return true
    }
    return false
  }

  async function refetchTree() {
    const course = localStorage.getItem('activeCourseId')
    if (course) await fetchTree(course)
  }

  function navigateTo(folderId: string | null) {
    currentFolderId.value = folderId
  }

  function toggleExpand(id: string) {
    const next = new Set(expandedIds.value)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    expandedIds.value = next
  }

  function isExpanded(id: string): boolean {
    return expandedIds.value.has(id)
  }

  function reset() {
    folders.value = []
    currentFolderId.value = null
    expandedIds.value = new Set()
  }

  return {
    folders, currentFolderId, expandedIds, loading,
    flatFolders, currentFolder,
    fetchTree, createFolder, updateFolder, deleteFolder,
    navigateTo, toggleExpand, isExpanded,
    getBreadcrumb, totalResourceCount,
    refetchTree, reset,
  }
})
