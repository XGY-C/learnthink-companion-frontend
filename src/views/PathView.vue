<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { VideoPlay, Monitor, Search, Medal } from '@element-plus/icons-vue'

const router = useRouter()

// ===== 数据模型 =====
type NodeStatus = 'mastered' | 'in-progress' | 'pending'
type NodeType = 'concept' | 'practice' | 'review'

interface PathNode {
  id: string
  title: string
  status: NodeStatus
  type: NodeType
  mastery: number
  goals: string[]
  reason?: string
  isNewAdjustment?: boolean
}

// 模拟数据：学习路径节点
const nodes = ref<PathNode[]>([
  {
    id: 'n1',
    title: '图搜索算法基础：DFS 与 BFS',
    status: 'mastered',
    type: 'concept',
    mastery: 95,
    goals: ['理解深度优先与广度优先的核心思想', '掌握图遍历的基本代码框架']
  },
  {
    id: 'n2',
    title: '启发式搜索：贪心与 Dijkstra',
    status: 'mastered',
    type: 'concept',
    mastery: 85,
    goals: ['引入代价概念，理解 Dijkstra 算法', '掌握贪心最佳优先搜索']
  },
  {
    id: 'n3',
    title: '练习：Dijkstra 算法实战',
    status: 'mastered',
    type: 'practice',
    mastery: 90,
    goals: ['能独立完成基于 Dijkstra 的最短路径求解', '分析算法时间复杂度']
  },
  {
    id: 'n4',
    title: 'A* 搜索算法详解',
    status: 'in-progress',
    type: 'concept',
    mastery: 45,
    goals: ['理解 f(n) = g(n) + h(n) 评估函数', '掌握可采纳启发式（Admissible Heuristic）的概念'],
    reason: '针对当前目标核心概念'
  },
  {
    id: 'n5',
    title: '复习节点：优先队列实现机理',
    status: 'pending',
    type: 'review',
    mastery: 30,
    goals: ['回顾最小堆原理', '为 A* 算法的代码实操打好数据结构基础'],
    reason: '薄弱点：优先队列/堆机制掌握度不足',
    isNewAdjustment: true
  },
  {
    id: 'n6',
    title: '进阶：A* 在寻路中的应用',
    status: 'pending',
    type: 'concept',
    mastery: 0,
    goals: ['将 A* 运用到二维网格寻路中', '应对复杂障碍物地形']
  }
])

// 模拟动态调整通知
const adjustmentNotice = ref(true)

// ===== 抽屉状态与交互 =====
const drawerVisible = ref(false)
const selectedNode = ref<PathNode | null>(null)

const openDrawer = (node: PathNode) => {
  selectedNode.value = node
  drawerVisible.value = true
}

const goToStudio = () => {
  if (!selectedNode.value) return
  // 跳转到工作室，并可携带当前知识点参数
  router.push({ name: 'studio', query: { topic: selectedNode.value.title } })
}

const goToPractice = () => {
  router.push({ name: 'practice' })
}

// 辅助函数
const getStatusType = (status: NodeStatus) => {
  switch (status) {
    case 'mastered': return 'success'
    case 'in-progress': return 'primary'
    case 'pending': return 'info'
  }
}

const getStatusLabel = (status: NodeStatus) => {
  switch (status) {
    case 'mastered': return '已掌握'
    case 'in-progress': return '进行中'
    case 'pending': return '未学习'
  }
}

const getTimelineType = (node: PathNode) => {
  if (node.isNewAdjustment) return 'warning'
  if (node.status === 'mastered') return 'success'
  if (node.status === 'in-progress') return 'primary'
  return 'info'
}

const getTimelineIcon = (node: PathNode) => {
  if (node.isNewAdjustment) return Search
  if (node.status === 'mastered') return Medal
  if (node.type === 'concept') return Monitor
  if (node.type === 'practice') return VideoPlay
  return undefined
}
</script>

<template>
  <div class="h-full flex flex-col pt-2">
    <!-- 顶部状态栏 -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold" style="color: #1A1A2E;">学习路径规划</h1>
          <p class="text-sm mt-1" style="color: #8E8EA0;">根据你的画像实时动态生成的学习地图</p>
      </div>
      <el-button type="primary" :icon="Search" plain @click="drawerVisible = false">
        重新规划路径
      </el-button>
    </div>

    <!-- 动态调整通知卡（加分点：体现个性化与动态闭环） -->
        <el-alert
      v-if="adjustmentNotice"
      title="路径动态调整通知"
      type="warning"
      description="检测到前置练习中「数据结构/优先队列」正确率偏低，已为您自动插入相关的复习节点，以保障 A* 算法的学习效果。"
      show-icon
      class="mb-6"
      style="border: 1px solid #FFD9B3;"
      @close="adjustmentNotice = false"
    />

    <!-- 学习路径时间轴（主要内容） -->
    <el-card class="flex-1 overflow-auto" shadow="never">
      <div class="px-4 py-6 max-w-4xl mx-auto">
        <el-timeline>
          <el-timeline-item
            v-for="(node, index) in nodes"
            :key="node.id"
            :type="getTimelineType(node)"
            :icon="getTimelineIcon(node)"
            :size="node.status === 'in-progress' ? 'large' : 'normal'"
            :hollow="node.status === 'pending' && !node.isNewAdjustment"
            placement="top"
          >
            <!-- 节点卡片 -->
            <el-card
              shadow="hover"
              class="cursor-pointer transition-shadow"
              :class="{
                'ring-2 ring-primary-light': node.status === 'in-progress',
                'bg-warning-50': node.isNewAdjustment
              }"
              @click="openDrawer(node)"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <!-- 标题与状态标签 -->
                  <div class="flex items-center gap-3 mb-2">
                    <h3 class="text-lg font-medium text-gray-900" :class="{'text-gray-500': node.status === 'pending' && !node.isNewAdjustment}">
                      <span v-if="node.type === 'review'" class="mr-2 text-xl">🔄</span>
                      <span v-else-if="node.type === 'practice'" class="mr-2 text-xl">✍️</span>
                      <span v-else class="mr-2 text-xl">💡</span>
                      {{ node.title }}
                    </h3>
                    <el-tag :type="getStatusType(node.status)" size="small">
                      {{ getStatusLabel(node.status) }}
                    </el-tag>
                    <el-tag v-if="node.isNewAdjustment" type="warning" effect="dark" size="small">
                      新增调整
                    </el-tag>
                  </div>
                  
                  <!-- 个性化标签推荐原因 -->
                  <div v-if="node.reason" class="text-xs text-gray-500 flex items-center gap-1 mt-1 mb-3">
                    <el-icon><Monitor /></el-icon>
                    <span>{{ node.reason }}</span>
                  </div>

                  <!-- 掌握度进度条 -->
                  <div class="mt-4 flex items-center pr-6">
                    <span class="text-xs text-gray-500 w-16 mb-2">掌握度</span>
                    <el-progress 
                      :percentage="node.mastery" 
                      :status="node.mastery >= 80 ? 'success' : ''"
                      :stroke-width="8"
                      class="flex-1"
                    />
                  </div>
                </div>

                <!-- 快捷操作：当前进行中节点提示 -->
                <div v-if="node.status === 'in-progress'" class="ml-4 flex flex-col items-end">
                  <span class="text-xs font-semibold text-primary mb-2">当前位置</span>
                  <el-button type="primary" size="small" @click.stop="openDrawer(node)">
                    继续学习
                  </el-button>
                </div>
              </div>
            </el-card>
          </el-timeline-item>
        </el-timeline>
      </div>
    </el-card>

    <!-- 节点详情抽屉 -->
    <el-drawer
      v-model="drawerVisible"
      :title="selectedNode?.title || '节点详情'"
      direction="rtl"
      size="400px"
    >
      <div v-if="selectedNode" class="flex flex-col h-full">
        <!-- 基本状态信息 -->
        <div class="mb-6">
          <div class="flex items-center gap-2 mb-3">
            <el-tag :type="getStatusType(selectedNode.status)">
              {{ getStatusLabel(selectedNode.status) }}
            </el-tag>
            <el-tag v-if="selectedNode.type === 'practice'" type="info">实践练习</el-tag>
            <el-tag v-else-if="selectedNode.type === 'review'" type="warning">温故知新</el-tag>
            <el-tag v-else type="info">核心概念</el-tag>
          </div>
          <p v-if="selectedNode.reason" class="text-sm p-2 rounded" style="color: #5A3B00; background-color: #FFF3E6;">
                <strong>为何生成此节点：</strong>{{ selectedNode.reason }}
          </p>
        </div>

        <!-- 当前掌握度 -->
        <div class="mb-6">
          <h4 class="text-sm font-bold text-gray-900 mb-2">知识点掌握度预测</h4>
          <el-progress 
            :percentage="selectedNode.mastery" 
            :status="selectedNode.mastery >= 80 ? 'success' : ''"
            :stroke-width="10" 
          />
        </div>

        <!-- 学习目标清单 -->
        <div class="mb-6">
          <h4 class="text-sm font-bold text-gray-900 mb-2">本节学习目标</h4>
          <ul class="space-y-2">
            <li v-for="(goal, idx) in selectedNode.goals" :key="idx" class="flex flex-start gap-2 text-sm text-gray-700">
              <span class="text-primary mt-0.5">•</span>
              <span>{{ goal }}</span>
            </li>
          </ul>
        </div>

        <!-- 空间占位 -->
        <div class="flex-grow"></div>

        <!-- 操作区：联动工作室与练习 -->
        <div class="pt-4 border-t border-gray-100 flex gap-3">
          <el-button 
            type="primary" 
            class="flex-1"
            :disabled="selectedNode.status === 'mastered'"
            @click="goToStudio"
          >
            {{ selectedNode.status === 'pending' ? '预生成专属资源' : '进入资源工作室' }}
          </el-button>
          <el-button 
            v-if="selectedNode.type === 'practice' || selectedNode.status === 'in-progress'"
            class="flex-1"
            @click="goToPractice"
          >
            去做题测试
          </el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

