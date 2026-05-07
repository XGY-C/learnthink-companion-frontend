<template>
  <el-drawer
    v-model="visible"
    title="证据与来源"
    size="40%"
    direction="rtl"
  >
    <div class="px-2">
            <div v-if="!sources || sources.length === 0" class="text-center py-10" style="color: #8E8EA0;">
        无可用来源信息
      </div>
      <div v-else class="space-y-4">
        <div v-for="(source, index) in sources" :key="index" class="rounded p-4" style="background-color: #F5F7FA; border: 1px solid #E8ECF0;">
          <div class="flex justify-between items-start mb-2">
            <h5 class="text-sm font-medium m-0 flex-1" style="color: #1A1A2E;">{{ source.title }}</h5>
            <el-tag size="small" type="info" class="ml-2 shrink-0">{{ source.locator }}</el-tag>
          </div>
          <p class="text-sm p-3 rounded font-serif leading-relaxed mb-2" style="color: #5A5A72; background-color: #FFFFFF; border: 1px solid #E8ECF0;">
            "{{ source.quote }}"
          </p>
          <div class="flex justify-between items-center mt-2">
            <span v-if="source.relevance" class="text-xs px-2 py-0.5 rounded" :class="relevanceClass(source.relevance)">
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

const relevanceClass = (rel: string) => {
  if (rel === 'high') return 'bg-success/10 text-success'
  if (rel === 'medium') return 'bg-warning/10 text-warning'
  return 'bg-danger/10 text-danger'
}

defineExpose({
  open
})
</script>