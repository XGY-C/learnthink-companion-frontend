<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue'
import { Graph } from '@antv/g6'
import { apiFetch } from '@/utils/api'
import type { KnowledgeGraphData } from '@/types'

const props = defineProps<{
  modelValue: boolean
  courseId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
}>()

const visible = ref(props.modelValue)
watch(() => props.modelValue, v => { visible.value = v })
watch(visible, v => { emit('update:modelValue', v) })

const loading = ref(false)
const hasGraph = ref(false)
const kgData = ref<KnowledgeGraphData | null>(null)

const graphContainer = ref<HTMLElement>()
let g6Graph: Graph | null = null

const nodeColorMap: Record<string, string> = {
  chapter: '#4F8CFF',
  section: '#73A6FF',
  concept: '#9B7CFC',
  skill: '#FF9A5C',
  method: '#4ADE80',
}

async function loadGraph() {
  if (!props.courseId) return
  loading.value = true
  try {
    const res = await apiFetch<KnowledgeGraphData>(`/courses/${props.courseId}/knowledge-graph`)
    console.log('[KG] API response received, has graph:', !!res.data?.graph)
    if (res.data?.graph) {
      kgData.value = res.data
      hasGraph.value = true
      await nextTick()
      // el-dialog Teleport renders async, poll for container element
      for (let i = 0; i < 20; i++) {
        if (graphContainer.value || document.getElementById('kg-graph-container')) break
        await new Promise(r => setTimeout(r, 50))
      }
      console.log('[KG] element found, container ref:', !!graphContainer.value, 'getElementById:', !!document.getElementById('kg-graph-container'))
      await initGraph()
    } else {
      hasGraph.value = false
    }
  } catch (e) {
    console.error('[KG] loadGraph error:', e)
    hasGraph.value = false
  } finally {
    loading.value = false
  }
}

async function initGraph() {
  destroyGraph()

  const el = graphContainer.value || document.getElementById('kg-graph-container')
  console.log('[KG] initGraph called, el:', el?.tagName, 'clientSize:', el?.clientWidth, el?.clientHeight, 'kgData:', !!kgData.value?.graph)

  if (!el || !kgData.value?.graph) {
    console.log('[KG] early return: el=', !!el, 'graph=', !!kgData.value?.graph)
    return
  }

  const containerWidth = el.clientWidth || 800
  const containerHeight = el.clientHeight || 520

  const graph = kgData.value.graph
  const g6Data = {
    nodes: graph.nodes.map(n => {
      const color = nodeColorMap[n.type || 'concept'] || '#7C5CFC'
      return {
        id: n.id,
        data: { ...n },
        style: { fill: color },
      }
    }),
    edges: graph.edges.map((e, i) => ({
      id: `e${i}`,
      source: e.source,
      target: e.target,
      data: { ...e },
    })),
  }

  console.log('[KG] Creating Graph with', g6Data.nodes.length, 'nodes,', g6Data.edges.length, 'edges, size:', containerWidth, containerHeight)

  try {
    g6Graph = new Graph({
      container: el,
      width: containerWidth,
      height: containerHeight,
      data: g6Data,
      layout: {
        type: 'd3-force',
        alphaDecay: 0.015,
        alphaMin: 0.001,
        animation: true,
        link: {
          distance: 80,
          strength: 0.8,
        },
        manyBody: {
          strength: -400,
        },
        collide: {
          radius: 50,
          strength: 1.2,
        },
      },
      node: {
        type: 'circle',
        style: {
          size: (d: any) => {
            const type = d.data?.type || 'concept'
            if (type === 'chapter' || type === 'section') return 48
            if (type === 'skill' || type === 'method') return 36
            return 40
          },
          fill: (d: any) => d.style?.fill || '#7C5CFC',
          stroke: (d: any) => d.style?.fill || '#7C5CFC',
          strokeWidth: 2,
          labelText: (d: any) => {
            const label = d.data?.label || d.id
            return label.length > 8 ? label.slice(0, 8) + '..' : label
          },
          labelFill: '#374151',
          labelFontSize: 11,
          labelFontWeight: 500,
          labelPlacement: 'bottom',
          labelOffsetY: 8,
          shadowColor: 'rgba(0,0,0,0.12)',
          shadowBlur: 8,
          shadowOffsetX: 1,
          shadowOffsetY: 1,
          cursor: 'pointer',
        },
        state: {
          hover: {
            strokeWidth: 4,
            shadowBlur: 16,
            shadowColor: 'rgba(0,0,0,0.2)',
          },
        },
      },
      edge: {
        type: 'line',
        style: {
          stroke: '#D1D5DB',
          strokeWidth: 1,
          endArrow: true,
          labelText: (d: any) => d.data?.label || '',
          labelFontSize: 10,
          labelFill: '#9CA3AF',
          labelBackground: true,
          labelBackgroundFill: '#fff',
          labelBackgroundRadius: 4,
          labelBackgroundOpacity: 0.85,
        },
      },
      behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element', 'hover-activate'],
      autoFit: 'view',
      animation: true,
    })

    await g6Graph.render()
    console.log('[KG] render() completed, container children:', el.children.length, 'canvas elements:', el.querySelectorAll('canvas').length)

    // tooltip on node hover
    g6Graph.on('node:pointerenter', (evt: any) => {
      const id = evt.target?.id
      const node = graph.nodes.find(n => n.id === id)
      if (node?.description) {
        g6Graph?.setElementState({ [id]: 'hover' })
      }
    })
  } catch (e) {
    console.error('[KnowledgeGraph] G6 init error:', e)
  }
}

function destroyGraph() {
  if (g6Graph) {
    g6Graph.destroy()
    g6Graph = null
  }
}

onUnmounted(destroyGraph)

watch(visible, async (v) => {
  if (v) {
    await loadGraph()
  }
  if (!v) {
    destroyGraph()
    kgData.value = null
    hasGraph.value = false
  }
})

function handleClose() {
  visible.value = false
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="kgData ? `知识图谱 —《${kgData.textbookTitle}》` : '知识图谱'"
    width="860px"
    destroy-on-close
    @close="handleClose"
  >
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="flex flex-col items-center gap-3">
        <div class="w-8 h-8 border-2 rounded-full animate-spin" style="border-color: var(--lt-brand); border-bottom-color: transparent;" />
        <span class="text-sm" style="color: var(--lt-text-auxiliary);">加载知识图谱中...</span>
      </div>
    </div>
    <div v-else-if="!hasGraph" class="flex flex-col items-center justify-center py-12 gap-3">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--lt-text-placeholder)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="5" r="2" />
        <circle cx="5" cy="19" r="1.5" />
        <circle cx="19" cy="19" r="1.5" />
        <line x1="12" y1="7" x2="5" y2="17.5" />
        <line x1="12" y1="7" x2="19" y2="17.5" />
        <line x1="5" y1="17.5" x2="19" y2="17.5" />
      </svg>
      <p class="text-sm" style="color: var(--lt-text-placeholder);">暂无知识图谱数据</p>
      <p class="text-xs" style="color: var(--lt-text-auxiliary);">请先由教师在管理端生成该课程的知识图谱</p>
    </div>
    <div v-show="hasGraph && !loading" class="kg-graph-wrapper">
      <div id="kg-graph-container" ref="graphContainer" class="kg-graph-container" />
      <div v-if="kgData && kgData.graph" class="flex items-center justify-between mt-3 px-1">
        <div class="flex items-center gap-3">
          <span v-for="(color, type) in nodeColorMap" :key="type" class="flex items-center gap-1">
            <span class="w-3 h-3 rounded-full inline-block" :style="{ backgroundColor: color }" />
            <span class="text-xs" style="color: var(--lt-text-auxiliary);">{{ { chapter: '章', section: '节', concept: '概念', skill: '技能', method: '方法' }[type] }}</span>
          </span>
        </div>
        <span class="text-xs" style="color: var(--lt-text-placeholder);">
          {{ kgData.graph.nodes.length }} 节点 · {{ kgData.graph.edges.length }} 边
        </span>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.kg-graph-wrapper {
  width: 100%;
}
.kg-graph-container {
  width: 100%;
  height: 520px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--lt-bg-page);
  border: 1px solid var(--lt-border);
}
</style>
