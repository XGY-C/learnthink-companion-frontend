<script setup lang="ts">
import { reactive, computed, watch } from 'vue'

interface KP { kp_id: string; name: string }
interface Module {
  module_id: string
  title: string
  description: string
  knowledge_points: KP[]
  scope: string
  depth: string
  estimated_hours: number
  prerequisites: string[]
  status?: string
  mastery?: any
  sub_plan_id?: any
}
interface Edge { from: string; to: string; type: string }

const props = defineProps<{
  modules: Module[]
  edges: Edge[]
  loading: boolean
  confirmed?: boolean
  onSave?: (planJson: string) => void
}>()

const emit = defineEmits<{
  confirm: [planJson: string]
  cancel: []
}>()

// 内部可变副本
const internalModules = reactive<Module[]>([])

// 同步 props → internalModules（当异步加载完成时）
watch(() => props.modules, (val) => {
  if (val && val.length > 0 && internalModules.length === 0) {
    const copy = JSON.parse(JSON.stringify(val))
    internalModules.splice(0, internalModules.length, ...copy)
  }
}, { immediate: true, deep: false })

// ── v3.1: 防抖自动保存（500ms）──
let saveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleAutoSave() {
  if (props.confirmed || !props.onSave) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const plan = {
      modules: internalModules.map(m => ({ ...m })),
      edges: buildEdges(),
      summary: {
        total_modules: internalModules.length,
        core_modules: internalModules.filter(m => m.scope === 'core_curriculum').length,
        supplementary_modules: internalModules.filter(m => m.scope === 'supplementary').length,
        total_hours: totalHours.value.toFixed(1),
        completion_estimate: '',
      },
    }
    props.onSave!(JSON.stringify(plan))
  }, 500)
}

// v3.1: 监听编辑变化，触发防抖保存
watch(internalModules, () => { scheduleAutoSave() }, { deep: true })

// 加载态：只有在 loading 且没有数据时才显示 spinner
const isLoading = computed(() => props.loading && internalModules.length === 0)

// Computed summary
const totalHours = computed(() => internalModules.reduce((s, m) => s + (m.estimated_hours || 0), 0))

function genId(): string {
  return 'm' + Date.now() + Math.random().toString(36).slice(2, 6)
}

// ── Module CRUD ──

function addModule() {
  const idx = internalModules.length
  const id = genId()
  internalModules.push({
    module_id: id,
    title: '新模块',
    description: '',
    knowledge_points: [],
    scope: 'core_curriculum',
    depth: 'standard',
    estimated_hours: 1.0,
    prerequisites: idx > 0 ? [internalModules[idx - 1].module_id] : [],
  })
}

function removeModule(idx: number) {
  const id = internalModules[idx].module_id
  internalModules.splice(idx, 1)
  for (const m of internalModules) {
    m.prerequisites = m.prerequisites.filter(p => p !== id)
  }
}

function moveModule(from: number, to: number) {
  if (to < 0 || to >= internalModules.length) return
  const [item] = internalModules.splice(from, 1)
  internalModules.splice(to, 0, item)
}

// ── Confirm ──
function handleConfirm() {
  const plan = {
    modules: internalModules.map(m => ({
      ...m,
      description: m.description.trim(),
      knowledge_points: m.knowledge_points.filter((kp: KP) => kp.name.trim()),
    })),
    edges: buildEdges(),
    summary: {
      total_modules: internalModules.length,
      core_modules: internalModules.filter(m => m.scope === 'core_curriculum').length,
      supplementary_modules: internalModules.filter(m => m.scope === 'supplementary').length,
      total_hours: totalHours.value.toFixed(1),
      completion_estimate: '',
    },
  }
  emit('confirm', JSON.stringify(plan, null, 2))
}

function buildEdges(): Edge[] {
  const edges: Edge[] = []
  for (const m of internalModules) {
    for (const preq of m.prerequisites) {
      edges.push({ from: preq, to: m.module_id, type: 'prerequisite' })
    }
  }
  return edges
}
</script>

<template>
  <div class="plan-editor">
    <!-- 加载态 -->
    <div v-if="isLoading" class="plan-editor-loading">
      <div class="plan-editor-loading-spinner"></div>
      <span>正在拟定学习方案...</span>
    </div>

    <template v-else>
      <!-- 已确认状态提示 -->
      <div v-if="confirmed" class="plan-editor-confirmed-badge">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        方案已确认，正在生成学习活动...
      </div>
      <!-- 模块列表 -->
      <div class="plan-editor-header">
        <span class="plan-editor-title">拟定学习方案</span>
        <span class="plan-editor-subtitle">{{ internalModules.length }} 模块，约 {{ totalHours.toFixed(1) }} 学时</span>
      </div>

      <div class="plan-editor-modules">
        <div v-for="(mod, mi) in internalModules" :key="mod.module_id" class="plan-editor-module-card">
          <!-- 模块头部：拖动 + 标题 + 删除 -->
          <div class="module-card-header">
            <div v-if="!confirmed" class="module-card-drag" @click="moveModule(mi, mi - 1)" title="上移" :class="{ 'is-disabled': mi === 0 }">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
            </div>
            <div v-if="!confirmed" class="module-card-drag" @click="moveModule(mi, mi + 1)" title="下移" :class="{ 'is-disabled': mi === internalModules.length - 1 }">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>

            <input
              v-model="mod.title"
              class="module-card-title-input"
              placeholder="模块标题"
              :disabled="confirmed"
            />

            <button v-if="!confirmed" class="module-card-delete" @click="removeModule(mi)" title="删除模块">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <!-- 描述文本 -->
          <textarea
            v-model="mod.description"
            class="module-card-desc"
            placeholder="模块描述：学习内容、目标、前置要求等"
            rows="3"
            :disabled="confirmed"
          ></textarea>
        </div>
      </div>

      <!-- 添加模块 -->
      <button v-if="!confirmed" class="plan-editor-add-module" @click="addModule">+ 添加模块</button>

      <!-- 操作区 -->
      <div class="plan-editor-actions">
        <button v-if="!confirmed" class="plan-editor-btn plan-editor-btn-primary" @click="handleConfirm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          确认方案，开始生成
        </button>
        <button v-else class="plan-editor-btn plan-editor-btn-primary" disabled style="opacity: 0.6; cursor: not-allowed;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          方案已确认
        </button>
        <button v-if="!confirmed" class="plan-editor-btn plan-editor-btn-ghost" @click="emit('cancel')">继续聊天</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.plan-editor {
  background: #F5F7FA;
  border-radius: 16px;
  padding: 20px;
  margin: 0;
  border-left: 3px solid var(--lt-ai);
}

/* Confirmed badge */
.plan-editor-confirmed-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #34C759;
  background: rgba(52, 199, 89, 0.08);
  border: 1px solid rgba(52, 199, 89, 0.2);
  border-radius: 10px;
  padding: 10px 16px;
  margin-bottom: 16px;
}

/* Loading */
.plan-editor-loading {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--lt-text-auxiliary);
  font-size: 14px;
  padding: 40px 0;
  justify-content: center;
}
.plan-editor-loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--lt-border);
  border-top-color: var(--lt-ai);
  border-radius: 50%;
  animation: plan-spin 0.8s linear infinite;
}
@keyframes plan-spin { to { transform: rotate(360deg); } }

/* Header */
.plan-editor-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 16px;
}
.plan-editor-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--lt-text-primary);
}
.plan-editor-subtitle {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
}

/* Module Card */
.plan-editor-modules {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}
.plan-editor-module-card {
  background: #fff;
  border: 1px solid var(--lt-border);
  border-radius: 12px;
  padding: 12px 14px;
}

/* Header row */
.module-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.module-card-drag {
  cursor: pointer;
  color: var(--lt-text-auxiliary);
  padding: 2px;
  display: flex;
  align-items: center;
  opacity: 0.5;
  transition: opacity 0.15s;
}
.module-card-drag:hover { opacity: 1; }
.module-card-drag.is-disabled { opacity: 0.15; cursor: default; }

.module-card-title-input {
  flex: 1;
  min-width: 120px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  border-bottom: 1px solid transparent;
  outline: none;
  background: transparent;
  color: var(--lt-text-primary);
  padding: 2px 4px;
}
.module-card-title-input:focus {
  border-bottom-color: var(--lt-brand);
}

.module-card-delete {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--lt-text-auxiliary);
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: all 0.15s;
}
.module-card-delete:hover {
  background: rgba(255, 59, 48, 0.08);
  color: #FF3B30;
}

/* Description textarea */
.module-card-desc {
  width: 100%;
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.6;
  padding: 8px 10px;
  border: 1px solid var(--lt-border);
  border-radius: 8px;
  outline: none;
  background: #FAFBFC;
  color: var(--lt-text-primary);
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.module-card-desc:focus {
  border-color: var(--lt-ai);
  background: #fff;
}
.module-card-desc::placeholder {
  color: var(--lt-text-auxiliary);
}

/* Add Module */
.plan-editor-add-module {
  width: 100%;
  font-size: 13px;
  color: var(--lt-text-auxiliary);
  background: none;
  border: 1px dashed var(--lt-border);
  border-radius: 10px;
  padding: 10px;
  cursor: pointer;
  transition: all 0.15s;
  margin-bottom: 16px;
}
.plan-editor-add-module:hover {
  border-color: var(--lt-ai);
  color: var(--lt-ai);
  background: rgba(124, 92, 252, 0.02);
}

/* Actions */
.plan-editor-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}
.plan-editor-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  padding: 10px 20px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}
.plan-editor-btn-primary {
  background: var(--lt-ai);
  color: #fff;
}
.plan-editor-btn-primary:hover {
  background: color-mix(in srgb, var(--lt-ai) 80%, #000);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(124, 92, 252, 0.3);
}
.plan-editor-btn-ghost {
  background: transparent;
  color: var(--lt-text-auxiliary);
  font-weight: 500;
}
.plan-editor-btn-ghost:hover {
  color: var(--lt-text-secondary);
  background: rgba(0, 0, 0, 0.04);
}
</style>
