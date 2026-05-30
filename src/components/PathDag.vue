<script setup lang="ts">
import { computed } from 'vue'
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
  // ... (Topological sort and positioning logic remains the same)
  const inDegree: Record<string, number> = {}
  props.modules.forEach(m => { inDegree[m.moduleId] = 0 })
  props.modules.forEach(m => (m.prerequisites || []).forEach(p => {
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

  layers.forEach((layer, li) => {
    const totalW = layer.length * nodeWidth + (layer.length - 1) * hGap
    const startX = Math.max(0, (600 - totalW) / 2)
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
    <svg :viewBox="`0 0 600 ${dagNodes.length > 0 ? Math.max(...dagNodes.map(n => n.y)) + 80 : 200}`" class="w-full" style="max-height: 300px;">
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
    <div class="flex items-center gap-4 mt-3 text-xs" style="color: var(--lt-text-auxiliary);">
      <span><span class="inline-block w-3 h-3 rounded-full mr-1" style="background-color: var(--lt-success)"></span>已完成</span>
      <span><span class="inline-block w-3 h-3 rounded-full mr-1" style="background-color: var(--lt-brand)"></span>进行中</span>
      <span><span class="inline-block w-3 h-3 rounded border bg-white mr-1" style="border-color: #A0A0B0"></span>未开始</span>
      <span><span class="inline-block w-3 h-3 rounded-full mr-1" style="background-color: #B8B8C8"></span>锁定</span>
    </div>
  </div>
</template>
