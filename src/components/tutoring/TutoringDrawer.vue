<script setup lang="ts">
import { ref, watch } from 'vue'
import { useTutoringStore } from '@/stores/tutoring'
import { useTutoringSSE } from '@/composables/useTutoringSSE'
import StreamingMarkdown from './StreamingMarkdown.vue'
import QuestionInput from './QuestionInput.vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const store = useTutoringStore()
const { startTutoring } = useTutoringSSE()

const answerContent = ref('')
const isStreaming = ref(false)

// Watch store for streaming content updates
watch(
  () => store.sectionList,
  (sections) => {
    if (sections.length > 0) {
      answerContent.value = sections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n')
    }
  },
  { deep: true }
)

watch(() => store.status, (s) => {
  isStreaming.value = s === 'generating' || s === 'planning' || s === 'preparing'
})

async function handleSend(question: string) {
  store.reset()
  answerContent.value = ''
  await startTutoring({ question })
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="visible" class="drawer-overlay" @click.self="handleClose">
        <div class="drawer-panel">
          <div class="drawer-header">
            <span class="drawer-title">智能辅导</span>
            <button class="drawer-close" @click="handleClose">✕</button>
          </div>

          <div class="drawer-body">
            <!-- Answer content -->
            <div v-if="answerContent || isStreaming" class="drawer-answer">
              <StreamingMarkdown :content="answerContent" :streaming="isStreaming" />
            </div>

            <div v-else-if="store.status === 'clarifying'" class="drawer-clarify-hint">
              <p>需要进一步确认你的问题，请继续对话补充说明。</p>
            </div>
          </div>

          <div class="drawer-footer">
            <template v-if="store.status === 'error'">
              <div class="drawer-error">
                <span>{{ store.error?.message || '出错了' }}</span>
                <el-button v-if="store.error?.retryable" size="small" @click="store.reset()">重试</el-button>
              </div>
            </template>

            <QuestionInput
              placeholder="输入你的问题..."
              :disabled="store.isStreaming"
              @send="handleSend"
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 1500;
  display: flex;
  justify-content: flex-end;
}

.drawer-panel {
  width: 480px;
  max-width: 100vw;
  height: 100vh;
  background: var(--lt-bg-card);
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--lt-border);
  flex-shrink: 0;
}

.drawer-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--lt-text-primary);
}

.drawer-close {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--lt-text-auxiliary);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.15s;
}
.drawer-close:hover { color: var(--lt-text-primary); background: var(--lt-bg-page); }

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.drawer-answer {
  font-size: 14px;
  line-height: 1.7;
}

.drawer-clarify-hint {
  text-align: center;
  padding: 24px 0;
  color: var(--lt-text-secondary);
  font-size: 14px;
}

.drawer-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--lt-border);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.drawer-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--lt-danger);
  padding: 4px 0;
}

/* 过渡动画 */
.drawer-enter-active { transition: all 0.3s ease; }
.drawer-leave-active { transition: all 0.2s ease; }
.drawer-enter-from { opacity: 0; }
.drawer-enter-from .drawer-panel { transform: translateX(100%); }
.drawer-enter-to { opacity: 1; }
.drawer-enter-to .drawer-panel { transform: translateX(0); }
.drawer-leave-from { opacity: 1; }
.drawer-leave-from .drawer-panel { transform: translateX(0); }
.drawer-leave-to { opacity: 0; }
.drawer-leave-to .drawer-panel { transform: translateX(100%); }

@media (max-width: 768px) {
  .drawer-overlay { align-items: flex-end; }
  .drawer-panel {
    width: 100vw;
    height: 70vh;
    border-radius: 20px 20px 0 0;
  }
  .drawer-enter-from .drawer-panel { transform: translateY(100%); }
  .drawer-enter-to .drawer-panel { transform: translateY(0); }
  .drawer-leave-from .drawer-panel { transform: translateY(0); }
  .drawer-leave-to .drawer-panel { transform: translateY(100%); }
}
</style>
