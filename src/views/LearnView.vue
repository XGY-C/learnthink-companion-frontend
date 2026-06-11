<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlanStore } from '@/stores/plan'
import { useActivityStore } from '@/stores/activity'
import type { Activity, ActivityResource, ActivitySubmitResponse } from '@/types'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import MindmapViewer from '@/components/MindmapViewer.vue'
import CodeLearningViewer from '@/components/code/CodeLearningViewer.vue'
import ResourceNavigator from '@/components/ResourceNavigator.vue'
import StepCompleteZone from '@/components/learn/StepCompleteZone.vue'
import QuizFocusModal from '@/components/learn/QuizFocusModal.vue'
import ActivityCelebration from '@/components/learn/ActivityCelebration.vue'
import type { NavItem } from '@/components/ResourceNavigator.vue'
import { ArrowLeft, Clock, List } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { extractVideoUrl } from '@/utils/media'

const route = useRoute()
const router = useRouter()
const planStore = usePlanStore()
const actStore = useActivityStore()

const activityId = computed(() => route.params.activityId as string)
const routeModuleId = computed(() => route.query.moduleId as string | undefined)

// ===== Navigator toggle =====
const navVisible = ref(localStorage.getItem('lt-learn-nav') !== 'false')
const tocCollapsed = ref(localStorage.getItem('lt-toc-collapsed') !== 'false')
const windowWidth = ref(window.innerWidth)
const isMobile = computed(() => windowWidth.value < 768)

function toggleNav() {
  navVisible.value = !navVisible.value
  localStorage.setItem('lt-learn-nav', String(navVisible.value))
}
function toggleToc() {
  tocCollapsed.value = !tocCollapsed.value
  localStorage.setItem('lt-toc-collapsed', String(tocCollapsed.value))
}

const showToc = computed(() => {
  const type = currentResource.value?.planRef.resourceType
  return type === 'doc' || type === 'reading'
})

interface TocHeading {
  id: string
  text: string
  level: number
}

const tocHeadings = computed<TocHeading[]>(() => {
  const content = currentResource.value?.content
  if (!content) return []
  const result: TocHeading[] = []
  const lines = content.split('\n')
  for (const line of lines) {
    const match = line.match(/^(#{1,4})\s+(.+)$/)
    if (match) {
      const level = match[1].length
      const text = match[2].trim()
      const id = text.replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '')
      result.push({ id, text, level })
    }
  }
  return result
})

const tocActiveId = ref('')
const tocScrollPercent = ref(0)
const collapsedSections = ref<Set<string>>(new Set())

// IntersectionObserver for scroll auto-highlight
let tocObserver: IntersectionObserver | null = null

function setupTocObserver() {
  if (tocObserver) {
    tocObserver.disconnect()
    tocObserver = null
  }
  const contentEl = document.querySelector('.resource-doc-content')
  const scrollContainer = document.querySelector('.learn-content')
  if (!contentEl || !scrollContainer) return

  tocObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const id = entry.target.id
          if (id) {
            tocActiveId.value = id
            // Auto-scroll toc item into view within toc panel
            const tocItem = document.querySelector(`.toc-item[data-id="${id}"]`)
            const tocList = document.querySelector('.toc-sidebar-list')
            if (tocItem && tocList) {
              const itemRect = tocItem.getBoundingClientRect()
              const listRect = tocList.getBoundingClientRect()
              if (itemRect.top < listRect.top || itemRect.bottom > listRect.bottom) {
                tocList.scrollTo({
                  top: tocItem.offsetTop - tocList.offsetTop - 20,
                  behavior: 'smooth'
                })
              }
            }
          }
        }
      }
    },
    {
      root: scrollContainer,
      rootMargin: '-80px 0px -70% 0px',
      threshold: 0
    }
  )

  const headings = contentEl.querySelectorAll('h1, h2, h3, h4')
  headings.forEach(h => {
    if (h.id) tocObserver!.observe(h)
  })
}

function cleanupTocObserver() {
  if (tocObserver) {
    tocObserver.disconnect()
    tocObserver = null
  }
}

function onTocHeadingClick(id: string) {
  tocActiveId.value = id
  const scrollContainer = document.querySelector('.learn-content')
  if (!scrollContainer) return

  const heading = document.getElementById(id)
  if (heading) {
    const headingRect = heading.getBoundingClientRect()
    const containerRect = scrollContainer.getBoundingClientRect()
    const offsetTop = headingRect.top - containerRect.top + scrollContainer.scrollTop - 80
    scrollContainer.scrollTo({ top: offsetTop, behavior: 'smooth' })
  }
}

function toggleSection(id: string) {
  if (collapsedSections.value.has(id)) {
    collapsedSections.value.delete(id)
  } else {
    collapsedSections.value.add(id)
  }
}

function scrollToTop() {
  const el = document.querySelector('.learn-content')
  if (el) {
    el.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// Filter visible headings based on collapsed sections
const visibleTocHeadings = computed<TocHeading[]>(() => {
  const headings = tocHeadings.value
  if (headings.length === 0) return []

  const result: TocHeading[] = []
  let skipParentLevel = -1

  for (const heading of headings) {
    // If we're in a collapsed section, skip children (deeper levels)
    if (skipParentLevel !== -1 && heading.level > skipParentLevel) {
      continue
    }
    skipParentLevel = -1

    // Check if this heading is collapsed
    if (collapsedSections.value.has(heading.id)) {
      skipParentLevel = heading.level
    }

    result.push(heading)
  }
  return result
})

// Check if a heading has children (any deeper level heading before next same-or-higher level)
function hasChildren(heading: TocHeading, index: number): boolean {
  const allHeadings = tocHeadings.value
  for (let i = index + 1; i < allHeadings.length; i++) {
    if (allHeadings[i].level <= heading.level) return false
    if (allHeadings[i].level > heading.level) return true
  }
  return false
}

function getOriginalIndex(heading: TocHeading): number {
  return tocHeadings.value.findIndex(h => h.id === heading.id)
}
function onResize() { windowWidth.value = window.innerWidth }

// ===== Activity lookup =====
const activity = ref<Activity | null>(null)
const moduleTitle = ref('')

// ===== Loaded resource item =====
interface LoadedRes {
  idx: number
  planRef: ActivityResource
  title: string
  content: string
  status: 'loading' | 'ready' | 'viewed' | 'completed' | 'generating' | 'failed'
  qualityScore: number
  sourcesCount: number
  estimatedMin: number
  questions: any[]
  videoUrl: string | null
}

const loadedResources = ref<LoadedRes[]>([])
const activeResIndex = ref(0)

// ===== Step state: per-resource progress =====
type ResourceStepState = 'pending' | 'active' | 'completing' | 'completed'
const resourceStepState = ref<Map<number, ResourceStepState>>(new Map())
const resourceTimeSpent = ref<Map<number, number>>(new Map())
let currentResourceStartTime: number = 0

// ===== Quiz overlay =====


// ===== Celebration =====
const celebrationVisible = ref(false)

// ===== Transition =====
const transitionMode = ref<'step-forward' | 'step-back'>('step-forward')
const transitionGuard = ref(false)
let shortContentTimer: ReturnType<typeof setTimeout> | null = null
const shortContentCountdown = ref(0)
let shortContentInterval: ReturnType<typeof setInterval> | null = null

// ===== Timer =====
const elapsedSeconds = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

// ===== Video polling =====
const videoPolling = ref(false)
const videoPollSeconds = ref(0)
const videoPollMinutes = ref(0)
let videoPollTimer: ReturnType<typeof setInterval> | null = null

function startVideoPolling() {
  if (videoPollTimer) return
  videoPolling.value = true
  videoPollSeconds.value = 0
  videoPollMinutes.value = 0
  videoPollTimer = setInterval(() => {
    videoPollSeconds.value++
    if (videoPollSeconds.value >= 60) {
      videoPollSeconds.value = 0
      videoPollMinutes.value++
    }
    if (videoPollMinutes.value >= 10) {
      stopVideoPolling()
      return
    }
    checkVideoReady()
  }, 30000)
}

function stopVideoPolling() {
  if (videoPollTimer) {
    clearInterval(videoPollTimer)
    videoPollTimer = null
  }
  videoPolling.value = false
}

async function checkVideoReady() {
  const res = currentResource.value
  if (!res || res.planRef.resourceType !== 'video') return
  if (!res.planRef.resourcePackId) {
    stopVideoPolling()
    return
  }
  try {
    const data = await actStore.fetchResourcePack(res.planRef.resourcePackId)
    if (data?.resources) {
      const match = data.resources.find((item: any) => item.type === 'video')
      if (match) {
        const url = extractVideoUrl(match)
        if (url) {
          res.videoUrl = url
          stopVideoPolling()
        }
      }
    }
  } catch { /* keep polling */ }
}

// ===== Content scroll =====
const contentScrollProgress = ref(0)

// ===== Computed =====

const currentResource = computed(() => loadedResources.value[activeResIndex.value])

const isLastResource = computed(() => activeResIndex.value >= loadedResources.value.length - 1)

const completedCount = computed(() => {
  let count = 0
  resourceStepState.value.forEach(state => { if (state === 'completed') count++ })
  return count
})

const stepZoneVisible = computed(() => {
  const state = resourceStepState.value.get(activeResIndex.value)
  return state === 'completing' || state === 'completed'
})

const hasNextActivity = computed(() => {
  if (!activity.value) return false
  let foundCurrent = false
  for (const m of planStore.moduleList) {
    const sp = planStore.subPlans.get(m.moduleId)
    if (!sp) continue
    for (let i = 0; i < sp.activities.length; i++) {
      if (foundCurrent) return true
      if (sp.activities[i].activityId === activity.value?.activityId) {
        foundCurrent = true
        if (i < sp.activities.length - 1) return true
      }
    }
  }
  return false
})

const navItems = computed<NavItem[]>(() =>
  loadedResources.value.map(r => ({
    index: r.idx,
    type: r.planRef.resourceType,
    title: r.title || typeLabel(r.planRef.resourceType),
    status: resourceStepState.value.get(r.idx) || 'pending',
    estimatedMin: r.estimatedMin || undefined,
  }))
)

const remainingMin = computed(() => {
  const total = activity.value?.estimatedMinutes || 25
  const spent = Math.floor(elapsedSeconds.value / 60)
  return Math.max(0, total - spent)
})

// ===== Resource type helpers =====
const TYPE_ICONS: Record<string, string> = {
  doc: '\uD83D\uDCC4', reading: '\uD83D\uDCD6', mindmap: '\uD83E\uDDE0',
  video: '\uD83C\uDFAC', code: '\uD83D\uDCBB', quiz: '\uD83D\uDCDD',
}
const TYPE_LABELS: Record<string, string> = {
  doc: '文档', reading: '阅读', mindmap: '思维导图', video: '视频', code: '代码', quiz: '测验',
}

const RESOURCE_ACCENT_COLORS: Record<string, string> = {
  doc: '#2B6FFF',
  reading: '#34C759',
  mindmap: '#7C5CFC',
  video: '#FF3B30',
  code: '#5A5A72',
  quiz: '#FF8C42',
}

function typeIcon(type: string): string { return TYPE_ICONS[type] || '\uD83D\uDCC4' }
function typeLabel(type: string): string { return TYPE_LABELS[type] || type }

// ===== Resource loading =====
async function loadAllResources() {
  if (!activity.value) return
  let resources = activity.value.resources
  if (!resources || resources.length === 0) {
    if (activity.value.resource?.resourcePackId) {
      resources = [activity.value.resource]
    }
  }

  if (!resources || resources.length === 0) {
    loadedResources.value = [{
      idx: 0,
      planRef: { source: 'generated' as const, resourcePackId: null, resourceType: 'doc', generationStatus: null },
      title: activity.value.title || '学习内容',
      content: `# ${activity.value.title || '学习内容'}\n\n${activity.value.description || ''}\n\n---\n\n> 暂无学习资源。请返回路径页刷新，或联系管理员。`,
      status: 'ready',
      qualityScore: 0, sourcesCount: 0, estimatedMin: 0,
      questions: [], videoUrl: null,
    }]
    return
  }

  try {
    loadedResources.value = resources.map((r, i) => ({
      idx: i,
      planRef: r,
      title: typeLabel(r.resourceType),
      content: '',
      status: 'loading' as const,
      qualityScore: 0, sourcesCount: 0, estimatedMin: 0,
      questions: [], videoUrl: null,
    }))

    const uniquePackIds = [...new Set(resources.map(r => r.resourcePackId).filter(Boolean))]
    const packCache: Record<string, any> = {}
    if (uniquePackIds.length > 0) {
      const results = await Promise.allSettled(uniquePackIds.map(id => actStore.fetchResourcePack(id)))
      results.forEach((res, idx) => {
        if (res.status === 'fulfilled' && res.value?.resources) {
          packCache[uniquePackIds[idx]] = res.value
        }
      })
    }

    for (let i = 0; i < resources.length; i++) {
      const r = resources[i]
      let packData = r.resourcePackId ? packCache[r.resourcePackId] : null
      if (!packData) {
        packData = Object.values(packCache).find(p => p.resources?.some((item: any) => item.type === r.resourceType)) || null
      }
      if (!packData) {
        loadedResources.value[i].status = 'generating'
        continue
      }
      try {
        const matches = packData.resources.filter((item: any) => item.type === r.resourceType)
        if (matches.length === 0) {
          loadedResources.value[i].status = 'ready'
          loadedResources.value[i].title = typeLabel(r.resourceType)
          continue
        }
        const expectedIdx = (activity.value?.order || 1) - 1
        const item = matches.find((m: any) => m.subtopic_index === expectedIdx) || matches[0]
        console.log(`[ResourceLoad] activityId=${activity.value?.activityId} order=${activity.value?.order} type=${r.resourceType} packId=${r.resourcePackId} expectedIdx=${expectedIdx} matchedTitle="${item?.title}" subtopicIndex=${item?.subtopic_index} totalMatches=${matches.length}`)
        loadedResources.value[i].title = item.title || typeLabel(r.resourceType)
        loadedResources.value[i].qualityScore = item.qualityScore || item.metadata?.quality_score || 0
        loadedResources.value[i].sourcesCount = item.sourcesCount || item.sources?.length || 0
        loadedResources.value[i].status = 'ready'

        if (r.resourceType === 'video') {
          loadedResources.value[i].videoUrl = extractVideoUrl(item)
          if (!loadedResources.value[i].videoUrl && activeResIndex.value === i) {
            startVideoPolling()
          }
        } else if (r.resourceType === 'quiz') {
          loadedResources.value[i].questions = extractQuestions(item)
        } else {
          const c = typeof item.content === 'string' ? item.content : JSON.stringify(item.content)
          loadedResources.value[i].content = (c && c !== '{}') ? c : ''
        }
      } catch {
        loadedResources.value[i].status = 'failed'
        loadedResources.value[i].title = typeLabel(r.resourceType) + '（加载失败）'
      }
    }
  } catch (err) {
    console.error('[LearnView] loadAllResources failed:', err)
    ElMessage.error('资源加载失败，请刷新页面重试')
    if (loadedResources.value.length === 0) {
      loadedResources.value = [{
        idx: 0,
        planRef: { source: 'generated' as const, resourcePackId: null, resourceType: 'doc', generationStatus: null },
        title: activity.value?.title || '学习内容',
        content: `# ${activity.value?.title || '学习内容'}\n\n${activity.value?.description || ''}\n\n---\n\n> 资源加载失败，请刷新页面重试。`,
        status: 'ready',
        qualityScore: 0, sourcesCount: 0, estimatedMin: 0,
        questions: [], videoUrl: null,
      }]
    }
  }
}

function extractQuestions(item: any): any[] {
  if (!item.content) return []
  try {
    const parsed = typeof item.content === 'string' ? JSON.parse(item.content) : item.content
    return parsed?.questions || []
  } catch { return [] }
}

// ===== Resource navigation =====
function goToResource(idx: number) {
  if (idx === activeResIndex.value) return
  if (shortContentTimer) { clearTimeout(shortContentTimer); shortContentTimer = null }
  if (shortContentInterval) { clearInterval(shortContentInterval); shortContentInterval = null }
  shortContentCountdown.value = 0
  stopVideoPolling()
  transitionGuard.value = true
  transitionMode.value = idx > activeResIndex.value ? 'step-forward' : 'step-back'
  recordTimeSpent()
  activeResIndex.value = idx
  contentScrollProgress.value = 0
  if (resourceStepState.value.get(idx) !== 'completed') {
    resourceStepState.value.set(idx, 'active')
  }
  currentResourceStartTime = Date.now()
  nextTick(() => {
    scrollContentToTop()
    transitionGuard.value = false
    if (showToc.value) setupTocObserver()
  })
  if (currentResource.value?.planRef.resourceType === 'video' && !currentResource.value?.videoUrl) {
    startVideoPolling()
  }
}

function advanceToNext() {
  if (shortContentTimer) { clearTimeout(shortContentTimer); shortContentTimer = null }
  recordTimeSpent()
  resourceStepState.value.set(activeResIndex.value, 'completed')

  let next = activeResIndex.value + 1
  while (next < loadedResources.value.length) {
    if (resourceStepState.value.get(next) !== 'completed') break
    next++
  }

  if (next >= loadedResources.value.length) {
    celebrationVisible.value = true
    clearState()
    if (timer) clearInterval(timer)
    timer = null
    return
  }

  transitionGuard.value = true
  transitionMode.value = 'step-forward'
  activeResIndex.value = next
  resourceStepState.value.set(next, 'active')
  currentResourceStartTime = Date.now()
  contentScrollProgress.value = 0
  nextTick(() => {
    scrollContentToTop()
    transitionGuard.value = false
    if (showToc.value) setupTocObserver()
  })

  if (currentResource.value?.planRef.resourceType === 'video' && !currentResource.value?.videoUrl) {
    startVideoPolling()
  }
}

// ===== Completion detection =====
function recordTimeSpent() {
  const existing = resourceTimeSpent.value.get(activeResIndex.value) || 0
  const elapsed = Math.floor((Date.now() - currentResourceStartTime) / 1000)
  resourceTimeSpent.value.set(activeResIndex.value, existing + elapsed)
}

async function retryResource(idx: number) {
  const lr = loadedResources.value[idx]
  if (!lr || lr.status !== 'failed') return
  lr.status = 'loading'
  lr.title = typeLabel(lr.planRef.resourceType) + '（加载中...）'
  try {
    const r = lr.planRef
    if (!r.resourcePackId) {
      lr.status = 'generating'
      return
    }
    const data = await actStore.fetchResourcePack(r.resourcePackId)
    if (!data?.resources) {
      lr.status = 'failed'
      lr.title = typeLabel(r.resourceType) + '（重试失败）'
      return
    }
    const matches = data.resources.filter((item: any) => item.type === r.resourceType)
    if (matches.length === 0) {
      lr.status = 'failed'
      lr.title = typeLabel(r.resourceType) + '（重试失败）'
      return
    }
    const item = matches[0]
    lr.title = item.title || typeLabel(r.resourceType)
    lr.qualityScore = item.qualityScore || item.metadata?.quality_score || 0
    lr.sourcesCount = item.sourcesCount || item.sources?.length || 0
    lr.status = 'ready'
    if (r.resourceType === 'video') {
      lr.videoUrl = extractVideoUrl(item)
    } else if (r.resourceType === 'quiz') {
      lr.questions = extractQuestions(item)
    } else {
      const c = typeof item.content === 'string' ? item.content : JSON.stringify(item.content)
      lr.content = (c && c !== '{}') ? c : ''
    }
    ElMessage.success(`「${lr.title}」加载成功`)
  } catch {
    lr.status = 'failed'
    lr.title = typeLabel(lr.planRef.resourceType) + '（重试失败）'
    ElMessage.error('重试加载失败')
  }
}

function onContentScroll(event: Event) {
  const target = event.target as HTMLElement
  if (!target) return
  const scrollBottom = target.scrollTop + target.clientHeight
  const scrollHeight = target.scrollHeight
  contentScrollProgress.value = Math.min(scrollBottom / scrollHeight, 1)

  // Update TOC scroll percent
  if (showToc.value && scrollHeight > target.clientHeight) {
    tocScrollPercent.value = Math.round((target.scrollTop / (scrollHeight - target.clientHeight)) * 100)
  }

  checkCompletionTrigger()
}

function checkCompletionTrigger() {
  if (transitionGuard.value) return
  const res = currentResource.value
  if (!res) return
  const state = resourceStepState.value.get(activeResIndex.value)
  if (state === 'completed' || state === 'completing') return

  const type = res.planRef.resourceType
  const scrollOk = contentScrollProgress.value >= 0.9
  const accumulated = resourceTimeSpent.value.get(activeResIndex.value) || 0
  const currentSession = Math.floor((Date.now() - currentResourceStartTime) / 1000)
  const liveTimeSpent = accumulated + currentSession
  const minTime = Math.max(30, (res.estimatedMin || 5) * 60 * 0.3)
  const timeOk = liveTimeSpent >= minTime

  if (type === 'quiz') return

  const shouldComplete = scrollOk && timeOk

  if (shouldComplete) {
    resourceStepState.value.set(activeResIndex.value, 'completing')
  }
}

function onVideoEnded() {
  const state = resourceStepState.value.get(activeResIndex.value)
  if (state === 'completed' || state === 'completing') return
  recordTimeSpent()
  resourceStepState.value.set(activeResIndex.value, 'completing')
}

function checkShortContent() {
  const el = document.querySelector('.learn-content')
  if (!el) return
  if (el.scrollHeight <= el.clientHeight + 50) {
    contentScrollProgress.value = 1
    const minTime = Math.max(30, (currentResource.value?.estimatedMin || 5) * 60 * 0.3)
    shortContentCountdown.value = minTime
    if (shortContentInterval) clearInterval(shortContentInterval)
    shortContentInterval = setInterval(() => {
      shortContentCountdown.value = Math.max(0, shortContentCountdown.value - 1)
    }, 1000)
    shortContentTimer = setTimeout(() => {
      if (shortContentInterval) clearInterval(shortContentInterval)
      shortContentInterval = null
      shortContentCountdown.value = 0
      checkCompletionTrigger()
      shortContentTimer = null
    }, minTime * 1000)
  }
}

// ===== Quiz callbacks =====
function onQuizComplete(_result: ActivitySubmitResponse) {
  recordTimeSpent()
  resourceStepState.value.set(activeResIndex.value, 'completing')
}

// ===== Step complete callbacks =====
function onStepContinue() {
  advanceToNext()
}

function onStepReview() {
  advanceToNext()
}

// ===== Timer =====
function startLearn() {
  actStore.learnStartTime = Date.now()
  timer = setInterval(() => {
    elapsedSeconds.value = Math.floor((Date.now() - actStore.learnStartTime) / 1000)
  }, 1000)
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// ===== Navigation =====
function onNavigatorSelect(idx: number) {
  goToResource(idx)
}

function navigateToNext() {
  if (activity.value) {
    for (const m of planStore.moduleList) {
      const sp = planStore.subPlans.get(m.moduleId)
      if (sp) {
        const idx = sp.activities.findIndex(a => a.activityId === activity.value?.activityId)
        if (idx >= 0 && idx < sp.activities.length - 1) {
          router.push(`/learn/${sp.activities[idx + 1].activityId}`)
          return
        }
      }
    }
  }
  router.push('/path')
}

function scrollContentToTop() {
  const el = document.querySelector('.learn-content')
  if (el) el.scrollTop = 0
}

// ===== Learning state persistence =====
const STATE_KEY = 'lt-learn-state'

function saveState() {
  if (!activityId.value) return
  recordTimeSpent()
  const data = {
    activityId: activityId.value,
    activeResIndex: activeResIndex.value,
    elapsedSeconds: elapsedSeconds.value,
    resourceStepState: Array.from(resourceStepState.value.entries()),
    resourceTimeSpent: Array.from(resourceTimeSpent.value.entries()),
    learnStartTime: actStore.learnStartTime,
  }
  const json = JSON.stringify(data)
  sessionStorage.setItem(STATE_KEY, json)
  try { localStorage.setItem(STATE_KEY, json) } catch { /* storage full */ }
}

function restoreState(): boolean {
  let raw = sessionStorage.getItem(STATE_KEY)
  if (!raw) {
    try { raw = localStorage.getItem(STATE_KEY) } catch { /* ignore */ }
  }
  if (!raw) return false
  try {
    const data = JSON.parse(raw)
    if (data.activityId !== activityId.value) {
      sessionStorage.removeItem(STATE_KEY)
      try { localStorage.removeItem(STATE_KEY) } catch { /* ignore */ }
      return false
    }
    activeResIndex.value = data.activeResIndex
    elapsedSeconds.value = data.elapsedSeconds
    resourceStepState.value = new Map(data.resourceStepState)
    resourceTimeSpent.value = new Map(data.resourceTimeSpent)
    actStore.learnStartTime = data.learnStartTime
    return true
  } catch {
    sessionStorage.removeItem(STATE_KEY)
    try { localStorage.removeItem(STATE_KEY) } catch { /* ignore */ }
    return false
  }
}

function clearState() {
  sessionStorage.removeItem(STATE_KEY)
  try { localStorage.removeItem(STATE_KEY) } catch { /* ignore */ }
}

// ===== Lifecycle =====
onMounted(async () => {
  window.addEventListener('resize', onResize)

  if (routeModuleId.value) {
    const sp = planStore.subPlans.get(routeModuleId.value)
    if (sp) {
      const a = sp.activities.find(act => act.activityId === activityId.value)
      if (a) {
        activity.value = a
        moduleTitle.value = planStore.moduleList.find(m => m.moduleId === routeModuleId.value)?.title || ''
      }
    }
  }
  if (!activity.value) {
    for (const m of planStore.moduleList) {
      const sp = planStore.subPlans.get(m.moduleId)
      if (sp) {
        const a = sp.activities.find(act => act.activityId === activityId.value)
        if (a) {
          activity.value = a
          moduleTitle.value = m.title
          break
        }
      }
    }
  }

  if (!activity.value) {
    ElMessage.error('活动不存在')
    router.push('/path')
    return
  }

  actStore.learnStartTime = Date.now()
  await loadAllResources()

  const restored = restoreState()
  if (!restored) {
    activeResIndex.value = 0
    for (let i = 0; i < loadedResources.value.length; i++) {
      resourceStepState.value.set(i, i === 0 ? 'active' : 'pending')
    }
  }

  currentResourceStartTime = Date.now()
  startLearn()
  if (currentResource.value?.planRef.resourceType === 'video' && !currentResource.value?.videoUrl) {
    startVideoPolling()
  }
  nextTick(() => {
    checkShortContent()
    if (showToc.value) setupTocObserver()
  })
})

onUnmounted(() => {
  saveState()
  stopVideoPolling()
  cleanupTocObserver()
  if (timer) clearInterval(timer)
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <div class="learn-root">
    <!-- Ambient background orbs -->
    <div class="learn-orb learn-orb--tl"></div>
    <div class="learn-orb learn-orb--br"></div>

    <!-- Top Bar -->
    <div class="learn-topbar">
      <div class="flex items-center gap-3">
        <el-button text @click="clearState(); router.push('/path')">
          <el-icon><ArrowLeft /></el-icon>
          返回路径
        </el-button>
        <div class="flex items-center gap-2 text-sm" style="color: var(--lt-text-secondary);">
          <span style="color: var(--lt-text-primary); font-weight: 500;">{{ moduleTitle }}</span>
          <span>·</span>
          <span v-if="activity">{{ activity.title }}</span>
          <el-tag v-if="activity" size="small" effect="plain" :disable-transitions="true">
            {{ activity.type === 'learn' ? '学习' : '拓展' }}
          </el-tag>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <div v-if="loadedResources.length > 1" class="learn-topbar-progress">
          <div class="ltp-track">
            <div
              class="ltp-fill"
              :style="{ width: `${(completedCount / loadedResources.length) * 100}%` }"
            ></div>
          </div>
          <span class="ltp-label">{{ completedCount }}/{{ loadedResources.length }}</span>
        </div>
        <el-button
          v-if="loadedResources.length > 1"
          text size="small"
          :style="{ color: navVisible ? 'var(--lt-brand)' : 'var(--lt-text-auxiliary)' }"
          title="切换资源导航器"
          @click="toggleNav"
        >
          <el-icon><List /></el-icon>
        </el-button>
        <span class="text-sm font-mono" style="color: var(--lt-text-auxiliary);">
          <el-icon><Clock /></el-icon>
          {{ formatTime(elapsedSeconds) }}
        </span>
      </div>
    </div>

    <!-- TOC Toggle Button (below topbar) -->
    <div v-if="showToc" class="toc-bar">
      <button
        class="toc-floating-btn"
        @click="toggleToc"
        title="展开目录"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span>目录</span>
      </button>
    </div>

    <!-- Quiz Progress Outlet (same layer as topbar) -->
    <div id="quiz-progress-outlet"></div>

    <!-- Content Area -->
    <div class="learn-content" @scroll="onContentScroll">
      <div class="learn-content-inner">
        <!-- Single Resource Step -->
        <Transition :name="transitionMode" mode="out-in">
          <div
            v-if="currentResource"
            :key="activeResIndex"
            class="resource-step"
          >
            <!-- Resource Title + Info -->
            <div v-if="currentResource.planRef.resourceType !== 'quiz'" class="resource-immersive-header">
              <h2 class="resource-immersive-title">{{ currentResource.title }}</h2>
              <div class="resource-immersive-info">
                <span class="resource-immersive-type"
                  :style="{ color: RESOURCE_ACCENT_COLORS[currentResource.planRef.resourceType] || '#2B6FFF' }"
                >{{ typeIcon(currentResource.planRef.resourceType) }} {{ typeLabel(currentResource.planRef.resourceType) }}</span>
                <span v-if="currentResource.estimatedMin" class="resource-immersive-duration">· 约{{ currentResource.estimatedMin }}分钟</span>
              </div>
              <div class="resource-immersive-divider"></div>
            </div>

            <!-- Resource Body -->
            <div class="resource-section-body">
              <!-- Generating placeholder -->
              <div v-if="currentResource.status === 'generating'" class="resource-placeholder">
                <p>该资源正在生成中，请稍后刷新页面查看。</p>
              </div>

              <!-- Failed placeholder -->
              <div v-else-if="currentResource.status === 'failed'" class="resource-placeholder">
                <p class="mb-3">{{ currentResource.title }}</p>
                <el-button size="small" type="primary" plain @click="retryResource(activeResIndex)">
                  重新加载
                </el-button>
              </div>

              <!-- Loading skeleton -->
              <div v-else-if="currentResource.status === 'loading'" class="resource-placeholder">
                <div class="skeleton-block">
                  <div class="skeleton-line w-3/4"></div>
                  <div class="skeleton-line w-full"></div>
                  <div class="skeleton-line w-5/6"></div>
                  <div class="skeleton-line w-2/3"></div>
                  <div class="skeleton-line w-4/5"></div>
                </div>
                <p class="text-sm mt-3" style="color: var(--lt-text-auxiliary);">正在加载资源...</p>
              </div>

              <!-- mindmap -->
              <div v-else-if="currentResource.planRef.resourceType === 'mindmap'" class="resource-mindmap">
                <MindmapViewer
                  v-if="currentResource.content"
                  :content="currentResource.content"
                  :is-json="true"
                />
                <div v-else class="resource-placeholder">思维导图内容为空</div>
              </div>

              <!-- video -->
              <div v-else-if="currentResource.planRef.resourceType === 'video'" class="resource-video">
                <video
                  v-if="currentResource.videoUrl"
                  :src="currentResource.videoUrl"
                  controls
                  class="w-full rounded-lg"
                  style="max-height: 480px; background: #000;"
                  @ended="onVideoEnded"
                />
                <div v-else-if="videoPolling" class="resource-placeholder">
                  <div class="video-generating-indicator">
                    <span class="video-dot-pulse"></span>
                    <p class="mb-1">视频正在后台生成中...</p>
                    <p class="text-xs" style="color: var(--lt-text-auxiliary);">预计需要 2-5 分钟，请勿离开</p>
                    <p class="text-xs mt-1" style="color: var(--lt-text-auxiliary);">已等待 {{ videoPollMinutes }}:{{ String(videoPollSeconds).padStart(2, '0') }}</p>
                    <el-button size="small" class="mt-2" @click="checkVideoReady">手动刷新</el-button>
                  </div>
                </div>
                <div v-else class="resource-placeholder">视频 URL 暂不可用</div>
              </div>

              <!-- quiz -->
              <QuizFocusModal
                v-else-if="currentResource.planRef.resourceType === 'quiz'"
                :questions="currentResource.questions || []"
                :resource-idx="activeResIndex"
                :activity-id="activityId"
                teleport-bar
                @complete="onQuizComplete"
                @back-to-path="clearState(); router.push('/path')"
              />

              <!-- code -->
              <template v-else-if="currentResource.planRef.resourceType === 'code' && currentResource.content">
                <CodeLearningViewer
                  :content="currentResource.content"
                  :title="currentResource.title || ''"
                  :quality-score="currentResource.qualityScore"
                  :sources-count="currentResource.sourcesCount"
                />
              </template>

              <!-- doc / reading with TOC sidebar -->
              <div v-else class="resource-doc-layout">
                <!-- TOC sidebar -->
                <Transition name="toc-slide">
                  <div v-if="showToc && !tocCollapsed && tocHeadings.length > 0" class="toc-sidebar-immersive">
                    <!-- Progress bar -->
                    <div class="toc-progress-track">
                      <div class="toc-progress-fill" :style="{ height: tocScrollPercent + '%' }"></div>
                      <span class="toc-progress-label" :style="{ top: `calc(${tocScrollPercent}% - 8px)` }">{{ tocScrollPercent }}%</span>
                    </div>

                    <div class="toc-sidebar-header">
                      <span class="toc-sidebar-close" @click="toggleToc">×</span>
                      <span>目录</span>
                      <span></span>
                    </div>

                    <div class="toc-sidebar-list">
                      <div
                        v-for="(heading, idx) in visibleTocHeadings"
                        :key="heading.id"
                        class="toc-item"
                        :class="[
                          `toc-level-${heading.level}`,
                          { 'toc-active': tocActiveId === heading.id }
                        ]"
                        :data-id="heading.id"
                        @click="onTocHeadingClick(heading.id)"
                      >
                        <span
                          v-if="hasChildren(heading, getOriginalIndex(heading))"
                          class="toc-arrow"
                          :class="{ 'toc-arrow--collapsed': collapsedSections.has(heading.id) }"
                          @click.stop="toggleSection(heading.id)"
                        >▸</span>
                        <span class="toc-item-text">{{ heading.text }}</span>
                      </div>
                    </div>

                    <!-- Back to top -->
                    <div class="toc-footer">
                      <button class="toc-back-top" @click="scrollToTop">
                        <span class="toc-back-top-icon">↑</span>
                        <span>顶部</span>
                      </button>
                    </div>
                  </div>
                </Transition>

                <!-- Main content -->
                <div class="resource-doc-content">
                  <MarkdownViewer
                    v-if="currentResource.content"
                    :content="currentResource.content"
                    :show-toc="false"
                  />
                  <div v-else class="resource-placeholder">暂无内容</div>
                </div>
              </div>
            </div>

            <!-- Short content timer -->
            <div v-if="shortContentCountdown > 0" class="short-content-timer">
              <svg class="sct-ring" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" fill="none" stroke="var(--lt-brand-lighter)" stroke-width="2" />
                <circle
                  cx="12" cy="12" r="9"
                  fill="none"
                  stroke="var(--lt-brand)"
                  stroke-width="2"
                  stroke-linecap="round"
                  :stroke-dasharray="2 * Math.PI * 9"
                  :stroke-dashoffset="2 * Math.PI * 9 * (1 - shortContentCountdown / Math.max(30, (currentResource?.estimatedMin || 5) * 60 * 0.3))"
                  transform="rotate(-90 12 12)"
                  class="sct-ring-progress"
                />
              </svg>
              <span>内容较短，{{ shortContentCountdown }}秒后可继续</span>
            </div>

            <!-- StepCompleteZone -->
            <StepCompleteZone
              :visible="stepZoneVisible"
              :time-spent="resourceTimeSpent.get(activeResIndex) || 0"
              :is-last-resource="isLastResource"
              :sources-count="currentResource?.sourcesCount || 0"
              :quality-score="currentResource?.qualityScore || 0"
              @continue="onStepContinue"
              @review="onStepReview"
            />
          </div>
        </Transition>

        <!-- ActivityCelebration -->
        <ActivityCelebration
          v-if="celebrationVisible"
          :total-resources="loadedResources.length"
          :total-time-seconds="elapsedSeconds"
          :estimated-minutes="activity?.estimatedMinutes || 25"
          :has-next-activity="hasNextActivity"
          @back-to-path="clearState(); router.push('/path')"
          @next-activity="clearState(); navigateToNext()"
        />
      </div>
    </div>

    <!-- ResourceNavigator -->
    <ResourceNavigator
      v-if="navVisible && loadedResources.length > 1"
      :items="navItems"
      :active-index="activeResIndex"
      :done-count="completedCount"
      :remaining-min="remainingMin"
      :is-mobile="isMobile"
      @select="onNavigatorSelect"
    />

  </div>
</template>

<style scoped>
.learn-root {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  isolation: isolate;
}

/* ── Ambient orbs ── */
.learn-orb {
  position: fixed;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
  filter: blur(60px);
}
.learn-orb--tl {
  top: -160px;
  left: -80px;
  width: 480px;
  height: 480px;
  background: radial-gradient(circle, rgba(43, 111, 255, 0.08) 0%, transparent 70%);
  animation: orb-breathe 8s ease-in-out infinite;
}
.learn-orb--br {
  bottom: -120px;
  right: -60px;
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(124, 92, 252, 0.06) 0%, transparent 70%);
  animation: orb-breathe 10s ease-in-out infinite reverse;
}

@keyframes orb-breathe {
  0%, 100% { opacity: 0.7; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.12); }
}

/* ── Topbar ── */
.learn-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: linear-gradient(180deg, #FFFFFF 0%, #F8FAFF 100%);
  border-bottom: 1px solid var(--lt-border);
  box-shadow: 0 2px 16px rgba(43, 111, 255, 0.05);
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.learn-topbar-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ltp-track {
  width: 72px;
  height: 4px;
  background: var(--lt-border);
  border-radius: 2px;
  overflow: hidden;
}

.ltp-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--lt-brand), var(--lt-brand-light));
  border-radius: 2px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.ltp-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--lt-brand);
  font-variant-numeric: tabular-nums;
  min-width: 28px;
}

/* ── Content area ── */
.learn-content {
  flex: 1;
  overflow-y: auto;
  background: transparent;
  position: relative;
  z-index: 1;
}

.learn-content-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 32px 28px 32px;
  position: relative;
  z-index: 1;
}

/* ── Immersive resource header ── */
.resource-immersive-header {
  margin-bottom: 24px;
}

.resource-immersive-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--lt-text-primary);
  margin: 0 0 6px 0;
  line-height: 1.4;
}

.resource-immersive-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--lt-text-auxiliary);
}

.resource-immersive-type {
  font-weight: 600;
}

.resource-immersive-duration {
  color: var(--lt-text-auxiliary);
}

.resource-immersive-divider {
  height: 1px;
  background: var(--lt-border);
  margin-top: 16px;
}

/* ── Resource step (immersive, no card) ── */
.resource-step {
  transition: opacity 0.3s ease;
}

.resource-section-body {
  padding: 0;
}

.resource-placeholder {
  text-align: center;
  padding: 40px 20px;
  color: var(--lt-text-auxiliary);
  font-size: 14px;
}

/* ── Skeleton loading ── */
.skeleton-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 480px;
  margin: 0 auto;
}
.skeleton-line {
  height: 14px;
  border-radius: 7px;
  background: linear-gradient(90deg, var(--lt-border) 25%, #e8ecf0 50%, var(--lt-border) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
}
.w-3\/4 { width: 75%; }
.w-5\/6 { width: 83%; }
.w-2\/3 { width: 66%; }
.w-4\/5 { width: 80%; }
.w-full { width: 100%; }

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Short content countdown ── */
.short-content-timer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  margin: 0 16px 12px;
  border-radius: var(--lt-radius-md);
  background: rgba(43, 111, 255, 0.06);
  color: var(--lt-brand);
  font-size: 13px;
}
.sct-ring {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}
.sct-ring-progress {
  transition: stroke-dashoffset 1s linear;
}

.resource-mindmap {
  min-height: 400px;
}

/* ── Video generating ── */
.video-generating-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
}
.video-dot-pulse {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--lt-brand);
  animation: video-pulse 1.5s ease-in-out infinite;
  margin-bottom: 12px;
}
@keyframes video-pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}

/* ── Doc layout with TOC ── */
.resource-doc-layout {
  position: relative;
}

.resource-doc-content {
  max-width: 800px;
  margin: 0 auto;
}

.toc-bar {
  padding-right: max(16px, calc(50% - 530px));
  padding-left: 16px;
  margin-top: 8px;
}

.toc-floating-btn {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--lt-border);
  border-radius: 6px;
  background: var(--lt-bg-card);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--lt-text-secondary);
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.toc-floating-btn:hover {
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
  border-color: var(--lt-brand-lighter);
}

.toc-sidebar-immersive {
  position: fixed;
  left: 16px;
  top: 128px;
  width: 240px;
  max-height: calc(100vh - 110px);
  display: flex;
  flex-direction: column;
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-lg);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  z-index: 100;
}

/* Progress bar */
.toc-progress-track {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--lt-border);
  z-index: 1;
}

.toc-progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  background: linear-gradient(180deg, var(--lt-brand), var(--lt-brand-light));
  transition: height 0.3s ease;
  border-radius: 0 0 2px 2px;
}

.toc-progress-label {
  position: absolute;
  left: 8px;
  font-size: 10px;
  font-weight: 600;
  color: var(--lt-brand);
  background: var(--lt-bg-card);
  padding: 2px 4px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.2s, top 0.3s ease;
  pointer-events: none;
  white-space: nowrap;
}

.toc-sidebar-immersive:hover .toc-progress-label {
  opacity: 1;
}

.toc-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 12px 20px;
  font-size: 13px;
  font-weight: 700;
  color: var(--lt-text-secondary);
  border-bottom: 1px solid var(--lt-border);
  flex-shrink: 0;
}

.toc-sidebar-close {
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  color: var(--lt-text-auxiliary);
  padding: 0 2px;
  transition: color 0.15s;
}

.toc-sidebar-close:hover {
  color: var(--lt-text-primary);
}

.toc-sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

/* TOC Item - new design */
.toc-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--lt-text-auxiliary, #94a3b8);
  cursor: pointer;
  padding: 5px 12px 5px 20px;
  transition: all 0.15s;
  line-height: 1.5;
  position: relative;
}

.toc-item::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 0;
  background: transparent;
  border-radius: 1px;
  transition: all 0.2s;
}

.toc-item:hover {
  color: var(--lt-brand);
  background: var(--lt-brand-lightest, #eff6ff);
}

.toc-item:hover::before {
  height: 60%;
  background: var(--lt-brand-lighter);
}

.toc-item.toc-active {
  color: var(--lt-brand);
  background: rgba(43, 111, 255, 0.06);
  font-weight: 600;
}

.toc-item.toc-active::before {
  height: 80%;
  background: var(--lt-brand);
}

/* Level styles */
.toc-item.toc-level-1 {
  padding-left: 20px;
  font-weight: 600;
  font-size: 13px;
}

.toc-item.toc-level-1::before {
  left: 6px;
  width: 3px;
  border-radius: 2px;
}

.toc-item.toc-level-2 {
  padding-left: 32px;
  font-weight: 500;
}

.toc-item.toc-level-2::before {
  left: 20px;
  width: 2px;
}

.toc-item.toc-level-3 {
  padding-left: 44px;
  font-size: 11px;
}

.toc-item.toc-level-3::before {
  left: 32px;
  width: 2px;
  border-style: dashed;
}

.toc-item.toc-level-4 {
  padding-left: 56px;
  font-size: 11px;
  color: var(--lt-text-auxiliary);
}

.toc-item.toc-level-4::before {
  display: none;
}

/* Arrow for collapsible sections */
.toc-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 10px;
  color: var(--lt-text-auxiliary);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.toc-arrow:hover {
  color: var(--lt-brand);
}

.toc-arrow--collapsed {
  transform: rotate(0deg);
}

.toc-arrow:not(.toc-arrow--collapsed) {
  transform: rotate(90deg);
}

.toc-item-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Footer with back to top */
.toc-footer {
  padding: 8px 12px;
  border-top: 1px solid var(--lt-border);
  flex-shrink: 0;
}

.toc-back-top {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  padding: 6px 0;
  border: none;
  background: transparent;
  color: var(--lt-text-auxiliary);
  font-size: 12px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s;
}

.toc-back-top:hover {
  color: var(--lt-brand);
  background: var(--lt-brand-lightest);
}

.toc-back-top-icon {
  font-size: 14px;
  font-weight: 700;
}

/* TOC slide transition */
.toc-slide-enter-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.toc-slide-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.toc-slide-enter-from {
  opacity: 0;
  transform: translateX(-16px);
}
.toc-slide-leave-to {
  opacity: 0;
  transform: translateX(-16px);
}

/* ── Slide transitions ── */
.step-forward-enter-active,
.step-forward-leave-active,
.step-back-enter-active,
.step-back-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.step-forward-enter-from {
  opacity: 0;
  transform: translateX(48px) scale(0.98);
}
.step-forward-leave-to {
  opacity: 0;
  transform: translateX(-48px) scale(0.98);
}

.step-back-enter-from {
  opacity: 0;
  transform: translateX(-48px) scale(0.98);
}
.step-back-leave-to {
  opacity: 0;
  transform: translateX(48px) scale(0.98);
}

/* ── Mobile ── */
@media (max-width: 767px) {
  .learn-orb--tl {
    top: -200px;
    left: -120px;
    width: 320px;
    height: 320px;
  }
  .learn-orb--br {
    bottom: -140px;
    right: -100px;
    width: 280px;
    height: 280px;
  }

  .learn-topbar {
    padding: 10px 16px;
  }

  .learn-topbar-progress {
    gap: 0;
  }
  .ltp-track {
    display: none;
  }

  .learn-content-inner {
    max-width: 100%;
    padding: 20px 16px 20px;
  }

  .resource-immersive-title {
    font-size: 18px;
  }

  .resource-section-body {
    padding: 0;
  }

  .toc-bar {
    padding: 0 16px;
    margin-top: 6px;
  }

  .toc-sidebar-immersive {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: 280px;
    max-height: 100vh;
    border-radius: 0;
    z-index: 100;
  }

  .toc-progress-track {
    display: none;
  }

  .resource-doc-content {
    max-width: 100%;
  }

  .step-forward-enter-from { transform: translateX(24px) scale(0.98); }
  .step-forward-leave-to { transform: translateX(-24px) scale(0.98); }
  .step-back-enter-from { transform: translateX(-24px) scale(0.98); }
  .step-back-leave-to { transform: translateX(24px) scale(0.98); }

}
</style>
