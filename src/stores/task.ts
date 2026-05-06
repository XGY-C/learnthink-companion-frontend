import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TaskStage, TaskEvent } from '@/types'

export const useTaskStore = defineStore('task', () => {
  const taskMap = ref<Record<string, {
    taskId: string
    stage: TaskStage
    percent: number
    message: string
    events: TaskEvent[]
    isDone: boolean
  }>>({})

  const activeTaskIds = computed(() =>
    Object.keys(taskMap.value).filter(id => !taskMap.value[id].isDone)
  )

  function createTask(taskId: string) {
    taskMap.value[taskId] = {
      taskId,
      stage: 'profile',
      percent: 0,
      message: '任务已创建',
      events: [],
      isDone: false,
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

  function completeTask(taskId: string) {
    const task = taskMap.value[taskId]
    if (task) {
      task.isDone = true
      task.percent = 100
      task.message = '任务完成'
      task.events.push({
        type: 'done',
        timestamp: new Date().toISOString(),
      })
    }
  }

  function removeTask(taskId: string) {
    delete taskMap.value[taskId]
  }

  function getTask(taskId: string) {
    return taskMap.value[taskId]
  }

  return {
    taskMap, activeTaskIds,
    createTask, updateTask, completeTask, removeTask, getTask,
  }
})
