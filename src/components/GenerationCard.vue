<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = withDefaults(defineProps<{
  topic: string
  taskId: string
  taskType?: 'resource' | 'plan'
  status?: 'generating' | 'done' | 'failed'
  progress?: number
  resourceTypes?: string[]
  readyCount?: number
  totalCount?: number
  message?: string
  errorMessage?: string
}>(), {
  taskType: 'resource',
  status: 'generating',
  progress: 0,
  resourceTypes: () => [],
  readyCount: 0,
  totalCount: 0,
  message: '准备中...',
})

const router = useRouter()

const typeIcons: Record<string, string> = {
  doc: '📄', quiz: '📝', mindmap: '🧠', code: '💻', reading: '📚', video: '🎬',
}
const typeLabels: Record<string, string> = {
  doc: '讲解文档', quiz: '练习题', mindmap: '思维导图', code: '代码实操', reading: '拓展阅读', video: '讲解视频',
}

const resourceBadges = computed(() =>
  (props.resourceTypes || []).map(t => ({
    icon: typeIcons[t] || '📄',
    label: typeLabels[t] || t,
  }))
)

const statusLabel = computed(() => {
  switch (props.status) {
    case 'generating': return '生成中'
    case 'done': return '已就绪'
    case 'failed': return '失败'
  }
})
const statusColor = computed(() => {
  switch (props.status) {
    case 'generating': return 'var(--lt-brand)'
    case 'done': return 'var(--lt-success)'
    case 'failed': return 'var(--lt-danger)'
  }
})

const progressPercent = computed(() => Math.round(props.progress || 0))

const isPlan = computed(() => props.taskType === 'plan')

function handleClick() {
  if (isPlan.value) {
    router.push('/path')
  } else {
    router.push(`/studio/${props.taskId}`)
  }
}
</script>

<template>
  <div class="gen-card" :class="'gen-' + status" @click="handleClick">
    <!-- 头部：状态 + 时间 -->
    <div class="gen-header">
      <div class="flex items-center text-[13px] gen-header-status">
        <span class="flex items-center gap-1.5">
          <span class="status-dot" :class="'dot-' + status"></span>
          <span v-if="status === 'done'">{{ isPlan ? '学习计划已就绪' : '已完成资源生成' }}</span>
          <span v-else-if="status === 'failed'">{{ isPlan ? '计划生成失败' : '资源生成失败' }}</span>
          <span v-else>{{ isPlan ? '正在生成学习计划' : '正在生成资源包' }}</span>
        </span>
      </div>
      <div class="gen-header-right">
        <span class="gen-badge" :class="'badge-' + status">{{ statusLabel }}</span>
      </div>
    </div>

    <!-- 核心内容：左右布局 -->
    <div class="gen-content">
      <!-- 左侧信息 -->
      <div class="gen-info">
        <div class="gen-title">
          <div class="gen-title-icon">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <span class="gen-topic-text">{{ topic }}</span>
        </div>

        <!-- 资源类型标签 -->
        <div v-if="resourceBadges.length > 0" class="gen-tags">
          <span v-for="badge in resourceBadges" :key="badge.label" class="gen-tag">
            {{ badge.icon }} {{ badge.label }}
          </span>
        </div>

        <!-- 生成中：消息描述 -->
        <div v-if="status === 'generating'" class="gen-message">
          {{ message }} — {{ progressPercent }}%
        </div>
        <!-- 完成态：摘要 -->
        <div v-else-if="status === 'done'" class="gen-message gen-message-done">
          {{ isPlan ? '学习计划已生成，共 ' + (totalCount || '?') + ' 个模块，点击查看详情' : '已生成 ' + readyCount + '/' + (totalCount || resourceTypes.length) + ' 类资源，点击查看详情' }}
        </div>
        <!-- 失败态 -->
        <div v-else-if="status === 'failed'" class="gen-message gen-message-failed">
          {{ errorMessage || '生成失败，点击查看详情' }}
        </div>
      </div>

      <!-- 右侧预览/进度区 -->
      <div class="gen-preview" :class="'preview-' + status">
        <!-- 生成中：环形进度 + 动画 -->
        <template v-if="status === 'generating'">
          <div class="gen-ring">
            <svg viewBox="0 0 48 48" class="gen-ring-svg">
              <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="4" />
              <circle cx="24" cy="24" r="20" fill="none" stroke="white" stroke-width="4"
                stroke-linecap="round" stroke-dasharray="125.6"
                :stroke-dashoffset="125.6 - (progressPercent / 100) * 125.6"
                class="gen-ring-fill" />
            </svg>
            <span class="gen-ring-text">{{ progressPercent }}%</span>
          </div>
          <div class="gen-preview-label">生成进度</div>
        </template>
        <!-- 完成态：成功标记 -->
        <template v-else-if="status === 'done'">
          <div class="gen-status-icon gen-status-icon-done">
            <svg class="w-10 h-10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="gen-preview-label">准备就绪</div>
        </template>
        <!-- 失败态 -->
        <template v-else>
          <div class="gen-status-icon gen-status-icon-failed">
            <svg class="w-10 h-10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div class="gen-preview-label">生成异常</div>
        </template>
      </div>
    </div>

    <!-- 底部详情 -->
    <div class="gen-footer">
      <span class="inline-block mr-1" :style="{ color: statusColor }">●</span>
      <span v-if="status === 'generating'">{{ isPlan ? '四阶段流水线生成中：大计划 → 资源匹配 → 子计划 → 缺口生成' : '多智能体流水线正在生成学习资源：检索 → 规划 → 生成 → 审查' }}</span>
      <span v-else-if="status === 'done'">{{ isPlan ? '学习计划已就绪，前往学习路径开始学习' : '资源包已生成，前往工作室查看完整内容' }}</span>
      <span v-else>生成过程出现异常，点击查看详情或重新生成</span>
    </div>
  </div>
</template>

<style scoped>
.gen-card {
  margin: 8px 0;
  border-radius: 16px;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(4px);
  border: 1px solid var(--lt-border);
  cursor: pointer;
  transition: box-shadow 0.25s ease, transform 0.2s ease;
  overflow: hidden;
  user-select: none;
}
.gen-card:hover {
  box-shadow: 0 8px 24px -8px rgba(43,111,255,0.18);
  transform: translateY(-1px);
}

/* 头部 */
.gen-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 0;
}
.gen-header-status {
  color: var(--lt-text-secondary);
}
.gen-header-right {
  display: flex;
  align-items: center;
}
.gen-badge {
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 20px;
  font-weight: 500;
  line-height: 1.6;
}
.badge-generating {
  background: rgba(43,111,255,0.1);
  color: var(--lt-brand);
}
.badge-done {
  background: rgba(52,199,89,0.1);
  color: var(--lt-success);
}
.badge-failed {
  background: rgba(255,59,48,0.1);
  color: var(--lt-danger);
}

/* 状态指示点 */
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.dot-generating {
  background: var(--lt-brand);
  animation: pulse-dot 1.5s ease-in-out infinite;
  box-shadow: 0 0 6px rgba(43,111,255,0.4);
}
.dot-done {
  background: var(--lt-success);
  box-shadow: 0 0 6px rgba(52,199,89,0.3);
}
.dot-failed {
  background: var(--lt-danger);
  box-shadow: 0 0 6px rgba(255,59,48,0.3);
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 核心内容：左右布局 */
.gen-content {
  display: flex;
  align-items: stretch;
  padding: 12px 16px;
  gap: 16px;
}

/* 左侧信息 */
.gen-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.gen-title {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.gen-title-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--lt-brand-lightest);
  color: var(--lt-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.gen-topic-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--lt-text-primary);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 标签 */
.gen-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.gen-tag {
  font-size: 11px;
  font-weight: 500;
  color: var(--lt-text-secondary);
  background: var(--lt-bg-page);
  padding: 2px 8px;
  border-radius: 20px;
  transition: background 0.15s;
}
.gen-tag:hover {
  background: var(--lt-brand-lightest);
}

/* 消息 */
.gen-message {
  font-size: 13px;
  color: var(--lt-text-auxiliary);
  line-height: 1.4;
}
.gen-message-done {
  color: var(--lt-success);
}
.gen-message-failed {
  color: var(--lt-danger);
}

/* 右侧预览区 */
.gen-preview {
  width: 100px;
  min-height: 90px;
  border-radius: 12px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}
.gen-preview::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0.2;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cpath fill='none' stroke='white' stroke-width='0.3' d='M0 20h20M20 0l20 20M0 0l20 20'/%3E%3C/svg%3E");
  background-repeat: repeat;
  pointer-events: none;
}
.gen-preview::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.preview-generating {
  background: radial-gradient(circle at 30% 20%, #2d3b4f, #0b1120);
  box-shadow: 0 4px 14px -6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06);
}
.preview-generating::after {
  background: radial-gradient(ellipse at 70% 80%, rgba(99,102,241,0.15), transparent 60%);
}
.preview-done {
  background: radial-gradient(circle at 30% 20%, #0d7a5a, #064e3b);
  box-shadow: 0 4px 14px -6px rgba(5,150,105,0.35), inset 0 1px 0 rgba(255,255,255,0.08);
}
.preview-done::after {
  background: radial-gradient(ellipse at 70% 80%, rgba(52,199,89,0.2), transparent 60%);
}
.preview-failed {
  background: radial-gradient(circle at 30% 20%, #5c1a1a, #300a0a);
  box-shadow: 0 4px 14px -6px rgba(220,38,38,0.3), inset 0 1px 0 rgba(255,255,255,0.05);
}
.preview-failed::after {
  background: radial-gradient(ellipse at 70% 80%, rgba(255,59,48,0.15), transparent 60%);
}

/* 环形进度 */
.gen-ring {
  position: relative;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.gen-ring-svg {
  transform: rotate(-90deg);
  width: 48px;
  height: 48px;
}
.gen-ring-fill {
  transition: stroke-dashoffset 0.5s ease;
  filter: drop-shadow(0 0 6px rgba(255,255,255,0.3));
}
.gen-ring-text {
  position: absolute;
  font-size: 11px;
  font-weight: 700;
  color: white;
}
.preview-label, .gen-preview-label {
  font-size: 10px;
  font-weight: 500;
  color: rgba(255,255,255,0.7);
  letter-spacing: 0.3px;
}

/* 状态图标 */
.gen-status-icon {
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
}
.gen-status-icon-done {
  color: var(--lt-success);
  background: rgba(52,199,89,0.15);
}
.gen-status-icon-failed {
  color: var(--lt-danger);
  background: rgba(255,59,48,0.15);
}

/* 底部 */
.gen-footer {
  padding: 10px 16px 12px;
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  line-height: 1.5;
  border-top: 1px solid var(--lt-border);
  margin: 0 16px;
  padding-left: 0;
  padding-right: 0;
}
</style>
