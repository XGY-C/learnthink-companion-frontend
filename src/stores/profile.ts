import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiFetch } from '@/utils/api'
import type { ProfileDimension, Profile, ProfileDelta, ProfileDimensionChange, ProfileDimensionItem, CourseInfo } from '@/types'

export const useProfileStore = defineStore('profile', () => {
  // ===== 课程状态（动态加载） =====
  const courses = ref<CourseInfo[]>([])
  const activeCourseId = ref<string>('')
  const coursesLoading = ref(false)
  const coursesError = ref<string | null>(null)

  const activeCourse = computed<CourseInfo | null>(() =>
    courses.value.find(c => c.id === activeCourseId.value) ?? null
  )

  /** 当前画像的数字版本号，供计划生成等接口使用 */
  const currentProfileVersion = computed(() => fullProfile.value?.version ?? null)

  // ===== 课程 API 方法 =====

  /** 获取我的已选课程 */
  async function fetchMyCourses() {
    coursesLoading.value = true
    coursesError.value = null
    try {
      const res = await apiFetch<CourseInfo[]>('/courses/my')
      courses.value = res.data ?? []
    } catch {
      coursesError.value = '课程列表加载失败'
      courses.value = []
    } finally {
      coursesLoading.value = false
    }
  }

  /** 选课并切换到新课程 */
  async function enrollCourse(courseId: string) {
    await apiFetch('/courses/enroll', { method: 'POST', body: { courseId } })
    await fetchMyCourses()
    const newCourse = courses.value.find(c => c.id === courseId)
    if (newCourse) {
      switchCourse(newCourse)
    }
  }

  /** 退课 */
  async function leaveCourse(courseId: string) {
    await apiFetch('/courses/leave', { method: 'POST', body: { courseId } })
    await fetchMyCourses()
    if (activeCourseId.value === courseId) {
      if (courses.value.length > 0) {
        switchCourse(courses.value[0])
      } else {
        activeCourseId.value = ''
        clearProfile()
      }
    }
  }

  /** 切换课程 */
  function switchCourse(course: CourseInfo) {
    if (activeCourseId.value === course.id) return
    activeCourseId.value = course.id
    localStorage.setItem('activeCourseId', course.id)
    refreshProfile(course.id)
  }

  /** 初始化课程状态 */
  async function initCourses() {
    await fetchMyCourses()
    if (courses.value.length === 0) {
      activeCourseId.value = ''
      return
    }
    const saved = localStorage.getItem('activeCourseId')
    if (saved && courses.value.find(c => c.id === saved)) {
      activeCourseId.value = saved
    } else {
      activeCourseId.value = courses.value[0].id
    }
  }

  // ===== 画像状态 =====
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
    profileVersion.value = 'v' + (parseFloat(profileVersion.value.replace('v', '')) + 0.1).toFixed(1)
    updatedAt.value = '刚刚'
  }

  function applyDelta(delta: ProfileDelta | null) {
    if (!delta || delta.changed.length === 0) return false

    for (const change of delta.changed) {
      applyDimensionChange(change)
    }

    profileVersion.value = `v${delta.to_version}`
    updatedAt.value = delta.updated_at
    lastDelta.value = delta

    return true
  }

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
      dims[idx].value = change.after ?? dims[idx].value
      dims[idx].confidence = change.confidence
      dims[idx].updated_at = new Date().toISOString()
      dims[idx].source = 'inferred'
    } else if (change.action !== 'remove') {
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

  function resolveLayer(key: string): 'core' | 'style' | 'auxiliary' {
    if (key === 'knowledge_basis' || key === 'learning_goal') return 'core'
    if (key === 'cognitive_style' || key === 'learning_pace') return 'style'
    return 'auxiliary'
  }

  function loadFromProfile(profileData: Profile) {
    fullProfile.value = profileData
    profileVersion.value = `v${profileData.version}`
    updatedAt.value = profileData.updated_at

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

    const intDim = profileData.dimensions.find(d => d.key === 'interest_direction')
    if (intDim) {
      const topics = (intDim.value?.topics ?? []) as string[]
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
    // 课程
    courses, activeCourseId, activeCourse, currentProfileVersion, coursesLoading, coursesError,
    fetchMyCourses, enrollCourse, leaveCourse, switchCourse, initCourses,
    // 画像
    dimensions, profileVersion, updatedAt, fullProfile, lastDelta,
    radarData, tags, pace, preference,
    updateDimension, updateFromDialog,
    applyDelta, applyDimensionChange, loadFromProfile, refreshProfile, clearProfile,
  }
})
