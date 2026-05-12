import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TaskStage, TaskEvent, AgentThinkingTrace, AgentMessage, PlannerDecision } from '@/types'

export interface TaskEntry {
  taskId: string
  stage: TaskStage
  percent: number
  message: string
  events: TaskEvent[]
  thinkingTraces: AgentThinkingTrace[]
  agentMessages: AgentMessage[]
  plannerDecision: PlannerDecision | null
  resourceReady: { type: string; title: string; confidence: string; sources: number }[]
  packId: string | null
  isDone: boolean
  isFailed: boolean
}

export const useTaskStore = defineStore('task', () => {
  const taskMap = ref<Record<string, TaskEntry>>({})

  const activeTaskIds = computed(() =>
    Object.keys(taskMap.value).filter(id => !taskMap.value[id].isDone && !taskMap.value[id].isFailed)
  )

  function createTask(taskId: string) {
    taskMap.value[taskId] = {
      taskId,
      stage: 'profile',
      percent: 0,
      message: '任务已创建',
      events: [],
      thinkingTraces: [],
      agentMessages: [],
      plannerDecision: null,
      resourceReady: [],
      packId: null,
      isDone: false,
      isFailed: false,
    }
  }

  function updateTask(taskId: string, update: {
    stage?: TaskStage
    percent?: number
    message?: string
  }) {
    const task = taskMap.value[taskId]
    if (!task) return
    if (update.stage) task.stage = update.stage
    if (update.percent !== undefined) task.percent = update.percent
    if (update.message) task.message = update.message
    task.events.push({
      type: 'stage',
      data: update,
      timestamp: new Date().toISOString(),
    })
  }

  function addThinkingTrace(taskId: string, trace: AgentThinkingTrace) {
    const task = taskMap.value[taskId]
    if (!task) return
    task.thinkingTraces.push(trace)
    task.events.push({
      type: 'agent.thought',
      data: trace,
      timestamp: trace.timestamp,
    })
  }

  function addAgentMessage(taskId: string, msg: AgentMessage) {
    const task = taskMap.value[taskId]
    if (!task) return
    task.agentMessages.push(msg)
    task.events.push({
      type: 'agent.message',
      data: msg,
      timestamp: msg.timestamp,
    })
  }

  function setPlannerDecision(taskId: string, decision: PlannerDecision) {
    const task = taskMap.value[taskId]
    if (!task) return
    task.plannerDecision = decision
  }

  function addResourceReady(taskId: string, resource: { type: string; title: string; confidence: string; sources: number }) {
    const task = taskMap.value[taskId]
    if (!task) return
    task.resourceReady.push(resource)
    task.events.push({
      type: 'resource.ready',
      data: resource,
      timestamp: new Date().toISOString(),
    })
  }

  function completeTask(taskId: string, packId?: string) {
    const task = taskMap.value[taskId]
    if (task) {
      task.isDone = true
      task.percent = 100
      task.message = '任务完成'
      if (packId) task.packId = packId
      task.events.push({
        type: 'done',
        data: { packId },
        timestamp: new Date().toISOString(),
      })
    }
  }

  function failTask(taskId: string, error: string) {
    const task = taskMap.value[taskId]
    if (task) {
      task.isFailed = true
      task.message = error
      task.events.push({
        type: 'done',
        data: { error },
        timestamp: new Date().toISOString(),
      })
    }
  }

  function removeTask(taskId: string) {
    delete taskMap.value[taskId]
  }

  function getTask(taskId: string): TaskEntry | undefined {
    return taskMap.value[taskId]
  }

  return {
    taskMap, activeTaskIds,
    createTask, updateTask, completeTask, failTask, removeTask, getTask,
    addThinkingTrace, addAgentMessage, setPlannerDecision, addResourceReady,
  }
})
