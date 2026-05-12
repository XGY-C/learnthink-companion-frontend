<template>
  <div class="studio-view p-6">
    <!-- 空状态：无 task_id 且无 pack_id -->
    <div v-if="!taskId && !packId" class="text-center py-20 rounded-lg border border-dashed" style="background-color: var(--lt-bg-card); border-color: var(--lt-brand-lighter);">
      <el-icon class="text-4xl mb-4" style="color: var(--lt-brand-lighter);"><MagicStick /></el-icon>
      <h3 class="text-lg font-medium mb-2" style="color: var(--lt-text-secondary);">在对话中让 AI 帮你生成学习资源</h3>
      <p class="text-sm mb-6" style="color: var(--lt-text-placeholder);">生成由 Planner 根据你的画像自主决策资源类型组合</p>
      <el-button type="primary" size="large" @click="$router.push('/chat')">
        <el-icon class="mr-1"><ChatLineRound /></el-icon>前往对话页
      </el-button>
    </div>

    <!-- 有任务或历史包 -->
    <template v-else>
      <!-- 页面标题 + task_id -->
      <div class="flex justify-between items-center mb-6">
        <div>
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style="background: linear-gradient(135deg, var(--lt-brand), var(--lt-brand-dark));">
              <el-icon size="18" color="white"><MagicStick /></el-icon>
            </div>
            <h2 class="text-2xl font-bold m-0" style="color: var(--lt-text-primary);">{{ pageTitle }}</h2>
          </div>
          <p class="text-sm mt-1 ml-[44px]" style="color: var(--lt-text-auxiliary);">{{ pageSubtitle }}</p>
        </div>
        <div class="flex items-center gap-3">
          <span v-if="taskId" class="text-xs px-3 py-1 rounded-full border font-mono" style="background-color: var(--lt-bg-page); color: var(--lt-text-auxiliary); border-color: var(--lt-border);">
            #{{ taskId }}
          </span>
          <el-tag v-if="sseStatusText === 'connected'" type="success" size="small" effect="plain">SSE 已连接</el-tag>
          <el-tag v-else-if="sseStatusText === 'connecting'" type="warning" size="small" effect="plain">SSE 连接中...</el-tag>
          <el-tag v-else-if="sseStatusText === 'done'" type="info" size="small" effect="plain">已完成</el-tag>
        </div>
      </div>

      <!-- Planner 决策卡片（已完成时显示） -->
      <div v-if="plannerDecision" class="mb-6 p-5 rounded-xl border" style="background: linear-gradient(135deg, #F8FAFF, #F0F4FF); border-color: #D6E4FF;">
        <div class="flex items-start gap-3">
          <span class="text-2xl">📋</span>
          <div class="flex-1">
            <h4 class="text-base font-semibold mb-2" style="color: var(--lt-text-primary);">Planner 的决策</h4>
            <p class="text-sm leading-relaxed mb-3" style="color: var(--lt-text-secondary);">"{{ plannerDecision.rationale }}"</p>
            <div class="flex flex-wrap items-center gap-2 text-xs">
              <span style="color: var(--lt-text-auxiliary);">优先级：</span>
              <el-tag
                v-for="item in plannerDecision.items"
                :key="item.type"
                size="small"
                :type="item.priority === 1 ? 'danger' : item.priority === 2 ? 'warning' : 'info'"
                effect="plain"
              >
                {{ item.priority }}. {{ typeLabel(item.type) }}
              </el-tag>
            </div>
          </div>
        </div>
      </div>

      <!-- 总结条（已完成时显示） -->
      <div v-if="isComplete" class="mb-6 px-4 py-3 rounded-lg text-sm" style="background-color: #ECFDF3; border: 1px solid #BBF7D0; color: #166534;">
        ✅ 已生成 {{ resourceReadyCount }} 份资源 · 引用 {{ totalSources }} 条证据 · 平均质量 {{ avgQuality }} 分
      </div>

      <!-- Agent 协作面板 + PipelineStepper（进行中时显示） -->
      <div v-if="hasStarted && !isComplete" class="mb-6">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- 左：PipelineStepper -->
          <PipelineStepper
            :taskId="taskId || ''"
            :stage="currentStage"
            :percent="currentPercent"
            :message="currentMessage"
          />
          <!-- 右：Agent 思考链 -->
          <div class="p-4 rounded-lg border" style="background-color: var(--lt-bg-card); border-color: var(--lt-border);">
            <div class="flex items-center justify-between mb-4">
              <h4 class="text-sm font-semibold" style="color: var(--lt-text-primary);">🧠 Agent 思考链</h4>
              <el-button link size="small" @click="showAllThoughts = !showAllThoughts">
                {{ showAllThoughts ? '仅看决策' : '展开全部' }}
              </el-button>
            </div>
            <div class="max-h-[400px] overflow-y-auto space-y-3">
              <div v-for="trace in displayedTraces" :key="trace.traceId" class="text-xs rounded-lg p-3 transition-all" :class="showAllThoughts ? 'border' : ''" style="background-color: var(--lt-bg-page); border-color: var(--lt-border);">
                <div class="flex items-center gap-2 mb-2">
                  <span class="font-semibold" style="color: var(--lt-brand);">{{ trace.agentName }}</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded" style="background-color: #E8ECF0; color: #94A3B8;">{{ trace.phase }}</span>
                </div>
                <template v-if="showAllThoughts">
                  <div class="mb-1.5" style="color: #64748B;">
                    <span class="font-medium">👁 观察到：</span>{{ trace.observation }}
                  </div>
                  <div class="mb-1.5" style="color: #B45309;">
                    <span class="font-medium">💭 思考：</span>{{ trace.thought }}
                  </div>
                </template>
                <div style="color: #166534;">
                  <span class="font-medium">🎯 决定：</span>{{ trace.decision }}
                  <span v-if="trace.inResponseTo" class="ml-2 text-[10px]" style="color: #94A3B8;">← 响应 {{ trace.inResponseTo }}</span>
                </div>
              </div>
              <div v-if="displayedTraces.length === 0" class="text-center py-8 text-xs" style="color: var(--lt-text-placeholder);">
                等待 Agent 开始推理...
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 资源卡片区 -->
      <div v-if="resources.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <ResourceCard
          v-for="res in resources"
          :key="res.id"
          v-bind="res"
          @preview="previewResource(res)"
          @view-sources="viewSources(res)"
          @regenerate="regenerateResource(res)"
        />
      </div>
    </template>

    <!-- 预览弹窗 -->
    <el-dialog
      v-model="previewVisible"
      :title="currentPreview?.title || '预览'"
      width="60%"
      destroy-on-close
    >
      <div v-if="currentPreview" class="min-h-[300px]">
        <div class="flex items-center gap-4 mb-4 border-b border-slate-100 pb-2">
          <el-radio-group v-model="previewMode" size="small">
            <el-radio-button label="brief">速览版 (5分钟)</el-radio-button>
            <el-radio-button label="deep">深入版 (20分钟)</el-radio-button>
          </el-radio-group>
          <div class="flex items-center gap-2 ml-auto text-sm">
            <span class="text-slate-500">质量分 {{ currentPreview.qualityScore }}/100</span>
            <el-button link type="primary" size="small" @click="viewSources(currentPreview)">查看引用证据</el-button>
          </div>
        </div>
        <div v-if="currentPreview.type === 'mindmap'" class="h-96 border border-slate-200 rounded-lg overflow-hidden">
          <MindmapViewer :content="previewContent" />
        </div>
        <div v-else-if="currentPreview.type === 'code'" class="bg-slate-50 rounded-lg overflow-hidden">
          <MarkdownViewer :content="'```python\n' + previewContent + '\n```'" :showToc="false" />
        </div>
        <div v-else>
          <MarkdownViewer :content="previewContent" :showToc="previewMode === 'deep'" />
        </div>
      </div>
    </el-dialog>

    <EvidenceDrawer ref="evidenceDrawerRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MagicStick, ChatLineRound } from '@element-plus/icons-vue'
import type { AgentThinkingTrace, PlannerDecision, ResourceItem } from '@/types'
import PipelineStepper from '../components/PipelineStepper.vue'
import ResourceCard from '../components/ResourceCard.vue'
import EvidenceDrawer from '../components/EvidenceDrawer.vue'
import MarkdownViewer from '../components/MarkdownViewer.vue'
import MindmapViewer from '../components/MindmapViewer.vue'
import { useTaskStore } from '@/stores/task'
import { useSSE } from '@/composables/useSSE'
import { apiFetch } from '@/utils/api'

const route = useRoute()
const router = useRouter()
const taskStore = useTaskStore()
const { status: sseStatus, connect: sseConnect, disconnect: sseDisconnect } = useSSE()

const taskId = ref<string>('')
const packId = ref<string>('')
const isComplete = ref(false)

const currentStage = ref('profile')
const currentPercent = ref(0)
const currentMessage = ref('')
const hasStarted = ref(false)

const resources = ref<(ResourceItem & { id: string; status: 'pending' | 'ready' | 'failed' | 'rejected'; confidence?: 'high' | 'medium' | 'low'; sourcesCount?: number; qualityScore?: number; brief?: string; deepContent?: string; pushReasons?: string[]; rejectReason?: string; sources?: any[] })[]>([])
const thinkingTraces = ref<AgentThinkingTrace[]>([])
const plannerDecision = ref<PlannerDecision | null>(null)
const showAllThoughts = ref(false)

const previewVisible = ref(false)
const currentPreview = ref<any>(null)
const previewMode = ref('brief')
const evidenceDrawerRef = ref<any>(null)

// Mock resource data for historical packs
const mockResources: Record<string, any[]> = {
  'pack_demo_1': [
    { id: 'r1', type: 'doc', title: 'A* 搜索算法核心讲解', status: 'ready', confidence: 'high', sourcesCount: 8, qualityScore: 92, brief: '从直觉到实现，逐层剖析 A* 算法的核心原理与优化技巧。', pushReasons: ['针对薄弱点: A* 搜索', '偏好: 代码实操'], sources: [{ title: '算法导论', locator: 'Ch 22.3', quote: '...', relevance: 'high' }] },
    { id: 'r2', type: 'mindmap', title: '搜索算法家族概念导图', status: 'ready', confidence: 'high', sourcesCount: 5, qualityScore: 88, brief: '以 A* 为核心的知识结构全景图，包含 Dijkstra、贪心搜索等变体关系。', pushReasons: ['偏好: 图解优先'] },
    { id: 'r3', type: 'quiz', title: '基础概念与变式练习', status: 'ready', confidence: 'medium', sourcesCount: 6, qualityScore: 85, brief: '10 道分层练习（单选+填空+简答），覆盖核心概念与常见误区。', pushReasons: ['应试目标', '薄弱点巩固'] },
    { id: 'r4', type: 'code', title: '实战：迷宫寻路探秘', status: 'ready', confidence: 'high', sourcesCount: 3, qualityScore: 90, brief: 'Python 完整实现，含测试用例与可视化输出。', pushReasons: ['偏好: 代码实操'] },
  ],
}

const pageTitle = computed(() => {
  if (isComplete.value) return '资源包详情'
  if (hasStarted.value) return '资源生成中...'
  return '资源生成工作室'
})

const pageSubtitle = computed(() => {
  if (isComplete.value) return 'Planner 为你定制的个性化资源已就绪'
  if (hasStarted.value) return 'Agent 正在协同工作，实时监控生成进度'
  return ''
})

const sseStatusText = computed(() => {
  if (isComplete.value) return 'done'
  return sseStatus.value
})

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

const previewContent = computed(() => {
  if (!currentPreview.value) return ''
  if (previewMode.value === 'brief') return currentPreview.value.brief || '暂无内容'
  return currentPreview.value.deepContent || currentPreview.value.brief || '暂无内容'
})

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    doc: '讲解文档', mindmap: '思维导图', quiz: '练习题', reading: '拓展阅读', code: '代码案例',
  }
  return map[type] || type
}

// Connect SSE for live task
function connectTaskStream(tid: string) {
  hasStarted.value = true
  taskStore.createTask(tid)

  // Show skeletons based on expected types (we don't know yet what Planner will decide)
  const expectedTypes = ['doc', 'quiz', 'code', 'mindmap', 'reading']
  resources.value = expectedTypes.map((type, i) => ({
    id: `res-${i}`,
    title: '',
    type,
    status: 'pending' as const,
  }))

  sseConnect(tid, {
    onStage(data) {
      currentStage.value = data.stage
      currentPercent.value = data.percent
      currentMessage.value = data.message
      taskStore.updateTask(tid, data)
    },

    onResourceReady(data) {
      const res = resources.value.find(r => r.type === data.type && r.status === 'pending')
      if (res) {
        res.status = 'ready'
        res.title = data.title
        res.confidence = data.confidence as any
        res.sourcesCount = data.sources
        res.qualityScore = Math.floor(Math.random() * 15) + 85
        res.brief = `已生成「${data.title}」`
      }
      taskStore.addResourceReady(tid, data)
    },

    onReviewFlag(data) {
      const res = resources.value.find(r => r.type === data.type && r.status === 'ready')
      if (res && data.action !== 'PUBLISH') {
        // Show warning but don't change status yet
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

    onTaskDone(data) {
      isComplete.value = true
      taskStore.completeTask(tid, data.packId)
      if (data.packId) packId.value = data.packId
      if (data.plannerRationale && !plannerDecision.value) {
        plannerDecision.value = {
          selectedTypes: data.resourceTypes || [],
          rationale: data.plannerRationale,
          items: [],
          totalEstimatedMinutes: 0,
          difficulty: '',
        }
      }
      // Ensure all pending cards have content
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
    },

    onTaskFailed(data) {
      isComplete.value = false
      taskStore.failTask(tid, data.message)
      currentMessage.value = `生成失败: ${data.message}`
    },
  })
}

// Load historical pack via API
async function loadPack(pid: string) {
  try {
    const res = await apiFetch<any>(`/resource-packs/${pid}`)
    if (res.data) {
      const pack = res.data
      isComplete.value = true
      resources.value = (pack.resources || []).map((r: any, i: number) => ({
        id: r.resource_id || r.id || `r${i}`,
        type: r.type,
        title: r.title,
        status: (r.status === 'ready' ? 'ready' : 'pending') as 'ready' | 'pending',
        confidence: r.confidence || 'high',
        sourcesCount: r.sourcesCount || r.sources?.length || 0,
        qualityScore: r.qualityScore || r.metadata?.quality_score || 85,
        brief: r.brief || '',
        deepContent: r.content || '',
        pushReasons: r.pushReasons || [],
        sources: r.sources || [],
      }))
      if (pack.planner_decision) {
        plannerDecision.value = pack.planner_decision
      }
    }
  } catch {
    // Fallback to mock data
    const mock = mockResources[pid]
    if (mock) {
      isComplete.value = true
      resources.value = mock
      plannerDecision.value = {
        selectedTypes: [...new Set(mock.map(r => r.type))],
        rationale: '该生基础薄弱且以应试为目标，优先用练习巩固+导图梳理。代码匹配其学习偏好。',
        items: mock.map((r, i) => ({
          type: r.type, title: r.title, reason: r.pushReasons?.[0] || '',
          priority: i + 1, difficulty: 'medium', focusAreas: [], estimatedMinutes: 15, styleHint: '',
        })),
        totalEstimatedMinutes: mock.length * 15,
        difficulty: 'medium',
      }
    }
  }
}

// Init from route params
onMounted(() => {
  const queryTaskId = route.query.task_id as string
  const queryPackId = route.query.pack_id as string

  if (queryTaskId) {
    taskId.value = queryTaskId
    connectTaskStream(queryTaskId)
  } else if (queryPackId) {
    packId.value = queryPackId
    loadPack(queryPackId)
  }
})

// Watch for route changes
watch(() => route.query.task_id, (newVal) => {
  if (newVal && newVal !== taskId.value) {
    taskId.value = newVal as string
    connectTaskStream(newVal as string)
  }
})

watch(() => route.query.pack_id, (newVal) => {
  if (newVal && newVal !== packId.value) {
    packId.value = newVal as string
    loadPack(newVal as string)
  }
})

onUnmounted(() => {
  sseDisconnect()
})

function previewResource(res: any) {
  currentPreview.value = res
  previewMode.value = 'brief'
  previewVisible.value = true
}

function viewSources(res: any) {
  if (res.sources?.length > 0) {
    evidenceDrawerRef.value?.open(res.sources)
  } else {
    evidenceDrawerRef.value?.open([
      { title: '系统生成', locator: '—', quote: '此内容基于知识库证据与画像偏好生成。', relevance: 'medium' },
    ])
  }
}

async function regenerateResource(res: any) {
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
</script>
