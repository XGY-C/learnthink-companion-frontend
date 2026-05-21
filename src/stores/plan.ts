import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiFetch } from '@/utils/api'
import { useSSE } from '@/composables/useSSE'
import type { Plan, Module, SubPlan, Activity, ActivitySubmitResponse } from '@/types'

export const usePlanStore = defineStore('plan', () => {
  const plan = ref<Plan | null>(null)
  const subPlans = ref<Map<string, SubPlan>>(new Map())
  const status = ref<'empty' | 'generating' | 'ready' | 'completed'>('empty')
  const loading = ref(false)

  // 生成进度
  const generationStage = ref('')
  const generationPercent = ref(0)
  const generationMessage = ref('')
  const generationTaskId = ref('')

  const { status: sseStatus, connect: sseConnect, disconnect: sseDisconnect } = useSSE()

  // ===== Getters =====

  const moduleList = computed(() => plan.value?.modules || [])

  const completedModules = computed(() =>
    (plan.value?.modules || []).filter(m => m.status === 'completed')
  )

  const inProgressModule = computed(() =>
    (plan.value?.modules || []).find(m => m.status === 'in_progress')
  )

  const overallProgress = computed(() => {
    const modules = plan.value?.modules || []
    if (modules.length === 0) return 0
    return Math.round(completedModules.value.length / modules.length * 100)
  })

  const overallMastery = computed(() => {
    const completed = completedModules.value.filter(m => m.mastery != null)
    if (completed.length === 0) return null
    const sum = completed.reduce((acc, m) => acc + (m.mastery || 0), 0)
    return Math.round(sum / completed.length * 100) / 100
  })

  const overallWeakTags = computed(() => {
    const tags = new Map<string, number>()
    for (const sp of subPlans.value.values()) {
      for (const a of sp.activities) {
        if (a.result?.weakTags) {
          a.result.weakTags.forEach(t => tags.set(t, (tags.get(t) || 0) + 1))
        }
      }
    }
    return [...tags.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag)
  })

  const currentActivity = computed(() => {
    // 找到第一个 in_progress 的 activity
    for (const sp of subPlans.value.values()) {
      const act = sp.activities.find(a => a.status === 'in_progress')
      if (act) return act
    }
    // 或者第一个 ready 的
    for (const sp of subPlans.value.values()) {
      const act = sp.activities.find(a => a.status === 'ready')
      if (act) return act
    }
    return null
  })

  const currentModule = computed(() => {
    if (!currentActivity.value) return null
    for (const m of moduleList.value) {
      const sp = subPlans.value.get(m.moduleId)
      if (sp?.activities.some(a => a.activityId === currentActivity.value?.activityId)) {
        return m
      }
    }
    return null
  })

  // ===== Actions =====

  async function fetchPlan(courseId: string) {
    loading.value = true
    try {
      const res = await apiFetch<Plan>(`/plan/current?courseId=${courseId}`)
      if (res.data) {
        plan.value = res.data
        subPlans.value = new Map()
        for (const m of res.data.modules) {
          if (m.subPlan) {
            subPlans.value.set(m.moduleId, m.subPlan)
          }
        }
        status.value = 'ready'
        if (res.data.modules.every(m => m.status === 'completed')) {
          status.value = 'completed'
        }
      }
    } catch {
      plan.value = null
      status.value = 'empty'
    } finally {
      loading.value = false
    }
  }

  async function generatePlan(courseId: string, profileVersion: number) {
    loading.value = true
    status.value = 'generating'
    try {
      const res = await apiFetch<{ task_id: string }>('/plan/generate', {
        method: 'POST',
        body: { course_id: courseId, profile_version: profileVersion },
      })
      generationTaskId.value = res.data.task_id
      subscribeToGeneration(res.data.task_id)
    } catch {
      status.value = 'empty'
      loading.value = false
    }
  }

  function subscribeToGeneration(taskId: string) {
    sseConnect(taskId, {
      onStage(data) {
        generationStage.value = data.stage
        generationPercent.value = data.percent
        generationMessage.value = data.message
      },
      onTaskDone() {
        // Plan done — reload plan
        const store = usePlanStore()
        if (plan.value?.courseId) {
          store.fetchPlan(plan.value.courseId)
        }
        status.value = 'ready'
        loading.value = false
      },
      onTaskFailed() {
        status.value = 'empty'
        loading.value = false
      },
    })
  }

  async function refreshModule(moduleId: string) {
    if (!plan.value) return
    try {
      const res = await apiFetch<SubPlan>(
        `/plan/modules/${moduleId}/subplan?planId=${plan.value.planId}`
      )
      if (res.data) {
        subPlans.value.set(moduleId, res.data)
        const mod = plan.value.modules.find(m => m.moduleId === moduleId)
        if (mod) mod.subPlan = res.data
      }
    } catch { /* ignore */ }
  }

  async function regenerateActivity(moduleId: string, activityId: string) {
    if (!plan.value) return
    try {
      const res = await apiFetch<Activity>(
        `/plan/modules/${moduleId}/activities/${activityId}/regenerate?planId=${plan.value.planId}`,
        { method: 'POST' }
      )
      if (res.data) {
        const sp = subPlans.value.get(moduleId)
        if (sp) {
          const idx = sp.activities.findIndex(a => a.activityId === activityId)
          if (idx >= 0) sp.activities[idx] = res.data
        }
      }
    } catch { /* ignore */ }
  }

  async function submitActivity(activityId: string, body: any): Promise<ActivitySubmitResponse | null> {
    try {
      const res = await apiFetch<ActivitySubmitResponse>(
        `/plan/activities/${activityId}/submit`,
        { method: 'POST', body }
      )
      if (res.data) {
        // Refresh the plan to get updated state
        if (plan.value?.courseId) {
          await fetchPlan(plan.value.courseId)
        }
        return res.data
      }
    } catch { /* ignore */ }
    return null
  }

  return {
    plan, subPlans, status, loading,
    generationStage, generationPercent, generationMessage, generationTaskId,
    moduleList, completedModules, inProgressModule,
    overallProgress, overallMastery, overallWeakTags,
    currentActivity, currentModule,
    fetchPlan, generatePlan, subscribeToGeneration,
    refreshModule, regenerateActivity, submitActivity,
  }
})
