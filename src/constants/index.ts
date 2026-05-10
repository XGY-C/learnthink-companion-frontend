// ===== 资源类型映射 =====

export const RESOURCE_TYPE_LABEL: Record<string, string> = {
  doc: '讲解文档',
  mindmap: '思维导图',
  quiz: '练习题',
  reading: '拓展阅读',
  code: '代码案例',
  video_script: '视频脚本',
}

export const RESOURCE_TYPE_TAG: Record<string, string> = {
  doc: 'primary',
  mindmap: 'warning',
  quiz: 'success',
  reading: 'info',
  code: 'danger',
  video_script: '',
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
