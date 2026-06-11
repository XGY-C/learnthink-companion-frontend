<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PlaybackSpeed, SceneStep } from '@/types/scene'
import { useSceneTimer } from '@/composables/useSceneTimer'

const props = defineProps<{
  content: Record<string, any>
  isPlaying: boolean
  speed: PlaybackSpeed
  duration: number
  narration: string
  steps?: SceneStep[]
}>()

const emit = defineEmits<{ complete: [] }>()

const heading = props.content?.heading || ''
const paragraphs: string[] = props.content?.paragraphs || []
const bullets: string[] = props.content?.bullets || []
const formula = props.content?.formula || ''

const resolvedDuration = props.duration > 0
  ? props.duration
  : Math.max((props.narration || '').length * 240, 5000)

// Evenly-distributed timing for structural elements (independent from TTS sentence steps)
const totalEls = (heading ? 1 : 0) + paragraphs.length + bullets.length + (formula ? 1 : 0)
const interval = resolvedDuration / Math.max(totalEls + 1, 2)
const timings: number[] = []
for (let i = 0; i < totalEls; i++) timings.push(interval * (i + 1) * 0.7)

const { virtualTime } = useSceneTimer(
  () => props.isPlaying,
  () => props.speed,
  resolvedDuration,
  () => emit('complete'),
)

const headingThreshold = heading ? (timings[0] || 300) : -1
const paraThresholds = paragraphs.map((_, i) => timings[(heading ? 1 : 0) + i] || 800)
const bulletThresholds = bullets.map((_, i) => timings[(heading ? 1 : 0) + paragraphs.length + i] || 600)
const formulaThreshold = formula ? timings[(heading ? 1 : 0) + paragraphs.length + bullets.length] || 600 : -1

const showHeading2 = computed(() => headingThreshold >= 0 && virtualTime.value >= headingThreshold)
const showParagraphsArr = computed(() => paraThresholds.map(t => virtualTime.value >= t))
const showBulletsArr = computed(() => bulletThresholds.map(t => virtualTime.value >= t))
const showFormula2 = computed(() => formulaThreshold >= 0 && virtualTime.value >= formulaThreshold)

// Formula popover
const showFormulaDetail = ref(false)

function toggleFormulaDetail() {
  showFormulaDetail.value = !showFormulaDetail.value
}

function closeFormulaDetail() {
  showFormulaDetail.value = false
}

async function copyFormulaSource() {
  try {
    await navigator.clipboard.writeText(formula)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = formula
    ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}
</script>

<template>
  <div class="text-scene">
    <div class="text-content">
      <h3 v-if="heading" class="scene-heading" :class="{ visible: showHeading2 }">{{ heading }}</h3>
      <div v-for="(p, i) in paragraphs" :key="'p'+i" class="scene-paragraph" :class="{ visible: showParagraphsArr[i] }">{{ p }}</div>
      <ul v-if="bullets.length" class="scene-bullets">
        <li v-for="(b, i) in bullets" :key="'b'+i" :class="{ visible: showBulletsArr[i] }">{{ b }}</li>
      </ul>
      <div v-if="formula" class="scene-formula" :class="{ visible: showFormula2 }" @click.stop="toggleFormulaDetail" title="点击查看 LaTeX 源码">
        <span class="formula-text">{{ formula }}</span>
        <span class="formula-badge">LaTeX</span>
      </div>
    </div>

    <!-- Formula detail popover -->
    <Teleport to="body">
      <div v-if="showFormulaDetail" class="formula-overlay" @click="closeFormulaDetail">
        <div class="formula-popover" @click.stop>
          <div class="formula-popover-header">
            <span>LaTeX 源码</span>
            <button class="formula-popover-close" @click="closeFormulaDetail">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <pre class="formula-latex">{{ formula }}</pre>
          <div class="formula-popover-footer">
            <button class="formula-copy-btn" @click="copyFormulaSource">复制源码</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.text-scene { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #0f0f13; overflow-y: auto; padding: 60px 80px; }
.text-content { max-width: 70ch; width: 100%; }
.scene-heading { font-size: 22px; font-weight: 600; color: #fff; margin: 0 0 24px; opacity: 0; transform: translateY(12px); transition: all 0.5s cubic-bezier(0.2,0,0,1); }
.scene-heading.visible { opacity: 1; transform: translateY(0); }
.scene-paragraph { font-size: 16px; line-height: 1.8; color: rgba(255,255,255,0.85); margin-bottom: 12px; opacity: 0; transform: translateY(8px); transition: all 0.4s cubic-bezier(0.2,0,0,1); }
.scene-paragraph.visible { opacity: 1; transform: translateY(0); }
.scene-bullets { list-style: none; padding: 0; margin: 16px 0; }
.scene-bullets li { font-size: 15px; line-height: 1.7; color: rgba(255,255,255,0.8); padding: 4px 0 4px 20px; position: relative; opacity: 0; transform: translateX(-8px); transition: all 0.35s cubic-bezier(0.2,0,0,1); }
.scene-bullets li::before { content: ''; position: absolute; left: 0; top: 12px; width: 6px; height: 6px; border-radius: 50%; background: var(--lt-accent,#FF8C42); }
.scene-bullets li.visible { opacity: 1; transform: translateX(0); }
.scene-formula { font-size: 18px; color: var(--lt-accent,#FF8C42); padding: 16px 24px; background: rgba(255,140,66,0.06); border-radius: 10px; border-left: 3px solid var(--lt-accent,#FF8C42); margin-top: 20px; opacity: 0; transition: all 0.5s cubic-bezier(0.2,0,0,1); position: relative; cursor: pointer; user-select: none; }
.scene-formula:hover { background: rgba(255,140,66,0.12); border-left-color: #ff9d5c; }
.scene-formula.visible { opacity: 1; }
.formula-text { display: block; padding-right: 60px; }
.formula-badge { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); font-size: 10px; font-weight: 600; color: rgba(255,140,66,0.5); background: rgba(255,140,66,0.1); padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px; pointer-events: none; transition: all 0.15s; }
.scene-formula:hover .formula-badge { color: rgba(255,140,66,0.8); background: rgba(255,140,66,0.18); }

/* Formula popover overlay */
.formula-overlay { position: fixed; inset: 0; z-index: 2000; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; animation: overlay-in 0.15s ease-out; }
@keyframes overlay-in { from { opacity: 0; } to { opacity: 1; } }
.formula-popover { background: #1e1e2e; border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; min-width: 360px; max-width: 560px; box-shadow: 0 16px 48px rgba(0,0,0,0.5); animation: popover-in 0.2s cubic-bezier(0.2,0,0,1); }
@keyframes popover-in { from { opacity: 0; transform: scale(0.95) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
.formula-popover-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px 0; font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.7); }
.formula-popover-close { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; background: transparent; color: rgba(255,255,255,0.4); cursor: pointer; border-radius: 6px; transition: all 0.15s; }
.formula-popover-close:hover { background: rgba(255,255,255,0.08); color: #fff; }
.formula-latex { margin: 14px 18px; padding: 16px; background: #0d0d1a; border-radius: 8px; font-family: 'JetBrains Mono','Fira Code',monospace; font-size: 14px; color: rgba(255,255,255,0.85); white-space: pre-wrap; word-break: break-all; line-height: 1.6; overflow-x: auto; }
.formula-popover-footer { display: flex; justify-content: flex-end; padding: 0 18px 14px; }
.formula-copy-btn { padding: 6px 16px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.7); border-radius: 8px; font-size: 13px; cursor: pointer; transition: all 0.15s; }
.formula-copy-btn:hover { background: rgba(255,255,255,0.1); color: #fff; border-color: rgba(255,255,255,0.2); }
</style>
