<script setup lang="ts">
defineProps<{ content: string; streaming?: boolean }>()
</script>

<template>
  <div class="answer-hero" :class="{ streaming }">
    <div class="hero-card">
      <div class="hero-label">📌 答案</div>
      <div class="hero-content" v-html="content || '等待生成...'" />
    </div>
  </div>
</template>

<style scoped>
.answer-hero {
  position: sticky;
  top: 64px;
  z-index: 10;
}

.hero-card {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(139, 92, 246, 0.08));
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 12px;
  padding: 16px 20px;
}

.hero-label {
  font-size: 12px;
  font-weight: 600;
  color: #a5b4fc;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.hero-content {
  font-size: 20px;
  font-weight: 700;
  color: #f1f5f9;
  line-height: 1.4;
}

.hero-content :deep(strong) { color: #c4b5fd; }
.hero-content :deep(code) {
  background: rgba(99, 102, 241, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}
</style>
