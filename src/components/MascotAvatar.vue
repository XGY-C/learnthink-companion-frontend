<template>
  <div
    ref="containerRef"
    class="mascot-avatar"
    :class="{ 'is-clickable': clickable, 'is-loading': !loaded }"
    :style="containerStyle"
    @click="handleClick"
    v-html="svgContent"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'

type Mood = 'idle' | 'happy' | 'think' | 'wave' | 'talk'

const props = withDefaults(defineProps<{
  size?: number
  mood?: Mood
  autoplay?: boolean
  clickable?: boolean
  reducedMotion?: boolean
}>(), {
  size: 120,
  mood: 'idle',
  autoplay: true,
  clickable: false,
  reducedMotion: false
})

const emit = defineEmits<{
  click: []
}>()

const containerRef = ref<HTMLElement | null>(null)
const svgContent = ref('')
const loaded = ref(false)

let gsapTimeline: gsap.core.Timeline | null = null
let currentMood: Mood | null = null
let gsapModule: typeof gsap | null = null

const containerStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size * 1.5}px`
}))

const prefersReduced = computed(() =>
  props.reducedMotion ||
  (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
)

onMounted(async () => {
  try {
    const resp = await fetch('/assets/mascot.svg')
    svgContent.value = await resp.text()
    await nextTick()
    loaded.value = true
    if (props.autoplay && !prefersReduced.value) {
      await startAnimation(props.mood)
    }
  } catch {
    // SVG 加载失败时静默处理
  }
})

onUnmounted(() => {
  killAnimation()
})

watch(() => props.mood, async (m) => {
  if (loaded.value && !prefersReduced.value) {
    await startAnimation(m)
  }
})

async function initGsap() {
  if (gsapModule) return gsapModule
  try {
    const mod = await import('gsap')
    gsapModule = mod.default
    return gsapModule
  } catch {
    return null
  }
}

function initPivots(g: typeof gsap) {
  g.set('#arm-left-group',  { svgOrigin: '86 192' })
  g.set('#arm-right-group', { svgOrigin: '154 192' })
  g.set('#head-group',      { svgOrigin: '120 175' })
  g.set('#leg-left-group',  { svgOrigin: '107 265' })
  g.set('#leg-right-group', { svgOrigin: '133 265' })
  g.set('#antenna-ball',    { svgOrigin: '120 50' })
  g.set('#eye-left',        { transformOrigin: 'center' })
  g.set('#eye-right',       { transformOrigin: 'center' })
}

function resetPose(g: typeof gsap) {
  g.set('#arm-left-group',  { rotation: 0, svgOrigin: '86 192' })
  g.set('#arm-right-group', { rotation: 0, svgOrigin: '154 192' })
  g.set('#head-group',      { rotation: 0, svgOrigin: '120 175' })
  g.set('#leg-left-group',  { rotation: 0, svgOrigin: '107 265' })
  g.set('#leg-right-group', { rotation: 0, svgOrigin: '133 265' })
  g.set('#body-group',      { y: 0 })
  g.set('#pupil-left',      { x: 0, y: 0 })
  g.set('#pupil-right',     { x: 0, y: 0 })
  g.set('#eye-left',        { scaleY: 1, scaleX: 1 })
  g.set('#eye-right',       { scaleY: 1, scaleX: 1 })
  g.set('#antenna-ball',    { scale: 1, rotation: 0 })
  g.set('#antenna-glow',    { opacity: 0.12 })
  g.set('#mouth',           { attr: { d: 'M 112,131 Q 120,138 128,131' } })
}

function killAnimation() {
  if (gsapTimeline) {
    gsapTimeline.kill()
    gsapTimeline = null
  }
  if (gsapModule) {
    gsapModule.killTweensOf('*')
  }
  currentMood = null
}

async function startAnimation(mood: Mood) {
  if (prefersReduced.value) return

  const g = await initGsap()
  if (!g) return

  killAnimation()
  await nextTick()
  resetPose(g)
  initPivots(g)
  currentMood = mood

  switch (mood) {
    case 'happy': playHappy(g); break
    case 'think': playThink(g); break
    case 'wave': playWave(g); break
    case 'talk': playTalk(g); break
    default: playIdle(g); break
  }
}

function playIdle(g: typeof gsap) {
  gsapTimeline = g.timeline({ defaults: { ease: 'power1.inOut' }, repeat: -1 })
  gsapTimeline
    .to('#body-group',   { y: -2.5, duration: 1.6 })
    .to('#body-group',   { y: 0,    duration: 1.6 })
    .to('#eye-left',     { scaleY: 0.1, duration: 0.07, transformOrigin: 'center' })
    .to('#eye-right',    { scaleY: 0.1, duration: 0.07, transformOrigin: 'center' }, '<')
    .to('#eye-left',     { scaleY: 1,   duration: 0.07, transformOrigin: 'center' })
    .to('#eye-right',    { scaleY: 1,   duration: 0.07, transformOrigin: 'center' }, '<')
    .to('#antenna-glow', { opacity: 0.28, duration: 1.0 })
    .to('#antenna-glow', { opacity: 0.10, duration: 1.0 })
}

function playWave(g: typeof gsap) {
  gsapTimeline = g.timeline({ defaults: { ease: 'power2.inOut' } })
  gsapTimeline
    .to('#arm-right-group', { rotation: -50, duration: 0.25 })
    .to('#arm-right-group', { rotation: -30, duration: 0.15 })
    .to('#arm-right-group', { rotation: -50, duration: 0.15 })
    .to('#arm-right-group', { rotation: -30, duration: 0.15 })
    .to('#arm-right-group', { rotation: -50, duration: 0.15 })
    .to('#arm-right-group', { rotation: 0,    duration: 0.3 })
    .to('#head-group',      { rotation: 6,    duration: 0.2 }, '-=1.0')
    .to('#head-group',      { rotation: -3,   duration: 0.15 }, '-=0.5')
    .to('#head-group',      { rotation: 0,    duration: 0.2 })
    .to('#eye-left',        { scaleY: 0.1,    duration: 0.06, transformOrigin: 'center' }, '-=0.4')
    .to('#eye-right',       { scaleY: 0.1,    duration: 0.06, transformOrigin: 'center' }, '<')
    .to('#eye-left',        { scaleY: 1,      duration: 0.06, transformOrigin: 'center' })
    .to('#eye-right',       { scaleY: 1,      duration: 0.06, transformOrigin: 'center' }, '<')
}

function playThink(g: typeof gsap) {
  gsapTimeline = g.timeline({ defaults: { ease: 'power2.inOut' } })
  gsapTimeline
    .to('#head-group',     { rotation: 14, duration: 0.4 })
    .to('#arm-left-group', { rotation: 30, duration: 0.3 }, '-=0.2')
    .to('#pupil-left',     { x: -2, y: -3, duration: 0.3 }, '-=0.1')
    .to('#pupil-right',    { x: -2, y: -3, duration: 0.3 }, '<')
    .to('#antenna-ball',   { scale: 1.35,  duration: 0.25 })
    .to('#antenna-ball',   { scale: 0.85,  duration: 0.25 })
    .to('#antenna-ball',   { scale: 1.2,   duration: 0.25 })
    .to('#antenna-ball',   { scale: 1,     duration: 0.25 })
    .to('#head-group',     { rotation: 0,  duration: 0.4 }, '+=0.4')
    .to('#arm-left-group', { rotation: 0,  duration: 0.3 }, '-=0.2')
    .to('#pupil-left',     { x: 0, y: 0,   duration: 0.2 })
    .to('#pupil-right',    { x: 0, y: 0,   duration: 0.2 }, '<')
}

function playHappy(g: typeof gsap) {
  gsapTimeline = g.timeline({ defaults: { ease: 'power2.inOut' } })
  gsapTimeline
    .to('#mouth',            { attr: { d: 'M 108,129 Q 120,143 132,129' }, duration: 0.15 })
    .to(containerRef.value,  { y: -22, duration: 0.3, ease: 'power2.out' })
    .to(containerRef.value,  { y: 0,   duration: 0.35, ease: 'bounce.out' })
    .to('#arm-left-group',   { rotation: -35, duration: 0.2 }, '-=0.3')
    .to('#arm-right-group',  { rotation: 35,  duration: 0.2 }, '-=0.3')
    .to('#eye-left',         { scaleY: 0.1,   duration: 0.07, transformOrigin: 'center' })
    .to('#eye-right',        { scaleY: 0.1,   duration: 0.07, transformOrigin: 'center' }, '<')
    .to('#eye-left',         { scaleY: 1,     duration: 0.07, transformOrigin: 'center' })
    .to('#eye-right',        { scaleY: 1,     duration: 0.07, transformOrigin: 'center' }, '<')
    .to('#mouth',            { attr: { d: 'M 112,131 Q 120,138 128,131' }, duration: 0.3 }, '+=0.5')
    .to('#arm-left-group',   { rotation: 0,   duration: 0.3 })
    .to('#arm-right-group',  { rotation: 0,   duration: 0.3 }, '<')
}

function playTalk(g: typeof gsap) {
  gsapTimeline = g.timeline({ defaults: { ease: 'power1.inOut' }, repeat: 3, yoyo: true })
  gsapTimeline
    .to('#mouth',        { attr: { d: 'M 108,129 Q 120,143 132,129' }, duration: 0.12 })
    .to('#mouth',        { attr: { d: 'M 112,131 Q 120,138 128,131' }, duration: 0.12 })
    .to('#body-group',   { y: -1.5, duration: 0.12 }, 0)
    .to('#body-group',   { y: 0,    duration: 0.12 }, '-=0.06')
    .to('#antenna-glow', { opacity: 0.35, duration: 0.12 }, 0)
    .to('#antenna-glow', { opacity: 0.10, duration: 0.12 }, '-=0.06')
}

function handleClick() {
  if (props.clickable) emit('click')
}
</script>

<style scoped>
.mascot-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
  transition: opacity 0.3s ease;
}
.mascot-avatar :deep(svg) {
  width: 100%;
  height: 100%;
  overflow: visible;
}
.mascot-avatar.is-clickable {
  cursor: pointer;
}
.mascot-avatar.is-loading {
  opacity: 0;
}
</style>
