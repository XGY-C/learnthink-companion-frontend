<template>
  <div
    class="resource-nav"
    :class="{ 'is-expanded': expanded, 'is-mobile': isMobile }"
  >
    <!-- 折叠态：圆点列 -->
    <div class="nav-dots">
      <div
        v-for="item in items"
        :key="item.index"
        class="nav-dot-wrap"
      >
        <div
           class="nav-dot"
           :class="{ 'is-active': item.index === activeIndex, 'is-done': item.status === 'completed' }"
           :style="dotStyle(item)"
           @click="emit('select', item.index)"
         >
           <span v-if="item.index === activeIndex" class="nav-dot-pulse" />
         </div>
         <span class="nav-dot-tip">{{ item.title || typeLabel(item.type) }}</span>
      </div>
      <!-- 展开/折叠把手 -->
      <div class="nav-toggle" @click="expanded = !expanded" :title="expanded ? '收起列表' : '展开列表'">
        <span class="nav-toggle-icon" :class="{ 'is-flipped': expanded }">›</span>
      </div>
    </div>

    <!-- 展开态：详情面板 -->
    <Transition name="nav-panel">
      <div v-if="expanded" class="nav-panel">
        <div class="nav-panel-header">
          学习资源
          <span class="nav-panel-close" @click="expanded = false">×</span>
        </div>
        <div class="nav-panel-list">
          <div
            v-for="item in items"
            :key="item.index"
             class="nav-panel-item"
             :class="{ 'is-active': item.index === activeIndex }"
             @click="emit('select', item.index)"
           >
             <span class="nav-item-icon">{{ typeIcon(item.type) }}</span>
             <div class="nav-item-info">
               <span class="nav-item-title">{{ item.title || `${typeLabel(item.type)}资源` }}</span>
               <span class="nav-item-meta">
                 {{ typeLabel(item.type) }}
                 <template v-if="item.estimatedMin"> · {{ item.estimatedMin }}min</template>
               </span>
             </div>
             <span
               class="nav-item-status"
              :style="{ color: item.status === 'completed' ? 'var(--lt-success)' : item.status === 'completing' ? 'var(--lt-brand)' : 'var(--lt-text-auxiliary)' }"
            >
              {{ item.status === 'completed' ? '✓' : item.status === 'completing' ? '✓' : item.status === 'active' ? '◐' : '○' }}
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
  status: 'pending' | 'loading' | 'ready' | 'generating' | 'viewed' | 'active' | 'completing' | 'completed'
  estimatedMin?: number
}

const props = defineProps<{
  items: NavItem[]
  activeIndex: number
  doneCount: number
  remainingMin: number
  isMobile?: boolean
}>()

const emit = defineEmits<{
  select: [index: number]
}>()

const expanded = ref(false)

function dotStyle(item: NavItem) {
  if (item.index === props.activeIndex) {
    return {
      background: 'var(--lt-brand)',
      boxShadow: '0 0 8px rgba(43,111,255,0.5)',
    }
  }
  if (item.status === 'completed') {
    return { background: 'var(--lt-success)' }
  }
  if (item.status === 'completing') {
    return { background: 'var(--lt-brand-lighter)' }
  }
  const color = TYPE_COLORS[item.type] || '#8E8EA0'
  return { background: color, opacity: 0.45 }
}

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

/* ── Dots ── */
.nav-dots {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px 10px;
  width: 36px;
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-full);
  box-shadow: var(--lt-shadow-card);
}

.nav-dot-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  position: relative;
}

.nav-dot:hover {
  transform: scale(1.6);
}

.nav-dot.is-active {
  width: 10px;
  height: 10px;
}

.nav-dot-pulse {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid var(--lt-brand);
  opacity: 0.4;
  animation: dot-pulse 2s ease-out infinite;
}

@keyframes dot-pulse {
  0% { transform: scale(1); opacity: 0.4; }
  100% { transform: scale(2.5); opacity: 0; }
}

/* Tooltip on hover */
.nav-dot-tip {
  position: absolute;
  right: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%);
  white-space: nowrap;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: var(--lt-radius-sm);
  background: var(--lt-text-primary);
  color: #fff;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
  z-index: 30;
}

.nav-dot-wrap:hover .nav-dot-tip {
  opacity: 1;
}

/* ── Toggle ── */
.nav-toggle {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 50%;
  transition: background 0.15s;
  margin-top: 2px;
}

.nav-toggle:hover {
  background: rgba(43, 111, 255, 0.08);
}

.nav-toggle-icon {
  font-size: 16px;
  color: var(--lt-text-auxiliary);
  font-weight: 700;
  transition: transform 0.25s ease;
  line-height: 1;
}

.nav-toggle-icon.is-flipped {
  transform: rotate(90deg);
}

/* ── Panel ── */
.nav-panel {
  position: absolute;
  right: 42px;
  top: 50%;
  transform: translateY(-50%);
  width: 260px;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--lt-text-secondary);
  border-bottom: 1px solid var(--lt-border);
  letter-spacing: 0.5px;
}

.nav-panel-close {
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  color: var(--lt-text-auxiliary);
  padding: 0 2px;
  transition: color 0.15s;
}

.nav-panel-close:hover {
  color: var(--lt-text-primary);
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

.nav-item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.nav-item-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--lt-text-primary);
  font-size: 13px;
}

.nav-item-meta {
  font-size: 11px;
  color: var(--lt-text-auxiliary);
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
.nav-panel-enter-active {
  transition: all 0.25s ease;
}
.nav-panel-leave-active {
  transition: all 0.18s ease;
}
.nav-panel-enter-from {
  opacity: 0;
  transform: translateY(-50%) translateX(8px);
}
.nav-panel-leave-to {
  opacity: 0;
  transform: translateY(-50%) translateX(4px);
}

/* Mobile */
.resource-nav.is-mobile {
  position: fixed;
  right: auto;
  top: auto;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
}

.resource-nav.is-mobile .nav-dots {
  flex-direction: row;
  gap: 6px;
  padding: 6px 14px;
  width: auto;
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-full);
  box-shadow: var(--lt-shadow-elevated);
}

.resource-nav.is-mobile .nav-dot {
  width: 6px;
  height: 6px;
}

.resource-nav.is-mobile .nav-dot-tip {
  display: none;
}

.resource-nav.is-mobile .nav-panel {
  right: auto;
  top: auto;
  bottom: 48px;
  left: 50%;
  transform: translateX(-50%);
  width: 300px;
  max-height: 40vh;
}

.resource-nav.is-mobile .nav-panel-enter-from,
.resource-nav.is-mobile .nav-panel-leave-to {
  transform: translateX(-50%) translateY(8px);
}

.resource-nav.is-mobile .nav-toggle {
  display: none;
}
</style>
