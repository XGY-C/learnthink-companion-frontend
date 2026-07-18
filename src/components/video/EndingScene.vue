<script setup lang="ts">
import { computed } from 'vue'
import type { PlaybackSpeed } from '@/types/scene'
import { useSceneTimer } from '@/composables/useSceneTimer'

const props = defineProps<{
  content: Record<string, any>
  isPlaying: boolean
  speed: PlaybackSpeed
  duration: number
  narration: string
}>()

const emit = defineEmits<{ complete: [] }>()

const resolvedDuration = props.duration > 0
  ? props.duration
  : 3000

const { virtualTime } = useSceneTimer(
  () => props.isPlaying,
  () => props.speed,
  resolvedDuration,
  () => emit('complete'),
)

const showRing = computed(() => virtualTime.value >= 100)
const showTitle = computed(() => virtualTime.value >= 400)
const showSubtitle = computed(() => virtualTime.value >= 900)

// Brand-color particles with varied properties
const PARTICLE_COLORS = ['#2B6FFF', '#FF8C42', '#7C5CFC', '#34C759', '#ffffff']
const particles = Array.from({ length: 16 }, (_, i) => ({
  left: 5 + Math.random() * 90,
  size: 2 + Math.random() * 5,
  color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
  delay: Math.random() * 4,
  duration: 3 + Math.random() * 5,
  glow: Math.random() > 0.6,
}))
</script>

<template>
  <div class="ending-scene">
    <!-- Decorative ring -->
    <div class="ending-ring" :class="{ visible: showRing }">
      <div class="ring-outer" />
      <div class="ring-inner" />
    </div>

    <!-- Particles -->
    <div class="ending-particles">
      <div
        v-for="(p, i) in particles"
        :key="i"
        class="particle"
        :class="{ glow: p.glow }"
        :style="{
          left: p.left + '%',
          width: p.size + 'px',
          height: p.size + 'px',
          background: p.color,
          animationDelay: p.delay + 's',
          animationDuration: p.duration + 's',
        }"
      />
    </div>

    <!-- Content -->
    <div class="ending-content">
      <h1 class="ending-title" :class="{ visible: showTitle }">
        {{ content?.title || '讲解结束' }}
      </h1>
      <p v-if="content?.subtitle" class="ending-subtitle" :class="{ visible: showSubtitle }">
        {{ content.subtitle }}
      </p>
      <p v-else class="ending-subtitle ending-hint" :class="{ visible: showSubtitle }">
        你可以返回聊天继续提问，或查看知识卡片回顾要点
      </p>
    </div>
  </div>
</template>

<style scoped>
.ending-scene {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #0d0d12 0%, #1a1a2e 40%, #16213e 100%);
  position: relative; overflow: hidden;
}

/* Decorative ring */
.ending-ring {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: opacity 1s ease-out;
}
.ending-ring.visible { opacity: 1; }
.ring-outer {
  width: 260px; height: 260px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.04);
  animation: ring-rotate 30s linear infinite;
}
.ring-inner {
  position: absolute; top: 30px; left: 30px;
  width: 200px; height: 200px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.03);
  animation: ring-rotate 20s linear infinite reverse;
}
@keyframes ring-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Particles */
.ending-particles { position: absolute; inset: 0; pointer-events: none; }
.particle {
  position: absolute; bottom: -20px;
  border-radius: 50%;
  animation: particle-up linear infinite;
}
.particle.glow {
  box-shadow: 0 0 6px currentColor;
}
@keyframes particle-up {
  0% { transform: translateY(0) scale(1); opacity: 0; }
  15% { opacity: 0.7; }
  50% { transform: translateY(-50vh) scale(1.3); opacity: 0.4; }
  100% { transform: translateY(-110vh) scale(0.6); opacity: 0; }
}

/* Content */
.ending-content { text-align: center; z-index: 1; }
.ending-title {
  font-size: 42px; font-weight: 700; color: #fff; margin: 0 0 12px;
  opacity: 0; transform: translateY(20px);
  transition: all 0.8s cubic-bezier(0.2, 0, 0, 1);
  text-shadow: 0 0 40px rgba(124, 92, 252, 0.3);
}
.ending-title.visible { opacity: 1; transform: translateY(0); }
.ending-subtitle {
  font-size: 16px; color: rgba(255,255,255,0.45); margin: 0;
  opacity: 0; transform: translateY(10px);
  transition: all 0.6s 0.3s cubic-bezier(0.2, 0, 0, 1);
}
.ending-subtitle.visible { opacity: 1; transform: translateY(0); }
.ending-hint { font-style: italic; }
</style>
