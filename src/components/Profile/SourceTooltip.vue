<script setup lang="ts">
/**
 * 维度来源追溯 Popover。
 * 点击触发器（默认是一个小图标按钮）弹出，懒加载该维度的 profile_signals。
 *
 * 数据：来自 store.fetchSignals(dimension)，详见 §四·4.2。
 *  - source = explicit/inferred 是维度级总判定
 *  - 单条 signal.source 是更细的来源类型（user_said / behavior / ...）
 */
import { computed, ref, watch } from 'vue'
import { Document, ChatLineRound, DataLine, Aim, MagicStick, Loading } from '@element-plus/icons-vue'
import { useProfileStore } from '@/stores/profile'
import type { ProfileDimensionKey, SignalSource } from '@/types'

const props = defineProps<{
  dimension: ProfileDimensionKey
  /** 触发器位置；默认 top */
  placement?: 'top' | 'bottom' | 'left' | 'right'
}>()

const profile = useProfileStore()

const visible = ref(false)

const cacheKey = computed(() => `${profile.activeCourseId}::${props.dimension}`)
const items = computed(() => profile.signalsCache[cacheKey.value] ?? [])
const loading = computed(() => profile.signalsLoading[cacheKey.value] ?? false)
const error = computed(() => profile.signalsError[cacheKey.value] ?? null)

watch(visible, async v => {
  if (v && !profile.signalsCache[cacheKey.value]) {
    await profile.fetchSignals(props.dimension)
  }
})

const SOURCE_META: Record<SignalSource, { label: string; color: string; icon: any }> = {
  user_said:        { label: '用户表述', color: 'var(--lt-brand)',   icon: ChatLineRound },
  user_corrected:   { label: '用户纠正', color: 'var(--lt-success)', icon: Aim },
  learning_result:  { label: '学习结果', color: 'var(--lt-warning)', icon: DataLine },
  behavior:         { label: '行为推断', color: 'var(--lt-orange)',  icon: DataLine },
  llm_inferred:     { label: 'AI 推断',  color: 'var(--lt-ai)',      icon: MagicStick },
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const now = Date.now()
  const diff = now - d.getTime()
  const min = Math.round(diff / 60_000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} 小时前`
  const day = Math.round(h / 24)
  if (day < 7) return `${day} 天前`
  return d.toLocaleDateString()
}
</script>

<template>
  <el-popover
    v-model:visible="visible"
    :placement="placement ?? 'top'"
    :width="280"
    trigger="click"
    popper-class="src-tt-popper"
  >
    <template #reference>
      <button class="src-tt-trigger" type="button" :aria-label="`查看 ${dimension} 来源`">
        <el-icon :size="11"><Document /></el-icon>
      </button>
    </template>

    <div class="src-tt-body">
      <div class="src-tt-head">
        <span class="src-tt-title">来源追溯</span>
        <span v-if="!loading && !error" class="src-tt-count">{{ items.length }} 条</span>
      </div>

      <div v-if="loading" class="src-tt-loading">
        <el-icon class="is-loading" :size="14"><Loading /></el-icon>
        <span>加载中...</span>
      </div>

      <div v-else-if="error" class="src-tt-error">
        <span>{{ error }}</span>
        <el-button link type="primary" size="small" @click="profile.fetchSignals(dimension)">重试</el-button>
      </div>

      <div v-else-if="items.length === 0" class="src-tt-empty">
        暂无来源记录
      </div>

      <ul v-else class="src-tt-list">
        <li v-for="sig in items" :key="sig.id" class="src-tt-item">
          <div class="src-tt-item-head">
            <span
              class="src-tt-tag"
              :style="{ color: SOURCE_META[sig.source].color, borderColor: SOURCE_META[sig.source].color }"
            >
              <el-icon :size="10"><component :is="SOURCE_META[sig.source].icon" /></el-icon>
              {{ SOURCE_META[sig.source].label }}
            </span>
            <span class="src-tt-time">{{ formatTime(sig.created_at) }}</span>
          </div>
          <p class="src-tt-value">{{ sig.value }}</p>
          <p v-if="sig.chat_id" class="src-tt-meta">来自对话 {{ sig.chat_id }}</p>
        </li>
      </ul>
    </div>
  </el-popover>
</template>

<style scoped>
.src-tt-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 1px solid var(--lt-border);
  background: var(--lt-bg-card);
  color: var(--lt-text-auxiliary);
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
  transition: all 0.15s;
}
.src-tt-trigger:hover {
  color: var(--lt-brand);
  border-color: var(--lt-brand-light-7, rgba(43,111,255,0.3));
  background: var(--lt-brand-lightest);
}

.src-tt-body { font-size: 12px; }
.src-tt-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 6px;
  border-bottom: 1px solid var(--lt-border);
  margin-bottom: 6px;
}
.src-tt-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--lt-text-primary);
}
.src-tt-count {
  font-size: 11px;
  color: var(--lt-text-auxiliary);
  font-variant-numeric: tabular-nums;
}
.src-tt-loading,
.src-tt-error,
.src-tt-empty {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 16px 4px;
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  justify-content: center;
}
.src-tt-error { color: var(--lt-danger); }

.src-tt-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 280px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.src-tt-item {
  padding: 6px 8px;
  background: var(--lt-bg-page);
  border-radius: 6px;
}
.src-tt-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.src-tt-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  border: 1px solid currentColor;
  background: transparent;
}
.src-tt-time {
  font-size: 10px;
  color: var(--lt-text-auxiliary);
  font-variant-numeric: tabular-nums;
}
.src-tt-value {
  font-size: 12px;
  color: var(--lt-text-primary);
  margin: 0;
  line-height: 1.5;
}
.src-tt-meta {
  font-size: 10px;
  color: var(--lt-text-placeholder);
  margin: 2px 0 0;
}
</style>
