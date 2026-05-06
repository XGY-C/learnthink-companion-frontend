<template>
  <el-card class="resource-card h-full flex flex-col relative" :body-style="{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', flexGrow: 1 }">
        <div v-if="status === 'loading'" class="h-full flex flex-col justify-center items-center py-6 gap-3">
          <el-skeleton animated :rows="3" />
          <span class="text-sm" style="color: var(--lt-text-auxiliary);">等待该资源生成...</span>
        </div>
    
        <div v-else class="h-full flex flex-col flex-grow">
          <!-- Header -->
          <div class="flex justify-between items-start mb-3">
            <h4 class="text-base font-semibold m-0 line-clamp-1 flex-1" style="color: var(--lt-text-primary);">{{ title }}</h4>
            <el-tag size="small" :type="typeTagStyle" class="ml-2 flex-shrink-0">{{ typeLabel }}</el-tag>
          </div>
      
          <!-- Meta -->
          <div class="flex items-center gap-2 mb-3 text-xs">
            <el-tag size="small" :type="confidenceStyle" effect="plain">{{ confidenceLabel }}置信度</el-tag>
            <span style="color: var(--lt-brand); border-left: 1px solid var(--lt-border);" class="pl-2 cursor-pointer hover:text-blue-600 transition-colors" @click.stop="$emit('view-sources')">
              来源 {{ sourcesCount }}
            </span>
            <span class="quality-score pl-2" style="border-left: 1px solid var(--lt-border); color: var(--lt-text-secondary);">
              质量 {{ qualityScore }}/100
            </span>
          </div>
      
          <!-- Brief -->
          <p class="text-sm mb-4 line-clamp-2 min-h-[40px]" style="color: var(--lt-text-secondary);">{{ brief }}</p>
      
            <!-- Reject Reason -->
      <div v-if="status === 'rejected'" class="p-2 rounded text-xs mb-4" style="background-color: rgba(255, 59, 48, 0.1); color: var(--lt-danger);">
        <strong>驳回原因:</strong> {{ rejectReason }}
      </div>
      <div v-else-if="status === 'failed'" class="p-2 rounded text-xs mb-4" style="background-color: rgba(255, 59, 48, 0.1); color: var(--lt-danger);">
        <strong>失败原因:</strong> {{ rejectReason || '未知错误' }}
      </div>

      <div class="mt-auto">
        <!-- Push Reasons -->
        <div class="flex flex-wrap gap-1.5 mb-4">
          <el-tag v-for="tag in pushReasons" :key="tag" size="small" type="info" class="text-xs">
            {{ tag }}
          </el-tag>
        </div>
        
                <!-- Actions -->
        <div class="flex justify-end gap-2 pt-3" style="border-top: 1px solid var(--lt-border);">
          <template v-if="status === 'ready'">
            <el-button size="small" @click="$emit('preview')">预览</el-button>
            <el-button size="small" plain type="info" @click="$emit('regenerate')">重生成</el-button>
          </template>
          <template v-else-if="status === 'rejected' || status === 'failed'">
            <el-button size="small" type="danger" @click="$emit('regenerate')">重试该资源</el-button>
          </template>
        </div>
      </div>
    </div>
    
        <!-- Status Badge -->
    <div v-if="status === 'ready'" class="absolute -right-1 -top-1 w-3 h-3 rounded-full border-2 border-white pointer-events-none shadow-sm" title="已就绪" style="background-color: var(--lt-success);"></div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  title: string
  type: string
  status: 'loading' | 'ready' | 'failed' | 'rejected'
  confidence?: 'high' | 'medium' | 'low'
  sourcesCount?: number
  qualityScore?: number
  brief?: string
  pushReasons?: string[]
  rejectReason?: string
}>()

defineEmits(['preview', 'view-sources', 'regenerate'])

const typeLabelMap: Record<string, string> = {
  doc: '讲解文档',
  mindmap: '思维导图',
  quiz: '练习题',
  reading: '拓展阅读',
  code: '代码案例',
  video_script: '视频脚本'
}
const typeLabel = computed(() => typeLabelMap[props.type] || props.type)

const typeTagStyleMap: Record<string, any> = {
  doc: 'primary',
  mindmap: 'warning',
  quiz: 'success',
  reading: 'info',
  code: 'danger',
  video_script: 'default'
}
const typeTagStyle = computed(() => typeTagStyleMap[props.type] || 'info')

const confidenceStyleMap: Record<string, any> = {
  high: 'success',
  medium: 'warning',
  low: 'danger'
}
const confidenceStyle = computed(() => props.confidence ? confidenceStyleMap[props.confidence] : 'info')

const confidenceLabelMap: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低'
}
const confidenceLabel = computed(() => props.confidence ? confidenceLabelMap[props.confidence] : '未知')
</script>