<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Close, EditPen, Plus } from '@element-plus/icons-vue'
import type { Note } from '@/types'
import { useNoteStore } from '@/stores/note'
import { useNotebookStore } from '@/stores/notebook'
import NoteCard from './NoteCard.vue'
import NoteInput from './NoteInput.vue'
import EmptyState from '@/components/EmptyState.vue'

const props = withDefaults(defineProps<{
  courseId: string
  resourcePackId?: string
  resourceTitle?: string
  sectionTitle?: string
  sectionOrder?: string[]
  selectedText?: string
  anchorId?: string
  textRange?: string
}>(), { sectionOrder: () => [] })

const emit = defineEmits<{ close: [] }>()
const noteStore = useNoteStore()
const notebookStore = useNotebookStore()

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
interface GroupedResult { resources: ResourceGroup[]; flat: boolean }

// 单资源视图（带 resourcePackId）降级为单级章节分组，跳过资源层
const isSingleResource = computed(() => !!props.resourcePackId)

const groupedNotes = computed<GroupedResult>(() => {
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

  // 章节排序：sectionOrder 优先，资源级笔记置末
  for (const res of resourceMap.values()) {
    res.sections.sort((a, b) => {
      if (a.key === RESOURCE_LEVEL_KEY) return 1
      if (b.key === RESOURCE_LEVEL_KEY) return -1
      const oa = props.sectionOrder.indexOf(a.title)
      const ob = props.sectionOrder.indexOf(b.title)
      if (oa !== -1 && ob !== -1) return oa - ob
      if (oa !== -1) return -1
      if (ob !== -1) return 1
      return a.title.localeCompare(b.title, 'zh-CN')
    })
    for (const sec of res.sections) {
      sec.notes.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    }
  }

  // 资源排序：最近笔记时间倒序
  const resources = [...resourceMap.values()].sort((a, b) => b.latest - a.latest)
  return { resources, flat: isSingleResource.value }
})

const collapsedGroups = ref<Set<string>>(new Set())
function toggleGroup(key: string) {
  if (collapsedGroups.value.has(key)) collapsedGroups.value.delete(key)
  else collapsedGroups.value.add(key)
}
function resCollapseKey(resKey: string) {
  return `res::${resKey}`
}
function secCollapseKey(resKey: string, secKey: string) {
  return `sec::${resKey}::${secKey}`
}

function onNoteDeleted(noteId: string) {
  noteStore.deleteNote(noteId)
}

function onNoteEdit(note: Note) {
  noteStore.startEditNote(note)
}

function handleJumpToOriginal(anchorId: string) {
  const el = document.getElementById(anchorId)
  if (!el) {
    ElMessage.warning('原文段落已不在当前页面')
    return
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('note-original-highlight')
  setTimeout(() => el.classList.remove('note-original-highlight'), 2000)
  const selection = window.getSelection()
  if (selection) {
    const range = document.createRange()
    range.selectNodeContents(el)
    selection.removeAllRanges()
    selection.addRange(range)
  }
}

const noteListRef = ref<HTMLElement>()
function scrollToTop() {
  noteListRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

// ===== Resizable sidebar =====
const WIDTH_KEY = 'lt-note-sidebar-width'
const sidebarWidth = ref(parseInt(localStorage.getItem(WIDTH_KEY) || '320', 10))
watch(sidebarWidth, (val) => {
  localStorage.setItem(WIDTH_KEY, String(val))
})

const HEIGHT_KEY = 'lt-note-sidebar-height'
const sidebarHeight = ref(parseInt(localStorage.getItem(HEIGHT_KEY) || '', 10) || 0)
watch(sidebarHeight, (val) => {
  localStorage.setItem(HEIGHT_KEY, val > 0 ? String(val) : '')
})

const resizing = ref<'w' | 'h' | null>(null)
const MIN_WIDTH = 240
const MAX_WIDTH = 500
const MIN_HEIGHT = 300

function onResizeStart(e: MouseEvent, dir: 'w' | 'h') {
  e.preventDefault()
  resizing.value = dir
  const startX = e.clientX
  const startY = e.clientY
  const startW = sidebarWidth.value
  const startH = sidebarHeight.value || (document.querySelector('.note-sidebar') as HTMLElement)?.offsetHeight || 400

  function onMouseMove(ev: MouseEvent) {
    if (dir === 'w') {
      const dx = startX - ev.clientX
      sidebarWidth.value = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW + dx))
    } else {
      const maxH = window.innerHeight - 150
      const dy = ev.clientY - startY
      sidebarHeight.value = Math.min(maxH, Math.max(MIN_HEIGHT, startH + dy))
    }
  }

  function onMouseUp() {
    resizing.value = null
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.body.style.cursor = dir === 'w' ? 'col-resize' : 'row-resize'
  document.body.style.userSelect = 'none'
}

// ===== Notebook data loading =====
watch(() => props.courseId, (cid) => {
  if (cid) notebookStore.ensureLoaded(cid)
}, { immediate: true })

watch(
  () => [props.resourcePackId, notebookStore.activeNotebookId] as const,
  ([resPackId, nbId]) => {
    if (!props.courseId || !nbId) return
    noteStore.fetchNotes({
      courseId: props.courseId,
      resourcePackId: resPackId || undefined,
      notebookId: nbId,
    })
  },
  { immediate: true },
)

// ===== Notebook navigation =====
function enterNotebook(id: string) {
  notebookStore.setActive(id)
  noteStore.enterNotebookView()
}

function backToList() {
  noteStore.showList()
}

function backToNotebook() {
  noteStore.hideNoteEditor()
}

function onNoteSaved() {
  noteStore.hideNoteEditor()
  scrollToTop()
}

// ===== Create notebook dialog =====
const showCreateDialog = ref(false)
const newName = ref('')
const newDescription = ref('')
const newCover = ref('default')
const savingNotebook = ref(false)

const COVER_OPTIONS: { value: string; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: 'blue', label: '科技蓝' },
  { value: 'green', label: '清新绿' },
  { value: 'orange', label: '暖心橙' },
  { value: 'purple', label: 'AI紫' },
  { value: 'grid', label: '网格' },
  { value: 'dot', label: '圆点' },
  { value: 'wave', label: '波浪' },
]

function openCreateDialog() {
  newName.value = ''
  newDescription.value = ''
  newCover.value = 'default'
  showCreateDialog.value = true
}

async function confirmCreateNotebook() {
  const name = newName.value.trim()
  if (!name || !props.courseId) return
  savingNotebook.value = true
  const nb = await notebookStore.create({
    courseId: props.courseId,
    name,
    description: newDescription.value.trim() || undefined,
    cover: newCover.value,
  })
  savingNotebook.value = false
  if (nb) showCreateDialog.value = false
}
</script>

<template>
  <Transition name="note-slide">
    <div v-if="noteStore.sidebarOpen" class="note-sidebar" :style="{ width: sidebarWidth + 'px', ...(sidebarHeight ? { height: sidebarHeight + 'px' } : {}) }">
      <div class="note-sidebar-resizer-w" @mousedown="(e) => onResizeStart(e, 'w')" :class="{ resizing: resizing === 'w' }"></div>

      <!-- Header -->
      <div class="note-sidebar-header">
        <template v-if="noteStore.sidebarView === 'notebook'">
          <el-button text size="small" class="notebook-back-btn" @click="backToList">
            <el-icon><ArrowLeft /></el-icon>
          </el-button>
          <span class="note-sidebar-title">
            <span class="notebook-cover-dot" :class="`cover-${notebookStore.activeNotebook?.cover || 'default'}`"></span>
            {{ notebookStore.activeNotebook?.name || '笔记' }}
            <span v-if="noteStore.availableCount" class="note-count">({{ noteStore.availableCount }})</span>
          </span>
        </template>
        <template v-else-if="noteStore.sidebarView === 'editor'">
          <el-button text size="small" class="notebook-back-btn" @click="backToNotebook">
            <el-icon><ArrowLeft /></el-icon>
          </el-button>
          <span class="note-sidebar-title">{{ noteStore.editingNote ? '编辑笔记' : '新建笔记' }}</span>
        </template>
        <template v-else>
          <span class="note-sidebar-title">
            <el-icon><EditPen /></el-icon>
            笔记本
          </span>
          <el-button text size="small" class="notebook-create-btn" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            新建
          </el-button>
        </template>
        <el-button text size="small" @click="noteStore.closeSidebar()">
          <el-icon><Close /></el-icon>
        </el-button>
      </div>

      <!-- ===== View: Notebook list (书架) ===== -->
      <div v-if="noteStore.sidebarView === 'list'" class="notebook-grid">
        <div v-if="notebookStore.loading" class="notebook-loading">
          <div class="note-skeleton-line" />
          <div class="note-skeleton-line w-80" />
          <div class="note-skeleton-line w-60" />
        </div>
        <template v-else>
          <div
            v-for="nb in notebookStore.notebooks"
            :key="nb.id"
            class="nb-card"
            :title="nb.description"
            @click="enterNotebook(nb.id)"
          >
            <div class="nb-card-cover" :class="`cover-${nb.cover || 'default'}`">
              <div class="nb-card-decor"></div>
              <span v-if="nb.isDefault" class="nb-default-badge">默认</span>
            </div>
            <div class="nb-card-bar">
              <span class="nb-card-name">{{ nb.name }}</span>
            </div>
          </div>
          <div class="nb-card nb-card-add" @click="openCreateDialog">
            <div class="nb-card-cover nb-card-add-cover">
              <el-icon class="nb-add-icon"><Plus /></el-icon>
            </div>
            <div class="nb-card-bar">
              <span class="nb-card-name">新建笔记本</span>
            </div>
          </div>
        </template>
      </div>

      <!-- ===== View: Notebook inner (笔记列表) ===== -->
      <template v-else-if="noteStore.sidebarView === 'notebook'">
        <div v-if="noteStore.loading" class="note-loading">
          <div class="note-skeleton-line" />
          <div class="note-skeleton-line w-80" />
          <div class="note-skeleton-line w-60" />
        </div>

        <div v-else-if="noteStore.error" class="note-error">
          {{ noteStore.error }}
          <el-button size="small" text @click="noteStore.fetchNotes({
            courseId: props.courseId,
            resourcePackId: props.resourcePackId,
            notebookId: notebookStore.activeNotebookId || undefined,
          })">重试</el-button>
        </div>

        <EmptyState
          v-else-if="noteStore.availableCount === 0"
          :icon="EditPen"
          title="暂无笔记"
          description="点击下方「新建笔记」开始记录"
          size="default"
        />

        <div v-else ref="noteListRef" class="note-list">
          <template v-for="res in groupedNotes.resources" :key="res.key">
            <div
              v-if="!groupedNotes.flat"
              class="note-resource-header"
              @click="toggleGroup(resCollapseKey(res.key))"
            >
              <span class="note-group-arrow" :class="{ collapsed: collapsedGroups.has(resCollapseKey(res.key)) }">▸</span>
              <span class="note-resource-title">📄 {{ res.title }}</span>
              <span class="note-group-count">{{ res.count }}</span>
            </div>
            <div
              v-if="groupedNotes.flat || !collapsedGroups.has(resCollapseKey(res.key))"
              class="note-resource-body"
              :class="{ 'note-resource-body--flat': groupedNotes.flat }"
            >
              <div v-for="sec in res.sections" :key="sec.key" class="note-group">
                <div class="note-group-header" @click="toggleGroup(secCollapseKey(res.key, sec.key))">
                  <span class="note-group-arrow" :class="{ collapsed: collapsedGroups.has(secCollapseKey(res.key, sec.key)) }">▸</span>
                  <span class="note-group-title">{{ sec.title }}</span>
                  <span class="note-group-count">{{ sec.notes.length }}</span>
                </div>
                <TransitionGroup
                  v-if="!collapsedGroups.has(secCollapseKey(res.key, sec.key))"
                  name="note-list"
                  tag="div"
                  class="note-group-body"
                >
                  <NoteCard
                    v-for="note in sec.notes"
                    :key="note.id"
                    :note="note"
                    @deleted="onNoteDeleted(note.id)"
                    @edit="onNoteEdit(note)"
                    @jump-to-original="handleJumpToOriginal"
                  />
                </TransitionGroup>
              </div>
            </div>
          </template>
        </div>

        <div class="note-new-btn" @click="noteStore.showNoteEditor()">
          <el-icon><Plus /></el-icon>
          <span>新建笔记</span>
        </div>
      </template>

      <!-- ===== View: Note editor (编辑笔记) ===== -->
      <template v-else-if="noteStore.sidebarView === 'editor'">
        <NoteInput
          class="note-sidebar-editor"
          :full-page="true"
          :course-id="props.courseId"
          :section-title="props.sectionTitle"
          :resource-pack-id="props.resourcePackId"
          :resource-title="props.resourceTitle"
          :selected-text="props.selectedText"
          :anchor-id="props.anchorId"
          :text-range="props.textRange"
          @saved="onNoteSaved"
        />
      </template>

      <!-- Create notebook dialog -->
      <el-dialog
        v-model="showCreateDialog"
        title="新建笔记本"
        width="360px"
        :append-to-body="true"
        class="notebook-create-dialog"
      >
        <div class="create-form">
          <div class="create-field">
            <label class="create-label">名称 <span class="create-required">*</span></label>
            <el-input v-model="newName" placeholder="输入笔记本名称" maxlength="50" show-word-limit />
          </div>
          <div class="create-field">
            <label class="create-label">描述</label>
            <el-input
              v-model="newDescription"
              type="textarea"
              :rows="2"
              placeholder="可选，描述笔记本用途"
              maxlength="200"
            />
          </div>
          <div class="create-field">
            <label class="create-label">封面</label>
            <div class="cover-picker">
              <div
                v-for="opt in COVER_OPTIONS"
                :key="opt.value"
                class="cover-option"
                :class="[`cover-${opt.value}`, { selected: newCover === opt.value }]"
                @click="newCover = opt.value"
              >
                <span class="cover-option-label">{{ opt.label }}</span>
              </div>
            </div>
          </div>
        </div>
        <template #footer>
          <el-button @click="showCreateDialog = false">取消</el-button>
          <el-button type="primary" :loading="savingNotebook" :disabled="!newName.trim()" @click="confirmCreateNotebook">
            创建
          </el-button>
        </template>
      </el-dialog>

      <div class="note-sidebar-resizer-h" @mousedown="(e) => onResizeStart(e, 'h')" :class="{ resizing: resizing === 'h' }"></div>
    </div>
  </Transition>
</template>

<style scoped>
.note-sidebar {
  position: fixed; right: 16px; top: 128px;
  width: 320px; max-height: calc(100vh - 140px);
  display: flex; flex-direction: column;
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-lg);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  z-index: 100;
}
.note-sidebar-header {
  display: flex; align-items: center; gap: 6px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--lt-border);
  flex-shrink: 0;
}
.notebook-back-btn { flex-shrink: 0; padding: 4px !important; }
.notebook-create-btn { flex-shrink: 0; color: var(--lt-brand); }
.note-sidebar-title {
  display: flex; align-items: center; gap: 6px; flex: 1;
  font-size: 15px; font-weight: 700; color: var(--lt-text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.notebook-cover-dot {
  display: inline-block; flex-shrink: 0;
  width: 14px; height: 14px; border-radius: 4px;
}
.note-count { font-size: 13px; color: var(--lt-text-auxiliary); font-weight: 400; }

/* ===== Notebook grid (书架) ===== */
.notebook-grid {
  flex: 1; overflow-y: auto;
  padding: 12px 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 10px;
  align-content: start;
}
.notebook-loading { grid-column: 1 / -1; padding: 16px; display: flex; flex-direction: column; gap: 10px; }

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
/* Permanent gloss overlay (deepseek style) */
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
/* Decor layer */
.nb-card-decor {
  position: absolute;
  z-index: 2; pointer-events: none;
}
.nb-default-badge {
  position: absolute; top: 6px; right: 6px;
  font-size: 9px; font-weight: 500; line-height: 1;
  padding: 2px 6px;
  background: rgba(255,255,255,0.9);
  color: var(--lt-text-secondary);
  border-radius: 8px; z-index: 9;
  backdrop-filter: blur(4px);
}

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

/* ===== 8 Cover Designs (from reference) ===== */

/* default — Minimalist cream + gold line (code5 cover-1) */
.cover-default {
  background: #faf8f5;
  border: 1px solid #e8e4de;
}
.cover-default .nb-card-decor {
  left: 28%; top: 15%; bottom: 15%;
  width: 2px;
  background: linear-gradient(to bottom, transparent, #c9a96e, transparent);
}

/* blue — Starry night (code5 cover-2) */
.cover-blue {
  background: linear-gradient(160deg, #0a0e27 0%, #1a1f4b 40%, #2d1b4e 70%, #0f0f23 100%);
}
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

/* green — Tropical leaves (code5 cover-5) */
.cover-green {
  background:
    linear-gradient(#c9a96e, #c9a96e) no-repeat 50% 8% / 30px 2px,
    linear-gradient(135deg, #0d3328 0%, #1a5c4a 50%, #0d3328 100%);
}
.cover-green .nb-card-decor {
  top: -15%; right: -20%;
  width: 65%; height: 65%;
  background: rgba(74,222,128,0.15);
  border-radius: 0 100% 0 100%;
  transform: rotate(15deg);
}
.cover-green .nb-card-decor::before {
  content: '';
  position: absolute;
  bottom: -50%; left: -40%;
  width: 110%; height: 110%;
  background: rgba(34,197,94,0.12);
  border-radius: 100% 0 100% 0;
  transform: rotate(-20deg);
}
.cover-green .nb-card-decor::after {
  content: '';
  position: absolute;
  top: 45%; right: 15%;
  width: 35%; height: 35%;
  background: rgba(134,239,172,0.1);
  border-radius: 50% 50% 0 50%;
  transform: rotate(45deg);
}

/* orange — Vintage leather (code5 cover-6) */
.cover-orange {
  background:
    radial-gradient(ellipse at 20% 30%, rgba(0,0,0,0.1), transparent 50%),
    radial-gradient(ellipse at 80% 70%, rgba(0,0,0,0.08), transparent 40%),
    linear-gradient(135deg, #3d2817 0%, #5c3d2e 30%, #4a3020 60%, #3d2817 100%);
}
.cover-orange .nb-card-decor {
  inset: 8%;
  border: 1px dashed rgba(201,169,110,0.4);
  border-radius: 3px;
}
.cover-orange .nb-card-decor::before {
  content: '';
  position: absolute;
  inset: 4%;
  border: 1px solid rgba(201,169,110,0.2);
  border-radius: 2px;
}
.cover-orange .nb-card-decor::after {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%,-50%) rotate(45deg);
  width: 15%; aspect-ratio: 1;
  border: 1.2px solid rgba(201,169,110,0.45);
}

/* purple — Watercolor wash (deepseek cover-6) */
.cover-purple {
  background: #faf7f4;
}
.cover-purple .nb-card-decor {
  inset: 0;
  background:
    radial-gradient(ellipse 55% 40% at 35% 40%, rgba(210,160,180,0.5), transparent 70%),
    radial-gradient(ellipse 50% 38% at 60% 55%, rgba(150,170,210,0.45), transparent 70%),
    radial-gradient(ellipse 40% 32% at 45% 70%, rgba(200,175,150,0.4), transparent 70%),
    radial-gradient(ellipse 35% 28% at 55% 25%, rgba(180,155,190,0.35), transparent 70%);
  filter: blur(12px);
}

/* grid — Bauhaus geometric (code5 cover-4) */
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
.cover-grid .nb-card-decor {
  inset: 0;
}
.cover-grid .nb-card-decor::before {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 40%; aspect-ratio: 1;
  border: 2px solid #1a1a1a;
  border-radius: 50%;
}
.cover-grid .nb-card-decor::after {
  content: '';
  position: absolute;
  bottom: 20%; right: 22%;
  width: 12%; height: 30%;
  background: #c9a96e;
}

/* dot — Deep space nebula (deepseek cover-2) */
.cover-dot {
  background: radial-gradient(ellipse at 55% 30%, #1a1a3a 0%, #0a0a18 40%, #020210 100%);
}
.cover-dot .nb-card-decor {
  inset: 0;
  background:
    radial-gradient(ellipse 55% 35% at 45% 30%, rgba(80,60,180,0.3), transparent 70%),
    radial-gradient(ellipse 40% 28% at 65% 70%, rgba(180,120,60,0.15), transparent 70%);
  filter: blur(6px);
}
.cover-dot .nb-card-decor::after {
  content: '';
  position: absolute;
  inset: 0;
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

/* wave — Marble with gold frame (code5 cover-7 + deepseek cover-7) */
.cover-wave {
  background:
    linear-gradient(90deg, transparent, rgba(80,70,60,0.1), transparent) no-repeat 10% 28% / 70% 2px,
    linear-gradient(90deg, transparent, rgba(80,70,60,0.06), transparent) no-repeat 30% 52% / 50% 2px,
    linear-gradient(135deg, #f5f0eb 0%, #e8e0d8 50%, #f0ebe5 100%);
}
.cover-wave .nb-card-decor {
  inset: 10%;
  border: 1px solid rgba(80,70,60,0.18);
  border-radius: 1px;
}
.cover-wave .nb-card-decor::before {
  content: '';
  position: absolute;
  top: 20%; left: -20%;
  width: 140%; height: 2px;
  background: linear-gradient(90deg, transparent, rgba(80,70,60,0.12), transparent);
  border-radius: 50%;
  filter: blur(1px);
  transform: rotate(-6deg);
}
.cover-wave .nb-card-decor::after {
  content: '';
  position: absolute;
  top: 55%; right: -10%;
  width: 80%; height: 2px;
  background: rgba(80,70,60,0.08);
  border-radius: 50%;
  filter: blur(1px);
  transform: rotate(4deg);
}

/* ===== Note list (笔记本内部) ===== */
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
.note-error {
  padding: 16px; text-align: center;
  color: var(--lt-danger); font-size: 13px;
}
.note-list { flex: 1; overflow-y: auto; padding: 8px 0; }

/* 资源级分组头（一级） */
.note-resource-header {
  display: flex; align-items: center; gap: 6px;
  padding: 11px 12px 9px; cursor: pointer;
  font-size: 15px; color: var(--lt-text-primary); font-weight: 700;
  transition: background 0.15s;
  position: sticky; top: 0; z-index: 2;
  background: var(--lt-bg-card);
  border-bottom: 1px solid var(--lt-border);
}
.note-resource-header:hover { background: var(--lt-bg-page); }
.note-resource-title {
  flex: 1;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.note-resource-body { padding: 6px 0 10px; }
.note-resource-body--flat { padding: 0; }

/* 章节级分组头（二级），默认缩进体现层级 */
.note-group-header {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 16px 8px 24px; cursor: pointer;
  font-size: 14px; color: var(--lt-text-secondary); font-weight: 600;
  transition: background 0.15s;
}
.note-resource-body--flat .note-group-header { padding-left: 16px; }
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
.note-sidebar-input { flex-shrink: 0; border-top: 1px solid var(--lt-border); }
.note-sidebar-editor { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.note-new-btn {
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 14px;
  border-top: 1px solid var(--lt-border);
  cursor: pointer;
  color: var(--lt-text-secondary);
  font-size: 14px; font-weight: 500;
  transition: background 0.15s, color 0.15s;
}
.note-new-btn:hover {
  background: var(--lt-bg-page);
  color: var(--lt-brand);
}

/* Resize handles */
.note-sidebar-resizer-w {
  position: absolute; left: -2px; top: 0; bottom: 0;
  width: 6px; cursor: col-resize; z-index: 101;
}
.note-sidebar-resizer-h {
  flex-shrink: 0;
  height: 6px; cursor: row-resize;
}

/* Original text highlight pulse */
:global(.note-original-highlight) {
  animation: note-highlight-pulse 2s ease-out;
}
@keyframes note-highlight-pulse {
  0% { background-color: rgba(255, 140, 66, 0.3); }
  100% { background-color: transparent; }
}

.note-slide-enter-active, .note-slide-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.note-slide-enter-from, .note-slide-leave-to {
  opacity: 0; transform: translateX(20px);
}

.note-list-enter-active, .note-list-leave-active {
  transition: all 0.2s ease;
}
.note-list-enter-from { opacity: 0; transform: translateY(-8px); }
.note-list-leave-to { opacity: 0; transform: translateX(20px); }

/* ===== Create dialog ===== */
.create-form { display: flex; flex-direction: column; gap: 16px; }
.create-field { display: flex; flex-direction: column; gap: 6px; }
.create-label { font-size: 13px; font-weight: 600; color: var(--lt-text-primary); }
.create-required { color: var(--lt-danger); }
.cover-picker {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.cover-option {
  height: 48px;
  border-radius: 6px;
  cursor: pointer;
  display: flex; align-items: flex-end; justify-content: center;
  padding-bottom: 4px;
  border: 2px solid transparent;
  transition: border-color 0.15s, transform 0.1s;
}
.cover-option:hover { transform: scale(1.05); }
.cover-option.selected { border-color: var(--lt-brand); box-shadow: 0 0 0 1px var(--lt-brand); }
.cover-option-label {
  font-size: 10px; color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.4); font-weight: 500;
}

@media (max-width: 767px) {
  .note-sidebar { display: none; }
}
</style>
