<script setup lang="ts">
/**
 * 用户纠错对话框：确认 / 纠正 / 否认。
 *
 * 设计要点：
 *  - 确认：仅记录"用户确认了该值"（写一条 source=user_corrected 的 signal，但 value 与原值一致）
 *  - 纠正：用户输入新值，后端会以新值覆盖该维度
 *  - 否认：用户认为该项不适用，后端可标记 status=discarded
 *
 * 提交逻辑走 store.correctProfile（当前为 mock）。后端就绪后只需替换 store 内 TODO。
 */
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useProfileStore } from '@/stores/profile'
import type { ProfileDimensionKey, CorrectAction } from '@/types'

const props = defineProps<{
  modelValue: boolean
  dimension: ProfileDimensionKey
  /** 维度展示名（如 "知识基础"） */
  dimensionLabel: string
  /** 当前值（用于显示在对话框头部，可选） */
  originalValue?: string
  signalKey?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  /** 纠错成功后通知父组件刷新 */
  'corrected': [action: CorrectAction]
}>()

const profile = useProfileStore()

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const action = ref<CorrectAction>('confirm')
const correctedValue = ref('')
const note = ref('')

// 重置：每次打开恢复初始状态，避免上次输入残留
watch(visible, v => {
  if (v) {
    action.value = 'confirm'
    correctedValue.value = props.originalValue ?? ''
    note.value = ''
  }
})

const submitDisabled = computed(() => {
  if (profile.correctSubmitting) return true
  if (action.value === 'correct' && !correctedValue.value.trim()) return true
  return false
})

async function handleSubmit() {
  const ok = await profile.correctProfile({
    dimension: props.dimension,
    signal_key: props.signalKey,
    original_value: props.originalValue,
    action: action.value,
    corrected_value: action.value === 'correct' ? correctedValue.value.trim() : undefined,
    note: action.value === 'deny' ? note.value.trim() || undefined : undefined,
  })
  if (ok) {
    ElMessage.success(
      action.value === 'confirm' ? '已确认'
      : action.value === 'correct' ? '已提交纠正'
      : '已记录否认'
    )
    emit('corrected', action.value)
    visible.value = false
  } else {
    ElMessage.error('提交失败，请稍后再试')
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="`纠正：${dimensionLabel}`"
    width="420px"
    align-center
    append-to-body
  >
    <div class="cd-body">
      <p v-if="originalValue" class="cd-original">
        <span class="cd-original-label">系统当前记录</span>
        <span class="cd-original-value">{{ originalValue }}</span>
      </p>

      <el-radio-group v-model="action" class="cd-actions">
        <el-radio value="confirm" class="cd-action-item">
          <span class="cd-action-title">✓ 确认无误</span>
          <span class="cd-action-desc">告诉系统这条信息是准确的</span>
        </el-radio>
        <el-radio value="correct" class="cd-action-item">
          <span class="cd-action-title">✎ 提供更准确的信息</span>
          <span class="cd-action-desc">用我提供的内容覆盖</span>
        </el-radio>
        <el-radio value="deny" class="cd-action-item">
          <span class="cd-action-title">✗ 不适用</span>
          <span class="cd-action-desc">这条信息我不认同，请系统忽略</span>
        </el-radio>
      </el-radio-group>

      <div v-if="action === 'correct'" class="cd-form">
        <el-input
          v-model="correctedValue"
          type="textarea"
          :rows="3"
          placeholder="请输入更准确的内容..."
          maxlength="200"
          show-word-limit
        />
      </div>

      <div v-else-if="action === 'deny'" class="cd-form">
        <el-input
          v-model="note"
          type="textarea"
          :rows="2"
          placeholder="可选：补充说明为什么不适用..."
          maxlength="200"
          show-word-limit
        />
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button
        type="primary"
        :loading="profile.correctSubmitting"
        :disabled="submitDisabled"
        @click="handleSubmit"
      >
        提交
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.cd-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.cd-original {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: var(--lt-bg-page);
  border-left: 2px solid var(--lt-brand);
  border-radius: 4px;
  margin: 0;
}
.cd-original-label {
  font-size: 11px;
  color: var(--lt-text-auxiliary);
}
.cd-original-value {
  font-size: 13px;
  color: var(--lt-text-primary);
  line-height: 1.5;
}
.cd-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}
.cd-action-item {
  height: auto !important;
  padding: 8px 10px;
  border: 1px solid var(--lt-border);
  border-radius: 6px;
  margin: 0 !important;
  align-items: flex-start !important;
  transition: border-color 0.15s, background-color 0.15s;
}
.cd-action-item :deep(.el-radio__label) {
  display: flex;
  flex-direction: column;
  gap: 2px;
  white-space: normal;
  line-height: 1.4;
  padding-left: 6px;
}
.cd-action-item.is-checked {
  border-color: var(--lt-brand);
  background: var(--lt-brand-lightest);
}
.cd-action-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--lt-text-primary);
}
.cd-action-desc {
  font-size: 11px;
  color: var(--lt-text-auxiliary);
}
.cd-form {
  margin-top: 4px;
}
</style>
