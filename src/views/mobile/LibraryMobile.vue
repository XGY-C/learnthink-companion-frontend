<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { usePullToRefresh } from '@/composables/usePullToRefresh'
import {
  Search, Plus, MagicStick, Document, Star, Clock, Link, Delete, DataBoard, Download, FolderOpened,
  Files, EditPen, Tickets, ArrowLeft, ArrowRight, Folder, Edit,
} from '@element-plus/icons-vue'
import type { ResourcePack, ResourceFile, ResourceFolder, Note, Notebook, QBankQuestion } from '@/types'
import ResourceCard from '@/components/ResourceCard.vue'
import NoteCard from '@/components/notes/NoteCard.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import MindmapViewer from '@/components/MindmapViewer.vue'
import CodeLearningViewer from '@/components/code/CodeLearningViewer.vue'
import HtmlSandboxViewer from '@/components/HtmlSandboxViewer.vue'
import BottomSheet from '@/components/mobile/BottomSheet.vue'
import { markdownToDocxBlob, downloadDocx, preprocessLatexForMarkdown } from '@/utils/docxExport'
import { extractVideoUrl } from '@/utils/media'
import { apiFetch } from '@/utils/api'
import { useResourceStore } from '@/stores/resource'
import { useFolderStore } from '@/stores/folder'
import { useNoteStore } from '@/stores/note'
import { useNotebookStore } from '@/stores/notebook'
import { useQuestionBankStore } from '@/stores/questionBank'
import { useProfileStore } from '@/stores/profile'
import { RESOURCE_TYPE_LABEL } from '@/constants'

const router = useRouter()
const profileStore = useProfileStore()
const resourceStore = useResourceStore()
const folderStore = useFolderStore()
const noteStore = useNoteStore()
const notebookStore = useNotebookStore()
const qbStore = useQuestionBankStore()

// ==================== Pull-to-refresh ====================
const pullContainer = ref<HTMLElement | null>(null)
const { pullState, pullDistance } = usePullToRefresh(pullContainer, async () => {
  const id = profileStore.activeCourseId
  if (!id) return
  if (activeTab.value === 'resources') { await loadFiles(); await folderStore.fetchTree(id) }
  else if (activeTab.value === 'notes') { await loadNotes(); await notebookStore.ensureLoaded(id) }
  else if (activeTab.value === 'questions') { await loadQuestions() }
})

// ==================== Tabs ====================
type TabKey = 'resources' | 'notes' | 'questions'
const activeTab = ref<TabKey>('resources')
const tabMeta = [
  { key: 'resources' as TabKey, label: '资料', icon: Files },
  { key: 'notes' as TabKey, label: '笔记', icon: EditPen },
  { key: 'questions' as TabKey, label: '题库', icon: Tickets },
]

// ==================== Resources Tab ====================
const searchQuery = ref('')
const searchMode = ref(false)

const typeFilter = ref('')
const confidenceFilter = ref('')
const sortOrder = ref('newest')

const typeOptions = RESOURCE_TYPE_LABEL

const currentSubFolders = computed<ResourceFolder[]>(() => {
  if (folderStore.currentFolderId === null) return []
  if (folderStore.currentFolderId === 'all') return folderStore.folders
  const folder = folderStore.flatFolders.find(f => f.id === folderStore.currentFolderId)
  return folder?.children ?? []
})

const breadcrumb = computed(() => folderStore.getBreadcrumb(folderStore.currentFolderId))

watch([typeFilter, confidenceFilter, sortOrder, () => folderStore.currentFolderId], () => {
  if (!searchMode.value) loadFiles()
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

async function doSearch() {
  if (!searchQuery.value.trim()) return
  searchMode.value = true
  const courseId = profileStore.activeCourseId
  if (!courseId) return
  const results = await resourceStore.searchFiles(courseId, searchQuery.value.trim())
  resourceStore.files = results
  resourceStore.total = results.length
}

function clearSearch() {
  searchQuery.value = ''
  searchMode.value = false
  loadFiles()
}

// ==================== Folder Tree (Mobile) ====================
const showFolderSheet = ref(false)
const mExpandedFolders = ref<Set<string>>(new Set())

function toggleFolderExpand(id: string) {
  const next = new Set(mExpandedFolders.value)
  if (next.has(id)) { next.delete(id) } else { next.add(id) }
  mExpandedFolders.value = next
}

function selectFolder(folderId: string | null) {
  folderStore.navigateTo(folderId)
  showFolderSheet.value = false
}

// ==================== Folder CRUD ====================
const showFolderCrudSheet = ref(false)
const folderCrudMode = ref<'create' | 'rename'>('create')
const folderCrudParentId = ref<string | null>(null)
const folderCrudTargetId = ref<string | null>(null)
const folderCrudName = ref('')
const folderCrudTitle = computed(() => folderCrudMode.value === 'create' ? '新建文件夹' : '重命名文件夹')

function onCreateFolder(parentId: string | null) {
  folderCrudMode.value = 'create'
  folderCrudParentId.value = parentId
  folderCrudTargetId.value = null
  folderCrudName.value = ''
  showFolderCrudSheet.value = true
}

function onRenameFolder(folderId: string) {
  folderCrudMode.value = 'rename'
  folderCrudTargetId.value = folderId
  const folder = folderStore.flatFolders.find(f => f.id === folderId)
  folderCrudName.value = folder?.name || ''
  showFolderCrudSheet.value = true
}

async function confirmFolderAction() {
  if (!folderCrudName.value.trim()) {
    ElMessage.warning('请输入文件夹名称')
    return
  }
  const courseId = profileStore.activeCourseId!
  if (folderCrudMode.value === 'create') {
    await folderStore.createFolder(courseId, folderCrudParentId.value, folderCrudName.value.trim())
  } else if (folderCrudMode.value === 'rename' && folderCrudTargetId.value) {
    await folderStore.updateFolder(folderCrudTargetId.value, { name: folderCrudName.value.trim() })
  }
  showFolderCrudSheet.value = false
}

async function onDeleteFolder(folderId: string) {
  try {
    await ElMessageBox.confirm('删除文件夹后，内部资源将变为「未归档资源」，子文件夹也会被删除。确定删除？', '删除文件夹', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger',
    })
    await folderStore.deleteFolder(folderId)
  } catch { /* cancelled */ }
}

// ==================== Resource File Grid (Mobile) ====================
const activeFile = ref<ResourceFile | null>(null)
const showResourcePreview = ref(false)

function onPreview(file: ResourceFile) {
  activeFile.value = file
  showResourcePreview.value = true
}

function onLearn(file: ResourceFile) {
  if (!file.packId) {
    ElMessage.warning('该资源未关联资源包，无法进入学习模式')
    return
  }
  router.push(`/learn/resource/${file.packId}?resourceId=${file.id}`)
}

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

// ==================== Move Resource ====================
const showMoveSheet = ref(false)
const moveFileId = ref<string | null>(null)
const moveTargetFolderId = ref<string | null>(null)

function onMove(file: ResourceFile) {
  moveFileId.value = file.id
  moveTargetFolderId.value = file.folderId
  showMoveSheet.value = true
}

async function confirmMove() {
  if (!moveFileId.value) return
  const ok = await resourceStore.moveFile(moveFileId.value, moveTargetFolderId.value)
  if (ok) {
    ElMessage.success('资源已移动')
    showMoveSheet.value = false
    await folderStore.refetchTree()
    await loadFiles()
  }
}

// ==================== Add System Resources ====================
const showAddResourceSheet = ref(false)
const addResourceFolderId = ref<string | null>(null)
const addResourceLoading = ref(false)
const availableResources = ref<ResourceFile[]>([])
const selectedResourceIds = ref<string[]>([])

async function onAddSystemResource(folderId: string | null) {
  addResourceFolderId.value = folderId
  selectedResourceIds.value = []
  showAddResourceSheet.value = true
  addResourceLoading.value = true
  try {
    const res = await apiFetch<any>(`/resources?courseId=${encodeURIComponent(profileStore.activeCourseId!)}&size=200`)
    availableResources.value = (res.data?.items || []).map((r: any) => ({
      id: r.id, folderId: r.folderId ?? null, packId: r.packId,
      type: r.type, title: r.title || '', status: r.status || 'ready',
      confidence: r.confidence || 'medium', qualityScore: r.qualityScore ?? 75,
      noteCount: r.noteCount ?? 0, isLearning: !!r.isLearning, createdAt: r.createdAt || '',
    }))
  } catch { ElMessage.error('获取资源列表失败') }
  finally { addResourceLoading.value = false }
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
  showAddResourceSheet.value = false
  await folderStore.refetchTree()
  await loadFiles()
}

function toggleResourceSelection(id: string) {
  const idx = selectedResourceIds.value.indexOf(id)
  if (idx >= 0) selectedResourceIds.value.splice(idx, 1)
  else selectedResourceIds.value.push(id)
}

// ==================== Pack-based List (existing mobile feature) ====================
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

const activePackId = ref<string | null>(null)

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

// ==================== Preview ====================
const previewVisible = ref(false)
const currentPreview = ref<any>(null)
const previewMode = ref('brief')
const showEvidenceSheet = ref(false)
const evidenceSources = ref<any[]>([])

const videoPreviewUrl = computed(() => {
  if (currentPreview.value?.type !== 'video') return null
  return extractVideoUrl(currentPreview.value)
})

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

// ==================== Notes Tab ====================
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
const collapsedNoteGroups = ref<Set<string>>(new Set())

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

function notebookNoteCount(notebookId: string): number {
  return noteStore.notes.filter(n => n.notebookId === notebookId).length
}

function enterNotebook(notebookId: string) {
  noteFilter.value.notebookId = notebookId
  noteFilter.value.resourceItemId = null
  noteFilter.value.resourceTitle = ''
  quickSwitchNotebookId.value = notebookId
  collapsedNoteGroups.value = new Set()
  noteView.value = 'list'
  loadNotes()
}

function enterAllNotes() {
  noteFilter.value.notebookId = null
  noteFilter.value.resourceItemId = null
  noteFilter.value.resourceTitle = ''
  quickSwitchNotebookId.value = ''
  collapsedNoteGroups.value = new Set()
  noteView.value = 'list'
  loadNotes()
}

function backToShelf() {
  noteView.value = 'shelf'
  noteFilter.value.resourceItemId = null
  noteFilter.value.resourceTitle = ''
  noteFilter.value.notebookId = null
  quickSwitchNotebookId.value = ''
}

function onQuickSwitch(val: string) {
  if (val === '') enterAllNotes()
  else enterNotebook(val)
}

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
  showResourcePreview.value = false
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

function onNoteDeleted(noteId: string) {
  noteStore.deleteNote(noteId)
}

function onCreateNotebook() {
  ElMessageBox.prompt('请输入笔记本名称', '新建笔记本', {
    confirmButtonText: '创建',
    cancelButtonText: '取消',
    inputPattern: /\S+/,
    inputErrorMessage: '名称不能为空',
  }).then(({ value }) => {
    if (value) {
      notebookStore.create({
        courseId: profileStore.activeCourseId!,
        name: value,
      })
    }
  }).catch(() => {})
}

async function onRenameNotebook(nb: Notebook) {
  ElMessageBox.prompt('请输入新的笔记本名称', '重命名笔记本', {
    confirmButtonText: '确认',
    cancelButtonText: '取消',
    inputValue: nb.name,
    inputPattern: /\S+/,
    inputErrorMessage: '名称不能为空',
  }).then(({ value }) => {
    if (value) {
      notebookStore.update(nb.id, { name: value })
    }
  }).catch(() => {})
}

async function onDeleteNotebook(nb: Notebook) {
  try {
    await ElMessageBox.confirm(`确定删除笔记本「${nb.name}」？其内的笔记不会被删除。`, '删除笔记本', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    // TODO: add deleteNotebook to notebookStore if not exists
    await apiFetch(`/notebooks/${nb.id}`, { method: 'DELETE' })
    notebookStore.ensureLoaded(profileStore.activeCourseId!)
  } catch { /* cancelled */ }
}

// Note grouping — 两层：资源 → 章节
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
  const resourceMap = new Map<string, ResourceGroup>()
  for (const note of noteStore.notes) {
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

  // 章节排序
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

// ==================== Question Bank Tab ====================
const qbTypeFilter = ref('')
const qbDifficultyFilter = ref<number | undefined>(undefined)
const qbSortOrder = ref('newest')
const qbKpFilter = ref<string | undefined>()
const qbCurrentPage = ref(1)
const wrongQuestionCount = ref(0)

const QUESTION_TYPE_LABEL: Record<string, string> = {
  single_choice: '单选', multiple_choice: '多选', true_false: '判断',
  fill_blank: '填空', short_answer: '简答', code: '编程',
}

const qbFilteredQuestions = computed(() => {
  let list = [...qbStore.questions]
  if (qbTypeFilter.value) list = list.filter(q => q.questionType === qbTypeFilter.value)
  if (qbDifficultyFilter.value) list = list.filter(q => q.difficulty === qbDifficultyFilter.value)
  switch (qbSortOrder.value) {
    case 'newest': list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break
    case 'difficulty': list.sort((a, b) => b.difficulty - a.difficulty); break
    case 'accuracy': list.sort((a, b) => a.accuracyRate - b.accuracyRate); break
  }
  return list
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

function onQbFilter() {
  const courseId = profileStore.activeCourseId
  if (!courseId) return
  qbStore.fetchQuestions(courseId, {
    questionType: qbTypeFilter.value || undefined,
    difficulty: qbDifficultyFilter.value,
    sort: qbSortOrder.value !== 'newest' ? qbSortOrder.value : undefined,
    page: qbCurrentPage.value,
    kpId: qbKpFilter.value,
  })
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

async function onQbDelete(id: string) {
  try {
    await ElMessageBox.confirm('确定删除该题目？', '删除题目', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    const ok = await qbStore.deleteQuestion(id)
    if (ok) {
      ElMessage.success('题目已删除')
      loadQuestions()
    }
  } catch { /* cancelled */ }
}

function rateClass(rate: number): string {
  if (rate >= 0.7) return 'rate-high'
  if (rate >= 0.4) return 'rate-mid'
  return 'rate-low'
}

// Question detail
const showQbDetail = ref(false)
const qbDetail = ref<QBankQuestion | null>(null)
const qbDetailLoading = ref(false)

// Question selection
const qbSelectedIds = ref<Set<string>>(new Set())
const qbHasSelection = computed(() => qbSelectedIds.value.size > 0)

function qbToggleSelect(id: string) {
  const next = new Set(qbSelectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  qbSelectedIds.value = next
}

function qbToggleSelectAll() {
  if (qbSelectedIds.value.size === qbFilteredQuestions.value.length) {
    qbSelectedIds.value = new Set()
  } else {
    qbSelectedIds.value = new Set(qbFilteredQuestions.value.map(q => q.id))
  }
}

function qbClearSelection() {
  qbSelectedIds.value = new Set()
}

function qbStartPractice() {
  if (qbHasSelection.value) {
    router.push({
      path: '/practice',
      query: { questionIds: Array.from(qbSelectedIds.value).join(',') },
    })
  } else {
    router.push('/practice')
  }
}

// 题目列表变化时清空选中
watch(qbFilteredQuestions, () => {
  qbSelectedIds.value = new Set()
})

function onQbSelect(id: string) {
  qbDetailLoading.value = true
  showQbDetail.value = true
  qbStore.fetchQuestionDetail(id).then(() => {
    qbDetail.value = qbStore.currentQuestion
    qbDetailLoading.value = false
  })
}

function formatAnswer(q: QBankQuestion): string {
  if (!q.answer) return '—'
  if (Array.isArray(q.answer)) return q.answer.join(', ')
  return String(q.answer)
}

// ==================== Lifecycle ====================
onMounted(async () => {
  const courseId = profileStore.activeCourseId
  if (!courseId) {
    ElMessage.warning('请先选择课程')
    return
  }
  await Promise.all([
    folderStore.fetchTree(courseId),
    resourceStore.fetchPacks(courseId),
    loadFiles(),
    notebookStore.ensureLoaded(courseId),
    noteStore.fetchNotes({ courseId }),
    loadQuestions(),
  ])
})
</script>

<template>
  <div ref="pullContainer" class="m-library">
    <!-- Pull-to-refresh indicator -->
    <div class="m-pull-indicator" :class="{ visible: pullState !== 'idle', refreshing: pullState === 'refreshing' }" :style="{ height: pullDistance + 'px' }">
      <template v-if="pullState === 'refreshing'"><div class="m-pull-spinner" /><span>刷新中...</span></template>
      <template v-else-if="pullDistance >= 60"><span>释放刷新</span></template>
      <template v-else><span>下拉刷新</span></template>
    </div>

    <!-- Header -->
    <div class="m-library-header">
      <div>
        <h2 class="m-library-title">个人资源库</h2>
        <p class="m-library-subtitle">
          {{ activeTab === 'resources' ? `共 ${searchMode ? resourceStore.files.length : resourceStore.total} 个资源`
          : activeTab === 'notes' ? `${notebookStore.notebooks.length} 本 · ${noteStore.notes.length} 条笔记`
          : `${qbStore.total} 道题目` }}
        </p>
      </div>
      <button v-if="activeTab === 'resources'" class="m-library-new-btn" @click="router.push('/studio')">
        <el-icon :size="14"><Plus /></el-icon> 新建
      </button>
      <button v-else-if="activeTab === 'notes'" class="m-library-new-btn" @click="onCreateNotebook">
        <el-icon :size="14"><Plus /></el-icon> 笔记本
      </button>
    </div>

    <!-- ==================== Tab Bar ==================== -->
    <div class="m-tab-bar">
      <div v-for="tab in tabMeta" :key="tab.key"
        class="m-tab-item"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <el-icon :size="15"><component :is="tab.icon" /></el-icon>
        <span>{{ tab.label }}</span>
      </div>
    </div>

    <!-- ==================== 资料 Tab ==================== -->
    <template v-if="activeTab === 'resources'">
      <!-- Search & Filters -->
      <div class="m-library-toolbar">
        <div class="m-search-box">
          <el-icon :size="16" style="color: var(--lt-text-placeholder);"><Search /></el-icon>
          <input v-model="searchQuery" class="m-search-input" placeholder="搜索资源..." @keyup.enter="doSearch" />
          <button v-if="searchQuery" class="m-search-clear" @click="clearSearch">✕</button>
        </div>
        <div class="m-filter-row">
          <button class="m-filter-pill m-folder-btn" @click="showFolderSheet = true">
            <el-icon :size="13"><Folder /></el-icon> 文件夹
          </button>
          <span class="m-filter-sep" />
          <button v-for="o in [{l:'最新',v:'newest'},{l:'质量',v:'quality'},{l:'标题',v:'title'}]" :key="o.v"
            class="m-filter-pill" :class="{ active: sortOrder === o.v }" @click="sortOrder = o.v">{{ o.l }}</button>
          <span class="m-filter-sep" />
          <button v-for="o in [{l:'全部',v:''},{l:'高',v:'high'},{l:'中',v:'medium'},{l:'低',v:'low'}]" :key="o.v"
            class="m-filter-pill" :class="{ active: confidenceFilter === o.v }" @click="confidenceFilter = o.v">{{ o.l }}</button>
          <span class="m-filter-sep" />
          <button v-for="(label, key) in typeOptions" :key="key"
            class="m-filter-pill" :class="{ active: typeFilter === key }" @click="typeFilter = typeFilter === key ? '' : key">{{ label }}</button>
        </div>
      </div>

      <!-- Breadcrumb -->
      <div class="m-breadcrumb">
        <span class="m-breadcrumb-item" @click="folderStore.navigateTo(null)">全部</span>
        <span v-for="crumb in breadcrumb" :key="crumb.id" class="m-breadcrumb-sep">/</span>
        <span v-for="(crumb, i) in breadcrumb" :key="crumb.id"
          class="m-breadcrumb-item"
          :class="{ active: i === breadcrumb.length - 1 }"
          @click="folderStore.navigateTo(crumb.id)"
        >{{ crumb.name }}</span>
      </div>

      <!-- File Grid (Files view) -->
      <div v-if="resourceStore.files.length > 0 || currentSubFolders.length > 0" class="m-file-grid">
        <!-- Sub-folders -->
        <div v-for="folder in currentSubFolders" :key="folder.id"
          class="m-file-folder-card"
          @click="folderStore.navigateTo(folder.id)"
        >
          <el-icon :size="24" style="color: var(--lt-warning);"><Folder /></el-icon>
          <div class="m-file-folder-info">
            <span class="m-file-folder-name">{{ folder.name }}</span>
            <span class="m-file-folder-count">{{ folder.resourceCount }} 个资源</span>
          </div>
          <el-icon style="color: var(--lt-text-placeholder);"><ArrowRight /></el-icon>
        </div>

        <!-- Files -->
        <div v-for="file in resourceStore.files" :key="file.id" class="m-file-card" @click="onPreview(file)">
          <div class="m-file-card-top">
            <span class="m-file-type-badge" :class="`type-${file.type}`">{{ RESOURCE_TYPE_LABEL[file.type] || file.type }}</span>
            <span class="m-file-conf-badge" :class="file.confidence">{{ file.confidence === 'high' ? '高' : file.confidence === 'medium' ? '中' : '低' }}</span>
          </div>
          <div class="m-file-card-title">{{ file.title }}</div>
          <div class="m-file-card-meta">
            <span>质量 {{ file.qualityScore }}</span>
            <span v-if="file.noteCount">· {{ file.noteCount }} 条笔记</span>
          </div>
          <div class="m-file-card-actions" @click.stop>
            <button class="m-file-action" title="查看笔记" @click="onViewNotes(file)"><el-icon :size="14"><EditPen /></el-icon></button>
            <button class="m-file-action" title="移动" @click="onMove(file)"><el-icon :size="14"><FolderAdd /></el-icon></button>
            <button class="m-file-action" title="重新生成" @click="onRegenerate(file)"><el-icon :size="14"><CopyDocument /></el-icon></button>
            <button class="m-file-action" title="学习" @click="onLearn(file)"><el-icon :size="14"><Star /></el-icon></button>
            <button class="m-file-action danger" title="删除" @click="onDeleteFile(file)"><el-icon :size="14"><Delete /></el-icon></button>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="!resourceStore.fileLoading" class="m-library-empty">
        <el-icon :size="48" style="color: var(--lt-text-placeholder);"><FolderOpened /></el-icon>
        <p class="m-empty-title">当前文件夹暂无资源</p>
        <p class="m-empty-desc">生成的资源会自动出现在「未归档资源」中</p>
      </div>

      <!-- Pack-based list (existing feature) -->
      <div v-if="folderStore.currentFolderId === null" style="margin-top: 16px;">
        <div class="m-pack-section-label">
          <span>资源包</span>
          <span class="m-pack-section-count">{{ filteredPacks.length }} 包</span>
        </div>
        <div v-if="filteredPacks.length === 0 && !resourceStore.loading" class="m-library-empty">
          <el-icon :size="48" style="color: var(--lt-text-placeholder);"><FolderOpened /></el-icon>
          <p class="m-empty-title">{{ searchQuery || confidenceFilter ? '没有匹配的资源包' : '资源库为空' }}</p>
          <p class="m-empty-desc">{{ searchQuery || confidenceFilter ? '试试调整筛选条件' : '先去资源工作室生成第一个学习资源包吧！' }}</p>
          <button v-if="!searchQuery && !confidenceFilter" class="m-empty-action" @click="router.push('/studio')">
            <el-icon :size="14"><MagicStick /></el-icon> 前往工作室
          </button>
        </div>
        <div v-else class="m-pack-list">
          <div v-for="pack in filteredPacks" :key="pack.id" class="m-pack-card" :class="{ expanded: activePackId === pack.id }">
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
            <div class="m-pack-summary">
              <span><el-icon :size="14"><Document /></el-icon> {{ pack.resourceCount }} 个资源</span>
              <span><el-icon :size="14"><Star /></el-icon> 质量 {{ pack.avgQuality }}/100</span>
              <span><el-icon :size="14"><Clock /></el-icon> {{ pack.estimatedMinutes }}分钟</span>
            </div>
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
      </div>
    </template>

    <!-- ==================== 笔记 Tab ==================== -->
    <template v-else-if="activeTab === 'notes'">
      <!-- Shelf View -->
      <div v-if="noteView === 'shelf'" class="m-note-shelf">
        <div class="m-nb-grid">
          <!-- All Notes -->
          <div class="m-nb-card" @click="enterAllNotes()">
            <div class="m-nb-card-cover m-nb-cover-default">
              <div class="m-nb-card-decor"></div>
              <div class="m-nb-card-overlay">
                <span class="m-nb-badge">全部</span>
                <span class="m-nb-big-count">{{ noteStore.notes.length }}</span>
                <span class="m-nb-count-label">条笔记</span>
              </div>
            </div>
            <div class="m-nb-card-bar">
              <span class="m-nb-card-name">全部笔记</span>
            </div>
            <div class="m-nb-card-spine" style="background: var(--lt-brand);"></div>
          </div>

          <!-- Notebooks -->
          <div v-for="nb in notebookStore.notebooks" :key="nb.id" class="m-nb-card" @click="enterNotebook(nb.id)">
            <div class="m-nb-card-cover" :class="`m-nb-cover-${nb.cover || 'default'}`">
              <div class="m-nb-card-decor"></div>
              <span v-if="nb.isDefault" class="m-nb-badge">默认</span>
              <div class="m-nb-card-overlay">
                <span class="m-nb-big-count">{{ notebookNoteCount(nb.id) }}</span>
                <span class="m-nb-count-label">条笔记</span>
              </div>
            </div>
            <div class="m-nb-card-bar">
              <span class="m-nb-card-name">{{ nb.name }}</span>
              <div class="m-nb-card-actions" @click.stop>
                <button class="m-nb-act" @click="onRenameNotebook(nb)"><el-icon :size="12"><Edit /></el-icon></button>
                <button class="m-nb-act m-nb-act--del" @click="onDeleteNotebook(nb)"><el-icon :size="12"><Delete /></el-icon></button>
              </div>
            </div>
            <div class="m-nb-card-spine" :class="`m-spine-${nb.cover || 'default'}`"></div>
          </div>

          <!-- Create -->
          <div class="m-nb-card m-nb-card-add" @click="onCreateNotebook">
            <div class="m-nb-card-cover m-nb-cover-add">
              <el-icon class="m-nb-add-icon"><Plus /></el-icon>
              <span class="m-nb-add-text">新建笔记本</span>
            </div>
            <div class="m-nb-card-bar">
              <span class="m-nb-card-name">创建新笔记本</span>
            </div>
          </div>

          <!-- Skeleton -->
          <div v-if="notebookStore.loading" class="m-nb-skeleton-row">
            <div v-for="n in 3" :key="n" class="m-nb-card m-nb-sk">
              <div class="m-nb-card-cover m-nb-sk-cover" />
              <div class="m-nb-card-bar"><div class="m-nb-sk-line" /></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Note List View -->
      <div v-else class="m-note-list-view">
        <div class="m-note-list-header">
          <button class="m-note-back-btn" @click="backToShelf"><el-icon :size="16"><ArrowLeft /></el-icon> 书架</button>
          <span class="m-note-list-title">{{ currentNotebookLabel }}</span>
          <select v-model="quickSwitchNotebookId" class="m-nb-switch" @change="onQuickSwitch(quickSwitchNotebookId)">
            <option value="">全部笔记</option>
            <option v-for="nb in notebookStore.notebooks" :key="nb.id" :value="nb.id">{{ nb.name }}</option>
          </select>
        </div>

        <!-- Resource filter hint -->
        <div v-if="noteFilter.resourceItemId" class="m-note-filter-hint">
          <span>正在查看「{{ noteFilter.resourceTitle || '资源' }}」的笔记</span>
          <button @click="clearNoteFilter">清除筛选</button>
        </div>

        <!-- Loading -->
        <div v-if="noteStore.loading" class="m-note-loading">
          <div v-for="n in 4" :key="n" class="m-note-sk-line" />
        </div>

        <!-- Empty -->
        <div v-else-if="noteStore.notes.length === 0" class="m-note-empty">
          <el-icon :size="40" style="color: var(--lt-text-placeholder);"><EditPen /></el-icon>
          <p>暂无笔记</p>
          <span>在学习资源时可以随时记录笔记</span>
        </div>

        <!-- Groups -->
        <div v-else class="m-note-groups">
          <template v-for="res in groupedNotes" :key="res.key">
            <!-- 资源头（一级） -->
            <div class="m-note-resource-header" @click="toggleNoteGroup(resCollapseKey(res.key))">
              <span class="m-note-arrow" :class="{ collapsed: collapsedNoteGroups.has(resCollapseKey(res.key)) }">▸</span>
              <span class="m-note-resource-title">📄 {{ res.title }}</span>
              <span class="m-note-group-count">{{ res.count }}</span>
            </div>
            <div v-if="!collapsedNoteGroups.has(resCollapseKey(res.key))" class="m-note-resource-body">
              <div v-for="sec in res.sections" :key="sec.key" class="m-note-group">
                <!-- 章节头（二级） -->
                <div class="m-note-group-header" @click="toggleNoteGroup(secCollapseKey(res.key, sec.key))">
                  <span class="m-note-arrow" :class="{ collapsed: collapsedNoteGroups.has(secCollapseKey(res.key, sec.key)) }">▸</span>
                  <span class="m-note-group-title">{{ sec.title }}</span>
                  <span class="m-note-group-count">{{ sec.notes.length }}</span>
                </div>
                <div v-if="!collapsedNoteGroups.has(secCollapseKey(res.key, sec.key))" class="m-note-group-body">
                  <NoteCard
                    v-for="note in sec.notes" :key="note.id"
                    :note="note"
                    @deleted="onNoteDeleted(note.id)"
                    @edit="onEditNote(note)"
                  />
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>

    <!-- ==================== 题库 Tab ==================== -->
    <template v-else-if="activeTab === 'questions'">
      <div class="m-qb-section">
        <!-- Wrong count -->
        <div class="m-qb-wrong-card" @click="onQbShowWrong">
          <span class="m-qb-wrong-value">{{ wrongQuestionCount }}</span>
          <span class="m-qb-wrong-label">道待复习</span>
        </div>
      </div>

      <!-- KP Accuracy -->
      <div class="m-qb-kp-row" v-if="qbStore.kpAccuracyList.length > 0">
        <span class="m-qb-kp-title">知识点正确率</span>
        <div class="m-qb-kp-list">
          <button v-for="kp in qbStore.kpAccuracyList" :key="kp.kpId"
            class="m-qb-kp-pill"
            :class="{ active: qbKpFilter === kp.kpId }"
            @click="onQbFilterKp(kp.kpId)"
          >
            <span class="m-qb-kp-name">{{ kp.kpName || kp.kpId.slice(0, 8) }}</span>
            <span class="m-qb-kp-rate" :class="kp.totalAttempts > 0 ? rateClass(kp.accuracyRate) : ''">{{ kp.totalAttempts > 0 ? (kp.accuracyRate * 100).toFixed(0) + '%' : '-' }}</span>
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="m-qb-filters">
        <select v-model="qbTypeFilter" class="m-qb-select" @change="onQbFilter">
          <option value="">全部题型</option>
          <option v-for="(label, key) in QUESTION_TYPE_LABEL" :key="key" :value="key">{{ label }}</option>
        </select>
        <select v-model="qbDifficultyFilter" class="m-qb-select" @change="onQbFilter">
          <option :value="undefined">全部难度</option>
          <option :value="1">★☆☆☆☆</option>
          <option :value="2">★★☆☆☆</option>
          <option :value="3">★★★☆☆</option>
          <option :value="4">★★★★☆</option>
          <option :value="5">★★★★★</option>
        </select>
        <select v-model="qbSortOrder" class="m-qb-select" @change="onQbFilter">
          <option value="newest">最新优先</option>
          <option value="difficulty">难度优先</option>
          <option value="accuracy">正确率升序</option>
        </select>
      </div>

      <!-- Clear KP filter -->
      <div v-if="qbKpFilter" class="m-qb-kp-active">
        筛选知识点
        <button @click="qbKpFilter = undefined; loadQuestions()">清除</button>
      </div>

      <!-- Selection toolbar -->
      <div v-if="!qbStore.loading && qbFilteredQuestions.length > 0" class="m-qb-select-bar">
        <button class="m-qb-select-all" @click="qbToggleSelectAll">
          <span class="m-qb-check-circle" :class="{ checked: qbFilteredQuestions.length > 0 && qbSelectedIds.size === qbFilteredQuestions.length }">
            <span v-if="qbFilteredQuestions.length > 0 && qbSelectedIds.size === qbFilteredQuestions.length">✓</span>
          </span>
          全选
        </button>
        <div class="m-qb-select-info">
          <span v-if="qbHasSelection" class="m-qb-selected-count" @click="qbClearSelection">
            已选 {{ qbSelectedIds.size }} 题 · 清空
          </span>
        </div>
        <button
          class="m-qb-practice-btn"
          :class="{ 'm-qb-practice-btn--active': qbHasSelection }"
          @click="qbStartPractice"
        >
          {{ qbHasSelection ? `练习（${qbSelectedIds.size}）` : '去练习' }}
        </button>
      </div>

      <!-- Question list -->
      <div v-if="qbStore.loading" class="m-qb-loading">
        <div v-for="n in 4" :key="n" class="m-qb-sk" />
      </div>
      <div v-else-if="qbFilteredQuestions.length === 0" class="m-library-empty">
        <el-icon :size="40" style="color: var(--lt-text-placeholder);"><Tickets /></el-icon>
        <p class="m-empty-title">暂无题目</p>
        <p class="m-empty-desc">AI 生成练习题时会自动录入题库</p>
      </div>
      <div v-else class="m-qb-list">
        <div
          v-for="q in qbFilteredQuestions"
          :key="q.id"
          class="m-qb-card"
          :class="{ 'm-qb-card--selected': qbSelectedIds.has(q.id) }"
          @click="onQbSelect(q.id)"
        >
          <button class="m-qb-check-btn" @click.stop="qbToggleSelect(q.id)">
            <span class="m-qb-check-circle" :class="{ checked: qbSelectedIds.has(q.id) }">
              <span v-if="qbSelectedIds.has(q.id)">✓</span>
            </span>
          </button>
          <div class="m-qb-card-left">
            <span class="m-qb-type-tag" :class="`qb-type--${q.questionType}`">{{ QUESTION_TYPE_LABEL[q.questionType] || q.questionType }}</span>
            <span class="m-qb-diff">{{ '★'.repeat(q.difficulty) }}{{ '☆'.repeat(5 - q.difficulty) }}</span>
          </div>
          <div class="m-qb-card-body">
            <div class="m-qb-card-title">{{ q.title }}</div>
            <div class="m-qb-card-meta">
              <span v-if="q.kpName" class="m-qb-card-kp">{{ q.kpName }}</span>
              <span>正确率 <span :class="rateClass(q.accuracyRate)">{{ (q.accuracyRate * 100).toFixed(0) }}%</span></span>
            </div>
          </div>
          <button class="m-qb-del-btn" @click.stop="onQbDelete(q.id)"><el-icon :size="14"><Delete /></el-icon></button>
        </div>
      </div>
    </template>

    <!-- ==================== Folder Sheet (BottomSheet) ==================== -->
    <BottomSheet v-model="showFolderSheet" height="large" title="文件夹">
      <div class="m-folder-sheet-body">
        <!-- Create root-level folder -->
        <div class="m-folder-action-row">
          <button class="m-folder-action-btn" @click="showFolderSheet = false; onCreateFolder(null)">
            <el-icon :size="14"><Plus /></el-icon> 新建文件夹
          </button>
          <button class="m-folder-action-btn" style="margin-top: 6px;" @click="showFolderSheet = false; onAddSystemResource(folderStore.currentFolderId)">
            <el-icon :size="14"><Download /></el-icon> 添加系统资源
          </button>
        </div>

        <!-- All / Unarchived -->
        <div class="m-folder-item" :class="{ active: folderStore.currentFolderId === 'all' }" @click="selectFolder('all')">
          <el-icon style="color: var(--lt-brand);"><Files /></el-icon>
          <span>全部资源</span>
        </div>
        <div class="m-folder-item" :class="{ active: folderStore.currentFolderId === null }" @click="selectFolder(null)">
          <el-icon style="color: var(--lt-text-auxiliary);"><FolderOpened /></el-icon>
          <span>未归档资源</span>
        </div>

        <div class="m-folder-section-label">已归档</div>

        <!-- Recursive folder tree -->
        <template v-for="folder in folderStore.folders" :key="folder.id">
          <div class="m-folder-tree-node">
            <div class="m-folder-item"
              :class="{ active: folderStore.currentFolderId === folder.id }"
              @click="selectFolder(folder.id)"
            >
              <button class="m-folder-expand-btn" @click.stop="toggleFolderExpand(folder.id)">
                <span class="m-folder-arrow" :class="{ open: mExpandedFolders.has(folder.id) }">▸</span>
              </button>
              <el-icon style="color: var(--lt-warning);"><Folder /></el-icon>
              <span class="m-folder-name">{{ folder.name }}</span>
              <span class="m-folder-count">{{ folder.resourceCount }}</span>
              <button class="m-folder-ctx-btn" @click.stop="onRenameFolder(folder.id)"><el-icon :size="12"><Edit /></el-icon></button>
              <button class="m-folder-ctx-btn danger" @click.stop="onDeleteFolder(folder.id)"><el-icon :size="12"><Delete /></el-icon></button>
            </div>
            <!-- Children (recursive) -->
            <div v-if="mExpandedFolders.has(folder.id) && folder.children?.length" class="m-folder-children">
              <div v-for="child in folder.children" :key="child.id" class="m-folder-item m-folder-item--child"
                :class="{ active: folderStore.currentFolderId === child.id }"
                @click="selectFolder(child.id)"
              >
                <el-icon style="color: var(--lt-warning);" :size="16"><Folder /></el-icon>
                <span class="m-folder-name">{{ child.name }}</span>
                <span class="m-folder-count">{{ child.resourceCount }}</span>
                <button class="m-folder-ctx-btn" @click.stop="onRenameFolder(child.id)"><el-icon :size="12"><Edit /></el-icon></button>
                <button class="m-folder-ctx-btn danger" @click.stop="onDeleteFolder(child.id)"><el-icon :size="12"><Delete /></el-icon></button>
              </div>
              <div class="m-folder-item m-folder-item--child m-folder-item--add" @click.stop="onCreateFolder(folder.id)">
                <el-icon :size="14" style="color: var(--lt-brand);"><Plus /></el-icon>
                <span style="color: var(--lt-brand); font-size: 12px;">子文件夹</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </BottomSheet>

    <!-- ==================== Folder Create/Rename Sheet ==================== -->
    <BottomSheet v-model="showFolderCrudSheet" height="medium" :title="folderCrudTitle">
      <div class="m-folder-crud-body">
        <input v-model="folderCrudName" class="m-folder-input" placeholder="请输入文件夹名称" @keyup.enter="confirmFolderAction" />
        <div class="m-folder-crud-actions">
          <button class="m-folder-cancel" @click="showFolderCrudSheet = false">取消</button>
          <button class="m-folder-confirm" @click="confirmFolderAction">{{ folderCrudMode === 'create' ? '创建' : '重命名' }}</button>
        </div>
      </div>
    </BottomSheet>

    <!-- ==================== Move Resource Sheet ==================== -->
    <BottomSheet v-model="showMoveSheet" height="large" title="移动到文件夹">
      <div class="m-folder-sheet-body">
        <div class="m-folder-item" :class="{ active: moveTargetFolderId === null }" @click="moveTargetFolderId = null">
          <el-icon><FolderOpened /></el-icon>
          <span>未归档资源</span>
        </div>
        <div class="m-folder-section-label">已归档</div>
        <template v-for="folder in folderStore.folders" :key="folder.id">
          <div class="m-folder-item" :class="{ active: moveTargetFolderId === folder.id }" @click="moveTargetFolderId = folder.id">
            <el-icon style="color: var(--lt-warning);"><Folder /></el-icon>
            <span>{{ folder.name }}</span>
          </div>
          <div v-if="folder.children?.length" class="m-folder-children">
            <div v-for="child in folder.children" :key="child.id"
              class="m-folder-item m-folder-item--child"
              :class="{ active: moveTargetFolderId === child.id }"
              @click="moveTargetFolderId = child.id"
            >
              <el-icon :size="16" style="color: var(--lt-warning);"><Folder /></el-icon>
              <span>{{ child.name }}</span>
            </div>
          </div>
        </template>
        <div class="m-folder-crud-actions" style="margin-top: 12px;">
          <button class="m-folder-cancel" @click="showMoveSheet = false">取消</button>
          <button class="m-folder-confirm" @click="confirmMove">移动</button>
        </div>
      </div>
    </BottomSheet>

    <!-- ==================== Add System Resources Sheet ==================== -->
    <BottomSheet v-model="showAddResourceSheet" height="full" title="添加系统资源">
      <div v-if="addResourceLoading" class="m-add-res-loading">加载资源列表...</div>
      <template v-else>
        <div class="m-add-res-body">
          <div v-for="res in availableResources" :key="res.id"
            class="m-add-res-item"
            :class="{ selected: selectedResourceIds.includes(res.id) }"
            @click="toggleResourceSelection(res.id)"
          >
            <div class="m-add-res-check" :class="{ checked: selectedResourceIds.includes(res.id) }">
              <span v-if="selectedResourceIds.includes(res.id)">✓</span>
            </div>
            <div class="m-add-res-info">
              <span class="m-add-res-title">{{ res.title }}</span>
              <span class="m-add-res-type">{{ RESOURCE_TYPE_LABEL[res.type] || res.type }}</span>
            </div>
          </div>
          <div v-if="availableResources.length === 0" class="m-add-res-empty">暂无可用资源</div>
        </div>
        <div class="m-add-res-footer">
          <button class="m-folder-cancel" @click="showAddResourceSheet = false">取消</button>
          <button class="m-folder-confirm" :disabled="selectedResourceIds.length === 0" @click="confirmAddResources">
            添加 ({{ selectedResourceIds.length }})
          </button>
        </div>
      </template>
    </BottomSheet>

    <!-- ==================== Preview BottomSheet ==================== -->
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
        <div v-else-if="currentPreview.type === 'html'">
          <HtmlSandboxViewer :content="previewMode === 'brief' ? (currentPreview.brief || '') : (currentPreview.deepContent || currentPreview.brief || '')" :title="currentPreview.title" />
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

    <!-- ==================== Resource Preview (file-level) ==================== -->
    <BottomSheet v-model="showResourcePreview" height="full" :title="activeFile?.title || '资源预览'">
      <div v-if="activeFile" class="m-preview-body">
        <div class="m-preview-meta">
          <span class="m-file-type-badge" :class="`type-${activeFile.type}`">{{ RESOURCE_TYPE_LABEL[activeFile.type] || activeFile.type }}</span>
          <span class="m-preview-conf" :class="activeFile.confidence">{{ activeFile.confidence === 'high' ? '高' : activeFile.confidence === 'medium' ? '中' : '低' }}置信度</span>
          <span class="m-preview-score">质量 {{ activeFile.qualityScore }}/100</span>
        </div>
        <div class="m-file-preview-actions">
          <button @click="onViewNotesFromPreview(activeFile)"><el-icon :size="14"><EditPen /></el-icon> 查看笔记</button>
          <button @click="onLearn(activeFile)"><el-icon :size="14"><Star /></el-icon> 开始学习</button>
        </div>
        <div class="m-preview-sources">
          <button class="m-source-btn" @click="viewSources(activeFile)">📚 引用证据</button>
        </div>
      </div>
    </BottomSheet>

    <!-- ==================== Evidence BottomSheet ==================== -->
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

    <!-- ==================== Question Detail BottomSheet ==================== -->
    <BottomSheet v-model="showQbDetail" height="large" :title="qbDetail?.title?.slice(0, 40) || '题目详情'">
      <div v-if="qbDetailLoading" class="m-qb-detail-sk">
        <div class="m-note-sk-line w-48" />
        <div class="m-note-sk-line" />
        <div class="m-note-sk-line w-3/4" />
      </div>
      <div v-else-if="qbDetail" class="m-qb-detail">
        <div class="m-qb-detail-header">
          <span class="m-qb-type-tag" :class="`qb-type--${qbDetail.questionType}`">{{ QUESTION_TYPE_LABEL[qbDetail.questionType] || qbDetail.questionType }}</span>
          <span class="m-qb-detail-diff">{{ '★'.repeat(qbDetail.difficulty) }}{{ '☆'.repeat(5 - qbDetail.difficulty) }}</span>
          <span>正确率 {{ (qbDetail.accuracyRate * 100).toFixed(0) }}%</span>
        </div>
        <div class="m-qb-detail-section">
          <div class="m-qb-detail-section-title">题干</div>
          <div class="m-qb-detail-content">{{ qbDetail.title }}</div>
        </div>
        <div v-if="qbDetail.options && qbDetail.options.length" class="m-qb-detail-section">
          <div class="m-qb-detail-section-title">选项</div>
          <div v-for="opt in qbDetail.options" :key="opt.label" class="m-qb-opt-item">
            <span class="m-qb-opt-label">{{ opt.label }}</span>
            <span>{{ opt.content }}</span>
          </div>
        </div>
        <div class="m-qb-detail-section">
          <div class="m-qb-detail-section-title">答案</div>
          <div class="m-qb-detail-answer">{{ formatAnswer(qbDetail) }}</div>
        </div>
        <div v-if="qbDetail.explanation" class="m-qb-detail-section">
          <div class="m-qb-detail-section-title">解析</div>
          <div class="m-qb-detail-explain">{{ qbDetail.explanation }}</div>
        </div>
        <div class="m-qb-detail-meta">
          <span v-if="qbDetail.kpName">知识点：{{ qbDetail.kpName }}</span>
          <span>{{ qbDetail.attemptCount }} 次作答</span>
        </div>
      </div>
    </BottomSheet>
  </div>
</template>

<style scoped>
.m-library { padding: 16px; background: var(--lt-bg-page); min-height: 100dvh; }
.m-library-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
.m-library-title { font-size: 20px; font-weight: 700; color: var(--lt-text-primary); margin: 0; }
.m-library-subtitle { font-size: 12px; color: var(--lt-text-auxiliary); margin: 4px 0 0; }
.m-library-new-btn {
  display: flex; align-items: center; gap: 4px; padding: 8px 16px;
  border: none; border-radius: 10px; background: var(--lt-brand); color: #fff;
  font-size: 13px; font-weight: 500; cursor: pointer; touch-action: manipulation; flex-shrink: 0;
}
.m-library-new-btn:active { background: var(--lt-brand-dark); }

/* ===== Tab Bar ===== */
.m-tab-bar {
  display: flex; gap: 4px; margin-bottom: 12px;
  background: var(--lt-bg-card); border-radius: 10px; padding: 3px;
}
.m-tab-item {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px;
  min-height: 44px; padding: 8px 0; font-size: 13px; font-weight: 500;
  color: var(--lt-text-secondary); border-radius: 8px;
  cursor: pointer; touch-action: manipulation; transition: all 0.15s;
}
.m-tab-item.active { background: var(--lt-brand); color: #fff; }

/* ===== Toolbar ===== */
.m-library-toolbar { margin-bottom: 10px; display: flex; flex-direction: column; gap: 8px; }
.m-search-box {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px;
  background: var(--lt-bg-card); border: 0.5px solid var(--lt-border); border-radius: 10px;
}
.m-search-input { flex: 1; border: none; background: transparent; font-size: 15px; color: var(--lt-text-primary); outline: none; }
.m-search-input::placeholder { color: var(--lt-text-placeholder); }
.m-search-clear { border: none; background: none; color: var(--lt-text-placeholder); font-size: 14px; padding: 0 4px; cursor: pointer; }
.m-filter-row { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
.m-filter-row::-webkit-scrollbar { display: none; }
.m-filter-pill {
  display: inline-flex; align-items: center; min-height: 44px; padding: 0 12px; border-radius: 14px; border: 0.5px solid var(--lt-border);
  background: var(--lt-bg-card); font-size: 11px; color: var(--lt-text-secondary);
  white-space: nowrap; cursor: pointer; touch-action: manipulation; flex-shrink: 0;
}
.m-filter-pill.active { border-color: var(--lt-brand); color: var(--lt-brand); background: var(--lt-brand-lightest); }
.m-folder-btn { display: flex; align-items: center; gap: 3px; }
.m-filter-sep { width: 1px; background: var(--lt-border); margin: 0 2px; flex-shrink: 0; }

/* ===== Breadcrumb ===== */
.m-breadcrumb {
  display: flex; align-items: center; gap: 2px; padding: 4px 0 8px;
  font-size: 12px; color: var(--lt-text-auxiliary); overflow-x: auto; scrollbar-width: none;
}
.m-breadcrumb::-webkit-scrollbar { display: none; }
.m-breadcrumb-sep { color: var(--lt-text-placeholder); margin: 0 2px; }
.m-breadcrumb-item { white-space: nowrap; cursor: pointer; flex-shrink: 0; }
.m-breadcrumb-item.active { color: var(--lt-brand); font-weight: 600; }

/* ===== Pack section ===== */
.m-pack-section-label {
  display: flex; align-items: center; justify-content: space-between; padding: 8px 0 10px;
  font-size: 14px; font-weight: 600; color: var(--lt-text-primary);
}
.m-pack-section-count { font-size: 11px; font-weight: 400; color: var(--lt-text-auxiliary); }

/* ===== Resource File Grid ===== */
.m-file-grid { display: flex; flex-direction: column; gap: 8px; }
.m-file-folder-card {
  display: flex; align-items: center; gap: 10px; padding: 12px;
  background: var(--lt-bg-card); border: 0.5px solid var(--lt-border); border-radius: 10px;
  cursor: pointer; touch-action: manipulation;
}
.m-file-folder-card:active { background: var(--lt-brand-lightest); }
.m-file-folder-info { flex: 1; min-width: 0; }
.m-file-folder-name { font-size: 14px; font-weight: 500; color: var(--lt-text-primary); display: block; }
.m-file-folder-count { font-size: 11px; color: var(--lt-text-auxiliary); }
.m-file-card {
  padding: 12px; background: var(--lt-bg-card); border: 0.5px solid var(--lt-border); border-radius: 10px; cursor: pointer;
}
.m-file-card:active { background: var(--lt-brand-lightest); }
.m-file-card-top { display: flex; gap: 6px; margin-bottom: 6px; }
.m-file-type-badge {
  font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; line-height: 1.4;
}
.m-file-type-badge.type-doc { background: #e8f5e9; color: #2e7d32; }
.m-file-type-badge.type-mindmap { background: #fff3e0; color: #e65100; }
.m-file-type-badge.type-quiz { background: #e3f2fd; color: #1565c0; }
.m-file-type-badge.type-reading { background: #f3e5f5; color: #7b1fa2; }
.m-file-type-badge.type-code { background: #fce4ec; color: #c62828; }
.m-file-type-badge.type-video { background: #e8eaf6; color: #283593; }
.m-file-conf-badge {
  font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 500;
}
.m-file-conf-badge.high { background: rgba(52,199,89,0.1); color: var(--lt-success); }
.m-file-conf-badge.medium { background: rgba(255,159,10,0.1); color: var(--lt-warning); }
.m-file-conf-badge.low { background: rgba(255,59,48,0.1); color: var(--lt-danger); }
.m-file-card-title { font-size: 14px; font-weight: 500; color: var(--lt-text-primary); margin-bottom: 4px; }
.m-file-card-meta { font-size: 11px; color: var(--lt-text-auxiliary); margin-bottom: 8px; }
.m-file-card-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.m-file-action {
  display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;
  border: 0.5px solid var(--lt-border); border-radius: 8px; background: var(--lt-bg-page);
  color: var(--lt-text-secondary); cursor: pointer; touch-action: manipulation;
}
.m-file-action:active { background: var(--lt-brand-lightest); }
.m-file-action.danger:active { background: rgba(255,59,48,0.06); color: var(--lt-danger); }

/* ===== Empty ===== */
.m-library-empty { display: flex; flex-direction: column; align-items: center; padding: 40px 24px; text-align: center; }
.m-empty-title { font-size: 15px; font-weight: 500; color: var(--lt-text-secondary); margin: 12px 0 4px; }
.m-empty-desc { font-size: 13px; color: var(--lt-text-placeholder); margin: 0 0 16px; }
.m-empty-action {
  display: flex; align-items: center; gap: 6px; padding: 10px 24px; border: none;
  border-radius: 10px; background: var(--lt-brand); color: #fff; font-size: 14px; cursor: pointer; touch-action: manipulation;
}

/* ===== Pack cards ===== */
.m-pack-list { display: flex; flex-direction: column; gap: 12px; }
.m-pack-card { background: var(--lt-bg-card); border: 0.5px solid var(--lt-border); border-radius: 12px; overflow: hidden; }
.m-pack-header { display: flex; align-items: flex-start; gap: 12px; padding: 14px; cursor: pointer; touch-action: manipulation; }
.m-pack-header:active { background: var(--lt-brand-lightest); }
.m-pack-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
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

/* ===== Notes Shelf ===== */
.m-note-shelf { padding-bottom: 20px; }
.m-nb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }

/* Notebook cards (bookshelf style, ported from web) */
.m-nb-card {
  position: relative;
  border-radius: 3px 8px 8px 3px;
  border: 1px solid var(--lt-border);
  background: var(--lt-bg-card);
  cursor: pointer; overflow: hidden; touch-action: manipulation;
  box-shadow:
    1px 1px 0 #ececec, 2px 2px 0 #e4e4e4, 3px 3px 0 #dcdcdc,
    0 4px 10px rgba(0,0,0,0.08);
  transition: transform 0.25s cubic-bezier(0.25,0.8,0.25,1), box-shadow 0.25s ease;
}
.m-nb-card:active {
  transform: scale(0.97);
  box-shadow:
    1px 1px 0 #ececec, 2px 2px 0 #e4e4e4, 3px 3px 0 #dcdcdc, 4px 4px 0 #d4d4d4,
    0 10px 24px rgba(0,0,0,0.16);
}

/* Cover */
.m-nb-card-cover {
  aspect-ratio: 4 / 5;
  position: relative;
  overflow: hidden;
  border-radius: 2px 7px 0 0;
  border-left: 4px solid rgba(0,0,0,0.22);
  box-shadow: inset 1px 0 0 rgba(0,0,0,0.12);
}
/* Permanent gloss overlay (touch has no hover sweep) */
.m-nb-card-cover::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(155deg,
    rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 25%,
    transparent 40%, rgba(0,0,0,0.03) 70%, rgba(0,0,0,0.08) 100%);
  pointer-events: none;
  z-index: 7; border-radius: inherit;
}
.m-nb-card-decor {
  position: absolute;
  z-index: 2; pointer-events: none;
}

/* Overlay (count display) */
.m-nb-card-overlay {
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
.m-nb-badge {
  position: absolute; top: 6px; right: 6px; z-index: 9;
  font-size: 9px; font-weight: 500; line-height: 1;
  padding: 2px 6px;
  background: rgba(255,255,255,0.9);
  color: var(--lt-text-secondary);
  border-radius: 8px;
  backdrop-filter: blur(4px);
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.m-nb-big-count {
  font-size: 26px; font-weight: 700; color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3); line-height: 1;
  letter-spacing: -0.02em;
}
.m-nb-count-label {
  font-size: 10px; color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3); letter-spacing: 0.05em;
}

/* Spine accent */
.m-nb-card-spine {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 4px;
  z-index: 10;
  opacity: 0.5;
  border-radius: 3px 0 0 3px;
  transition: width 0.3s ease, opacity 0.3s ease;
}
.m-nb-card:active .m-nb-card-spine { width: 6px; opacity: 0.9; }
.m-spine-default { background: #c9a96e; }
.m-spine-blue { background: #4a6fa5; }
.m-spine-green { background: #2d8659; }
.m-spine-orange { background: #8b6332; }
.m-spine-purple { background: #a080b0; }
.m-spine-grid { background: #1a1a1a; }
.m-spine-dot { background: #5040b0; }
.m-spine-wave { background: #807060; }

/* Bottom bar */
.m-nb-card-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 4px;
  padding: 6px 8px;
  border-radius: 0 0 7px 2px;
}
.m-nb-card-name { font-size: 11px; font-weight: 600; color: var(--lt-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-nb-card-actions { display: flex; gap: 2px; flex-shrink: 0; }
.m-nb-act {
  display: flex; align-items: center; justify-content: center;
  width: 44px; height: 44px; border: none; background: transparent;
  color: var(--lt-text-auxiliary); border-radius: 4px; cursor: pointer;
}
.m-nb-act:active { background: var(--lt-bg-page); }
.m-nb-act--del:active { color: var(--lt-danger); }

/* Add card */
.m-nb-card-add .m-nb-cover-add {
  background: var(--lt-bg-page); border: 1.5px dashed var(--lt-border);
  border-left: 4px solid transparent; box-shadow: none;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.m-nb-card-add .m-nb-cover-add::after { display: none; }
.m-nb-add-icon { font-size: 24px; color: var(--lt-text-placeholder); }
.m-nb-add-text { font-size: 10px; color: var(--lt-text-auxiliary); margin-top: 2px; }
.m-nb-card-add:active .m-nb-cover-add { border-color: var(--lt-brand); }

/* Skeleton */
.m-nb-skeleton-row { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
.m-nb-sk { pointer-events: none; }
.m-nb-sk-cover { background: linear-gradient(90deg, var(--lt-border) 25%, #e8ecf0 50%, var(--lt-border) 75%); background-size: 200% 100%; animation: m-sk-shimmer 1.5s infinite; }
.m-nb-sk-line { height: 10px; border-radius: 5px; width: 70%; background: linear-gradient(90deg, var(--lt-border) 25%, #e8ecf0 50%, var(--lt-border) 75%); background-size: 200% 100%; animation: m-sk-shimmer 1.5s infinite; }

/* ===== 8 Cover Designs (ported from web LibraryView) ===== */
.m-nb-cover-default { background: #faf8f5; border: 1px solid #e8e4de; }
.m-nb-cover-default .m-nb-card-decor {
  left: 28%; top: 15%; bottom: 15%; width: 2px;
  background: linear-gradient(to bottom, transparent, #c9a96e, transparent);
}
.m-nb-cover-blue { background: linear-gradient(160deg, #0a0e27 0%, #1a1f4b 40%, #2d1b4e 70%, #0f0f23 100%); }
.m-nb-cover-blue .m-nb-card-decor {
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
.m-nb-cover-green {
  background:
    linear-gradient(#c9a96e, #c9a96e) no-repeat 50% 8% / 30px 2px,
    linear-gradient(135deg, #0d3328 0%, #1a5c4a 50%, #0d3328 100%);
}
.m-nb-cover-green .m-nb-card-decor {
  top: -15%; right: -20%; width: 65%; height: 65%;
  background: rgba(74,222,128,0.15);
  border-radius: 0 100% 0 100%; transform: rotate(15deg);
}
.m-nb-cover-green .m-nb-card-decor::before {
  content: ''; position: absolute; bottom: -50%; left: -40%;
  width: 110%; height: 110%;
  background: rgba(34,197,94,0.12);
  border-radius: 100% 0 100% 0; transform: rotate(-20deg);
}
.m-nb-cover-green .m-nb-card-decor::after {
  content: ''; position: absolute; top: 45%; right: 15%;
  width: 35%; height: 35%;
  background: rgba(134,239,172,0.1);
  border-radius: 50% 50% 0 50%; transform: rotate(45deg);
}
.m-nb-cover-orange {
  background:
    radial-gradient(ellipse at 20% 30%, rgba(0,0,0,0.1), transparent 50%),
    radial-gradient(ellipse at 80% 70%, rgba(0,0,0,0.08), transparent 40%),
    linear-gradient(135deg, #3d2817 0%, #5c3d2e 30%, #4a3020 60%, #3d2817 100%);
}
.m-nb-cover-orange .m-nb-card-decor { inset: 8%; border: 1px dashed rgba(201,169,110,0.4); border-radius: 3px; }
.m-nb-cover-orange .m-nb-card-decor::before {
  content: ''; position: absolute; inset: 4%;
  border: 1px solid rgba(201,169,110,0.2); border-radius: 2px;
}
.m-nb-cover-orange .m-nb-card-decor::after {
  content: ''; position: absolute; top: 50%; left: 50%;
  transform: translate(-50%,-50%) rotate(45deg);
  width: 15%; aspect-ratio: 1;
  border: 1.2px solid rgba(201,169,110,0.45);
}
.m-nb-cover-purple { background: #faf7f4; }
.m-nb-cover-purple .m-nb-card-decor {
  inset: 0;
  background:
    radial-gradient(ellipse 55% 40% at 35% 40%, rgba(210,160,180,0.5), transparent 70%),
    radial-gradient(ellipse 50% 38% at 60% 55%, rgba(150,170,210,0.45), transparent 70%),
    radial-gradient(ellipse 40% 32% at 45% 70%, rgba(200,175,150,0.4), transparent 70%),
    radial-gradient(ellipse 35% 28% at 55% 25%, rgba(180,155,190,0.35), transparent 70%);
  filter: blur(12px);
}
.m-nb-cover-grid {
  background: #e8e0d4;
  background-image:
    linear-gradient(#c9a96e, #c9a96e) no-repeat 58% 22% / 28% 3px,
    linear-gradient(#1a1a1a, #1a1a1a) no-repeat 10% 14% / 20% 20%,
    linear-gradient(#1a1a1a, #1a1a1a) no-repeat 20% 58% / 15% 3px,
    linear-gradient(#1a1a1a, #1a1a1a) no-repeat 20% 70% / 15% 3px,
    linear-gradient(#1a1a1a, #1a1a1a) no-repeat 20% 58% / 3px 15%,
    linear-gradient(#1a1a1a, #1a1a1a) no-repeat 35% 58% / 3px 15%;
}
.m-nb-cover-grid .m-nb-card-decor { inset: 0; }
.m-nb-cover-grid .m-nb-card-decor::before {
  content: ''; position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 40%; aspect-ratio: 1;
  border: 2px solid #1a1a1a; border-radius: 50%;
}
.m-nb-cover-grid .m-nb-card-decor::after {
  content: ''; position: absolute; bottom: 20%; right: 22%;
  width: 12%; height: 30%; background: #c9a96e;
}
.m-nb-cover-dot { background: radial-gradient(ellipse at 55% 30%, #1a1a3a 0%, #0a0a18 40%, #020210 100%); }
.m-nb-cover-dot .m-nb-card-decor {
  inset: 0;
  background:
    radial-gradient(ellipse 55% 35% at 45% 30%, rgba(80,60,180,0.3), transparent 70%),
    radial-gradient(ellipse 40% 28% at 65% 70%, rgba(180,120,60,0.15), transparent 70%);
  filter: blur(6px);
}
.m-nb-cover-dot .m-nb-card-decor::after {
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
.m-nb-cover-wave {
  background:
    linear-gradient(90deg, transparent, rgba(80,70,60,0.1), transparent) no-repeat 10% 28% / 70% 2px,
    linear-gradient(90deg, transparent, rgba(80,70,60,0.06), transparent) no-repeat 30% 52% / 50% 2px,
    linear-gradient(135deg, #f5f0eb 0%, #e8e0d8 50%, #f0ebe5 100%);
}
.m-nb-cover-wave .m-nb-card-decor { inset: 10%; border: 1px solid rgba(80,70,60,0.18); border-radius: 1px; }
.m-nb-cover-wave .m-nb-card-decor::before {
  content: ''; position: absolute; top: 20%; left: -20%;
  width: 140%; height: 2px;
  background: linear-gradient(90deg, transparent, rgba(80,70,60,0.12), transparent);
  border-radius: 50%; filter: blur(1px); transform: rotate(-6deg);
}
.m-nb-cover-wave .m-nb-card-decor::after {
  content: ''; position: absolute; top: 55%; right: -10%;
  width: 80%; height: 2px;
  background: rgba(80,70,60,0.08);
  border-radius: 50%; filter: blur(1px); transform: rotate(4deg);
}

/* ===== Note List ===== */
.m-note-list-view { display: flex; flex-direction: column; min-height: 0; }
.m-note-list-header {
  display: flex; align-items: center; gap: 8px; padding: 4px 0 10px;
  position: sticky; top: 0; z-index: 2; background: var(--lt-bg-page);
}
.m-note-back-btn {
  display: flex; align-items: center; gap: 2px; border: none; background: none;
  font-size: 13px; color: var(--lt-brand); cursor: pointer; padding: 4px 8px 4px 0;
  touch-action: manipulation;
}
.m-note-list-title { font-size: 15px; font-weight: 600; color: var(--lt-text-primary); flex: 1; }
.m-nb-switch {
  font-size: 12px; padding: 4px 8px; border: 0.5px solid var(--lt-border);
  border-radius: 8px; background: var(--lt-bg-card); color: var(--lt-text-primary);
  max-width: 120px;
}
.m-note-filter-hint {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; margin-bottom: 4px; font-size: 12px;
  background-color: var(--lt-ai-light-9); border-radius: 8px;
  color: var(--lt-text-primary);
}
.m-note-filter-hint button {
  border: none; background: none; color: var(--lt-brand); cursor: pointer; font-size: 12px;
}
.m-note-loading { display: flex; flex-direction: column; gap: 8px; padding: 8px 0; }
.m-note-sk-line {
  height: 12px; border-radius: 6px;
  background: linear-gradient(90deg, var(--lt-border) 25%, #e8ecf0 50%, var(--lt-border) 75%);
  background-size: 200% 100%; animation: m-sk-shimmer 1.5s infinite;
}
.w-48 { width: 48%; } .w-3\/4 { width: 75%; }
@keyframes m-sk-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.m-note-empty { display: flex; flex-direction: column; align-items: center; padding: 40px; color: var(--lt-text-secondary); font-size: 14px; }
.m-note-empty span { font-size: 12px; color: var(--lt-text-placeholder); margin-top: 4px; }
.m-note-groups { padding-bottom: 20px; }

/* 资源级分组头（一级） */
.m-note-resource-header {
  display: flex; align-items: center; gap: 6px; padding: 11px 4px;
  font-size: 15px; color: var(--lt-text-primary); font-weight: 700;
  cursor: pointer;
}
.m-note-resource-header:active { background: var(--lt-bg-card); border-radius: 6px; }
.m-note-resource-title {
  flex: 1;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.m-note-resource-body { padding: 6px 0 10px; }

.m-note-group-header {
  display: flex; align-items: center; gap: 8px; padding: 9px 4px 9px 16px;
  font-size: 14px; color: var(--lt-text-secondary); font-weight: 600; cursor: pointer;
}
.m-note-group-header:active { background: var(--lt-bg-card); border-radius: 6px; }
.m-note-arrow { transition: transform 0.2s; font-size: 12px; color: var(--lt-text-placeholder); }
.m-note-arrow.collapsed { transform: rotate(0deg); }
.m-note-arrow:not(.collapsed) { transform: rotate(90deg); }
.m-note-group-title { flex: 1; }
.m-note-group-count { font-size: 12px; color: var(--lt-text-placeholder); background: var(--lt-bg-card); padding: 2px 8px; border-radius: 10px; }
.m-note-group-body { margin: 0; padding: 0 0 4px; display: flex; flex-direction: column; }

/* ===== Question Bank ===== */
.m-qb-section { margin-bottom: 8px; }
.m-qb-wrong-card {
  display: flex; align-items: baseline; gap: 6px; padding: 12px 16px;
  background: var(--lt-bg-card); border: 0.5px solid var(--lt-border); border-radius: 10px;
  cursor: pointer; touch-action: manipulation;
}
.m-qb-wrong-card:active { background: rgba(255,59,48,0.04); }
.m-qb-wrong-value { font-size: 24px; font-weight: 700; color: var(--lt-danger); line-height: 1; }
.m-qb-wrong-label { font-size: 13px; color: var(--lt-text-secondary); }
.m-qb-kp-row { margin-bottom: 8px; }
.m-qb-kp-title { font-size: 12px; font-weight: 600; color: var(--lt-text-secondary); display: block; margin-bottom: 6px; }
.m-qb-kp-list { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
.m-qb-kp-list::-webkit-scrollbar { display: none; }
.m-qb-kp-pill {
  display: flex; align-items: center; gap: 4px; padding: 4px 10px;
  border: 0.5px solid var(--lt-border); border-radius: 14px;
  background: var(--lt-bg-card); font-size: 11px; white-space: nowrap;
  cursor: pointer; touch-action: manipulation; flex-shrink: 0;
}
.m-qb-kp-pill.active { border-color: var(--lt-brand); background: var(--lt-brand-lightest); }
.m-qb-kp-name { color: var(--lt-text-primary); }
.m-qb-kp-rate { font-weight: 600; }
.m-qb-filters { display: flex; gap: 6px; margin-bottom: 8px; }
.m-qb-select {
  flex: 1; padding: 8px 6px; border: 0.5px solid var(--lt-border); border-radius: 8px;
  background: var(--lt-bg-card); font-size: 12px; color: var(--lt-text-primary);
}
.m-qb-kp-active {
  display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--lt-brand);
  padding: 4px 0 8px;
}
.m-qb-kp-active button { border: none; background: none; color: var(--lt-text-auxiliary); cursor: pointer; font-size: 12px; }
.m-qb-loading { display: flex; flex-direction: column; gap: 8px; }
.m-qb-sk { height: 56px; border-radius: 8px; background: linear-gradient(90deg, var(--lt-border) 25%, #e8ecf0 50%, var(--lt-border) 75%); background-size: 200% 100%; animation: m-sk-shimmer 1.5s infinite; }
.m-qb-list { display: flex; flex-direction: column; gap: 6px; }
.m-qb-card {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px;
  background: var(--lt-bg-card); border: 0.5px solid var(--lt-border); border-radius: 10px;
  cursor: pointer; touch-action: manipulation;
}
.m-qb-card:active { border-color: var(--lt-brand-light); }
.m-qb-card-left { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 40px; flex-shrink: 0; }
.m-qb-type-tag { font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; line-height: 1.4; white-space: nowrap; }
.qb-type--single_choice { background: #e8f5e9; color: #2e7d32; }
.qb-type--multiple_choice { background: #e3f2fd; color: #1565c0; }
.qb-type--true_false { background: #fff3e0; color: #e65100; }
.qb-type--fill_blank { background: #f3e5f5; color: #7b1fa2; }
.qb-type--short_answer { background: #fce4ec; color: #c62828; }
.qb-type--code { background: #e8eaf6; color: #283593; }
.m-qb-diff { font-size: 10px; color: #f59e0b; letter-spacing: -1px; }
.m-qb-card-body { flex: 1; min-width: 0; }
.m-qb-card-title { font-size: 13px; font-weight: 500; color: var(--lt-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-qb-card-meta { font-size: 10px; color: var(--lt-text-auxiliary); margin-top: 2px; display: flex; gap: 6px; }
.m-qb-card-kp { background: var(--lt-ai-light-9); color: var(--lt-ai); padding: 0 4px; border-radius: 3px; }
.m-qb-del-btn { border: none; background: none; color: var(--lt-text-placeholder); cursor: pointer; padding: 4px; min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.m-qb-del-btn:active { color: var(--lt-danger); }

/* Selection */
.m-qb-card--selected { background: var(--lt-brand-lightest); border-color: var(--lt-brand); }
.m-qb-check-btn {
  border: none; background: none; padding: 0; flex-shrink: 0;
  min-width: 32px; min-height: 32px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; touch-action: manipulation;
}
.m-qb-check-circle {
  width: 20px; height: 20px; border-radius: 50%;
  border: 1.5px solid var(--lt-border); background: var(--lt-bg-card);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; color: #fff; transition: all 0.15s;
}
.m-qb-check-circle.checked { background: var(--lt-brand); border-color: var(--lt-brand); }

/* Selection toolbar */
.m-qb-select-bar {
  display: flex; align-items: center; gap: 8px; padding: 8px 0; margin-bottom: 4px;
}
.m-qb-select-all {
  display: flex; align-items: center; gap: 6px; border: none; background: none;
  font-size: 13px; color: var(--lt-text-secondary); cursor: pointer; touch-action: manipulation;
  padding: 4px 0;
}
.m-qb-select-info { flex: 1; min-width: 0; }
.m-qb-selected-count { font-size: 12px; color: var(--lt-brand); font-weight: 600; }
.m-qb-practice-btn {
  padding: 6px 14px; border-radius: var(--lt-radius-full); border: none;
  background: var(--lt-bg-page); color: var(--lt-text-secondary); font-size: 13px; font-weight: 500;
  cursor: pointer; touch-action: manipulation; transition: all 0.15s; flex-shrink: 0;
}
.m-qb-practice-btn--active { background: var(--lt-brand); color: #fff; }
.m-qb-practice-btn:active { transform: scale(0.96); }

/* ===== Folder Sheet ===== */
.m-folder-sheet-body { display: flex; flex-direction: column; gap: 2px; }
.m-folder-action-row { padding: 4px 0 8px; }
.m-folder-action-btn {
  display: flex; align-items: center; gap: 4px; width: 100%; padding: 10px 12px;
  border: 0.5px dashed var(--lt-brand-lighter); border-radius: 8px;
  background: var(--lt-brand-lightest); color: var(--lt-brand); font-size: 13px;
  cursor: pointer; touch-action: manipulation;
}
.m-folder-section-label {
  font-size: 11px; font-weight: 600; color: var(--lt-text-auxiliary);
  padding: 10px 4px 4px; text-transform: uppercase; letter-spacing: 0.05em;
}
.m-folder-item {
  display: flex; align-items: center; gap: 8px; padding: 10px 8px;
  border-radius: 6px; cursor: pointer; font-size: 13px; color: var(--lt-text-primary);
  touch-action: manipulation;
}
.m-folder-item.active { background: var(--lt-brand-lightest); color: var(--lt-brand); font-weight: 500; }
.m-folder-item:active { background: var(--lt-brand-lightest); }
.m-folder-item--child { padding-left: 32px; font-size: 12px; }
.m-folder-item--add { padding-left: 32px; }
.m-folder-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-folder-count { font-size: 11px; color: var(--lt-text-placeholder); min-width: 16px; text-align: right; }
.m-folder-expand-btn { border: none; background: none; padding: 0; cursor: pointer; width: 16px; }
.m-folder-arrow { display: inline-block; transition: transform 0.15s; font-size: 10px; color: var(--lt-text-placeholder); }
.m-folder-arrow.open { transform: rotate(90deg); }
.m-folder-ctx-btn {
  display: flex; align-items: center; justify-content: center;
  width: 44px; height: 44px; border: none; background: transparent;
  color: var(--lt-text-auxiliary); border-radius: 4px; cursor: pointer;
}
.m-folder-ctx-btn:active { background: var(--lt-bg-page); }
.m-folder-ctx-btn.danger:active { color: var(--lt-danger); }
.m-folder-children { padding-left: 8px; }
/* Folder CRUD */
.m-folder-crud-body { display: flex; flex-direction: column; gap: 12px; }
.m-folder-input {
  width: 100%; padding: 12px; border: 0.5px solid var(--lt-border); border-radius: 8px;
  font-size: 16px; color: var(--lt-text-primary); background: var(--lt-bg-card);
  outline: none; box-sizing: border-box;
}
.m-folder-input:focus { border-color: var(--lt-brand); }
.m-folder-crud-actions { display: flex; gap: 8px; }
.m-folder-cancel, .m-folder-confirm {
  flex: 1; padding: 12px; border: none; border-radius: 8px; font-size: 15px; font-weight: 500;
  cursor: pointer; touch-action: manipulation;
}
.m-folder-cancel { background: var(--lt-bg-page); color: var(--lt-text-secondary); }
.m-folder-confirm { background: var(--lt-brand); color: #fff; }
.m-folder-confirm:disabled { opacity: 0.5; }
.m-folder-cancel:active { background: var(--lt-border); }
.m-folder-confirm:active { background: var(--lt-brand-dark); }

/* ===== Add Resource ===== */
.m-add-res-loading { padding: 40px; text-align: center; color: var(--lt-text-auxiliary); font-size: 14px; }
.m-add-res-body { display: flex; flex-direction: column; gap: 4px; }
.m-add-res-item {
  display: flex; align-items: center; gap: 10px; padding: 10px 8px;
  border-radius: 8px; cursor: pointer; touch-action: manipulation;
}
.m-add-res-item.selected { background: var(--lt-brand-lightest); }
.m-add-res-item:active { background: var(--lt-brand-lightest); }
.m-add-res-check {
  width: 20px; height: 20px; border-radius: 4px; border: 1.5px solid var(--lt-border);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  font-size: 12px; color: #fff; transition: all 0.15s;
}
.m-add-res-check.checked { background: var(--lt-brand); border-color: var(--lt-brand); }
.m-add-res-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.m-add-res-title { font-size: 13px; color: var(--lt-text-primary); }
.m-add-res-type { font-size: 11px; color: var(--lt-text-auxiliary); }
.m-add-res-empty { padding: 32px; text-align: center; color: var(--lt-text-placeholder); }
.m-add-res-footer {
  display: flex; gap: 8px; padding: 12px 0 0;
  border-top: 0.5px solid var(--lt-border); margin-top: 8px;
}

/* ===== Preview ===== */
.m-preview-body { display: flex; flex-direction: column; gap: 12px; }
.m-preview-mode { display: flex; gap: 6px; }
.m-preview-mode button {
  flex: 1; padding: 8px; border: 0.5px solid var(--lt-border); border-radius: 8px;
  background: var(--lt-bg-card); font-size: 13px; color: var(--lt-text-secondary); cursor: pointer;
}
.m-preview-mode button.active { border-color: var(--lt-brand); color: var(--lt-brand); background: var(--lt-brand-lightest); }
.m-preview-meta { display: flex; gap: 8px; font-size: 11px; flex-wrap: wrap; }
.m-preview-conf { padding: 2px 8px; border-radius: 6px; font-weight: 500; }
.m-preview-conf.high { background: rgba(52,199,89,0.1); color: var(--lt-success); }
.m-preview-conf.medium { background: rgba(255,159,10,0.1); color: var(--lt-warning); }
.m-preview-conf.low { background: rgba(255,59,48,0.1); color: var(--lt-danger); }
.m-preview-score { color: var(--lt-text-auxiliary); }
.m-file-preview-actions { display: flex; gap: 8px; }
.m-file-preview-actions button {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px;
  padding: 10px; border: 0.5px solid var(--lt-brand-lighter); border-radius: 8px;
  background: var(--lt-brand-lightest); color: var(--lt-brand); font-size: 13px; cursor: pointer;
}
.m-preview-sources { margin-top: 4px; }
.m-source-btn { width: 100%; padding: 10px; border: 0.5px solid var(--lt-border); border-radius: 8px; background: var(--lt-bg-page); font-size: 13px; cursor: pointer; }
.m-preview-downloads { display: flex; gap: 8px; }
.m-dl-btn {
  display: flex; align-items: center; gap: 4px; padding: 8px 14px;
  border: 0.5px solid var(--lt-brand-lighter); border-radius: 8px; background: var(--lt-brand-lightest);
  color: var(--lt-brand); font-size: 12px; cursor: pointer;
}

/* ===== Evidence ===== */
.m-evidence-list { display: flex; flex-direction: column; gap: 8px; }
.m-evidence-item { padding: 10px 12px; background: var(--lt-bg-page); border-radius: 8px; border: 0.5px solid var(--lt-border); }
.m-evidence-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.m-evidence-title { font-size: 13px; font-weight: 500; color: var(--lt-text-primary); }
.m-evidence-locator { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: var(--lt-bg-card); color: var(--lt-text-auxiliary); }
.m-evidence-quote { font-size: 12px; color: var(--lt-text-auxiliary); font-style: italic; margin: 0; }

/* ===== Question Detail ===== */
.m-qb-detail { display: flex; flex-direction: column; gap: 14px; }
.m-qb-detail-sk { display: flex; flex-direction: column; gap: 8px; }
.m-qb-detail-header { display: flex; align-items: center; gap: 8px; font-size: 12px; flex-wrap: wrap; }
.m-qb-detail-diff { color: #f59e0b; }
.m-qb-detail-section-title { font-size: 12px; font-weight: 600; color: var(--lt-text-secondary); margin-bottom: 4px; }
.m-qb-detail-content { font-size: 14px; line-height: 1.6; color: var(--lt-text-primary); white-space: pre-wrap; }
.m-qb-opt-item { display: flex; gap: 6px; padding: 6px 8px; border: 0.5px solid var(--lt-border); border-radius: 6px; font-size: 13px; }
.m-qb-opt-label { font-weight: 700; color: var(--lt-text-secondary); flex-shrink: 0; width: 18px; }
.m-qb-detail-answer { font-size: 13px; color: var(--lt-success); font-weight: 600; padding: 6px 10px; background: #f0fdf4; border-radius: 6px; border: 0.5px solid #bbf7d0; }
.m-qb-detail-explain { font-size: 13px; line-height: 1.6; color: var(--lt-text-primary); white-space: pre-wrap; padding: 8px; background: var(--lt-bg-page); border-radius: 6px; }
.m-qb-detail-meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 11px; color: var(--lt-text-auxiliary); padding-top: 8px; border-top: 0.5px solid var(--lt-border); }

/* Rate colors */
.rate-high { color: var(--lt-success); }
.rate-mid { color: #f59e0b; }
.rate-low { color: var(--lt-danger); }

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
  border-radius: 50%; animation: m-pull-spin 0.6s linear infinite;
}
@keyframes m-pull-spin { to { transform: rotate(360deg); } }
</style>
