/**
 * 触觉反馈工具
 * 在支持的设备上触发振动，不支持的设备静默无操作
 */

export function haptic(pattern: number | number[] = 10) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern) } catch { /* silent */ }
  }
}

/** 轻触反馈：10ms */
export const hapticLight = () => haptic(10)

/** 确认反馈：20ms */
export const hapticMedium = () => haptic(20)

/** 成功反馈：振动-停-振动 (10ms-50ms-10ms) */
export const hapticSuccess = () => haptic([10, 50, 10])
