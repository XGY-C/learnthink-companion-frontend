<template>
  <Transition name="fade-up">
    <div v-if="visible" class="interact-bar">
      <p class="hint">{{ hint }}</p>
      <button class="continue-btn" @click="$emit('confirm')">
        继续讲解 →
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{ visible: boolean; hint: string }>()
defineEmits<{ confirm: [] }>()
</script>

<style scoped>
.interact-bar {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  z-index: 10;
  padding: 16px 24px;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
}

.hint {
  margin: 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
  line-height: 1.5;
}

.continue-btn {
  padding: 10px 28px;
  border: none;
  border-radius: 10px;
  background: var(--lt-brand, #2B6FFF);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.continue-btn:hover {
  background: var(--lt-brand-dark, #1a5ad7);
  transform: scale(1.04);
}

.continue-btn:active {
  transform: scale(0.97);
}

/* Transition */
.fade-up-enter-active {
  transition: all 0.35s cubic-bezier(0.2, 0, 0, 1);
}
.fade-up-leave-active {
  transition: all 0.2s ease-out;
}
.fade-up-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}
.fade-up-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}

/* 移动端适配 */
@media (max-width: 767px) {
  .interact-bar {
    bottom: 100px;
    padding: 14px 20px;
  }
  .continue-btn {
    padding: 12px 36px;
    font-size: 16px;
  }
}
</style>
