<script setup lang="ts">
/**
 * L3 风格层卡片：决定"怎么呈现"
 *  - 认知偏好
 *  - 学习节奏（含每日分钟数 + 紧迫度）
 *  - 资源偏好（media_preference）
 *  - 排斥项（带删除线标签）
 */
import { computed, ref } from 'vue'
import { useProfileStore } from '@/stores/profile'
import { Edit } from '@element-plus/icons-vue'
import { MEDIA_PREFERENCE_LABEL, URGENCY_LABEL, DENSITY_LABEL } from '@/constants/profile'
import ConfidenceBadge from './ConfidenceBadge.vue'
import SourceMark from './SourceMark.vue'
import SourceTooltip from './SourceTooltip.vue'
import CorrectDialog from './CorrectDialog.vue'
import type { ProfileDimensionKey } from '@/types'

const profile = useProfileStore()

const style = computed(() => profile.cognitiveStyle)
const pace = computed(() => profile.learningPace)

const styleDim = computed(() => profile.dim('cognitive_style'))
const paceDim = computed(() => profile.dim('learning_pace'))

const mediaText = computed(() => MEDIA_PREFERENCE_LABEL[style.value.media_preference] ?? '')
const densityText = computed(() => style.value.example_density ? DENSITY_LABEL[style.value.example_density] : '')
const urgencyText = computed(() => pace.value.urgency ? URGENCY_LABEL[pace.value.urgency] : '')

/** pace 进度条目标默认 100 分钟（与设计稿一致） */
const PACE_TARGET = 100
const pacePercent = computed(() => {
  if (!pace.value.daily_minutes) return 0
  return Math.min(100, Math.round((pace.value.daily_minutes / PACE_TARGET) * 100))
})

const avoidTags = computed<string[]>(() => {
  const a = style.value.avoid
  if (!a) return []
  return a
    .split(/[、，,;；\n]/)
    .map(s => s.trim())
    .filter(Boolean)
})

const isEmpty = computed(() =>
  !styleDim.value && !paceDim.value && !style.value.style.length && !style.value.avoid && !pace.value.daily_minutes && !pace.value.pace_text
)

// ===== 纠错对话框上下文 =====
const correctVisible = ref(false)
const correctCtx = ref<{
  dimension: ProfileDimensionKey
  label: string
  originalValue?: string
}>({ dimension: 'cognitive_style', label: '' })

function openCorrect(dimension: ProfileDimensionKey, label: string, originalValue?: string) {
  correctCtx.value = { dimension, label, originalValue }
  correctVisible.value = true
}

function handleCorrected() {
  profile.refreshProfile()
}
</script>

<template>
  <div v-if="!isEmpty" class="style-card">
    <div class="style-head">
      <h3 class="style-title">风格 · 决定怎么呈现</h3>
    </div>

    <!-- 认知偏好 -->
    <div v-if="styleDim || style.style.length" class="style-row">
      <div class="row-label">
        <span>认知偏好</span>
        <SourceMark v-if="styleDim" :source="styleDim.source" />
        <ConfidenceBadge v-if="styleDim" :confidence="styleDim.confidence" :source="styleDim.source" />
        <SourceTooltip dimension="cognitive_style" />
        <button class="row-correct-btn" @click="openCorrect('cognitive_style', '认知风格', style.style.join('、'))">
          <el-icon :size="11"><Edit /></el-icon>
        </button>
      </div>
      <div class="tag-cloud">
        <el-tag
          v-for="t in style.style"
          :key="t"
          size="small"
          type="warning"
          effect="plain"
        >{{ t }}</el-tag>
        <span v-if="!style.style.length" class="row-empty">对话中建立...</span>
      </div>
      <p v-if="mediaText || densityText" class="row-meta-line">
        资源偏好：
        <span v-if="mediaText">{{ mediaText }}</span>
        <span v-if="mediaText && densityText"> · </span>
        <span v-if="densityText">{{ densityText }}</span>
      </p>
    </div>

    <!-- 学习节奏 -->
    <div v-if="paceDim || pace.daily_minutes || pace.pace_text" class="style-row">
      <div class="row-label">
        <span>学习节奏</span>
        <SourceMark v-if="paceDim" :source="paceDim.source" />
        <ConfidenceBadge v-if="paceDim" :confidence="paceDim.confidence" :source="paceDim.source" />
        <SourceTooltip dimension="learning_pace" />
        <button class="row-correct-btn" @click="openCorrect('learning_pace', '学习节奏', pace.daily_minutes ? pace.daily_minutes + ' 分钟/天' : pace.pace_text)">
          <el-icon :size="11"><Edit /></el-icon>
        </button>
      </div>
      <p class="row-text">
        <template v-if="pace.daily_minutes">
          {{ pace.daily_minutes }} 分钟/天
          <span v-if="urgencyText" class="row-meta">· {{ urgencyText }}</span>
        </template>
        <template v-else-if="pace.pace_text">
          {{ pace.pace_text }}
        </template>
        <template v-else>未设置</template>
      </p>
      <el-progress
        v-if="pace.daily_minutes"
        :percentage="pacePercent"
        :stroke-width="5"
        :show-text="false"
        color="var(--lt-orange)"
        class="pace-progress"
      />
    </div>

    <!-- 排斥项 -->
    <div v-if="avoidTags.length" class="style-row">
      <div class="row-label">
        <span>排斥项</span>
        <SourceTooltip dimension="cognitive_style" />
        <button class="row-correct-btn" @click="openCorrect('cognitive_style', '排斥项', avoidTags.join('、'))">
          <el-icon :size="11"><Edit /></el-icon>
        </button>
      </div>
      <div class="tag-cloud">
        <span v-for="t in avoidTags" :key="t" class="avoid-tag">✗ {{ t }}</span>
      </div>
    </div>
  </div>

  <CorrectDialog
    v-model="correctVisible"
    :dimension="correctCtx.dimension"
    :dimension-label="correctCtx.label"
    :original-value="correctCtx.originalValue"
    @corrected="handleCorrected"
  />
</template>

<style scoped>
.style-card {
  background: linear-gradient(135deg, rgba(255,140,66,0.04), var(--lt-orange-light-9, rgba(255,140,66,0.06)));
  border: 1px solid var(--lt-orange-light-5, rgba(255,140,66,0.25));
  border-radius: 12px;
  padding: 14px;
}
.style-head {
  margin-bottom: 10px;
}
.style-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--lt-orange);
  margin: 0;
}
.style-row {
  margin-bottom: 12px;
}
.style-row:last-child {
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
.row-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--lt-text-primary);
  margin: 4px 0 0;
}
.row-meta {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
}
.row-meta-line {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  margin: 6px 0 0;
}
.row-empty {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
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
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.pace-progress {
  margin-top: 6px;
}
.avoid-tag {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 8px;
  background: rgba(255,59,48,0.06);
  color: var(--lt-danger);
  text-decoration: line-through;
  text-decoration-thickness: 1px;
  text-decoration-color: rgba(255,59,48,0.5);
  line-height: 1.6;
}
</style>
