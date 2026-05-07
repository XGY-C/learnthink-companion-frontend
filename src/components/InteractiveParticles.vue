<template>
  <canvas ref="canvasRef" class="absolute inset-0 z-0 pointer-events-none" 
    :width="canvasWidth" :height="canvasHeight"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave">
  </canvas>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  particleCount?: number
  connectionDistance?: number
  particleColor?: string
  lineColor?: string
  mouseRadius?: number
  speed?: number
}>(), {
  particleCount: 60,
  connectionDistance: 120,
  particleColor: '43,111,255',   // --lt-brand RGB
  lineColor: '124,92,252',       // --lt-ai RGB
  mouseRadius: 150,
  speed: 0.3
})

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvasWidth = ref(window.innerWidth)
const canvasHeight = ref(window.innerHeight)

let ctx: CanvasRenderingContext2D | null = null
let animationId: number | null = null
let particles: Particle[] = []
let mouseX = -9999
let mouseY = -9999

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
}

const initParticles = () => {
  particles = []
  for (let i = 0; i < props.particleCount; i++) {
    particles.push({
      x: Math.random() * canvasWidth.value,
      y: Math.random() * canvasHeight.value,
      vx: (Math.random() - 0.5) * props.speed,
      vy: (Math.random() - 0.5) * props.speed,
      size: Math.random() * 2 + 1,
      alpha: Math.random() * 0.5 + 0.2
    })
  }
}

const drawParticle = (p: Particle) => {
  if (!ctx) return
  ctx.beginPath()
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(${props.particleColor}, ${p.alpha})`
  ctx.fill()
}

const drawConnections = () => {
  if (!ctx) return
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x
      const dy = particles[i].y - particles[j].y
      const dist = Math.sqrt(dx * dx + dy * dy)
      
      if (dist < props.connectionDistance) {
        const alpha = (1 - dist / props.connectionDistance) * 0.15
        ctx.beginPath()
        ctx.moveTo(particles[i].x, particles[i].y)
        ctx.lineTo(particles[j].x, particles[j].y)
        ctx.strokeStyle = `rgba(${props.lineColor}, ${alpha})`
        ctx.lineWidth = 0.5
        ctx.stroke()
      }
    }
  }
}

const drawMouseConnections = () => {
  if (!ctx || mouseX < 0 || mouseY < 0) return
  for (const p of particles) {
    const dx = p.x - mouseX
    const dy = p.y - mouseY
    const dist = Math.sqrt(dx * dx + dy * dy)
    
    if (dist < props.mouseRadius) {
      const alpha = (1 - dist / props.mouseRadius) * 0.4
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(mouseX, mouseY)
      ctx.strokeStyle = `rgba(${props.particleColor}, ${alpha})`
      ctx.lineWidth = 0.8
      ctx.stroke()
    }
  }
}

const animate = () => {
  if (!ctx || prefersReducedMotion) return
  
  ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value)
  
  for (const p of particles) {
    // 边界反弹
    if (p.x < 0 || p.x > canvasWidth.value) p.vx *= -1
    if (p.y < 0 || p.y > canvasHeight.value) p.vy *= -1
    
    // 鼠标推离效果（在鼠标周围产生轻微排斥）
    if (mouseX > 0 && mouseY > 0) {
      const dx = p.x - mouseX
      const dy = p.y - mouseY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < props.mouseRadius && dist > 0) {
        const force = (props.mouseRadius - dist) / props.mouseRadius * 0.08
        p.vx += (dx / dist) * force
        p.vy += (dy / dist) * force
      }
    }
    
    // 限制速度
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
    if (speed > props.speed * 2) {
      p.vx = (p.vx / speed) * props.speed * 2
      p.vy = (p.vy / speed) * props.speed * 2
    }
    
    p.x += p.vx
    p.y += p.vy
    
    drawParticle(p)
  }
  
  drawConnections()
  drawMouseConnections()
  
  animationId = requestAnimationFrame(animate)
}

const onMouseMove = (e: MouseEvent) => {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (rect) {
    mouseX = e.clientX - rect.left
    mouseY = e.clientY - rect.top
  }
}

const onMouseLeave = () => {
  mouseX = -9999
  mouseY = -9999
}

const handleResize = () => {
  canvasWidth.value = window.innerWidth
  canvasHeight.value = window.innerHeight
  initParticles()
}

let resizeTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  if (canvasRef.value) {
    ctx = canvasRef.value.getContext('2d')
  }
  canvasWidth.value = window.innerWidth
  canvasHeight.value = window.innerHeight
  initParticles()
  if (!prefersReducedMotion) {
    animate()
  }
  
  window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(handleResize, 200)
  })
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  if (resizeTimer) clearTimeout(resizeTimer)
})
</script>
