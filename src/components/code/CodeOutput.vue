<template>
  <div class="code-output">
    <div class="code-output-header">
      <span class="code-output-status" :class="statusClass">{{ statusLabel }}</span>
      <span class="code-output-stats">
        <template v-if="result?.time != null">{{ result.time.toFixed(2) }}s</template>
        <template v-if="result?.memory != null"> | {{ (result.memory / 1024).toFixed(0) }} MB</template>
      </span>
    </div>
    <div v-if="result?.stdout" class="code-output-body stdout">{{ result.stdout }}</div>
    <div v-if="result?.stderr" class="code-output-body stderr">{{ result.stderr }}</div>
    <div v-if="result?.compile_output" class="code-output-body stderr">{{ result.compile_output }}</div>
    <div v-if="diffOutput" class="code-output-body diff-output">
      <div class="code-output-diff-label">预期输出差异：</div>
      <pre>{{ diffOutput }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CodeRunResult } from '@/types'

const props = defineProps<{
  state: 'running' | 'success' | 'error' | 'timeout'
  result: CodeRunResult | null
  expected?: string
}>()

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    running: '运行中...',
    success: '运行成功',
    error: '运行错误',
    timeout: '运行超时',
  }
  return map[props.state] || props.state
})

const statusClass = computed(() => `status-${props.state}`)

const diffOutput = computed(() => {
  if (!props.expected || !props.result?.stdout) return null
  const actual = props.result.stdout.trim()
  const expected = props.expected.trim()
  if (actual === expected) return null
  return `预期:\n${expected}\n\n实际:\n${actual}`
})
</script>

<style scoped>
.code-output {
  margin-top: 8px;
  border-radius: var(--lt-radius-md);
  overflow: hidden;
  background: #1e1e2e;
  border: 1px solid #2e2e3e;
}
.code-output-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: rgba(255,255,255,0.05);
  font-size: 12px;
}
.code-output-status {
  font-weight: 500;
}
.code-output-status.status-running { color: var(--lt-brand); }
.code-output-status.status-success { color: var(--lt-success); }
.code-output-status.status-error { color: var(--lt-danger); }
.code-output-status.status-timeout { color: var(--lt-warning); }
.code-output-stats {
  color: var(--lt-text-auxiliary);
  font-family: var(--lt-font-mono);
}
.code-output-body {
  padding: 10px 14px;
  font-family: var(--lt-font-mono, 'Consolas', monospace);
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
.code-output-body.stdout {
  color: #34C759;
}
.code-output-body.stderr {
  color: #FF3B30;
}
.code-output-diff-label {
  color: var(--lt-warning);
  font-weight: 500;
  margin-bottom: 4px;
}
.diff-output {
  color: var(--lt-warning);
}
.diff-output pre {
  margin: 0;
  font-family: var(--lt-font-mono, 'Consolas', monospace);
}
</style>
