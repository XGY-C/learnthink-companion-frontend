<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { ElMessage } from 'element-plus'
import { Camera, Message, Plus } from '@element-plus/icons-vue'

const userStore = useUserStore()

const form = ref({
  displayName: '',
  bio: '',
  major: '',
  grade: ''
})

const saving = ref(false)
const uploading = ref(false)
const loading = ref(true)
const loadError = ref(false)

const avatarUrl = computed(() => userStore.userInfo?.avatarUrl || '')
const userEmail = computed(() => userStore.userInfo?.email || '')
const createdAt = computed(() => userStore.userInfo?.createdAt || '')

const hasChanges = computed(() => {
  const info = userStore.userInfo
  return (
    form.value.displayName !== (info?.displayName || '') ||
    form.value.bio !== (info?.bio || '') ||
    form.value.major !== (info?.major || '') ||
    form.value.grade !== (info?.grade || '')
  )
})

onMounted(() => {
  loadProfile()
})

async function loadProfile() {
  loading.value = true
  loadError.value = false
  try {
    await userStore.fetchMe()
    const info = userStore.userInfo
    if (info) {
      form.value.displayName = info.displayName || ''
      form.value.bio = info.bio || ''
      form.value.major = info.major || ''
      form.value.grade = info.grade || ''
    }
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

async function handleAvatarChange(file: File) {
  uploading.value = true
  const url = await userStore.uploadAvatar(file)
  uploading.value = false
  if (url) {
    ElMessage.success('头像已更新')
  } else {
    ElMessage.error('头像上传失败')
  }
}

async function handleSave() {
  saving.value = true
  const result = await userStore.updateProfile({
    displayName: form.value.displayName || undefined,
    bio: form.value.bio || undefined,
    major: form.value.major || undefined,
    grade: form.value.grade || undefined
  })
  saving.value = false
  if (result) {
    ElMessage.success('个人资料已保存')
  } else {
    ElMessage.error('保存失败，请重试')
  }
}

function beforeAvatarUpload(file: File) {
  const isImage = file.type === 'image/png' || file.type === 'image/jpeg'
  const isLt2M = file.size / 1024 / 1024 < 2
  if (!isImage) {
    ElMessage.error('仅支持 JPG 和 PNG 格式')
    return false
  }
  if (!isLt2M) {
    ElMessage.error('头像文件不能超过 2MB')
    return false
  }
  handleAvatarChange(file)
  return false // 阻止 el-upload 自动上传
}

const gradeOptions = [
  '大一', '大二', '大三', '大四',
  '研一', '研二', '研三',
  '博士', '已毕业', '其他'
]
</script>

<template>
  <div class="max-w-lg">
    <!-- 加载中 -->
    <div v-if="loading" class="flex items-center justify-center h-48">
      <el-icon class="is-loading" :size="28" style="color: var(--lt-brand);"><Plus /></el-icon>
    </div>

    <!-- 加载失败 -->
    <div v-else-if="loadError" class="text-center py-12">
      <p class="text-sm mb-4" style="color: var(--lt-text-auxiliary);">加载个人信息失败</p>
      <el-button size="small" @click="loadProfile()">重试</el-button>
    </div>

    <!-- 正常内容 -->
    <template v-else>
    <!-- 头像横幅 -->
    <div
      class="rounded-xl p-5 mb-6 flex items-center gap-5 group info-banner"
      style="background: linear-gradient(135deg, var(--lt-bg-page) 0%, var(--lt-brand-lightest) 100%); border: 1px solid var(--lt-border);"
    >
      <el-upload
        :show-file-list="false"
        :before-upload="beforeAvatarUpload"
        accept="image/png,image/jpeg"
        class="avatar-uploader"
      >
        <div class="relative cursor-pointer">
          <el-avatar
            :size="72"
            :src="avatarUrl"
            class="ring-2 ring-white transition-shadow"
          >
            {{ userStore.userInfo?.displayName?.charAt(0) || userStore.userInfo?.username?.charAt(0) || 'U' }}
          </el-avatar>
          <div
            class="absolute inset-0 rounded-full flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100"
            style="background-color: rgba(0,0,0,0.25);"
          >
            <el-icon color="white" :size="18"><Camera /></el-icon>
          </div>
        </div>
      </el-upload>
      <div class="flex-1 min-w-0">
        <p class="text-base font-semibold mb-2" style="color: var(--lt-text-primary);">
          {{ userStore.userInfo?.displayName || userStore.userInfo?.username || '用户' }}
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <span v-if="userStore.userInfo?.major" class="info-pill" style="background: var(--lt-brand-lightest); color: var(--lt-brand);">
            {{ userStore.userInfo.major }}
          </span>
          <span v-if="userStore.userInfo?.grade" class="info-pill" style="background: var(--lt-bg-page); color: var(--lt-text-secondary);">
            {{ userStore.userInfo.grade }}
          </span>
          <span v-if="userEmail" class="info-pill text-xs" style="background: var(--lt-bg-page); color: var(--lt-text-auxiliary);">
            <el-icon :size="12" class="mr-0.5"><Message /></el-icon>
            {{ userEmail }}
          </span>
        </div>
        <p v-if="uploading" class="text-xs mt-2" style="color: var(--lt-brand);">上传中...</p>
      </div>
    </div>

    <!-- 表单 -->
    <el-form label-position="top" class="space-y-4">
      <el-form-item label="昵称">
        <el-input
          v-model="form.displayName"
          placeholder="你的昵称（2-20字）"
          maxlength="20"
          show-word-limit
        />
      </el-form-item>

      <el-form-item label="专业方向">
        <el-input
          v-model="form.major"
          placeholder="例如：软件工程"
          maxlength="50"
        />
      </el-form-item>

      <el-form-item label="年级">
        <el-select v-model="form.grade" placeholder="选择年级" clearable class="w-full">
          <el-option
            v-for="g in gradeOptions"
            :key="g"
            :label="g"
            :value="g"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="个人简介">
        <el-input
          v-model="form.bio"
          type="textarea"
          :rows="3"
          placeholder="简单介绍一下自己..."
          maxlength="200"
          show-word-limit
        />
      </el-form-item>

      <!-- 只读信息 -->
      <div class="pt-4 mt-4" style="border-top: 1px solid var(--lt-border);">
        <div class="flex items-center justify-between py-2">
          <span class="text-sm" style="color: var(--lt-text-auxiliary);">注册时间</span>
          <span class="text-sm" style="color: var(--lt-text-placeholder);">{{ createdAt || '—' }}</span>
        </div>
      </div>

      <div class="pt-4">
        <el-button
          type="primary"
          :disabled="!hasChanges"
          :loading="saving"
          @click="handleSave"
        >
          保存修改
        </el-button>
      </div>
    </el-form>
    </template>
  </div>
</template>

<style scoped>
:deep(.el-form-item__label) {
  color: var(--lt-text-secondary);
  font-size: 0.875rem;
  font-weight: 500;
}

.avatar-uploader :deep(.el-avatar) {
  background: linear-gradient(135deg, var(--lt-brand), var(--lt-brand-dark));
}

/* ========== 头像横幅 ========== */
.info-banner {
  position: relative;
  overflow: hidden;
}

.info-banner::before {
  content: '';
  position: absolute;
  top: -40px;
  right: -40px;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--lt-brand-lightest) 0%, transparent 70%);
  opacity: 0.6;
  pointer-events: none;
}

.info-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.75rem;
  line-height: 1.4;
  white-space: nowrap;
}
</style>
