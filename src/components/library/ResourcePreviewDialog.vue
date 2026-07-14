<template>
  <el-dialog
    v-model="visible"
    :title="file?.title || '资源预览'"
    width="70%"
    destroy-on-close
    class="resource-preview-dialog"
    @close="onClose"
  >
    <div v-if="file" class="preview-body">
      <!-- 顶栏：信息 + 下载 + 证据 -->
      <div class="flex items-center gap-4 mb-3 pb-1" style="border-bottom: 1px solid var(--lt-border);">
        <div class="flex items-center gap-3 text-sm">
          <el-tag size="small" :type="confidenceTagType" effect="plain">
            {{ confidenceLabel }}置信度
          </el-tag>
          <span style="color: var(--lt-text-auxiliary);">
            质量分 <strong style="color: var(--lt-brand);">{{ file.qualityScore }}</strong>/100
          </span>
          <span v-if="file.topic" style="color: var(--lt-text-auxiliary);">
            {{ file.topic }}
          </span>
        </div>
        <div class="flex items-center gap-2 ml-auto">
          <el-dropdown v-if="file.type === 'doc' || file.type === 'reading'" size="small" @command="onDownload">
            <el-button size="small" type="primary">
              <el-icon class="mr-1"><Download /></el-icon>下载 <el-icon class="ml-1"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="docx">下载 DOCX</el-dropdown-item>
                <el-dropdown-item command="md">下载 Markdown</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button v-if="file.sources && file.sources.length > 0" link type="primary" size="small" @click="showSources = !showSources">
            查看引用证据 ({{ file.sources.length }})
          </el-button>
        </div>
      </div>

      <!-- 内容体 -->
      <div class="min-h-[200px]">
        <!-- 思维导图 -->
        <div v-if="file.type === 'mindmap'" class="h-[600px] rounded-lg" style="border: 1px solid var(--lt-border);">
          <MindmapViewer
            ref="mindmapViewerRef"
            :content="content || '# 暂无内容'"
            :isJson="true"
          />
        </div>
        <div v-if="file.type === 'mindmap'" class="flex gap-2 mt-3">
          <el-button size="small" @click="mindmapViewerRef?.exportSvg(file.title + '.svg')">
            <el-icon class="mr-1"><Download /></el-icon>导出 SVG
          </el-button>
          <el-button size="small" @click="mindmapViewerRef?.exportPng(file.title + '.png')">
            <el-icon class="mr-1"><Download /></el-icon>导出 PNG
          </el-button>
        </div>

        <!-- 练习题 -->
        <div v-else-if="file.type === 'quiz'">
          <QuizPreview
            :content="content || ''"
            :quality-score="file.qualityScore"
          />
        </div>

        <!-- 代码案例 -->
        <div v-else-if="file.type === 'code'">
          <CodeLearningViewer
            :content="content || ''"
            :title="file.title"
            :quality-score="file.qualityScore"
            :sources-count="file.sourcesCount ?? 0"
          />
        </div>

        <!-- 视频 -->
        <div v-else-if="file.type === 'video'" class="rounded-lg overflow-hidden bg-black">
          <video v-if="videoUrl" :src="videoUrl" controls class="w-full" style="max-height: 500px;" />
          <div v-else class="flex items-center justify-center py-16" style="color: var(--lt-text-auxiliary);">
            <span>视频正在生成或 URL 暂不可用</span>
          </div>
        </div>

        <!-- 默认：doc/reading -->
        <div v-else>
          <MarkdownViewer :content="content || '暂无内容'" :showToc="true" />
        </div>
      </div>

      <!-- 证据来源 -->
      <Transition name="expand">
        <div v-if="showSources && file.sources && file.sources.length > 0" class="mt-6 pt-4" style="border-top: 1px solid var(--lt-border);">
          <div class="flex items-center gap-2 mb-3">
            <el-icon style="color: var(--lt-brand);"><Reading /></el-icon>
            <span class="text-sm font-medium" style="color: var(--lt-text-primary);">引用来源 ({{ file.sources.length }})</span>
          </div>
          <div class="space-y-2">
            <div
              v-for="(source, idx) in file.sources"
              :key="idx"
              class="rounded p-3 text-sm"
              style="background-color: var(--lt-bg-page); border: 1px solid var(--lt-border);"
            >
              <div class="flex justify-between items-start mb-1">
                <span class="font-medium" style="color: var(--lt-text-secondary);">{{ source.title }}</span>
                <el-tag size="small" type="info">{{ source.locator }}</el-tag>
              </div>
              <p class="text-xs italic m-0" style="color: var(--lt-text-auxiliary);">"{{ source.quote }}"</p>
            </div>
          </div>
        </div>
      </Transition>

      <!-- 相关笔记 -->
      <div v-if="file.noteCount > 0" class="mt-6 pt-4" style="border-top: 1px solid var(--lt-border);">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <el-icon style="color: var(--lt-ai);"><EditPen /></el-icon>
            <span class="text-sm font-medium" style="color: var(--lt-text-primary);">相关笔记 ({{ file.noteCount }})</span>
          </div>
          <el-button text size="small" type="primary" @click="$emit('view-notes', file)">
            查看全部 <el-icon class="ml-1"><ArrowRight /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button v-if="file?.packId" type="primary" @click="onLearn">
        <el-icon class="mr-1"><Reading /></el-icon>进入学习
      </el-button>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Download, ArrowDown, ArrowRight, Reading, EditPen } from '@element-plus/icons-vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import QuizPreview from '@/components/QuizPreview.vue'
import MindmapViewer from '@/components/MindmapViewer.vue'
import CodeLearningViewer from '@/components/code/CodeLearningViewer.vue'
import { markdownToDocxBlob, downloadDocx, preprocessLatexForMarkdown } from '@/utils/docxExport'
import { extractVideoUrl } from '@/utils/media'
import { useResourceStore } from '@/stores/resource'
import { CONFIDENCE_CONFIG } from '@/constants'
import type { ResourceFile } from '@/types'

const props = defineProps<{
  modelValue: boolean
  file: ResourceFile | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'view-notes', file: ResourceFile): void
  (e: 'learn', file: ResourceFile): void
}>()

const router = useRouter()
const resourceStore = useResourceStore()
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const showSources = ref(false)
const mindmapViewerRef = ref<{ exportSvg: (filename?: string) => void; exportPng: (filename?: string) => Promise<void> } | null>(null)
const detailContent = ref<string>('')

const content = computed(() => detailContent.value || props.file?.content || '')

const videoUrl = computed(() => {
  if (props.file?.type !== 'video') return null
  return extractVideoUrl(props.file as any)
})

const confidenceTagType = computed(() => {
  return props.file?.confidence ? (CONFIDENCE_CONFIG[props.file.confidence]?.type ?? 'info') : 'info'
})

const confidenceLabel = computed(() => {
  return props.file?.confidence ? (CONFIDENCE_CONFIG[props.file.confidence]?.label ?? '未知') : '未知'
})

// 加载详情
watch(() => props.file?.id, async (id) => {
  if (id && props.file) {
    showSources.value = false
    detailContent.value = ''
    if (!props.file.content) {
      const detail = await resourceStore.fetchFileDetail(id)
      if (detail) {
        detailContent.value = detail.content || ''
        Object.assign(props.file, detail)
      }
    }
  }
}, { immediate: true })

function onDownload(format: string) {
  if (!props.file) return
  const raw = content.value || ''
  if (format === 'docx') {
    markdownToDocxBlob(raw, props.file.title).then(blob => downloadDocx(blob, props.file!.title))
  } else if (format === 'md') {
    const processed = preprocessLatexForMarkdown(raw)
    const blob = new Blob([processed], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${props.file.title}.md`
    a.click()
  }
}

function onClose() {
  showSources.value = false
  detailContent.value = ''
}

function onLearn() {
  if (!props.file?.packId) return
  visible.value = false
  router.push(`/learn/resource/${props.file.packId}`)
}
</script>

<style scoped>
.preview-body {
  min-height: 300px;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}
.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 2000px;
}
</style>

<style>
.resource-preview-dialog {
  --el-dialog-padding-primary: 20px;
}
.resource-preview-dialog .el-dialog__body {
  overflow: visible;
}
.resource-preview-dialog .el-dialog__header {
  padding-bottom: 16px;
}
.resource-preview-dialog .el-dialog__title {
  font-size: 15px;
}
</style>
