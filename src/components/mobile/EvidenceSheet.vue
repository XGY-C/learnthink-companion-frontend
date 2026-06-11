<script setup lang="ts">
/**
 * Mobile EvidenceSheet — 将 EvidenceDrawer 内容放入 BottomSheet
 */
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import BottomSheet from '@/components/mobile/BottomSheet.vue'

const visible = ref(false)
const sources = ref<any[]>([])

function open(data: any[]) {
  sources.value = data || []
  visible.value = true
}

function copyQuote(quote: string) {
  navigator.clipboard.writeText(quote).then(() => ElMessage.success('引用已复制'))
}

function relevanceStyle(relevance: string) {
  const map: Record<string, string> = {
    high: 'background: rgba(52,199,89,0.1); color: var(--lt-success);',
    medium: 'background: rgba(255,159,10,0.1); color: var(--lt-warning);',
    low: 'background: rgba(255,59,48,0.1); color: var(--lt-danger);',
  }
  return map[relevance] || ''
}

defineExpose({ open })
</script>

<template>
  <BottomSheet v-model="visible" height="large" title="证据与来源" :show-close="true">
    <div v-if="!sources || sources.length === 0" class="ev-empty">无可用来源信息</div>
    <div v-else class="ev-list">
      <div v-for="(source, index) in sources" :key="index" class="ev-item">
        <div class="ev-header">
          <h5 class="ev-title">{{ source.title }}</h5>
          <span class="ev-locator">{{ source.locator }}</span>
        </div>
        <p class="ev-quote">"{{ source.quote }}"</p>
        <div class="ev-footer">
          <span v-if="source.relevance" class="ev-relevance" :style="relevanceStyle(source.relevance)">
            关联度: {{ source.relevance }}
          </span>
          <button class="ev-copy" @click="copyQuote(source.quote)">复制引用</button>
        </div>
      </div>
    </div>
  </BottomSheet>
</template>

<style scoped>
.ev-empty { text-align: center; padding: 40px 0; font-size: 13px; color: var(--lt-text-placeholder); }
.ev-list { display: flex; flex-direction: column; gap: 12px; }
.ev-item { padding: 12px; background: var(--lt-bg-page); border: 1px solid var(--lt-border); border-radius: 10px; }
.ev-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; gap: 8px; }
.ev-title { font-size: 13px; font-weight: 600; color: var(--lt-text-primary); margin: 0; flex: 1; }
.ev-locator { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: var(--lt-bg-card); color: var(--lt-text-auxiliary); flex-shrink: 0; }
.ev-quote { font-size: 13px; color: var(--lt-text-secondary); font-style: italic; margin: 0 0 8px; background: var(--lt-bg-card); padding: 8px; border-radius: 6px; border: 1px solid var(--lt-border); line-height: 1.5; }
.ev-footer { display: flex; justify-content: space-between; align-items: center; }
.ev-relevance { font-size: 11px; padding: 2px 8px; border-radius: 6px; }
.ev-copy { font-size: 12px; color: var(--lt-brand); background: none; border: none; cursor: pointer; padding: 4px 8px; touch-action: manipulation; }
.ev-copy:active { background: var(--lt-brand-lightest); border-radius: 6px; }
</style>
