<script setup lang="ts">
/**
 * Mobile TocBottomSheet — 教材章节目录 BottomSheet
 */
import { computed } from 'vue'
import type { ChapterNode } from '@/types'
import BottomSheet from '@/components/mobile/BottomSheet.vue'

const props = defineProps<{
  modelValue: boolean
  title: string
  introduction?: string
  toc: ChapterNode[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const hasContent = computed(() => props.introduction || props.toc.length > 0)
</script>

<template>
  <BottomSheet
    :model-value="modelValue"
    height="large"
    :title="title"
    :show-close="true"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="!hasContent" class="toc-empty">暂无教材信息</div>
    <template v-else>
      <div v-if="introduction" class="toc-section">
        <h4 class="toc-section-title">内容简介</h4>
        <p class="toc-intro">{{ introduction }}</p>
      </div>
      <div v-if="toc.length > 0" class="toc-section">
        <h4 class="toc-section-title">章节目录</h4>
        <div class="toc-tree">
          <template v-for="node in toc" :key="node.title">
            <div class="toc-node chapter">{{ node.title }}</div>
            <template v-if="node.children">
              <div v-for="child in node.children" :key="child.title" class="toc-node section">{{ child.title }}</div>
              <template v-for="child in node.children" :key="'sub-' + child.title">
                <div v-for="sub in (child.children || [])" :key="sub.title" class="toc-node subsection">{{ sub.title }}</div>
              </template>
            </template>
          </template>
        </div>
      </div>
    </template>
  </BottomSheet>
</template>

<style scoped>
.toc-empty { text-align: center; font-size: 13px; color: var(--lt-text-placeholder); padding: 40px 0; }
.toc-section { margin-bottom: 16px; }
.toc-section-title { font-size: 13px; font-weight: 600; color: var(--lt-text-secondary); margin: 0 0 8px; }
.toc-intro { font-size: 13px; color: var(--lt-text-primary); line-height: 1.6; margin: 0; white-space: pre-wrap; }
.toc-tree { max-height: 50vh; overflow-y: auto; }
.toc-node { padding: 6px 0; border-bottom: 1px solid var(--lt-border); font-size: 13px; }
.toc-node:last-child { border-bottom: none; }
.toc-node.chapter { font-weight: 600; color: var(--lt-text-primary); }
.toc-node.section { padding-left: 16px; color: var(--lt-text-secondary); }
.toc-node.subsection { padding-left: 32px; color: var(--lt-text-auxiliary); font-size: 12px; }
</style>
