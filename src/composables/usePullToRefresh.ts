import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue'

export type PullState = 'idle' | 'pulling' | 'refreshing'

export function usePullToRefresh(
  containerRef: Ref<HTMLElement | null>,
  onRefresh: () => Promise<void>,
  options?: { threshold?: number; maxPull?: number }
) {
  const { threshold = 60, maxPull = 100 } = options || {}

  const pullState = ref<PullState>('idle')
  const pullDistance = ref(0)

  let startY = 0
  let pulling = false

  function onTouchStart(e: TouchEvent) {
    const el = containerRef.value
    if (!el || pullState.value === 'refreshing') return
    // 仅在滚动到顶部时激活
    if (el.scrollTop > 0) return
    // 仅响应单指
    if (e.touches.length !== 1) return

    startY = e.touches[0].clientY
    pulling = true
  }

  function onTouchMove(e: TouchEvent) {
    if (!pulling || pullState.value === 'refreshing') return
    const el = containerRef.value
    if (!el) return

    const currentY = e.touches[0].clientY
    const diff = currentY - startY

    if (diff <= 0) {
      pullDistance.value = 0
      pullState.value = 'idle'
      return
    }

    // 弹性阻尼：下拉越远阻力越大
    const damped = Math.min(diff * 0.4, maxPull)
    pullDistance.value = damped
    pullState.value = damped >= threshold ? 'pulling' : 'pulling'
  }

  function onTouchEnd() {
    if (!pulling) return
    pulling = false

    if (pullDistance.value >= threshold && pullState.value !== 'refreshing') {
      pullState.value = 'refreshing'
      pullDistance.value = threshold
      onRefresh().finally(() => {
        pullState.value = 'idle'
        pullDistance.value = 0
      })
    } else {
      pullState.value = 'idle'
      pullDistance.value = 0
    }
  }

  function cleanup() {
    const el = containerRef.value
    if (!el) return
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchmove', onTouchMove)
    el.removeEventListener('touchend', onTouchEnd)
  }

  function setup() {
    const el = containerRef.value
    if (!el) return
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
  }

  onMounted(() => setup())
  onBeforeUnmount(() => cleanup())

  return { pullState, pullDistance, cleanup, setup }
}
