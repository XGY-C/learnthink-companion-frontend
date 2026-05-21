<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useAuth } from '@/composables/useAuth'
import { apiFetch } from '@/utils/api'
import { Lock } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const userStore = useUserStore()
const { logout } = useAuth()

const pwdForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})
const changing = ref(false)

async function handleChangePassword() {
  if (!pwdForm.oldPassword || !pwdForm.newPassword) {
    ElMessage.warning('请填写所有密码字段')
    return
  }
  if (pwdForm.newPassword.length < 8) {
    ElMessage.warning('新密码至少 8 位')
    return
  }
  if (pwdForm.newPassword !== pwdForm.confirmPassword) {
    ElMessage.warning('两次输入的新密码不一致')
    return
  }

  changing.value = true
  try {
    const res = await apiFetch('/user/password', {
      method: 'PUT',
      body: { oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword }
    })
    if (res.code === 0 || res.code === 200) {
      ElMessage.success('密码已修改，请重新登录')
      await logout()
      router.push('/login')
    } else {
      ElMessage.error(res.message || '修改失败')
    }
  } catch {
    ElMessage.error('密码修改失败')
  } finally {
    changing.value = false
  }
}

async function handleDeleteAccount() {
  try {
    await ElMessageBox.confirm(
      '注销后所有数据将被删除且无法恢复。确定要注销账号吗？',
      '注销账号',
      { confirmButtonText: '确定注销', cancelButtonText: '取消', type: 'error', confirmButtonClass: 'el-button--danger' }
    )
    await apiFetch('/user/me', { method: 'DELETE' })
    ElMessage.success('账号已注销')
    await logout()
    router.push('/login')
  } catch { /* 取消或失败 */ }
}
</script>

<template>
  <div class="max-w-md">
    <!-- 修改密码 -->
    <div class="rounded-xl border p-5 mb-6" style="border-color: var(--lt-border); background-color: var(--lt-bg-card);">
      <div class="flex items-center gap-2 mb-4">
        <span class="w-6 h-6 rounded flex items-center justify-center" style="background-color: var(--lt-brand-lightest);">
          <el-icon :size="12" style="color: var(--lt-brand);"><Lock /></el-icon>
        </span>
        <span class="text-sm font-medium" style="color: var(--lt-text-primary);">修改密码</span>
      </div>
      <el-form label-position="top" @submit.prevent="handleChangePassword">
        <el-form-item label="当前密码">
          <el-input v-model="pwdForm.oldPassword" type="password" show-password placeholder="输入当前密码" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="至少8位，含字母和数字" />
        </el-form-item>
        <el-form-item label="确认新密码">
          <el-input v-model="pwdForm.confirmPassword" type="password" show-password placeholder="再次输入新密码" />
        </el-form-item>
        <el-button type="primary" :loading="changing" @click="handleChangePassword">
          修改密码
        </el-button>
      </el-form>
    </div>

    <!-- 绑定信息 -->
    <div class="rounded-xl border p-5 mb-6" style="border-color: var(--lt-border); background-color: var(--lt-bg-card);">
      <div class="flex items-center gap-2 mb-3">
        <span class="w-6 h-6 rounded flex items-center justify-center" style="background-color: var(--lt-success);">
          <el-icon :size="12" color="white"><Lock /></el-icon>
        </span>
        <span class="text-sm font-medium" style="color: var(--lt-text-primary);">账号绑定</span>
      </div>
      <div class="flex items-center justify-between py-2">
        <span class="text-sm" style="color: var(--lt-text-auxiliary);">邮箱</span>
        <span class="text-sm flex items-center gap-1" style="color: var(--lt-text-primary);">
          {{ userStore.userInfo?.email || '—' }}
          <el-tag size="small" type="success" effect="plain">已绑定</el-tag>
        </span>
      </div>
    </div>

    <!-- 注销账号 -->
    <div class="rounded-xl border p-5" style="border-color: var(--lt-border); background-color: var(--lt-bg-card);">
      <div class="flex items-center gap-2 mb-1">
        <span class="w-6 h-6 rounded flex items-center justify-center" style="background-color: var(--lt-danger);">
          <el-icon :size="12" color="white"><Lock /></el-icon>
        </span>
        <span class="text-sm font-medium" style="color: var(--lt-text-primary);">注销账号</span>
      </div>
      <p class="text-xs mb-3" style="color: var(--lt-text-auxiliary);">
        注销后所有数据将被永久删除，无法恢复。
      </p>
      <el-button type="danger" plain @click="handleDeleteAccount">注销账号</el-button>
    </div>
  </div>
</template>

<style scoped>
:deep(.el-form-item__label) {
  color: var(--lt-text-secondary);
  font-size: 0.875rem;
  font-weight: 500;
}
</style>
