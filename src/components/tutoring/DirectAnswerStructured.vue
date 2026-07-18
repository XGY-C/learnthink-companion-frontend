<script setup lang="ts">
/**
 * 结构化渲染：先尝试 JSON 代码块，失败则从 markdown 智能提取结构。
 * 支持 problem_analysis（双栏条件映射）和 reasoning_chain（时间轴步骤）。
 */
import { computed } from 'vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import type { DirectAnswerSectionState } from '@/types/directAnswer'

interface ConditionMapping {
  label: string; value: string; highlightType: string; interpretation?: string
}
interface ReasoningStep {
  stepIndex: number; title: string; thinking?: string; expression?: string; result?: string; type: string; intention?: string
}

const props = defineProps<{ section: DirectAnswerSectionState }>()

// ─── 去重：按段落检测重复（以空行为分隔） ───
function dedupParagraphs(content: string): string {
  const paragraphs = content.split(/\n{2,}/)
  const seen = new Set<string>()
  const result: string[] = []
  let removedCount = 0
  for (const p of paragraphs) {
    const key = p.replace(/\s+/g, ' ').trim().slice(0, 120)
    if (!key) { if (p.trim()) result.push(p); continue }
    if (seen.has(key)) { removedCount++; continue }
    seen.add(key)
    result.push(p)
  }
  if (removedCount > 0) {
    console.warn('[DA Dedup]', props.section.id, `共${paragraphs.length}段，去重移除${removedCount}段，保留${result.length}段`)
  }
  return result.join('\n\n')
}

const dedupContent = computed(() => dedupParagraphs(props.section.content || ''))

// ─── JSON 提取 ───
const structuredJson = computed<any>(() => {
  const match = dedupContent.value.match(/```json\s*\n([\s\S]*?)\n\s*```/)
  if (!match) return null
  try { return JSON.parse(match[1]) } catch { return null }
})

const markdownOnly = computed(() =>
  dedupContent.value.replace(/```json\s*\n[\s\S]*?\n\s*```/g, '').trim()
)

// ─── problem_analysis 智能解析（无 JSON 时） ───
const parsedMappings = computed<ConditionMapping[]>(() => {
  if (structuredJson.value?.conditionMappings) return structuredJson.value.conditionMappings
  // 从 markdown 解析：匹配 "已知"、"数据"、"求解" 等模式
  const content = dedupContent.value
  const mappings: ConditionMapping[] = []

  // 匹配形如 "x=[1,2,3,4,5]" 的已知数据
  const dataMatch = content.match(/(?:已知|给定|输入|特征)\s*(?:x\s*[:=]|x\s*为)\s*(\[[^\]]+\])/)
  if (dataMatch) mappings.push({ label: '输入 x', value: dataMatch[1], highlightType: 'data', interpretation: '输入特征' })

  const yMatch = content.match(/(?:标签|输出|目标)\s*(?:y\s*[:=]|y\s*为)\s*(\[[^\]]+\])/)
  if (yMatch) mappings.push({ label: '标签 y', value: yMatch[1], highlightType: 'known', interpretation: '对应标签' })

  const m1 = content.match(/(?:求|计算|求解|求出|确定)[：:]*\s*(w|权重|斜率)[^。\n]{0,30}(?:w|权重|斜率)[=＝]\s*(\S+)/)
  if (m1) mappings.push({ label: '参数 w', value: m1[0].replace(/(?:求|计算|求解|求出|确定)[：:]*\s*/, ''), highlightType: 'target', interpretation: '模型斜率' })

  const m2 = content.match(/(?:求|计算|求解|求出|确定)[：:]*\s*(b|偏置|截距)[^。\n]{0,30}(?:b|偏置|截距)[=＝]\s*(\S+)/)
  if (m2) mappings.push({ label: '参数 b', value: m2[0].replace(/(?:求|计算|求解|求出|确定)[：:]*\s*/, ''), highlightType: 'target', interpretation: '模型截距' })

  if (mappings.length > 0) return mappings

  // 兜底：从列表项中提取
  const items = content.match(/[-*]\s*\*\*(.+?)\*\*[：:]\s*(.+)/g)
  if (items && items.length >= 2) {
    return items.slice(0, 4).map((item, i) => {
      const m = item.match(/[-*]\s*\*\*(.+?)\*\*[：:]\s*(.+)/)
      return { label: m?.[1] || `条件 ${i + 1}`, value: m?.[2]?.slice(0, 60) || item.slice(0, 60), highlightType: i < 2 ? 'known' : 'target', interpretation: '' }
    })
  }

  return []
})

const parsedOverview = computed(() =>
  structuredJson.value?.overallSummary ||
  dedupContent.value.split('\n').find(l => l.trim().startsWith('>'))?.replace('>', '').trim() || ''
)

// ─── reasoning_chain 智能解析（无 JSON 时） ───
const parsedSteps = computed<ReasoningStep[]>(() => {
  if (structuredJson.value?.steps) return structuredJson.value.steps

  const content = dedupContent.value
  const steps: ReasoningStep[] = []

  // 匹配 "第N步" / "Step N" 模式
  const stepRegex = /\*\*第\s*(\d+)\s*步[：:]?\s*(.+?)\*\*|###\s*第\s*(\d+)\s*步[：:]?\s*(.+)/g
  let match
  const positions: { index: number; stepNum: number; title: string; pos: number }[] = []

  while ((match = stepRegex.exec(content)) !== null) {
    const num = parseInt(match[1] || match[3])
    const title = (match[2] || match[4] || '').replace(/\*\*$/, '').trim()
    positions.push({ index: num, title, pos: match.index })
  }

  if (positions.length >= 2) {
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i]
      const nextPos = i + 1 < positions.length ? positions[i + 1].pos : content.length
      const body = content.slice(p.pos + match[0]?.length || 30, nextPos)
      const isCore = /核心|关键|突破|策略|选择|构造|变换/.test(p.title)

      // 提取表达式
      const exprMatch = body.match(/(?:$|\\\(|\\\[)([wbyxΔ\d=×\+\-\.\^ ]{5,})(?:$|\\\)|\\\]|\\,)/)
      const resultMatch = body.match(/(?:得到|得出|解得|因此|所以)[：:]*\s*(.{0,30})/)

      steps.push({
        stepIndex: p.index,
        title: p.title,
        thinking: body.slice(0, 80).replace(/\n/g, ' ').trim(),
        expression: exprMatch?.[1]?.trim() || '',
        result: resultMatch?.[1]?.trim() || '',
        type: isCore ? 'core' : 'normal',
        intention: '',
      })
    }
    return steps
  }

  // 兜底：按 `<strong>` 或 `**` 分割
  const strongSplit = content.split(/\*\*(.+?)\*\*/)
  if (strongSplit.length >= 5) {
    return strongSplit.filter((_, i) => i % 2 === 0 && strongSplit[i + 1]).slice(0, 5).map((body, i) => ({
      stepIndex: i + 1,
      title: strongSplit[i * 2 + 1] || `步骤 ${i + 1}`,
      thinking: body.slice(0, 100).replace(/\n/g, ' ').trim(),
      type: i === 0 ? 'core' : 'normal',
    }))
  }

  return []
})

// ─── 渲染 ───
function hlColor(type: string): string {
  return { data: '#e6a23c', known: '#409eff', target: '#34d399', distractor: '#999' }[type] || '#999'
}
function hlLabel(type: string): string {
  return { data: '数据', known: '已知', target: '待求', distractor: '干扰' }[type] || type
}
function stepColor(type: string): string {
  return type === 'core' ? '#C4820E' : '#9C9488'
}
</script>

<template>
  <!-- ═══ problem_analysis: 双栏 ═══ -->
  <template v-if="section.id === 'problem_analysis'">
    <MarkdownViewer v-if="markdownOnly" :content="markdownOnly" :showToc="false" class="mb-3" />
    <div v-if="parsedMappings.length > 0" class="ds-mappings">
      <div class="ds-mappings-grid">
        <div>
          <div class="ds-col-label">条件</div>
          <div v-for="m in parsedMappings" :key="m.label" class="ds-mapping-row">
            <span class="ds-hl-dot" :style="{ background: hlColor(m.highlightType) }" />
            <div>
              <div class="ds-map-label">
                <span class="ds-hl-badge" :style="{ color: hlColor(m.highlightType), borderColor: hlColor(m.highlightType)+'40', background: hlColor(m.highlightType)+'08' }">
                  {{ hlLabel(m.highlightType) }}
                </span>
                {{ m.label }}
              </div>
              <div class="ds-map-value">{{ m.value }}</div>
              <div v-if="m.interpretation" class="ds-map-interp">{{ m.interpretation }}</div>
            </div>
          </div>
        </div>
        <div>
          <div class="ds-col-label">转化路径</div>
          <div v-for="m in parsedMappings" :key="m.label" class="ds-mapping-row">
            <span class="ds-arrow">→</span>
            <span class="ds-strategy">{{ hlLabel(m.highlightType) === '待求' ? '求解目标' : '需转换处理' }}</span>
          </div>
        </div>
      </div>
      <div v-if="parsedOverview" class="ds-overview">💡 {{ parsedOverview }}</div>
    </div>
  </template>

  <!-- ═══ reasoning_chain: 时间轴 ═══ -->
  <template v-else-if="section.id === 'reasoning_chain'">
    <MarkdownViewer v-if="markdownOnly && parsedSteps.length === 0" :content="markdownOnly" :showToc="false" />

    <div v-if="parsedSteps.length > 0" class="ds-timeline">
      <div v-for="(step, i) in parsedSteps" :key="i" class="ds-step">
        <div class="ds-step-marker" :class="step.type" :style="{ borderColor: stepColor(step.type) }">
          <span class="ds-step-dot" :class="step.type" :style="{ background: stepColor(step.type) }" />
        </div>
        <div class="ds-step-body">
          <div class="ds-step-header">
            <span class="ds-step-num">第{{ step.stepIndex || i + 1 }}步</span>
            <span class="ds-step-status" :class="step.type">{{ step.type === 'core' ? '核心' : '' }}</span>
          </div>
          <div class="ds-step-title">{{ step.title }}</div>
          <div v-if="step.thinking" class="ds-step-thinking">{{ step.thinking }}</div>
          <div v-if="step.expression" class="ds-step-expr"><code>{{ step.expression }}</code></div>
          <div v-if="step.result" class="ds-step-result">{{ step.result }}</div>
          <div v-if="step.intention" class="ds-step-intention">💡 {{ step.intention }}</div>
        </div>
      </div>
    </div>
  </template>

  <!-- ═══ fallback ═══ -->
  <template v-else>
    <MarkdownViewer :content="dedupContent" :showToc="false" />
  </template>
</template>

<style scoped>
.ds-mappings { margin-top: 10px; }
.ds-mappings-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0;
  border: 1px solid rgba(0,0,0,0.06); border-radius: 10px; overflow: hidden;
}
.ds-col-label {
  font-size: 10px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: #9C9488;
  padding: 7px 14px; border-bottom: 1px solid rgba(0,0,0,0.04);
  background: rgba(0,0,0,0.01);
}
.ds-mapping-row {
  display: flex; gap: 8px; padding: 8px 14px;
  border-bottom: 1px solid rgba(0,0,0,0.03);
  transition: background 0.15s;
}
.ds-mapping-row:hover { background: rgba(255,255,255,0.3); }
.ds-mapping-row:last-child { border-bottom: none; }
.ds-hl-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
.ds-map-label { font-size: 12px; font-weight: 500; color: #1C1814; display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
.ds-hl-badge { font-size: 9px; padding: 1px 6px; border-radius: 9999px; border: 1px solid; }
.ds-map-value { font-size: 13px; color: #4A443C; }
.ds-map-interp { font-size: 11px; color: #8C8478; margin-top: 2px; }
.ds-arrow { font-size: 14px; color: #C4820E; margin-top: 4px; flex-shrink: 0; }
.ds-strategy { font-size: 12px; color: #C4820E; font-weight: 500; padding: 2px 0; margin-top: 4px; }
.ds-overview { margin-top: 10px; font-size: 12px; color: #6B6358; line-height: 1.6; padding: 0 4px; }

.ds-timeline { position: relative; padding-left: 28px; }
.ds-timeline::before { content: ''; position: absolute; left: 13px; top: 6px; bottom: 6px; width: 1px; background: rgba(0,0,0,0.06); }
.ds-step { position: relative; padding-bottom: 14px; }
.ds-step:last-child { padding-bottom: 0; }
.ds-step-marker { position: absolute; left: -28px; top: 6px; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid; background: #fff; }
.ds-step-dot { width: 8px; height: 8px; border-radius: 50%; }
.ds-step-dot.core { width: 12px; height: 12px; box-shadow: 0 0 0 3px rgba(196,130,14,0.06); }
.ds-step-body { padding: 2px 0 6px 14px; border-radius: 8px; transition: background 0.15s; }
.ds-step-body:hover { background: rgba(255,255,255,0.2); }
.ds-step-header { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
.ds-step-num { font-size: 10px; font-weight: 600; letter-spacing: 0.04em; color: #9C9488; }
.ds-step-status { font-size: 9px; font-weight: 600; padding: 1px 8px; border-radius: 9999px; color: #fff; }
.ds-step-status.core { background: #C4820E; }
.ds-step-status.normal { background: #9C9488; }
.ds-step-title { font-size: 13px; font-weight: 500; color: #1C1814; margin-bottom: 5px; }
.ds-step-thinking { font-size: 11px; color: #8C8478; padding: 3px 10px; border-left: 2px solid rgba(196,130,14,0.08); border-radius: 0 4px 4px 0; line-height: 1.5; margin-bottom: 4px; }
.ds-step-expr { margin-bottom: 3px; }
.ds-step-expr code { font-family: "JetBrains Mono",monospace; font-size: 12px; background: rgba(196,130,14,0.04); color: #C4820E; padding: 2px 8px; border-radius: 4px; }
.ds-step-result { font-size: 13px; color: #1C1814; font-weight: 500; margin-bottom: 3px; }
.ds-step-intention { font-size: 11px; color: #6B6358; padding: 3px 10px; background: rgba(196,130,14,0.02); border-radius: 6px; line-height: 1.5; }
</style>
