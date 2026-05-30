<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlanStore } from '@/stores/plan'
import { useActivityStore } from '@/stores/activity'
import type { Activity, ActivityResource, ActivitySubmitResponse } from '@/types'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import MindmapViewer from '@/components/MindmapViewer.vue'
import ResourceNavigator from '@/components/ResourceNavigator.vue'
import type { NavItem } from '@/components/ResourceNavigator.vue'
import { ArrowLeft, Clock, List } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const planStore = usePlanStore()
const actStore = useActivityStore()

const activityId = computed(() => route.params.activityId as string)

// ===== Navigator toggle =====
const navVisible = ref(localStorage.getItem('lt-learn-nav') !== 'false')
const windowWidth = ref(window.innerWidth)
const isMobile = computed(() => windowWidth.value < 768)

function toggleNav() {
  navVisible.value = !navVisible.value
  localStorage.setItem('lt-learn-nav', String(navVisible.value))
}
function onResize() { windowWidth.value = window.innerWidth }

// ===== Activity lookup =====
const activity = ref<Activity | null>(null)
const moduleTitle = ref('')

onMounted(() => {
  window.addEventListener('resize', onResize)
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
  if (!activity.value) {
    ElMessage.error('活动不存在')
    router.push('/path')
    return
  }
  startLearn()
})

// ===== Loaded resource item =====
interface LoadedRes {
  idx: number
  planRef: ActivityResource
  title: string
  content: string
  status: 'loading' | 'ready' | 'viewed' | 'completed' | 'generating'
  qualityScore: number
  sourcesCount: number
  estimatedMin: number
  questions: any[]
  videoUrl: string | null
}

const loadedResources = ref<LoadedRes[]>([])
const activeResIndex = ref(0)
const sectionRefs = ref<Map<number, HTMLElement>>(new Map())

// ===== Quiz state (per quiz resource) =====
const quizAnswers = ref<Record<string, string>>({})
const quizCurrentQ = ref(0)
const quizState = ref<'answering' | 'submitting' | 'result'>('answering')
const quizResult = ref<ActivitySubmitResponse | null>(null)
const activeQuizResIdx = ref(-1)

// ===== Timer & interaction =====
const elapsedSeconds = ref(0)
const interactionDetected = ref(false)
const viewedResIndices = ref<Set<number>>(new Set())
let timer: ReturnType<typeof setInterval> | null = null
let observer: IntersectionObserver | null = null

// ===== Navigator computed =====
const navItems = computed<NavItem[]>(() =>
  loadedResources.value.map(r => ({
    index: r.idx,
    type: r.planRef.resourceType,
    title: r.title || typeLabel(r.planRef.resourceType),
    status: r.status,
  }))
)

const navDoneCount = computed(() =>
  loadedResources.value.filter(r => r.status === 'completed' || r.status === 'viewed').length
)

const remainingMin = computed(() => {
  const total = activity.value?.estimatedMinutes || 25
  const spent = Math.floor(elapsedSeconds.value / 60)
  return Math.max(0, total - spent)
})

// ===== Resource loading =====
const TYPE_ICONS: Record<string, string> = {
  doc: '\uD83D\uDCC4', reading: '\uD83D\uDCD6', mindmap: '\uD83E\uDDE0',
  video: '\uD83C\uDFAC', code: '\uD83D\uDCBB', quiz: '\uD83D\uDCDD',
}
const TYPE_LABELS: Record<string, string> = {
  doc: '文档', reading: '阅读', mindmap: '思维导图', video: '视频', code: '代码', quiz: '测验',
}

function typeIcon(type: string): string { return TYPE_ICONS[type] || '\uD83D\uDCC4' }
function typeLabel(type: string): string { return TYPE_LABELS[type] || type }

async function loadAllResources() {
  if (!activity.value) return
  let resources = activity.value.resources
  // Fallback to deprecated single resource
  if (!resources || resources.length === 0) {
    if (activity.value.resource?.resourcePackId) {
      resources = [activity.value.resource]
    }
  }

  // No resources at all — show fallback content
  if (!resources || resources.length === 0) {
    loadedResources.value = [{
      idx: 0,
      planRef: { source: 'generated' as const, resourcePackId: null, resourceType: 'doc', generationStatus: null },
      title: activity.value.title || '学习内容',
      content: `# ${activity.value.title || '学习内容'}\n\n${activity.value.description || ''}\n\n---\n\n> 暂无学习资源。请返回路径页刷新，或联系管理员。`,
      status: 'ready',
      qualityScore: 0,
      sourcesCount: 0,
      estimatedMin: 0,
      questions: [],
      videoUrl: null,
    }]
    return
  }

  try {

  // Initialize placeholders
  loadedResources.value = resources.map((r, i) => ({
    idx: i,
    planRef: r,
    title: typeLabel(r.resourceType),
    content: '',
    status: 'loading' as const,
    qualityScore: 0,
    sourcesCount: 0,
    estimatedMin: 0,
    questions: [],
    videoUrl: null,
  }))

  // Fetch all packs in parallel
  const fetches = resources.map(async (r, i) => {
    if (!r.resourcePackId) {
      loadedResources.value[i].status = 'generating'
      return
    }
    try {
      const data = await actStore.fetchResourcePack(r.resourcePackId)
      if (!data?.resources) {
        loadedResources.value[i].status = 'ready'
        loadedResources.value[i].title = typeLabel(r.resourceType) + '（空）'
        return
      }
      // Find matching items by type
      const matches = data.resources.filter((item: any) => item.type === r.resourceType)
      if (matches.length === 0) {
        loadedResources.value[i].status = 'ready'
        loadedResources.value[i].title = typeLabel(r.resourceType)
        return
      }
      // Use the first match
      const item = matches[0]
      loadedResources.value[i].title = item.title || typeLabel(r.resourceType)
      loadedResources.value[i].qualityScore = item.qualityScore || item.metadata?.quality_score || 0
      loadedResources.value[i].sourcesCount = item.sourcesCount || item.sources?.length || 0
      loadedResources.value[i].status = 'ready'

      // Extract content by type
      if (r.resourceType === 'video') {
        loadedResources.value[i].videoUrl = extractVideoUrl(item)
      } else if (r.resourceType === 'quiz') {
        loadedResources.value[i].questions = extractQuestions(item)
      } else {
        // doc, reading, mindmap, code → string content
        const c = typeof item.content === 'string' ? item.content : JSON.stringify(item.content)
        loadedResources.value[i].content = (c && c !== '{}') ? c : ''
      }
    } catch {
      loadedResources.value[i].status = 'ready'
      loadedResources.value[i].title = typeLabel(r.resourceType) + '（加载失败）'
    }
  })

  await Promise.allSettled(fetches)
  await nextTick()
  setupSectionObserver()
  } catch (err) {
    console.error('[LearnView] loadAllResources failed:', err)
    // Show fallback on error
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

function extractVideoUrl(item: any): string | null {
  const raw = item.content || item.deepContent || item.brief || ''
  if (!raw) return null
  if (typeof raw === 'string' && /^https?:\/\//.test(raw.trim())) return raw.trim()
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw)
  try {
    const parsed = JSON.parse(text)
    if (parsed?.videoUrl) return parsed.videoUrl
  } catch { /* ignore */ }
  const m = text.match(/"videoUrl"\s*:\s*(https?:\/\/[^"]+)/)
  return m ? m[1] : null
}

function extractQuestions(item: any): any[] {
  if (!item.content) return []
  try {
    const parsed = typeof item.content === 'string' ? JSON.parse(item.content) : item.content
    return parsed?.questions || []
  } catch { return [] }
}

// ===== Section observer =====
function setupSectionObserver() {
  if (observer) observer.disconnect()
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const idx = Number((entry.target as HTMLElement).dataset.resIdx)
          if (!isNaN(idx)) {
            activeResIndex.value = idx
            viewedResIndices.value.add(idx)
            // Mark as viewed
            const res = loadedResources.value[idx]
            if (res && res.status === 'ready') {
              res.status = 'viewed'
            }
          }
        }
      }
    },
    { threshold: 0.4 }
  )
  sectionRefs.value.forEach((el) => observer?.observe(el))
}

function scrollToResource(idx: number) {
  const el = sectionRefs.value.get(idx)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ===== Quiz logic =====
function startQuizForResource(idx: number) {
  activeQuizResIdx.value = idx
  quizState.value = 'answering'
  quizCurrentQ.value = 0
  quizResult.value = null
  // Restore saved answers
  const saved = sessionStorage.getItem(`quiz_${activityId.value}_${idx}`)
  if (saved) {
    try { quizAnswers.value = JSON.parse(saved) } catch { /* ignore */ }
  } else {
    quizAnswers.value = {}
  }
}

const quizQuestions = computed(() => {
  if (activeQuizResIdx.value < 0) return []
  return loadedResources.value[activeQuizResIdx.value]?.questions || []
})

const quizAllAnswered = computed(() =>
  quizQuestions.value.every((q: any) => quizAnswers.value[q.questionId] != null)
)
const quizAnsweredCount = computed(() => Object.keys(quizAnswers.value).length)

function selectAnswer(questionId: string, answer: string) {
  quizAnswers.value[questionId] = answer
  sessionStorage.setItem(
    `quiz_${activityId.value}_${activeQuizResIdx.value}`,
    JSON.stringify(quizAnswers.value)
  )
}

async function handleQuizSubmit() {
  if (!quizAllAnswered.value && quizAnsweredCount.value < quizQuestions.value.length) {
    const confirmed = await ElMessage.confirm(
      `还有 ${quizQuestions.value.length - quizAnsweredCount.value} 题未作答，确定提交？`,
      '提示',
      { confirmButtonText: '确定提交', cancelButtonText: '继续作答', type: 'warning' }
    ).catch(() => false)
    if (!confirmed) return
  }

  quizState.value = 'submitting'
  const submission = Object.entries(quizAnswers.value).map(([questionId, answer]) => ({
    question_id: questionId,
    answer,
  }))

  const res = await planStore.submitActivity(activityId.value, {
    answers: submission,
    duration_seconds: Math.floor((Date.now() - (actStore.learnStartTime || Date.now())) / 1000),
  })

  if (res) {
    quizResult.value = res
    quizState.value = 'result'
    sessionStorage.removeItem(`quiz_${activityId.value}_${activeQuizResIdx.value}`)
    // Mark quiz resource as completed if passed
    if ((res.score || 0) >= (activity.value?.completionCriteria?.threshold || 0.7)) {
      const lr = loadedResources.value[activeQuizResIdx.value]
      if (lr) lr.status = 'completed'
    }
    if (res.autoAction) {
      ElMessage.warning(res.autoAction.reason)
    }
  } else {
    ElMessage.error('提交失败')
    quizState.value = 'answering'
  }
}

// ===== Completion =====
const canComplete = computed(() => {
  if (!activity.value) return false
  const estMin = activity.value.estimatedMinutes || 25
  const timeOk = elapsedSeconds.value >= estMin * 60 * 0.6
  const viewedOk = viewedResIndices.value.size >= loadedResources.value.length
  // Quiz resources must be completed (not just viewed)
  const quizDone = loadedResources.value
    .filter(r => r.planRef.resourceType === 'quiz')
    .every(r => r.status === 'completed')
  return timeOk && viewedOk && quizDone && interactionDetected.value
})

function handleInteraction() {
  interactionDetected.value = true
}

async function handleComplete() {
  const res = await planStore.submitActivity(activityId.value, {
    duration_seconds: elapsedSeconds.value,
    interaction_detected: interactionDetected.value,
  })
  if (res) {
    ElMessage.success('已完成')
    navigateNext()
  }
}

// ===== Timer =====
function startLearn() {
  actStore.learnStartTime = Date.now()
  timer = setInterval(() => {
    elapsedSeconds.value = Math.floor((Date.now() - actStore.learnStartTime) / 1000)
  }, 1000)
  loadAllResources()
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// ===== Navigation =====
function navigateBack() {
  router.push('/path')
}

function navigateNext() {
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

// ===== Resource action labels =====
const RESOURCE_HEADER_COLORS: Record<string, string> = {
  doc: 'rgba(43,111,255,0.08)',
  reading: 'rgba(52,199,89,0.08)',
  mindmap: 'rgba(124,92,252,0.08)',
  video: 'rgba(255,59,48,0.08)',
  code: 'rgba(90,90,114,0.08)',
  quiz: 'rgba(255,140,66,0.08)',
}

const RESOURCE_ACCENT_COLORS: Record<string, string> = {
  doc: '#2B6FFF',
  reading: '#34C759',
  mindmap: '#7C5CFC',
  video: '#FF3B30',
  code: '#5A5A72',
  quiz: '#FF8C42',
}

onUnmounted(() => {
  if (timer) clearInterval(timer)
  if (observer) observer.disconnect()
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <div class="learn-root" @click="handleInteraction" @touchstart="handleInteraction">
    <!-- ===== Top Bar ===== -->
    <div class="learn-topbar">
      <div class="flex items-center gap-4">
        <el-button text @click="navigateBack">
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
      <div class="flex items-center gap-3">
        <el-button
          v-if="loadedResources.length > 1"
          text
          size="small"
          :style="{ color: navVisible ? 'var(--lt-brand)' : 'var(--lt-text-auxiliary)' }"
          title="切换资源导航器"
          @click="toggleNav"
        >
          <el-icon><List /></el-icon>
        </el-button>
        <span
          class="text-sm font-mono"
          :style="{ color: canComplete ? 'var(--lt-success)' : 'var(--lt-text-auxiliary)' }"
        >
          <el-icon><Clock /></el-icon>
          {{ formatTime(elapsedSeconds) }}
        </span>
      </div>
    </div>

    <!-- ===== Content Area ===== -->
    <div class="learn-content">
      <div class="learn-content-inner">
        <!-- Activity header -->
        <div class="activity-header">
          <h1 class="activity-title">{{ activity?.title }}</h1>
          <p v-if="activity?.description" class="activity-desc">{{ activity.description }}</p>
          <div class="activity-meta">
            <span>共 {{ loadedResources.length }} 项学习资源</span>
            <span v-if="activity?.estimatedMinutes">· 预计 {{ activity.estimatedMinutes }} 分钟</span>
          </div>
        </div>

        <!-- Resource sections -->
        <div
          v-for="res in loadedResources"
          :key="res.idx"
          :ref="(el) => { if (el) sectionRefs.set(res.idx, el as HTMLElement) }"
          :data-res-idx="res.idx"
          class="resource-section"
          :class="{ 'is-generating': res.status === 'generating' }"
        >
          <!-- Section header -->
          <div
            class="resource-section-header"
            :style="{ background: RESOURCE_HEADER_COLORS[res.planRef.resourceType] || 'rgba(43,111,255,0.06)' }"
          >
            <div class="flex items-center gap-2">
              <span class="text-lg">{{ typeIcon(res.planRef.resourceType) }}</span>
              <span class="resource-section-title">{{ res.title }}</span>
              <span
                class="resource-type-tag"
                :style="{
                  background: (RESOURCE_ACCENT_COLORS[res.planRef.resourceType] || '#2B6FFF') + '18',
                  color: RESOURCE_ACCENT_COLORS[res.planRef.resourceType] || '#2B6FFF',
                }"
              >{{ typeLabel(res.planRef.resourceType) }}</span>
            </div>
            <div class="flex items-center gap-3">
              <span
                v-if="res.status === 'completed'"
                class="resource-status-dot"
                style="color: var(--lt-success);"
              >✓ 已完成</span>
              <span
                v-else-if="res.status === 'viewed'"
                class="resource-status-dot"
                style="color: var(--lt-brand);"
              >◐ 浏览中</span>
              <span
                v-else-if="res.status === 'ready'"
                class="resource-status-dot"
                style="color: var(--lt-text-auxiliary);"
              >○ 待学习</span>
              <span
                v-else-if="res.status === 'loading'"
                class="resource-status-dot"
                style="color: var(--lt-text-auxiliary);"
              >加载中...</span>
              <span
                v-else-if="res.status === 'generating'"
                class="resource-status-dot"
                style="color: var(--lt-orange);"
              >⚡ 生成中</span>
            </div>
          </div>

          <!-- Section body -->
          <div class="resource-section-body">
            <!-- Generating placeholder -->
            <div v-if="res.status === 'generating'" class="resource-placeholder">
              <p>该资源正在生成中，请稍后刷新页面查看。</p>
            </div>

            <!-- Loading -->
            <div v-else-if="res.status === 'loading'" class="resource-placeholder">
              <p>加载中...</p>
            </div>

            <!-- mindmap -->
            <div v-else-if="res.planRef.resourceType === 'mindmap'" class="resource-mindmap">
              <MindmapViewer
                v-if="res.content"
                :content="res.content"
                :is-json="true"
              />
              <div v-else class="resource-placeholder">思维导图内容为空</div>
            </div>

            <!-- video -->
            <div v-else-if="res.planRef.resourceType === 'video'" class="resource-video">
              <video
                v-if="res.videoUrl"
                :src="res.videoUrl"
                controls
                class="w-full rounded-lg"
                style="max-height: 480px; background: #000;"
              />
              <div v-else class="resource-placeholder">视频 URL 暂不可用</div>
            </div>

            <!-- quiz -->
            <div v-else-if="res.planRef.resourceType === 'quiz'" class="resource-quiz">
              <!-- Not started -->
              <div v-if="activeQuizResIdx !== res.idx" class="text-center py-8">
                <p class="mb-3" style="color: var(--lt-text-secondary);">
                  {{ res.questions.length }} 道题目
                </p>
                <el-button
                  type="primary"
                  :disabled="res.status === 'completed'"
                  @click="startQuizForResource(res.idx); scrollToResource(res.idx)"
                >
                  {{ res.status === 'completed' ? '✓ 已完成' : '开始答题' }}
                </el-button>
              </div>

              <!-- Answering -->
              <div v-else-if="quizState === 'answering'" class="quiz-answering">
                <div class="quiz-progress-bar">
                  <div
                    v-for="(q, qi) in quizQuestions"
                    :key="qi"
                    class="quiz-progress-dot"
                    :class="{
                      'is-current': qi === quizCurrentQ,
                      'is-answered': quizAnswers[q.questionId],
                    }"
                    :style="{
                      background: quizAnswers[q.questionId] ? 'var(--lt-brand)' : qi === quizCurrentQ ? 'var(--lt-border)' : 'transparent',
                      borderColor: qi === quizCurrentQ ? 'var(--lt-brand)' : 'var(--lt-border)',
                    }"
                    @click="quizCurrentQ = qi"
                  >
                    {{ quizAnswers[q.questionId] ? '●' : (qi + 1) }}
                  </div>
                </div>
                <div v-if="quizQuestions[quizCurrentQ]" class="quiz-question-card">
                  <div class="quiz-question-text">
                    {{ quizCurrentQ + 1 }}. {{ quizQuestions[quizCurrentQ].content }}
                  </div>
                  <div v-if="quizQuestions[quizCurrentQ].options" class="quiz-options">
                    <div
                      v-for="(opt, oi) in quizQuestions[quizCurrentQ].options"
                      :key="oi"
                      class="quiz-option"
                      :class="{ 'is-selected': quizAnswers[quizQuestions[quizCurrentQ].questionId] === opt.charAt(0) }"
                      @click="selectAnswer(quizQuestions[quizCurrentQ].questionId, opt.charAt(0))"
                    >
                      <span class="quiz-option-letter">{{ String.fromCharCode(65 + oi) }}</span>
                      <span>{{ opt.replace(/^[A-Z][.、]\s*/, '') }}</span>
                    </div>
                  </div>
                </div>
                <div class="quiz-nav-btns">
                  <el-button size="small" :disabled="quizCurrentQ === 0" @click="quizCurrentQ--">上一题</el-button>
                  <el-button size="small" :disabled="quizCurrentQ >= quizQuestions.length - 1" @click="quizCurrentQ++">下一题</el-button>
                  <div class="flex-1" />
                  <el-button
                    type="primary"
                    :loading="quizState === 'submitting'"
                    @click="handleQuizSubmit"
                  >
                    提交 ({{ quizAnsweredCount }}/{{ quizQuestions.length }})
                  </el-button>
                </div>
              </div>

              <!-- Submitting -->
              <div v-else-if="quizState === 'submitting'" class="resource-placeholder">
                <p>提交中...</p>
              </div>

              <!-- Result -->
              <div v-else-if="quizState === 'result' && quizResult" class="quiz-result">
                <div class="quiz-score-ring"
                  :style="{
                    background: `conic-gradient(${(quizResult.score || 0) >= 0.7 ? 'var(--lt-success)' : 'var(--lt-orange)'} ${Math.round((quizResult.score || 0) * 360)}deg, var(--lt-border) ${Math.round((quizResult.score || 0) * 360)}deg)`,
                  }"
                >
                  <div class="quiz-score-inner">
                    <span class="quiz-score-text">{{ Math.round((quizResult.score || 0) * 100) }}%</span>
                  </div>
                </div>
                <p class="quiz-result-label">
                  {{ (quizResult.score || 0) >= 0.7 ? '达标' : (quizResult.score || 0) >= 0.35 ? '还差一点' : '建议回顾' }}
                </p>
                <div v-if="quizResult.weakTags?.length" class="quiz-weak-tags">
                  <span
                    v-for="tag in quizResult.weakTags"
                    :key="tag"
                    class="quiz-weak-tag"
                  >{{ tag }}</span>
                </div>
              </div>
            </div>

            <!-- doc / reading / code → MarkdownViewer -->
            <div v-else class="resource-markdown">
              <MarkdownViewer
                v-if="res.content"
                :content="res.content"
                :show-toc="res.planRef.resourceType === 'doc' || res.planRef.resourceType === 'reading'"
              />
              <div v-else class="resource-placeholder">暂无内容</div>
            </div>
          </div>

          <!-- Section footer -->
          <div v-if="res.status !== 'loading' && res.status !== 'generating'" class="resource-section-footer">
            <span v-if="res.sourcesCount > 0" class="resource-meta">来源: {{ res.sourcesCount }} 引用</span>
            <span v-if="res.qualityScore > 0" class="resource-meta">质量分: {{ res.qualityScore }}</span>
          </div>
        </div>

        <!-- Bottom sentinel for scroll detection -->
        <div class="h-4" />
      </div>
    </div>

    <!-- ===== Resource Navigator ===== -->
    <ResourceNavigator
      v-if="navVisible && loadedResources.length > 1"
      :items="navItems"
      :active-index="activeResIndex"
      :done-count="navDoneCount"
      :remaining-min="remainingMin"
      :is-mobile="isMobile"
      @select="scrollToResource"
    />

    <!-- ===== Bottom Bar ===== -->
    <div class="learn-bottombar">
      <div class="learn-bottombar-inner">
        <div class="text-sm" :style="{ color: canComplete ? 'var(--lt-success)' : 'var(--lt-text-auxiliary)' }">
          <template v-if="!interactionDetected">点击页面任意位置开始学习</template>
          <template v-else-if="!canComplete">
            已浏览 {{ viewedResIndices.size }}/{{ loadedResources.length }} 项 · 继续学习以完成
          </template>
          <template v-else>✓ 条件满足，可标记完成</template>
        </div>
        <div class="flex gap-2">
          <el-button @click="navigateBack">返回路径</el-button>
          <el-button type="primary" :disabled="!canComplete" @click="handleComplete">
            标记完成
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.learn-root {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Top bar */
.learn-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  border-bottom: 1px solid var(--lt-border);
  background: var(--lt-bg-card);
  flex-shrink: 0;
}

/* Content */
.learn-content {
  flex: 1;
  overflow-y: auto;
  background: var(--lt-bg-page);
}

.learn-content-inner {
  max-width: 860px;
  margin: 0 auto;
  padding: 32px 24px 24px;
}

/* Activity header */
.activity-header {
  margin-bottom: 32px;
}

.activity-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--lt-text-primary);
  margin: 0 0 8px 0;
}

.activity-desc {
  color: var(--lt-text-auxiliary);
  margin: 0 0 8px 0;
  font-size: 14px;
}

.activity-meta {
  font-size: 13px;
  color: var(--lt-text-auxiliary);
}

/* Resource section */
.resource-section {
  margin-bottom: 40px;
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-lg);
  overflow: hidden;
}

.resource-section.is-generating {
  opacity: 0.6;
}

.resource-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--lt-border);
}

.resource-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--lt-text-primary);
}

.resource-type-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--lt-radius-sm);
  font-weight: 500;
  letter-spacing: 0.3px;
}

.resource-status-dot {
  font-size: 12px;
  font-weight: 500;
}

.resource-section-body {
  padding: 16px;
}

.resource-section-footer {
  padding: 8px 16px;
  border-top: 1px solid var(--lt-border);
  display: flex;
  gap: 16px;
}

.resource-meta {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
}

.resource-placeholder {
  text-align: center;
  padding: 32px 16px;
  color: var(--lt-text-auxiliary);
  font-size: 14px;
}

.resource-mindmap {
  min-height: 400px;
}

.resource-video {
  /* video element styling inline */
}

/* Quiz */
.quiz-progress-bar {
  display: flex;
  gap: 6px;
  justify-content: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.quiz-progress-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  cursor: pointer;
  border: 2px solid var(--lt-border);
  color: var(--lt-text-auxiliary);
  transition: all 0.15s;
  font-weight: 500;
}

.quiz-progress-dot.is-current {
  font-weight: 700;
}

.quiz-progress-dot.is-answered {
  color: #fff;
}

.quiz-question-card {
  background: var(--lt-bg-page);
  border-radius: var(--lt-radius-md);
  padding: 20px;
  margin-bottom: 16px;
}

.quiz-question-text {
  font-size: 16px;
  font-weight: 500;
  color: var(--lt-text-primary);
  margin-bottom: 16px;
}

.quiz-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.quiz-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--lt-radius-md);
  border: 1.5px solid var(--lt-border);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 14px;
  color: var(--lt-text-primary);
}

.quiz-option:hover {
  border-color: var(--lt-brand-light);
}

.quiz-option.is-selected {
  border-color: var(--lt-brand);
  background: var(--lt-brand-lightest);
}

.quiz-option-letter {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  border: 1.5px solid var(--lt-border);
  flex-shrink: 0;
  color: var(--lt-text-secondary);
}

.quiz-option.is-selected .quiz-option-letter {
  border-color: var(--lt-brand);
  background: var(--lt-brand);
  color: #fff;
}

.quiz-nav-btns {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Quiz result */
.quiz-result {
  text-align: center;
  padding: 16px 0;
}

.quiz-score-ring {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.quiz-score-inner {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--lt-bg-card);
  display: flex;
  align-items: center;
  justify-content: center;
}

.quiz-score-text {
  font-size: 22px;
  font-weight: 700;
  color: var(--lt-text-primary);
}

.quiz-result-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--lt-text-primary);
  margin-bottom: 8px;
}

.quiz-weak-tags {
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 8px;
}

.quiz-weak-tag {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: var(--lt-radius-full);
  background: var(--lt-orange-light-9);
  color: var(--lt-orange-text);
}

/* Bottom bar */
.learn-bottombar {
  flex-shrink: 0;
  border-top: 1px solid var(--lt-border);
  background: var(--lt-bg-card);
  padding: 12px 24px;
}

.learn-bottombar-inner {
  max-width: 860px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
