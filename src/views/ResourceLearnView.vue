<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProfileStore } from '@/stores/profile'
import { useNoteStore } from '@/stores/note'
import { useNotebookStore } from '@/stores/notebook'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import MindmapViewer from '@/components/MindmapViewer.vue'
import CodeLearningViewer from '@/components/code/CodeLearningViewer.vue'
import ResourceNavigator from '@/components/ResourceNavigator.vue'
import StepCompleteZone from '@/components/learn/StepCompleteZone.vue'
import ActivityCelebration from '@/components/learn/ActivityCelebration.vue'
import QuizPreview from '@/components/QuizPreview.vue'
import type { NavItem } from '@/components/ResourceNavigator.vue'
import { ArrowLeft, Clock, List, EditPen } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { extractVideoUrl } from '@/utils/media'
import { apiFetch } from '@/utils/api'
import FloatingFab from '@/components/tutoring/FloatingFab.vue'
import TutoringDrawer from '@/components/tutoring/TutoringDrawer.vue'
import NoteSidebar from '@/components/notes/NoteSidebar.vue'

const route = useRoute()
const router = useRouter()
const profileStore = useProfileStore()
const noteStore = useNoteStore()
const notebookStore = useNotebookStore()

const packId = computed(() => route.params.packId as string)

// ===== Tutoring entry =====
const showTutoringDrawer = ref(false)
const selectedText = ref('')
const showAskAiButton = ref(false)
const showNoteButton = ref(false)
const askAiPosition = ref({ x: 0, y: 0 })
const noteContextSection = ref('')

function onResourceMouseUp() {
  const resType = currentResource.value?.type
  if (resType !== 'doc' && resType !== 'reading') return

  const selection = window.getSelection()
  const text = selection?.toString().trim()
  if (text && text.length > 0) {
    selectedText.value = text
    const range = selection!.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    askAiPosition.value = {
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    }
    showAskAiButton.value = true
    showNoteButton.value = true
  } else {
    showAskAiButton.value = false
    showNoteButton.value = false
  }
}

function handleAskAi() {
  showAskAiButton.value = false
  showNoteButton.value = false
  showTutoringDrawer.value = true
}

function handleFabClick() {
  if (!showTutoringDrawer.value) {
    selectedText.value = ''
  }
  showTutoringDrawer.value = !showTutoringDrawer.value
}

function handleTutoringClose() {
  showTutoringDrawer.value = false
  selectedText.value = ''
}

function handleAddNote() {
  showNoteButton.value = false
  showAskAiButton.value = false
  noteContextSection.value = captureSectionTitle()
  noteStore.openSidebar()
}

function captureSectionTitle(): string {
  const container = document.querySelector('.learn-content')
  if (!container) return ''
  const containerRect = container.getBoundingClientRect()
  const topThreshold = containerRect.top + 80
  const headings = container.querySelectorAll('h1, h2, h3, h4')
  if (headings.length === 0) return ''
  let current = ''
  for (const h of headings) {
    const rect = h.getBoundingClientRect()
    if (rect.top <= topThreshold + 20) {
      current = h.textContent?.trim() || ''
    } else {
      break
    }
  }
  return current
}

function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key !== 'n' && e.key !== 'N') return
  const tag = e.target as HTMLElement
  if (tag.tagName === 'INPUT' || tag.tagName === 'TEXTAREA' || tag.isContentEditable) return
  e.preventDefault()
  noteStore.toggleSidebar()
}

function onDocumentClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.selection-toolbar') && !target.closest('.ask-ai-btn')) {
    showAskAiButton.value = false
    showNoteButton.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onGlobalKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onGlobalKeydown)
})

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
  const type = currentResource.value?.type
  return type === 'doc' || type === 'reading'
})

interface TocHeading {
  id: string
  text: string
  level: number
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .trim()
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
      const text = stripInlineMarkdown(match[2])
      const id = text.replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '')
      result.push({ id, text, level })
    }
  }
  return result
})

const tocActiveId = ref('')
const tocScrollPercent = ref(0)
const collapsedSections = ref<Set<string>>(new Set())

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

const visibleTocHeadings = computed<TocHeading[]>(() => {
  const headings = tocHeadings.value
  if (headings.length === 0) return []
  const result: TocHeading[] = []
  let skipParentLevel = -1
  for (const heading of headings) {
    if (skipParentLevel !== -1 && heading.level > skipParentLevel) continue
    skipParentLevel = -1
    if (collapsedSections.value.has(heading.id)) {
      skipParentLevel = heading.level
    }
    result.push(heading)
  }
  return result
})

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

// ===== Pack metadata =====
const packTopic = ref('')
const packEstimatedMin = ref(25)

// ===== Loaded resource item =====
interface LoadedRes {
  idx: number
  id: string
  type: string
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

// ===== Step state =====
type ResourceStepState = 'pending' | 'active' | 'completing' | 'completed'
const resourceStepState = ref<Map<number, ResourceStepState>>(new Map())
const resourceTimeSpent = ref<Map<number, number>>(new Map())
let currentResourceStartTime: number = 0

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
const liveResourceTime = ref(0)
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
  if (!res || res.type !== 'video') return
  try {
    const resp = await apiFetch<any>(`/resource-packs/${packId.value}`)
    if (resp.data?.resources) {
      const match = resp.data.resources.find((item: any) => item.type === 'video')
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

const noteSectionOrder = computed(() =>
  tocHeadings.value.map(h => h.text)
)

const completedCount = computed(() => {
  let count = 0
  resourceStepState.value.forEach(state => { if (state === 'completed') count++ })
  return count
})

const stepZoneVisible = computed(() => {
  const state = resourceStepState.value.get(activeResIndex.value)
  return state === 'completing' || state === 'completed'
})

const navItems = computed<NavItem[]>(() =>
  loadedResources.value.map(r => ({
    index: r.idx,
    type: r.type,
    title: r.title || typeLabel(r.type),
    status: resourceStepState.value.get(r.idx) || 'pending',
    estimatedMin: r.estimatedMin || undefined,
  }))
)

const remainingMin = computed(() => {
  const total = packEstimatedMin.value
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
  doc: '#2B6FF', reading: '#34C759', mindmap: '#7C5CFC',
  video: '#FF3B30', code: '#5A5A72', quiz: '#FF8C42',
}

function typeIcon(type: string): string { return TYPE_ICONS[type] || '\uD83D\uDCC4' }
function typeLabel(type: string): string { return TYPE_LABELS[type] || type }

// ===== Resource loading =====
async function loadResources() {
  loadedResources.value = []
  resourceStepState.value = new Map()
  resourceTimeSpent.value = new Map()
  activeResIndex.value = 0
  liveResourceTime.value = 0

  try {
    const resp = await apiFetch<any>(`/resource-packs/${packId.value}`)
    const data = resp.data
    if (!data || !data.resources || data.resources.length === 0) {
      ElMessage.error('资源包为空或不存在')
      router.push('/library')
      return
    }

    packTopic.value = data.topic || '学习资源'
    packEstimatedMin.value = data.resources.length * 10

    loadedResources.value = data.resources.map((item: any, i: number) => {
      const estimatedMin = 10
      const questions = item.type === 'quiz' ? extractQuestions(item) : []
      const videoUrl = item.type === 'video' ? extractVideoUrl(item) : null
      const content = extractContent(item)

      return {
        idx: i,
        id: item.id || `res_${i}`,
        type: item.type || 'doc',
        title: item.title || typeLabel(item.type || 'doc'),
        content,
        status: 'ready' as const,
        qualityScore: item.qualityScore || item.metadata?.quality_score || 0,
        sourcesCount: item.sourcesCount || item.sources?.length || 0,
        estimatedMin,
        questions,
        videoUrl,
      }
    })

    // 如果第一个资源是视频且没有 URL，开始轮询
    if (currentResource.value?.type === 'video' && !currentResource.value?.videoUrl) {
      startVideoPolling()
    }
  } catch (err) {
    console.error('[ResourceLearnView] loadResources failed:', err)
    ElMessage.error('加载资源失败，请返回重试')
  }
}

function extractContent(item: any): string {
  if (!item.content) return ''
  const c = typeof item.content === 'string' ? item.content : JSON.stringify(item.content)
  return (c && c !== '{}') ? c : ''
}

function extractQuestions(item: any): any[] {
  if (!item.content) return []
  try {
    const parsed = typeof item.content === 'string' ? JSON.parse(item.content) : item.content
    return parsed?.questions || []
  } catch { return [] }
}

// ===== Resource navigation =====
async function goToResource(idx: number) {
  if (idx === activeResIndex.value) return
  if (shortContentTimer) { clearTimeout(shortContentTimer); shortContentTimer = null }
  if (shortContentInterval) { clearInterval(shortContentInterval); shortContentInterval = null }
  shortContentCountdown.value = 0
  stopVideoPolling()
  transitionGuard.value = true
  transitionMode.value = idx > activeResIndex.value ? 'step-forward' : 'step-back'
  recordTimeSpent()
  saveState()
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
    checkShortContent()
  })
  if (currentResource.value?.type === 'video' && !currentResource.value?.videoUrl) {
    startVideoPolling()
  }
}

async function advanceToNext() {
  if (shortContentTimer) { clearTimeout(shortContentTimer); shortContentTimer = null }
  recordTimeSpent()
  resourceStepState.value.set(activeResIndex.value, 'completed')
  saveState()

  let next = activeResIndex.value + 1
  while (next < loadedResources.value.length) {
    if (resourceStepState.value.get(next) !== 'completed') break
    next++
  }

  if (next >= loadedResources.value.length) {
    celebrationVisible.value = true
    clearState()
    clearTimers()
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
    checkShortContent()
  })

  if (currentResource.value?.type === 'video' && !currentResource.value?.videoUrl) {
    startVideoPolling()
  }
}

// ===== Completion detection =====
function recordTimeSpent() {
  const idx = activeResIndex.value
  if (currentResourceStartTime <= 0) return
  const existing = resourceTimeSpent.value.get(idx) || 0
  const elapsed = Math.floor((Date.now() - currentResourceStartTime) / 1000)
  if (elapsed <= 0) return
  resourceTimeSpent.value.set(idx, existing + elapsed)
  currentResourceStartTime = Date.now()
}

function onContentScroll(event: Event) {
  const target = event.target as HTMLElement
  if (!target) return
  const scrollBottom = target.scrollTop + target.clientHeight
  const scrollHeight = target.scrollHeight
  contentScrollProgress.value = Math.min(scrollBottom / scrollHeight, 1)

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

  const type = res.type
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

// ===== Quiz completion =====
function onQuizDone() {
  recordTimeSpent()
  resourceStepState.value.set(activeResIndex.value, 'completing')
}

// ===== Step complete callbacks =====
function onStepContinue() { advanceToNext() }
function onStepReview() { advanceToNext() }

// ===== Timer =====
let learnStartTime: number = 0

function startLearn() {
  learnStartTime = Date.now()
  timer = setInterval(() => {
    elapsedSeconds.value = Math.floor((Date.now() - learnStartTime) / 1000)
    const base = resourceTimeSpent.value.get(activeResIndex.value) || 0
    const session = currentResourceStartTime > 0 ? Math.floor((Date.now() - currentResourceStartTime) / 1000) : 0
    liveResourceTime.value = base + session
  }, 1000)
}

function clearTimers() {
  if (timer) { clearInterval(timer); timer = null }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// ===== Navigation =====
function onNavigatorSelect(idx: number) { goToResource(idx) }

function scrollContentToTop() {
  const el = document.querySelector('.learn-content')
  if (el) el.scrollTop = 0
}

function goBack() {
  clearState()
  router.push('/library')
}

// ===== Learning state persistence (localStorage only) =====
function stateKey() { return `lt-resource-learn-${packId.value}` }

function saveState() {
  if (!packId.value) return
  recordTimeSpent()
  const data = {
    packId: packId.value,
    activeResIndex: activeResIndex.value,
    elapsedSeconds: elapsedSeconds.value,
    resourceStepState: Array.from(resourceStepState.value.entries()),
    resourceTimeSpent: Array.from(resourceTimeSpent.value.entries()),
  }
  try {
    sessionStorage.setItem(stateKey(), JSON.stringify(data))
    localStorage.setItem(stateKey(), JSON.stringify(data))
  } catch { /* storage full */ }
}

function restoreState(): boolean {
  let raw = sessionStorage.getItem(stateKey())
  if (!raw) {
    try { raw = localStorage.getItem(stateKey()) } catch { /* ignore */ }
  }
  if (!raw) return false
  try {
    const data = JSON.parse(raw)
    if (data.packId !== packId.value) {
      sessionStorage.removeItem(stateKey())
      try { localStorage.removeItem(stateKey()) } catch { /* ignore */ }
      return false
    }
    activeResIndex.value = data.activeResIndex
    elapsedSeconds.value = data.elapsedSeconds
    resourceStepState.value = new Map(data.resourceStepState)
    resourceTimeSpent.value = new Map(data.resourceTimeSpent)
    return true
  } catch {
    sessionStorage.removeItem(stateKey())
    try { localStorage.removeItem(stateKey()) } catch { /* ignore */ }
    return false
  }
}

function clearState() {
  sessionStorage.removeItem(stateKey())
  try { localStorage.removeItem(stateKey()) } catch { /* ignore */ }
}

// ===== Lifecycle =====
onMounted(async () => {
  window.addEventListener('resize', onResize)
  await loadResources()

  noteStore.resetNotes()

  const restored = restoreState()
  if (!restored) {
    activeResIndex.value = 0
    for (let i = 0; i < loadedResources.value.length; i++) {
      resourceStepState.value.set(i, i === 0 ? 'active' : 'pending')
    }
  }

  currentResourceStartTime = Date.now()
  startLearn()

  if (currentResource.value?.type === 'video' && !currentResource.value?.videoUrl) {
    startVideoPolling()
  }
  nextTick(() => {
    checkShortContent()
    if (showToc.value) setupTocObserver()
    notebookStore.ensureLoaded(profileStore.activeCourseId)
  })
})

onUnmounted(() => {
  saveState()
  stopVideoPolling()
  cleanupTocObserver()
  clearTimers()
  window.removeEventListener('resize', onResize)
  noteStore.resetNotes()
  noteStore.closeSidebar()
  notebookStore.reset()
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
        <el-button text @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回资源库
        </el-button>
        <div class="flex items-center gap-2 text-sm" style="color: var(--lt-text-secondary);">
          <span style="color: var(--lt-text-primary); font-weight: 500;">{{ packTopic }}</span>
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
        <el-button
          text size="small"
          :style="{ color: noteStore.sidebarOpen ? 'var(--lt-orange)' : 'var(--lt-text-auxiliary)' }"
          title="笔记本"
          @click="noteStore.toggleSidebar()"
        >
          <el-icon><EditPen /></el-icon>
          笔记
          <span v-if="noteStore.availableCount" class="topbar-badge">{{ noteStore.availableCount }}</span>
        </el-button>
        <span class="text-sm font-mono" style="color: var(--lt-text-auxiliary);">
          <el-icon><Clock /></el-icon>
          {{ formatTime(liveResourceTime) }}
        </span>
      </div>
    </div>

    <!-- TOC Toggle Button -->
    <div v-if="showToc" class="toc-bar">
      <button class="toc-floating-btn" @click="toggleToc" title="展开目录">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span>目录</span>
      </button>
    </div>

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
            <div v-if="currentResource.type !== 'quiz'" class="resource-immersive-header">
              <h2 class="resource-immersive-title">{{ currentResource.title }}</h2>
              <div class="resource-immersive-info">
                <span class="resource-immersive-type"
                  :style="{ color: RESOURCE_ACCENT_COLORS[currentResource.type] || '#2B6FFF' }"
                >{{ typeIcon(currentResource.type) }} {{ typeLabel(currentResource.type) }}</span>
                <span v-if="currentResource.estimatedMin" class="resource-immersive-duration">· 约{{ currentResource.estimatedMin }}分钟</span>
                <span class="resource-immersive-duration">· 已学 {{ formatTime(liveResourceTime) }}</span>
              </div>
              <div class="resource-immersive-divider"></div>
            </div>

            <!-- Resource Body -->
            <div class="resource-section-body">
              <!-- mindmap -->
              <div v-if="currentResource.type === 'mindmap'" class="resource-mindmap">
                <MindmapViewer
                  v-if="currentResource.content"
                  :content="currentResource.content"
                  :is-json="true"
                />
                <div v-else class="resource-placeholder">思维导图内容为空</div>
              </div>

              <!-- video -->
              <div v-else-if="currentResource.type === 'video'" class="resource-video">
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
              <div v-else-if="currentResource.type === 'quiz'">
                <QuizPreview
                  :content="currentResource.content"
                  :quality-score="currentResource.qualityScore"
                />
                <div class="quiz-done-hint">
                  <el-button type="primary" plain @click="onQuizDone">
                    完成测验
                  </el-button>
                </div>
              </div>

              <!-- code -->
              <template v-else-if="currentResource.type === 'code' && currentResource.content">
                <CodeLearningViewer
                  :content="currentResource.content"
                  :title="currentResource.title || ''"
                  :quality-score="currentResource.qualityScore"
                  :sources-count="currentResource.sourcesCount"
                />
              </template>

              <!-- doc / reading with TOC sidebar -->
              <div v-else class="resource-doc-layout" @mouseup="onResourceMouseUp">
                <!-- TOC sidebar -->
                <Transition name="toc-slide">
                  <div v-if="showToc && !tocCollapsed && tocHeadings.length > 0" class="toc-sidebar-immersive">
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
          :estimated-minutes="packEstimatedMin"
          :has-next-activity="false"
          @back-to-path="goBack"
          @next-activity="goBack"
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

    <!-- Selection toolbar -->
    <div
      v-if="showAskAiButton || showNoteButton"
      class="selection-toolbar"
      :style="{ left: askAiPosition.x + 'px', top: askAiPosition.y + 'px' }"
    >
      <button class="st-btn" @click.stop="handleAskAi">💬 问 AI</button>
      <button class="st-btn st-btn-note" @click.stop="handleAddNote">📝 记笔记</button>
    </div>

    <!-- Tutoring drawer -->
    <TutoringDrawer
      :visible="showTutoringDrawer"
      :initial-question="selectedText"
      :course-id="profileStore.activeCourseId"
      @close="handleTutoringClose"
    />

    <!-- Floating FAB -->
    <FloatingFab @click="handleFabClick" />

    <!-- Note Sidebar -->
    <NoteSidebar
      :course-id="profileStore.activeCourseId"
      :resource-pack-id="packId"
      :resource-title="currentResource?.title"
      :section-title="noteContextSection"
      :section-order="noteSectionOrder"
    />
  </div>
</template>

<style scoped>
/* Selection toolbar */
.selection-toolbar {
  position: fixed;
  transform: translate(-50%, -100%);
  display: flex;
  gap: 4px;
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  z-index: 200;
}
.st-btn {
  padding: 5px 12px;
  font-size: 13px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  font-weight: 500;
  background: var(--lt-bg-page);
  color: var(--lt-text-primary);
}
.st-btn:hover { background: var(--lt-brand-lightest); }
.st-btn-note { color: var(--lt-orange); }
.st-btn-note:hover { background: #fff5e6; }

.topbar-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 10px;
  font-weight: 700;
  border-radius: 8px;
  background: var(--lt-orange);
  color: #fff;
  line-height: 1;
}

.learn-root {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  isolation: isolate;
}

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

.resource-immersive-header { margin-bottom: 24px; }
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
.resource-immersive-type { font-weight: 600; }
.resource-immersive-divider {
  height: 1px;
  background: var(--lt-border);
  margin-top: 16px;
}

.resource-step { transition: opacity 0.3s ease; }
.resource-section-body { padding: 0; }
.resource-placeholder {
  text-align: center;
  padding: 40px 20px;
  color: var(--lt-text-auxiliary);
  font-size: 14px;
}

.quiz-done-hint {
  text-align: center;
  margin-top: 24px;
  padding: 16px;
}

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
.sct-ring { width: 20px; height: 20px; flex-shrink: 0; }
.sct-ring-progress { transition: stroke-dashoffset 1s linear; }

.resource-mindmap { min-height: 400px; }

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

.resource-doc-layout { position: relative; }
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
.toc-progress-track {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--lt-border);
  z-index: 1;
}
.toc-progress-fill {
  position: absolute;
  top: 0; left: 0;
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
.toc-sidebar-immersive:hover .toc-progress-label { opacity: 1; }
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
.toc-sidebar-close:hover { color: var(--lt-text-primary); }
.toc-sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}
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
.toc-item.toc-level-1 { padding-left: 20px; font-weight: 600; font-size: 13px; }
.toc-item.toc-level-1::before { left: 6px; width: 3px; border-radius: 2px; }
.toc-item.toc-level-2 { padding-left: 32px; font-weight: 500; }
.toc-item.toc-level-2::before { left: 20px; width: 2px; }
.toc-item.toc-level-3 { padding-left: 44px; font-size: 11px; }
.toc-item.toc-level-3::before { left: 32px; width: 2px; border-style: dashed; }
.toc-item.toc-level-4 { padding-left: 56px; font-size: 11px; color: var(--lt-text-auxiliary); }
.toc-item.toc-level-4::before { display: none; }
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
.toc-arrow:hover { color: var(--lt-brand); }
.toc-arrow--collapsed { transform: rotate(0deg); }
.toc-arrow:not(.toc-arrow--collapsed) { transform: rotate(90deg); }
.toc-item-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
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
.toc-back-top-icon { font-size: 14px; font-weight: 700; }

.toc-slide-enter-active { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
.toc-slide-leave-active { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.toc-slide-enter-from { opacity: 0; transform: translateX(-16px); }
.toc-slide-leave-to { opacity: 0; transform: translateX(-16px); }

.step-forward-enter-active,
.step-forward-leave-active,
.step-back-enter-active,
.step-back-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.step-forward-enter-from { opacity: 0; transform: translateX(48px) scale(0.98); }
.step-forward-leave-to { opacity: 0; transform: translateX(-48px) scale(0.98); }
.step-back-enter-from { opacity: 0; transform: translateX(-48px) scale(0.98); }
.step-back-leave-to { opacity: 0; transform: translateX(48px) scale(0.98); }

@media (max-width: 767px) {
  .learn-orb--tl { top: -200px; left: -120px; width: 320px; height: 320px; }
  .learn-orb--br { bottom: -140px; right: -100px; width: 280px; height: 280px; }
  .learn-topbar { padding: 10px 16px; }
  .learn-topbar-progress { gap: 0; }
  .ltp-track { display: none; }
  .learn-content-inner { max-width: 100%; padding: 20px 16px 20px; }
  .resource-immersive-title { font-size: 18px; }
  .resource-section-body { padding: 0; }
  .toc-bar { padding: 0 16px; margin-top: 6px; }
  .toc-sidebar-immersive {
    position: fixed;
    left: 0; top: 0; bottom: 0;
    width: 280px;
    max-height: 100vh;
    border-radius: 0;
    z-index: 100;
  }
  .toc-progress-track { display: none; }
  .resource-doc-content { max-width: 100%; }
  .step-forward-enter-from { transform: translateX(24px) scale(0.98); }
  .step-forward-leave-to { transform: translateX(-24px) scale(0.98); }
  .step-back-enter-from { transform: translateX(-24px) scale(0.98); }
  .step-back-leave-to { transform: translateX(24px) scale(0.98); }
}
</style>
