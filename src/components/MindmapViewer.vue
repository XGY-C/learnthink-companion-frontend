<template>
  <div ref="containerRef" class="mindmap-container" />
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { Transformer } from 'markmap-lib'
import { Markmap } from 'markmap-view'

const props = withDefaults(defineProps<{
  /** Markdown 内容或 JSON 树结构 */
  content: string
  /** 是否为 JSON 格式（直接传递树结构） */
  isJson?: boolean
}>(), {
  isJson: false
})

const containerRef = ref<HTMLElement | null>(null)

// ===== 从 Markdown 或 JSON 渲染思维导图 =====
const renderMindmap = async () => {
  if (!containerRef.value) return

  // 清空容器
  containerRef.value.innerHTML = ''

  try {
    let data: any

    if (props.isJson) {
      // JSON 格式直接解析
      data = typeof props.content === 'string' ? JSON.parse(props.content) : props.content
    } else {
      // Markdown 格式用 Transformer 转换
      const transformer = new Transformer()
      const { root } = transformer.transform(props.content)
      data = root
    }

    await nextTick()

    Markmap.create(containerRef.value, {
      zoom: true,
      pan: true,
      autoFit: true,
      fitRatio: 0.95,
      maxWidth: 300,
      nodeMinHeight: 24,
      spacingVertical: 10,
      spacingHorizontal: 60,
      duration: 500,
      style: (_id: string) => `
        .markmap-foreign { font-size: 13px; line-height: 1.5; }
        .markmap-foreign p { margin: 0; font-weight: 400; }
        .markmap-foreign strong { font-weight: 600; }
      `
    }, data)

  } catch (err) {
    console.error('Mindmap rendering error:', err)
    if (containerRef.value) {
      containerRef.value.innerHTML = `
        <div class="flex items-center justify-center h-full text-slate-400">
          <div class="text-center">
            <el-icon class="text-3xl mb-2"><WarningFilled /></el-icon>
            <p class="text-sm">思维导图渲染失败</p>
          </div>
        </div>
      `
    }
  }
}

watch(() => props.content, () => {
  renderMindmap()
})

onMounted(() => {
  renderMindmap()
})

onUnmounted(() => {
})
</script>

<style scoped>
.mindmap-container {
  width: 100%;
  height: 100%;
  min-height: 300px;
  background: #fafbfc;
  border-radius: 8px;
  overflow: hidden;
}

.mindmap-container :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
