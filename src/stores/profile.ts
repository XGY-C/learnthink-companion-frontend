import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiFetch } from '@/utils/api'
import type { ProfileDimension, Profile, ProfileDelta, ProfileDimensionChange, ProfileDimensionItem } from '@/types'

export interface CourseInfo {
  id: string
  name: string
  emoji: string
}

const COURSES: CourseInfo[] = [
  { id: 'course-ai-001', name: '人工智能导论', emoji: '🤖' },
  { id: 'course-db-001', name: '数据库原理', emoji: '🗄️' },
]

export const useProfileStore = defineStore('profile', () => {
  // ===== 课程状态（全局共享） =====
  const courses = ref<CourseInfo[]>([...COURSES])
  const activeCourseId = ref<string>('course-ai-001')

  const activeCourse = computed<CourseInfo>(() =>
    courses.value.find(c => c.id === activeCourseId.value) ?? courses.value[0]
  )

  function switchCourse(course: CourseInfo) {
    if (activeCourseId.value === course.id) return
    activeCourseId.value = course.id
    refreshProfile(course.id)
  }
  // ===== 可视化数据（雷达图/标签云用） =====
  const dimensions = ref<ProfileDimension[]>([
    { name: '代码能力', value: 70, category: 'mastery' },
    { name: '架构设计', value: 45, category: 'weakness' },
    { name: '算法基础', value: 60, category: 'mastery' },
    { name: '产品思维', value: 85, category: 'mastery' },
    { name: '工程规范', value: 30, category: 'weakness' },
    { name: '测试素养', value: 50, category: 'weakness' },
  ])

  const profileVersion = ref('v1.2')
  const updatedAt = ref('刚刚')

  // ===== 新增：完整画像与增量（对接后端 API） =====
  const fullProfile = ref<Profile | null>(null)
  const lastDelta = ref<ProfileDelta | null>(null)

  const radarData = computed(() =>
    dimensions.value.map(d => ({ name: d.name, value: d.value }))
  )

  const tags = computed(() => {
    const kb = getDimValue('knowledge_basis')
    const weak = (kb?.weak ?? []) as string[]
    const strong = (kb?.strong ?? kb?.mastered ?? []) as string[]
    const interestDim = getDimValue('interest_direction')
    const interest = (interestDim?.topics ?? []) as string[]

    if (weak.length || strong.length || interest.length) {
      return { weakness: weak, mastered: strong, interest }
    }

    return {
      weakness: dimensions.value.filter(d => d.category === 'weakness').map(d => d.name),
      mastered: dimensions.value.filter(d => d.category === 'mastery' && d.value >= 70).map(d => d.name),
      interest: dimensions.value.filter(d => d.category === 'interest').map(d => d.name),
    }
  })

  const pace = computed(() => {
    const paceVal = getDimValue('learning_pace')
    const minutes = paceVal?.minutes_per_day ?? paceVal?.daily_minutes
    return minutes ? String(minutes) : ''
  })

  const preference = computed(() => {
    const styleVal = getDimValue('cognitive_style')
    const styles = (styleVal?.style ?? []) as string[]
    if (styles.length > 0) return styles.join('、')
    return ''
  })

  function updateDimension(name: string, newValue: number) {
    const dim = dimensions.value.find(d => d.name === name)
    if (dim) {
      dim.value = newValue
      dim.category = newValue >= 70 ? 'mastery' : newValue >= 40 ? 'mastery' : 'weakness'
      updatedAt.value = '刚刚'
    }
  }

  function updateFromDialog(_messages: string[]) {
    // 模拟画像更新：从对话中提取维度变化
    profileVersion.value = 'v' + (parseFloat(profileVersion.value.replace('v', '')) + 0.1).toFixed(1)
    updatedAt.value = '刚刚'
  }

  // ===== 新增：ProfileDelta 消费方法 =====

  /** 应用画像增量，即时更新可视化数据 */
  function applyDelta(delta: ProfileDelta | null) {
    if (!delta || delta.changed.length === 0) return false

    // 按 action 应用各维度变更
    for (const change of delta.changed) {
      applyDimensionChange(change)
    }

    // 更新元数据
    profileVersion.value = `v${delta.to_version}`
    updatedAt.value = delta.updated_at
    lastDelta.value = delta

    return true
  }

  /** 将单维度变更映射到 fullProfile（差异更新，不覆盖其他维） */
  function applyDimensionChange(change: ProfileDimensionChange) {
    if (!fullProfile.value) {
      fullProfile.value = {
        profile_id: '',
        user_id: '',
        course_id: '',
        version: 0,
        dimensions: [],
        updated_at: '',
        last_trigger: 'chat',
      }
    }
    const dims = fullProfile.value.dimensions
    const idx = dims.findIndex(d => d.key === change.key)

    if (change.action === 'remove' && idx >= 0) {
      dims.splice(idx, 1)
    } else if (idx >= 0) {
      // 更新已有维度
      dims[idx].value = change.after ?? dims[idx].value
      dims[idx].confidence = change.confidence
      dims[idx].updated_at = new Date().toISOString()
      dims[idx].source = 'inferred'
    } else if (change.action !== 'remove') {
      // 新增维度
      dims.push({
        key: change.key,
        label: change.label,
        layer: resolveLayer(change.key),
        value: change.after ?? {},
        confidence: change.confidence,
        source: 'inferred',
        updated_at: new Date().toISOString(),
      })
    }
    fullProfile.value.version = change.confidence >= 0.6 ? (fullProfile.value.version || 0) + 1 : fullProfile.value.version
  }

  /** 按 key 判定分层 */
  function resolveLayer(key: string): 'core' | 'style' | 'auxiliary' {
    if (key === 'knowledge_basis' || key === 'learning_goal') return 'core'
    if (key === 'cognitive_style' || key === 'learning_pace') return 'style'
    return 'auxiliary'
  }

  /** 从完整 Profile JSON 初始化存储（页面加载/刷新时调用） */
  function loadFromProfile(profileData: Profile) {
    fullProfile.value = profileData
    profileVersion.value = `v${profileData.version}`
    updatedAt.value = profileData.updated_at

    // 将知识基础映射到兼容的旧可视化结构
    const kbDim = profileData.dimensions.find(d => d.key === 'knowledge_basis')
    if (kbDim) {
      const mastered = (kbDim.value?.strong ?? kbDim.value?.mastered ?? []) as string[]
      const weak = (kbDim.value?.weak ?? []) as string[]
      dimensions.value = []
      for (const topic of mastered) {
        dimensions.value.push({ name: topic, value: 85, category: 'mastery' })
      }
      for (const topic of weak) {
        dimensions.value.push({ name: topic, value: 35, category: 'weakness' })
      }
    }

    // 从兴趣方向映射
    const intDim = profileData.dimensions.find(d => d.key === 'interest_direction')
    if (intDim) {
      const topics = (intDim.value?.topics ?? []) as string[]
      // 注入 tags interest
      for (const topic of topics) {
        if (!dimensions.value.find(d => d.name === topic)) {
          dimensions.value.push({ name: topic, value: 60, category: 'interest' })
        }
      }
    }
  }

  function clearProfile() {
    fullProfile.value = null
    lastDelta.value = null
    profileVersion.value = 'v0'
    updatedAt.value = ''
    dimensions.value = []
  }

  async function refreshProfile(courseId?: string) {
    const targetCourse = courseId ?? activeCourseId.value
    if (!targetCourse) return
    try {
      const res = await apiFetch<Profile | Record<string, any>>(
        `/profile?course_id=${encodeURIComponent(targetCourse)}`
      )
      const data = res.data as Profile
      if (!data || !data.dimensions || data.dimensions.length === 0) {
        clearProfile()
        return
      }
      loadFromProfile(data)
    } catch (err) {
      console.error('loadProfile failed:', err)
    }
  }

  function getDimValue(key: ProfileDimensionItem['key']) {
    return fullProfile.value?.dimensions?.find(d => d.key === key)?.value
  }

  return {
    courses, activeCourseId, activeCourse, switchCourse,
    dimensions, profileVersion, updatedAt, fullProfile, lastDelta,
    radarData, tags, pace, preference,
    updateDimension, updateFromDialog,
    applyDelta, applyDimensionChange, loadFromProfile, refreshProfile,
  }
})
