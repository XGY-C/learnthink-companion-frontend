<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  timeSpent: number
  isLastResource: boolean
  sourcesCount?: number
  qualityScore?: number
}>()

defineEmits<{
  continue: []
  review: []
}>()

function formatTimeSpent(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s} 秒`
  if (s === 0) return `${m} 分钟`
  return `${m} 分 ${s} 秒`
}
</script>

<template>
  <Transition name="complete-zone">
    <div v-if="visible" class="step-complete-zone">
      <!-- Sparkle particles -->
      <div class="scz-sparkles">
        <span v-for="i in 6" :key="i" class="scz-sparkle" :style="{
          left: `${15 + (i - 1) * 14}%`,
          animationDelay: `${(i - 1) * 0.12}s`,
          animationDuration: `${0.8 + Math.random() * 0.6}s`,
        }" />
      </div>

      <div class="complete-divider" />

      <div class="complete-content">
        <div class="complete-icon-ring">
          <div class="complete-icon">
            <span class="complete-check">✓</span>
          </div>
        </div>

        <p class="complete-text">本节完成</p>
        <p class="complete-time">用时 {{ formatTimeSpent(timeSpent) }}</p>

        <div v-if="(sourcesCount && sourcesCount > 0) || (qualityScore && qualityScore > 0)" class="complete-metrics">
          <span v-if="sourcesCount && sourcesCount > 0" class="complete-metric">📚 {{ sourcesCount }} 条引用</span>
          <span v-if="qualityScore && qualityScore > 0" class="complete-metric">⭐ 质量 {{ qualityScore }} 分</span>
        </div>

        <div class="complete-actions">
          <el-button type="primary" size="large" round @click="$emit('continue')">
            {{ isLastResource ? '完成学习 ✓' : '继续下一节 →' }}
          </el-button>
          <el-button text @click="$emit('review')">我有疑问</el-button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.step-complete-zone {
  padding: 32px 20px 16px;
  text-align: center;
  position: relative;
  overflow: hidden;
}

/* Sparkles */
.scz-sparkles {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  pointer-events: none;
}

.scz-sparkle {
  position: absolute;
  top: 20px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lt-brand);
  animation: sparkle-rise 1s ease-out both;
}

.scz-sparkle:nth-child(odd) {
  background: var(--lt-success);
}

.scz-sparkle:nth-child(3n) {
  background: var(--lt-ai);
  width: 4px;
  height: 4px;
}

@keyframes sparkle-rise {
  0% {
    opacity: 0;
    transform: translateY(20px) scale(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-8px) scale(1.2);
  }
  100% {
    opacity: 0;
    transform: translateY(-36px) scale(0.3);
  }
}

.complete-divider {
  height: 1px;
  background: linear-gradient(to right, transparent, var(--lt-border), transparent);
  margin-bottom: 24px;
}

.complete-content {
  animation: content-enter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes content-enter {
  from { opacity: 0; transform: scale(0.9) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

/* Animated icon ring */
.complete-icon-ring {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  margin: 0 auto 16px;
  padding: 3px;
  background: conic-gradient(var(--lt-success), var(--lt-brand), #34C759, var(--lt-success));
  animation: ring-rotate 3s linear infinite;
}

@keyframes ring-rotate {
  to { transform: rotate(360deg); }
}

.complete-icon {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: linear-gradient(135deg, #34C759, #30B350);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.3);
}

.complete-check {
  font-size: 32px;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}

.complete-text {
  font-size: 18px;
  font-weight: 700;
  color: var(--lt-text-primary);
  margin: 0 0 4px 0;
}

.complete-time {
  font-size: 14px;
  color: var(--lt-text-auxiliary);
  margin: 0 0 12px 0;
}

.complete-metrics {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 16px;
}

.complete-metric {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
}

.complete-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

/* Transition */
.complete-zone-enter-active {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.complete-zone-leave-active {
  transition: all 0.2s ease-in;
}
.complete-zone-enter-from {
  opacity: 0;
  transform: translateY(16px);
}
.complete-zone-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

@media (max-width: 767px) {
  .complete-actions {
    flex-direction: column;
  }

  .complete-icon-ring {
    width: 60px;
    height: 60px;
  }

  .complete-check {
    font-size: 26px;
  }
}
</style>
