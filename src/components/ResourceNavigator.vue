<template>
  <div
    class="resource-nav"
    :class="{ 'is-expanded': expanded, 'is-mobile': isMobile }"
    @mouseenter="expanded = true"
    @mouseleave="expanded = false"
  >
    <!-- 折叠态：圆点 -->
    <div class="nav-dots">
      <div
        v-for="item in items"
        :key="item.index"
        class="nav-dot"
        :class="{ 'is-active': item.index === activeIndex, 'is-done': item.status === 'completed' }"
        :style="dotStyle(item)"
        :title="item.title"
        @click="$emit('select', item.index)"
      />
    </div>

    <!-- 展开态：详情面板 -->
    <Transition name="nav-panel">
      <div v-if="expanded" class="nav-panel">
        <div class="nav-panel-header">学习资源</div>
        <div class="nav-panel-list">
          <div
            v-for="item in items"
            :key="item.index"
            class="nav-panel-item"
            :class="{ 'is-active': item.index === activeIndex }"
            @click="$emit('select', item.index)"
          >
            <span class="nav-item-icon">{{ typeIcon(item.type) }}</span>
            <span class="nav-item-title">{{ item.title || `${typeLabel(item.type)}资源` }}</span>
            <span
              class="nav-item-status"
              :style="{ color: item.status === 'completed' ? 'var(--lt-success)' : 'var(--lt-text-auxiliary)' }"
            >
              {{ item.status === 'completed' ? '✓' : item.status === 'viewed' ? '◐' : '○' }}
            </span>
          </div>
        </div>
        <div class="nav-panel-footer">
          {{ doneCount }}/{{ items.length }} 已完成
          <template v-if="remainingMin > 0"> · 剩约 {{ remainingMin }}min</template>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

export interface NavItem {
  index: number
  type: string
  title: string
  status: 'pending' | 'loading' | 'ready' | 'viewed' | 'completed'
}

const props = defineProps<{
  items: NavItem[]
  activeIndex: number
  doneCount: number
  remainingMin: number
  isMobile?: boolean
}>()

defineEmits<{
  select: [index: number]
}>()

const expanded = ref(false)

const TYPE_COLORS: Record<string, string> = {
  doc: '#2B6FFF',
  reading: '#34C759',
  mindmap: '#7C5CFC',
  video: '#FF3B30',
  code: '#5A5A72',
  quiz: '#FF8C42',
}

const TYPE_ICONS: Record<string, string> = {
  doc: '\uD83D\uDCC4',
  reading: '\uD83D\uDCD6',
  mindmap: '\uD83E\uDDE0',
  video: '\uD83C\uDFAC',
  code: '\uD83D\uDCBB',
  quiz: '\uD83D\uDCDD',
}

const TYPE_LABELS: Record<string, string> = {
  doc: '文档',
  reading: '阅读',
  mindmap: '导图',
  video: '视频',
  code: '代码',
  quiz: '测验',
}

function typeIcon(type: string): string {
  return TYPE_ICONS[type] || '\uD83D\uDCC4'
}

function typeLabel(type: string): string {
  return TYPE_LABELS[type] || type
}

function dotStyle(item: NavItem) {
  const color = TYPE_COLORS[item.type] || '#8E8EA0'
  if (item.index === props.activeIndex) {
    return { background: 'var(--lt-brand)', boxShadow: '0 0 6px var(--lt-brand)' }
  }
  if (item.status === 'completed') {
    return { background: 'var(--lt-success)' }
  }
  return { background: color, opacity: 0.45 }
}
</script>

<style scoped>
.resource-nav {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
}

.nav-dots {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 12px 10px;
  width: 32px;
}

.nav-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.nav-dot:hover {
  transform: scale(1.5);
}

.nav-panel {
  position: absolute;
  right: 32px;
  top: 50%;
  transform: translateY(-50%);
  width: 210px;
  max-height: 60vh;
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-lg);
  box-shadow: var(--lt-shadow-elevated);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.nav-panel-header {
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--lt-text-secondary);
  border-bottom: 1px solid var(--lt-border);
  letter-spacing: 0.5px;
}

.nav-panel-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0;
}

.nav-panel-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  cursor: pointer;
  transition: background 0.15s;
  font-size: 13px;
}

.nav-panel-item:hover {
  background: var(--lt-brand-lightest);
}

.nav-panel-item.is-active {
  background: rgba(43, 111, 255, 0.08);
}

.nav-item-icon {
  flex-shrink: 0;
  font-size: 14px;
}

.nav-item-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--lt-text-primary);
}

.nav-item-status {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
}

.nav-panel-footer {
  padding: 8px 14px;
  font-size: 11px;
  color: var(--lt-text-auxiliary);
  border-top: 1px solid var(--lt-border);
}

/* Transition */
.nav-panel-enter-active,
.nav-panel-leave-active {
  transition: opacity 0.15s ease;
}
.nav-panel-enter-from,
.nav-panel-leave-to {
  opacity: 0;
}

/* Mobile */
.resource-nav.is-mobile {
  position: fixed;
  right: auto;
  top: auto;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-full);
  box-shadow: var(--lt-shadow-elevated);
  padding: 6px 16px;
  z-index: 20;
}

.resource-nav.is-mobile .nav-dots {
  flex-direction: row;
  gap: 8px;
  padding: 4px 0;
  width: auto;
}

.resource-nav.is-mobile .nav-dot {
  width: 6px;
  height: 6px;
}

.resource-nav.is-mobile .nav-panel {
  right: auto;
  top: auto;
  bottom: 48px;
  left: 50%;
  transform: translateX(-50%);
  width: 260px;
  max-height: 40vh;
}
</style>
