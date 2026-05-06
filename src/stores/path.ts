import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PathNode, PathAdjustment } from '@/types'

export const usePathStore = defineStore('path', () => {
  const nodes = ref<PathNode[]>([
    {
      id: 'n1', title: '图搜索算法基础：DFS 与 BFS',
      knowledgePoint: 'DFS/BFS', status: 'mastered',
      masteryEstimate: 95,
    },
    {
      id: 'n2', title: '启发式搜索：贪心与 Dijkstra',
      knowledgePoint: 'Dijkstra', status: 'mastered',
      masteryEstimate: 85,
    },
    {
      id: 'n3', title: 'A* 搜索算法详解',
      knowledgePoint: 'A* 搜索', status: 'in_progress',
      masteryEstimate: 45,
    },
    {
      id: 'n4', title: '进阶：A* 在寻路中的应用',
      knowledgePoint: 'A* 寻路', status: 'not_started',
      masteryEstimate: 0,
    },
  ])

  const version = ref('v1.0')
  const adjustments = ref<PathAdjustment[]>([])

  function addAdjustment(adj: PathAdjustment) {
    adjustments.value.unshift(adj)
  }

  function updateNodeStatus(nodeId: string, status: 'not_started' | 'in_progress' | 'mastered') {
    const node = nodes.value.find(n => n.id === nodeId)
    if (node) {
      node.status = status
    }
  }

  function updateMastery(nodeId: string, value: number) {
    const node = nodes.value.find(n => n.id === nodeId)
    if (node) {
      node.masteryEstimate = value
    }
  }

  function insertReviewNode(title: string, reason: string) {
    const newNode: PathNode = {
      id: 'review-' + Date.now(),
      title,
      knowledgePoint: title,
      status: 'not_started',
      masteryEstimate: 0,
    }
    // 插入到第一个未开始的节点之前
    const firstNotStarted = nodes.value.findIndex(n => n.status === 'not_started')
    if (firstNotStarted >= 0) {
      nodes.value.splice(firstNotStarted, 0, newNode)
    } else {
      nodes.value.push(newNode)
    }
    addAdjustment({
      id: 'adj-' + Date.now(),
      reason,
      type: 'insert',
      description: `插入复习节点：${title}`,
      timestamp: new Date().toISOString(),
    })
  }

  return {
    nodes, version, adjustments,
    addAdjustment, updateNodeStatus, updateMastery, insertReviewNode,
  }
})
