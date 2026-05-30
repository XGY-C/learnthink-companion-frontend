// ===== 资源类型映射 =====

export const RESOURCE_TYPE_LABEL: Record<string, string> = {
  doc: '讲解文档',
  mindmap: '思维导图',
  quiz: '练习题',
  reading: '拓展阅读',
  code: '代码案例',
  video: '讲解视频',
}

export const RESOURCE_TYPE_TAG: Record<string, string> = {
  doc: 'primary',
  mindmap: 'warning',
  quiz: 'success',
  reading: 'info',
  code: 'danger',
  video: 'danger',
}

// ===== 置信度映射 =====

export const CONFIDENCE_CONFIG: Record<string, { type: string; label: string }> = {
  high: { type: 'success', label: '高' },
  medium: { type: 'warning', label: '中' },
  low: { type: 'danger', label: '低' },
}

export function getConfidenceConfig(conf: unknown) {
  const key = conf as keyof typeof CONFIDENCE_CONFIG
  return CONFIDENCE_CONFIG[key] ?? CONFIDENCE_CONFIG.medium
}

// ===== 任务状态映射 =====

export const TASK_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  PENDING: { label: '等待中', color: 'var(--lt-text-auxiliary)', bgColor: 'var(--lt-bg-page)' },
  RUNNING: { label: '生成中', color: 'var(--lt-brand)', bgColor: 'rgba(43,111,255,0.06)' },
  SUCCEEDED: { label: '已完成', color: 'var(--lt-success)', bgColor: 'rgba(34,197,94,0.06)' },
  FAILED: { label: '失败', color: 'var(--lt-danger)', bgColor: 'rgba(239,68,68,0.06)' },
  CANCELLED: { label: '已取消', color: 'var(--lt-text-placeholder)', bgColor: 'var(--lt-bg-page)' },
}

export const TASK_STAGE_LABEL: Record<string, string> = {
  PROFILING: '分析画像',
  RETRIEVING: '检索证据',
  PLANNING: '规划方案',
  GENERATING: '生成资源',
  REVIEWING: '审校内容',
  PUBLISHING: '发布资源',
}

export function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return ''
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} 小时前`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay} 天前`
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} 周前`
  return new Date(isoString).toLocaleDateString('zh-CN')
}
