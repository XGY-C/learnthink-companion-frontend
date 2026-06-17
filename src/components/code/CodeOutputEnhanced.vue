<template>
  <div class="code-output-enhanced" :class="state">
    <!-- Collapsed bar -->
    <div v-if="state === 'collapsed'" class="output-collapsed" @click="$emit('expand')">
      <span class="output-collapsed-icon">{{ prevSuccess ? '✓' : '✗' }}</span>
      <span class="output-collapsed-text">
        {{ prevSuccess ? '运行成功' : '运行失败' }}
      </span>
      <span class="output-collapsed-time">{{ prevTime }}s</span>
      <span class="output-collapsed-hint">[点击展开]</span>
    </div>

    <!-- Expanded output -->
    <template v-else>
      <div class="output-header">
        <div class="output-status-row">
          <span class="output-status" :class="state">
            <template v-if="state === 'running'">⏳ 运行中...</template>
            <template v-else-if="state === 'success'">✓ 运行成功</template>
            <template v-else-if="state === 'error'">✗ 运行失败</template>
            <template v-else-if="state === 'timeout'">⚠ 运行超时</template>
          </span>
          <span class="output-stats">
            <template v-if="time != null">{{ time.toFixed(2) }}s</template>
            <template v-if="memory != null"> | {{ (memory / 1024).toFixed(0) }}MB</template>
          </span>
        </div>
        <div class="output-tabs">
          <button
            v-for="tab in availableTabs"
            :key="tab.key"
            class="output-tab"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
          <button class="output-close" @click="$emit('collapse')">
            <el-icon><ArrowDown /></el-icon>
          </button>
        </div>
      </div>
      <div class="output-body">
        <pre v-if="activeTab === 'stdout' && stdout" class="output-pre stdout">{{ stdout }}</pre>
        <pre v-else-if="activeTab === 'stdout'" class="output-pre empty">（无输出）</pre>
        <pre v-if="activeTab === 'stderr' && stderr" class="output-pre stderr">{{ stderr }}</pre>
        <pre v-else-if="activeTab === 'stderr'" class="output-pre empty">（无错误）</pre>
        <pre v-if="activeTab === 'compile' && compileOutput" class="output-pre stderr">{{ compileOutput }}</pre>
        <pre v-else-if="activeTab === 'compile'" class="output-pre empty">（无编译输出）</pre>
        <div v-if="activeTab === 'diff' && diffText" class="diff-view">
          <div class="diff-label">预期输出差异</div>
          <pre class="output-pre">{{ diffText }}</pre>
        </div>
        <div v-else-if="activeTab === 'diff' && !diffText" class="output-body-inner">
          <span class="output-match">✓ 输出与预期一致</span>
        </div>
        <div v-if="activeTab === 'tests'" class="tests-view">
          <div v-for="(tc, i) in testCases" :key="i" class="test-row" :class="tc.passed ? 'pass' : 'fail'">
            <span class="test-icon">{{ tc.passed ? '✓' : '✗' }}</span>
            <span class="test-name">{{ tc.name }}</span>
            <span v-if="tc.passed !== undefined" class="test-result">{{ tc.passed ? '通过' : '失败' }}</span>
          </div>
        </div>
      </div>

      <!-- Progress bar for running state -->
      <div v-if="state === 'running'" class="output-progress">
        <div class="output-progress-bar" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'

export interface TestResult {
  name: string
  passed?: boolean
  actualOutput?: string
}

const props = defineProps<{
  state: 'idle' | 'running' | 'success' | 'error' | 'timeout' | 'collapsed'
  stdout?: string | null
  stderr?: string | null
  compileOutput?: string | null
  expectedOutput?: string | null
  time?: number | null
  memory?: number | null
  testCases?: TestResult[]
}>()

defineEmits<{
  collapse: []
  expand: []
}>()

const prevSuccess = ref(false)
const prevTime = ref('0.00')
const activeTab = ref('stdout')

const availableTabs = computed(() => {
  const tabs = [
    { key: 'stdout', label: 'stdout' },
    { key: 'stderr', label: 'stderr' },
  ]
  if (props.compileOutput) tabs.push({ key: 'compile', label: '编译' })
  if (props.expectedOutput) tabs.push({ key: 'diff', label: '对比' })
  if (props.testCases && props.testCases.length > 0) tabs.push({ key: 'tests', label: '测试' })
  return tabs
})

const diffText = computed(() => {
  if (!props.expectedOutput || !props.stdout) return null
  const actual = props.stdout.trim()
  const expected = props.expectedOutput.trim()
  if (actual === expected) return null
  return `预期:\n${expected}\n\n实际:\n${actual}`
})
</script>

<style scoped>
.code-output-enhanced {
  border: 1px solid var(--lt-border);
  border-radius: var(--lt-radius-md);
  overflow: hidden;
  background: #1e1e2e;
  animation: slide-up 200ms ease-out;
}
@keyframes slide-up {
  from { transform: translateY(8px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.output-collapsed {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  background: #1e1e2e;
}
.output-collapsed:hover {
  background: rgba(255,255,255,0.05);
}
.output-collapsed-icon {
  font-weight: 600;
}
.output-collapsed-text {
  color: var(--lt-text-secondary);
}
.output-collapsed-time {
  font-family: var(--lt-font-mono);
}
.output-collapsed-hint {
  margin-left: auto;
  font-size: 11px;
}
.output-header {
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.output-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  font-size: 12px;
}
.output-status.running { color: var(--lt-brand); }
.output-status.success { color: var(--lt-success); }
.output-status.error { color: var(--lt-danger); }
.output-status.timeout { color: var(--lt-warning); }
.output-stats {
  color: var(--lt-text-auxiliary);
  font-family: var(--lt-font-mono);
  font-size: 11px;
}
.output-tabs {
  display: flex;
  gap: 0;
  padding: 0 8px;
  border-top: 1px solid rgba(255,255,255,0.05);
}
.output-tab {
  padding: 5px 12px;
  font-size: 11px;
  border: none;
  background: transparent;
  color: var(--lt-text-auxiliary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}
.output-tab.active {
  color: var(--lt-brand);
  border-bottom-color: var(--lt-brand);
}
.output-tab:hover {
  color: var(--lt-text-secondary);
}
.output-close {
  margin-left: auto;
  padding: 5px 8px;
  font-size: 12px;
  border: none;
  background: transparent;
  color: var(--lt-text-auxiliary);
  cursor: pointer;
}
.output-body {
  padding: 10px 14px;
  max-height: 200px;
  overflow-y: auto;
}
.output-pre {
  margin: 0;
  font-family: var(--lt-font-mono);
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
.output-pre.stdout { color: #34C759; }
.output-pre.stderr { color: #FF3B30; }
.output-pre.empty { color: #555; font-style: italic; }
.output-body-inner {
  padding: 8px 0;
}
.output-match {
  color: var(--lt-success);
  font-size: 13px;
}
.diff-view .diff-label {
  color: var(--lt-warning);
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 4px;
}
.diff-view .output-pre {
  color: var(--lt-warning);
}
.output-progress {
  height: 3px;
  background: rgba(255,255,255,0.08);
}
.output-progress-bar {
  height: 100%;
  width: 30%;
  background: var(--lt-brand);
  animation: progress-indeterminate 1.5s infinite;
}
@keyframes progress-indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}
.tests-view {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.test-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: var(--lt-radius-sm);
  font-size: 13px;
}
.test-row.pass { color: var(--lt-success); }
.test-row.fail { color: var(--lt-danger); background: rgba(255,59,48,0.08); }
.test-icon { font-weight: 600; }
.test-name { flex: 1; }
.test-result { font-size: 11px; }
</style>
