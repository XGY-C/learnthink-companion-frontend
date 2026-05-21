/**
 * 设备检测工具
 * 仅在应用初始化时调用，不响应浏览器窗口 resize
 */
export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
    || (window.innerWidth < 768 && 'ontouchstart' in window)
}
