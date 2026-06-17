<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTutoringStore } from '@/stores/tutoring'
import { useTutoringSSE } from '@/composables/useTutoringSSE'
import { getTutoringSessionDetail } from '@/api/tutoring'
import type { SectionState } from '@/types/tutoring'
import TutoringTopBar from '@/components/tutoring/TutoringTopBar.vue'
import TutoringMain from '@/components/tutoring/TutoringMain.vue'

const route = useRoute()
const router = useRouter()
const store = useTutoringStore()
const { startTutoring } = useTutoringSSE()

const sessionId = computed(() => route.params.sessionId as string)
const questionFromQuery = computed(() => route.query.question as string | undefined)
const routeChatId = computed(() => route.query.chatId as string | undefined)

// Watch for sessionId assignment → replace URL
watch(
  () => store.sessionId,
  (sid) => {
    if (sid && (sessionId.value === 'new' || sessionId.value === 'init')) {
      router.replace(`/tutoring/${sid}`)
    }
  }
)

onMounted(async () => {
  if (sessionId.value === 'new') {
    // New session from entry — auto-start tutoring
    const q = questionFromQuery.value || ''
    await startTutoring({
      question: q,
      chatId: routeChatId.value || null,
    })
    return
  }

  if (sessionId.value && sessionId.value !== 'init') {
    try {
      const res = await getTutoringSessionDetail(sessionId.value)
      if (res.code === 0 || res.code === 200) {
        const detail = res.data
        store.sessionId = detail.sessionId
        store.mode = detail.mode
        store.analysis = detail.analysis
        store.resources = detail.resources
        store.status = 'done'
        if (detail.sections) {
          const sectionsMap: Record<string, SectionState> = {}
          const order: string[] = []
          for (const s of detail.sections) {
            sectionsMap[s.id] = s
            order.push(s.id)
          }
          store.sections = sectionsMap
          store.sectionOrder = order
        }
      }
    } catch {
      /* ignore */
    }
  } else if (questionFromQuery.value) {
    await startTutoring({ question: questionFromQuery.value })
  }
})

onUnmounted(() => {
  store.reset()
})

function handleBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/chat')
  }
}
</script>

<template>
  <div
    class="tutoring-page"
    style="min-height: 100vh; background: var(--lt-bg-page); display: flex; flex-direction: column;"
  >
    <TutoringTopBar @back="handleBack" />
    <TutoringMain />
  </div>
</template>
