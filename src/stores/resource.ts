import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ResourcePack, ResourceItem } from '@/types'
import { apiFetch } from '@/utils/api'

export const useResourceStore = defineStore('resource', () => {
  const packs = ref<ResourcePack[]>([])
  const loading = ref(false)

  const activePack = computed(() => packs.value.find(p => p.isActive))

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
          resourceTypes: [...new Set((p.resources || []).map((r: any) => r.type))],
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
      await apiFetch('/resources/regenerate', {
        method: 'POST',
        body: { resource_id: resourceId, task_id: '' },
      })
      updateResource(packId, resourceId, { status: 'pending' as any })
      return true
    } catch {
      return false
    }
  }

  function getPack(packId: string) {
    return packs.value.find(p => p.id === packId)
  }

  return { packs, loading, activePack, fetchPacks, fetchPackDetail, addPack, updateResource, removePack, regenerateResource, getPack }
})
