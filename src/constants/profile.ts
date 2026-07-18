/**
 * 画像展示常量集中管理
 *
 * 详见 docs/画像展示设计方案_v2.md §7.1。所有阈值与维度配置必须在本文件维护，
 * 禁止散落到各组件硬编码——避免视觉规格漂移。
 */

import type { ProfileDimensionKey, ProfileDimensionLayer } from '@/types'

/** 雷达图维度配置（7 维，与后端 DIM_LABELS 对齐） */
export interface RadarDim {
  key: ProfileDimensionKey
  label: string
  layer: ProfileDimensionLayer
  /**
   * 维度极性：
   *  - positive：confidence 越高越好（默认）
   *  - negative：confidence 高 = 系统很确信用户存在该问题（如 error_pattern）
   *               → 雷达图绘制时反转为 (1 - confidence) * 100，避免"得分高"的错觉
   *               → overallConfidence 计算时**不计入此维度**
   */
  polarity: 'positive' | 'negative'
}

export const RADAR_DIMS: readonly RadarDim[] = [
  { key: 'knowledge_basis',    label: '知识基础', layer: 'core',      polarity: 'positive' },
  { key: 'learning_goal',      label: '学习目标', layer: 'core',      polarity: 'positive' },
  { key: 'cognitive_style',    label: '认知风格', layer: 'style',     polarity: 'positive' },
  { key: 'learning_pace',      label: '学习节奏', layer: 'style',     polarity: 'positive' },
  { key: 'major_context',      label: '专业背景', layer: 'auxiliary', polarity: 'positive' },
  { key: 'interest_direction', label: '兴趣方向', layer: 'auxiliary', polarity: 'positive' },
  { key: 'error_pattern',      label: '错误模式', layer: 'auxiliary', polarity: 'negative' },
] as const

/** 标签级置信度档位（ConfidenceBadge 使用） */
export const BADGE_CONFIDENCE = {
  HIGH: 0.85,
  MEDIUM: 0.6,
} as const

/** 卡片级展示状态阈值（getDimDisplayState 使用） */
export const CARD_CONFIDENCE = {
  NORMAL: 0.6,
  INFERRED: 0.3,
} as const

/** 整体置信度低水位（isLowConfidence 使用） */
export const OVERALL_LOW_CONFIDENCE = 0.4

/**
 * mastery 关键词词表（resolveMastery 使用，仅作 fallback）
 *
 * 维护建议：
 *  - 新词条优先来自真实日志中误判的描述，避免"想当然"扩词
 *  - 新词必须配套至少 1 条 unit test
 */
export const MASTERY_KEYWORDS = {
  positive: ['掌握较好', '已经掌握', '熟练', '能独立', '扎实', '没问题', '比较熟悉', '理解透彻'],
  negative: ['薄弱', '不够', '模糊', '容易混淆', '不熟', '混淆', '记反', '遗漏', '出错', '错误', '不扎实', '搞不清'],
} as const

/** 名称匹配最短长度（短于此值要求完全相等，避免"图"误匹配"图论"） */
export const MIN_NAME_MATCH_LEN = 3

/** media_preference 字典 */
export const MEDIA_PREFERENCE_LABEL: Record<string, string> = {
  text: '图文优先',
  video: '视频优先',
  code: '代码优先',
  mixed: '混合呈现',
}

/** urgency 字典 */
export const URGENCY_LABEL: Record<string, string> = {
  intensive: '紧凑',
  normal: '正常',
  relaxed: '宽松',
}

/** example_density 字典 */
export const DENSITY_LABEL: Record<string, string> = {
  high: '高密度',
  medium: '中密度',
  low: '低密度',
}
