import type { Module } from '@/types'

export function typeIcon(type: string): string {
  switch (type) {
    case 'learn': return '📖'
    case 'quiz': return '📝'
    case 'explore': return '📎'
    default: return '📄'
  }
}

export function typeColor(type: string): string {
  switch (type) {
    case 'learn': return 'var(--lt-brand)'
    case 'quiz': return 'var(--lt-orange)'
    case 'explore': return 'var(--lt-text-auxiliary)'
    default: return 'var(--lt-text-secondary)'
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'completed': return '已完成'
    case 'in_progress': return '进行中'
    case 'locked': return '锁定'
    case 'ready': return '未开始'
    case 'failed': return '未达标'
    case 'skipped': return '已跳过'
    default: return status
  }
}

export function moduleStatusLabel(status: Module['status']): string {
  switch (status) {
    case 'completed': return '已完成'
    case 'in_progress': return '进行中'
    case 'locked': return '🔒 锁定'
    case 'ready': return '未开始'
    default: return '未知'
  }
}

export function scopeLabel(scope: string): string {
  switch (scope) {
    case 'core_curriculum': return '核心'
    case 'supplementary': return '补充'
    case 'extracurricular': return '拓展'
    default: return scope
  }
}

export function depthLabel(depth: string): string {
  switch (depth) {
    case 'basic': return '概览'
    case 'standard': return '标准'
    case 'deep': return '深入'
    default: return depth
  }
}

export function scopeTagClass(scope: string): string {
  switch (scope) {
    case 'core_curriculum': return 'tag-core'
    case 'supplementary': return 'tag-sup'
    case 'extracurricular': return 'tag-ext'
    default: return 'tag-core'
  }
}

export function depthTagClass(depth: string): string {
  switch (depth) {
    case 'basic': return 'tag-basic'
    case 'standard': return 'tag-std'
    case 'deep': return 'tag-deep'
    default: return 'tag-basic'
  }
}

export function formatTimeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 0) return '刚刚'
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

export function lockModeLabel(mode: string): string {
  return mode === 'free' ? '自由学习' : '按顺序解锁'
}
