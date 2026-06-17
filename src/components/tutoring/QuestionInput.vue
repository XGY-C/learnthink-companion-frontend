<script setup lang="ts">
import { ref, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  disabled?: boolean
  placeholder?: string
}>(), {
  disabled: false,
  placeholder: '输入你的问题...',
})

const emit = defineEmits<{
  send: [text: string]
}>()

const text = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

function autoResize() {
  nextTick(() => {
    const el = textareaRef.value
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 168) + 'px'
    }
  })
}

function handleSend() {
  const trimmed = text.value.trim()
  if (!trimmed || props.disabled) return
  emit('send', trimmed)
  text.value = ''
  nextTick(autoResize)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}
</script>

<template>
  <div class="question-input-wrap" :class="{ disabled }">
    <textarea
      ref="textareaRef"
      v-model="text"
      class="question-input"
      :placeholder="placeholder"
      :disabled="disabled"
      rows="1"
      @input="autoResize"
      @keydown="handleKeydown"
    ></textarea>
    <button
      class="send-btn"
      :disabled="disabled || !text.trim()"
      @click="handleSend"
    >
      →
    </button>
  </div>
</template>

<style scoped>
.question-input-wrap {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 12px 16px;
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-radius: 12px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.question-input-wrap:focus-within {
  border-color: var(--lt-brand);
  box-shadow: 0 0 0 3px var(--lt-shadow-blue);
}
.question-input-wrap.disabled {
  background: var(--lt-bg-page);
  cursor: not-allowed;
}

.question-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  font-family: inherit;
  color: var(--lt-text-primary);
  resize: none;
  line-height: 1.5;
  padding: 0;
}
.question-input::placeholder { color: var(--lt-text-placeholder); }
.question-input:disabled { cursor: not-allowed; }

.send-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--lt-brand);
  color: #fff;
  border: none;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, opacity 0.15s;
}
.send-btn:hover:not(:disabled) { background: var(--lt-brand-dark); }
.send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

@media (max-width: 768px) {
  .question-input-wrap { padding: 10px 12px; }
  .question-input { font-size: 13px; }
  .send-btn { width: 32px; height: 32px; }
}
</style>
