<script setup lang="ts">
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import ResourceCardEmbed from './ResourceCardEmbed.vue'
import type { ForumResource } from '@/types/forum'

defineProps<{
  content: string
  resources?: ForumResource[]
}>()
</script>

<template>
  <div class="forum-content">
    <div class="rich-content">
      <MarkdownViewer :content="content || ''" />
    </div>

    <div v-if="resources && resources.length > 0" class="resources-section mt-6">
      <h4 class="text-sm font-semibold mb-3 flex items-center gap-1" style="color: var(--lt-text-secondary);">
        📚 关联资源
      </h4>
      <div class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
        <ResourceCardEmbed
          v-for="r in resources" :key="r.id"
          :resource="r"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.forum-content {
  line-height: 1.8;
}
.rich-content {
  max-width: 100%;
  overflow-x: auto;
}
</style>
