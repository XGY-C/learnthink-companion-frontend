import { ref } from 'vue'

export type NavDirection = 'forward' | 'back' | 'tab'

/**
 * 当前导航方向，供 LayoutMobile 决定页面转场动画。
 * forward = 进入更深层级（新页从右滑入）
 * back    = 返回上层（当前页向右滑出）
 * tab     = TabBar 根页面切换（交叉淡入淡出）
 */
export const navDirection = ref<NavDirection>('forward')

const TAB_ROOTS = new Set(['/', '/chat', '/studio', '/profile'])
const stack: string[] = []

/**
 * 在 router.beforeEach 中调用，根据目标/来源路径推断方向。
 * 用路径栈判定 back：目标存在于栈中即为返回。
 */
export function recordNavigation(toPath: string, fromPath: string) {
  if (stack.length === 0) stack.push(fromPath)

  const toRoot = toPath.split('?')[0]
  const fromRoot = fromPath.split('?')[0]

  // TabBar 根页面之间切换：交叉淡入（用 path 部分判定，忽略 query）
  if (toRoot !== fromRoot && TAB_ROOTS.has(toRoot) && TAB_ROOTS.has(fromRoot)) {
    navDirection.value = 'tab'
    // 仍需更新栈，使从子页面返回 Tab 根时能正确判定为 back
    const existingIdx = stack.findIndex(s => s.split('?')[0] === toRoot)
    if (existingIdx !== -1) {
      stack.length = existingIdx + 1
    } else {
      stack.push(toPath)
    }
    return
  }

  // 返回导航：目标路径（忽略 query）存在于栈中即为返回
  const idx = stack.findIndex(s => s.split('?')[0] === toRoot)
  if (idx !== -1) {
    navDirection.value = 'back'
    stack.length = idx + 1
  } else {
    navDirection.value = 'forward'
    stack.push(toPath)
  }
}
