<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTutoringStore } from '@/stores/tutoring'
import StreamingMarkdown from './StreamingMarkdown.vue'
import DiagramSlot from './DiagramSlot.vue'
import DiagramLightbox from './DiagramLightbox.vue'
import SectionActions from './SectionActions.vue'
import FollowUpInput from './FollowUpInput.vue'
import type { DiagramState } from '@/types/tutoring'
import type { SectionState } from '@/types/tutoring'

const props = defineProps<{
  sectionId: string
  section?: SectionState
  showActions?: boolean
}>()

const emit = defineEmits<{
  action: [sectionId: string, action: string, instruction?: string]
}>()

const store = useTutoringStore()

const section = computed(() => props.section ?? store.sections[props.sectionId])
const showActions = computed(() => props.showActions !== false)
const isExpanded = ref(section.value?.expandDefault ?? false)
const isAutoExpanded = ref(false)
const showFollowUp = ref(false)

// 流式首 chunk 到达时自动展开
watch(
  () => section.value?.status,
  (newStatus) => {
    if (newStatus === 'streaming' && !isExpanded.value && !isAutoExpanded.value) {
      isExpanded.value = true
      isAutoExpanded.value = true
    }
  }
)

const displayContent = computed(() => {
  if (!section.value) return ''
  if (section.value.regenerating) {
    return section.value.content
  }
  return section.value.content
})

const isStreaming = computed(() => section.value?.status === 'streaming')
const isDone = computed(() => section.value?.status === 'done')
const isRegenerating = computed(() => section.value?.regenerating === true)

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}

// 图解全屏
const lightboxVisible = ref(false)
const lightboxDiagram = ref<DiagramState | null>(null)

function openLightbox(diagram: DiagramState) {
  lightboxDiagram.value = diagram
  lightboxVisible.value = true
}

function handleSectionAction(action: string) {
  if (action === 'followup') {
    showFollowUp.value = !showFollowUp.value
    return
  }
  // simplify / switch_angle / more_examples 直接触发再生
  emit('action', props.sectionId, action)
}

function handleFollowUpSend(text: string) {
  showFollowUp.value = false
  if (!text || !text.trim()) return
  emit('action', props.sectionId, 'followup', text.trim())
}

const cardExpanded = computed(() => isExpanded.value || isStreaming.value)
</script>

<template>
  <div v-if="section" class="section-card" :class="{ 'is-streaming': isStreaming, 'is-done': isDone }">
    <!-- 标题栏 -->
    <button class="section-header" @click="toggleExpand">
      <span class="section-arrow" :class="{ expanded: cardExpanded }">
        {{ cardExpanded ? '▼' : '▶' }}
      </span>
      <span class="section-title">{{ section.title }}</span>
      <span v-if="isStreaming" class="section-spinner"></span>
    </button>

    <!-- 折叠且非流式时不渲染内容 -->
    <div v-if="cardExpanded" class="section-body">
      <!-- 骨架屏 -->
      <div v-if="section.status === 'pending'" class="section-skeleton">
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
        <div class="skeleton-line medium"></div>
      </div>

      <!-- 内容区 -->
      <div v-else class="section-content" :class="{ 'is-regenerating': isRegenerating }">
        <!-- 局部再生遮罩 -->
        <div v-if="isRegenerating" class="regenerate-overlay">
          <div class="regenerate-spinner"></div>
          <span>正在更新...</span>
        </div>

        <!-- 主体内容 -->
        <StreamingMarkdown
          :content="displayContent"
          :streaming="isStreaming"
        />

        <!-- 再生时的新内容（在遮罩下方流式显示） -->
        <div v-if="isRegenerating && section.regeneratedContent" class="regenerated-content">
          <StreamingMarkdown
            :content="section.regeneratedContent"
            :streaming="true"
          />
        </div>

        <!-- 图解槽位 -->
        <DiagramSlot
          v-if="section.diagram"
          :diagram="section.diagram"
          :sectionId="section.id"
          @retry="(diagramId: string) => store.retryDiagram(section.id)"
          @viewFullscreen="openLightbox"
        />
      </div>

      <!-- Section 操作按钮 -->
      <div v-if="showActions && isDone && !isRegenerating" class="section-footer">
        <SectionActions
          :sectionId="section.id"
          @action="handleSectionAction"
        />
      </div>

      <!-- 追问内联输入 -->
      <FollowUpInput
        v-if="showFollowUp"
        :visible="showFollowUp"
        @send="handleFollowUpSend"
        @cancel="showFollowUp = false"
      />
    </div>

    <!-- 图解全屏 -->
    <DiagramLightbox
      :visible="lightboxVisible"
      :diagram="lightboxDiagram"
      @close="lightboxVisible = false"
    />
  </div>
</template>

<style scoped>
.section-card {
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-radius: 12px;
  margin-bottom: 32px;
  /* 已完成的 section 间距 */;
}
.section-card:not(.is-done):not(.is-streaming) {
  margin-bottom: 16px; /* 折叠/待处理间距 */
}

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 16px 20px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  font-weight: 600;
  color: var(--lt-text-primary);
  text-align: left;
  transition: background 0.15s;
}
.section-header:hover {
  background: var(--lt-bg-page);
}

.section-arrow {
  font-size: 12px;
  color: var(--lt-text-secondary);
  width: 16px;
  flex-shrink: 0;
  transition: color 0.15s;
}
.section-arrow.expanded { color: var(--lt-brand); }
.section-header:hover .section-arrow { color: var(--lt-brand); }

.section-title {
  flex: 1;
}

.section-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--lt-border);
  border-top-color: var(--lt-brand);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

.section-body {
  padding: 0 20px 20px;
}

/* 骨架屏 */
.section-skeleton {
  padding: 8px 0;
}
.skeleton-line {
  height: 14px;
  background: #F3F4F6;
  border-radius: 7px;
  margin-bottom: 10px;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}
.skeleton-line.short { width: 60%; }
.skeleton-line.medium { width: 80%; }
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

/* 内容区 */
.section-content {
  position: relative;
}
.section-content.is-regenerating {
  opacity: 0.4;
  pointer-events: none;
}

/* 局部再生遮罩 */
.regenerate-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1;
  border-radius: 8px;
  gap: 8px;
  font-size: 14px;
  color: var(--lt-text-secondary);
}
.regenerate-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--lt-border);
  border-top-color: var(--lt-brand);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.regenerated-content {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed var(--lt-border);
}

.section-footer {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--lt-border);
}

@media (max-width: 768px) {
  .section-card { margin-bottom: 20px; }
  .section-card:not(.is-done):not(.is-streaming) { margin-bottom: 10px; }
  .section-header { padding: 12px 16px; font-size: 16px; }
  .section-body { padding: 0 16px 16px; }
}
</style>
