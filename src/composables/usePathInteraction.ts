import { ref } from 'vue'
import type { Activity } from '@/types'
import { useRouter } from 'vue-router'

export function usePathInteraction() {
  const router = useRouter()

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

  function goToLearn(activity: Activity) {
    if (activity.type === 'explore') {
      exploreActivity.value = activity
      exploreDrawerVisible.value = true
      return
    }
    router.push(`/learn/${activity.activityId}`)
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
  }
}
