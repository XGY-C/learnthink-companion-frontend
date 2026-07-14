<script setup lang="ts">
/**
 * L2 核心层卡片：决定"学什么"
 *  - 专业 / 年级 / 课程
 *  - 知识基础（已掌握 / 待加强 标签 + 进度条）
 *  - 学习目标（主目标 + 子目标标签）
 *  - 兴趣方向
 *
 * 数据均通过 store 统一 getter 读取（§2.3）。
 */
import { computed, ref } from 'vue'
import { useProfileStore } from '@/stores/profile'
import { Edit } from '@element-plus/icons-vue'
import ConfidenceBadge from './ConfidenceBadge.vue'
import SourceMark from './SourceMark.vue'
import SourceTooltip from './SourceTooltip.vue'
import CorrectDialog from './CorrectDialog.vue'
import type { ProfileDimensionKey } from '@/types'

const profile = useProfileStore()

const major = computed(() => profile.majorContext)
const tags = computed(() => profile.knowledgeTags)
const goal = computed(() => profile.learningGoal)
const interests = computed(() => profile.interestTopics)

const masteredList = computed(() => {
  // strong（学科级）+ mastered（知识点级）合并去重
  const merged = [...new Set([...tags.value.strong, ...tags.value.mastered])]
  return merged
})

const kbPercent = computed(() => {
  const total = masteredList.value.length + tags.value.weak.length
  if (total === 0) return 0
  return Math.round((masteredList.value.length / total) * 100)
})

const kbDim = computed(() => profile.dim('knowledge_basis'))
const goalDim = computed(() => profile.dim('learning_goal'))
const majorDim = computed(() => profile.dim('major_context'))
const interestDim = computed(() => profile.dim('interest_direction'))

const majorText = computed(() => {
  const UNKNOWN = new Set(['', '未知', 'unknown', 'null', '无'])
  const parts = [major.value.major, major.value.course].filter(
    v => typeof v === 'string' && !UNKNOWN.has(v.trim())
  )
  return parts.join(' · ') || '未设置'
})

const isEmpty = computed(() =>
  !majorDim.value && !kbDim.value && !goalDim.value && !interestDim.value
)

// ===== 纠错对话框上下文 =====
const correctVisible = ref(false)
const correctCtx = ref<{
  dimension: ProfileDimensionKey
  label: string
  originalValue?: string
}>({ dimension: 'knowledge_basis', label: '' })

function openCorrect(dimension: ProfileDimensionKey, label: string, originalValue?: string) {
  correctCtx.value = { dimension, label, originalValue }
  correctVisible.value = true
}

function handleCorrected() {
  // mock 阶段：仅触发一次画像刷新（清缓存让组件重新读取）
  profile.refreshProfile()
}
</script>

<template>
  <div v-if="!isEmpty" class="core-card">
    <div class="core-head">
      <h3 class="core-title">核心 · 决定学什么</h3>
    </div>

    <!-- 专业 / 年级 / 课程 -->
    <div v-if="majorDim" class="core-row">
      <div class="row-label">
        <span>专业</span>
        <SourceMark :source="majorDim.source" />
        <ConfidenceBadge v-if="majorDim" :confidence="majorDim.confidence" :source="majorDim.source" />
        <SourceTooltip dimension="major_context" />
        <button class="row-correct-btn" @click="openCorrect('major_context', '专业背景', majorText)">
          <el-icon :size="11"><Edit /></el-icon>
        </button>
      </div>
      <p class="row-text">
        {{ majorText }}
        <span v-if="major.grade" class="row-meta">{{ major.grade }}</span>
      </p>
    </div>

    <!-- 知识基础 -->
    <div v-if="kbDim || tags.mastered.length || tags.weak.length" class="core-row">
      <div class="row-label">
        <span>知识基础</span>
        <SourceMark v-if="kbDim" :source="kbDim.source" />
        <ConfidenceBadge v-if="kbDim" :confidence="kbDim.confidence" :source="kbDim.source" />
        <SourceTooltip dimension="knowledge_basis" />
        <button class="row-correct-btn" @click="openCorrect('knowledge_basis', '知识基础')">
          <el-icon :size="11"><Edit /></el-icon>
        </button>
        <span class="row-percent">{{ kbPercent }}%</span>
      </div>
      <el-progress
        :percentage="kbPercent"
        :stroke-width="6"
        :show-text="false"
        color="var(--lt-brand)"
      />
      <div class="tag-cloud">
        <el-tag
          v-for="t in tags.weak"
          :key="'w-' + t"
          size="small"
          type="danger"
          effect="plain"
        >{{ t }}</el-tag>
        <el-tag
          v-for="t in masteredList"
          :key="'m-' + t"
          size="small"
          type="success"
          effect="plain"
        >{{ t }}</el-tag>
        <span v-if="tags.weak.length === 0 && masteredList.length === 0" class="row-empty">
          对话中建立...
        </span>
      </div>
    </div>

    <!-- 学习目标 -->
    <div v-if="goalDim || goal.primary" class="core-row">
      <div class="row-label">
        <span>学习目标</span>
        <SourceMark v-if="goalDim" :source="goalDim.source" />
        <ConfidenceBadge v-if="goalDim" :confidence="goalDim.confidence" :source="goalDim.source" />
        <SourceTooltip dimension="learning_goal" />
        <button class="row-correct-btn" @click="openCorrect('learning_goal', '学习目标', goal.primary)">
          <el-icon :size="11"><Edit /></el-icon>
        </button>
      </div>
      <p class="row-text">{{ goal.primary || '未设置' }}</p>
      <div v-if="goal.sub_goals.length" class="sub-goal-cloud">
        <span v-for="(s, i) in goal.sub_goals" :key="i" class="sub-goal-pill">{{ s }}</span>
      </div>
    </div>

    <!-- 兴趣方向 -->
    <div v-if="interestDim || interests.length" class="core-row">
      <div class="row-label">
        <span>兴趣方向</span>
        <SourceMark v-if="interestDim" :source="interestDim.source" />
        <ConfidenceBadge v-if="interestDim" :confidence="interestDim.confidence" :source="interestDim.source" />
        <SourceTooltip dimension="interest_direction" />
        <button class="row-correct-btn" @click="openCorrect('interest_direction', '兴趣方向', interests.join('、'))">
          <el-icon :size="11"><Edit /></el-icon>
        </button>
      </div>
      <div class="tag-cloud">
        <el-tag
          v-for="t in interests"
          :key="t"
          size="small"
          type="primary"
          effect="plain"
        >{{ t }}</el-tag>
        <span v-if="interests.length === 0" class="row-empty">对话中建立...</span>
      </div>
    </div>
  </div>

  <!-- 纠错对话框（每个卡片一个） -->
  <CorrectDialog
    v-model="correctVisible"
    :dimension="correctCtx.dimension"
    :dimension-label="correctCtx.label"
    :original-value="correctCtx.originalValue"
    @corrected="handleCorrected"
  />
</template>

<style scoped>
.core-card {
  background: linear-gradient(135deg, rgba(43,111,255,0.04), var(--lt-brand-lightest));
  border: 1px solid var(--lt-brand-light-7, rgba(43,111,255,0.15));
  border-radius: 12px;
  padding: 14px;
}
.core-head {
  margin-bottom: 10px;
}
.core-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--lt-brand);
  margin: 0;
}
.core-row {
  margin-bottom: 12px;
}
.core-row:last-child {
  margin-bottom: 0;
}
.row-label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--lt-text-secondary);
  font-weight: 500;
}
.row-percent {
  margin-left: auto;
  font-size: 12px;
  font-weight: 700;
  color: var(--lt-brand);
  font-variant-numeric: tabular-nums;
}
.row-correct-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 1px solid var(--lt-border);
  background: var(--lt-bg-card);
  color: var(--lt-text-auxiliary);
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
  margin-left: 2px;
  transition: all 0.15s;
}
.row-correct-btn:hover {
  color: var(--lt-warning);
  border-color: var(--lt-warning);
  background: rgba(255,159,10,0.06);
}
.row-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--lt-text-primary);
  margin: 4px 0 0;
  line-height: 1.5;
}
.row-meta {
  font-size: 11px;
  color: var(--lt-text-auxiliary);
  margin-left: 6px;
}
.row-empty {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
}
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.sub-goal-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.sub-goal-pill {
  font-size: 11px;
  padding: 1px 7px;
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
  border-radius: 8px;
  line-height: 1.6;
}
</style>
