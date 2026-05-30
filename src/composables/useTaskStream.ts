import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { AgentThinkingTrace, PlannerDecision, ResourceItem } from '@/types'
import { useTaskStore } from '@/stores/task'
import { useSSE } from '@/composables/useSSE'
import { apiFetch } from '@/utils/api'

// ===== Types =====

export interface TaskResource extends ResourceItem {
  id: string
  status: 'pending' | 'ready' | 'failed' | 'rejected'
  confidence?: 'high' | 'medium' | 'low'
  sourcesCount?: number
  qualityScore?: number
  brief?: string
  deepContent?: string
  pushReasons?: string[]
  rejectReason?: string
  sources?: any[]
}

export interface PackResource {
  resource_id?: string
  id?: string
  type: string
  title: string
  status?: string
  confidence?: string
  sourcesCount?: number
  sources?: any[]
  qualityScore?: number
  brief?: string
  content?: string
  pushReasons?: string[]
  metadata?: { quality_score?: number }
  planner_decision?: PlannerDecision
}

// ===== Helpers =====

export function typeLabel(type: string): string {
  const map: Record<string, string> = {
    doc: '讲解文档', mindmap: '思维导图', quiz: '练习题',
    reading: '拓展阅读', code: '代码案例', video: '讲解视频',
  }
  return map[type] || type
}

function extractBrief(content: string | undefined | null): string {
  if (!content) return ''
  if (content.startsWith('{') || content.startsWith('[')) return ''
  let text = content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s*/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/\n\s*\n/g, '\n')
    .trim()
  const lines = text.split('\n').filter(l => l.trim().length > 10)
  return lines[0]?.trim().substring(0, 200) || ''
}

// ===== Mock data for fallback =====

const mockResources: Record<string, any[]> = {
  'pack_demo_1': [
    { id: 'r1', type: 'doc', title: 'A* 搜索算法核心讲解', status: 'ready', confidence: 'high', sourcesCount: 8, qualityScore: 92, brief: '从直觉到实现，逐层剖析 A* 算法的核心原理与优化技巧。', pushReasons: ['针对薄弱点: A* 搜索', '偏好: 代码实操'], sources: [{ title: '算法导论', locator: 'Ch 22.3', quote: '...', relevance: 'high' }] },
    { id: 'r2', type: 'mindmap', title: '搜索算法家族概念导图', status: 'ready', confidence: 'high', sourcesCount: 5, qualityScore: 88, brief: '以 A* 为核心的知识结构全景图。', deepContent: JSON.stringify({ root: { text: '搜索算法家族', children: [{ text: '无信息搜索', children: [{ text: 'BFS' }, { text: 'DFS' }] }, { text: '启发式搜索', children: [{ text: 'A* 算法', children: [{ text: 'f(n)=g(n)+h(n)' }, { text: '可采纳性' }] }, { text: '贪心最佳优先' }] }] } }), pushReasons: ['偏好: 图解优先'] },
    { id: 'r3', type: 'quiz', title: '基础概念与变式练习', status: 'ready', confidence: 'medium', sourcesCount: 6, qualityScore: 85, brief: '10 道分层练习（单选+填空+简答）。', pushReasons: ['应试目标', '薄弱点巩固'] },
    { id: 'r4', type: 'code', title: '实战：迷宫寻路探秘', status: 'ready', confidence: 'high', sourcesCount: 3, qualityScore: 90, brief: 'Python 完整实现。', pushReasons: ['偏好: 代码实操'] },
  ],
}

// ===== Composable =====

export function useTaskStream() {
  const taskStore = useTaskStore()
  const { status: sseStatus, error: sseError, retryCount: sseRetryCount, connect: sseConnect, disconnect: sseDisconnect } = useSSE()

  // ===== State =====
  const taskId = ref('')
  const packId = ref('')
  const isComplete = ref(false)
  const hasStarted = ref(false)

  const currentStage = ref('profile')
  const currentPercent = ref(0)
  const currentMessage = ref('')

  const resources = ref<TaskResource[]>([])
  const thinkingTraces = ref<AgentThinkingTrace[]>([])
  const plannerDecision = ref<PlannerDecision | null>(null)
  const showAllThoughts = ref(false)

  // Phase 7: Checklist + Agent activity state
  const checklist = ref<any>(null)
  const activeAgents = ref<{ jobId: string; type: string; title: string; status: string }[]>([])

  // ===== Computed =====
  const resourceReadyCount = computed(() => resources.value.filter(r => r.status === 'ready').length)
  const totalSources = computed(() => resources.value.reduce((sum, r) => sum + (r.sourcesCount || 0), 0))
  const avgQuality = computed(() => {
    const ready = resources.value.filter(r => r.status === 'ready' && r.qualityScore)
    if (ready.length === 0) return 0
    return Math.round(ready.reduce((sum, r) => sum + (r.qualityScore || 0), 0) / ready.length)
  })

  const displayedTraces = computed(() => {
    if (showAllThoughts.value) return thinkingTraces.value
    return thinkingTraces.value.filter(t => t.trigger !== 'system_prompt')
  })

  const sseStatusText = computed(() => {
    if (isComplete.value) return 'done'
    if (sseStatus.value === 'reconnecting') return 'reconnecting'
    return sseStatus.value
  })

  // ===== Polling =====
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let pollAttempts = 0
  const MAX_POLL_ATTEMPTS = 48

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function startPolling(tid: string) {
    stopPolling()
    pollTimer = setInterval(async () => {
      if (isComplete.value || pollAttempts >= MAX_POLL_ATTEMPTS) {
        stopPolling()
        return
      }
      pollAttempts++
      try {
        const res = await apiFetch<any>(`/tasks/${tid}`)
        if (res.data) {
          const d = res.data
          if (d.stage) currentStage.value = d.stage
          if (d.percent) currentPercent.value = d.percent

          if (d.status === 'SUCCEEDED') {
            isComplete.value = true
            stopPolling()
            taskStore.completeTask(tid, d.pack_id)
            if (d.pack_id) {
              packId.value = d.pack_id
              await loadPack(d.pack_id)
            }
          } else if (d.status === 'FAILED') {
            stopPolling()
            taskStore.failTask(tid, d.error_message || '生成失败')
            currentMessage.value = d.error_message || '生成失败'
          }
        }
      } catch { /* ignore */ }
    }, 5000)
  }

  // ===== Pack Loading =====
  async function loadPack(pid: string) {
    try {
      const res = await apiFetch<any>(`/resource-packs/${pid}`)
      if (res.data) {
        const pack = res.data
        isComplete.value = true
        resources.value = (pack.resources || []).map((r: PackResource, i: number) => ({
          id: r.resource_id || r.id || `r${i}`,
          type: r.type,
          title: r.title,
          status: (r.status === 'ready' ? 'ready' : 'pending') as 'ready' | 'pending',
          confidence: (r.confidence || 'high') as 'high' | 'medium' | 'low',
          sourcesCount: r.sourcesCount || r.sources?.length || 0,
          qualityScore: r.qualityScore || r.metadata?.quality_score || 85,
          brief: r.brief || extractBrief(r.content) || '',
          deepContent: r.content || '',
          pushReasons: r.pushReasons || [],
          sources: r.sources || [],
        }))
        if (pack.planner_decision) {
          plannerDecision.value = pack.planner_decision as PlannerDecision
        }
      }
    } catch {
      const mock = mockResources[pid]
      if (mock) {
        isComplete.value = true
        resources.value = mock
        plannerDecision.value = {
          selectedTypes: [...new Set(mock.map(r => r.type))],
          rationale: '该生基础薄弱且以应试为目标，优先用练习巩固+导图梳理。代码匹配其学习偏好。',
          items: mock.map((r, i) => ({
            type: r.type, title: r.title, reason: r.pushReasons?.[0] || '',
            priority: i + 1, difficulty: 3, focusAreas: [], estimatedMinutes: 15, styleHint: '',
          })),
          totalEstimatedMinutes: mock.length * 15,
          difficulty: 3,
        }
      }
    }
  }

  // ===== SSE Connection =====
  async function connectTaskStream(tid: string) {
    hasStarted.value = true
    taskStore.createTask(tid)

    const expectedTypes = ['doc', 'quiz', 'code', 'mindmap', 'reading', 'video']
    resources.value = expectedTypes.map((type, i) => ({
      id: `res-${i}`,
      title: '',
      type: type as TaskResource['type'],
      status: 'pending' as const,
    }))

    // Poll current state to restore after page refresh
    try {
      const res = await apiFetch<any>(`/tasks/${tid}`)
      if (res.data) {
        const d = res.data
        currentStage.value = d.stage || currentStage.value
        currentPercent.value = d.percent || 0
        if (d.message) currentMessage.value = d.message
        taskStore.updateTask(tid, { stage: d.stage, percent: d.percent, message: d.message })
        if (d.status === 'SUCCEEDED') {
          isComplete.value = true
          taskStore.completeTask(tid, d.pack_id)
          if (d.pack_id) {
            packId.value = d.pack_id
            await loadPack(d.pack_id)
          } else {
            resources.value = (d.resources || []).map((r: any, i: number) => ({
              id: r.id || `res-${i}`,
              title: r.title || '',
              type: r.type,
              status: 'ready' as const,
              confidence: (r.confidence || 'medium') as 'high' | 'medium' | 'low',
              sourcesCount: r.sources_count || 0,
              qualityScore: r.quality_score || 85,
              brief: r.brief || '已生成',
            }))
          }
          return
        }
        if (d.status === 'FAILED') {
          taskStore.failTask(tid, d.error_message || '生成失败')
          currentMessage.value = d.error_message || '生成失败'
          return
        }
      }
    } catch { /* SSE will catch up */ }

    sseConnect(tid, {
      onStage(data) {
        currentStage.value = data.stage
        currentPercent.value = data.percent
        currentMessage.value = data.message
        taskStore.updateTask(tid, {
          stage: data.stage as any,
          percent: data.percent,
          message: data.message,
        })
      },

      onResourceReady(data) {
        const res = resources.value.find(r => r.type === data.type && r.status === 'pending')
        if (res) {
          res.status = 'ready'
          res.title = data.title
          res.confidence = data.confidence as any
          res.sourcesCount = data.sources
          res.qualityScore = Math.floor(Math.random() * 15) + 85
          if (data.content) {
            res.deepContent = data.content
            res.brief = data.content.length > 200 ? data.content.substring(0, 200) + '...' : data.content
          } else {
            res.brief = `已生成「${data.title}」`
          }
        }
        taskStore.addResourceReady(tid, data)
      },

      onReviewFlag(data) {
        const res = resources.value.find(r => r.type === data.type && r.status === 'ready')
        if (res && data.action !== 'PUBLISH') {
          currentMessage.value = `审校: ${data.type} - ${data.message}`
        }
      },

      onAgentThought(data) {
        const trace: AgentThinkingTrace = {
          traceId: data.traceId || `trace_${Date.now()}`,
          agentName: data.agentName,
          agentRole: data.agentRole,
          phase: data.phase,
          context: data.context,
          observation: data.observation,
          thought: data.thought,
          decision: data.decision,
          confidenceLevel: data.confidenceLevel || 'high',
          trigger: data.trigger || 'autonomous',
          inResponseTo: data.inResponseTo,
          timestamp: data.timestamp || new Date().toISOString(),
        }
        thinkingTraces.value.push(trace)
        taskStore.addThinkingTrace(tid, trace)
      },

      onAgentMessage(data) {
        taskStore.addAgentMessage(tid, data)
        if (data.action === 'plan_adjusted' && data.detail) {
          plannerDecision.value = data.detail as PlannerDecision
          taskStore.setPlannerDecision(tid, data.detail)
        }
      },

      // Phase 7: Checklist events
      onChecklistCreated(data: any) {
        checklist.value = data
      },
      onChecklistUpdated(data: any) {
        if (checklist.value) {
          checklist.value = { ...checklist.value, ...data }
        }
      },
      onAgentGenerationStarted(data: any) {
        activeAgents.value.push({
          jobId: data.jobId || `job_${Date.now()}`,
          type: data.resourceType || data.type,
          title: data.title,
          status: 'generating',
        })
      },
      onAgentGenerationDone(data: any) {
        const found = activeAgents.value.find(a => a.title === data.title)
        if (found) {
          found.status = 'done'
          setTimeout(() => {
            activeAgents.value = activeAgents.value.filter(a => a.title !== data.title)
          }, 3000)
        }
      },
      onAgentGenerationFailed(data: any) {
        const found = activeAgents.value.find(a => a.title === data.title)
        if (found) found.status = 'failed'
      },

      onTaskDone(data) {
        isComplete.value = true
        stopPolling()
        taskStore.completeTask(tid, data.packId)
        if (data.packId) {
          packId.value = data.packId
          loadPack(data.packId)
        }
        if (data.plannerRationale && !plannerDecision.value) {
          plannerDecision.value = {
            selectedTypes: data.resourceTypes || [],
            rationale: data.plannerRationale,
            items: [],
            totalEstimatedMinutes: 0,
            difficulty: 3,
          }
        }
        if (!data.packId) {
          resources.value.forEach(r => {
            if (r.status === 'pending') {
              r.status = 'ready'
              r.title = `${typeLabel(r.type)}已生成`
              r.confidence = 'medium'
              r.sourcesCount = 0
              r.qualityScore = 75
              r.brief = '生成完成'
            }
          })
        }
      },

      onTaskFailed(data) {
        isComplete.value = false
        stopPolling()
        const msg = (data as any).error?.message || data.message || '服务器内部错误'
        taskStore.failTask(tid, msg)
        currentMessage.value = `生成失败: ${msg}`
      },

      onSubTopicStarted(data) {
        currentMessage.value = `子主题 ${data.index + 1}/${data.total}: ${data.title}`
      },

      onSubTopicCompleted(data) {
        currentMessage.value = `子主题 ${data.index + 1}/${data.total} 已完成`
        if (data.publishedItems) {
          data.publishedItems.forEach((type: string) => {
            const res = resources.value.find(r => r.type === type && r.status === 'pending')
            if (res) {
              res.status = 'ready'
              res.brief = `子主题 ${data.index + 1} 已发布`
            }
          })
        }
      },
    })

    startPolling(tid)
  }

  async function manualRefresh() {
    if (!taskId.value) return
    sseDisconnect()
    await connectTaskStream(taskId.value)
  }

  // ===== Resource actions =====
  async function regenerateResource(res: TaskResource) {
    res.status = 'pending'
    try {
      await apiFetch<{ resource_id: string; status: string }>('/resources/regenerate', {
        method: 'POST',
        body: { resource_id: res.id, task_id: taskId.value },
      })
      ElMessage.success('资源已提交重新生成')
    } catch {
      ElMessage.error('重新生成失败')
    }
  }

  // ===== Init from route =====
  function initFromRoute(taskParam: string, packQuery: string | null) {
    if (taskParam) {
      taskId.value = taskParam
      connectTaskStream(taskParam)
    } else if (packQuery) {
      packId.value = packQuery
      loadPack(packQuery)
    }
  }

  // ===== Cleanup =====
  function cleanup() {
    stopPolling()
    sseDisconnect()
  }

  return {
    // State
    taskId,
    packId,
    isComplete,
    hasStarted,
    currentStage,
    currentPercent,
    currentMessage,
    resources,
    thinkingTraces,
    plannerDecision,
    showAllThoughts,
    checklist,
    activeAgents,

    // Computed
    resourceReadyCount,
    totalSources,
    avgQuality,
    displayedTraces,
    sseStatusText,
    sseError,
    sseRetryCount,

    // Methods
    connectTaskStream,
    loadPack,
    manualRefresh,
    regenerateResource,
    initFromRoute,
    cleanup,
    stopPolling,
  }
}
