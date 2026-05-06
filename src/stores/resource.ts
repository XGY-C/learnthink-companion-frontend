import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ResourcePack, ResourceItem } from '@/types'

export const useResourceStore = defineStore('resource', () => {
  const packs = ref<ResourcePack[]>([])

  const activePack = computed(() => packs.value.find(p => p.isActive))

  function addPack(pack: ResourcePack) {
    // 将其他包设为非活跃
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

  function removePack(packId: string) {
    const idx = packs.value.findIndex(p => p.id === packId)
    if (idx !== -1) packs.value.splice(idx, 1)
  }

  function getPack(packId: string) {
    return packs.value.find(p => p.id === packId)
  }

  return { packs, activePack, addPack, updateResource, removePack, getPack }
})
