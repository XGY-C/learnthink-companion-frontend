<script setup lang="ts">
/**
 * 通用 BottomSheet 组件
 * 移动端替代 el-dialog 的底部弹出面板
 * 三级高度：50vh / 70vh / 85vh
 * 支持拖拽关闭（向下拖动 >30% 或快速滑动）、向上拖动展开至下一档
 */
import { computed, ref, watch } from 'vue'
import { hapticLight, hapticMedium } from '@/utils/haptics'

type SheetLevel = 'medium' | 'large' | 'full'

const props = withDefaults(defineProps<{
  modelValue: boolean
  height?: SheetLevel
  title?: string
  showClose?: boolean
  dismissable?: boolean
}>(), {
  height: 'medium',
  title: '',
  showClose: true,
  dismissable: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'expand': [level: SheetLevel]
}>()

const heightMap: Record<SheetLevel, string> = { medium: '50vh', large: '70vh', full: '85vh' }
const order: SheetLevel[] = ['medium', 'large', 'full']

// 内部档位：可被向上拖动提升，打开时重置为 prop 初始值
const currentLevel = ref<SheetLevel>(props.height)
watch(() => props.modelValue, (open) => {
  if (open) {
    currentLevel.value = props.height
    dragOffset.value = 0
  }
})
watch(() => props.height, (h) => { currentLevel.value = h })

const sheetHeight = computed(() => heightMap[currentLevel.value])

// ===== 拖拽手势 =====
const sheetRef = ref<HTMLElement | null>(null)
const dragOffset = ref(0)        // px，正=向下拖
const dragging = ref(false)
let startY = 0
let lastY = 0
let lastTime = 0
let velocity = 0                 // px/ms，正=向下

function onDragStart(e: TouchEvent) {
  if (e.touches.length !== 1) return
  // 内容区未滚动到顶部时不拦截（让原生滚动优先）
  const el = sheetRef.value
  if (!el) return
  const body = el.querySelector('.btt-body') as HTMLElement | null
  if (body && body.scrollTop > 0) return

  dragging.value = true
  startY = e.touches[0].clientY
  lastY = startY
  lastTime = Date.now()
  velocity = 0
}

function onDragMove(e: TouchEvent) {
  if (!dragging.value) return
  const currentY = e.touches[0].clientY
  const diff = currentY - startY

  if (diff < 0) {
    // 向上拖：阻尼阻力，预览展开
    dragOffset.value = diff * 0.3
  } else {
    // 向下拖：1:1 跟手（轻微阻尼避免过快）
    dragOffset.value = diff * 0.85
  }

  const now = Date.now()
  const dt = now - lastTime
  if (dt > 0) velocity = (currentY - lastY) / dt
  lastY = currentY
  lastTime = now

  // 阻止底层滚动穿透
  if (e.cancelable) e.preventDefault()
}

function onDragEnd() {
  if (!dragging.value) return
  dragging.value = false

  const sheetEl = sheetRef.value
  const sheetH = sheetEl?.offsetHeight || window.innerHeight * 0.7
  const offset = dragOffset.value

  // 关闭：向下拖超过 30% 高度，或快速向下滑动
  if (offset > sheetH * 0.3 || (velocity > 0.5 && offset > 0)) {
    hapticLight()
    // 继续向下滑出后卸载
    dragOffset.value = window.innerHeight
    window.setTimeout(() => { close() }, 220)
    return
  }

  // 展开：向上拖超过阈值
  if (offset < -sheetH * 0.15) {
    const idx = order.indexOf(currentLevel.value)
    if (idx < order.length - 1) {
      currentLevel.value = order[idx + 1]
      hapticMedium()
      emit('expand', currentLevel.value)
    }
  }

  // 回弹
  dragOffset.value = 0
}

function close() {
  emit('update:modelValue', false)
}

function onScrimClick() {
  if (props.dismissable) close()
}

const sheetStyle = computed(() => ({
  height: sheetHeight.value,
  ...(dragOffset.value !== 0 ? { transform: `translateY(${dragOffset.value}px)` } : {}),
}))
</script>

<template>
  <Teleport to="body">
    <Transition name="btt">
      <div v-if="modelValue" class="btt-scrim" @click.self="onScrimClick">
        <div
          ref="sheetRef"
          class="btt-sheet"
          :class="{ dragging: dragging }"
          :style="sheetStyle"
        >
          <!-- 拖拽触发区：手柄 + 标题栏 -->
          <div
            class="btt-drag-zone"
            @touchstart="onDragStart"
            @touchmove="onDragMove"
            @touchend="onDragEnd"
            @touchcancel="onDragEnd"
          >
            <div class="btt-handle-bar">
              <div class="btt-handle" />
            </div>
            <div v-if="title || showClose" class="btt-header">
              <h3 class="btt-title">{{ title }}</h3>
              <button v-if="showClose" class="btt-close" @click="close" aria-label="关闭">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          <div class="btt-body">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.btt-scrim {
  position: fixed;
  inset: 0;
  z-index: var(--mobile-sheet-scrim-z-index, 999);
  background: var(--mobile-sheet-scrim, rgba(0, 0, 0, 0.4));
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.btt-sheet {
  width: 100%;
  background: var(--mobile-sheet-bg, var(--lt-bg-card));
  border-radius: var(--mobile-sheet-radius, 12px) var(--mobile-sheet-radius, 12px) 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: transform var(--mobile-sheet-animation-duration, 250ms) cubic-bezier(0.32, 0.72, 0, 1),
              height var(--mobile-sheet-animation-duration, 250ms) cubic-bezier(0.32, 0.72, 0, 1);
  will-change: transform;
}

.btt-sheet.dragging {
  transition: none;
}

.btt-drag-zone {
  flex-shrink: 0;
  touch-action: none;
}

.btt-handle-bar {
  display: flex;
  justify-content: center;
  padding: 8px 0 4px;
}

.btt-handle {
  width: var(--mobile-sheet-handle-width, 36px);
  height: var(--mobile-sheet-handle-height, 4px);
  border-radius: 2px;
  background: var(--mobile-sheet-handle-color, var(--lt-text-placeholder));
}

.btt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 12px;
}

.btt-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--lt-text-primary);
  margin: 0;
}

.btt-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  background: transparent;
  color: var(--lt-text-auxiliary);
  cursor: pointer;
  border-radius: 50%;
  touch-action: manipulation;
}

.btt-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0 16px 16px;
}

/* 进出场动画：scrim 渐隐 + sheet 上滑/下滑 */
.btt-enter-active { transition: opacity 0.25s ease-out; }
.btt-leave-active { transition: opacity 0.2s ease-in; }
.btt-enter-from { opacity: 0; }
.btt-leave-to { opacity: 0; }
.btt-enter-active .btt-sheet {
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}
.btt-leave-active .btt-sheet {
  transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}
.btt-enter-from .btt-sheet { transform: translateY(100%); }
.btt-leave-to .btt-sheet { transform: translateY(100%); }
</style>
