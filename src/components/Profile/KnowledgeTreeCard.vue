<script setup lang="ts">
/**
 * L4 知识层：科目→知识点 树形展示
 *  - 主数据：knowledgeTree（前端解析 knowledge_profile_md，含 mastery 判定）
 *  - 降级：MD 为空时使用 display_profile.knowledge.mastered/weak 渲染扁平双列标签
 */
import { computed, ref } from 'vue'
import { useProfileStore } from '@/stores/profile'
import { ArrowRight, Edit } from '@element-plus/icons-vue'
import SourceTooltip from './SourceTooltip.vue'
import CorrectDialog from './CorrectDialog.vue'

const profile = useProfileStore()

const tree = computed(() => profile.knowledgeTree)
const knowledgeTags = computed(() => profile.knowledgeTags)
const errorTags = computed(() => profile.errorTags)

/** 哪些科目展开（默认全部展开桌面端、移动端折叠） */
const expanded = ref<Record<string, boolean>>({})

function toggle(subject: string) {
  expanded.value[subject] = !expanded.value[subject]
}

/** 默认展开第一个科目（移动端友好） */
const initialExpanded = computed(() => {
  if (tree.value.length === 0) return {}
  const map: Record<string, boolean> = {}
  for (const node of tree.value) map[node.subject] = true
  return map
})

function isExpanded(subject: string) {
  return expanded.value[subject] ?? initialExpanded.value[subject] ?? false
}

const fallbackVisible = computed(() => tree.value.length === 0 && (knowledgeTags.value.mastered.length > 0 || knowledgeTags.value.weak.length > 0))

const isEmpty = computed(() =>
  tree.value.length === 0 && knowledgeTags.value.mastered.length === 0 && knowledgeTags.value.weak.length === 0
)

function masteryLabel(m: 'mastered' | 'weak' | 'unknown') {
  return m === 'mastered' ? '已掌握' : m === 'weak' ? '薄弱' : '未知'
}
function masteryIcon(m: 'mastered' | 'weak' | 'unknown') {
  return m === 'mastered' ? '✅' : m === 'weak' ? '❌' : '·'
}

// ===== 纠错对话框（针对整个 knowledge_basis 维度） =====
const correctVisible = ref(false)
function openCorrect() {
  correctVisible.value = true
}
function handleCorrected() {
  profile.refreshProfile()
}
</script>

<template>
  <div v-if="!isEmpty" class="kt-card">
    <div class="kt-head">
      <h3 class="kt-title">知识掌握详情</h3>
      <SourceTooltip dimension="knowledge_basis" />
      <button class="kt-correct-btn" @click="openCorrect">
        <el-icon :size="11"><Edit /></el-icon>
        纠正
      </button>
    </div>

    <!-- 树形展示 -->
    <div v-if="tree.length" class="kt-tree">
      <div v-for="subject in tree" :key="subject.subject" class="kt-subject">
        <button
          class="kt-subject-head"
          :aria-expanded="isExpanded(subject.subject)"
          @click="toggle(subject.subject)"
        >
          <el-icon
            :size="14"
            class="kt-arrow"
            :class="{ 'kt-arrow-open': isExpanded(subject.subject) }"
          >
            <ArrowRight />
          </el-icon>
          <span class="kt-subject-name">📘 {{ subject.subject }}</span>
          <span class="kt-subject-count">{{ subject.topics.length }}</span>
        </button>

        <p v-if="subject.overall && isExpanded(subject.subject)" class="kt-overall">
          整体：{{ subject.overall }}
        </p>

        <ul v-if="isExpanded(subject.subject) && subject.topics.length" class="kt-topics">
          <li
            v-for="topic in subject.topics"
            :key="topic.key || topic.name"
            class="kt-topic"
            :class="[
              `kt-topic-${topic.mastery}`,
              { 'kt-topic-low-conf': topic.masteryConfidence === 'low' },
            ]"
          >
            <div class="kt-topic-head">
              <span class="kt-topic-icon">{{ masteryIcon(topic.mastery) }}</span>
              <span class="kt-topic-name">{{ topic.name }}</span>
              <span
                class="kt-topic-status"
                :class="`kt-status-${topic.mastery}`"
              >{{ masteryLabel(topic.mastery) }}</span>
              <el-tooltip
                v-if="topic.masteryConfidence === 'low'"
                content="掌握状态来自描述关键词推断，仅供参考"
                placement="top"
              >
                <span class="kt-low-conf-icon">⚠️</span>
              </el-tooltip>
            </div>
            <p v-if="topic.description" class="kt-topic-desc">{{ topic.description }}</p>
          </li>
          <li v-if="!subject.topics.length" class="kt-empty">该科目暂无具体知识点记录</li>
        </ul>
      </div>
    </div>

    <!-- 降级：MD 为空但有 display_json 标签 -->
    <div v-else-if="fallbackVisible" class="kt-fallback">
      <p class="kt-fallback-tip">
        <span class="kt-fallback-dot" />暂无详细知识点记录，仅展示标签
      </p>
      <div v-if="knowledgeTags.weak.length" class="kt-fb-section">
        <p class="kt-fb-label">需加强</p>
        <div class="tag-cloud">
          <el-tag v-for="t in knowledgeTags.weak" :key="t" size="small" type="danger" effect="plain">{{ t }}</el-tag>
        </div>
      </div>
      <div v-if="knowledgeTags.mastered.length" class="kt-fb-section">
        <p class="kt-fb-label">已掌握</p>
        <div class="tag-cloud">
          <el-tag v-for="t in knowledgeTags.mastered" :key="t" size="small" type="success" effect="plain">{{ t }}</el-tag>
        </div>
      </div>
    </div>

    <!-- 常见错因（独立小区块） -->
    <div v-if="errorTags.length" class="kt-errors">
      <p class="kt-fb-label">常见错因</p>
      <div class="tag-cloud">
        <el-tag v-for="t in errorTags" :key="t" size="small" type="danger" effect="light">{{ t }}</el-tag>
      </div>
    </div>
  </div>

  <CorrectDialog
    v-model="correctVisible"
    dimension="knowledge_basis"
    dimension-label="知识基础"
    @corrected="handleCorrected"
  />
</template>

<style scoped>
.kt-card {
  background: linear-gradient(135deg, rgba(124,92,252,0.04), rgba(124,92,252,0.02));
  border: 1px solid var(--lt-ai-light-7, rgba(124,92,252,0.2));
  border-radius: 12px;
  padding: 14px;
}
.kt-head {
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.kt-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--lt-ai);
  margin: 0;
  flex: 1;
}
.kt-correct-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border: 1px solid var(--lt-border);
  background: var(--lt-bg-card);
  color: var(--lt-text-auxiliary);
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.15s;
}
.kt-correct-btn:hover {
  color: var(--lt-warning);
  border-color: var(--lt-warning);
  background: rgba(255,159,10,0.06);
}

.kt-tree { display: flex; flex-direction: column; gap: 8px; }
.kt-subject {
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-radius: 8px;
  padding: 8px 10px;
}
.kt-subject-head {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 13px;
  color: var(--lt-text-primary);
  font-weight: 600;
  text-align: left;
  min-height: 32px;
}
.kt-arrow {
  color: var(--lt-text-auxiliary);
  transition: transform 0.18s ease;
}
.kt-arrow-open {
  transform: rotate(90deg);
}
.kt-subject-name { flex: 1; }
.kt-subject-count {
  font-size: 11px;
  color: var(--lt-text-auxiliary);
  background: var(--lt-bg-page);
  padding: 0 6px;
  border-radius: 8px;
  font-variant-numeric: tabular-nums;
}
.kt-overall {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  margin: 4px 0 4px 20px;
  line-height: 1.5;
}
.kt-topics {
  list-style: none;
  padding: 0;
  margin: 4px 0 0 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.kt-topic {
  border-left: 2px solid var(--lt-border);
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--lt-bg-page);
}
.kt-topic-mastered { border-left-color: var(--lt-success); }
.kt-topic-weak { border-left-color: var(--lt-danger); }
.kt-topic-unknown { border-left-color: var(--lt-text-placeholder); }
.kt-topic-low-conf {
  opacity: 0.85;
}
.kt-topic-head {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--lt-text-primary);
}
.kt-topic-icon { width: 16px; flex-shrink: 0; }
.kt-topic-name { font-weight: 600; flex: 1; }
.kt-topic-status {
  font-size: 11px;
  padding: 0 5px;
  border-radius: 6px;
  flex-shrink: 0;
}
.kt-status-mastered { background: rgba(34,197,94,0.1); color: var(--lt-success); }
.kt-status-weak { background: rgba(255,59,48,0.08); color: var(--lt-danger); }
.kt-status-unknown { background: var(--lt-bg-page); color: var(--lt-text-auxiliary); }
.kt-low-conf-icon {
  font-size: 10px;
  cursor: help;
}
.kt-topic-desc {
  font-size: 11.5px;
  color: var(--lt-text-secondary);
  margin: 3px 0 0 20px;
  line-height: 1.5;
}
.kt-empty {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  list-style: none;
}

.kt-fallback {
  background: var(--lt-bg-card);
  border: 1px dashed var(--lt-border);
  border-radius: 8px;
  padding: 10px;
}
.kt-fallback-tip {
  font-size: 11px;
  color: var(--lt-text-auxiliary);
  margin: 0 0 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.kt-fallback-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--lt-warning);
}
.kt-fb-section { margin-bottom: 8px; }
.kt-fb-section:last-child { margin-bottom: 0; }
.kt-fb-label {
  font-size: 11px;
  color: var(--lt-text-auxiliary);
  margin: 0 0 4px;
  font-weight: 500;
}
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.kt-errors {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--lt-border);
}
</style>
