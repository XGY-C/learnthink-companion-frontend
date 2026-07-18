<template>
  <el-dialog
    v-model="visible"
    title="导出试卷"
    width="560px"
    :close-on-click-modal="false"
    append-to-body
    class="export-dialog"
  >
    <!-- 导出设置 -->
    <div class="export-settings">
      <div class="export-setting-item">
        <label class="export-setting-label">导出格式</label>
        <div class="export-format-options">
          <button
            class="export-format-card"
            :class="{ 'export-format-card--active': format === 'md' }"
            @click="format = 'md'"
          >
            <div class="export-format-card__icon export-format-card__icon--md">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <span class="export-format-card__name">Markdown</span>
            <span class="export-format-card__desc">纯文本格式，易于编辑</span>
          </button>
          <button
            class="export-format-card"
            :class="{ 'export-format-card--active': format === 'docx' }"
            @click="format = 'docx'"
          >
            <div class="export-format-card__icon export-format-card__icon--docx">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <rect x="3" y="3" width="18" height="18" rx="2"/>
              </svg>
            </div>
            <span class="export-format-card__name">Word 文档</span>
            <span class="export-format-card__desc">排版精美，适合打印</span>
          </button>
        </div>
      </div>

      <div class="export-setting-item">
        <label class="export-setting-label">内容选项</label>
        <div class="export-answer-toggle">
          <el-switch v-model="includeAnswers" size="large" />
          <span class="export-answer-toggle__label">
            {{ includeAnswers ? '包含参考答案与解析' : '仅导出试题（不含答案）' }}
          </span>
        </div>
      </div>
    </div>

    <!-- 预览区 -->
    <div class="export-preview">
      <div class="export-preview__header">
        <span class="export-preview__title">预览</span>
        <span class="export-preview__hint">前 3 题预览</span>
      </div>
      <div class="export-preview__content">
        <MarkdownViewer :content="previewMarkdown" :show-toc="false" themed />
      </div>
    </div>

    <!-- 操作按钮 -->
    <template #footer>
      <div class="export-footer">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="exporting" @click="handleExport">
          <el-icon class="mr-1"><Download /></el-icon>
          导出{{ format === 'md' ? ' Markdown' : ' Word' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import { practiceToMarkdown, exportPracticeMD, exportPracticeDocx } from '@/utils/practiceExport'
import type { PracticeSession } from '@/types'

const props = defineProps<{
  modelValue: boolean
  session: PracticeSession | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
}>()

const visible = ref(props.modelValue)
const format = ref<'md' | 'docx'>('docx')
const includeAnswers = ref(true)
const exporting = ref(false)

watch(() => props.modelValue, (v) => { visible.value = v })
watch(visible, (v) => { emit('update:modelValue', v) })

// 预览：仅取前 3 题生成 markdown 片段
const previewMarkdown = computed(() => {
  if (!props.session) return ''
  const previewSession: PracticeSession = {
    ...props.session,
    questions: props.session.questions.slice(0, 3),
    questionCount: Math.min(props.session.questionCount, 3),
  }
  return practiceToMarkdown(previewSession, includeAnswers.value)
})

async function handleExport() {
  if (!props.session) {
    ElMessage.warning('没有可导出的练习数据')
    return
  }
  exporting.value = true
  try {
    if (format.value === 'md') {
      exportPracticeMD(props.session, includeAnswers.value)
    } else {
      await exportPracticeDocx(props.session, includeAnswers.value)
    }
    ElMessage.success('试卷导出成功')
    visible.value = false
  } catch (e: any) {
    ElMessage.error(e.message || '导出失败')
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
.export-dialog :deep(.el-dialog__header) {
  padding: 20px 24px 0;
}
.export-dialog :deep(.el-dialog__body) {
  padding: 20px 24px;
}
.export-dialog :deep(.el-dialog__footer) {
  padding: 0 24px 20px;
}

.export-settings {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 20px;
}
.export-setting-item {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.export-setting-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--lt-text-primary);
}

/* 格式选择卡片 */
.export-format-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.export-format-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  background: var(--lt-bg-card);
  border: 2px solid var(--lt-border);
  border-radius: var(--lt-radius-md);
  cursor: pointer;
  transition: border-color var(--lt-transition-smooth), box-shadow var(--lt-transition-smooth);
  font: inherit;
  color: inherit;
  text-align: center;
}
.export-format-card:hover {
  border-color: var(--lt-brand-lighter);
  box-shadow: var(--lt-shadow-hover);
}
.export-format-card--active {
  border-color: var(--lt-brand);
  background: var(--lt-brand-lightest);
}
.export-format-card__icon {
  width: 48px;
  height: 48px;
  border-radius: var(--lt-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}
.export-format-card__icon--md {
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
}
.export-format-card__icon--docx {
  background: var(--lt-ai-light-9);
  color: var(--lt-ai);
}
.export-format-card__name {
  font-size: 15px;
  font-weight: 600;
  color: var(--lt-text-primary);
}
.export-format-card__desc {
  font-size: 12px;
  color: var(--lt-text-secondary);
}

/* 答案开关 */
.export-answer-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--lt-bg-page);
  border-radius: var(--lt-radius-md);
}
.export-answer-toggle__label {
  font-size: 14px;
  color: var(--lt-text-primary);
}

/* 预览区 */
.export-preview {
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-md);
  overflow: hidden;
}
.export-preview__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: var(--lt-bg-page);
  border-bottom: 1px solid var(--lt-border);
}
.export-preview__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--lt-text-primary);
}
.export-preview__hint {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
}
.export-preview__content {
  max-height: 260px;
  overflow-y: auto;
  padding: 16px;
  background: var(--lt-bg-card);
}
.export-preview__content :deep(.markdown-viewer) {
  font-size: 13px;
}

.export-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
