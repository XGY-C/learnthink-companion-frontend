<script setup lang="ts">
/**
 * 维度来源标记：explicit（用户明确表述）/ inferred（系统推断）。
 * 视觉：蓝色实心圆 / 紫色虚线圈，带 tooltip。
 */
defineProps<{
  source?: 'explicit' | 'inferred' | string
}>()
</script>

<template>
  <el-tooltip
    v-if="source === 'explicit'"
    content="用户明确表述"
    placement="top"
  >
    <span class="src-mark src-explicit" aria-label="用户明确表述" />
  </el-tooltip>
  <el-tooltip
    v-else-if="source === 'inferred'"
    content="系统推断"
    placement="top"
  >
    <span class="src-mark src-inferred" aria-label="系统推断" />
  </el-tooltip>
</template>

<style scoped>
.src-mark {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  vertical-align: middle;
}
.src-explicit {
  background-color: var(--lt-brand);
}
.src-inferred {
  background-color: transparent;
  border: 1px dashed var(--lt-ai);
}
</style>
