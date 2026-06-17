<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  visible: boolean
  disabled?: boolean
}>(), {
  disabled: false,
})

const emit = defineEmits<{
  send: [text: string]
  cancel: []
}>()

const text = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

watch(() => props.visible, (v) => {
  if (v) {
    text.value = ''
    nextTick(() => textareaRef.value?.focus())
  }
})

function autoResize() {
  nextTick(() => {
    const el = textareaRef.value
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 112) + 'px'
    }
  })
}

function handleSend() {
  const trimmed = text.value.trim()
  if (!trimmed || props.disabled) return
  emit('send', trimmed)
  text.value = ''
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
  if (e.key === 'Escape') {
    emit('cancel')
  }
}
</script>

<template>
  <Transition name="follow-up">
    <div v-if="visible" class="follow-up-wrap">
      <div class="follow-up-label">💬 追问</div>
      <div class="follow-up-row">
        <textarea
          ref="textareaRef"
          v-model="text"
          class="follow-up-input"
          placeholder="补充你的问题..."
          :disabled="disabled"
          rows="1"
          @input="autoResize"
          @keydown="handleKeydown"
        ></textarea>
        <div class="follow-up-actions">
          <button
            v-if="!disabled"
            class="fu-send-btn"
            :disabled="!text.trim()"
            @click="handleSend"
          >
            发送
          </button>
          <button class="fu-cancel-btn" @click="emit('cancel')">取消</button>
        </div>
      </div>
      <div v-if="disabled" class="follow-up-loading">
        <span class="loading-spinner"></span> 正在更新...
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.follow-up-wrap {
  background: var(--lt-bg-page);
  border: 1px dashed var(--lt-border);
  border-radius: 8px;
  padding: 12px;
  margin-top: 12px;
}

.follow-up-label {
  font-size: 13px;
  color: var(--lt-text-secondary);
  margin-bottom: 8px;
}

.follow-up-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.follow-up-input {
  flex: 1;
  border: 1px solid var(--lt-border);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  font-family: inherit;
  color: var(--lt-text-primary);
  background: var(--lt-bg-card);
  resize: none;
  outline: none;
  transition: border-color 0.15s;
  line-height: 1.5;
}
.follow-up-input:focus { border-color: var(--lt-brand); }
.follow-up-input:disabled { opacity: 0.6; }

.follow-up-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.fu-send-btn {
  padding: 6px 14px;
  background: var(--lt-brand);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.fu-send-btn:hover:not(:disabled) { background: var(--lt-brand-dark); }
.fu-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.fu-cancel-btn {
  padding: 6px 10px;
  background: none;
  border: 1px solid var(--lt-border);
  border-radius: 8px;
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  cursor: pointer;
  transition: color 0.15s;
}
.fu-cancel-btn:hover { color: var(--lt-text-primary); }

.follow-up-loading {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  margin-top: 8px;
}

.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--lt-border);
  border-top-color: var(--lt-brand);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.follow-up-enter-active { transition: all 200ms ease; }
.follow-up-leave-active { transition: all 150ms ease; }
.follow-up-enter-from { opacity: 0; max-height: 0; }
.follow-up-enter-to { opacity: 1; max-height: 200px; }
.follow-up-leave-from { opacity: 1; max-height: 200px; }
.follow-up-leave-to { opacity: 0; max-height: 0; }
</style>
