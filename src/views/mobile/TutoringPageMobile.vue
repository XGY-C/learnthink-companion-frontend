<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTutoringStore } from '@/stores/tutoring'
import { useTutoringSSE } from '@/composables/useTutoringSSE'
import { getTutoringSessionDetail, getTutoringSessions } from '@/api/tutoring'
import { useProfileStore } from '@/stores/profile'
import type { TutoringSessionSummary, SectionState, ResourcesReadyPayload } from '@/types/tutoring'
import TutoringMain from '@/components/tutoring/TutoringMain.vue'
import TutoringInput from '@/components/tutoring/TutoringInput.vue'
import BottomSheet from '@/components/mobile/BottomSheet.vue'
import type { TutoringMode } from '@/types/tutoring'

const route = useRoute()
const router = useRouter()
const store = useTutoringStore()
const profile = useProfileStore()
const { startTutoring, cancel } = useTutoringSSE()

const sessionId = computed(() => route.params.sessionId as string)
const questionFromQuery = computed(() => route.query.question as string | undefined)

const showSessions = ref(false)
const sessions = ref<TutoringSessionSummary[]>([])
const sessionsLoading = ref(false)

watch(
  () => store.sessionId,
  (sid) => {
    if (sid && (!sessionId.value || sessionId.value === 'new')) {
      router.replace(`/tutoring/${sid}${location.search}`)
    }
  }
)

onMounted(async () => {
  if (!sessionId.value || sessionId.value === 'new') {
    await startTutoring({
      question: questionFromQuery.value || '',
      chatId: (route.query.chatId as string) || null,
      courseId: profile.activeCourseId,
    })
    return
  }
  if (sessionId.value) {
    try {
      const res = await getTutoringSessionDetail(sessionId.value)
      if (res.code === 0 || res.code === 200) {
        const detail = res.data
        store.sessionId = detail.sessionId
        store.mode = detail.mode
        store.analysis = detail.analysis
        store.resources = detail.resources as unknown as ResourcesReadyPayload
        store.status = 'done'
        if (detail.sections) {
          const sectionsMap: Record<string, SectionState> = {}
          const order: string[] = []
          for (const s of detail.sections) {
            sectionsMap[s.id] = { ...s }
            order.push(s.id)
          }
          store.sections = sectionsMap
          store.sectionOrder = order
        }
      }
    } catch { /* ignore */ }
  } else if (questionFromQuery.value) {
    await startTutoring({ question: questionFromQuery.value, courseId: profile.activeCourseId })
  }
})

onBeforeUnmount(() => {
  cancel()
  store.reset()
})

function handleSend(question: string, mode: TutoringMode) {
  if (store.isStreaming) return
  startTutoring({ question, mode, courseId: profile.activeCourseId })
}

async function loadSessions() {
  sessionsLoading.value = true
  try {
    const res = await getTutoringSessions(1)
    if (res.code === 0 || res.code === 200) {
      sessions.value = res.data.records || []
    }
  } catch { /* ignore */ }
  finally { sessionsLoading.value = false }
}

function switchSession(sid: string) {
  cancel()
  showSessions.value = false
  router.push(`/tutoring/${sid}`)
}

function handleBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/chat')
  }
}

const isBusy = computed(() => store.isStreaming)
</script>

<template>
  <div class="mobile-tutoring">
    <header class="mobile-header">
      <button class="mobile-header-btn" @click="handleBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div class="mobile-header-title">
        <h2 class="mobile-title-text">智能辅导</h2>
        <span v-if="store.sessionId && store.status !== 'idle'" class="mobile-title-status">
          {{ store.status === 'done' ? '辅导完成' : store.status === 'planning' ? '分析中…' : store.status === 'preparing' ? '准备中…' : store.status === 'generating' ? '生成中…' : store.status === 'clarifying' ? '等待确认' : store.status === 'guided' ? '引导中' : '' }}
        </span>
      </div>
      <button class="mobile-header-btn" @click="showSessions = true; loadSessions()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
    </header>

    <div class="mobile-content">
      <TutoringMain />
    </div>

    <div class="mobile-bottom-bar" :style="{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }">
      <TutoringInput
        :disabled="isBusy"
        placeholder="输入你的问题..."
        @send="handleSend"
      />
    </div>

    <BottomSheet
      v-model="showSessions"
      height="large"
      title="辅导会话"
      :show-close="true"
    >
      <div class="session-sheet-body">
        <div v-if="sessionsLoading" class="session-status-text">加载中...</div>
        <div v-else-if="sessions.length === 0" class="session-status-text">暂无历史会话</div>
        <div
          v-for="s in sessions"
          :key="s.sessionId"
          class="session-item"
          :class="{ active: s.sessionId === store.sessionId }"
          @click="switchSession(s.sessionId)"
        >
          <div class="session-item-question">{{ s.question }}</div>
          <div class="session-item-meta">
            {{ s.courseName || '' }}{{ s.chapterLabel ? ' · ' + s.chapterLabel : '' }}{{ s.createdAt ? ' · ' + s.createdAt : '' }}
          </div>
        </div>
      </div>
    </BottomSheet>
  </div>
</template>

<style scoped>
.mobile-tutoring {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--lt-bg-page);
}

.mobile-header {
  display: flex;
  align-items: center;
  padding: 8px 4px;
  background: var(--lt-bg-card);
  border-bottom: 0.5px solid var(--lt-border);
  flex-shrink: 0;
}

.mobile-header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  background: transparent;
  color: var(--lt-text-secondary);
  cursor: pointer;
  border-radius: 8px;
  flex-shrink: 0;
  touch-action: manipulation;
}
.mobile-header-btn:active {
  background-color: rgba(0,0,0,0.05);
}

.mobile-header-title {
  flex: 1;
  text-align: center;
  padding: 0 4px;
}

.mobile-title-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--lt-text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-title-status {
  font-size: 11px;
  color: var(--lt-text-auxiliary);
}

.mobile-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.mobile-content :deep(.tutoring-input-wrap) {
  display: none;
}

.mobile-bottom-bar {
  flex-shrink: 0;
  padding: 8px 12px;
  background: var(--lt-bg-card);
  border-top: 0.5px solid var(--lt-border);
}

.session-sheet-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.session-status-text {
  text-align: center;
  padding: 24px 0;
  font-size: 14px;
  color: var(--lt-text-auxiliary);
}

.session-item {
  padding: 14px 16px;
  border-radius: 10px;
  cursor: pointer;
  touch-action: manipulation;
}
.session-item.active {
  background: var(--lt-brand-lightest);
  border-left: 3px solid var(--lt-brand);
}
.session-item:not(.active):active {
  background: var(--lt-bg-page);
}

.session-item-question {
  font-size: 14px;
  font-weight: 500;
  color: var(--lt-text-primary);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-item-meta {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
}
</style>
