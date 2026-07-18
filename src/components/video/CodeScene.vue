<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue'
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

const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | null = null

async function copyCode() {
  try {
    await navigator.clipboard.writeText(rawCode)
    copied.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // fallback for older browsers
    const ta = document.createElement('textarea')
    ta.value = rawCode
    ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    copied.value = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copied.value = false }, 2000)
  }
}

const heading = props.content?.heading || ''
const rawCode: string = props.content?.code || ''
const highlightLines: number[] = props.content?.highlightLines || []
const output = props.content?.output || ''

onBeforeUnmount(() => {
  if (copyTimer) clearTimeout(copyTimer)
})

let codeLines = rawCode.split('\n')
// 防御性处理：LLM 可能输出 \\n 而非真正的换行符
if (codeLines.length <= 1 && rawCode.includes('\\n')) {
  codeLines = rawCode.split('\\n')
}

function calcDuration(): number {
  if (props.duration > 0) return props.duration
  const narrationLen = (props.narration || '').length
  const textBased = Math.max(narrationLen * 240, 4000)
  const codeBased = codeLines.length * 400 + (output ? 2000 : 0) + 1000
  return Math.max(textBased, codeBased, 5000)
}

const totalTime = calcDuration()
const lineDelay = Math.min(250, totalTime / (codeLines.length + 2))

const { virtualTime } = useSceneTimer(
  () => props.isPlaying,
  () => props.speed,
  totalTime,
  () => emit('complete'),
)

const showHeading = computed(() => virtualTime.value >= 100)
const visibleLineCount = computed(() => {
  const t = virtualTime.value - 300
  if (t <= 0) return 0
  return Math.min(codeLines.length, Math.floor(t / lineDelay) + 1)
})
const showOutput = computed(() => {
  if (!output) return false
  const outputDelay = 300 + codeLines.length * lineDelay + 300
  return virtualTime.value >= outputDelay
})
</script>

<template>
  <div class="code-scene">
    <div class="code-content">
      <h3 v-if="heading" class="scene-heading" :class="{ visible: showHeading }">{{ heading }}</h3>
      <div class="code-block">
        <div class="code-block-header">
          <span class="code-lang">{{ props.content?.language || 'plaintext' }}</span>
          <button class="copy-btn" :class="{ copied }" @click.stop="copyCode" :title="copied ? '已复制' : '复制代码'">
            <svg v-if="!copied" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>{{ copied ? '已复制' : '复制' }}</span>
          </button>
        </div>
        <div class="code-lines">
          <div v-for="(line, i) in codeLines" :key="i" class="code-line"
            :class="{ visible: i < visibleLineCount, highlighted: highlightLines.includes(i + 1) }">
            <span class="line-number">{{ i + 1 }}</span>
            <span class="line-text">{{ line }}</span>
          </div>
        </div>
      </div>
      <div v-if="output && showOutput" class="code-output"><span class="output-label">输出:</span> {{ output }}</div>
    </div>
  </div>
</template>

<style scoped>
.code-scene {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  background: #1e1e2e; overflow-y: auto;
  padding: 40px 60px;
}
.code-content { max-width: 800px; width: 100%; }
.scene-heading { font-size: 20px; font-weight: 600; color: #fff; margin: 0 0 16px; opacity: 0; transition: opacity 0.4s; }
.scene-heading.visible { opacity: 1; }
.code-block { background: #0d0d1a; border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.06); }
.code-block-header { padding: 8px 16px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between; }
.code-lang { font-size: 12px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.5px; }
.copy-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 10px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.4);
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}
.copy-btn:hover {
  background: rgba(255,255,255,0.1);
  color: #fff;
  border-color: rgba(255,255,255,0.2);
}
.copy-btn.copied {
  border-color: rgba(34, 197, 94, 0.3);
  color: #22c55e;
}
.code-lines { padding: 12px 0; overflow-x: auto; font-family: 'JetBrains Mono','Fira Code',monospace; font-size: 14px; }
.code-line { display: flex; padding: 2px 16px; opacity: 0; min-height: 22px; transition: opacity 0.1s; }
.code-line.visible { opacity: 1; }
.code-line.highlighted { background: rgba(255,140,66,0.1); border-left: 3px solid var(--lt-accent,#FF8C42); padding-left: 13px; }
.line-number { width: 36px; flex-shrink: 0; text-align: right; margin-right: 16px; color: rgba(255,255,255,0.2); font-size: 13px; user-select: none; }
.line-text { color: rgba(255,255,255,0.8); white-space: pre; }
.code-output { margin-top: 12px; padding: 10px 16px; background: rgba(0,0,0,0.3); border-radius: 8px; font-family: 'JetBrains Mono',monospace; font-size: 14px; color: rgba(255,255,255,0.6); animation: fade-in 0.3s ease-out; }
.output-label { color: rgba(255,255,255,0.3); margin-right: 8px; }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
</style>
