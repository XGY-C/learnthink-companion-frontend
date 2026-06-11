<script setup lang="ts">
import { ref } from 'vue'
import type { PlaybackSpeed } from '@/types/scene'

const SPEEDS: PlaybackSpeed[] = [0.75, 1.0, 1.25, 1.5, 2.0]

const props = defineProps<{
  show: boolean
  isPlaying: boolean
  speed: PlaybackSpeed
  hasPrev: boolean
  hasNext: boolean
}>()

const emit = defineEmits<{
  'toggle-play': []
  'prev': []
  'next': []
  'skip-back': []
  'skip-forward': []
  'set-speed': [speed: PlaybackSpeed]
  'fullscreen': []
}>()

const speedMenuOpen = ref(false)

function toggleSpeedMenu() {
  speedMenuOpen.value = !speedMenuOpen.value
}

function selectSpeed(s: PlaybackSpeed) {
  speedMenuOpen.value = false
  emit('set-speed', s)
}

function closeSpeedMenu() {
  speedMenuOpen.value = false
}
</script>

<template>
  <div class="control-bar" :class="{ 'is-hidden': !show }">
    <div class="control-left">
      <button class="ctrl-btn" :disabled="!hasPrev" @click="emit('prev')" title="上一场景 (Shift+←)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>
        </svg>
      </button>
      <button class="ctrl-btn ctrl-play" @click="emit('toggle-play')" :title="isPlaying ? '暂停 (Space)' : '播放 (Space)'">
        <svg v-if="isPlaying" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
        </svg>
        <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      </button>
      <button class="ctrl-btn ctrl-skip" @click="emit('skip-back')" title="后退5秒 (←)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
        </svg>
        <span class="skip-label">5</span>
      </button>
      <button class="ctrl-btn ctrl-skip" @click="emit('skip-forward')" title="前进5秒 (→)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        <span class="skip-label">5</span>
      </button>
      <button class="ctrl-btn" :disabled="!hasNext" @click="emit('next')" title="下一场景 (Shift+→)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>
        </svg>
      </button>
    </div>
    <div class="control-right">
      <div class="speed-wrap" @mouseleave="closeSpeedMenu">
        <button class="ctrl-btn ctrl-speed" @click="toggleSpeedMenu" title="倍速">
          {{ speed }}x
          <svg class="speed-chevron" :class="{ open: speedMenuOpen }" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <div v-if="speedMenuOpen" class="speed-menu">
          <button
            v-for="s in SPEEDS"
            :key="s"
            class="speed-option"
            :class="{ active: s === speed }"
            @click="selectSpeed(s)"
          >
            {{ s }}x
            <svg v-if="s === speed" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
        </div>
      </div>
      <button class="ctrl-btn" @click="emit('fullscreen')" title="全屏 (F)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.control-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 16px;
  flex-shrink: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.5), rgba(0,0,0,0.2));
  opacity: 1;
  transition: opacity 0.3s, transform 0.3s;
  z-index: 5;
}
.control-bar.is-hidden {
  opacity: 0;
  pointer-events: none;
  transform: translateY(8px);
}
.control-left, .control-right {
  display: flex;
  align-items: center;
  gap: 4px;
}
.ctrl-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.15s;
}
.ctrl-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}
.ctrl-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
.ctrl-play {
  width: 44px;
  height: 44px;
  color: #fff;
}
.ctrl-play:hover {
  background: rgba(255, 255, 255, 0.15) !important;
}

/* Skip buttons */
.ctrl-skip {
  position: relative;
  width: 32px;
  height: 32px;
}
.ctrl-skip:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}
.skip-label {
  position: absolute;
  bottom: 2px;
  right: 4px;
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
  opacity: 0.7;
}

/* Speed button + dropdown */
.speed-wrap {
  position: relative;
}

.ctrl-speed {
  width: auto;
  padding: 0 8px 0 12px;
  gap: 3px;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.speed-chevron {
  transition: transform 0.2s;
  opacity: 0.6;
}
.speed-chevron.open {
  transform: rotate(180deg);
}

.speed-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(30, 30, 40, 0.96);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 80px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  animation: speed-menu-in 0.15s ease-out;
}

@keyframes speed-menu-in {
  from { opacity: 0; transform: translateX(-50%) translateY(6px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

.speed-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 7px 12px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.12s;
  white-space: nowrap;
}
.speed-option:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}
.speed-option.active {
  color: #fff;
  background: rgba(255, 255, 255, 0.06);
}
</style>
