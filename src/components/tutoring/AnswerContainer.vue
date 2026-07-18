<script setup lang="ts">
import { computed } from 'vue'
import { useTutoringStore } from '@/stores/tutoring'
import SectionCard from './SectionCard.vue'
import type { SectionState } from '@/types/tutoring'

const props = defineProps<{
  sections?: SectionState[]
  readOnly?: boolean
}>()

const store = useTutoringStore()

const emit = defineEmits<{
  action: [sectionId: string, action: string, instruction?: string]
}>()

const sectionList = computed(() => props.sections?.length ? props.sections : store.sectionList)
const hasSections = computed(() => sectionList.value.length > 0)

function resolveSection(id: string) {
  return sectionList.value.find(section => section.id === id)
}
</script>

<template>
  <div class="answer-container">
    <!-- 有 section 时渲染列表 -->
    <template v-if="hasSections">
      <SectionCard
        v-for="section in sectionList"
        :key="section.id"
        :sectionId="section.id"
        :section="resolveSection(section.id)"
        :showActions="!props.readOnly"
        @action="(sid, action, instruction) => emit('action', sid, action, instruction)"
      />
    </template>

    <!-- 无 section 时的空状态 -->
    <div v-else-if="store.status === 'generating'" class="answer-empty">
      <p>等待解答内容...</p>
    </div>
  </div>
</template>

<style scoped>
.answer-container {
  width: 100%;
}

.answer-empty {
  text-align: center;
  padding: 40px 0;
  font-size: 14px;
  color: var(--lt-text-auxiliary);
}
</style>
