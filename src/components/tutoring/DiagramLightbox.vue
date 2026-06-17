<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import DOMPurify from 'dompurify'
import type { DiagramState } from '@/types/tutoring'

const props = defineProps<{
  visible: boolean
  diagram: DiagramState | null
}>()

const emit = defineEmits<{
  close: []
}>()

const scale = ref(1)
const offsetX = ref(0)
const offsetY = ref(0)
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const dragOffsetStartX = ref(0)
const dragOffsetStartY = ref(0)

function zoomIn() { scale.value = Math.min(scale.value + 0.25, 3) }
function zoomOut() { scale.value = Math.max(scale.value - 0.25, 0.5) }
function zoomReset() { scale.value = 1; offsetX.value = 0; offsetY.value = 0 }

function onMouseDown(e: MouseEvent) {
  if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement) return
  isDragging.value = true
  dragStartX.value = e.clientX
  dragStartY.value = e.clientY
  dragOffsetStartX.value = offsetX.value
  dragOffsetStartY.value = offsetY.value
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  offsetX.value = dragOffsetStartX.value + (e.clientX - dragStartX.value)
  offsetY.value = dragOffsetStartY.value + (e.clientY - dragStartY.value)
}

function onMouseUp() {
  isDragging.value = false
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  scale.value = Math.max(0.5, Math.min(3, scale.value + delta))
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

// Reset state when opened
watch(() => props.visible, (v) => {
  if (v) {
    scale.value = 1
    offsetX.value = 0
    offsetY.value = 0
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="lightbox">
      <div v-if="visible" class="lightbox-backdrop" @click.self="emit('close')">
        <div class="lightbox-container">
          <div class="lightbox-header">
            <span class="lightbox-title">{{ diagram?.spec?.description || '图解' }}</span>
            <button class="lightbox-close" @click="emit('close')">✕</button>
          </div>

          <div
            class="lightbox-content"
            @mousedown="onMouseDown"
            @mousemove="onMouseMove"
            @mouseup="onMouseUp"
            @mouseleave="onMouseUp"
            @wheel="onWheel"
          >
            <div
              class="lightbox-inner"
              :style="{
                transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
                cursor: isDragging ? 'grabbing' : 'grab',
              }"
            >
              <img
                v-if="diagram?.url && diagram?.tool === 'image_model'"
                :src="diagram.url"
                :alt="diagram.spec?.description"
                class="lightbox-img"
              />
              <div
                v-else-if="diagram?.url && diagram?.tool === 'svg_direct'"
                v-html="diagram.url"
                class="lightbox-svg"
              />
            </div>
          </div>

          <div class="lightbox-toolbar">
            <button @click="zoomOut">🔍 缩小</button>
            <button @click="zoomIn">🔍 放大</button>
            <button @click="zoomReset">↺ 复位</button>
            <span class="toolbar-scale">{{ Math.round(scale * 100) }}%</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.lightbox-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lightbox-container {
  background: var(--lt-bg-card);
  border-radius: 16px;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.3);
}

.lightbox-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--lt-border);
}

.lightbox-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--lt-text-primary);
}

.lightbox-close {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--lt-text-auxiliary);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.15s;
}
.lightbox-close:hover { color: var(--lt-text-primary); background: var(--lt-bg-page); }

.lightbox-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  min-height: 200px;
}

.lightbox-inner {
  transition: transform 0.1s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lightbox-img {
  max-width: 85vw;
  max-height: 70vh;
  object-fit: contain;
  user-select: none;
}

.lightbox-svg {
  max-width: 85vw;
  max-height: 70vh;
  overflow: auto;
}
.lightbox-svg :deep(svg) { max-width: 100%; height: auto; }

.lightbox-toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 20px;
  border-top: 1px solid var(--lt-border);
  background: var(--lt-bg-page);
}

.lightbox-toolbar button {
  font-size: 12px;
  color: var(--lt-text-secondary);
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.lightbox-toolbar button:hover {
  color: var(--lt-brand);
  border-color: var(--lt-brand);
  background: var(--lt-brand-lightest);
}

.toolbar-scale {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  min-width: 40px;
  text-align: center;
}

/* 过渡动画 */
.lightbox-enter-active { transition: opacity 200ms ease; }
.lightbox-leave-active { transition: opacity 150ms ease; }
.lightbox-enter-from,
.lightbox-leave-to { opacity: 0; }

@media (max-width: 768px) {
  .lightbox-container { max-width: 96vw; max-height: 96vh; border-radius: 12px; }
  .lightbox-header { padding: 10px 14px; }
  .lightbox-content { padding: 12px; }
  .lightbox-toolbar { gap: 6px; padding: 8px 12px; }
  .lightbox-toolbar button { padding: 4px 8px; font-size: 11px; }
}
</style>
