<template>
  <div class="library-view p-6 overflow-y-auto h-full">
    <!-- 页面标题和统计概览 -->
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-800 m-0">个人资源库</h2>
        <p class="text-sm text-slate-500 mt-1">历史生成的资源包存档，随时回看与回溯</p>
      </div>
      <div class="flex items-center gap-4 text-sm">
        <div class="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-100">
          <span class="text-slate-400">总计</span>
          <span class="font-bold text-primary text-lg">{{ filteredPacks.length }}</span>
          <span class="text-slate-500">个资源包</span>
        </div>
        <el-button type="primary" @click="$router.push('/studio')">
          <el-icon class="mr-1"><Plus /></el-icon>新建生成
        </el-button>
      </div>
    </div>

    <!-- 搜索与筛选区域 -->
    <el-card class="mb-6 shadow-sm" :body-style="{ padding: '16px 20px' }">
      <div class="flex items-center gap-4 flex-wrap">
        <el-input
          v-model="searchQuery"
          placeholder="搜索资源包（标题/知识点）..."
          :prefix-icon="Search"
          class="flex-1 min-w-[240px]"
          clearable
          @clear="searchQuery = ''"
        />
        <el-select v-model="sortOrder" class="w-36" placeholder="排序方式">
          <el-option label="最新优先" value="newest" />
          <el-option label="最早优先" value="oldest" />
          <el-option label="质量最高" value="quality" />
        </el-select>
        <el-select v-model="confidenceFilter" class="w-36" placeholder="置信度筛选" clearable>
          <el-option label="全部置信度" value="" />
          <el-option label="高置信度" value="high" />
          <el-option label="中置信度" value="medium" />
          <el-option label="低置信度" value="low" />
        </el-select>
      </div>
    </el-card>

    <!-- 空状态：未搜索到结果 -->
    <div v-if="filteredPacks.length === 0 && !loading" class="text-center py-16">
      <el-empty v-if="searchQuery || confidenceFilter" description="未找到匹配的资源包" />
      <div v-else class="bg-white rounded-lg border border-slate-200 border-dashed p-16 mx-auto max-w-lg">
        <el-icon class="text-5xl text-slate-300 mb-4"><FolderOpened /></el-icon>
        <h3 class="text-lg font-medium text-slate-600 mb-2">资源库为空</h3>
        <p class="text-sm text-slate-400 mb-6">先去资源工作室生成您的第一个学习资源包吧！</p>
        <el-button type="primary" size="large" @click="$router.push('/studio')">
          <el-icon class="mr-1"><MagicStick /></el-icon>前往工作室
        </el-button>
      </div>
    </div>

    <!-- 加载骨架屏 -->
    <div v-if="loading" class="space-y-4">
      <div v-for="n in 3" :key="n">
        <el-skeleton animated :rows="4" class="bg-white rounded-lg p-6" />
      </div>
    </div>

    <!-- 资源包列表 -->
    <div v-else-if="filteredPacks.length > 0" class="space-y-4">
      <TransitionGroup name="list">
        <el-card
          v-for="pack in filteredPacks"
          :key="pack.id"
          class="resource-pack-card shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30"
          :class="{ 'border-primary/30': activePackId === pack.id }"
          shadow="never"
          @click="selectPack(pack)"
        >
          <div class="flex items-start gap-5">
            <!-- 左侧：类型图标 + 时间线装饰 -->
            <div class="flex flex-col items-center pt-1">
              <div class="w-10 h-10 rounded-full flex items-center justify-center" :class="packIconClass(pack)">
                <el-icon class="text-lg"><component :is="packIcon(pack)" /></el-icon>
              </div>
              <div class="w-px h-full bg-slate-200 mt-2" v-if="false"></div>
            </div>

            <!-- 中间：主要内容区 -->
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <h4 class="text-base font-semibold m-0 text-slate-800 truncate">{{ pack.title }}</h4>
                  <p class="text-xs text-slate-400 mt-1 flex items-center gap-2">
                    <span>{{ pack.knowledgePoint }}</span>
                    <span class="w-1 h-1 rounded-full bg-slate-300 inline-block"></span>
                    <span>{{ formatDate(pack.createdAt) }}</span>
                  </p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <!-- 平均置信度胶囊 -->
                  <el-tag
                    size="small"
                    :type="avgConfidenceType(pack.avgConfidence)"
                    effect="plain"
                    class="px-3"
                  >
                    {{ pack.avgConfidence === 'high' ? '高' : pack.avgConfidence === 'medium' ? '中' : '低' }}置信度
                  </el-tag>
                  <!-- 活跃标记 -->
                  <el-tag v-if="pack.isActive" size="small" type="success" effect="light" class="px-3">
                    学习中
                  </el-tag>
                </div>
              </div>

              <!-- Meta 标签行 -->
              <div class="flex items-center gap-3 mt-3 text-xs text-slate-500">
                <span class="flex items-center gap-1">
                  <el-icon><Document /></el-icon>
                  {{ pack.resourceCount }} 个资源
                </span>
                <span class="flex items-center gap-1">
                  <el-icon><Star /></el-icon>
                  平均质量 {{ pack.avgQuality }}/100
                </span>
                <span class="flex items-center gap-1">
                  <el-icon><Clock /></el-icon>
                  预计 {{ pack.estimatedMinutes }} 分钟
                </span>
              </div>

              <!-- 资源类型标签云 -->
              <div class="flex flex-wrap gap-1.5 mt-3">
                <el-tag
                  v-for="type in pack.resourceTypes"
                  :key="type"
                  size="small"
                  :type="resourceTypeTagType(type)"
                  effect="plain"
                  class="text-xs"
                >
                  {{ resourceTypeLabel(type) }}
                </el-tag>
              </div>

              <!-- 推送理由（个性化感知） -->
              <div v-if="pack.pushReason" class="flex items-center gap-2 mt-2 text-xs">
                <el-icon class="text-warning" :size="14"><InfoFilled /></el-icon>
                <span class="text-slate-500">推送理由:</span>
                <span class="text-slate-600">{{ pack.pushReason }}</span>
              </div>

              <!-- 底部操作区：仅在展开时显示 -->
              <Transition name="expand">
                <div v-if="activePackId === pack.id" class="mt-4 pt-4 border-t border-slate-100">
                  <!-- 资源卡片网格 -->
                  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
                    <ResourceCard
                      v-for="res in pack.resources"
                      :key="res.id"
                      v-bind="res"
                      @preview="previewResource(res, pack)"
                      @view-sources="viewSources(res)"
                      @regenerate="regenerateResource(res, pack)"
                    />
                  </div>
                  <!-- 操作按钮组 -->
                  <div class="flex justify-end gap-2">
                    <el-button size="small" plain @click.stop="continueLearning(pack)">
                      <el-icon class="mr-1"><VideoPlay /></el-icon>继续学习
                    </el-button>
                    <el-button size="small" plain type="primary" @click.stop="openInStudio(pack)">
                      <el-icon class="mr-1"><Link /></el-icon>在工作站打开
                    </el-button>
                    <el-popconfirm
                      title="确定删除此资源包？"
                      confirm-button-text="删除"
                      @confirm.stop="deletePack(pack)"
                    >
                      <template #reference>
                        <el-button size="small" plain type="danger" @click.stop>
                          <el-icon class="mr-1"><Delete /></el-icon>删除
                        </el-button>
                      </template>
                    </el-popconfirm>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </el-card>
      </TransitionGroup>
    </div>

    <!-- 预览对话框（复用了工作室的预览组件风格） -->
    <el-dialog
      v-model="previewVisible"
      :title="currentPreview?.title || '资源预览'"
      width="70%"
      destroy-on-close
      class="resource-preview-dialog"
    >
      <div v-if="currentPreview" class="min-h-[300px]">
        <!-- 顶栏：速览/深入切换 + 可信字段 -->
        <div class="flex items-center gap-4 mb-4 pb-3 border-b border-slate-100">
          <el-radio-group v-model="previewMode" size="small">
            <el-radio-button label="brief">速览 (5分钟)</el-radio-button>
            <el-radio-button label="deep">深入 (20分钟)</el-radio-button>
          </el-radio-group>
          <div class="flex items-center gap-3 ml-auto text-sm">
            <el-tag size="small" :type="previewConfidenceStyle" effect="plain">
              {{ previewConfidenceLabel }}置信度
            </el-tag>
            <span class="text-slate-500">
              质量分 <strong class="text-primary">{{ currentPreview.qualityScore }}</strong>/100
            </span>
            <el-button link type="primary" size="small" @click="viewSources(currentPreview)">
              查看引用证据
            </el-button>
          </div>
        </div>

                <!-- 内容体：根据类型渲染 -->
          <div class="min-h-[200px]">
            <!-- 思维导图 -->
            <div v-if="currentPreview.type === 'mindmap'" class="h-96 border border-slate-200 rounded-lg overflow-hidden">
              <MindmapViewer
                :content="previewMode === 'brief' ? currentPreview.brief || '# 暂无内容' : currentPreview.deepContent || currentPreview.brief || '# 暂无内容'"
              />
            </div>
            <!-- 练习题：用 Markdown 展示 -->
            <div v-else-if="currentPreview.type === 'quiz'" class="space-y-4">
              <MarkdownViewer
                :content="previewMode === 'brief' ? currentPreview.brief || '暂无内容' : currentPreview.deepContent || currentPreview.brief || '暂无内容'"
                :showToc="false"
              />
            </div>
            <!-- 代码案例：代码块高亮 -->
            <div v-else-if="currentPreview.type === 'code'" class="border border-slate-200 rounded-lg overflow-hidden">
              <MarkdownViewer
                :content="'```python\n' + (previewMode === 'brief' ? currentPreview.brief || '' : currentPreview.deepContent || currentPreview.brief || '') + '\n```'"
                :showToc="false"
              />
            </div>
            <!-- 视频脚本：Markdown 渲染 -->
            <div v-else-if="currentPreview.type === 'video_script'" class="">
              <MarkdownViewer
                :content="'## 视频脚本\n\n' + (previewMode === 'brief' ? currentPreview.brief || '暂无内容' : currentPreview.deepContent || currentPreview.brief || '暂无内容')"
                :showToc="false"
              />
            </div>
            <!-- 默认（doc/reading 等）：完整 Markdown 渲染 -->
            <div v-else class="">
              <MarkdownViewer
                :content="previewMode === 'brief' ? currentPreview.brief || '暂无内容' : currentPreview.deepContent || currentPreview.brief || '暂无内容'"
                :showToc="previewMode === 'deep'"
              />
            </div>
          </div>

        <!-- 证据来源（内嵌折叠版） -->
        <div v-if="currentPreview.sources && currentPreview.sources.length > 0" class="mt-6 pt-4 border-t border-slate-100">
          <div class="flex items-center gap-2 mb-3">
            <el-icon class="text-primary"><Reading /></el-icon>
            <span class="text-sm font-medium">引用来源 ({{ currentPreview.sources.length }})</span>
          </div>
          <div class="space-y-2">
            <div
              v-for="(source, idx) in currentPreview.sources"
              :key="idx"
              class="bg-slate-50 border border-slate-200 rounded p-3 text-sm"
            >
              <div class="flex justify-between items-start mb-1">
                <span class="font-medium text-slate-700">{{ source.title }}</span>
                <el-tag size="small" type="info">{{ source.locator }}</el-tag>
              </div>
              <p class="text-slate-500 text-xs italic m-0">"{{ source.quote }}"</p>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="previewVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 证据抽屉 -->
    <EvidenceDrawer ref="evidenceDrawer" />

    <!-- 删除/无更多数据提示 -->
    <div v-if="filteredPacks.length > 0 && !loading" class="text-center text-xs text-slate-400 py-6">
      — 共 {{ filteredPacks.length }} 个资源包 —
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, markRaw } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Search,
  Plus,
  MagicStick,
  FolderOpened,
  Document,
  Star,
  Clock,
  InfoFilled,
  VideoPlay,
  Link,
  Delete,
  Share,
  Reading,
  DataBoard,
} from '@element-plus/icons-vue'
import type { ResourcePack, ResourceItem } from '@/types'
import ResourceCard from '@/components/ResourceCard.vue'
import EvidenceDrawer from '@/components/EvidenceDrawer.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import MindmapViewer from '@/components/MindmapViewer.vue'

const router = useRouter()

// ==================== 状态 ====================
const searchQuery = ref('')
const sortOrder = ref('newest')
const confidenceFilter = ref('')
const loading = ref(false)
const activePackId = ref<string | null>(null)

// 预览状态
const previewVisible = ref(false)
const currentPreview = ref<any>(null)
const previewMode = ref('brief')

const evidenceDrawer = ref<any>(null)

// ==================== Mock 数据 ====================
const packList = reactive<ResourcePack[]>([
  {
    id: 'pack-001',
    title: 'A* 搜索算法全面解析',
    knowledgePoint: 'A* 搜索算法',
    createdAt: '2025-12-15T09:30:00Z',
    avgConfidence: 'high',
    avgQuality: 91,
    resourceCount: 5,
    estimatedMinutes: 45,
    isActive: true,
    pushReason: '针对薄弱点「启发式搜索」；偏好代码实操',
    resourceTypes: ['doc', 'mindmap', 'quiz', 'reading', 'code'],
    resources: [
      {
        id: 'res-001-1', title: 'A* 搜索算法核心讲解', type: 'doc', status: 'ready',
        confidence: 'high', sourcesCount: 6, qualityScore: 92,
        brief: '系统讲解 A* 搜索的核心原理：启发函数、代价计算、开闭集管理与最优性证明。结合图示分步拆解算法流程。',
        deepContent: '# A* 搜索算法\n\n## 1. 基本原理\nA* (A-Star) 是一种启发式搜索算法...\n\n## 2. 启发函数设计\n满足可采纳性（Admissible）和一致性（Consistent）...\n\n## 3. 算法伪代码与复杂度分析...',
        pushReasons: ['针对薄弱点：启发式搜索', '偏好：理论优先'],
        sources: [
          { title: '人工智能：一种现代方法', locator: 'Ch 3.5', quote: 'A* 搜索使用估价函数 f(n) = g(n) + h(n) 来评估节点。', relevance: 'high' },
          { title: '算法导论 第4版', locator: 'Ch 22.3', quote: '启发函数 h 满足可采纳性时，A* 保证找到最优解。', relevance: 'high' },
          { title: '大话数据结构', locator: 'Pg 124', quote: 'A* 在游戏寻路中广泛使用，通过启发函数减少搜索空间。', relevance: 'medium' }
        ]
      },
      {
        id: 'res-001-2', title: '搜索算法家族思维导图', type: 'mindmap', status: 'ready',
        confidence: 'high', sourcesCount: 3, qualityScore: 88,
        brief: '以思维导图形式梳理搜索算法分类：盲目搜索 vs 启发式搜索，DFS/BFS/A* 等对比。',
        deepContent: '# 搜索算法\n- 盲目搜索\n  - DFS\n  - BFS\n  - 迭代加深\n- 启发式搜索\n  - A*\n  - IDA*\n  - 贪心最佳优先',
        pushReasons: ['薄弱点：搜索算法分类', '节奏：速览版适合复习'],
        sources: [
          { title: '搜索算法综述', locator: '知识库', quote: '搜索算法分为盲目搜索和启发式搜索两大类。', relevance: 'high' }
        ]
      },
      {
        id: 'res-001-3', title: '基础概念与变式练习', type: 'quiz', status: 'ready',
        confidence: 'high', sourcesCount: 4, qualityScore: 95,
        brief: '包含 8 道精选练习题，覆盖 A* 核心概念、启发函数设计与算法追踪。',
        deepContent: '## 练习题集\n### 选择题\n1. A* 搜索中 f(n) 代表什么？\n2. 启发函数 h(n) 需满足什么条件？\n### 填空题\n3. A* 是 ___ 搜索和 ___ 搜索的结合。',
        pushReasons: ['薄弱点：算法理解', '偏好评测结合'],
        sources: [
          { title: '算法题库', locator: 'A* 专题', quote: '经典 A* 算法面试题整理。', relevance: 'high' }
        ]
      },
      {
        id: 'res-001-4', title: 'A* 演进史与高阶应用', type: 'reading', status: 'ready',
        confidence: 'medium', sourcesCount: 2, qualityScore: 78,
        brief: '拓展阅读：A* 的改进变种（IDA*, D* Lite）及在自动驾驶路径规划中的应用案例。',
        pushReasons: ['节奏：深入版适合拓展', '兴趣方向：AI 应用'],
        sources: [
          { title: '机器人路径规划综述', locator: 'Section 4', quote: 'D* Lite 在动态环境中高效重规划路径。', relevance: 'medium' }
        ]
      },
      {
        id: 'res-001-5', title: '迷宫寻路实战案例', type: 'code', status: 'ready',
        confidence: 'high', sourcesCount: 5, qualityScore: 90,
        brief: 'Python 实现 A* 算法求解迷宫最短路径，附带可视化与性能对比。',
        deepContent: '```python\nimport heapq\n\ndef astar(grid, start, goal):\n    open_set = [(0, start)]\n    came_from = {}\n    g_score = {start: 0}\n    f_score = {start: heuristic(start, goal)}\n    ...\n```',
        pushReasons: ['偏好：代码实操优先', '薄弱点：算法实现'],
        sources: [
          { title: 'Python 算法实现示例集', locator: '搜索算法', quote: 'A* 的 Python 实现通常使用优先队列。', relevance: 'high' }
        ]
      }
    ]
  },
  {
    id: 'pack-002',
    title: 'Vue3 响应式原理与组合式 API',
    knowledgePoint: 'Vue3 响应式原理',
    createdAt: '2025-12-10T14:00:00Z',
    avgConfidence: 'high',
    avgQuality: 87,
    resourceCount: 4,
    estimatedMinutes: 35,
    isActive: true,
    pushReason: '当前学习阶段核心课题；偏好实战理解',
    resourceTypes: ['doc', 'mindmap', 'quiz', 'code'],
    resources: [
      {
        id: 'res-002-1', title: '响应式原理深入讲解', type: 'doc', status: 'ready',
        confidence: 'high', sourcesCount: 5, qualityScore: 90,
        brief: '深入剖析 Vue3 响应式系统的实现机制：Proxy、ref、reactive、依赖收集与触发更新。',
        pushReasons: ['核心知识点', '偏好：理论+代码结合'],
        sources: [
          { title: 'Vue3 官方文档', locator: '响应式基础', quote: 'Vue 使用 Proxy 实现响应式数据。', relevance: 'high' }
        ]
      },
      {
        id: 'res-002-2', title: '响应式 vs 非响应式', type: 'mindmap', status: 'ready',
        confidence: 'high', sourcesCount: 2, qualityScore: 85,
        brief: 'Vue2 Object.defineProperty vs Vue3 Proxy 对比导图。',
        pushReasons: ['薄弱点：底层原理'],
        sources: []
      },
      {
        id: 'res-002-3', title: '响应式原理随堂练习', type: 'quiz', status: 'ready',
        confidence: 'high', sourcesCount: 3, qualityScore: 92,
        brief: '6 题掌握 ref/reactive/watchEffect 的核心用法与陷阱。',
        pushReasons: ['偏好评测结合'],
        sources: []
      },
      {
        id: 'res-002-4', title: '手写简易响应式系统', type: 'code', status: 'ready',
        confidence: 'medium', sourcesCount: 4, qualityScore: 82,
        brief: '从零实现一个简易的响应式系统，理解 Dep-Watcher 模式。',
        pushReasons: ['偏好：代码实操', '薄弱点：实现细节'],
        sources: []
      }
    ]
  },
  {
    id: 'pack-003',
    title: '二叉树遍历与递归思维',
    knowledgePoint: '二叉树遍历',
    createdAt: '2025-11-28T11:15:00Z',
    avgConfidence: 'medium',
    avgQuality: 76,
    resourceCount: 3,
    estimatedMinutes: 25,
    isActive: false,
    pushReason: '前置知识巩固；检测到递归薄弱',
    resourceTypes: ['doc', 'quiz', 'code'],
    resources: [
      {
        id: 'res-003-1', title: '二叉树遍历全解', type: 'doc', status: 'ready',
        confidence: 'medium', sourcesCount: 3, qualityScore: 80,
        brief: '前序/中序/后序/层序遍历详解，递归与迭代双版本。',
        pushReasons: ['薄弱点：递归实现'],
        sources: []
      },
      {
        id: 'res-003-2', title: '遍历专项练习', type: 'quiz', status: 'ready',
        confidence: 'high', sourcesCount: 2, qualityScore: 78,
        brief: '5 道遍历顺序推导题，强化递归思维。',
        pushReasons: ['薄弱点：递归'],
        sources: []
      },
      {
        id: 'res-003-3', title: '二叉树遍历实现', type: 'code', status: 'rejected',
        confidence: 'low', sourcesCount: 1, qualityScore: 55,
        brief: 'Python 实现四种遍历方式，包含递归与迭代。',
        rejectReason: 'Reviewer: 迭代版解释不够清晰，缺少 Morris 遍历。',
        pushReasons: ['偏好：代码实操'],
        sources: []
      }
    ]
  },
  {
    id: 'pack-004',
    title: 'HTTP 协议与 RESTful API 设计',
    knowledgePoint: 'HTTP 协议',
    createdAt: '2025-11-20T16:45:00Z',
    avgConfidence: 'high',
    avgQuality: 94,
    resourceCount: 5,
    estimatedMinutes: 50,
    isActive: false,
    pushReason: '项目实战需要；兴趣方向：后端开发',
    resourceTypes: ['doc', 'mindmap', 'quiz', 'reading', 'video_script'],
    resources: [
      {
        id: 'res-004-1', title: 'HTTP 核心概念精讲', type: 'doc', status: 'ready',
        confidence: 'high', sourcesCount: 7, qualityScore: 95,
        brief: 'HTTP 协议发展史、请求/响应结构、状态码、缓存机制与 HTTPS 握手。',
        pushReasons: ['核心基础', '兴趣方向'],
        sources: []
      },
      {
        id: 'res-004-2', title: 'API 设计规范导图', type: 'mindmap', status: 'ready',
        confidence: 'high', sourcesCount: 3, qualityScore: 90,
        brief: 'RESTful API 设计原则：资源命名、HTTP 动词、状态码规范。',
        pushReasons: ['偏好：体系化学习'],
        sources: []
      },
      {
        id: 'res-004-3', title: 'HTTP 协议练习题', type: 'quiz', status: 'ready',
        confidence: 'high', sourcesCount: 4, qualityScore: 93,
        brief: '10 题涵盖 HTTP 状态码、缓存策略与 HTTPS 原理。',
        pushReasons: ['偏好评测结合'],
        sources: []
      },
      {
        id: 'res-004-4', title: 'HTTP/2 与 HTTP/3 新特性', type: 'reading', status: 'ready',
        confidence: 'high', sourcesCount: 5, qualityScore: 96,
        brief: '多路复用、头部压缩、服务端推送与 QUIC 协议简介。',
        pushReasons: ['节奏：深入版'],
        sources: []
      },
      {
        id: 'res-004-5', title: '从 HTTP/1.1 到 HTTP/3 演进', type: 'video_script', status: 'ready',
        confidence: 'medium', sourcesCount: 3, qualityScore: 85,
        brief: '视频脚本：生动讲解 HTTP 各版本的演进与核心改进点。',
        pushReasons: ['偏好：视频学习'],
        sources: []
      }
    ]
  },
  {
    id: 'pack-005',
    title: '数据库索引原理与优化',
    knowledgePoint: '数据库索引',
    createdAt: '2025-11-05T08:30:00Z',
    avgConfidence: 'medium',
    avgQuality: 72,
    resourceCount: 3,
    estimatedMinutes: 30,
    isActive: false,
    pushReason: '项目性能优化需要',
    resourceTypes: ['doc', 'quiz', 'code'],
    resources: [
      {
        id: 'res-005-1', title: 'B+ 树索引详解', type: 'doc', status: 'ready',
        confidence: 'medium', sourcesCount: 4, qualityScore: 75,
        brief: 'B+ 树的结构、索引类型、聚簇索引与非聚簇索引对比。',
        pushReasons: ['薄弱点：索引结构'],
        sources: []
      },
      {
        id: 'res-005-2', title: '索引优化练习', type: 'quiz', status: 'ready',
        confidence: 'medium', sourcesCount: 2, qualityScore: 70,
        brief: '通过 EXPLAIN 分析查询计划，判断索引使用情况。',
        pushReasons: ['薄弱点：优化实践'],
        sources: []
      },
      {
        id: 'res-005-3', title: '慢查询优化实战', type: 'code', status: 'failed',
        confidence: 'low', sourcesCount: 1, qualityScore: 60,
        brief: '模拟慢查询场景，添加索引前后性能对比分析。',
        rejectReason: '生成失败：数据库连接超时',
        pushReasons: ['偏好：代码实操'],
        sources: []
      }
    ]
  }
])

// ==================== 计算属性 ====================
const filteredPacks = computed(() => {
  let list = [...packList]

  // 搜索过滤（按标题或知识点）
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(
      p =>
        p.title.toLowerCase().includes(q) ||
        p.knowledgePoint.toLowerCase().includes(q)
    )
  }

  // 置信度过滤
  if (confidenceFilter.value) {
    list = list.filter(p => p.avgConfidence === confidenceFilter.value)
  }

  // 排序
  switch (sortOrder.value) {
    case 'newest':
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      break
    case 'oldest':
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      break
    case 'quality':
      list.sort((a, b) => b.avgQuality - a.avgQuality)
      break
  }

  return list
})

const previewConfidenceStyle = computed(() => {
  if (!currentPreview.value) return 'info'
  const map: Record<string, string> = { high: 'success', medium: 'warning', low: 'danger' }
  return map[currentPreview.value.confidence] || 'info'
})

const previewConfidenceLabel = computed(() => {
  if (!currentPreview.value) return '未知'
  const map: Record<string, string> = { high: '高', medium: '中', low: '低' }
  return map[currentPreview.value.confidence] || '未知'
})

// ==================== 方法 ====================
const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return '今天 ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return '昨天 ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (days < 7) return `${days} 天前`
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const selectPack = (pack: ResourcePack) => {
  activePackId.value = activePackId.value === pack.id ? null : pack.id
}

const packIconClass = (pack: ResourcePack) => {
  if (pack.avgConfidence === 'high') return 'bg-success/10 text-success'
  if (pack.avgConfidence === 'medium') return 'bg-warning/10 text-warning'
  return 'bg-danger/10 text-danger'
}

const packIcon = (pack: ResourcePack) => {
  return markRaw(DataBoard)
}

const avgConfidenceType = (conf: string) => {
  const map: Record<string, string> = { high: 'success', medium: 'warning', low: 'danger' }
  return map[conf] || 'info'
}

const resourceTypeTagType = (type: string) => {
  const map: Record<string, string> = {
    doc: 'primary',
    mindmap: 'warning',
    quiz: 'success',
    reading: 'info',
    code: 'danger',
    video_script: 'default'
  }
  return map[type] || 'info'
}

const resourceTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    doc: '讲解文档',
    mindmap: '思维导图',
    quiz: '练习题',
    reading: '拓展阅读',
    code: '代码案例',
    video_script: '视频脚本'
  }
  return map[type] || type
}

const previewResource = (res: any, pack: ResourcePack) => {
  currentPreview.value = res
  previewMode.value = 'brief'
  previewVisible.value = true
}

const viewSources = (res: any) => {
  if (res.sources && res.sources.length > 0) {
    evidenceDrawer.value?.open(res.sources)
  } else {
    evidenceDrawer.value?.open([
      { title: 'AI 合成来源', locator: 'System', quote: '此内容基于基础知识和学习者画像重新生成。' }
    ])
  }
}

const regenerateResource = (res: any, pack: ResourcePack) => {
  res.status = 'loading'
  ElMessage.info(`正在重新生成「${res.title}」...`)
  setTimeout(() => {
    res.status = 'ready'
    res.confidence = 'high'
    res.sourcesCount = Math.floor(Math.random() * 4) + 2
    res.qualityScore = Math.floor(Math.random() * 10) + 85
    res.rejectReason = undefined
    ElMessage.success(`「${res.title}」重生成完成！`)
  }, 2000)
}

const continueLearning = (pack: ResourcePack) => {
  router.push(`/path?pack=${pack.id}`)
}

const openInStudio = (pack: ResourcePack) => {
  router.push(`/studio?pack=${pack.id}`)
}

const deletePack = (pack: ResourcePack) => {
  const idx = packList.findIndex(p => p.id === pack.id)
  if (idx !== -1) {
    packList.splice(idx, 1)
    if (activePackId.value === pack.id) {
      activePackId.value = null
    }
    ElMessage.success(`已删除资源包「${pack.title}」`)
  }
}
</script>

<style scoped>
.library-view {
  max-width: 1400px;
}

.resource-pack-card {
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  transition: all 0.2s ease;
}

.resource-pack-card:hover {
  border-color: var(--el-color-primary-light-3);
}

.resource-pack-card:active {
  transform: scale(0.997);
}

/* 列表动画 */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}
.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

/* 展开动画 */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0 !important;
  padding-top: 0 !important;
}
.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 2000px;
}

/* 预览对话框微调 */
:deep(.resource-preview-dialog .el-dialog__body) {
  padding-top: 16px;
}
</style>
