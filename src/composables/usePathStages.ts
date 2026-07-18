import { computed } from 'vue'
import { usePlanStore } from '@/stores/plan'
import type { Module } from '@/types'

export interface StageGroup {
  key: 'basic' | 'standard' | 'deep'
  label: string
  shortLabel: string
  colorVar: string
  colorLightVar: string
  modules: Module[]
  completedCount: number
  totalCount: number
  progressPct: number
  totalHours: number
}

export const STAGE_CONFIG = {
  basic: {
    label: '第一阶段 · 基础筑基',
    shortLabel: '基础筑基',
    colorVar: 'var(--lt-brand)',
    colorLightVar: 'var(--lt-brand-lightest)',
  },
  standard: {
    label: '第二阶段 · 标准进阶',
    shortLabel: '标准进阶',
    colorVar: 'var(--lt-ai)',
    colorLightVar: 'var(--lt-ai-light-9)',
  },
  deep: {
    label: '第三阶段 · 深入精进',
    shortLabel: '深入精进',
    colorVar: 'var(--lt-orange)',
    colorLightVar: 'var(--lt-orange-light-9)',
  },
} as const

export function usePathStages() {
  const planStore = usePlanStore()

  const stages = computed<StageGroup[]>(() => {
    const modules = planStore.moduleList
    if (modules.length === 0) return []

    const depthOrder: ('basic' | 'standard' | 'deep')[] = []
    const grouped: Record<string, Module[]> = {}
    for (const m of modules) {
      const d = m.depth
      if (!grouped[d]) {
        grouped[d] = []
        depthOrder.push(d)
      }
      grouped[d].push(m)
    }

    return depthOrder.map((d, idx) => {
      const mods = grouped[d]
      const config = STAGE_CONFIG[d]
      const completed = mods.filter(m => m.status === 'completed')
      const hours = mods.reduce((sum, m) => sum + (m.estimatedHours || 0), 0)
      return {
        key: d,
        ...config,
        label: `第${idx + 1}阶段 · ${config.shortLabel}`,
        modules: mods,
        completedCount: completed.length,
        totalCount: mods.length,
        progressPct: mods.length > 0 ? Math.round(completed.length / mods.length * 100) : 0,
        totalHours: hours,
      }
    })
  })

  const currentStage = computed(() => {
    return stages.value.find(s => s.modules.some(m => m.status === 'in_progress'))
      || stages.value.find(s => s.progressPct < 100)
      || null
  })

  const remainingHours = computed(() => {
    return planStore.moduleList
      .filter(m => m.status !== 'completed')
      .reduce((sum, m) => sum + (m.estimatedHours || 0), 0)
  })

  const totalHours = computed(() => {
    return planStore.moduleList
      .reduce((sum, m) => sum + (m.estimatedHours || 0), 0)
  })

  return { stages, currentStage, remainingHours, totalHours, STAGE_CONFIG }
}
