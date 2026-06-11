<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { PropType } from 'vue'
import type { Module } from '@/types'
import { usePathInteraction } from '@/composables/usePathInteraction'

// ===== Props & Emits =====
const props = defineProps({
  modules: {
    type: Array as PropType<Module[]>,
    required: true,
  },
})

const emit = defineEmits(['node-click'])

const { scrollToModule } = usePathInteraction()

// 动态SVG宽度
const svgWidth = ref(600)

// 缩放和平移状态
const scale = ref(1)
const translateX = ref(0)
const translateY = ref(0)
const isDragging = ref(false)
const lastMouseX = ref(0)
const lastMouseY = ref(0)

// SVG容器引用
const svgContainer = ref<HTMLElement | null>(null)

// 缩放和平移控制
function handleWheel(event: WheelEvent) {
  event.preventDefault()
  const delta = event.deltaY > 0 ? 0.9 : 1.1
  const newScale = Math.max(0.3, Math.min(3, scale.value * delta))
  
  // 计算缩放中心点
  const rect = svgContainer.value?.getBoundingClientRect()
  if (rect) {
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top
    
    // 调整平移以保持鼠标位置不变
    translateX.value = mouseX - (mouseX - translateX.value) * (newScale / scale.value)
    translateY.value = mouseY - (mouseY - translateY.value) * (newScale / scale.value)
  }
  
  scale.value = newScale
}

function handleMouseDown(event: MouseEvent) {
  if (event.button === 0) { // 左键
    isDragging.value = true
    lastMouseX.value = event.clientX
    lastMouseY.value = event.clientY
    event.preventDefault()
  }
}

function handleMouseMove(event: MouseEvent) {
  if (isDragging.value) {
    const deltaX = event.clientX - lastMouseX.value
    const deltaY = event.clientY - lastMouseY.value
    
    translateX.value += deltaX
    translateY.value += deltaY
    
    lastMouseX.value = event.clientX
    lastMouseY.value = event.clientY
  }
}

function handleMouseUp() {
  isDragging.value = false
}

function handleMouseLeave() {
  isDragging.value = false
}

// 重置视图
function resetView() {
  scale.value = 1
  translateX.value = 0
  translateY.value = 0
}

// 缩放控制
function zoomIn() {
  scale.value = Math.min(3, scale.value * 1.2)
}

function zoomOut() {
  scale.value = Math.max(0.3, scale.value * 0.8)
}

// 生命周期
onMounted(() => {
  document.addEventListener('mouseup', handleMouseUp)
})

onUnmounted(() => {
  document.removeEventListener('mouseup', handleMouseUp)
})

// ===== DAG Logic (as before) =====
interface DagNode {
  id: string
  title: string
  status: Module['status']
  x: number
  y: number
}

const dagNodes = computed<DagNode[]>(() => {
  if (props.modules.length === 0) return []
  const inDegree: Record<string, number> = {}
  props.modules.forEach(m => { inDegree[m.moduleId] = 0 })
  props.modules.forEach(m => (m.prerequisites || []).forEach(_p => {
    if (inDegree[m.moduleId] !== undefined) inDegree[m.moduleId]++
  }))

  const layers: string[][] = []
  const queue = props.modules.filter(m => inDegree[m.moduleId] === 0).map(m => m.moduleId)
  const tempInDegree = { ...inDegree }

  while (queue.length > 0) {
    const currentLayerSize = queue.length
    const currentLayer: string[] = []
    for (let i = 0; i < currentLayerSize; i++) {
      const nodeId = queue.shift()!
      currentLayer.push(nodeId)
      props.modules.forEach(m => {
        if (m.prerequisites?.includes(nodeId)) {
          tempInDegree[m.moduleId]--
          if (tempInDegree[m.moduleId] === 0) {
            queue.push(m.moduleId)
          }
        }
      })
    }
    layers.push(currentLayer)
  }

  const nodeMap = new Map<string, DagNode>()
  const nodeWidth = 160, nodeHeight = 48, hGap = 24, layerGap = 100
  const padding = 40

  // 计算最大层宽度
  const maxLayerWidth = Math.max(...layers.map(l => l.length * nodeWidth + (l.length - 1) * hGap))
  // 动态计算viewBox宽度
  svgWidth.value = maxLayerWidth + padding * 2

  layers.forEach((layer, li) => {
    const totalW = layer.length * nodeWidth + (layer.length - 1) * hGap
    const startX = padding + (maxLayerWidth - totalW) / 2
    layer.forEach((id, ni) => {
      const m = props.modules.find(mm => mm.moduleId === id)
      if (m) {
        nodeMap.set(id, {
          id: m.moduleId,
          title: m.title.length > 10 ? m.title.slice(0, 10) + '…' : m.title,
          status: m.status,
          x: startX + ni * (nodeWidth + hGap),
          y: 30 + li * (nodeHeight + layerGap),
        })
      }
    })
  })
  return [...nodeMap.values()]
})

const dagEdges = computed(() => {
  const edges: { path: string }[] = []
  const nodeMap = new Map(dagNodes.value.map(n => [n.id, n]))
  props.modules.forEach(m => {
    (m.prerequisites || []).forEach(p => {
      const from = nodeMap.get(p)
      const to = nodeMap.get(m.moduleId)
      if (from && to) {
        const mx1 = from.x + 80, my1 = from.y + 48
        const mx2 = to.x + 80, my2 = to.y
        const cy = (my1 + my2) / 2
        edges.push({
          path: `M ${mx1} ${my1} C ${mx1} ${cy}, ${mx2} ${cy}, ${mx2} ${my2}`,
        })
      }
    })
  })
  return edges
})

// ===== Styling Helpers =====
function getDagColor(status: Module['status']): string {
  switch (status) {
    case 'completed': return 'var(--lt-success)'
    case 'in_progress': return 'var(--lt-brand)'
    case 'locked': return '#B8B8C8'
    default: return '#FFFFFF'
  }
}

function getDagStroke(status: Module['status']): string {
  switch (status) {
    case 'completed': return 'var(--lt-success)'
    case 'in_progress': return 'var(--lt-brand)'
    case 'locked': return '#D0D0D8'
    default: return '#A0A0B0'
  }
}

function handleNodeClick(nodeId: string) {
    emit('node-click', nodeId)
    scrollToModule(nodeId)
}
</script>

<template>
  <div class="rounded-xl p-4" style="background: var(--lt-bg-card); border: 1px solid var(--lt-border);">
    <!-- 缩放控制按钮 -->
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2">
        <button 
          @click="zoomIn"
          class="px-2 py-1 text-xs rounded hover:opacity-80"
          style="background: var(--lt-bg-secondary); color: var(--lt-text-primary);"
          title="放大"
        >
          +
        </button>
        <button 
          @click="zoomOut"
          class="px-2 py-1 text-xs rounded hover:opacity-80"
          style="background: var(--lt-bg-secondary); color: var(--lt-text-primary);"
          title="缩小"
        >
          -
        </button>
        <button 
          @click="resetView"
          class="px-2 py-1 text-xs rounded hover:opacity-80"
          style="background: var(--lt-bg-secondary); color: var(--lt-text-primary);"
          title="重置视图"
        >
          ⌂
        </button>
        <span class="text-xs" style="color: var(--lt-text-auxiliary);">
          {{ Math.round(scale * 100) }}%
        </span>
      </div>
      <div class="text-xs" style="color: var(--lt-text-auxiliary);">
        滚轮缩放 · 拖拽平移
      </div>
    </div>
    
    <!-- SVG容器 -->
    <div 
      ref="svgContainer"
      class="overflow-hidden"
      style="cursor: grab;"
      :style="{ cursor: isDragging ? 'grabbing' : 'grab' }"
      @wheel="handleWheel"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseleave="handleMouseLeave"
    >
      <svg 
        :viewBox="`0 0 ${svgWidth} ${dagNodes.length > 0 ? Math.max(...dagNodes.map(n => n.y)) + 80 : 200}`" 
        class="w-full"
        style="max-height: 500px;"
        :style="{ transform: `scale(${scale}) translate(${translateX / scale}px, ${translateY / scale}px)` }"
      >
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#C8C8D0" />
        </marker>
      </defs>
      
      <path
        v-for="(edge, i) in dagEdges"
        :key="`edge-${i}`"
        :d="edge.path"
        fill="none"
        stroke="#C8C8D0"
        stroke-width="1.5"
        marker-end="url(#arrowhead)"
      />
      
      <g
        v-for="node in dagNodes"
        :key="node.id"
        :transform="`translate(${node.x}, ${node.y})`"
        style="cursor: pointer;"
        @click="handleNodeClick(node.id)"
      >
        <rect
          width="160" height="48" rx="8"
          :fill="node.status === 'in_progress' ? 'var(--lt-brand-lightest)' : 'white'"
          :stroke="getDagStroke(node.status)"
          stroke-width="2"
        />
        <circle cx="16" cy="24" r="6" :fill="getDagColor(node.status)" />
        <text x="28" y="29" font-size="12" fill="var(--lt-text-primary)" font-weight="500">
          {{ node.title }}
        </text>
      </g>
    </svg>
    </div>
    
    <!-- 图例 -->
    <div class="flex items-center gap-4 mt-3 text-xs" style="color: var(--lt-text-auxiliary);">
      <span><span class="inline-block w-3 h-3 rounded-full mr-1" style="background-color: var(--lt-success)"></span>已完成</span>
      <span><span class="inline-block w-3 h-3 rounded-full mr-1" style="background-color: var(--lt-brand)"></span>进行中</span>
      <span><span class="inline-block w-3 h-3 rounded border bg-white mr-1" style="border-color: #A0A0B0"></span>未开始</span>
      <span><span class="inline-block w-3 h-3 rounded-full mr-1" style="background-color: #B8B8C8"></span>锁定</span>
    </div>
  </div>
</template>
