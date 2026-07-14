<script setup lang="ts">
import { useNoteStore } from '@/stores/note'
import NoteCard from '@/components/notes/NoteCard.vue'
import NoteInput from '@/components/notes/NoteInput.vue'
import BottomSheet from '@/components/mobile/BottomSheet.vue'
import EmptyState from '@/components/EmptyState.vue'
import { EditPen } from '@element-plus/icons-vue'

const props = defineProps<{
  courseId: string
  sectionTitle?: string
  resourcePackId?: string
  resourceTitle?: string
  selectedText?: string
  anchorId?: string
  textRange?: string
}>()

const noteStore = useNoteStore()
</script>

<template>
  <BottomSheet
    :model-value="noteStore.sidebarOpen"
    height="large"
    :title="`📔 笔记本 (${noteStore.availableCount})`"
    :show-close="true"
    @update:model-value="(v) => { if (!v) noteStore.closeSidebar() }"
  >
    <EmptyState
      v-if="noteStore.availableCount === 0"
      :icon="EditPen"
      title="暂无笔记"
      description="点击下方开始记录"
      size="default"
    />
    <div v-else>
      <NoteCard
        v-for="note in noteStore.notes"
        :key="note.id"
        :note="note"
        @deleted="noteStore.deleteNote(note.id)"
        @updated="(c) => noteStore.updateNote(note.id, { content: c })"
      />
    </div>
    <NoteInput
      :course-id="props.courseId"
      :section-title="props.sectionTitle"
      :resource-pack-id="props.resourcePackId"
      :resource-title="props.resourceTitle"
      :selected-text="props.selectedText"
      :anchor-id="props.anchorId"
      :text-range="props.textRange"
    />
  </BottomSheet>
</template>
