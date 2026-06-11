<script setup lang="ts">
/**
 * MobileGenerationBar — 移动端生成确认/进度条
 * 固定在输入框上方的浮条，使用 GenerationCard 的数据接口但更紧凑
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = withDefaults(defineProps<{
  topic: string
  taskId: string
  status?: 'generating' | 'done' | 'failed'
  progress?: number
  message?: string
}>(), {
  status: 'generating',
  progress: 0,
  message: '',
})

const router = useRouter()

const progressPercent = computed(() => Math.round(props.progress || 0))

function handleClick() {
  router.push(`/studio/${props.taskId}`)
}

function handleDismiss() {
  /* emit close */
}
</script>

<template>
  <div class="m-gen-bar" :class="'m-gen-' + status" @click="handleClick">
    <div class="m-gen-bar-left">
      <span class="m-gen-bar-dot" :class="'m-dot-' + status" />
      <div class="m-gen-bar-info">
        <span class="m-gen-bar-topic">{{ topic }}</span>
        <span class="m-gen-bar-msg">{{ message || (status === 'generating' ? '生成中 (' + progressPercent + '%)' : status === 'done' ? '生成完成' : '生成失败') }}</span>
      </div>
    </div>
    <div class="m-gen-bar-right">
      <template v-if="status === 'generating'">
        <div class="m-gen-bar-ring">
          <svg viewBox="0 0 32 32" width="24" height="24">
            <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(43,111,255,0.15)" stroke-width="3" />
            <circle cx="16" cy="16" r="13" fill="none" stroke="var(--lt-brand)" stroke-width="3"
              stroke-linecap="round" stroke-dasharray="81.7"
              :stroke-dashoffset="81.7 - (progressPercent / 100) * 81.7" />
          </svg>
          <span class="m-gen-bar-pct">{{ progressPercent }}%</span>
        </div>
      </template>
      <template v-else-if="status === 'done'">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--lt-success)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
      </template>
      <template v-else>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--lt-danger)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      </template>
    </div>
  </div>
</template>

<style scoped>
.m-gen-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; border-radius: 10px;
  background: var(--lt-bg-card); border: 0.5px solid var(--lt-border);
  cursor: pointer; touch-action: manipulation;
  transition: background 0.1s;
}
.m-gen-bar:active { background: var(--lt-brand-lightest); }
.m-gen-bar-left { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
.m-gen-bar-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.m-dot-generating { background: var(--lt-brand); animation: m-pulse 1.5s ease-in-out infinite; }
.m-dot-done { background: var(--lt-success); }
.m-dot-failed { background: var(--lt-danger); }
@keyframes m-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
.m-gen-bar-info { display: flex; flex-direction: column; min-width: 0; }
.m-gen-bar-topic { font-size: 13px; font-weight: 600; color: var(--lt-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.m-gen-bar-msg { font-size: 11px; color: var(--lt-text-auxiliary); }
.m-gen-bar-right { display: flex; align-items: center; flex-shrink: 0; margin-left: 8px; }
.m-gen-bar-ring { position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }
.m-gen-bar-pct { position: absolute; font-size: 7px; font-weight: 700; color: var(--lt-brand); }
</style>
