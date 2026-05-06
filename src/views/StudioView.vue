<template>
  <div class="studio-view p-6">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold text-slate-800 m-0">资源生成工作室</h2>
      <el-button type="primary" :disabled="isGenerating" @click="startGenerate">开始生成资源包</el-button>
    </div>

    <!-- Controls -->
    <el-card class="mb-6 shadow-sm">
      <el-form :inline="true" :model="form" class="-mb-5">
        <el-form-item label="关联课程">
          <el-select v-model="form.course" class="w-48">
            <el-option label="计算机基础与数据结构" value="cs101" />
            <el-option label="前端开发进阶" value="fe201" />
          </el-select>
        </el-form-item>
        <el-form-item label="知识点">
          <el-select v-model="form.topic" class="w-48" allow-create filterable>
            <el-option label="A* 搜索算法" value="astar" />
            <el-option label="Vue3 响应式原理" value="vue-reactivity" />
          </el-select>
        </el-form-item>
        <el-form-item label="资源类型">
          <el-checkbox-group v-model="form.types">
            <el-checkbox label="doc">讲解文档</el-checkbox>
            <el-checkbox label="mindmap">思维导图</el-checkbox>
            <el-checkbox label="quiz">练习题</el-checkbox>
            <el-checkbox label="reading">拓展阅读</el-checkbox>
            <el-checkbox label="code">代码案例</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- Pipeline -->
    <PipelineStepper 
      v-if="taskId || isGenerating"
      :taskId="taskId"
      :stage="currentStage"
      :percent="currentPercent"
      :message="currentMessage"
      class="mb-6"
    />

    <!-- Resource Cards grid -->
    <div v-if="hasStarted" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <ResourceCard
        v-for="res in resources"
        :key="res.id"
        v-bind="res"
        @preview="previewResource(res)"
        @view-sources="viewSources(res)"
        @regenerate="regenerateResource(res)"
      />
    </div>

    <!-- Empty State prior to generation -->
    <div v-else class="text-center py-20 bg-white rounded-lg border border-slate-200 border-dashed">
      <el-icon class="text-4xl text-slate-300 mb-4"><MagicStick /></el-icon>
      <h3 class="text-lg font-medium text-slate-600 mb-2">配置选项以生成专属学习资源</h3>
      <p class="text-sm text-slate-400">基于多智能体协同，根据您的个人画像提供定制化讲解与练习。</p>
    </div>

    <!-- Detail Dialog (Simplified Preview) -->
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
        
                <!-- 按资源类型渲染 -->
        <div v-if="currentPreview.type === 'mindmap'" class="h-96 border border-slate-200 rounded-lg overflow-hidden">
          <MindmapViewer
            :content="previewMode === 'brief' ? currentPreview.brief || '暂无内容' : currentPreview.deepContent || currentPreview.brief || '暂无内容'"
          />
        </div>
        <div v-else-if="currentPreview.type === 'code'" class="bg-slate-50 rounded-lg overflow-hidden">
          <MarkdownViewer
            :content="'```python\n' + (previewMode === 'brief' ? currentPreview.brief || '暂无内容' : currentPreview.deepContent || currentPreview.brief || '暂无内容') + '\n```'"
            :showToc="false"
          />
        </div>
        <div v-else class="">
          <MarkdownViewer
            :content="previewMode === 'brief' ? currentPreview.brief || '暂无内容' : currentPreview.deepContent || currentPreview.brief || '暂无内容'"
            :showToc="previewMode === 'deep'"
          />
        </div>
      </div>
    </el-dialog>

    <EvidenceDrawer ref="evidenceDrawer" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { MagicStick } from '@element-plus/icons-vue'
import PipelineStepper from '../components/PipelineStepper.vue'
import ResourceCard from '../components/ResourceCard.vue'
import EvidenceDrawer from '../components/EvidenceDrawer.vue'
import MarkdownViewer from '../components/MarkdownViewer.vue'
import MindmapViewer from '../components/MindmapViewer.vue'

const form = reactive({
  course: 'cs101',
  topic: 'astar',
  types: ['doc', 'mindmap', 'quiz', 'reading', 'code']
})

const hasStarted = ref(false)
const isGenerating = ref(false)
const taskId = ref('')
const currentStage = ref('profile')
const currentPercent = ref(0)
const currentMessage = ref('')

const resources = ref<any[]>([])
const evidenceDrawer = ref<any>(null)

const previewVisible = ref(false)
const currentPreview = ref<any>(null)
const previewMode = ref('brief')

// Mock Generation Flow
const startGenerate = () => {
  hasStarted.value = true
  isGenerating.value = true
  taskId.value = 'TSK-' + Math.random().toString(36).substring(2, 8).toUpperCase()
  
  // init skeletons
  resources.value = form.types.map((type, i) => ({
    id: `res-${i}`,
    title: type === 'doc' ? 'A* 搜索算法核心讲解' : 
           type === 'quiz' ? '基础概念与变式练习' : 
           type === 'code' ? '实战：迷宫寻路探秘' : 
           type === 'mindmap' ? '概念导图：搜索算法家族' : 'A* 演进史与高阶应用',
    type,
    status: 'loading'
  }))

  const stages = [
    { s: 'profile', p: 100, m: '获取并分析用户画像特征...', time: 800 },
    { s: 'retrieve', p: 40, m: '从知识库检索前置知识片段...', time: 1000 },
    { s: 'retrieve', p: 100, m: '召回完成 (Top 12 核心切片)', time: 800 },
    { s: 'plan', p: 100, m: '拆解知识点，规划生成顺序...', time: 1000 },
    { s: 'generate', p: 30, m: '多 Agent 生成中: 讲解文档 / 代码案例...', time: 1500, action: () => completeResource(0) },
    { s: 'generate', p: 70, m: '多 Agent 生成中: 练习题 / 知识导图...', time: 1500, action: () => { completeResource(1); completeResource(2); completeResource(4); } },
    { s: 'generate', p: 100, m: '生成阶段完毕', time: 800 },
    { s: 'review', p: 50, m: '交叉审校检查幻觉与依赖...', time: 1200 },
    { s: 'review', p: 100, m: '完成审查，1个文档被驳回重制', time: 800, action: () => rejectResource(3) },
    { s: 'publish', p: 100, m: '资源就绪', time: 500, end: true }
  ]

  let delay = 0
  stages.forEach(stageDef => {
    delay += stageDef.time
    setTimeout(() => {
      currentStage.value = stageDef.s
      currentPercent.value = stageDef.p
      currentMessage.value = stageDef.m
      if (stageDef.action) stageDef.action()
      if (stageDef.end) isGenerating.value = false
    }, delay)
  })
}

const completeResource = (index: number) => {
  if (resources.value[index]) {
    const res = resources.value[index]
    res.status = 'ready'
    res.confidence = 'high'
    res.sourcesCount = Math.floor(Math.random() * 5) + 2
    res.qualityScore = Math.floor(Math.random() * 15) + 85
    res.pushReasons = ['针对薄弱点', '偏好：代码实操']
    res.brief = `这是为您量身定制的${res.title}，结合了您的最新掌握情况和学习习惯。预计花费 5-8 分钟即可掌握核心概念。`
    res.deepContent = `## ${res.title}\n深入内容...\n这里会是详尽的分层解释与示例。`
    res.sources = [
      { title: '大话数据结构', locator: 'Pg 124', quote: 'A* 搜索在节点计算时的启发式方程...对于代价敏感场景较优。', relevance: 'high' },
      { title: '算法导论 第4版', locator: 'Ch 22.3', quote: 'Dijkstra 是特例...通过启发函数降低展开节点数。', relevance: 'medium' }
    ]
  }
}

const rejectResource = (index: number) => {
  if (resources.value[index]) {
    const res = resources.value[index]
    res.status = 'rejected'
    res.rejectReason = 'Reviewer: 引用覆盖率偏低，缺少具体的算法边界条件示例。'
  }
}

const regenerateResource = (res: any) => {
  res.status = 'loading'
  setTimeout(() => {
    completeResource(resources.value.findIndex(r => r.id === res.id))
  }, 2000)
}

const previewResource = (res: any) => {
  currentPreview.value = res
  previewMode.value = 'brief'
  previewVisible.value = true
}

const viewSources = (res: any) => {
  if (res.sources) {
    evidenceDrawer.value?.open(res.sources)
  } else {
    evidenceDrawer.value?.open([
      { title: 'AI 合成来源', locator: 'System', quote: '此内容在基础知识之上根据偏好重新生成。' }
    ])
  }
}
</script>
