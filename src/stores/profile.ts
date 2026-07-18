import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiFetch } from '@/utils/api'
import {
  type ProfileDimension,
  type Profile,
  type ProfileDimensionItem,
  type ProfileDimensionKey,
  type CourseInfo,
  type DisplayJson,
  type AnyDimensionItem,
  type DimensionValueMap,
  type DimDisplayState,
  type KnowledgeTreeNode,
  type TypedDimensionItem,
  type ProfileSignal,
  type CorrectPayload,
  getDim as typedGetDim,
  getDimValue as typedGetDimValue,
} from '@/types'
import { RADAR_DIMS, CARD_CONFIDENCE, OVERALL_LOW_CONFIDENCE } from '@/constants/profile'
import { parseKnowledgeTree } from '@/utils/profileMdParser'

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
  /**
   * 简化版 dimensions（前端可视化用）。
   * 仅由 loadFromProfile 根据真实 profile 数据填充，初始为空数组——
   * 不再使用 mock 假数据，避免"画像未加载时"误展示假掌握度。
   */
  const dimensions = ref<ProfileDimension[]>([])

  const profileVersion = ref('v0')
  const updatedAt = ref('')

  const fullProfile = ref<Profile | null>(null)
  /**
   * display_profile 原始结构。
   * 类型为 `DisplayJson & Record<string, any>` 以兼容历史字段访问
   * （如 DashboardMobile 早期写法 core_profile: DimensionItem[]）。
   * 新组件应通过 store 暴露的 getter（coreSummary / knowledgeTags 等）消费。
   */
  const displayProfile = ref<(DisplayJson & Record<string, any>) | null>(null)
  /** Raw MD profile texts for custom rendering */
  const profileMd = ref<{ core?: string; learning?: string; knowledge?: string }>({})
  /** 加载错误标记，供 UI stale-while-error 使用 */
  const loadError = ref<string | null>(null)

  const radarData = computed(() =>
    dimensions.value.map(d => ({ name: d.name, value: d.value }))
  )

  const tags = computed(() => {
    const kb = typedGetDimValue(fullProfile.value?.dimensions, 'knowledge_basis')
    const weak = (kb?.weak ?? []) as string[]
    const strong = (kb?.strong ?? kb?.mastered ?? []) as string[]
    const interestVal = typedGetDimValue(fullProfile.value?.dimensions, 'interest_direction')
    const interest = (interestVal?.topics ?? []) as string[]

    if (weak.length || strong.length || interest.length) {
      return { weakness: weak, mastered: strong, interest }
    }

    // 兼容：旧 dimensions 简化结构（loadFromProfile 已填）
    return {
      weakness: dimensions.value.filter(d => d.category === 'weakness').map(d => d.name),
      mastered: dimensions.value.filter(d => d.category === 'mastery' && d.value >= 70).map(d => d.name),
      interest: dimensions.value.filter(d => d.category === 'interest').map(d => d.name),
    }
  })

  const pace = computed(() => {
    const paceVal = typedGetDimValue(fullProfile.value?.dimensions, 'learning_pace')
    const minutes = paceVal?.daily_minutes ?? paceVal?.minutes_per_day
    return minutes ? String(minutes) : ''
  })

  const preference = computed(() => {
    const styleVal = typedGetDimValue(fullProfile.value?.dimensions, 'cognitive_style')
    const styles = (styleVal?.style ?? []) as string[]
    if (styles.length > 0) return styles.join('、')
    return ''
  })

  // ===== v2 统一 getter（组件应优先消费这些） =====

  /** 强类型按 key 取整条 dimension */
  function dim<K extends ProfileDimensionKey>(key: K): TypedDimensionItem<K> | undefined {
    return typedGetDim(fullProfile.value?.dimensions, key)
  }

  /** 强类型按 key 取 value */
  function dimValue<K extends ProfileDimensionKey>(key: K): DimensionValueMap[K] | undefined {
    return typedGetDimValue(fullProfile.value?.dimensions, key)
  }

  /** 标签获取统一入口：dimensions 优先，display_json 降级 */
  const knowledgeTags = computed(() => {
    const kb = dimValue('knowledge_basis')
    const dp = displayProfile.value?.knowledge
    return {
      mastered: (kb?.mastered ?? dp?.mastered ?? []) as string[],
      weak: (kb?.weak ?? dp?.weak ?? []) as string[],
      strong: (kb?.strong ?? []) as string[],
    }
  })

  const learningGoal = computed(() => {
    const g = dimValue('learning_goal')
    const dp = displayProfile.value?.core
    return {
      primary: (g?.primary ?? dp?.goal ?? '') as string,
      sub_goals: (g?.sub_goals ?? []) as string[],
    }
  })

  const cognitiveStyle = computed(() => {
    const s = dimValue('cognitive_style')
    const dp = displayProfile.value?.style
    return {
      style: (s?.style ?? dp?.preference ?? []) as string[],
      media_preference: s?.media_preference ?? '',
      avoid: (s?.avoid ?? dp?.avoid ?? '') as string,
      example_density: s?.example_density,
    }
  })

  const learningPace = computed(() => {
    const p = dimValue('learning_pace')
    const dpPace = displayProfile.value?.style?.pace
    const minutes = p?.daily_minutes ?? p?.minutes_per_day
    return {
      daily_minutes: typeof minutes === 'number' ? minutes : null,
      urgency: p?.urgency,
      /** 当 daily_minutes 缺失时，pace_text 兜底（来自 display_json.style.pace 的纯文本） */
      pace_text: dpPace ?? '',
    }
  })

  const majorContext = computed(() => {
    const m = dimValue('major_context')
    const dp = displayProfile.value?.core
    return {
      major: (m?.major ?? dp?.major ?? '') as string,
      grade: (m?.grade ?? dp?.grade ?? '') as string,
      course: (m?.course ?? '') as string,
    }
  })

  const interestTopics = computed<string[]>(() => {
    const i = dimValue('interest_direction')
    return (i?.topics ?? []) as string[]
  })

  const errorTags = computed<string[]>(() => {
    const e = dimValue('error_pattern')
    const dp = displayProfile.value?.knowledge?.error_pattern
    return (e?.tags ?? dp ?? []) as string[]
  })

  const coreSummary = computed(() => displayProfile.value?.core?.summary ?? displayProfile.value?.overview ?? '')

  /** 解析后的知识树（带精确 mastery 判定） */
  const knowledgeTree = computed<KnowledgeTreeNode[]>(() =>
    parseKnowledgeTree(profileMd.value.knowledge, displayProfile.value?.knowledge)
  )

  // ===== 状态判定 =====

  const isEmpty = computed(() =>
    !(fullProfile.value?.dimensions?.length) && !displayProfile.value
  )

  /**
   * 整体置信度（百分比）。
   * **仅统计 polarity=positive 的维度**，与雷达图反转语义保持一致——
   * 否则会出现"雷达整体偏低 + 总置信度偏高"的视觉矛盾。
   */
  const overallConfidence = computed(() => {
    const dims = fullProfile.value?.dimensions
    if (!dims?.length) return 0
    const positives = dims.filter(d =>
      RADAR_DIMS.find(r => r.key === d.key)?.polarity !== 'negative'
    )
    if (!positives.length) return 0
    return Math.round(positives.reduce((s, d) => s + d.confidence, 0) / positives.length * 100)
  })

  const isLowConfidence = computed(() => overallConfidence.value < OVERALL_LOW_CONFIDENCE * 100)

  /** 卡片级展示状态 */
  function getDimDisplayState<K extends ProfileDimensionKey>(key: K): DimDisplayState {
    const d = dim(key)
    if (!d) return 'missing'
    if (d.confidence < CARD_CONFIDENCE.INFERRED) return 'low'
    if (d.confidence < CARD_CONFIDENCE.NORMAL) return 'inferred'
    return 'normal'
  }

  // ===== 兼容旧 API =====

  function updateDimension(name: string, newValue: number) {
    const d = dimensions.value.find(d => d.name === name)
    if (d) {
      d.value = newValue
      d.category = newValue >= 70 ? 'mastery' : newValue >= 40 ? 'mastery' : 'weakness'
      updatedAt.value = '刚刚'
    }
  }

  function updateFromDialog(_messages: string[]) {
    profileVersion.value = 'v' + (parseFloat(profileVersion.value.replace('v', '')) + 0.1).toFixed(1)
    updatedAt.value = '刚刚'
  }

  function loadFromProfile(profileData: Profile, rawData?: Record<string, any>) {
    fullProfile.value = profileData
    profileVersion.value = `v${profileData.version}`
    updatedAt.value = profileData.updated_at

    if (rawData?.display_profile) {
      displayProfile.value = rawData.display_profile as DisplayJson & Record<string, any>
    }
    if (rawData?.core_profile_md || rawData?.learning_profile_md || rawData?.knowledge_profile_md) {
      profileMd.value = {
        core: rawData.core_profile_md || undefined,
        learning: rawData.learning_profile_md || undefined,
        knowledge: rawData.knowledge_profile_md || undefined,
      }
    }

    // 同步填充简化版 dimensions（雷达图、Dashboard tags 兼容用）
    const kbDim = profileData.dimensions.find(d => d.key === 'knowledge_basis')
    const newDims: ProfileDimension[] = []
    if (kbDim) {
      const v = kbDim.value as DimensionValueMap['knowledge_basis']
      const mastered = (v?.strong ?? v?.mastered ?? []) as string[]
      const weak = (v?.weak ?? []) as string[]
      for (const topic of mastered) newDims.push({ name: topic, value: 85, category: 'mastery' })
      for (const topic of weak) newDims.push({ name: topic, value: 35, category: 'weakness' })
    }
    const intDim = profileData.dimensions.find(d => d.key === 'interest_direction')
    if (intDim) {
      const topics = ((intDim.value as DimensionValueMap['interest_direction'])?.topics ?? []) as string[]
      for (const topic of topics) {
        if (!newDims.find(d => d.name === topic)) {
          newDims.push({ name: topic, value: 60, category: 'interest' })
        }
      }
    }
    dimensions.value = newDims
  }

  function clearProfile() {
    fullProfile.value = null
    displayProfile.value = null
    profileMd.value = {}
    profileVersion.value = 'v0'
    updatedAt.value = ''
    dimensions.value = []
    loadError.value = null
  }

  async function refreshProfile(courseId?: string) {
    const targetCourse = courseId ?? activeCourseId.value
    if (!targetCourse) return
    try {
      loadError.value = null
      const res = await apiFetch<any>(
        `/profile?course_id=${encodeURIComponent(targetCourse)}`
      )
      const data = res.data as any
      if (!data) {
        clearProfile()
        return
      }
      const profileData: Profile = {
        profile_id: data.profile_id || '',
        user_id: data.user_id || '',
        course_id: data.course_id || '',
        version: data.version || 0,
        dimensions: (data.dimensions || []) as ProfileDimensionItem[],
        updated_at: data.updated_at || '',
        last_trigger: 'chat',
      }
      if (!profileData.dimensions || profileData.dimensions.length === 0) {
        clearProfile()
        return
      }
      loadFromProfile(profileData, data)
    } catch (err) {
      console.error('loadProfile failed:', err)
      // stale-while-error：保留旧数据，仅置错误标记
      loadError.value = err instanceof Error ? err.message : '加载失败'
    }
  }

  /** @deprecated 兼容老外部调用，建议使用 dimValue */
  function getDimValue(key: ProfileDimensionItem['key']) {
    return fullProfile.value?.dimensions?.find(d => d.key === key)?.value
  }

  /** 转换为 AnyDimensionItem[]，便于强类型组件消费 */
  const typedDimensions = computed<AnyDimensionItem[]>(
    () => (fullProfile.value?.dimensions ?? []) as unknown as AnyDimensionItem[]
  )

  // ========== Phase 2：来源追溯 + 纠错闭环 ==========
  //
  // 后端联调点（当前为 mock，接口就绪后将下方两个 TODO 处替换为真实 apiFetch）：
  //   GET  /profile/signals?course_id=xxx&dimension=knowledge_basis
  //   POST /profile/correct  body: CorrectPayload
  //
  // mock 数据按维度键面包屑式准备，覆盖典型来源类型，便于前端验证完整交互。

  const signalsCache = ref<Record<string, ProfileSignal[]>>({})
  const signalsLoading = ref<Record<string, boolean>>({})
  const signalsError = ref<Record<string, string | null>>({})
  const correctSubmitting = ref(false)

  function buildMockSignals(dimension: ProfileDimensionKey): ProfileSignal[] {
    const now = Date.now()
    const min = (n: number) => new Date(now - n * 60_000).toISOString()
    const base: Record<ProfileDimensionKey, ProfileSignal[]> = {
      knowledge_basis: [
        { id: 'm1', dimension, signal_key: 'know.ai_intro.bayes', value: '贝叶斯公式的理解不够扎实',
          source: 'user_said', status: 'written', created_at: min(120), chat_id: 'c-001' },
        { id: 'm2', dimension, signal_key: 'know.ai_intro.probability', value: '概率基础掌握较好',
          source: 'learning_result', status: 'written', created_at: min(60) },
        { id: 'm3', dimension, signal_key: 'know.ai_intro.astar', value: 'A*搜索流程不熟悉',
          source: 'llm_inferred', status: 'written', created_at: min(30), chat_id: 'c-002' },
      ],
      learning_goal: [
        { id: 'g1', dimension, signal_key: 'core.goal', value: '期末85分，掌握搜索算法',
          source: 'user_said', status: 'written', created_at: min(180), chat_id: 'c-001' },
      ],
      cognitive_style: [
        { id: 's1', dimension, signal_key: 'style.preference', value: '先例后理',
          source: 'user_said', status: 'written', created_at: min(240), chat_id: 'c-001' },
        { id: 's2', dimension, signal_key: 'style.preference', value: '图文优先',
          source: 'behavior', status: 'written', created_at: min(45) },
      ],
      learning_pace: [
        { id: 'p1', dimension, signal_key: 'style.pace', value: '60分钟/天',
          source: 'user_said', status: 'written', created_at: min(300), chat_id: 'c-001' },
      ],
      major_context: [
        { id: 'mc1', dimension, signal_key: 'core.major', value: '计算机科学与技术',
          source: 'user_said', status: 'written', created_at: min(720) },
        { id: 'mc2', dimension, signal_key: 'core.grade', value: '大二',
          source: 'user_corrected', status: 'written', created_at: min(360) },
      ],
      interest_direction: [
        { id: 'i1', dimension, signal_key: 'know.interest.recsys', value: '对推荐系统感兴趣',
          source: 'user_said', status: 'written', created_at: min(90), chat_id: 'c-002' },
      ],
      error_pattern: [
        { id: 'e1', dimension, signal_key: 'know.err.bayes', value: '条件概率混淆',
          source: 'learning_result', status: 'written', created_at: min(15) },
        { id: 'e2', dimension, signal_key: 'know.err.formula', value: '公式记忆错误',
          source: 'llm_inferred', status: 'written', created_at: min(5) },
      ],
    }
    return base[dimension] ?? []
  }

  /**
   * 拉取某维度的来源信号。
   * 当前实现为 mock（150ms 模拟网络延迟）；后端就绪后替换为：
   *   apiFetch<ProfileSignal[]>(`/profile/signals?course_id=${cid}&dimension=${dimension}`)
   */
  async function fetchSignals(dimension: ProfileDimensionKey): Promise<ProfileSignal[]> {
    const key = `${activeCourseId.value}::${dimension}`
    if (signalsCache.value[key]) return signalsCache.value[key]
    signalsLoading.value[key] = true
    signalsError.value[key] = null
    try {
      // TODO(后端): 替换为 apiFetch<ProfileSignal[]>(`/profile/signals?course_id=${encodeURIComponent(activeCourseId.value)}&dimension=${dimension}`)
      await new Promise(r => setTimeout(r, 150))
      const data = buildMockSignals(dimension)
      signalsCache.value[key] = data
      return data
    } catch (err) {
      signalsError.value[key] = err instanceof Error ? err.message : '加载失败'
      return []
    } finally {
      signalsLoading.value[key] = false
    }
  }

  function invalidateSignals(dimension?: ProfileDimensionKey) {
    if (!dimension) {
      signalsCache.value = {}
      return
    }
    const key = `${activeCourseId.value}::${dimension}`
    delete signalsCache.value[key]
  }

  /**
   * 用户纠错（确认/纠正/否认）。
   * 当前实现为 mock：仅清缓存让 UI 重新拉取，**不真正改写**画像 raw 数据。
   * 后端就绪后替换为：
   *   apiFetch('/profile/correct', { method: 'POST', body: payload })
   * 并按响应决定是否触发 refreshProfile(courseId)。
   */
  async function correctProfile(payload: Omit<CorrectPayload, 'course_id'>): Promise<boolean> {
    if (!activeCourseId.value) return false
    correctSubmitting.value = true
    try {
      // TODO(后端): 替换为 apiFetch('/profile/correct', { method: 'POST', body: { ...payload, course_id: activeCourseId.value } })
      await new Promise(r => setTimeout(r, 200))
      // 失效该维度的 signals 缓存，下次 fetchSignals 会拿到"已经包含本次 user_corrected"的最新数据
      invalidateSignals(payload.dimension)
      return true
    } finally {
      correctSubmitting.value = false
    }
  }

  return {
    // 课程
    courses, activeCourseId, activeCourse, currentProfileVersion, coursesLoading, coursesError,
    fetchMyCourses, enrollCourse, leaveCourse, switchCourse, initCourses,
    // 画像 raw
    dimensions, profileVersion, updatedAt, fullProfile,
    displayProfile, profileMd, loadError,
    typedDimensions,
    radarData, tags, pace, preference,
    // v2 getter
    dim, dimValue,
    knowledgeTags, learningGoal, cognitiveStyle, learningPace,
    majorContext, interestTopics, errorTags, coreSummary,
    knowledgeTree,
    isEmpty, overallConfidence, isLowConfidence,
    getDimDisplayState,
    // 操作
    updateDimension, updateFromDialog,
    loadFromProfile, refreshProfile, clearProfile,
    getDimValue,
    // Phase 2：来源追溯 + 纠错闭环
    signalsCache, signalsLoading, signalsError, correctSubmitting,
    fetchSignals, invalidateSignals, correctProfile,
  }
})
