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
        <el-button :type="isBatchMode ? 'warning' : 'default'" plain size="small" @click="toggleBatchMode">
          {{ isBatchMode ? '退出批量' : '批量管理' }}
        </el-button>
        <el-button type="primary" @click="$router.push('/studio')">
          <el-icon class="mr-1"><Plus /></el-icon>新建生成
        </el-button>
      </div>
    </div>

    <!-- 批量操作栏 -->
    <div v-if="isBatchMode" class="batch-action-bar mb-4">
      <el-checkbox
        :model-value="selectedPackIds.size === filteredPacks.length && filteredPacks.length > 0"
        :indeterminate="selectedPackIds.size > 0 && selectedPackIds.size < filteredPacks.length"
        @change="selectAllPacks"
      >
        全选
      </el-checkbox>
      <span class="text-sm" style="color: var(--lt-text-auxiliary);">已选 {{ selectedPackIds.size }} 项</span>
      <el-popconfirm
        title="确定删除选中的资源包？此操作不可恢复"
        confirm-button-text="确认删除"
        @confirm="batchDelete"
      >
        <template #reference>
          <el-button size="small" type="danger" plain :disabled="selectedPackIds.size === 0">
            <el-icon class="mr-1"><Delete /></el-icon>批量删除
          </el-button>
        </template>
      </el-popconfirm>
    </div>

    <!-- 搜索与筛选区域 -->
    <el-card class="mb-6 shadow-sm" :body-style="{ padding: '16px 20px' }" style="border: 1px solid var(--lt-border);">
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
            <div v-else class="bg-white rounded-lg p-16 mx-auto max-w-lg" style="border: 1px dashed var(--lt-brand-lighter);">
        <el-icon class="text-5xl mb-4" style="color: var(--lt-brand-lighter);"><FolderOpened /></el-icon>
        <h3 class="text-lg font-medium mb-2" style="color: var(--lt-text-secondary);">资源库为空</h3>
        <p class="text-sm mb-6" style="color: var(--lt-text-placeholder);">先去资源工作室生成您的第一个学习资源包吧！</p>
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

    <!-- 加载失败重试 -->
    <div v-if="loadError && !loading" class="text-center py-16">
      <el-empty description="加载失败">
        <template #default>
          <el-button type="primary" @click="retryLoadPacks">重新加载</el-button>
        </template>
      </el-empty>
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
            <!-- 批量选择框 -->
            <el-checkbox
              v-if="isBatchMode"
              :model-value="selectedPackIds.has(pack.id)"
              class="mt-1 shrink-0"
              @click.stop
              @change="togglePackSelection(pack.id)"
            />
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
                <div v-if="activePackId === pack.id" class="mt-4 pt-4" style="border-top: 1px solid var(--lt-border);">
                  <!-- 资源卡片网格 -->
                  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
                    <ResourceCard
                      v-for="res in pack.resources"
                      :key="res.id"
                      v-bind="res"
                      @preview="previewResource(res, pack)"
                      @view-sources="viewSources(res)"
                      @regenerate="regenerateResource(res, pack)"
                      @download="downloadVideoResource(res)"
                  /></div>
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
            <span style="color: var(--lt-text-auxiliary);">
              质量分 <strong style="color: var(--lt-brand);">{{ currentPreview.qualityScore }}</strong>/100
            </span>
            <el-dropdown v-if="currentPreview.type === 'doc' || currentPreview.type === 'reading'" size="small" @command="(cmd: string) => cmd === 'docx' ? downloadDocxResource(currentPreview) : downloadMdResource(currentPreview)">
              <el-button size="small" type="primary">
                <el-icon class="mr-1"><Download /></el-icon>下载 <el-icon class="ml-1"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="docx">下载 DOCX</el-dropdown-item>
                  <el-dropdown-item command="md">下载 Markdown</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button link type="primary" size="small" @click="viewSources(currentPreview)">
              查看引用证据
            </el-button>
          </div>
        </div>

                <!-- 内容体：根据类型渲染 -->
          <div class="min-h-[200px]">
            <!-- 思维导图 -->
            <div v-if="currentPreview.type === 'mindmap'" class="h-[600px] border border-slate-200 rounded-lg">
              <MindmapViewer
                ref="mindmapViewerRef"
                :content="previewMode === 'brief' ? currentPreview.brief || '# 暂无内容' : currentPreview.deepContent || currentPreview.brief || '# 暂无内容'"
                :isJson="true"
            />
            </div>
            <!-- 导出按钮 -->
            <div v-if="currentPreview.type === 'mindmap'" class="flex gap-2 mt-3">
              <el-button size="small" @click="mindmapViewerRef?.exportSvg(currentPreview.title + '.svg')">
                <el-icon class="mr-1"><Download /></el-icon>导出 SVG
              </el-button>
              <el-button size="small" @click="mindmapViewerRef?.exportPng(currentPreview.title + '.png')">
                <el-icon class="mr-1"><Download /></el-icon>导出 PNG
              </el-button>
            </div>
            <!-- 练习题：用 Markdown 展示 -->
            <div v-else-if="currentPreview.type === 'quiz'" class="space-y-4">
              <MarkdownViewer
                :content="previewMode === 'brief' ? currentPreview.brief || '暂无内容' : currentPreview.deepContent || currentPreview.brief || '暂无内容'"
                :showToc="false"
              />
            </div>
            <!-- 代码案例 -->
            <div v-else-if="currentPreview.type === 'code'">
              <CodeLearningViewer
                :content="previewMode === 'brief' ? currentPreview.brief || '' : currentPreview.deepContent || currentPreview.brief || ''"
                :title="currentPreview.title"
                :quality-score="currentPreview.qualityScore"
                :sources-count="currentPreview.sourcesCount"
              />
            </div>
            <!-- 视频：HTML5 播放器 -->
            <div v-else-if="currentPreview.type === 'video'" class="rounded-lg overflow-hidden bg-black">
              <video v-if="videoPreviewUrl" :src="videoPreviewUrl" controls class="w-full" style="max-height: 500px;" />
              <div v-else class="flex items-center justify-center py-16" style="color: var(--lt-text-auxiliary);">
                <span>视频正在生成或 URL 暂不可用</span>
              </div>
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
        <div v-if="currentPreview.sources && currentPreview.sources.length > 0" class="mt-6 pt-4" style="border-top: 1px solid var(--lt-border);">
          <div class="flex items-center gap-2 mb-3">
            <el-icon style="color: var(--lt-brand);"><Reading /></el-icon>
            <span class="text-sm font-medium" style="color: var(--lt-text-primary);">引用来源 ({{ currentPreview.sources.length }})</span>
          </div>
          <div class="space-y-2">
            <div
              v-for="(source, idx) in currentPreview.sources"
              :key="idx"
              class="rounded p-3 text-sm" style="background-color: var(--lt-bg-page); border: 1px solid var(--lt-border);"
            >
              <div class="flex justify-between items-start mb-1">
                <span class="font-medium" style="color: var(--lt-text-secondary);">{{ source.title }}</span>
                <el-tag size="small" type="info">{{ source.locator }}</el-tag>
              </div>
              <p class="text-xs italic m-0" style="color: var(--lt-text-auxiliary);">"{{ source.quote }}"</p>
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
import { ref, computed, onMounted, markRaw } from 'vue'
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
  Reading,
  DataBoard,
  ArrowDown,
  Download,
} from '@element-plus/icons-vue'
import type { ResourcePack } from '@/types'
import ResourceCard from '@/components/ResourceCard.vue'
import EvidenceDrawer from '@/components/EvidenceDrawer.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import MindmapViewer from '@/components/MindmapViewer.vue'
import CodeLearningViewer from '@/components/code/CodeLearningViewer.vue'
import { markdownToDocxBlob, downloadDocx, preprocessLatexForMarkdown } from '@/utils/docxExport'
import { extractVideoUrl } from '@/utils/media'
import { useResourceStore } from '@/stores/resource'
import { apiFetch } from '@/utils/api'

const router = useRouter()

// ==================== 状态 ====================
const searchQuery = ref('')
const sortOrder = ref('newest')
const confidenceFilter = ref('')
const loading = ref(false)
const activePackId = ref<string | null>(null)

// 批量操作
const isBatchMode = ref(false)
const selectedPackIds = ref<Set<string>>(new Set())

function toggleBatchMode() {
  isBatchMode.value = !isBatchMode.value
  if (!isBatchMode.value) {
    selectedPackIds.value = new Set()
  }
}

function togglePackSelection(packId: string) {
  const next = new Set(selectedPackIds.value)
  if (next.has(packId)) {
    next.delete(packId)
  } else {
    next.add(packId)
  }
  selectedPackIds.value = next
}

function selectAllPacks() {
  if (selectedPackIds.value.size === filteredPacks.value.length) {
    selectedPackIds.value = new Set()
  } else {
    selectedPackIds.value = new Set(filteredPacks.value.map(p => p.id))
  }
}

async function batchDelete() {
  const ids = [...selectedPackIds.value]
  if (ids.length === 0) return
  let successCount = 0
  for (const id of ids) {
    try {
      await resourceStore.removePack(id)
      if (activePackId.value === id) activePackId.value = null
      successCount++
    } catch { /* skip */ }
  }
  if (successCount > 0) {
    ElMessage.success(`已删除 ${successCount} 个资源包`)
  }
  if (successCount < ids.length) {
    ElMessage.warning(`${ids.length - successCount} 个资源包删除失败`)
  }
  selectedPackIds.value = new Set()
  isBatchMode.value = false
}

// 预览状态
const previewVisible = ref(false)
const currentPreview = ref<any>(null)
const previewMode = ref('brief')

const videoPreviewUrl = computed(() => {
  if (currentPreview.value?.type !== 'video') return null
  return extractVideoUrl(currentPreview.value)
})

const evidenceDrawer = ref<any>(null)
const mindmapViewerRef = ref<{ exportSvg: (filename?: string) => void; exportPng: (filename?: string) => Promise<void> } | null>(null)

// ==================== Data (API-driven with store) ====================
const resourceStore = useResourceStore()
const packList = computed(() => resourceStore.packs)

// ==================== 计算属性 ====================
const filteredPacks = computed(() => {
  let list = [...packList.value]

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

const packIconClass = (pack: ResourcePack) => {
  if (pack.avgConfidence === 'high') return 'bg-success/10 text-success'
  if (pack.avgConfidence === 'medium') return 'bg-warning/10 text-warning'
  return 'bg-danger/10 text-danger'
}

const packIcon = (_pack: ResourcePack) => {
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
    video: 'default'
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
    video: '讲解视频'
  }
  return map[type] || type
}

const previewResource = (res: any, _pack: ResourcePack) => {
  currentPreview.value = res
  previewMode.value = 'brief'
  previewVisible.value = true
}

async function downloadDocxResource(res: any) {
  const content = res.deepContent || res.brief || ''
  const blob = await markdownToDocxBlob(content, res.title)
  downloadDocx(blob, res.title || 'resource')
}

function downloadVideoResource(res: any) {
  const url = extractVideoUrl(res)
  if (url) {
    window.open(url, '_blank')
  } else {
    ElMessage.warning('视频 URL 暂不可用，请等待视频渲染完成')
  }
}

function downloadMdResource(res: any) {
  const raw = res.deepContent || res.brief || ''
  const content = preprocessLatexForMarkdown(raw)
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${res.title || 'resource'}.md`
  a.click()
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

const regenerateResource = async (res: any, pack: ResourcePack) => {
  res.status = 'pending'
  ElMessage.info(`正在重新生成「${res.title}」...`)
  try {
    const ok = await resourceStore.regenerateResource(pack.id, res.id)
    if (!ok) {
      res.status = 'ready'
      ElMessage.error(`重新生成「${res.title}」失败，请稍后重试`)
    }
  } catch {
    res.status = 'ready'
    ElMessage.error(`重新生成「${res.title}」失败，请稍后重试`)
  }
}

const continueLearning = (pack: ResourcePack) => {
  const params = new URLSearchParams()
  params.set('pack', pack.id)
  if ((pack as any).taskId) params.set('taskId', (pack as any).taskId)
  if (pack.knowledgePoint) params.set('topic', pack.knowledgePoint)
  router.push(`/path?${params.toString()}`)
}

const openInStudio = (pack: any) => {
  const taskId = pack.task_id || pack.taskId
  if (taskId) {
    router.push(`/studio/${taskId}?pack_id=${pack.id}`)
  } else {
    router.push('/studio')
  }
}

const deletePack = async (pack: ResourcePack) => {
  try {
    await resourceStore.removePack(pack.id)
    if (activePackId.value === pack.id) {
      activePackId.value = null
    }
    ElMessage.success(`已删除资源包「${pack.title}」`)
  } catch {
    ElMessage.error(`删除「${pack.title}」失败，请稍后重试`)
  }
}

const selectPack = async (pack: ResourcePack) => {
  if (activePackId.value === pack.id) {
    activePackId.value = null
    return
  }
  activePackId.value = pack.id
  if (pack.resources.length === 0) {
    await resourceStore.fetchPackDetail(pack.id)
  }
}

const loadError = ref(false)

async function loadPacks() {
  loading.value = true
  loadError.value = false
  try {
    await resourceStore.fetchPacks('default')
  } catch {
    loadError.value = true
    ElMessage.warning('加载资源包列表失败')
  } finally {
    loading.value = false
  }
}

function retryLoadPacks() {
  loadPacks()
}

onMounted(() => {
  loadPacks()
})
</script>

<style scoped>
.library-view {
  max-width: 1400px;
}

.batch-action-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-brand-lighter);
  border-radius: var(--lt-radius-md);
}

.resource-pack-card {
    border: 1px solid var(--lt-border);
  border-radius: 10px;
  transition: all 0.2s ease;
}

.resource-pack-card:hover {
  border-color: var(--lt-brand-lighter);
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
