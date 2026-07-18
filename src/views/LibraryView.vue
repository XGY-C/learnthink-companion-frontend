<template>
  <div class="library-view h-full flex flex-col overflow-hidden">
    <!-- ==================== TopBar ==================== -->
    <div class="library-topbar">
      <div class="library-topbar__left">
        <h2 class="library-topbar__title">个人资源库</h2>
        <span class="library-topbar__subtitle">管理你的学习资料与笔记</span>
      </div>
      <div class="library-topbar__right">
        <el-input
          v-model="searchQuery"
          :placeholder="searchPlaceholder"
          :prefix-icon="Search"
          class="library-topbar__search"
          clearable
          @keyup.enter="doSearch"
          @clear="clearSearch"
        />
      </div>
    </div>

    <!-- ==================== TabBar ==================== -->
    <div class="library-tabs">
      <div
        class="library-tab"
        :class="{ 'library-tab--active': activeTab === 'resources' }"
        @click="activeTab = 'resources'"
      >
        <el-icon class="mr-1"><Files /></el-icon>
        资料 <span class="library-tab__count">{{ resourceStore.total }}</span>
      </div>
      <div
        class="library-tab"
        :class="{ 'library-tab--active': activeTab === 'notes' }"
        @click="activeTab = 'notes'"
      >
        <el-icon class="mr-1"><EditPen /></el-icon>
        笔记 <span class="library-tab__count">{{ noteStore.notes.length }}</span>
      </div>
      <div
        class="library-tab"
        :class="{ 'library-tab--active': activeTab === 'questions' }"
        @click="activeTab = 'questions'"
      >
        <el-icon class="mr-1"><Tickets /></el-icon>
        题库 <span class="library-tab__count">{{ qbStore.total }}</span>
      </div>
    </div>

    <!-- ==================== Content Area ==================== -->
    <div class="library-content flex-1 flex overflow-hidden">
      <!-- ========== 资料 Tab ========== -->
      <template v-if="activeTab === 'resources'">
        <!-- Sidebar: 文件夹树 -->
        <div class="library-sidebar" style="width: 240px; flex-shrink: 0;">
          <ResourceFolderTree
            @create="onCreateFolder"
            @rename="onRenameFolder"
            @delete="onDeleteFolder"
            @add-resource="onAddSystemResource"
          />
        </div>

        <!-- Main: 文件列表 -->
        <div class="library-main flex-1 flex flex-col overflow-hidden">
          <!-- Breadcrumb + Toolbar -->
          <div class="library-toolbar">
            <el-breadcrumb v-if="!searchMode" separator="/">
              <el-breadcrumb-item @click="folderStore.navigateTo(null)">全部资料</el-breadcrumb-item>
              <el-breadcrumb-item
                v-for="crumb in breadcrumb"
                :key="crumb.id"
                @click="folderStore.navigateTo(crumb.id)"
              >
                {{ crumb.name }}
              </el-breadcrumb-item>
            </el-breadcrumb>
            <span v-else class="library-toolbar__search-hint">
              搜索结果（{{ displayedFiles.length }} 条）
            </span>
            <div class="library-toolbar__filters">
              <el-select v-model="typeFilter" placeholder="全部类型" clearable size="small" class="w-28">
                <el-option v-for="(label, key) in typeOptions" :key="key" :label="label" :value="key" />
              </el-select>
              <el-select v-model="confidenceFilter" placeholder="置信度" clearable size="small" class="w-28">
                <el-option label="高" value="high" />
                <el-option label="中" value="medium" />
                <el-option label="低" value="low" />
              </el-select>
              <el-select v-model="sortOrder" size="small" class="w-28">
                <el-option label="最新优先" value="newest" />
                <el-option label="标题排序" value="title" />
                <el-option label="质量优先" value="quality" />
              </el-select>
            </div>
          </div>

          <!-- File Grid -->
          <div class="flex-1 overflow-y-auto p-5">
            <ResourceFileGrid
              :files="displayedFiles"
              :sub-folders="displayedSubFolders"
              :loading="resourceStore.fileLoading"
              @preview="onPreview"
              @view-notes="onViewNotes"
              @move="onMove"
              @regenerate="onRegenerate"
              @delete="onDeleteFile"
              @enter-folder="folderStore.navigateTo($event)"
              @learn="onLearn"
              @add-to-bank="onAddToBank"
            />
          </div>
        </div>
      </template>

      <!-- ========== 笔记 Tab ========== -->
      <template v-else-if="activeTab === 'notes'">
        <!-- ===== View: 藏书阁（氛围化书架） ===== -->
        <div v-if="noteView === 'shelf'" class="note-shelf flex-1 overflow-y-auto">
          <!-- 氛围光 header -->
          <div class="shelf-header">
            <div class="shelf-header__title-row">
              <div class="shelf-header__title-group">
                <h3 class="shelf-header__title">我的笔记本</h3>
                <span class="shelf-header__count">{{ notebookStore.notebooks.length }} 本 · {{ noteStore.notes.length }} 条笔记</span>
              </div>
              <el-button text size="small" :icon="Plus" @click="onCreateNotebook" style="color: var(--lt-brand);">
                新建笔记本
              </el-button>
            </div>
          </div>

          <!-- 笔记本收藏网格 -->
          <div class="nb-shelf">
            <!-- 全部笔记 -->
            <div class="nb-card" @click="enterAllNotes()">
              <div class="nb-card-cover cover-default">
                <div class="nb-card-decor"></div>
                <div class="nb-card-overlay">
                  <span class="nb-card-badge">全部</span>
                  <span class="nb-card-big-count">{{ noteStore.notes.length }}</span>
                  <span class="nb-card-count-label">条笔记</span>
                </div>
              </div>
              <div class="nb-card-bar">
                <span class="nb-card-name">全部笔记</span>
              </div>
              <div class="nb-card-spine" style="background: var(--lt-brand);"></div>
            </div>

            <!-- 各笔记本 -->
            <div
              v-for="nb in notebookStore.notebooks"
              :key="nb.id"
              class="nb-card"
              :title="nb.description"
              @click="enterNotebook(nb.id)"
            >
              <div class="nb-card-cover" :class="`cover-${nb.cover || 'default'}`">
                <div class="nb-card-decor"></div>
                <div class="nb-card-overlay">
                  <span v-if="nb.isDefault" class="nb-card-badge">默认</span>
                  <span class="nb-card-big-count">{{ notebookNoteCount(nb.id) }}</span>
                  <span class="nb-card-count-label">条笔记</span>
                </div>
              </div>
              <div class="nb-card-bar">
                <span class="nb-card-name">{{ nb.name }}</span>
              </div>
              <div class="nb-card-spine" :class="`spine-${nb.cover || 'default'}`"></div>
            </div>

            <!-- 新建笔记本 -->
            <div class="nb-card nb-card-add" @click="onCreateNotebook">
              <div class="nb-card-cover nb-card-add-cover">
                <el-icon class="nb-add-icon"><Plus /></el-icon>
                <span class="nb-add-text">新建笔记本</span>
              </div>
              <div class="nb-card-bar">
                <span class="nb-card-name">创建新笔记本</span>
              </div>
            </div>

            <!-- 加载态 -->
            <div v-if="notebookStore.loading" class="nb-shelf-loading">
              <div v-for="n in 4" :key="n" class="nb-card nb-card-skeleton">
                <div class="nb-card-cover nb-card-cover-sk" />
                <div class="nb-card-bar">
                  <div class="nb-sk-line" />
                  <div class="nb-sk-line nb-sk-line--short" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ===== View: 笔记列表页 ===== -->
        <div v-else class="library-main flex-1 flex flex-col overflow-hidden">
          <!-- 顶部栏：返回 + 面包屑 + 笔记本切换 -->
          <div class="note-list-toolbar">
            <div class="flex items-center gap-3">
              <el-button text size="small" :icon="ArrowLeft" @click="backToShelf">返回书架</el-button>
              <el-breadcrumb separator="/">
                <el-breadcrumb-item @click="backToShelf">笔记本</el-breadcrumb-item>
                <el-breadcrumb-item>{{ currentNotebookLabel }}</el-breadcrumb-item>
              </el-breadcrumb>
            </div>
            <el-select
              v-if="notebookStore.notebooks.length > 0"
              v-model="quickSwitchNotebookId"
              placeholder="切换笔记本"
              size="small"
              class="w-44"
              filterable
              @change="onQuickSwitch"
            >
              <el-option label="全部笔记" :value="''" />
              <el-option
                v-for="nb in notebookStore.notebooks"
                :key="nb.id"
                :label="nb.name"
                :value="nb.id"
              />
            </el-select>
          </div>

          <!-- 资源筛选提示 -->
          <div v-if="noteFilter.resourceItemId" class="px-5 py-2.5 flex items-center justify-between" style="background-color: var(--lt-ai-light-9); border-bottom: 1px solid var(--lt-ai-light-7);">
            <div class="flex items-center gap-2">
              <el-icon style="color: var(--lt-ai);"><Link /></el-icon>
              <span class="text-sm" style="color: var(--lt-text-primary);">正在查看「{{ noteFilter.resourceTitle || '资源' }}」的笔记</span>
            </div>
            <el-button text size="small" @click="clearNoteFilter">清除筛选</el-button>
          </div>

          <!-- 笔记列表 -->
          <div class="flex-1 overflow-y-auto">
            <div v-if="noteStore.loading" class="note-loading">
              <div class="note-skeleton-line" />
              <div class="note-skeleton-line w-80" />
              <div class="note-skeleton-line w-60" />
            </div>

            <div v-else-if="noteStore.notes.length === 0" class="text-center py-16">
              <el-icon :size="48" style="color: var(--lt-text-placeholder);"><EditPen /></el-icon>
              <p class="mt-3 text-sm font-medium" style="color: var(--lt-text-secondary);">暂无笔记</p>
              <p class="text-xs mt-1" style="color: var(--lt-text-placeholder);">在学习资源时可以随时记录笔记</p>
            </div>

            <div v-else-if="groupedNotes.length === 0" class="text-center py-16">
              <el-icon :size="48" style="color: var(--lt-text-placeholder);"><Search /></el-icon>
              <p class="mt-3 text-sm font-medium" style="color: var(--lt-text-secondary);">没有匹配的笔记</p>
              <p class="text-xs mt-1" style="color: var(--lt-text-placeholder);">试试其他关键词</p>
            </div>

            <div v-else class="note-list">
              <template v-for="res in groupedNotes" :key="res.key">
                <!-- 资源头（一级） -->
                <div
                  class="note-resource-header"
                  @click="toggleNoteGroup(resCollapseKey(res.key))"
                >
                  <span class="note-group-arrow" :class="{ collapsed: collapsedNoteGroups.has(resCollapseKey(res.key)) }">▸</span>
                  <span class="note-resource-title">📄 {{ res.title }}</span>
                  <span class="note-group-count">{{ res.count }}</span>
                </div>
                <div
                  v-if="!collapsedNoteGroups.has(resCollapseKey(res.key))"
                  class="note-resource-body"
                >
                  <div v-for="sec in res.sections" :key="sec.key" class="note-group">
                    <!-- 章节头（二级） -->
                    <div class="note-group-header" @click="toggleNoteGroup(secCollapseKey(res.key, sec.key))">
                      <span class="note-group-arrow" :class="{ collapsed: collapsedNoteGroups.has(secCollapseKey(res.key, sec.key)) }">▸</span>
                      <span class="note-group-title">{{ sec.title }}</span>
                      <span class="note-group-count">{{ sec.notes.length }}</span>
                    </div>
                    <TransitionGroup
                      v-if="!collapsedNoteGroups.has(secCollapseKey(res.key, sec.key))"
                      name="note-list-anim"
                      tag="div"
                      class="note-group-body"
                    >
                      <NoteCard
                        v-for="note in sec.notes"
                        :key="note.id"
                        :note="note"
                        @deleted="onNoteDeleted(note.id)"
                        @edit="onEditNote(note)"
                      />
                    </TransitionGroup>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </template>

      <!-- ========== 题库 Tab ========== -->
      <template v-if="activeTab === 'questions'">
        <QuestionBankPanel
          ref="qbPanelRef"
          :questions="displayedQuestions"
          :total="qbStore.total"
          :loading="qbStore.loading"
          :kp-accuracy="qbStore.kpAccuracyList"
          :wrong-count="wrongQuestionCount"
          @filter="onQbFilter"
          @select="onQbSelect"
          @delete="onQbDelete"
          @show-wrong="onQbShowWrong"
          @filter-kp="onQbFilterKp"
          @close-detail="onQbCloseDetail"
          @start-practice="onStartPractice"
        />
      </template>
    </div>

    <!-- ==================== 预览弹窗 ==================== -->
    <ResourcePreviewDialog
      v-model="previewVisible"
      :file="previewFile"
      @view-notes="onViewNotesFromPreview"
    />

    <!-- ==================== 新建文件夹弹窗 ==================== -->
    <el-dialog v-model="folderDialogVisible" :title="folderDialogTitle" width="400px" append-to-body>
      <el-input v-model="folderName" placeholder="请输入文件夹名称" @keyup.enter="confirmFolderAction" />
      <template #footer>
        <el-button @click="folderDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmFolderAction">确定</el-button>
      </template>
    </el-dialog>

    <!-- ==================== 移动资源弹窗 ==================== -->
    <el-dialog v-model="moveDialogVisible" title="移动到文件夹" width="400px" append-to-body>
      <el-tree-select
        v-model="moveTargetFolderId"
        :data="folderTreeData"
        :props="{ label: 'name', value: 'id', children: 'children' }"
        placeholder="选择目标文件夹（留空=移到未归档资源）"
        clearable
        check-strictly
        class="w-full"
      />
      <template #footer>
        <el-button @click="moveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmMove">移动</el-button>
      </template>
    </el-dialog>

    <!-- ==================== 添加系统资源弹窗 ==================== -->
    <el-dialog v-model="addResourceDialogVisible" title="添加系统资源" width="600px" append-to-body>
      <div v-if="addResourceLoading" class="py-12 text-center text-sm" style="color: var(--lt-text-auxiliary);">
        加载资源列表...
      </div>
      <template v-else>
        <p class="text-xs mb-3" style="color: var(--lt-text-auxiliary);">
          选择要添加到当前文件夹的系统资源
        </p>
        <div style="max-height: 360px; overflow-y: auto;">
          <div
            v-for="res in availableResources"
            :key="res.id"
            class="flex items-center gap-3 px-3 py-2 rounded cursor-pointer"
            style="transition: background 0.15s;"
            :style="{ background: selectedResourceIds.includes(res.id) ? 'var(--lt-brand-lightest)' : 'transparent' }"
            @click="toggleResourceSelection(res.id)"
          >
            <el-checkbox :model-value="selectedResourceIds.includes(res.id)" @click.stop="toggleResourceSelection(res.id)" />
            <span class="flex-1 text-sm truncate" style="color: var(--lt-text-primary);">{{ res.title }}</span>
            <span class="text-xs" style="color: var(--lt-text-auxiliary);">{{ RESOURCE_TYPE_LABEL[res.type] || res.type }}</span>
          </div>
          <div v-if="availableResources.length === 0" class="py-8 text-center text-sm" style="color: var(--lt-text-placeholder);">
            暂无可用资源
          </div>
        </div>
      </template>
      <template #footer>
        <el-button @click="addResourceDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="selectedResourceIds.length === 0" @click="confirmAddResources">
          添加 ({{ selectedResourceIds.length }})
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search, MagicStick, Files, EditPen, Link, Plus, ArrowLeft, Tickets,
} from '@element-plus/icons-vue'
import { useProfileStore } from '@/stores/profile'
import { useResourceStore } from '@/stores/resource'
import { useFolderStore } from '@/stores/folder'
import { useNoteStore } from '@/stores/note'
import { useNotebookStore } from '@/stores/notebook'
import { useQuestionBankStore } from '@/stores/questionBank'
import { RESOURCE_TYPE_LABEL } from '@/constants'
import { apiFetch } from '@/utils/api'
import ResourceFolderTree from '@/components/library/ResourceFolderTree.vue'
import ResourceFileGrid from '@/components/library/ResourceFileGrid.vue'
import ResourcePreviewDialog from '@/components/library/ResourcePreviewDialog.vue'
import NoteCard from '@/components/notes/NoteCard.vue'
import QuestionBankPanel from '@/components/library/QuestionBankPanel.vue'
import type { ResourceFile, Note, ResourceFolder, QuizContent, QBankQuestion } from '@/types'

const router = useRouter()
const profileStore = useProfileStore()
const resourceStore = useResourceStore()
const folderStore = useFolderStore()
const noteStore = useNoteStore()
const notebookStore = useNotebookStore()
const qbStore = useQuestionBankStore()

// ==================== Tab ====================
const activeTab = ref<'resources' | 'notes' | 'questions'>('resources')

// ==================== 搜索（上下文感知：按当前 tab 分发） ====================
const searchQuery = ref('')
const searchMode = ref(false)
const resourceSearchResults = ref<ResourceFile[]>([])

const searchPlaceholder = computed(() => {
  if (activeTab.value === 'notes') return '搜索笔记...'
  if (activeTab.value === 'questions') return '搜索题目...'
  return '搜索资源...'
})

async function doSearch() {
  const q = searchQuery.value.trim()
  if (!q) return
  const courseId = profileStore.activeCourseId
  if (!courseId) return
  searchMode.value = true

  if (activeTab.value === 'resources') {
    // 资料走后端全文搜索（size 与列表一致，避免静默截断）
    resourceSearchResults.value = await resourceStore.searchFiles(courseId, q, 1, 100)
  } else if (activeTab.value === 'notes') {
    // 笔记客户端过滤已加载数据；书架视图下先进入全部笔记列表
    if (noteView.value === 'shelf') enterAllNotes()
  } else if (activeTab.value === 'questions') {
    // 题库客户端过滤已加载题目；若有知识点筛选则先清除以保证搜索范围
    if (qbKpFilter.value) {
      qbKpFilter.value = undefined
      await loadQuestions()
    }
  }
}

function clearSearch() {
  searchQuery.value = ''
  searchMode.value = false
  // 资料搜索结果独立存放，需重新加载当前文件夹列表；笔记/题库为客户端过滤，清空即恢复
  if (activeTab.value === 'resources') loadFiles()
}

// ==================== 资料筛选 ====================
const typeFilter = ref('')
const confidenceFilter = ref('')
const sortOrder = ref('newest')

const typeOptions = RESOURCE_TYPE_LABEL

const currentSubFolders = computed<ResourceFolder[]>(() => {
  if (folderStore.currentFolderId === null) {
    return []
  }
  if (folderStore.currentFolderId === 'all') {
    return folderStore.folders
  }
  const folder = folderStore.flatFolders.find(f => f.id === folderStore.currentFolderId)
  return folder?.children ?? []
})

const breadcrumb = computed(() => {
  return folderStore.getBreadcrumb(folderStore.currentFolderId)
})

// 搜索模式下资料的展示列表：对搜索结果做客户端二次过滤/排序（后端 search 不支持这些参数）
const displayedFiles = computed<ResourceFile[]>(() => {
  if (searchMode.value && activeTab.value === 'resources') {
    let list = resourceSearchResults.value
    if (typeFilter.value) list = list.filter(f => f.type === typeFilter.value)
    if (confidenceFilter.value) list = list.filter(f => f.confidence === confidenceFilter.value)
    const sorted = [...list]
    if (sortOrder.value === 'title') {
      sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'zh-CN'))
    } else if (sortOrder.value === 'quality') {
      sorted.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
    } else {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return sorted
  }
  return resourceStore.files
})

// 搜索模式下隐藏子文件夹卡片（搜索为全局范围）
const displayedSubFolders = computed<ResourceFolder[]>(() => {
  if (searchMode.value && activeTab.value === 'resources') return []
  return currentSubFolders.value
})

// 类型/置信度/排序变化：非搜索模式才请求后端（搜索模式下由 displayedFiles 客户端二次过滤）
watch([typeFilter, confidenceFilter, sortOrder], () => {
  if (!searchMode.value && activeTab.value === 'resources') loadFiles()
})

// 文件夹切换：搜索模式下自动退出搜索并进入目标文件夹
watch(() => folderStore.currentFolderId, () => {
  if (searchMode.value) {
    searchQuery.value = ''
    searchMode.value = false
  }
  if (activeTab.value === 'resources') loadFiles()
})

// 切换 tab 时重置搜索状态，并按需刷新数据
watch(activeTab, (tab) => {
  searchQuery.value = ''
  searchMode.value = false
  if (tab === 'questions') loadQuestions()
})

async function loadFiles() {
  const courseId = profileStore.activeCourseId
  if (!courseId) return
  const folderId = folderStore.currentFolderId === 'all' ? 'all' : folderStore.currentFolderId
  await resourceStore.fetchFiles(courseId, {
    folderId: folderId as any,
    type: typeFilter.value || undefined,
    confidence: confidenceFilter.value || undefined,
    sort: sortOrder.value,
    page: 1,
    size: 100,
  })
}

// ==================== 预览 ====================
const previewVisible = ref(false)
const previewFile = ref<ResourceFile | null>(null)

function onPreview(file: ResourceFile) {
  previewFile.value = file
  previewVisible.value = true
}

// ==================== 开始学习 ====================
function onLearn(file: ResourceFile) {
  if (!file.packId) {
    ElMessage.warning('该资源未关联资源包，无法进入学习模式')
    return
  }
  router.push(`/learn/resource/${file.packId}?resourceId=${file.id}`)
}

// ==================== 文件夹操作 ====================
const folderDialogVisible = ref(false)
const folderDialogTitle = ref('')
const folderName = ref('')
const folderAction = ref<'create' | 'rename'>('create')
const folderActionTarget = ref<string | null>(null)

function onCreateFolder(parentId: string | null) {
  folderAction.value = 'create'
  folderActionTarget.value = parentId
  folderDialogTitle.value = '新建文件夹'
  folderName.value = ''
  folderDialogVisible.value = true
}

function onRenameFolder(folderId: string) {
  folderAction.value = 'rename'
  folderActionTarget.value = folderId
  const folder = folderStore.flatFolders.find(f => f.id === folderId)
  folderDialogTitle.value = '重命名文件夹'
  folderName.value = folder?.name || ''
  folderDialogVisible.value = true
}

async function confirmFolderAction() {
  if (!folderName.value.trim()) {
    ElMessage.warning('请输入文件夹名称')
    return
  }
  const courseId = profileStore.activeCourseId!
  if (folderAction.value === 'create') {
    await folderStore.createFolder(courseId, folderActionTarget.value, folderName.value.trim())
  } else if (folderAction.value === 'rename' && folderActionTarget.value) {
    await folderStore.updateFolder(folderActionTarget.value, { name: folderName.value.trim() })
  }
  folderDialogVisible.value = false
}

async function onDeleteFolder(folderId: string) {
  try {
    await ElMessageBox.confirm('删除文件夹后，内部资源将变为「未归档资源」，子文件夹也会被删除。确定删除？', '删除文件夹', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await folderStore.deleteFolder(folderId)
  } catch { /* cancelled */ }
}

// ==================== 添加系统资源到文件夹 ====================
const addResourceDialogVisible = ref(false)
const addResourceFolderId = ref<string | null>(null)
const addResourceLoading = ref(false)
const availableResources = ref<ResourceFile[]>([])
const selectedResourceIds = ref<string[]>([])

async function onAddSystemResource(folderId: string) {
  addResourceFolderId.value = folderId
  selectedResourceIds.value = []
  addResourceDialogVisible.value = true
  addResourceLoading.value = true
  try {
    const res = await apiFetch<any>(`/resources?courseId=${encodeURIComponent(profileStore.activeCourseId!)}&size=200`)
    availableResources.value = (res.data?.items || []).map((r: any) => ({
      id: r.id,
      folderId: r.folderId ?? null,
      packId: r.packId,
      type: r.type,
      title: r.title || '',
      status: r.status || 'ready',
      confidence: r.confidence || 'medium',
      qualityScore: r.qualityScore ?? 75,
      noteCount: r.noteCount ?? 0,
      isLearning: !!r.isLearning,
      createdAt: r.createdAt || '',
    }))
  } catch {
    ElMessage.error('获取资源列表失败')
  } finally {
    addResourceLoading.value = false
  }
}

async function confirmAddResources() {
  if (!selectedResourceIds.value.length || !addResourceFolderId.value) {
    ElMessage.warning('请选择至少一个资源')
    return
  }
  let success = 0
  for (const id of selectedResourceIds.value) {
    const ok = await resourceStore.moveFile(id, addResourceFolderId.value)
    if (ok) success++
  }
  ElMessage.success(`已将 ${success} 个资源添加到文件夹`)
  addResourceDialogVisible.value = false
  await folderStore.refetchTree()
  await loadFiles()
}

function toggleResourceSelection(id: string) {
  const idx = selectedResourceIds.value.indexOf(id)
  if (idx >= 0) selectedResourceIds.value.splice(idx, 1)
  else selectedResourceIds.value.push(id)
}

// ==================== 移动资源 ====================
const moveDialogVisible = ref(false)
const moveTargetFolderId = ref<string | null>(null)
const moveFileId = ref<string | null>(null)

const folderTreeData = computed(() => folderStore.folders)

function onMove(file: ResourceFile) {
  moveFileId.value = file.id
  moveTargetFolderId.value = file.folderId
  moveDialogVisible.value = true
}

async function confirmMove() {
  if (!moveFileId.value) return
  const ok = await resourceStore.moveFile(moveFileId.value, moveTargetFolderId.value)
  if (ok) {
    ElMessage.success('资源已移动')
    moveDialogVisible.value = false
    await folderStore.refetchTree()
    await loadFiles()
  }
}

// ==================== 题库 ====================
const qbPanelRef = ref<InstanceType<typeof QuestionBankPanel> | null>(null)
const wrongQuestionCount = ref(0)
let qbKpFilter = ref<string | undefined>()

// 题库搜索：客户端过滤已加载题目（与面板自带的后端筛选叠加）
const displayedQuestions = computed<QBankQuestion[]>(() => {
  if (searchMode.value && activeTab.value === 'questions' && searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    return qbStore.questions.filter(item =>
      (item.title || '').toLowerCase().includes(q) ||
      (item.explanation || '').toLowerCase().includes(q) ||
      (item.kpName || '').toLowerCase().includes(q)
    )
  }
  return qbStore.questions
})

async function loadQuestions() {
  const courseId = profileStore.activeCourseId
  if (!courseId) return
  await qbStore.fetchQuestions(courseId, { kpId: qbKpFilter.value })
  await qbStore.fetchKpAccuracy(courseId)
  wrongQuestionCount.value = await fetchWrongCount(courseId)
}

async function fetchWrongCount(courseId: string): Promise<number> {
  try {
    const res = await apiFetch<any>(`/questions/wrong?courseId=${encodeURIComponent(courseId)}&size=1`)
    return res.data?.total || 0
  } catch { return 0 }
}

function onQbFilter(filters: { questionType?: string; difficulty?: number; sort?: string; page?: number }) {
  const courseId = profileStore.activeCourseId
  if (!courseId) return
  qbStore.fetchQuestions(courseId, { ...filters, kpId: qbKpFilter.value })
}

function onQbSelect(id: string) {
  qbPanelRef.value?.openDetail(id)
}

async function onQbDelete(id: string) {
  const ok = await qbStore.deleteQuestion(id)
  if (ok) {
    ElMessage.success('题目已删除')
    loadQuestions()
  }
}

function onQbShowWrong() {
  const courseId = profileStore.activeCourseId
  if (!courseId) return
  qbKpFilter.value = undefined
  qbStore.fetchWrongQuestions(courseId)
}

function onQbFilterKp(kpId: string) {
  qbKpFilter.value = kpId
  const courseId = profileStore.activeCourseId
  if (!courseId) return
  qbStore.fetchQuestions(courseId, { kpId })
}

function onQbCloseDetail() {
  // no-op
}

function onStartPractice(questionIds?: string[]) {
  if (questionIds && questionIds.length > 0) {
    router.push({
      path: '/practice',
      query: { questionIds: questionIds.join(',') },
    })
  } else {
    router.push('/practice')
  }
}

// ==================== 练习题加入题库 ====================
const addingToBankId = ref<string | null>(null)

const QUIZ_TYPE_MAP: Record<string, string> = {
  SINGLE_CHOICE: 'single_choice',
  MULTIPLE_CHOICE: 'multiple_choice',
  TRUE_FALSE: 'true_false',
  FILL_IN_BLANK: 'fill_blank',
  SHORT_ANSWER: 'short_answer',
}

function parseQuizOptions(opts: string[] | null): { label: string; content: string }[] | undefined {
  if (!opts || opts.length === 0) return undefined
  const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
  return opts.map((o, i) => {
    const m = o.match(/^\s*([A-Za-z])\s*[.、)]\s*(.*)$/)
    if (m) return { label: m[1].toUpperCase(), content: m[2] }
    return { label: labels[i] || String(i + 1), content: o }
  })
}

async function onAddToBank(file: ResourceFile) {
  if (addingToBankId.value) return
  const courseId = profileStore.activeCourseId
  if (!courseId) {
    ElMessage.warning('请先选择课程')
    return
  }
  addingToBankId.value = file.id
  try {
    let content = file.content
    if (!content) {
      const detail = await resourceStore.fetchFileDetail(file.id)
      if (!detail || !detail.content) {
        ElMessage.warning('该练习题资源暂无可加入的题目')
        return
      }
      content = detail.content
    }
    let quiz: QuizContent
    try {
      quiz = JSON.parse(content) as QuizContent
    } catch {
      ElMessage.error('练习题内容解析失败')
      return
    }
    const questions = quiz.questions || []
    if (questions.length === 0) {
      ElMessage.warning('该练习题资源暂无可加入的题目')
      return
    }
    const result = await qbStore.batchCreateFromResource({
      courseId,
      sourceItemId: file.id,
      questions: questions.map(q => ({
        courseId,
        sourceItemId: file.id,
        questionType: QUIZ_TYPE_MAP[q.type] || q.type.toLowerCase(),
        difficulty: q.difficulty,
        title: q.content,
        options: parseQuizOptions(q.options),
        answer: q.answer,
        explanation: q.analysis,
        tags: q.knowledgePoint ? [q.knowledgePoint] : undefined,
      })),
    })
    if (!result) {
      ElMessage.error('加入题库失败，请稍后重试')
      return
    }
    if (result.skippedCount === 0) {
      ElMessage.success(`已将 ${result.addedCount} 道题目加入题库`)
    } else     if (result.addedCount === 0) {
      ElMessage.info(`${result.skippedCount} 道题目已在题库中`)
    } else {
      ElMessage.success(`新增 ${result.addedCount} 道，${result.skippedCount} 道已在题库中`)
    }
  } finally {
    addingToBankId.value = null
  }
}

// ==================== 删除/重生成资源 ====================
async function onDeleteFile(file: ResourceFile) {
  try {
    await ElMessageBox.confirm(`确定删除「${file.title}」？此操作可恢复（软删除）。`, '删除资源', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    const ok = await resourceStore.deleteFile(file.id)
    if (ok) {
      ElMessage.success('资源已删除')
      await folderStore.refetchTree()
    }
  } catch { /* cancelled */ }
}

async function onRegenerate(file: ResourceFile) {
  ElMessage.info(`正在重新生成「${file.title}」...`)
  await resourceStore.regenerateFile(file.id)
}

// ==================== 笔记相关 ====================
const noteView = ref<'shelf' | 'list'>('shelf')
const noteFilter = ref<{
  notebookId: string | null
  resourceItemId: string | null
  resourceTitle: string
}>({
  notebookId: null,
  resourceItemId: null,
  resourceTitle: '',
})
const quickSwitchNotebookId = ref('')

const currentNotebookLabel = computed(() => {
  if (noteFilter.value.resourceItemId) return noteFilter.value.resourceTitle || '资源笔记'
  if (!noteFilter.value.notebookId) return '全部笔记'
  return notebookStore.notebooks.find(n => n.id === noteFilter.value.notebookId)?.name || '笔记列表'
})

async function loadNotes() {
  const courseId = profileStore.activeCourseId
  if (!courseId) return
  await noteStore.fetchNotes({
    courseId,
    notebookId: noteFilter.value.notebookId ?? undefined,
    resourceItemId: noteFilter.value.resourceItemId ?? undefined,
  })
}

/** 书架页：进入某笔记本 */
function enterNotebook(notebookId: string) {
  noteFilter.value.notebookId = notebookId
  noteFilter.value.resourceItemId = null
  noteFilter.value.resourceTitle = ''
  quickSwitchNotebookId.value = notebookId
  collapsedNoteGroups.value = new Set()
  noteView.value = 'list'
  loadNotes()
}

/** 书架页：进入全部笔记 */
function enterAllNotes() {
  noteFilter.value.notebookId = null
  noteFilter.value.resourceItemId = null
  noteFilter.value.resourceTitle = ''
  quickSwitchNotebookId.value = ''
  collapsedNoteGroups.value = new Set()
  noteView.value = 'list'
  loadNotes()
}

/** 笔记列表页：返回书架 */
function backToShelf() {
  noteView.value = 'shelf'
  noteFilter.value.resourceItemId = null
  noteFilter.value.resourceTitle = ''
  noteFilter.value.notebookId = null
  quickSwitchNotebookId.value = ''
}

/** 笔记列表页：快速切换笔记本 */
function onQuickSwitch(val: string) {
  if (val === '') {
    enterAllNotes()
  } else {
    enterNotebook(val)
  }
}

/** 从资源卡片「N条笔记」交叉跳转：直入笔记列表 */
function onViewNotes(file: ResourceFile) {
  activeTab.value = 'notes'
  noteFilter.value.resourceItemId = file.id
  noteFilter.value.resourceTitle = file.title
  noteFilter.value.notebookId = null
  quickSwitchNotebookId.value = ''
  collapsedNoteGroups.value = new Set()
  noteView.value = 'list'
  loadNotes()
}

function onViewNotesFromPreview(file: ResourceFile) {
  previewVisible.value = false
  onViewNotes(file)
}

function clearNoteFilter() {
  noteFilter.value.resourceItemId = null
  noteFilter.value.resourceTitle = ''
  loadNotes()
}

function onEditNote(note: Note) {
  router.push(`/learn?note=${note.id}`)
}

async function onNoteDeleted(noteId: string) {
  await noteStore.deleteNote(noteId)
}

function onCreateNotebook() {
  ElMessageBox.prompt('请输入笔记本名称', '新建笔记本', {
    confirmButtonText: '创建',
    cancelButtonText: '取消',
  }).then(({ value }) => {
    if (value) {
      notebookStore.create({
        courseId: profileStore.activeCourseId!,
        name: value,
      })
    }
  }).catch(() => {})
}

/** 估算某笔记本的笔记数（加载全部笔记后按 notebookId 统计） */
function notebookNoteCount(notebookId: string): number {
  return noteStore.notes.filter(n => n.notebookId === notebookId).length
}

// ==================== 笔记分组（两层：资源 → 章节） ====================
const collapsedNoteGroups = ref<Set<string>>(new Set())

const RESOURCE_LEVEL_KEY = '__resource_level__'
const RESOURCE_LEVEL_LABEL = '资源整体笔记'
const UNTITLED_RESOURCE = '未分类资源'

interface SectionGroup { key: string; title: string; notes: Note[] }
interface ResourceGroup {
  key: string
  title: string
  sections: SectionGroup[]
  count: number
  latest: number
}

const groupedNotes = computed<ResourceGroup[]>(() => {
  let sourceNotes = noteStore.notes
  // 笔记搜索：客户端过滤已加载笔记
  if (searchMode.value && activeTab.value === 'notes' && searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    sourceNotes = sourceNotes.filter(n =>
      (n.content || '').toLowerCase().includes(q) ||
      (n.selectedText || '').toLowerCase().includes(q) ||
      (n.sectionTitle || '').toLowerCase().includes(q) ||
      (n.resourceTitle || '').toLowerCase().includes(q)
    )
  }

  const resourceMap = new Map<string, ResourceGroup>()
  for (const note of sourceNotes) {
    const resKey = note.resourcePackId || `t::${note.resourceTitle || UNTITLED_RESOURCE}`
    const resTitle = note.resourceTitle || UNTITLED_RESOURCE
    if (!resourceMap.has(resKey)) {
      resourceMap.set(resKey, { key: resKey, title: resTitle, sections: [], count: 0, latest: 0 })
    }
    const res = resourceMap.get(resKey)!
    res.count++
    const t = new Date(note.createdAt).getTime()
    if (t > res.latest) res.latest = t

    const secKey = note.sectionTitle || RESOURCE_LEVEL_KEY
    let sec = res.sections.find(s => s.key === secKey)
    if (!sec) {
      sec = {
        key: secKey,
        title: secKey === RESOURCE_LEVEL_KEY ? RESOURCE_LEVEL_LABEL : secKey,
        notes: [],
      }
      res.sections.push(sec)
    }
    sec.notes.push(note)
  }

  // 章节排序：资源级笔记置末，其余按标题排序
  for (const res of resourceMap.values()) {
    res.sections.sort((a, b) => {
      if (a.key === RESOURCE_LEVEL_KEY) return 1
      if (b.key === RESOURCE_LEVEL_KEY) return -1
      return a.title.localeCompare(b.title, 'zh-CN')
    })
    for (const sec of res.sections) {
      sec.notes.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    }
  }

  // 资源排序：最近笔记时间倒序
  return [...resourceMap.values()].sort((a, b) => b.latest - a.latest)
})

function resCollapseKey(resKey: string) {
  return `res::${resKey}`
}
function secCollapseKey(resKey: string, secKey: string) {
  return `sec::${resKey}::${secKey}`
}

function toggleNoteGroup(key: string) {
  if (collapsedNoteGroups.value.has(key)) {
    collapsedNoteGroups.value.delete(key)
  } else {
    collapsedNoteGroups.value.add(key)
  }
}

// ==================== 生命周期 ====================
onMounted(async () => {
  const courseId = profileStore.activeCourseId
  if (!courseId) {
    ElMessage.warning('请先选择课程')
    return
  }
  await Promise.all([
    folderStore.fetchTree(courseId),
    loadFiles(),
    notebookStore.ensureLoaded(courseId),
    noteStore.fetchNotes({ courseId }),
    loadQuestions(),
  ])
})
</script>

<style scoped>
.library-view {
  background-color: var(--lt-bg-page);
}

/* TopBar */
.library-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: var(--lt-bg-card);
  border-bottom: 1px solid var(--lt-border);
  flex-shrink: 0;
}
.library-topbar__left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.library-topbar__title {
  font-size: 20px;
  font-weight: 700;
  color: var(--lt-text-primary);
  margin: 0;
}
.library-topbar__subtitle {
  font-size: 13px;
  color: var(--lt-text-auxiliary);
}
.library-topbar__right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.library-topbar__search {
  width: 240px;
}

/* TabBar */
.library-tabs {
  display: flex;
  gap: 4px;
  padding: 0 24px;
  background: var(--lt-bg-card);
  border-bottom: 1px solid var(--lt-border);
  flex-shrink: 0;
}
.library-tab {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  font-size: 14px;
  color: var(--lt-text-secondary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all var(--lt-transition-base);
  user-select: none;
}
.library-tab:hover {
  color: var(--lt-brand);
}
.library-tab--active {
  color: var(--lt-brand);
  font-weight: 600;
  border-bottom-color: var(--lt-brand);
}
.library-tab__count {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  background: var(--lt-bg-page);
  padding: 1px 6px;
  border-radius: var(--lt-radius-full);
  margin-left: 4px;
}
.library-tab--active .library-tab__count {
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
}

/* Toolbar */
.library-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--lt-border);
  background: var(--lt-bg-card);
  flex-shrink: 0;
}
.library-toolbar__filters {
  display: flex;
  align-items: center;
  gap: 8px;
}
.library-toolbar__search-hint {
  font-size: 14px;
  font-weight: 600;
  color: var(--lt-brand);
}

/* Note list toolbar */
.note-list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  border-bottom: 1px solid var(--lt-border);
  background: var(--lt-bg-card);
  flex-shrink: 0;
}

/* ===== 藏书阁氛围页 ===== */
.note-shelf {
  background:
    radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255, 243, 230, 0.5) 0%, transparent 70%),
    var(--lt-bg-page);
}

/* Shelf header */
.shelf-header {
  padding: 28px 32px 20px;
  max-width: 1200px;
  margin: 0 auto;
}
.shelf-header__title-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}
.shelf-header__title-group {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.shelf-header__title {
  font-size: 22px;
  font-weight: 700;
  color: var(--lt-text-primary);
  margin: 0;
  letter-spacing: 0.02em;
}
.shelf-header__count {
  font-size: 13px;
  color: var(--lt-text-auxiliary);
  font-weight: 400;
}

/* Notebook shelf grid */
.nb-shelf {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 14px;
  padding: 16px 32px 40px;
  max-width: 1200px;
  margin: 0 auto;
}
.nb-shelf-loading {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 14px;
}

/* Notebook cards (bookshelf style) */
.nb-card {
  cursor: pointer;
  border-radius: 3px 8px 8px 3px;
  position: relative;
  border: 1px solid var(--lt-border);
  background: var(--lt-bg-card);
  box-shadow:
    1px 1px 0 #ececec, 2px 2px 0 #e4e4e4, 3px 3px 0 #dcdcdc,
    0 4px 10px rgba(0,0,0,0.08);
  transition: transform 0.4s cubic-bezier(0.25,0.8,0.25,1), box-shadow 0.4s ease;
}
.nb-card:hover {
  transform: translateY(-6px);
  box-shadow:
    1px 1px 0 #ececec, 2px 2px 0 #e4e4e4, 3px 3px 0 #dcdcdc, 4px 4px 0 #d4d4d4,
    0 14px 30px rgba(0,0,0,0.16);
}
.nb-card:active { transform: translateY(-2px); }

/* Cover */
.nb-card-cover {
  aspect-ratio: 4 / 5;
  position: relative;
  overflow: hidden;
  border-radius: 2px 7px 0 0;
  border-left: 4px solid rgba(0,0,0,0.22);
  box-shadow: inset 1px 0 0 rgba(0,0,0,0.12);
}
/* Gloss sweep on hover */
.nb-card-cover::before {
  content: '';
  position: absolute;
  top: 0; left: -120%;
  width: 50%; height: 100%;
  background: linear-gradient(to right, transparent, rgba(255,255,255,0.2), transparent);
  transform: skewX(-20deg);
  transition: left 0.6s cubic-bezier(0.25,0.8,0.25,1);
  z-index: 8; pointer-events: none;
}
.nb-card:hover .nb-card-cover::before { left: 160%; }
/* Permanent gloss overlay */
.nb-card-cover::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(155deg,
    rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 25%,
    transparent 40%, rgba(0,0,0,0.03) 70%, rgba(0,0,0,0.08) 100%);
  pointer-events: none;
  z-index: 7; border-radius: inherit;
}
.nb-card-decor {
  position: absolute;
  z-index: 2; pointer-events: none;
}

/* Overlay (count display) */
.nb-card-overlay {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  background: linear-gradient(to bottom,
    rgba(0, 0, 0, 0) 0%,
    rgba(0, 0, 0, 0.15) 60%,
    rgba(0, 0, 0, 0.35) 100%);
}
.nb-card-badge {
  position: absolute; top: 6px; right: 6px;
  font-size: 9px; font-weight: 500; line-height: 1;
  padding: 2px 6px;
  background: rgba(255,255,255,0.9);
  color: var(--lt-text-secondary);
  border-radius: 8px; z-index: 9;
  backdrop-filter: blur(4px);
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.nb-card-big-count {
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  line-height: 1;
  letter-spacing: -0.02em;
}
.nb-card-count-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  letter-spacing: 0.05em;
}

/* Spine accent */
.nb-card-spine {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 4px;
  z-index: 10;
  opacity: 0.5;
  border-radius: 3px 0 0 3px;
  transition: width 0.3s ease, opacity 0.3s ease;
}
.nb-card:hover .nb-card-spine {
  width: 6px;
  opacity: 0.9;
}
.spine-default { background: #c9a96e; }
.spine-blue { background: #4a6fa5; }
.spine-green { background: #2d8659; }
.spine-orange { background: #8b6332; }
.spine-purple { background: #a080b0; }
.spine-grid { background: #1a1a1a; }
.spine-dot { background: #5040b0; }
.spine-wave { background: #807060; }

/* Bottom bar */
.nb-card-bar {
  padding: 7px 10px 8px;
  border-radius: 0 0 7px 2px;
}
.nb-card-name {
  font-size: 12px; font-weight: 600;
  color: var(--lt-text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  line-height: 1.5;
  display: block;
}

/* Add card */
.nb-card-add .nb-card-add-cover {
  background: var(--lt-bg-page);
  border: 1.5px dashed var(--lt-border);
  border-left: 4px solid transparent;
  box-shadow: none;
  display: flex; align-items: center; justify-content: center;
}
.nb-card-add .nb-card-add-cover::before,
.nb-card-add .nb-card-add-cover::after { display: none; }
.nb-add-icon { font-size: 26px; color: var(--lt-text-placeholder); }
.nb-card-add:hover .nb-card-add-cover {
  border-color: var(--lt-brand);
  background: var(--lt-brand-lightest);
}
.nb-card-add:hover .nb-add-icon { color: var(--lt-brand); }
.nb-add-text {
  font-size: 11px; color: var(--lt-text-auxiliary);
  margin-top: 2px; font-weight: 500;
}

/* Skeleton */
.nb-card-skeleton { pointer-events: none; }
.nb-card-cover-sk {
  background: linear-gradient(90deg, var(--lt-border) 25%, #e8ecf0 50%, var(--lt-border) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
}
.nb-sk-line {
  height: 10px; border-radius: 5px;
  background: linear-gradient(90deg, var(--lt-border) 25%, #e8ecf0 50%, var(--lt-border) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
}
.nb-sk-line--short { width: 60%; margin-top: 4px; }

/* ===== 8 Cover Designs ===== */
.cover-default { background: #faf8f5; border: 1px solid #e8e4de; }
.cover-default .nb-card-decor {
  left: 28%; top: 15%; bottom: 15%; width: 2px;
  background: linear-gradient(to bottom, transparent, #c9a96e, transparent);
}
.cover-blue { background: linear-gradient(160deg, #0a0e27 0%, #1a1f4b 40%, #2d1b4e 70%, #0f0f23 100%); }
.cover-blue .nb-card-decor {
  inset: 0;
  background-image:
    radial-gradient(1.5px 1.5px at 20% 25%, #fff, transparent),
    radial-gradient(1px 1px at 55% 65%, rgba(255,255,255,0.6), transparent),
    radial-gradient(2px 2px at 75% 20%, #fff, transparent),
    radial-gradient(1px 1px at 35% 80%, rgba(255,255,255,0.5), transparent),
    radial-gradient(1.5px 1.5px at 65% 45%, rgba(255,255,255,0.7), transparent),
    radial-gradient(1px 1px at 45% 15%, rgba(255,255,255,0.4), transparent),
    radial-gradient(1px 1px at 15% 55%, rgba(255,255,255,0.5), transparent),
    radial-gradient(1.5px 1.5px at 85% 70%, rgba(255,255,255,0.6), transparent),
    radial-gradient(1px 1px at 25% 40%, rgba(255,255,255,0.3), transparent);
}
.cover-green {
  background:
    linear-gradient(#c9a96e, #c9a96e) no-repeat 50% 8% / 30px 2px,
    linear-gradient(135deg, #0d3328 0%, #1a5c4a 50%, #0d3328 100%);
}
.cover-green .nb-card-decor {
  top: -15%; right: -20%; width: 65%; height: 65%;
  background: rgba(74,222,128,0.15);
  border-radius: 0 100% 0 100%; transform: rotate(15deg);
}
.cover-green .nb-card-decor::before {
  content: ''; position: absolute; bottom: -50%; left: -40%;
  width: 110%; height: 110%;
  background: rgba(34,197,94,0.12);
  border-radius: 100% 0 100% 0; transform: rotate(-20deg);
}
.cover-green .nb-card-decor::after {
  content: ''; position: absolute; top: 45%; right: 15%;
  width: 35%; height: 35%;
  background: rgba(134,239,172,0.1);
  border-radius: 50% 50% 0 50%; transform: rotate(45deg);
}
.cover-orange {
  background:
    radial-gradient(ellipse at 20% 30%, rgba(0,0,0,0.1), transparent 50%),
    radial-gradient(ellipse at 80% 70%, rgba(0,0,0,0.08), transparent 40%),
    linear-gradient(135deg, #3d2817 0%, #5c3d2e 30%, #4a3020 60%, #3d2817 100%);
}
.cover-orange .nb-card-decor { inset: 8%; border: 1px dashed rgba(201,169,110,0.4); border-radius: 3px; }
.cover-orange .nb-card-decor::before {
  content: ''; position: absolute; inset: 4%;
  border: 1px solid rgba(201,169,110,0.2); border-radius: 2px;
}
.cover-orange .nb-card-decor::after {
  content: ''; position: absolute; top: 50%; left: 50%;
  transform: translate(-50%,-50%) rotate(45deg);
  width: 15%; aspect-ratio: 1;
  border: 1.2px solid rgba(201,169,110,0.45);
}
.cover-purple { background: #faf7f4; }
.cover-purple .nb-card-decor {
  inset: 0;
  background:
    radial-gradient(ellipse 55% 40% at 35% 40%, rgba(210,160,180,0.5), transparent 70%),
    radial-gradient(ellipse 50% 38% at 60% 55%, rgba(150,170,210,0.45), transparent 70%),
    radial-gradient(ellipse 40% 32% at 45% 70%, rgba(200,175,150,0.4), transparent 70%),
    radial-gradient(ellipse 35% 28% at 55% 25%, rgba(180,155,190,0.35), transparent 70%);
  filter: blur(12px);
}
.cover-grid {
  background: #e8e0d4;
  background-image:
    linear-gradient(#c9a96e, #c9a96e) no-repeat 58% 22% / 28% 3px,
    linear-gradient(#1a1a1a, #1a1a1a) no-repeat 10% 14% / 20% 20%,
    linear-gradient(#1a1a1a, #1a1a1a) no-repeat 20% 58% / 15% 3px,
    linear-gradient(#1a1a1a, #1a1a1a) no-repeat 20% 70% / 15% 3px,
    linear-gradient(#1a1a1a, #1a1a1a) no-repeat 20% 58% / 3px 15%,
    linear-gradient(#1a1a1a, #1a1a1a) no-repeat 35% 58% / 3px 15%;
}
.cover-grid .nb-card-decor { inset: 0; }
.cover-grid .nb-card-decor::before {
  content: ''; position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 40%; aspect-ratio: 1;
  border: 2px solid #1a1a1a; border-radius: 50%;
}
.cover-grid .nb-card-decor::after {
  content: ''; position: absolute; bottom: 20%; right: 22%;
  width: 12%; height: 30%; background: #c9a96e;
}
.cover-dot { background: radial-gradient(ellipse at 55% 30%, #1a1a3a 0%, #0a0a18 40%, #020210 100%); }
.cover-dot .nb-card-decor {
  inset: 0;
  background:
    radial-gradient(ellipse 55% 35% at 45% 30%, rgba(80,60,180,0.3), transparent 70%),
    radial-gradient(ellipse 40% 28% at 65% 70%, rgba(180,120,60,0.15), transparent 70%);
  filter: blur(6px);
}
.cover-dot .nb-card-decor::after {
  content: ''; position: absolute; inset: 0;
  background-image:
    radial-gradient(1.5px 1.5px at 15% 20%, #fff, transparent),
    radial-gradient(1px 1px at 40% 55%, rgba(255,255,255,0.6), transparent),
    radial-gradient(2px 2px at 70% 30%, #fff, transparent),
    radial-gradient(1px 1px at 55% 75%, rgba(255,255,255,0.5), transparent),
    radial-gradient(1.5px 1.5px at 85% 50%, rgba(255,255,255,0.7), transparent),
    radial-gradient(1px 1px at 25% 80%, rgba(255,255,255,0.4), transparent),
    radial-gradient(1px 1px at 80% 10%, rgba(255,255,255,0.5), transparent),
    radial-gradient(1px 1px at 10% 60%, rgba(255,255,255,0.3), transparent);
}
.cover-wave {
  background:
    linear-gradient(90deg, transparent, rgba(80,70,60,0.1), transparent) no-repeat 10% 28% / 70% 2px,
    linear-gradient(90deg, transparent, rgba(80,70,60,0.06), transparent) no-repeat 30% 52% / 50% 2px,
    linear-gradient(135deg, #f5f0eb 0%, #e8e0d8 50%, #f0ebe5 100%);
}
.cover-wave .nb-card-decor { inset: 10%; border: 1px solid rgba(80,70,60,0.18); border-radius: 1px; }
.cover-wave .nb-card-decor::before {
  content: ''; position: absolute; top: 20%; left: -20%;
  width: 140%; height: 2px;
  background: linear-gradient(90deg, transparent, rgba(80,70,60,0.12), transparent);
  border-radius: 50%; filter: blur(1px); transform: rotate(-6deg);
}
.cover-wave .nb-card-decor::after {
  content: ''; position: absolute; top: 55%; right: -10%;
  width: 80%; height: 2px;
  background: rgba(80,70,60,0.08);
  border-radius: 50%; filter: blur(1px); transform: rotate(4deg);
}

/* Note list (匹配学习界面 NoteSidebar 样式) */
.note-loading { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.note-skeleton-line {
  height: 12px; border-radius: 6px;
  background: linear-gradient(90deg, var(--lt-border) 25%, #e8ecf0 50%, var(--lt-border) 75%);
  background-size: 200% 100%; animation: skeleton-shimmer 1.5s infinite;
}
.w-80 { width: 80%; } .w-60 { width: 60%; }
@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.note-list { padding: 8px 0; }

/* 资源级分组头（一级） */
.note-resource-header {
  display: flex; align-items: center; gap: 6px;
  padding: 11px 16px 9px; cursor: pointer;
  font-size: 15px; color: var(--lt-text-primary); font-weight: 700;
  transition: background 0.15s;
  background: var(--lt-bg-card);
  border-bottom: 1px solid var(--lt-border);
}
.note-resource-header:hover { background: var(--lt-bg-page); }
.note-resource-title {
  flex: 1;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.note-resource-body { padding: 6px 0 10px; }

.note-group-header {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 16px 8px 32px; cursor: pointer;
  font-size: 14px; color: var(--lt-text-secondary); font-weight: 600;
  transition: background 0.15s;
}
.note-group-header:hover { background: var(--lt-bg-page); }
.note-group-arrow { transition: transform 0.2s; font-size: 12px; color: var(--lt-text-placeholder); }
.note-group-arrow.collapsed { transform: rotate(0deg); }
.note-group-arrow:not(.collapsed) { transform: rotate(90deg); }
.note-group-title { flex: 1; }
.note-group-count {
  font-size: 12px; color: var(--lt-text-placeholder);
  background: var(--lt-bg-page); padding: 2px 8px; border-radius: 10px;
}
.note-group-body { margin: 0; padding: 0 0 4px; }

/* Note list animations */
.note-list-anim-enter-active, .note-list-anim-leave-active {
  transition: all 0.2s ease;
}
.note-list-anim-enter-from { opacity: 0; transform: translateY(-8px); }
.note-list-anim-leave-to { opacity: 0; transform: translateX(20px); }

</style>
