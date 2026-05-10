<template>
  <el-drawer
    v-model="visible"
    title="证据与来源"
    size="40%"
    direction="rtl"
  >
    <div class="px-2">
            <div v-if="!sources || sources.length === 0" class="text-center py-10" style="color: var(--lt-text-auxiliary);">
        无可用来源信息
      </div>
      <div v-else class="space-y-4">
        <div v-for="(source, index) in sources" :key="index" class="rounded p-4" style="background-color: var(--lt-bg-page); border: 1px solid var(--lt-border);">
          <div class="flex justify-between items-start mb-2">
            <h5 class="text-sm font-medium m-0 flex-1" style="color: var(--lt-text-primary);">{{ source.title }}</h5>
            <el-tag size="small" type="info" class="ml-2 shrink-0">{{ source.locator }}</el-tag>
          </div>
          <p class="text-sm p-3 rounded font-serif leading-relaxed mb-2" style="color: var(--lt-text-secondary); background-color: var(--lt-bg-card); border: 1px solid var(--lt-border);">
            "{{ source.quote }}"
          </p>
          <div class="flex justify-between items-center mt-2">
            <span v-if="source.relevance" class="text-xs px-2 py-0.5 rounded" :style="relevanceStyle(source.relevance)">
              关联度: {{ source.relevance }}
            </span>
            <el-button link type="primary" size="small" @click="copyQuote(source.quote)">复制引用</el-button>
          </div>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const visible = ref(false)
const sources = ref<any[]>([])

const open = (data: any[]) => {
  sources.value = data
  visible.value = true
}

const copyQuote = (text: string) => {
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('已复制到剪贴板')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

const relevanceStyle = (rel: string) => {
  if (rel === 'high') return { backgroundColor: 'rgba(52, 199, 89, 0.1)', color: 'var(--lt-success)' }
  if (rel === 'medium') return { backgroundColor: 'rgba(255, 159, 10, 0.1)', color: 'var(--lt-warning)' }
  return { backgroundColor: 'rgba(255, 59, 48, 0.1)', color: 'var(--lt-danger)' }
}

defineExpose({
  open
})
</script>