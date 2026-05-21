<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useProfileStore } from '@/stores/profile'
import { usePlanStore } from '@/stores/plan'
import type { Activity, Module } from '@/types'
import {
  ArrowRight, Refresh, Clock, CircleCheckFilled,
  Lock, Right, ArrowDown, Search, Download,
  MagicStick, Reading, EditPen, DataAnalysis,
} from '@element-plus/icons-vue'
import GenerationCard from '@/components/GenerationCard.vue'
import EmptyState from '@/components/EmptyState.vue'

const router = useRouter()
const profile = useProfileStore()
const planStore = usePlanStore()

// ===== 交互状态 =====
const dagExpanded = ref(false)
const expandedModules = ref<Set<string>>(new Set())
const exploreDrawerVisible = ref(false)
const exploreActivity = ref<Activity | null>(null)
const adjustmentHistoryVisible = ref(false)

// ===== 生命周期 =====
onMounted(async () => {
  if (profile.activeCourseId) {
    await planStore.fetchPlan(profile.activeCourseId)
    // Default expand in-progress module
    if (planStore.inProgressModule) {
      expandedModules.value.add(planStore.inProgressModule.moduleId)
    }
  }
})

// ===== 生成 =====
function handleGenerate() {
  if (profile.activeCourseId && profile.currentProfileVersion) {
    planStore.generatePlan(profile.activeCourseId, profile.currentProfileVersion)
  }
}

// ===== 导航 =====
function goToLearn(activity: Activity) {
  if (activity.type === 'explore') {
    exploreActivity.value = activity
    exploreDrawerVisible.value = true
    return
  }
  router.push(`/learn/${activity.activityId}`)
}

function goToModuleReplan(moduleId: string) {
  planStore.refreshModule(moduleId)
}

function toggleModule(moduleId: string) {
  if (expandedModules.value.has(moduleId)) {
    expandedModules.value.delete(moduleId)
  } else {
    expandedModules.value.add(moduleId)
  }
}

// ===== DAG 布局 =====
interface DagNode {
  id: string
  title: string
  status: Module['status']
  x: number
  y: number
  cols: number
}
const dagNodes = computed(() => {
  const modules = planStore.moduleList
  if (modules.length === 0) return []

  // Build topological layers
  const inDegree: Record<string, number> = {}
  const prereqMap: Record<string, string[]> = {}
  modules.forEach(m => {
    inDegree[m.moduleId] = 0
    prereqMap[m.moduleId] = m.prerequisites || []
  })
  modules.forEach(m => (m.prerequisites || []).forEach(p => {
    if (inDegree[m.moduleId] !== undefined) inDegree[m.moduleId]++
  }))

  const layers: string[][] = []
  const visited = new Set<string>()
  const queue = modules.filter(m => inDegree[m.moduleId] === 0).map(m => m.moduleId)
  const tempInDegree = { ...inDegree }

  while (queue.length > 0) {
    const layer: string[] = []
    for (let i = queue.length - 1; i >= 0; i--) {
      const id = queue[i]
      if (visited.has(id)) continue
      visited.add(id)
      layer.push(id)
      queue.splice(i, 1)
    }
    layers.push(layer)

    // Decrease in-degree for children
    modules.forEach(m => {
      if ((m.prerequisites || []).some(p => layer.includes(p))) {
        tempInDegree[m.moduleId] = (tempInDegree[m.moduleId] || 0) - 1
        if (tempInDegree[m.moduleId] <= 0 && !visited.has(m.moduleId)) {
          queue.push(m.moduleId)
        }
      }
    })
  }

  // Position nodes
  const nodeMap = new Map<string, DagNode>()
  const layerGap = 100
  const nodeWidth = 160
  const nodeHeight = 48
  const hGap = 24
  const startY = 30

  layers.forEach((layer, li) => {
    const totalW = layer.length * nodeWidth + (layer.length - 1) * hGap
    const startX = Math.max(0, (600 - totalW) / 2)
    layer.forEach((id, ni) => {
      const m = modules.find(mm => mm.moduleId === id)
      if (m) {
        nodeMap.set(id, {
          id: m.moduleId,
          title: m.title.length > 10 ? m.title.slice(0, 10) + '…' : m.title,
          status: m.status,
          x: startX + ni * (nodeWidth + hGap),
          y: 30 + li * (nodeHeight + layerGap),
          cols: 1,
        })
      }
    })
  })

  return [...nodeMap.values()]
})

const dagEdges = computed(() => {
  const modules = planStore.moduleList
  const edges: { from: DagNode; to: DagNode; path: string }[] = []
  const nodes = dagNodes.value
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  modules.forEach(m => {
    (m.prerequisites || []).forEach(p => {
      const from = nodeMap.get(p)
      const to = nodeMap.get(m.moduleId)
      if (from && to) {
        const mx1 = from.x + 80
        const my1 = from.y + 48
        const mx2 = to.x + 80
        const my2 = to.y
        const cy = (my1 + my2) / 2
        edges.push({
          from, to,
          path: `M ${mx1} ${my1} C ${mx1} ${cy}, ${mx2} ${cy}, ${mx2} ${my2}`,
        })
      }
    })
  })
  return edges
})

function getDagColor(status: Module['status']): string {
  switch (status) {
    case 'completed': return '#34C759'
    case 'in_progress': return '#2B6FFF'
    case 'locked': return '#B8B8C8'
    default: return '#FFFFFF'
  }
}
function getDagStroke(status: Module['status']): string {
  switch (status) {
    case 'completed': return '#34C759'
    case 'in_progress': return '#2B6FFF'
    case 'locked': return '#D0D0D8'
    default: return '#A0A0B0'
  }
}

function scrollToModule(moduleId: string) {
  const el = document.getElementById(`module-${moduleId}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  dagExpanded.value = false
}

// ===== Helper =====
function typeIcon(type: string): string {
  switch (type) {
    case 'learn': return '📖'
    case 'quiz': return '📝'
    case 'explore': return '📎'
    default: return '📄'
  }
}
function typeColor(type: string): string {
  switch (type) {
    case 'learn': return 'var(--lt-brand)'
    case 'quiz': return 'var(--lt-orange)'
    case 'explore': return 'var(--lt-text-auxiliary)'
    default: return 'var(--lt-text-secondary)'
  }
}
function statusLabel(status: string): string {
  switch (status) {
    case 'completed': return '已完成'
    case 'in_progress': return '进行中'
    case 'locked': return '锁定'
    case 'ready': return '未开始'
    case 'failed': return '未达标'
    case 'skipped': return '已跳过'
    default: return status
  }
}
function moduleStatusLabel(status: Module['status']): string {
  switch (status) {
    case 'completed': return '已完成'
    case 'in_progress': return '进行中'
    case 'locked': return '🔒 锁定'
    case 'ready': return '未开始'
  }
}
function scopeLabel(scope: string): string {
  switch (scope) {
    case 'core_curriculum': return '核心'
    case 'supplementary': return '补充'
    case 'extracurricular': return '拓展'
    default: return scope
  }
}
function depthLabel(depth: string): string {
  switch (depth) {
    case 'basic': return '概览'
    case 'standard': return '标准'
    case 'deep': return '深入'
    default: return depth
  }
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- ==================== 空状态 ==================== -->
    <template v-if="planStore.status === 'empty'">
      <div class="flex-1 flex items-center justify-center p-8">
        <div class="text-center max-w-md">
          <div class="text-6xl mb-6">📋</div>
          <h2 class="text-2xl font-bold mb-3" style="color: var(--lt-text-primary);">还没有学习计划</h2>
          <p class="mb-6" style="color: var(--lt-text-auxiliary);">
            在这里查看为你量身定制的学习路线，<br>
            跟踪每个知识点的掌握进度。
          </p>
          <el-button
            type="primary"
            size="large"
            :icon="MagicStick"
            :loading="planStore.loading"
            @click="handleGenerate"
          >
            生成我的学习计划
          </el-button>
          <p class="mt-4 text-xs" style="color: var(--lt-text-placeholder);">
            也可以去对话页让 AI 帮你规划
          </p>
        </div>
      </div>
    </template>

    <!-- ==================== 生成中 ==================== -->
    <template v-else-if="planStore.status === 'generating'">
      <div class="flex-1 flex items-center justify-center p-8">
        <div class="w-full max-w-lg">
          <GenerationCard
            topic="学习计划生成"
            :task-id="planStore.generationTaskId"
            status="generating"
            :progress="planStore.generationPercent"
            :message="planStore.generationMessage"
            resource-types="[]"
          />
          <p class="text-center text-sm mt-4" style="color: var(--lt-text-auxiliary);">
            {{ planStore.generationMessage || '正在分析课程结构与画像...' }}
          </p>
        </div>
      </div>
    </template>

    <!-- ==================== 就绪态 / 完成态 ==================== -->
    <template v-else-if="planStore.plan">
      <div class="flex-1 overflow-auto">
        <!-- ===== 顶部状态栏 ===== -->
        <div class="sticky top-0 z-10" style="background: var(--lt-bg-page); padding: 16px 24px 12px; border-bottom: 1px solid var(--lt-border);">
          <div class="flex items-center justify-between max-w-5xl mx-auto">
            <div class="flex items-center gap-4 text-sm" style="color: var(--lt-text-secondary);">
              <span>
                进度 <strong style="color: var(--lt-text-primary);">{{ planStore.completedModules.length }}/{{ planStore.moduleList.length }}</strong> 模块
              </span>
              <span v-if="planStore.overallMastery != null">
                · 掌握度 <strong style="color: var(--lt-brand);">{{ Math.round(planStore.overallMastery * 100) }}%</strong>
              </span>
              <span v-if="planStore.plan?.summary?.completionEstimate">
                · 预计 {{ planStore.plan.summary.completionEstimate }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <el-button text size="small" :icon="Refresh" @click="planStore.fetchPlan(profile.activeCourseId || '')">
                刷新
              </el-button>
            </div>
          </div>
          <div class="max-w-5xl mx-auto mt-2">
            <el-progress
              :percentage="planStore.overallProgress"
              :stroke-width="6"
              color="var(--lt-brand)"
              :show-text="false"
            />
          </div>
        </div>

        <!-- ===== 当前位置摘要条 (sticky) ===== -->
        <div
          v-if="planStore.currentActivity && planStore.status !== 'completed'"
          class="sticky z-10 px-6 py-3"
          style="top: 88px; background: linear-gradient(135deg, var(--lt-brand-lightest), #F0F5FF); border-bottom: 1px solid var(--lt-brand-lighter);"
        >
          <div class="max-w-5xl mx-auto flex items-center justify-between">
            <div class="flex items-center gap-3 text-sm">
              <span style="color: var(--lt-brand);">📍 当前位置</span>
              <span style="color: var(--lt-text-primary); font-weight: 500;">
                {{ planStore.currentModule?.title }} · {{ planStore.currentActivity.title }}
              </span>
              <span v-if="planStore.currentActivity.result?.score != null" style="color: var(--lt-orange);">
                上次得分 {{ Math.round(planStore.currentActivity.result.score * 100) }}%
              </span>
            </div>
            <el-button
              type="primary"
              size="small"
              @click="goToLearn(planStore.currentActivity!)"
            >
              继续学习 <el-icon class="ml-1"><ArrowRight /></el-icon>
            </el-button>
          </div>
        </div>

        <div class="max-w-5xl mx-auto p-6 pt-4 space-y-4">
          <!-- ===== 操作按钮 ===== -->
          <div class="flex items-center gap-2 mb-2">
            <el-button text size="small" :icon="Search" @click="dagExpanded = !dagExpanded">
              模块依赖图
            </el-button>
            <el-button text size="small" :icon="DataAnalysis" @click="adjustmentHistoryVisible = !adjustmentHistoryVisible">
              调整历史
            </el-button>
          </div>

          <!-- ===== DAG 缩略图 (可折叠) ===== -->
          <div v-if="dagExpanded && dagNodes.length > 0" class="rounded-xl p-4" style="background: var(--lt-bg-card); border: 1px solid var(--lt-border);">
            <svg :viewBox="`0 0 600 ${dagNodes.length > 0 ? Math.max(...dagNodes.map(n => n.y)) + 80 : 200}`" class="w-full" style="max-height: 300px;">
              <!-- 边 -->
              <path
                v-for="(edge, i) in dagEdges"
                :key="i"
                :d="edge.path"
                fill="none"
                stroke="#C8C8D0"
                stroke-width="1.5"
                marker-end="url(#arrowhead)"
              />
              <!-- 节点 -->
              <g
                v-for="node in dagNodes"
                :key="node.id"
                :transform="`translate(${node.x}, ${node.y})`"
                style="cursor: pointer;"
                @click="scrollToModule(node.id)"
              >
                <rect
                  width="160" height="48" rx="8"
                  :fill="node.status === 'in_progress' ? '#E8F0FE' : 'white'"
                  :stroke="getDagStroke(node.status)"
                  stroke-width="2"
                />
                <circle
                  cx="16" cy="24" r="6"
                  :fill="getDagColor(node.status)"
                />
                <text x="28" y="29" font-size="12" fill="#1A1A2E" font-weight="500">
                  {{ node.title }}
                </text>
              </g>
              <!-- 箭头定义 -->
              <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#C8C8D0" />
                </marker>
              </defs>
            </svg>
            <div class="flex items-center gap-4 mt-3 text-xs" style="color: var(--lt-text-auxiliary);">
              <span><span class="inline-block w-3 h-3 rounded-full bg-[#34C759] mr-1"></span>已完成</span>
              <span><span class="inline-block w-3 h-3 rounded-full bg-[#2B6FFF] mr-1"></span>进行中</span>
              <span><span class="inline-block w-3 h-3 rounded border border-[#A0A0B0] bg-white mr-1"></span>未开始</span>
              <span><span class="inline-block w-3 h-3 rounded-full bg-[#B8B8C8] mr-1"></span>锁定</span>
            </div>
          </div>

          <!-- ===== Module 卡片列表 ===== -->
          <div class="space-y-3">
            <div
              v-for="mod in planStore.moduleList"
              :key="mod.moduleId"
              :id="`module-${mod.moduleId}`"
              class="rounded-xl overflow-hidden transition-all"
              :style="{ border: '1px solid var(--lt-border)', background: 'var(--lt-bg-card)' }"
            >
              <!-- Module Header (可点击展开/折叠) -->
              <div
                class="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                @click="toggleModule(mod.moduleId)"
              >
                <div class="flex items-center gap-3">
                  <el-icon
                    :size="20"
                    :style="{ color: mod.status === 'completed' ? 'var(--lt-success)' : mod.status === 'in_progress' ? 'var(--lt-brand)' : 'var(--lt-text-auxiliary)' }"
                  >
                    <CircleCheckFilled v-if="mod.status === 'completed'" />
                    <Right v-else-if="mod.status === 'in_progress'" />
                    <Lock v-else-if="mod.status === 'locked'" />
                    <ArrowDown v-else />
                  </el-icon>
                  <div>
                    <span class="text-base font-semibold" style="color: var(--lt-text-primary);">
                      {{ mod.title }}
                    </span>
                    <div class="flex items-center gap-2 mt-0.5">
                      <el-tag size="small" effect="plain" :disable-transitions="true">{{ scopeLabel(mod.scope) }}</el-tag>
                      <el-tag size="small" effect="plain" :disable-transitions="true">{{ depthLabel(mod.depth) }}</el-tag>
                      <span class="text-xs" style="color: var(--lt-text-auxiliary);">{{ mod.estimatedHours }}h</span>
                      <span
                        v-if="mod.status === 'locked' && mod.prerequisites?.length"
                        class="text-xs"
                        style="color: var(--lt-text-auxiliary);"
                      >
                        需先完成：{{ mod.prerequisites.map(p => planStore.moduleList.find(m => m.moduleId === p)?.title || p).join('、') }}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <el-tag
                    :type="mod.status === 'completed' ? 'success' : mod.status === 'in_progress' ? 'primary' : 'info'"
                    size="small"
                    effect="light"
                  >
                    {{ moduleStatusLabel(mod.status) }}
                  </el-tag>
                  <el-icon :size="16" style="color: var(--lt-text-auxiliary);" :class="{ 'rotate-180': expandedModules.has(mod.moduleId) }">
                    <ArrowRight />
                  </el-icon>
                </div>
              </div>

              <!-- Module Expanded Content -->
              <div v-if="expandedModules.has(mod.moduleId)" class="px-5 pb-4 border-t" style="border-color: var(--lt-border);">
                <!-- 掌握度 -->
                <div v-if="mod.mastery != null" class="flex items-center gap-3 mt-3 mb-3">
                  <span class="text-xs" style="color: var(--lt-text-auxiliary);">掌握度</span>
                  <el-progress
                    :percentage="Math.round(mod.mastery * 100)"
                    :stroke-width="6"
                    :status="mod.mastery >= 0.7 ? 'success' : 'warning'"
                    style="flex: 1; max-width: 200px;"
                  />
                  <span class="text-xs font-medium" :style="{ color: mod.mastery >= 0.7 ? 'var(--lt-success)' : 'var(--lt-warning)' }">
                    {{ Math.round(mod.mastery * 100) }}%
                  </span>
                </div>

                <!-- Activity 列表 -->
                <div class="space-y-2">
                  <div
                    v-for="act in (mod.subPlan?.activities || [])"
                    :key="act.activityId"
                    class="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
                    :style="{
                      borderLeft: `3px solid ${typeColor(act.type)}`,
                      background: act.status === 'failed' ? 'rgba(255,59,48,0.04)' : 'transparent',
                      opacity: act.status === 'locked' ? 0.5 : 1,
                    }"
                  >
                    <span class="text-lg flex-shrink-0">{{ typeIcon(act.type) }}</span>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-medium truncate" style="color: var(--lt-text-primary);">
                          {{ act.title }}
                        </span>
                        <el-tag
                          v-if="act.status === 'completed'"
                          size="small"
                          type="success"
                          effect="plain"
                          :disable-transitions="true"
                        >已完成</el-tag>
                        <el-tag
                          v-else-if="act.status === 'failed'"
                          size="small"
                          type="danger"
                          effect="plain"
                          :disable-transitions="true"
                        >未达标</el-tag>
                        <el-tag
                          v-else-if="act.status === 'locked'"
                          size="small"
                          effect="plain"
                          :disable-transitions="true"
                        >🔒 锁定</el-tag>
                        <el-tag
                          v-else-if="act.status === 'in_progress'"
                          size="small"
                          type="primary"
                          effect="light"
                          :disable-transitions="true"
                        >进行中</el-tag>
                      </div>
                      <div class="flex items-center gap-3 mt-1">
                        <span class="text-xs" style="color: var(--lt-text-auxiliary);">
                          {{ act.type === 'learn' ? '学习' : act.type === 'quiz' ? '练习' : '拓展' }}
                          · {{ act.estimatedMinutes }}min
                        </span>
                        <!-- 资源类型 -->
                        <span v-if="act.resource" class="text-xs" :style="{ color: act.resource.source === 'matched' ? 'var(--lt-success)' : 'var(--lt-text-auxiliary)' }">
                          {{ act.resource.source === 'matched' ? '📄 已匹配' : '⚡ 待生成' }}
                        </span>
                        <!-- 得分 (quiz) -->
                        <span v-if="act.result?.score != null" class="text-xs font-medium" :style="{ color: (act.result.score || 0) >= 0.7 ? 'var(--lt-success)' : 'var(--lt-orange)' }">
                          得分 {{ Math.round((act.result.score || 0) * 100) }}%
                        </span>
                        <!-- 薄弱点标签 -->
                        <span
                          v-for="tag in (act.result?.weakTags || [])"
                          :key="tag"
                          class="text-xs px-1.5 py-0.5 rounded"
                          style="background: var(--lt-orange-light-9); color: var(--lt-orange-text);"
                        >
                          {{ tag }}
                        </span>
                      </div>
                    </div>
                    <!-- 操作按钮 -->
                    <div class="flex items-center gap-1 flex-shrink-0">
                      <el-button
                        v-if="act.status === 'ready' || act.status === 'in_progress'"
                        type="primary"
                        size="small"
                        :disabled="act.type === 'explore'"
                        @click="goToLearn(act)"
                      >
                        {{ act.status === 'in_progress' ? '继续' : '开始' }}
                      </el-button>
                      <el-button
                        v-if="act.status === 'failed'"
                        size="small"
                        @click="goToLearn(act)"
                      >
                        重试
                      </el-button>
                      <el-button
                        v-if="act.type === 'explore' && act.status !== 'skipped' && act.status !== 'completed'"
                        text
                        size="small"
                        @click="goToLearn(act)"
                      >
                        浏览
                      </el-button>
                    </div>
                  </div>
                </div>

                <!-- Module 底部统计 -->
                <div class="flex items-center justify-between mt-3 pt-3 border-t" style="border-color: var(--lt-border);">
                  <span class="text-xs" style="color: var(--lt-text-auxiliary);">
                    进度 {{ mod.subPlan?.activities.filter(a => a.status === 'completed').length || 0 }}/{{ mod.subPlan?.activities.length || 0 }}
                  </span>
                  <el-button text size="small" :icon="Refresh" @click="goToModuleReplan(mod.moduleId)">
                    重新规划此模块
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <!-- ===== 完成态提示 ===== -->
          <div
            v-if="planStore.status === 'completed'"
            class="text-center py-8"
          >
            <div class="text-5xl mb-4">🎉</div>
            <h2 class="text-xl font-bold mb-2" style="color: var(--lt-text-primary);">学习计划已完成！</h2>
            <p class="text-sm mb-4" style="color: var(--lt-text-auxiliary);">
              用时 {{ planStore.plan?.summary?.totalHours }} 小时 · 平均掌握度 {{ planStore.overallMastery != null ? Math.round(planStore.overallMastery * 100) : '-' }}%
            </p>
            <p v-if="planStore.overallWeakTags.length" class="text-xs mb-4" style="color: var(--lt-orange-text);">
              薄弱点：{{ planStore.overallWeakTags.join('、') }}
            </p>
            <el-button type="primary" @click="router.push('/report')">
              生成学习报告
            </el-button>
          </div>
        </div>
      </div>

      <!-- ===== Explore Drawer ===== -->
      <el-drawer
        v-model="exploreDrawerVisible"
        :title="exploreActivity?.title || '拓展阅读'"
        direction="rtl"
        size="500px"
      >
        <template v-if="exploreActivity">
          <div class="text-sm mb-6" style="color: var(--lt-text-auxiliary);">
            {{ exploreActivity.description }}
          </div>
          <div class="flex gap-3 pt-4 border-t" style="border-color: var(--lt-border);">
            <el-button type="primary" plain @click="planStore.submitActivity(exploreActivity.activityId, { duration_seconds: 0, interaction_detected: true })">
              标记完成
            </el-button>
            <el-button @click="exploreDrawerVisible = false">
              关闭
            </el-button>
          </div>
        </template>
      </el-drawer>

      <!-- ===== 调整历史 ===== -->
      <el-drawer
        v-model="adjustmentHistoryVisible"
        title="调整历史"
        direction="rtl"
        size="400px"
      >
        <div v-if="planStore.plan" class="space-y-4">
          <template v-for="mod in planStore.moduleList" :key="mod.moduleId">
            <div v-if="mod.subPlan?.adjustments?.length">
              <h4 class="text-sm font-semibold mb-2" style="color: var(--lt-text-primary);">{{ mod.title }}</h4>
              <div v-for="(adj, i) in mod.subPlan.adjustments" :key="i" class="text-sm p-3 rounded-lg mb-2" style="background: var(--lt-orange-light-9);">
                <p style="color: var(--lt-orange-text);">{{ adj.reason }}</p>
                <p class="text-xs mt-1" style="color: var(--lt-text-auxiliary);">{{ adj.at }}</p>
              </div>
            </div>
          </template>
          <p v-if="!planStore.moduleList.some(m => m.subPlan?.adjustments?.length)" class="text-sm" style="color: var(--lt-text-auxiliary);">
            暂无调整记录
          </p>
        </div>
      </el-drawer>
    </template>
  </div>
</template>

<style scoped>
.rotate-180 {
  transform: rotate(180deg);
  transition: transform 0.2s ease;
}
</style>
