<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { usePullToRefresh } from '@/composables/usePullToRefresh'
import {
  Search, Plus, MagicStick, Document, Star, Clock, VideoPlay, Link, Delete, DataBoard, ArrowDown, Download, FolderOpened
} from '@element-plus/icons-vue'
import type { ResourcePack } from '@/types'
import ResourceCard from '@/components/ResourceCard.vue'
import EvidenceDrawer from '@/components/EvidenceDrawer.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import MindmapViewer from '@/components/MindmapViewer.vue'
import CodeLearningViewer from '@/components/code/CodeLearningViewer.vue'
import BottomSheet from '@/components/mobile/BottomSheet.vue'
import { markdownToDocxBlob, downloadDocx, preprocessLatexForMarkdown } from '@/utils/docxExport'
import { extractVideoUrl } from '@/utils/media'
import { useResourceStore } from '@/stores/resource'

const router = useRouter()

const pullContainer = ref<HTMLElement | null>(null)
const { pullState, pullDistance } = usePullToRefresh(pullContainer, async () => {
  searchQuery.value = ''
  confidenceFilter.value = ''
  sortOrder.value = 'newest'
})

const searchQuery = ref('')
const sortOrder = ref('newest')
const confidenceFilter = ref('')
const loading = ref(false)
const activePackId = ref<string | null>(null)

const previewVisible = ref(false)
const currentPreview = ref<any>(null)
const previewMode = ref('brief')
const evidenceDrawer = ref<any>(null)
const mindmapViewerRef = ref<any>(null)
const showEvidenceSheet = ref(false)
const evidenceSources = ref<any[]>([])

const videoPreviewUrl = computed(() => {
  if (currentPreview.value?.type !== 'video') return null
  return extractVideoUrl(currentPreview.value)
})

// ===== Data (API-driven via store) =====
const resourceStore = useResourceStore()
const packList = computed(() => resourceStore.packs)

const filteredPacks = computed(() => {
  let list = [...packList.value]
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(p => p.title.toLowerCase().includes(q) || p.knowledgePoint.toLowerCase().includes(q))
  }
  if (confidenceFilter.value) list = list.filter(p => p.avgConfidence === confidenceFilter.value)
  switch (sortOrder.value) {
    case 'newest': list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break
    case 'oldest': list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); break
    case 'quality': list.sort((a, b) => b.avgQuality - a.avgQuality); break
  }
  return list
})

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return '今天 ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return '昨天'
  if (days < 7) return `${days} 天前`
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const selectPack = async (pack: ResourcePack) => {
  if (activePackId.value === pack.id) { activePackId.value = null; return }
  activePackId.value = pack.id
  if (pack.resources.length === 0) {
    await resourceStore.fetchPackDetail(pack.id)
  }
}

const avgConfidenceType = (conf: string) => {
  const map: Record<string, string> = { high: 'success', medium: 'warning', low: 'danger' }
  return map[conf] || 'info'
}

const resourceTypeLabel = (type: string) => {
  const map: Record<string, string> = { doc: '讲解文档', mindmap: '思维导图', quiz: '练习题', reading: '拓展阅读', code: '代码案例', video: '讲解视频' }
  return map[type] || type
}

const previewResource = (res: any) => {
  currentPreview.value = res
  previewMode.value = 'brief'
  previewVisible.value = true
}

function viewSources(res: any) {
  if (res.sources?.length > 0) {
    evidenceSources.value = res.sources
  } else {
    evidenceSources.value = [{ title: '系统生成', locator: '—', quote: '此内容基于知识库证据与画像偏好生成。', relevance: 'medium' }]
  }
  showEvidenceSheet.value = true
}

async function downloadDocxResource(res: any) {
  const content = res.deepContent || res.brief || ''
  const blob = await markdownToDocxBlob(content, res.title)
  downloadDocx(blob, res.title || 'resource')
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

const regenerateResource = async (res: any, pack?: ResourcePack) => {
  res.status = 'pending'
  ElMessage.info(`正在重新生成「${res.title}」...`)
  if (pack) {
    await resourceStore.regenerateResource(pack.id, res.id)
  }
  ElMessage.warning('重新生成请求已提交，刷新页面查看最新状态')
  res.status = 'ready'
}

const openInStudio = (pack: any) => {
  const taskId = pack.task_id || pack.taskId
  if (taskId) router.push(`/studio/${taskId}?pack_id=${pack.id}`)
  else router.push('/studio')
}

const deletePack = async (pack: ResourcePack) => {
  await resourceStore.removePack(pack.id)
  activePackId.value = null
  ElMessage.success(`已删除资源包「${pack.title}」`)
}

onMounted(() => {
  resourceStore.fetchPacks('default')
})
</script>

<template>
  <div ref="pullContainer" class="m-library">
    <!-- 下拉刷新指示器 -->
    <div class="m-pull-indicator" :class="{ visible: pullState !== 'idle', refreshing: pullState === 'refreshing' }" :style="{ height: pullDistance + 'px' }">
      <template v-if="pullState === 'refreshing'">
        <div class="m-pull-spinner" />
        <span>刷新中...</span>
      </template>
      <template v-else-if="pullDistance >= 60">
        <span>释放刷新</span>
      </template>
      <template v-else>
        <span>下拉刷新</span>
      </template>
    </div>
    <div class="m-library-header">
      <div>
        <h2 class="m-library-title">个人资源库</h2>
        <p class="m-library-subtitle">共 {{ filteredPacks.length }} 个资源包</p>
      </div>
      <button class="m-library-new-btn" @click="router.push('/studio')">
        <el-icon :size="14"><Plus /></el-icon> 新建
      </button>
    </div>

    <!-- 搜索与筛选 -->
    <div class="m-library-toolbar">
      <div class="m-search-box">
        <el-icon :size="16" style="color: var(--lt-text-placeholder);"><Search /></el-icon>
        <input v-model="searchQuery" class="m-search-input" placeholder="搜索资源包..." />
      </div>
      <div class="m-filter-row">
        <button v-for="o in [{l:'最新',v:'newest'},{l:'最早',v:'oldest'},{l:'质量',v:'quality'}]" :key="o.v"
          class="m-filter-pill" :class="{ active: sortOrder === o.v }" @click="sortOrder = o.v">{{ o.l }}</button>
        <span class="m-filter-sep" />
        <button v-for="o in [{l:'全部',v:''},{l:'高置信',v:'high'},{l:'中置信',v:'medium'},{l:'低置信',v:'low'}]" :key="o.v"
          class="m-filter-pill" :class="{ active: confidenceFilter === o.v }" @click="confidenceFilter = o.v">{{ o.l }}</button>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="filteredPacks.length === 0 && !loading" class="m-library-empty">
      <el-icon :size="48" style="color: var(--lt-text-placeholder);"><FolderOpened /></el-icon>
      <p class="m-empty-title">{{ searchQuery || confidenceFilter ? '没有匹配的资源包' : '资源库为空' }}</p>
      <p class="m-empty-desc">{{ searchQuery || confidenceFilter ? '试试调整筛选条件' : '先去资源工作室生成你的第一个学习资源包吧！' }}</p>
      <button v-if="!searchQuery && !confidenceFilter" class="m-empty-action" @click="router.push('/studio')">
        <el-icon :size="14"><MagicStick /></el-icon> 前往工作室
      </button>
    </div>

    <!-- 资源包列表 -->
    <div v-else class="m-pack-list">
      <div v-for="pack in filteredPacks" :key="pack.id" class="m-pack-card" :class="{ expanded: activePackId === pack.id }">
        <!-- 卡片头部 -->
        <div class="m-pack-header" @click="selectPack(pack)">
          <div class="m-pack-icon" :class="pack.avgConfidence">
            <el-icon :size="18"><DataBoard /></el-icon>
          </div>
          <div class="m-pack-info">
            <h4 class="m-pack-name">{{ pack.title }}</h4>
            <div class="m-pack-meta-row">
              <span>{{ pack.knowledgePoint }}</span>
              <span class="m-pack-dot">·</span>
              <span>{{ formatDate(pack.createdAt) }}</span>
            </div>
          </div>
          <div class="m-pack-badges">
            <span class="m-conf-badge" :class="pack.avgConfidence">{{ pack.avgConfidence === 'high' ? '高' : pack.avgConfidence === 'medium' ? '中' : '低' }}</span>
            <span v-if="pack.isActive" class="m-active-badge">学习中</span>
          </div>
        </div>

        <!-- 卡片摘要 -->
        <div class="m-pack-summary">
          <span><el-icon :size="14"><Document /></el-icon> {{ pack.resourceCount }} 个资源</span>
          <span><el-icon :size="14"><Star /></el-icon> 质量 {{ pack.avgQuality }}/100</span>
          <span><el-icon :size="14"><Clock /></el-icon> {{ pack.estimatedMinutes }}分钟</span>
        </div>

        <!-- 展开内容 -->
        <div v-if="activePackId === pack.id" class="m-pack-expanded">
          <div class="m-pack-resources">
            <ResourceCard
              v-for="res in pack.resources" :key="res.id"
              v-bind="res"
              @preview="previewResource(res)"
              @view-sources="viewSources(res)"
              @regenerate="regenerateResource(res, pack)"
            />
          </div>
          <div class="m-pack-actions">
            <button class="m-pack-action-btn" @click="openInStudio(pack)">
              <el-icon :size="14"><Link /></el-icon> 在工作站打开
            </button>
            <button class="m-pack-action-btn danger" @click="deletePack(pack)">
              <el-icon :size="14"><Delete /></el-icon> 删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 预览 BottomSheet -->
    <BottomSheet v-model="previewVisible" height="full" :title="currentPreview?.title || '资源预览'">
      <div v-if="currentPreview" class="m-preview-body">
        <div class="m-preview-mode">
          <button :class="{ active: previewMode === 'brief' }" @click="previewMode = 'brief'">速览</button>
          <button :class="{ active: previewMode === 'deep' }" @click="previewMode = 'deep'">深入</button>
        </div>
        <div class="m-preview-meta">
          <span class="m-preview-conf" :class="currentPreview.confidence">{{ currentPreview.confidence === 'high' ? '高' : currentPreview.confidence === 'medium' ? '中' : '低' }}置信度</span>
          <span class="m-preview-score">质量 {{ currentPreview.qualityScore }}/100</span>
        </div>
        <div v-if="currentPreview.type === 'mindmap'" style="min-height: 300px;">
          <MindmapViewer :content="previewMode === 'brief' ? (currentPreview.brief || '') : (currentPreview.deepContent || currentPreview.brief || '')" :is-json="true" />
        </div>
        <div v-else-if="currentPreview.type === 'code'">
          <CodeLearningViewer :content="previewMode === 'brief' ? currentPreview.brief || '' : currentPreview.deepContent || currentPreview.brief || ''" :title="currentPreview.title" :quality-score="currentPreview.qualityScore" :sources-count="currentPreview.sourcesCount" />
        </div>
        <div v-else-if="currentPreview.type === 'video'" class="bg-black rounded-lg overflow-hidden">
          <video v-if="videoPreviewUrl" :src="videoPreviewUrl" controls class="w-full" style="max-height: 400px;" />
          <div v-else class="flex items-center justify-center py-12 text-sm" style="color: var(--lt-text-auxiliary);">视频正在生成或 URL 暂不可用</div>
        </div>
        <div v-else>
          <MarkdownViewer :content="previewMode === 'brief' ? (currentPreview.brief || '暂无内容') : (currentPreview.deepContent || currentPreview.brief || '暂无内容')" :show-toc="false" />
        </div>
        <div class="m-preview-sources">
          <button class="m-source-btn" @click="viewSources(currentPreview)">📚 引用证据</button>
        </div>
        <div v-if="currentPreview.type === 'doc' || currentPreview.type === 'reading'" class="m-preview-downloads">
          <button class="m-dl-btn" @click="downloadDocxResource(currentPreview)"><el-icon :size="14"><Download /></el-icon> DOCX</button>
          <button class="m-dl-btn" @click="downloadMdResource(currentPreview)"><el-icon :size="14"><Download /></el-icon> MD</button>
        </div>
      </div>
    </BottomSheet>

    <!-- 证据来源 BottomSheet -->
    <BottomSheet v-model="showEvidenceSheet" height="medium" title="引用证据">
      <div class="m-evidence-list">
        <div v-for="(s, i) in evidenceSources" :key="i" class="m-evidence-item">
          <div class="m-evidence-header">
            <span class="m-evidence-title">{{ s.title }}</span>
            <span class="m-evidence-locator">{{ s.locator }}</span>
          </div>
          <p class="m-evidence-quote">"{{ s.quote }}"</p>
        </div>
      </div>
    </BottomSheet>
  </div>
</template>

<style scoped>
.m-library { padding: 16px; background: var(--lt-bg-page); min-height: 100%; }
.m-library-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
.m-library-title { font-size: 20px; font-weight: 700; color: var(--lt-text-primary); margin: 0; }
.m-library-subtitle { font-size: 12px; color: var(--lt-text-auxiliary); margin: 4px 0 0; }
.m-library-new-btn {
  display: flex; align-items: center; gap: 4px; padding: 8px 16px;
  border: none; border-radius: 10px; background: var(--lt-brand); color: #fff;
  font-size: 13px; font-weight: 500; cursor: pointer; touch-action: manipulation; flex-shrink: 0;
}
.m-library-new-btn:active { background: var(--lt-brand-dark); }

/* Toolbar */
.m-library-toolbar { margin-bottom: 16px; display: flex; flex-direction: column; gap: 10px; }
.m-search-box {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px;
  background: var(--lt-bg-card); border: 0.5px solid var(--lt-border); border-radius: 10px;
}
.m-search-input { flex: 1; border: none; background: transparent; font-size: 15px; color: var(--lt-text-primary); outline: none; }
.m-search-input::placeholder { color: var(--lt-text-placeholder); }
.m-filter-row { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
.m-filter-row::-webkit-scrollbar { display: none; }
.m-filter-pill {
  padding: 5px 12px; border-radius: 14px; border: 0.5px solid var(--lt-border);
  background: var(--lt-bg-card); font-size: 11px; color: var(--lt-text-secondary);
  white-space: nowrap; cursor: pointer; touch-action: manipulation;
}
.m-filter-pill.active { border-color: var(--lt-brand); color: var(--lt-brand); background: var(--lt-brand-lightest); }
.m-filter-sep { width: 1px; background: var(--lt-border); margin: 0 4px; flex-shrink: 0; }

/* Empty */
.m-library-empty { display: flex; flex-direction: column; align-items: center; padding: 60px 24px; text-align: center; }
.m-empty-title { font-size: 15px; font-weight: 500; color: var(--lt-text-secondary); margin: 12px 0 4px; }
.m-empty-desc { font-size: 13px; color: var(--lt-text-placeholder); margin: 0 0 16px; }
.m-empty-action {
  display: flex; align-items: center; gap: 6px; padding: 10px 24px; border: none;
  border-radius: 10px; background: var(--lt-brand); color: #fff; font-size: 14px; cursor: pointer; touch-action: manipulation;
}

/* Pack cards */
.m-pack-list { display: flex; flex-direction: column; gap: 12px; }
.m-pack-card { background: var(--lt-bg-card); border: 0.5px solid var(--lt-border); border-radius: 12px; overflow: hidden; }
.m-pack-header { display: flex; align-items: flex-start; gap: 12px; padding: 14px; cursor: pointer; touch-action: manipulation; }
.m-pack-header:active { background: var(--lt-brand-lightest); }
.m-pack-icon {
  width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.m-pack-icon.high { background: rgba(52,199,89,0.1); color: var(--lt-success); }
.m-pack-icon.medium { background: rgba(255,159,10,0.1); color: var(--lt-warning); }
.m-pack-icon.low { background: rgba(255,59,48,0.1); color: var(--lt-danger); }
.m-pack-info { flex: 1; min-width: 0; }
.m-pack-name { font-size: 14px; font-weight: 600; color: var(--lt-text-primary); margin: 0 0 4px; }
.m-pack-meta-row { font-size: 11px; color: var(--lt-text-auxiliary); display: flex; gap: 4px; }
.m-pack-dot { color: var(--lt-text-placeholder); }
.m-pack-badges { display: flex; gap: 4px; flex-shrink: 0; }
.m-conf-badge { font-size: 10px; padding: 1px 6px; border-radius: 6px; font-weight: 500; }
.m-conf-badge.high { background: rgba(52,199,89,0.1); color: var(--lt-success); }
.m-conf-badge.medium { background: rgba(255,159,10,0.1); color: var(--lt-warning); }
.m-conf-badge.low { background: rgba(255,59,48,0.1); color: var(--lt-danger); }
.m-active-badge { font-size: 10px; padding: 1px 6px; border-radius: 6px; background: rgba(43,111,255,0.08); color: var(--lt-brand); }

.m-pack-summary { display: flex; gap: 12px; padding: 0 14px 12px; font-size: 11px; color: var(--lt-text-auxiliary); }
.m-pack-summary span { display: flex; align-items: center; gap: 3px; }

.m-pack-expanded { border-top: 1px solid var(--lt-border); padding: 12px 14px 14px; }
.m-pack-resources { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
.m-pack-actions { display: flex; gap: 8px; }
.m-pack-action-btn {
  display: flex; align-items: center; gap: 4px; padding: 8px 14px;
  border: 0.5px solid var(--lt-border); border-radius: 8px; background: var(--lt-bg-page);
  font-size: 12px; color: var(--lt-text-secondary); cursor: pointer; touch-action: manipulation;
}
.m-pack-action-btn:active { background: var(--lt-brand-lightest); }
.m-pack-action-btn.danger:active { background: rgba(255,59,48,0.06); color: var(--lt-danger); }

/* Preview */
.m-preview-body { display: flex; flex-direction: column; gap: 12px; }
.m-preview-mode { display: flex; gap: 6px; }
.m-preview-mode button {
  flex: 1; padding: 8px; border: 0.5px solid var(--lt-border); border-radius: 8px;
  background: var(--lt-bg-card); font-size: 13px; color: var(--lt-text-secondary); cursor: pointer;
}
.m-preview-mode button.active { border-color: var(--lt-brand); color: var(--lt-brand); background: var(--lt-brand-lightest); }
.m-preview-meta { display: flex; gap: 8px; font-size: 11px; }
.m-preview-conf { padding: 2px 8px; border-radius: 6px; font-weight: 500; }
.m-preview-conf.high { background: rgba(52,199,89,0.1); color: var(--lt-success); }
.m-preview-conf.medium { background: rgba(255,159,10,0.1); color: var(--lt-warning); }
.m-preview-conf.low { background: rgba(255,59,48,0.1); color: var(--lt-danger); }
.m-preview-score { color: var(--lt-text-auxiliary); }
.m-preview-sources { margin-top: 8px; }
.m-source-btn { width: 100%; padding: 10px; border: 0.5px solid var(--lt-border); border-radius: 8px; background: var(--lt-bg-page); font-size: 13px; cursor: pointer; }
.m-preview-downloads { display: flex; gap: 8px; }
.m-dl-btn {
  display: flex; align-items: center; gap: 4px; padding: 8px 14px;
  border: 0.5px solid var(--lt-brand-lighter); border-radius: 8px; background: var(--lt-brand-lightest);
  color: var(--lt-brand); font-size: 12px; cursor: pointer;
}

/* Evidence */
.m-evidence-list { display: flex; flex-direction: column; gap: 8px; }
.m-evidence-item { padding: 10px 12px; background: var(--lt-bg-page); border-radius: 8px; border: 0.5px solid var(--lt-border); }
.m-evidence-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.m-evidence-title { font-size: 13px; font-weight: 500; color: var(--lt-text-primary); }
.m-evidence-locator { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: var(--lt-bg-card); color: var(--lt-text-auxiliary); }
.m-evidence-quote { font-size: 12px; color: var(--lt-text-auxiliary); font-style: italic; margin: 0; }

/* ===== Pull-to-refresh ===== */
.m-pull-indicator {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  font-size: 12px; color: var(--lt-text-auxiliary);
  overflow: hidden; transition: height 0.1s;
  height: 0;
}
.m-pull-indicator.visible { min-height: 0; }
.m-pull-indicator.refreshing { color: var(--lt-brand); }
.m-pull-spinner {
  width: 16px; height: 16px;
  border: 2px solid var(--lt-border); border-top-color: var(--lt-brand);
  border-radius: 50%; animation: pull-spin 0.6s linear infinite;
}
@keyframes pull-spin { to { transform: rotate(360deg); } }
</style>
