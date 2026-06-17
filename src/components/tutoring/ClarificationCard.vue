<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Clarification, ClarificationOption } from '@/types/tutoring'

const props = defineProps<{
  clarification: Clarification | null
  clarifyWaitSeconds: number
  round: number
}>()

const emit = defineEmits<{
  submit: [response: { skipped: boolean; selectedOptionId?: string; freeInput?: string }]
}>()

const selectedId = ref<string | null>(null)
const freeInput = ref('')
const isSkippable = ref(false)
const skipCountdown = ref(0)

// 当 waitSeconds 变化时，开始倒计时
watch(
  () => props.clarifyWaitSeconds,
  (seconds) => {
    if (seconds > 0) {
      skipCountdown.value = seconds
      const timer = setInterval(() => {
        skipCountdown.value--
        if (skipCountdown.value <= 0) {
          isSkippable.value = true
          clearInterval(timer)
        }
      }, 1000)
    }
  }
)

// 多轮切换：重置选项
watch(
  () => props.round,
  () => {
    selectedId.value = null
    freeInput.value = ''
    isSkippable.value = false
    skipCountdown.value = 0
  }
)

function selectOption(optionId: string) {
  if (freeInput.value) return // 自由输入与选项互斥
  selectedId.value = selectedId.value === optionId ? null : optionId
}

function handleFreeInput() {
  selectedId.value = null // 输入时取消选项
}

function submitSelection() {
  if (selectedId.value) {
    emit('submit', { skipped: false, selectedOptionId: selectedId.value })
  }
}

function submitFreeInput() {
  if (freeInput.value.trim()) {
    emit('submit', { skipped: false, freeInput: freeInput.value.trim() })
  }
}

function skipClarification() {
  emit('submit', { skipped: true })
}

const hasSelection = computed(() => selectedId.value !== null)
const hasFreeInput = computed(() => freeInput.value.trim().length > 0)
</script>

<template>
  <div v-if="clarification" class="clarification-card" :key="round">
    <div class="clarify-header">
      <span class="clarify-icon">🤔</span>
      <span class="clarify-title">{{ round > 1 ? `第 ${round} 轮确认` : '需要确认一下' }}</span>
    </div>

    <p class="clarify-understood">
      我理解你在问：<em>{{ clarification.understoodPart }}</em>
    </p>

    <p class="clarify-ambiguity">
      {{ clarification.ambiguityDescription }}
    </p>

    <div class="clarify-options">
      <button
        v-for="opt in clarification.options"
        :key="opt.id"
        class="clarify-option"
        :class="{ selected: selectedId === opt.id }"
        @click="selectOption(opt.id)"
      >
        <span class="option-label">{{ opt.label }}</span>
        <span v-if="opt.detail" class="option-desc">{{ opt.detail }}</span>
      </button>
    </div>

    <button
      v-if="hasSelection"
      class="submit-btn"
      @click="submitSelection"
    >
      确认选择
    </button>

    <!-- 自由输入 -->
    <div v-if="clarification.allowFreeInput" class="free-input-section">
      <div class="free-input-divider">── 或者直接补充说明 ──</div>
      <textarea
        v-model="freeInput"
        class="free-input"
        :rows="Math.min(4, Math.max(1, (freeInput.match(/\n/g) || []).length + 1))"
        placeholder="输入你想了解的具体方向..."
        @input="handleFreeInput"
      ></textarea>
      <button
        v-if="hasFreeInput"
        class="submit-btn"
        @click="submitFreeInput"
      >
        发送补充说明
      </button>
    </div>

    <!-- 跳过澄清 -->
    <div v-if="isSkippable || skipCountdown > 0" class="skip-section">
      <button
        v-if="isSkippable"
        class="skip-btn"
        @click="skipClarification"
      >
        跳过澄清，直接回答
      </button>
      <span v-else class="skip-countdown">{{ skipCountdown }} 秒后可跳过</span>
    </div>
  </div>
</template>

<style scoped>
.clarification-card {
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-radius: 16px;
  padding: 28px 24px;
}

.clarify-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.clarify-icon { font-size: 24px; }
.clarify-title { font-size: 18px; font-weight: 700; color: var(--lt-text-primary); }

.clarify-understood {
  font-size: 14px;
  color: var(--lt-text-secondary);
  margin-bottom: 8px;
}
.clarify-understood em {
  color: var(--lt-text-primary);
  font-style: italic;
}

.clarify-ambiguity {
  font-size: 14px;
  color: var(--lt-text-secondary);
  margin-bottom: 20px;
  line-height: 1.6;
}

.clarify-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.clarify-option {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
  padding: 14px 18px;
  border: 1.5px solid var(--lt-border);
  border-radius: 12px;
  background: var(--lt-bg-card);
  cursor: pointer;
  transition: all 0.15s;
}
.clarify-option:hover {
  border-color: var(--lt-brand);
  background: var(--lt-brand-lightest);
}
.clarify-option.selected {
  border-color: var(--lt-brand);
  background: var(--lt-brand-lightest);
}

.option-label { font-size: 15px; font-weight: 600; color: var(--lt-text-primary); }
.option-desc { font-size: 13px; color: var(--lt-text-auxiliary); }

.submit-btn {
  display: block;
  width: 100%;
  padding: 10px 0;
  background: var(--lt-brand);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  margin-bottom: 16px;
}
.submit-btn:hover { background: var(--lt-brand-dark); }

.free-input-section { margin-bottom: 16px; }
.free-input-divider {
  font-size: 12px;
  color: var(--lt-text-placeholder);
  text-align: center;
  margin: 16px 0;
}

.free-input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--lt-border);
  border-radius: 10px;
  font-size: 14px;
  font-family: inherit;
  color: var(--lt-text-primary);
  background: var(--lt-bg-page);
  resize: none;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.free-input:focus { border-color: var(--lt-brand); }

.skip-section {
  text-align: center;
  padding-top: 12px;
  border-top: 1px solid var(--lt-border);
}

.skip-btn {
  font-size: 13px;
  color: var(--lt-text-auxiliary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 6px;
  transition: color 0.15s;
}
.skip-btn:hover { color: var(--lt-brand); }

.skip-countdown {
  font-size: 12px;
  color: var(--lt-text-placeholder);
}

@media (max-width: 768px) {
  .clarification-card { padding: 20px 16px; border-radius: 12px; }
  .clarify-title { font-size: 16px; }
  .clarify-option { padding: 12px 14px; }
}
</style>
