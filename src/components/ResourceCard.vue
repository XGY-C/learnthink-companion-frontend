<template>
  <el-card class="resource-card h-full flex flex-col relative" :body-style="{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', flexGrow: 1 }">
    <div v-if="status === 'loading'" class="h-full flex flex-col justify-center items-center py-6 gap-3">
      <el-skeleton animated :rows="3" />
      <span class="text-sm text-slate-500">等待该资源生成...</span>
    </div>
    
    <div v-else class="h-full flex flex-col flex-grow">
      <!-- Header -->
      <div class="flex justify-between items-start mb-3">
        <h4 class="text-base font-semibold m-0 text-slate-800 line-clamp-1 flex-1">{{ title }}</h4>
        <el-tag size="small" :type="typeTagStyle" class="ml-2 flex-shrink-0">{{ typeLabel }}</el-tag>
      </div>
      
      <!-- Meta -->
      <div class="flex items-center gap-2 mb-3 text-xs">
        <el-tag size="small" :type="confidenceStyle" effect="plain">{{ confidenceLabel }}置信度</el-tag>
        <span class="text-slate-500 border-l border-slate-200 pl-2 cursor-pointer hover:text-primary transition-colors" @click.stop="$emit('view-sources')">
          来源 {{ sourcesCount }}
        </span>
        <span class="text-slate-500 border-l border-slate-200 pl-2">
          质量 {{ qualityScore }}/100
        </span>
      </div>
      
      <!-- Brief -->
      <p class="text-sm text-slate-600 mb-4 line-clamp-2 min-h-[40px]">{{ brief }}</p>
      
      <!-- Reject Reason -->
      <div v-if="status === 'rejected'" class="bg-danger/10 text-danger p-2 rounded text-xs mb-4">
        <strong>驳回原因:</strong> {{ rejectReason }}
      </div>
      <div v-else-if="status === 'failed'" class="bg-danger/10 text-danger p-2 rounded text-xs mb-4">
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
        <div class="flex justify-end gap-2 border-t border-slate-100 pt-3">
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
    <div v-if="status === 'ready'" class="absolute -right-1 -top-1 w-3 h-3 bg-success rounded-full border-2 border-white pointer-events-none shadow-sm" title="已就绪"></div>
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