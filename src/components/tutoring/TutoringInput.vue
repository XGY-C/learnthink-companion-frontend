<script setup lang="ts">
import { ref, nextTick, computed, watch, onUnmounted } from 'vue'
import type { TutoringMode } from '@/types/tutoring'

const props = withDefaults(defineProps<{
  disabled?: boolean
  placeholder?: string
  hideTestMode?: boolean
  initialText?: string
}>(), {
  disabled: false,
  placeholder: '输入你的问题...',
  hideTestMode: false,
  initialText: '',
})

const emit = defineEmits<{
  send: [text: string, mode: TutoringMode, isVideo: boolean]
}>()

const text = ref('')
const selectedMode = ref<TutoringMode>('smart')
const isVideoMode = ref(false)
const showModeMenu = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const modeSelectorRef = ref<HTMLDivElement | null>(null)

const videoModeInfo = { label: '视频模式', desc: '生成视频讲解', color: 'var(--lt-success)', shadow: 'rgba(52, 199, 89, 0.15)' }

const modeOptions = [
  { value: 'smart' as TutoringMode, label: '智能模式', desc: '全面智能辅导', color: 'var(--lt-brand)', shadow: 'rgba(43, 111, 255, 0.15)' },
  { value: 'guided' as TutoringMode, label: '引导模式', desc: '苏格拉底引导', color: 'var(--lt-ai)', shadow: 'rgba(124, 92, 252, 0.15)' },
  { value: 'direct' as TutoringMode, label: '直接模式', desc: '7段结构化深度讲解', color: 'var(--lt-orange)', shadow: 'rgba(255, 140, 66, 0.15)' },
  { value: 'test' as TutoringMode, label: '测试模式', desc: '模拟测试练习', color: 'var(--lt-success)', shadow: 'rgba(52, 199, 89, 0.15)' },
]

const currentMode = computed(() => {
  if (isVideoMode.value) return videoModeInfo
  return modeOptions.find(m => m.value === selectedMode.value)!
})

const visibleModeOptions = computed(() =>
  props.hideTestMode ? modeOptions.filter(m => m.value !== 'test') : modeOptions
)

watch(() => props.initialText, (val) => {
  if (val) {
    text.value = val
    nextTick(autoResize)
  }
}, { immediate: true })

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
  emit('send', trimmed, selectedMode.value, isVideoMode.value)
  text.value = ''
  nextTick(autoResize)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function toggleModeMenu() {
  if (props.disabled || isVideoMode.value) return
  showModeMenu.value = !showModeMenu.value
}

function selectMode(mode: TutoringMode) {
  selectedMode.value = mode
  isVideoMode.value = false
  showModeMenu.value = false
}

function toggleVideo() {
  if (props.disabled) return
  isVideoMode.value = !isVideoMode.value
  showModeMenu.value = false
}

function handleClickOutside(e: MouseEvent) {
  if (modeSelectorRef.value && !modeSelectorRef.value.contains(e.target as Node)) {
    showModeMenu.value = false
  }
}

watch(showModeMenu, (val) => {
  if (val) {
    window.addEventListener('click', handleClickOutside, true)
  } else {
    window.removeEventListener('click', handleClickOutside, true)
  }
})

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside, true)
})
</script>

<template>
  <div class="tutoring-input-wrap" :class="{ 'is-video': isVideoMode }" :style="{ '--mode-color': currentMode.color, '--mode-shadow': currentMode.shadow }">
    <div class="input-toolbar">
      <div class="toolbar-left">
        <button
          class="video-toggle"
          :class="{ 'is-active': isVideoMode }"
          :disabled="disabled"
          @click="toggleVideo"
          :title="isVideoMode ? '关闭视频讲解' : '开启视频讲解'"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5.14v14l11-7-11-7z"/>
          </svg>
        </button>
        <div ref="modeSelectorRef" class="mode-selector" :class="{ 'is-video-mode': isVideoMode }" @click.stop="toggleModeMenu">
          <span class="mode-indicator" :style="{ background: currentMode.color }"></span>
          <span class="mode-label">{{ currentMode.label }}</span>
          <svg v-if="!isVideoMode" class="mode-caret" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.92 1.83a1 1 0 0 1 1.37.36l4.87 8.3a2 2 0 0 1 0 2.03l-4.87 8.3a1 1 0 0 1-1.37.36 1 1 0 0 1-.36-1.37L13.43 12 8.56 3.7a1 1 0 0 1 .36-1.37z"/>
          </svg>
          <Transition name="dropdown">
            <div v-if="showModeMenu" class="mode-dropdown">
              <div
                v-for="opt in visibleModeOptions" :key="opt.value"
                class="mode-option"
                :class="{ 'is-selected': opt.value === selectedMode }"
                @click.stop="selectMode(opt.value)"
              >
                <span class="mode-option-dot" :style="{ background: opt.color }"></span>
                <div class="mode-option-text">
                  <span class="mode-option-label">{{ opt.label }}</span>
                  <span class="mode-option-desc">{{ opt.desc }}</span>
                </div>
                <svg v-if="opt.value === selectedMode" class="mode-check" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.22 4.87a1 1 0 0 1 1.41 1.26l-10.53 12.93a1.5 1.5 0 0 1-2.38.04L2.72 11.63a1 1 0 0 1 1.55-1.26l5.73 7.05L20.22 4.87z"/>
                </svg>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>
    <div class="input-row">
      <textarea
        ref="textareaRef"
        v-model="text"
        class="tutoring-textarea"
        :placeholder="isVideoMode ? '输入知识点，生成视频讲解...' : placeholder"
        :disabled="disabled"
        rows="1"
        @input="autoResize"
        @keydown="handleKeydown"
      ></textarea>
      <button
        class="send-btn"
        :disabled="disabled || !text.trim()"
        @click="handleSend"
      >→</button>
    </div>
  </div>
</template>

<style scoped>
.tutoring-input-wrap {
  border: 1px solid var(--lt-border);
  border-radius: 12px;
  background: var(--lt-bg-card);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.tutoring-input-wrap:focus-within {
  border-color: var(--mode-color, var(--lt-brand));
  box-shadow: 0 0 0 3px var(--mode-shadow, var(--lt-shadow-blue));
}

.input-toolbar {
  display: flex;
  align-items: center;
  padding: 8px 12px 0;
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Mode Selector */
.mode-selector {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--lt-border);
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  transition: border-color 0.15s, background 0.15s;
}
.mode-selector:hover {
  border-color: var(--lt-brand-lighter);
  background: var(--lt-brand-lightest);
}
.mode-selector.is-video-mode {
  opacity: 0.6;
  cursor: default;
}
.mode-selector.is-video-mode:hover {
  border-color: var(--lt-border);
  background: transparent;
}
.mode-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.mode-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--lt-text-primary);
  white-space: nowrap;
}
.mode-caret {
  color: var(--lt-text-auxiliary);
  flex-shrink: 0;
  transition: transform 0.2s;
}
.mode-caret.open {
  transform: rotate(90deg);
}

/* Dropdown Menu */
.mode-dropdown {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  min-width: 200px;
  background: var(--lt-bg-card);
  border: 1px solid var(--lt-border);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04);
  padding: 4px;
  z-index: 100;
  overflow: hidden;
}
.mode-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s;
}
.mode-option:hover {
  background: var(--lt-bg-page);
}
.mode-option.is-selected {
  background: var(--lt-brand-lightest);
}
.mode-option-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.mode-option-text {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.mode-option-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--lt-text-primary);
  line-height: 1.3;
}
.mode-option-desc {
  font-size: 11px;
  color: var(--lt-text-auxiliary);
  line-height: 1.3;
}
.mode-check {
  color: var(--lt-brand);
  flex-shrink: 0;
}

/* Dropdown transition */
.dropdown-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.dropdown-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Video Toggle */
.video-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid rgba(52, 199, 89, 0.35);
  border-radius: 8px;
  background: linear-gradient(145deg, rgba(240, 250, 244, 0.5) 0%, rgba(224, 245, 232, 0.5) 100%);
  color: rgba(52, 199, 89, 0.55);
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}
.video-toggle:hover {
  border-color: rgba(52, 199, 89, 0.55);
  background: linear-gradient(145deg, rgba(240, 250, 244, 0.8) 0%, rgba(224, 245, 232, 0.8) 100%);
  color: rgba(52, 199, 89, 0.75);
}
.video-toggle.is-active {
  border-color: var(--lt-success);
  background: linear-gradient(145deg, var(--lt-success) 0%, #4CDA72 100%);
  color: #fff;
}
.video-toggle:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Input Row */
.input-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 6px 12px 12px;
}
.tutoring-textarea {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  font-family: inherit;
  color: var(--lt-text-primary);
  resize: none;
  line-height: 1.5;
  padding: 2px 0;
  min-height: 22px;
  max-height: 168px;
}
.tutoring-textarea::placeholder {
  color: var(--lt-text-placeholder);
}
.tutoring-textarea:disabled {
  cursor: not-allowed;
}

.send-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--mode-color, var(--lt-brand));
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
.send-btn:hover:not(:disabled) {
  filter: brightness(0.85);
}
.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .input-toolbar {
    padding: 6px 10px 0;
  }
  .input-row {
    padding: 4px 10px 10px;
  }
  .tutoring-textarea {
    font-size: 13px;
  }
  .send-btn {
    width: 32px;
    height: 32px;
  }
}
</style>
