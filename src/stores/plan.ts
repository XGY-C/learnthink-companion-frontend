import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { apiFetch } from '@/utils/api'
import { useSSE } from '@/composables/useSSE'
import type { Plan, SubPlan, Activity, ActivitySubmitResponse } from '@/types'

export const usePlanStore = defineStore('plan', () => {
  const plan = ref<Plan | null>(null)
  const subPlans = ref<Map<string, SubPlan>>(new Map())
  const status = ref<'empty' | 'generating' | 'pending_decision' | 'decided' | 'ready' | 'completed'>('empty')
  const loading = ref(false)

  // 生成进度
  const generationStage = ref('')
  const generationPercent = ref(0)
  const generationMessage = ref('')
  const generationTaskId = ref('')
  const gapTasks = ref<{ taskId: string; moduleTitle: string; moduleId: string; resourceTypes: string[] }[]>([])

  const { connect: sseConnect } = useSSE()

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
        // 映射后端 plan status 到 store status
        const backendStatus = res.data.status
        if (backendStatus === 'pending_decision' || backendStatus === 'decided' || backendStatus === 'generating') {
          status.value = backendStatus
        } else if (res.data.modules.every((m: any) => m.status === 'completed')) {
          status.value = 'completed'
        } else {
          status.value = 'ready'
        }
      }
    } catch {
      plan.value = null
      status.value = 'empty'
    } finally {
      loading.value = false
    }
  }

  interface GeneratePlanResult {
    alreadyInProgress: boolean
    taskId: string
  }

  async function generatePlan(courseId: string, profileVersion: number, force = false, requirementText?: string): Promise<GeneratePlanResult | null> {
    loading.value = true
    status.value = 'generating'
    try {
      const res = await apiFetch<{ task_id: string; already_in_progress?: boolean }>('/plan/generate', {
        method: 'POST',
        body: { courseId, profileVersion, force, requirementText: requirementText || '' },
      })
      const taskId = res.data.task_id

      if (res.data.already_in_progress) {
        // 不自动订阅 SSE，由调用方弹窗让用户选择
        return { alreadyInProgress: true, taskId }
      }

      generationTaskId.value = taskId
      subscribeToGeneration(taskId, courseId)
      return { alreadyInProgress: false, taskId }
    } catch {
      status.value = 'empty'
      loading.value = false
      return null
    }
  }

  function subscribeToGeneration(taskId: string, courseId?: string) {
    sseConnect(taskId, {
      onStage(data) {
        generationStage.value = data.stage
        generationPercent.value = data.percent
        generationMessage.value = data.message
      },
      onTaskDone() {
        const store = usePlanStore()
        const cid = courseId || plan.value?.courseId
        if (cid) {
          store.fetchPlan(cid) // fetchPlan 内部会设置 status 和 plan
        } else {
          status.value = 'ready'
          loading.value = false
        }
      },
      onTaskFailed() {
        status.value = 'empty'
        loading.value = false
      },
      onGapTasks(data) {
        gapTasks.value = data.tasks.map(t => ({
          taskId: t.task_id,
          moduleTitle: t.module_title,
          moduleId: t.module_id,
          resourceTypes: t.resource_types,
        }))
      },
    })
  }

  async function refreshModule(moduleId: string) {
    if (!plan.value) return
    try {
      const res = await apiFetch<SubPlan>(
        `/plan/modules/${moduleId}/replan?planId=${plan.value.planId}`,
        { method: 'POST' }
      )
      if (res.data) {
        subPlans.value.set(moduleId, res.data)
        const mod = plan.value.modules.find(m => m.moduleId === moduleId)
        if (mod) mod.subPlan = res.data
        ElMessage.success('模块已重新规划')
      }
    } catch {
      ElMessage.error('重新规划失败，请稍后重试')
    }
  }

  /**
   * 预览大计划（同步）— v3.1: 后端立即落库，需传 chatId
   */
  async function previewPlan(courseId: string, profileVersion: number, requirementText: string, chatId?: string): Promise<any | null> {
    try {
      const res = await apiFetch<any>('/plan/preview', {
        method: 'POST',
        body: { courseId, profileVersion, requirementText, chatId },
      })
      return res.data
    } catch {
      return null
    }
  }

  /**
   * 更新 pending_decision 计划草稿（PlanEditor 编辑时实时保存）
   */
  async function updatePlanDraft(planId: string | undefined, courseId: string, profileVersion: number, planJson: string, chatId?: string, requirementText?: string): Promise<any | null> {
    try {
      const res = await apiFetch<any>('/plan/update', {
        method: 'POST',
        body: { planId, courseId, profileVersion, planJson, chatId, requirementText },
      })
      return res.data
    } catch {
      return null
    }
  }

  /**
   * 确认大计划并异步生成
   */
  async function confirmPlan(courseId: string, profileVersion: number, planJson: string, requirementText: string, chatId?: string): Promise<{ taskId: string } | null> {
    try {
      const res = await apiFetch<{ task_id: string }>('/plan/confirm', {
        method: 'POST',
        body: { courseId, profileVersion, planJson, requirementText, chatId },
      })
      return res.data ? { taskId: res.data.task_id } : null
    } catch {
      return null
    }
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
      const { signal, ...requestBody } = body
      const res = await apiFetch<ActivitySubmitResponse>(
        `/plan/activities/${activityId}/submit`,
        { method: 'POST', body: requestBody, signal }
      )
      if (res.data) {
        // Refresh the plan to get updated state
        if (plan.value?.courseId) {
          await fetchPlan(plan.value.courseId)
        }
        return res.data
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err
    }
    return null
  }

  async function updateLockMode(courseId: string, lockMode: string) {
    if (!plan.value) return
    await apiFetch('/plan/lock-mode', {
      method: 'PATCH',
      body: { courseId, lockMode },
    })
    await fetchPlan(courseId)
  }

  return {
    plan, subPlans, status, loading, gapTasks,
    generationStage, generationPercent, generationMessage, generationTaskId,
    moduleList, completedModules, inProgressModule,
    overallProgress, overallMastery, overallWeakTags,
    currentActivity, currentModule,
    fetchPlan, generatePlan, previewPlan, updatePlanDraft, confirmPlan, subscribeToGeneration,
    refreshModule, regenerateActivity, submitActivity, updateLockMode,
  }
})
