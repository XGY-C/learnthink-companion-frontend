<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import confetti from 'canvas-confetti'

const props = defineProps<{
  totalResources: number
  totalTimeSeconds: number
  estimatedMinutes: number
  hasNextActivity: boolean
}>()

defineEmits<{
  backToPath: []
  nextActivity: []
}>()

const router = useRouter()

const isEfficient = computed(() => {
  const actualMin = props.totalTimeSeconds / 60
  return actualMin < props.estimatedMinutes * 0.5
})

const tipMessage = computed(() => {
  if (isEfficient.value) return '学习效率很高！可以趁热打铁，在资源库中探索更多相关内容。'
  if (props.totalResources > 5) return '内容很充实，建议稍作休息后回顾知识导图巩固记忆。'
  return '完成学习！可以去资源库查看同类资源，或通过对话让 AI 帮你生成更多练习。'
})

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s} 秒`
  if (s === 0) return `${m} 分钟`
  return `${m} 分 ${s} 秒`
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

onMounted(() => {
  if (prefersReducedMotion) return
  const defaults = { startVelocity: 28, spread: 360, ticks: 60, zIndex: 100 }
  const colors = ['#2B6FFF', '#FF8C42', '#7C5CFC', '#34C759', '#FFD700', '#FF3B30']

  confetti({ ...defaults, particleCount: 60, colors, origin: { x: 0.3, y: 0.5 } })
  confetti({ ...defaults, particleCount: 60, colors, origin: { x: 0.7, y: 0.5 } })

  setTimeout(() => {
    confetti({ ...defaults, particleCount: 30, colors, origin: { x: 0.5, y: 0.2 }, startVelocity: 20 })
    confetti({ ...defaults, particleCount: 20, colors, origin: { x: 0.2, y: 0.4 }, spread: 90 })
    confetti({ ...defaults, particleCount: 20, colors, origin: { x: 0.8, y: 0.4 }, spread: 90 })
  }, 300)

  setTimeout(() => {
    confetti({ ...defaults, particleCount: 40, colors, origin: { x: 0.5, y: 0.3 }, spread: 120 })
  }, 600)
})
</script>

<template>
  <div class="aceleb-root">
    <!-- Animated icon -->
    <div class="aceleb-icon-ring">
      <div class="aceleb-icon-inner">
        <span class="aceleb-check">✓</span>
      </div>
    </div>

    <h2 class="aceleb-title">学习完成！</h2>
    <p class="aceleb-subtitle">你已完成本活动的全部学习内容</p>

    <!-- Stat cards -->
    <div class="aceleb-stats">
      <div class="aceleb-stat">
        <span class="as-value">{{ totalResources }}</span>
        <span class="as-label">完成资源</span>
      </div>
      <div class="aceleb-stat-divider" />
      <div class="aceleb-stat">
        <span class="as-value">{{ formatTime(totalTimeSeconds) }}</span>
        <span class="as-label">学习用时</span>
      </div>
      <div class="aceleb-stat-divider" />
      <div class="aceleb-stat">
        <span class="as-value">{{ estimatedMinutes }}<span class="as-unit">min</span></span>
        <span class="as-label">预计时长</span>
      </div>
    </div>

    <el-tag v-if="isEfficient" type="success" size="small" effect="light" class="aceleb-badge">
      ⚡ 高效完成
    </el-tag>

    <!-- Tip -->
    <div class="aceleb-tip">
      <p class="aceleb-tip-text">💡 {{ tipMessage }}</p>
      <div class="aceleb-tip-links">
        <el-button size="small" text type="primary" @click="router.push('/library')">浏览资源库 →</el-button>
        <el-button size="small" text type="primary" @click="router.push('/chat')">AI 对话继续学习 →</el-button>
      </div>
    </div>

    <!-- Actions -->
    <div class="aceleb-actions">
      <el-button size="large" round @click="$emit('backToPath')">返回路径</el-button>
      <el-button v-if="hasNextActivity" type="primary" size="large" round @click="$emit('nextActivity')">
        下一个活动 →
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.aceleb-root {
  text-align: center;
  padding: 56px 24px 48px;
  animation: aceleb-enter 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  position: relative;
  overflow: hidden;
}

@keyframes aceleb-enter {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Icon ring ── */
.aceleb-icon-ring {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  margin: 0 auto 28px;
  background: conic-gradient(var(--lt-success), var(--lt-brand), var(--lt-ai), #34C759, var(--lt-success));
  animation: ring-rotate 3s linear infinite;
  padding: 3px;
  position: relative;
  z-index: 1;
}

@keyframes ring-rotate {
  to { transform: rotate(360deg); }
}

.aceleb-icon-inner {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: linear-gradient(135deg, #34C759 0%, #30B350 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 2px 0 rgba(255,255,255,0.3);
  animation: icon-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both;
}

@keyframes icon-pop {
  0% { transform: scale(0); }
  70% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

.aceleb-check {
  font-size: 44px;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}

/* ── Title ── */
.aceleb-title {
  font-size: 28px;
  font-weight: 800;
  color: var(--lt-text-primary);
  margin: 0 0 8px 0;
  letter-spacing: -0.02em;
  position: relative;
  z-index: 1;
}

.aceleb-subtitle {
  font-size: 14px;
  color: var(--lt-text-auxiliary);
  margin: 0 0 28px 0;
  position: relative;
  z-index: 1;
}

/* ── Stats ── */
.aceleb-stats {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 24px;
  margin-bottom: 20px;
  position: relative;
  z-index: 1;
}

.aceleb-stat {
  text-align: center;
  min-width: 90px;
}

.aceleb-stat-divider {
  width: 1px;
  height: 32px;
  background: var(--lt-border);
}

.as-value {
  display: block;
  font-size: 26px;
  font-weight: 800;
  color: var(--lt-text-primary);
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.as-unit {
  font-size: 15px;
  font-weight: 600;
  color: var(--lt-text-auxiliary);
  margin-left: 2px;
}

.as-label {
  display: block;
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  margin-top: 4px;
}

.aceleb-badge {
  margin-bottom: 20px;
  position: relative;
  z-index: 1;
}

/* ── Tip ── */
.aceleb-tip {
  margin: 20px auto 28px;
  padding: 16px 20px;
  background: rgba(43, 111, 255, 0.04);
  border: 1px solid var(--lt-brand-lighter);
  border-radius: var(--lt-radius-lg);
  max-width: 440px;
  position: relative;
  z-index: 1;
}

.aceleb-tip-text {
  font-size: 13px;
  color: var(--lt-text-secondary);
  margin: 0 0 10px 0;
  line-height: 1.6;
}

.aceleb-tip-links {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}

/* ── Actions ── */
.aceleb-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  position: relative;
  z-index: 1;
}

@media (max-width: 767px) {
  .aceleb-root {
    padding: 40px 16px 32px;
  }

  .aceleb-icon-ring {
    width: 76px;
    height: 76px;
  }

  .aceleb-check {
    font-size: 34px;
  }

  .aceleb-title {
    font-size: 22px;
  }

  .aceleb-stats {
    gap: 14px;
  }

  .aceleb-stat {
    min-width: 70px;
  }

  .as-value {
    font-size: 22px;
  }

  .aceleb-actions {
    flex-direction: column;
  }
}
</style>
