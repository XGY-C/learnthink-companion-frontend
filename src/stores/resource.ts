import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ResourcePack, ResourceItem, ResourceFile } from '@/types'
import { apiFetch } from '@/utils/api'
import { ElMessage } from 'element-plus'

export const useResourceStore = defineStore('resource', () => {
  // ==================== 包级状态（Studio 用，保留不变） ====================
  const packs = ref<ResourcePack[]>([])
  const loading = ref(false)
  const activePack = computed(() => packs.value.find(p => p.isActive))

  // ==================== 文件级状态（资源库用，新增） ====================
  const files = ref<ResourceFile[]>([])
  const total = ref(0)
  const fileLoading = ref(false)

  // ==================== 包级方法（保留给 Studio 用） ====================

  async function fetchPacks(courseId: string) {
    loading.value = true
    try {
      const res = await apiFetch<any>(`/resources/packs?courseId=${encodeURIComponent(courseId)}`)
      if (res.data && Array.isArray(res.data)) {
        packs.value = res.data.map((p: any) => ({
          id: p.pack_id || p.id,
          title: p.topic || p.title || '',
          knowledgePoint: p.topic || p.knowledgePoint || '',
          createdAt: p.created_at || p.createdAt || '',
          avgConfidence: p.avgConfidence || 'medium',
          avgQuality: p.avgQuality || 0,
          resourceCount: p.resourceCount || 0,
          estimatedMinutes: p.estimatedMinutes || 0,
          isActive: !!p.isActive,
          pushReason: p.pushReason || p.push_reason_json || '',
          resourceTypes: p.resourceTypes || [],
          resources: [],
          taskId: p.task_id || p.taskId,
          packId: p.pack_id || p.id,
        }))
      }
    } catch (e) {
      console.error('[ResourceStore] fetchPacks failed:', e)
    } finally {
      loading.value = false
    }
    return packs.value
  }

  async function fetchPackDetail(packId: string) {
    try {
      const res = await apiFetch<any>(`/resource-packs/${packId}`)
      if (res.data) {
        const p = res.data
        const pack: ResourcePack = {
          id: p.pack_id || packId,
          title: p.topic || '',
          knowledgePoint: p.topic || '',
          createdAt: p.created_at || '',
          avgConfidence: 'medium',
          avgQuality: 0,
          resourceCount: (p.resources || []).length,
          estimatedMinutes: 0,
          isActive: false,
          pushReason: p.push_reason_json || '',
          resourceTypes: [...new Set((p.resources || []).map((r: any) => r.type))] as string[],
          resources: (p.resources || []).map((r: any) => ({
            id: r.id || r.resource_id,
            type: r.type,
            title: r.title || '',
            status: r.status || 'ready',
            confidence: r.confidence || 'medium',
            sourcesCount: r.sourcesCount || (r.sources?.length || 0),
            qualityScore: r.qualityScore || 75,
            brief: r.brief || '',
            deepContent: r.content || '',
            sources: r.sources || [],
            pushReasons: r.pushReasons || [],
            videoUrl: r.videoUrl || null,
          })),
        }
        const idx = packs.value.findIndex(x => x.id === packId)
        if (idx >= 0) {
          packs.value[idx] = pack
        } else {
          packs.value.unshift(pack)
        }
        return pack
      }
    } catch (e) {
      console.error('[ResourceStore] fetchPackDetail failed:', e)
    }
    return null
  }

  function addPack(pack: ResourcePack) {
    packs.value.forEach(p => { p.isActive = false })
    packs.value.unshift(pack)
  }

  function updateResource(packId: string, resourceId: string, update: Partial<ResourceItem>) {
    const pack = packs.value.find(p => p.id === packId)
    if (!pack) return
    const res = pack.resources.find(r => r.id === resourceId)
    if (res) {
      Object.assign(res, update)
    }
  }

  async function removePack(packId: string) {
    const idx = packs.value.findIndex(p => p.id === packId)
    if (idx !== -1) packs.value.splice(idx, 1)
  }

  async function regenerateResource(packId: string, resourceId: string) {
    try {
      await apiFetch(`/resources/${resourceId}/regenerate`, { method: 'POST' })
      updateResource(packId, resourceId, { status: 'pending' as any })
      return true
    } catch {
      return false
    }
  }

  function getPack(packId: string) {
    return packs.value.find(p => p.id === packId)
  }

  // ==================== 文件级方法（新增） ====================

  async function fetchFiles(
    courseId: string,
    options: {
      folderId?: string | null
      type?: string
      confidence?: string
      sort?: string
      page?: number
      size?: number
    } = {}
  ): Promise<void> {
    fileLoading.value = true
    try {
      const params = new URLSearchParams({ courseId })
      if (options.folderId !== undefined && options.folderId !== null) {
        params.set('folderId', options.folderId)
      }
      if (options.type) params.set('type', options.type)
      if (options.confidence) params.set('confidence', options.confidence)
      if (options.sort) params.set('sort', options.sort)
      params.set('page', String(options.page ?? 1))
      params.set('size', String(options.size ?? 50))

      const res = await apiFetch<any>(`/resources?${params}`)
      if (res.data) {
        files.value = (res.data.items || []).map(mapFile)
        total.value = res.data.total || 0
      }
    } catch (e) {
      console.error('[ResourceStore] fetchFiles failed:', e)
    } finally {
      fileLoading.value = false
    }
  }

  async function fetchFileDetail(id: string): Promise<ResourceFile | null> {
    try {
      const res = await apiFetch<any>(`/resources/${id}`)
      if (res.data) {
        return mapFile(res.data)
      }
    } catch (e) {
      console.error('[ResourceStore] fetchFileDetail failed:', e)
    }
    return null
  }

  async function searchFiles(courseId: string, q: string, page = 1, size = 20): Promise<ResourceFile[]> {
    try {
      const params = new URLSearchParams({ courseId, q, page: String(page), size: String(size) })
      const res = await apiFetch<any>(`/resources/search?${params}`)
      if (res.data && Array.isArray(res.data)) {
        return res.data.map(mapFile)
      }
    } catch (e) {
      console.error('[ResourceStore] searchFiles failed:', e)
    }
    return []
  }

  async function moveFile(id: string, folderId: string | null): Promise<boolean> {
    try {
      await apiFetch(`/resources/${id}/move`, {
        method: 'PUT',
        body: { folderId },
      })
      const file = files.value.find(f => f.id === id)
      if (file) file.folderId = folderId
      return true
    } catch (e) {
      console.error('[ResourceStore] moveFile failed:', e)
      ElMessage.error('移动资源失败')
      return false
    }
  }

  async function deleteFile(id: string): Promise<boolean> {
    try {
      await apiFetch(`/resources/${id}`, { method: 'DELETE' })
      files.value = files.value.filter(f => f.id !== id)
      total.value = Math.max(0, total.value - 1)
      return true
    } catch (e) {
      console.error('[ResourceStore] deleteFile failed:', e)
      ElMessage.error('删除资源失败')
      return false
    }
  }

  async function regenerateFile(id: string): Promise<boolean> {
    try {
      await apiFetch(`/resources/${id}/regenerate`, { method: 'POST' })
      const file = files.value.find(f => f.id === id)
      if (file) file.status = 'pending'
      return true
    } catch (e) {
      console.error('[ResourceStore] regenerateFile failed:', e)
      return false
    }
  }

  function mapFile(raw: any): ResourceFile {
    return {
      id: raw.id,
      folderId: raw.folderId ?? null,
      packId: raw.packId,
      type: raw.type,
      title: raw.title || '',
      topic: raw.topic,
      status: raw.status || 'ready',
      confidence: raw.confidence || 'medium',
      qualityScore: raw.qualityScore ?? 75,
      noteCount: raw.noteCount ?? 0,
      isLearning: !!raw.isLearning,
      createdAt: raw.createdAt || '',
      updatedAt: raw.updatedAt,
      content: raw.content,
      sources: raw.sources,
      sourcesCount: raw.sourcesCount,
    }
  }

  function resetFiles() {
    files.value = []
    total.value = 0
  }

  return {
    // pack-level (Studio)
    packs, loading, activePack,
    fetchPacks, fetchPackDetail, addPack, updateResource, removePack, regenerateResource, getPack,
    // file-level (Library)
    files, total, fileLoading,
    fetchFiles, fetchFileDetail, searchFiles, moveFile, deleteFile, regenerateFile, resetFiles,
  }
})
