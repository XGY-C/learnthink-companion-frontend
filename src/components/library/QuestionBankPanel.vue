<template>
  <div class="qb-panel h-full flex-1 flex overflow-hidden">
    <!-- Sidebar: 错题本 + 知识点正确率 -->
    <div class="qb-sidebar">
      <div class="qb-sidebar__section">
        <div class="qb-sidebar__title">错题本</div>
        <div class="qb-sidebar__stat" @click="$emit('show-wrong')">
          <span class="qb-sidebar__stat-value">{{ wrongCount }}</span>
          <span class="qb-sidebar__stat-label">道待复习</span>
        </div>
      </div>

      <div class="qb-sidebar__divider" />

      <div class="qb-sidebar__section">
        <div class="qb-sidebar__title">知识点正确率</div>
        <div v-if="kpAccuracy.length === 0" class="qb-sidebar__empty">暂无数据</div>
        <div v-for="kp in kpAccuracy" :key="kp.kpId" class="qb-sidebar__kp-row" @click="$emit('filter-kp', kp.kpId)">
          <span class="qb-sidebar__kp-name">{{ kp.kpName || kp.kpId.slice(0, 8) }}</span>
            <span class="qb-sidebar__kp-rate" :class="kp.totalAttempts > 0 ? rateClass(kp.accuracyRate) : ''">{{ kp.totalAttempts > 0 ? (kp.accuracyRate * 100).toFixed(0) + '%' : '-' }}</span>
        </div>
      </div>

      <div class="qb-sidebar__action">
        <el-button
          type="primary"
          round
          size="small"
          class="w-full"
          @click="onStartPracticeClick"
        >
          {{ hasSelection ? `开始练习（${selectedIds.size} 题）` : '开始练习' }}
        </el-button>
        <el-button
          v-if="hasSelection"
          text
          size="small"
          class="w-full mt-2"
          @click="clearSelection"
        >
          清空选择
        </el-button>
      </div>
    </div>

    <!-- Main: 题目列表 -->
    <div class="qb-main flex-1 flex flex-col overflow-hidden">
      <!-- Toolbar -->
      <div class="qb-toolbar">
        <div class="qb-toolbar__select">
          <el-checkbox
            :model-value="questions.length > 0 && selectedIds.size === questions.length"
            :indeterminate="selectedIds.size > 0 && selectedIds.size < questions.length"
            @change="toggleSelectAll"
          >
            全选
          </el-checkbox>
          <span v-if="hasSelection" class="qb-toolbar__selected-count">
            已选 {{ selectedIds.size }} 题
          </span>
        </div>
        <div class="qb-toolbar__filters">
          <el-select v-model="typeFilter" placeholder="全部题型" clearable size="small" class="w-28" @change="onFilterChange">
            <el-option v-for="(label, key) in QUESTION_TYPE_LABEL" :key="key" :label="label" :value="key" />
          </el-select>
          <el-select v-model="difficultyFilter" placeholder="全部难度" clearable size="small" class="w-28" @change="onFilterChange">
            <el-option label="★☆☆☆☆" :value="1" />
            <el-option label="★★☆☆☆" :value="2" />
            <el-option label="★★★☆☆" :value="3" />
            <el-option label="★★★★☆" :value="4" />
            <el-option label="★★★★★" :value="5" />
          </el-select>
          <el-select v-model="sortOrder" size="small" class="w-28" @change="onFilterChange">
            <el-option label="最新优先" value="newest" />
            <el-option label="难度优先" value="difficulty" />
            <el-option label="正确率升序" value="accuracy" />
          </el-select>
        </div>
      </div>

      <!-- List -->
      <div class="flex-1 overflow-y-auto p-5">
        <div v-if="loading" class="qb-loading">
          <div v-for="n in 4" :key="n" class="qb-skeleton" />
        </div>

        <div v-else-if="questions.length === 0" class="qb-empty">
          <el-icon :size="48" style="color: var(--lt-text-placeholder);"><EditPen /></el-icon>
          <p class="mt-3 text-sm" style="color: var(--lt-text-secondary);">暂无题目</p>
          <p class="text-xs mt-1" style="color: var(--lt-text-placeholder);">AI 生成练习题时会自动录入题库</p>
        </div>

        <div v-else class="qb-list">
          <div
            v-for="q in questions"
            :key="q.id"
            class="qb-card"
            :class="{ 'qb-card--selected': selectedIds.has(q.id) }"
            @click="$emit('select', q.id)"
          >
            <el-checkbox
              :model-value="selectedIds.has(q.id)"
              class="qb-card__checkbox"
              @click.stop
              @change="toggleSelect(q.id)"
            />
            <div class="qb-card__left">
              <span class="qb-type-tag" :class="`qb-type-tag--${q.questionType}`">
                {{ QUESTION_TYPE_LABEL[q.questionType] || q.questionType }}
              </span>
              <span class="qb-difficulty">
                {{ '★'.repeat(q.difficulty) }}{{ '☆'.repeat(5 - q.difficulty) }}
              </span>
            </div>
            <div class="qb-card__body">
              <div class="qb-card__title">{{ q.title }}</div>
              <div class="qb-card__meta">
                <span v-if="q.kpName" class="qb-card__kp">{{ q.kpName }}</span>
                <span class="qb-card__stat">
                  正确率 <span :class="rateClass(q.accuracyRate)">{{ (q.accuracyRate * 100).toFixed(0) }}%</span>
                  · {{ q.attemptCount }} 次作答
                </span>
              </div>
            </div>
            <div class="qb-card__actions">
              <el-button text size="small" :icon="Delete" @click.stop="onDelete(q.id)" />
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="total > size" class="qb-pagination">
          <el-pagination
            v-model:current-page="currentPage"
            :page-size="size"
            :total="total"
            layout="prev, pager, next"
            small
            background
            @current-change="onPageChange"
          />
        </div>
      </div>
    </div>

    <!-- Detail Drawer -->
    <el-drawer
      v-model="detailVisible"
      :title="detailTitle"
      size="560px"
      append-to-body
      @closed="$emit('close-detail')"
    >
      <template v-if="detailLoading">
        <div class="qb-detail-skeleton">
          <div class="qb-skel-line w-48" />
          <div class="qb-skel-line w-full" />
          <div class="qb-skel-line w-full" />
          <div class="qb-skel-line w-3/4" />
        </div>
      </template>
      <template v-else-if="detail">
        <div class="qb-detail">
          <div class="qb-detail__header">
            <span class="qb-type-tag" :class="`qb-type-tag--${detail.questionType}`">
              {{ QUESTION_TYPE_LABEL[detail.questionType] || detail.questionType }}
            </span>
            <span class="qb-detail__difficulty">
              {{ '★'.repeat(detail.difficulty) }}{{ '☆'.repeat(5 - detail.difficulty) }}
            </span>
            <span class="qb-detail__accuracy">
              正确率 {{ (detail.accuracyRate * 100).toFixed(0) }}%
            </span>
          </div>

          <div class="qb-detail__section">
            <div class="qb-detail__section-title">题干</div>
            <div class="qb-detail__content">{{ detail.title }}</div>
          </div>

          <div v-if="detail.options && detail.options.length" class="qb-detail__section">
            <div class="qb-detail__section-title">选项</div>
            <div class="qb-detail__options">
              <div v-for="opt in detail.options" :key="opt.label" class="qb-option-item">
                <span class="qb-option-label">{{ opt.label }}</span>
                <span class="qb-option-text">{{ opt.content }}</span>
              </div>
            </div>
          </div>

          <div class="qb-detail__section">
            <div class="qb-detail__section-title">答案</div>
            <div class="qb-detail__answer">
              {{ formatAnswer(detail) }}
            </div>
          </div>

          <div v-if="detail.explanation" class="qb-detail__section">
            <div class="qb-detail__section-title">解析</div>
            <div class="qb-detail__explanation">{{ detail.explanation }}</div>
          </div>

          <div class="qb-detail__meta">
            <span v-if="detail.kpName" class="qb-detail__kp">知识点：{{ detail.kpName }}</span>
            <span>总作答 {{ detail.attemptCount }} 次 · 正确 {{ detail.correctCount }} 次</span>
          </div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, EditPen } from '@element-plus/icons-vue'
import type { QBankQuestion, KpAccuracy } from '@/types'
import { apiFetch } from '@/utils/api'

const props = defineProps<{
  questions: QBankQuestion[]
  total: number
  loading: boolean
  kpAccuracy: KpAccuracy[]
  wrongCount: number
}>()

const emit = defineEmits<{
  (e: 'filter', filters: { questionType?: string; difficulty?: number; sort?: string; page?: number }): void
  (e: 'select', id: string): void
  (e: 'delete', id: string): void
  (e: 'show-wrong'): void
  (e: 'filter-kp', kpId: string): void
  (e: 'close-detail'): void
  (e: 'start-practice', questionIds?: string[]): void
}>()

const QUESTION_TYPE_LABEL: Record<string, string> = {
  single_choice: '单选',
  multiple_choice: '多选',
  true_false: '判断',
  fill_blank: '填空',
  short_answer: '简答',
  code: '编程',
}

// Filters
const typeFilter = ref('')
const difficultyFilter = ref<number | undefined>(undefined)
const sortOrder = ref('newest')
const currentPage = ref(1)
const size = 50

// Selection
const selectedIds = ref<Set<string>>(new Set())
const hasSelection = computed(() => selectedIds.value.size > 0)

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function toggleSelectAll() {
  if (selectedIds.value.size === props.questions.length) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(props.questions.map(q => q.id))
  }
}

function clearSelection() {
  selectedIds.value = new Set()
}

function onStartPracticeClick() {
  if (hasSelection.value) {
    emit('start-practice', Array.from(selectedIds.value))
  } else {
    emit('start-practice')
  }
}

// 题目列表变化时清空选中（筛选/翻页/刷新）
watch(() => props.questions, () => {
  selectedIds.value = new Set()
})

function onFilterChange() {
  currentPage.value = 1
  emit('filter', {
    questionType: typeFilter.value || undefined,
    difficulty: difficultyFilter.value,
    sort: sortOrder.value !== 'newest' ? sortOrder.value : undefined,
    page: currentPage.value,
  })
}

function onPageChange(page: number) {
  currentPage.value = page
  emit('filter', {
    questionType: typeFilter.value || undefined,
    difficulty: difficultyFilter.value,
    sort: sortOrder.value !== 'newest' ? sortOrder.value : undefined,
    page,
  })
}

// Delete
async function onDelete(id: string) {
  try {
    await ElMessageBox.confirm('确定删除该题目？', '删除题目', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    emit('delete', id)
  } catch { /* cancelled */ }
}

// Detail drawer
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<QBankQuestion | null>(null)
const detailTitle = computed(() => detail.value?.title?.slice(0, 50) || '题目详情')

watch(detailVisible, (v) => { if (!v) detail.value = null })

async function openDetail(id: string) {
  detailLoading.value = true
  detailVisible.value = true
  try {
    const res = await apiFetch<QBankQuestion>(`/questions/${id}`)
    if (res.data) detail.value = res.data
  } catch {
    ElMessage.error('加载题目详情失败')
  } finally {
    detailLoading.value = false
  }
}

function formatAnswer(q: QBankQuestion): string {
  if (!q.answer) return '—'
  if (Array.isArray(q.answer)) return q.answer.join(', ')
  return String(q.answer)
}

function rateClass(rate: number): string {
  if (rate >= 0.7) return 'rate-high'
  if (rate >= 0.4) return 'rate-mid'
  return 'rate-low'
}

defineExpose({ openDetail })
</script>

<style scoped>
/* Layout */
.qb-panel { background: var(--lt-bg-page); }

/* Sidebar */
.qb-sidebar {
  width: 200px;
  flex-shrink: 0;
  background: var(--lt-bg-card);
  border-right: 1px solid var(--lt-border);
  display: flex;
  flex-direction: column;
  padding: 16px 0;
}
.qb-sidebar__section { padding: 0 16px; }
.qb-sidebar__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--lt-text-secondary);
  margin-bottom: 8px;
  letter-spacing: 0.03em;
}
.qb-sidebar__stat {
  display: flex;
  align-items: baseline;
  gap: 4px;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: var(--lt-radius-md);
  transition: background 0.15s;
}
.qb-sidebar__stat:hover { background: var(--lt-brand-lightest); }
.qb-sidebar__stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--lt-danger);
  line-height: 1;
}
.qb-sidebar__stat-label { font-size: 12px; color: var(--lt-text-secondary); }
.qb-sidebar__divider {
  height: 1px;
  background: var(--lt-border);
  margin: 16px;
}
.qb-sidebar__empty {
  font-size: 12px;
  color: var(--lt-text-placeholder);
  padding: 8px;
  text-align: center;
}
.qb-sidebar__kp-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 8px;
  font-size: 12px;
  cursor: pointer;
  border-radius: var(--lt-radius-md);
  transition: background 0.15s;
}
.qb-sidebar__kp-row:hover { background: var(--lt-bg-page); }
.qb-sidebar__kp-name {
  color: var(--lt-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  margin-right: 6px;
}
.qb-sidebar__kp-rate { font-weight: 600; font-variant-numeric: tabular-nums; }
.qb-sidebar__action {
  margin-top: auto;
  padding: 16px;
}

/* Main */
.qb-toolbar {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid var(--lt-border);
  background: var(--lt-bg-card);
  flex-shrink: 0;
}
.qb-toolbar__filters { display: flex; gap: 8px; }
.qb-toolbar__select { display: flex; align-items: center; gap: 12px; }
.qb-toolbar__selected-count {
  font-size: 12px;
  color: var(--lt-brand);
  font-weight: 600;
}

/* List */
.qb-loading { display: flex; flex-direction: column; gap: 12px; }
.qb-skeleton {
  height: 64px;
  border-radius: var(--lt-radius-md);
  background: linear-gradient(90deg, var(--lt-border) 25%, #e8ecf0 50%, var(--lt-border) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
}
.qb-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
}
.qb-list { display: flex; flex-direction: column; gap: 8px; }

/* Card */
.qb-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-md);
  cursor: pointer;
  transition: box-shadow 0.15s;
}
.qb-card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  border-color: var(--lt-brand-light);
}
.qb-card--selected {
  background: var(--lt-brand-lightest);
  border-color: var(--lt-brand);
}
.qb-card__checkbox {
  flex-shrink: 0;
  margin-right: 4px;
}
.qb-card__left {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 44px;
  flex-shrink: 0;
}
.qb-type-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  line-height: 1.4;
  white-space: nowrap;
}
.qb-type-tag--single_choice { background: #e8f5e9; color: #2e7d32; }
.qb-type-tag--multiple_choice { background: #e3f2fd; color: #1565c0; }
.qb-type-tag--true_false { background: #fff3e0; color: #e65100; }
.qb-type-tag--fill_blank { background: #f3e5f5; color: #7b1fa2; }
.qb-type-tag--short_answer { background: #fce4ec; color: #c62828; }
.qb-type-tag--code { background: #e8eaf6; color: #283593; }
.qb-difficulty { font-size: 10px; color: #f59e0b; letter-spacing: -1px; }
.qb-card__body { flex: 1; min-width: 0; }
.qb-card__title {
  font-size: 14px;
  font-weight: 500;
  color: var(--lt-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.qb-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 11px;
  color: var(--lt-text-auxiliary);
}
.qb-card__kp {
  background: var(--lt-ai-light-9);
  color: var(--lt-ai);
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}
.qb-card__stat { white-space: nowrap; }
.qb-card__actions { flex-shrink: 0; }

/* Rate colors */
.rate-high { color: var(--lt-success); }
.rate-mid { color: #f59e0b; }
.rate-low { color: var(--lt-danger); }

/* Pagination */
.qb-pagination {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

/* Detail */
.qb-detail { display: flex; flex-direction: column; gap: 20px; }
.qb-detail-skeleton { display: flex; flex-direction: column; gap: 12px; }
.qb-skel-line {
  height: 14px;
  border-radius: 7px;
  background: linear-gradient(90deg, var(--lt-border) 25%, #e8ecf0 50%, var(--lt-border) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
}
.qb-detail__header { display: flex; align-items: center; gap: 10px; }
.qb-detail__difficulty { font-size: 13px; color: #f59e0b; }
.qb-detail__accuracy { font-size: 12px; color: var(--lt-text-secondary); margin-left: auto; }
.qb-detail__section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--lt-text-secondary);
  margin-bottom: 6px;
}
.qb-detail__content {
  font-size: 15px;
  line-height: 1.7;
  color: var(--lt-text-primary);
  white-space: pre-wrap;
}
.qb-detail__options { display: flex; flex-direction: column; gap: 6px; }
.qb-option-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-md);
  font-size: 14px;
}
.qb-option-label {
  font-weight: 700;
  color: var(--lt-text-secondary);
  flex-shrink: 0;
  width: 20px;
}
.qb-option-text { color: var(--lt-text-primary); line-height: 1.6; }
.qb-detail__answer {
  font-size: 14px;
  color: var(--lt-success);
  font-weight: 600;
  padding: 8px 12px;
  background: #f0fdf4;
  border-radius: var(--lt-radius-md);
  border: 1px solid #bbf7d0;
}
.qb-detail__explanation {
  font-size: 14px;
  line-height: 1.7;
  color: var(--lt-text-primary);
  white-space: pre-wrap;
  padding: 12px;
  background: var(--lt-bg-page);
  border-radius: var(--lt-radius-md);
}
.qb-detail__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  padding-top: 12px;
  border-top: 1px solid var(--lt-border);
}
.qb-detail__kp {
  background: var(--lt-ai-light-9);
  color: var(--lt-ai);
  padding: 2px 8px;
  border-radius: 4px;
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
