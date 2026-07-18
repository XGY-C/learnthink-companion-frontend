import { ref } from 'vue'
import type { Activity } from '@/types'
import { useRouter } from 'vue-router'
import { usePlanStore } from '@/stores/plan'
import { ElMessage, ElMessageBox } from 'element-plus'

export function usePathInteraction() {
  const router = useRouter()
  const planStore = usePlanStore()

  const expandedModules = ref<Set<string>>(new Set())
  const exploreDrawerVisible = ref(false)
  const exploreActivity = ref<Activity | null>(null)
  const adjustmentHistoryVisible = ref(false)
  const dagExpanded = ref(false)

  function toggleModule(moduleId: string) {
    if (expandedModules.value.has(moduleId)) {
      expandedModules.value.delete(moduleId)
    } else {
      expandedModules.value.add(moduleId)
    }
  }

  function goToLearn(activity: Activity, moduleId?: string) {
    if (planStore.plan?.lockMode === 'sequential' && activity.status === 'locked') {
      ElMessage.warning('该活动尚未解锁，请先完成前置活动')
      return
    }
    if (activity.type === 'explore') {
      exploreActivity.value = activity
      exploreDrawerVisible.value = true
      return
    }
    router.push({ path: `/learn/${activity.activityId}`, query: moduleId ? { moduleId } : undefined })
  }

  async function changeLockMode(mode: string) {
    if (!planStore.plan || planStore.plan.lockMode === mode) return
    const tip = mode === 'free'
      ? '切换为「自由学习」后，所有锁定的活动将立即解锁，可随时学习。是否继续？'
      : '切换为「按顺序解锁」后，未完成前置的活动将重新锁定，需按顺序学习。是否继续？'
    try {
      await ElMessageBox.confirm(tip, '切换学习模式', {
        confirmButtonText: '确认切换',
        cancelButtonText: '取消',
        type: 'warning',
      })
    } catch { return }
    if (!planStore.plan) return
    await planStore.updateLockMode(planStore.plan.courseId, mode)
  }
  
  function scrollToModule(moduleId: string) {
    const el = document.getElementById(`module-${moduleId}`)
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    dagExpanded.value = false
  }

  return {
    // State
    expandedModules,
    exploreDrawerVisible,
    exploreActivity,
    adjustmentHistoryVisible,
    dagExpanded,

    // Actions
    toggleModule,
    goToLearn,
    scrollToModule,
    changeLockMode,
  }
}
