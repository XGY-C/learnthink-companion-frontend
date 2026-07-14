<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useForumStore } from '@/stores/forum'
import { useProfileStore } from '@/stores/profile'
import { useUserStore } from '@/stores/user'
import ForumEditor from '@/components/forum/ForumEditor.vue'
import ForumTagChips from '@/components/forum/ForumTagChips.vue'
import { ArrowLeft } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const store = useForumStore()
const profileStore = useProfileStore()
const userStore = useUserStore()
const postId = computed(() => route.params.id as string)

const form = reactive({
  courseId: '',
  title: '',
  content: '',
  tagIds: [] as string[],
  type: 'post',
  resourceItemIds: [] as string[],
  files: [] as any[],
})

const submitting = ref(false)
const loading = ref(true)

onMounted(async () => {
  await store.fetchTags()
  if (postId.value) {
    const post = await store.fetchPostDetail(postId.value)
    if (post) {
      if (post.userId !== userStore.userInfo?.id) {
        ElMessage.error({ message: '无权编辑此帖子' })
        router.push('/forum')
        return
      }
      form.courseId = post.courseId
      form.title = post.title
      form.content = post.content
      form.tagIds = store.tags.filter(t => (post.tags || []).includes(t.name)).map(t => t.id)
      form.type = post.type
      form.resourceItemIds = post.resources?.map(r => r.resourceItemId) || []
      form.files = post.files ? [...post.files] : []
    }
  }
  loading.value = false
})

function handleTagToggle(tagId: string) {
  const idx = form.tagIds.indexOf(tagId)
  if (idx >= 0) form.tagIds.splice(idx, 1)
  else form.tagIds.push(tagId)
}

async function handleSubmit() {
  if (!form.title.trim() || !form.content.trim()) {
    ElMessage.warning({ message: '请填写标题和内容' })
    return
  }
  submitting.value = true
  try {
    await store.updatePost(postId.value, {
      title: form.title,
      content: form.content,
      tagIds: form.tagIds,
      type: form.type,
      resourceItemIds: form.resourceItemIds,
      files: form.files,
    })
    ElMessage.success({ message: '编辑成功' })
    router.push(`/forum/${postId.value}`)
  } catch (e: any) {
    ElMessage.error({ message: e?.message || '编辑失败' })
  } finally { submitting.value = false }
}
</script>

<template>
  <div class="edit-post-page">
    <div class="max-w-[860px] mx-auto">
      <div v-if="loading" class="flex justify-center py-20">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
      </div>

      <template v-else>
        <div class="flex items-center gap-2 mb-6">
          <el-button text :icon="ArrowLeft" @click="router.push(`/forum/${postId}`)">返回</el-button>
          <h1 class="text-xl font-bold m-0" style="color: var(--lt-text-primary);">编辑帖子</h1>
        </div>

        <div class="form-card card-elevated p-6 rounded-lg">
          <el-form label-position="top" size="large">
            <el-form-item label="课程">
              <el-select v-model="form.courseId" placeholder="选择课程" style="width: 100%;">
                <el-option label="全站" value="" />
                <el-option v-for="c in profileStore.courses" :key="c.id" :label="c.name" :value="c.id" />
              </el-select>
            </el-form-item>

            <el-form-item label="标题" required>
              <el-input v-model="form.title" placeholder="输入帖子标题" maxlength="200" show-word-limit />
            </el-form-item>

            <el-form-item label="标签">
              <ForumTagChips :tags="store.tags" :selected-tag-ids="form.tagIds" @toggle="handleTagToggle" />
            </el-form-item>

            <el-form-item label="内容" required>
              <ForumEditor v-model="form.content" v-model:files="form.files" v-model:resource-item-ids="form.resourceItemIds" />
            </el-form-item>

            <el-form-item class="mt-4 mb-0">
              <div class="flex items-center gap-3 w-full justify-end">
                <el-button @click="router.push(`/forum/${postId}`)">取消</el-button>
                <el-button type="primary" :loading="submitting" @click="handleSubmit" size="large" class="px-8">
                  保存修改
                </el-button>
              </div>
            </el-form-item>
          </el-form>
        </div>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import { Loading } from '@element-plus/icons-vue'
export default { components: { Loading } }
</script>

<style scoped>
.edit-post-page {
  padding: 24px 32px;
}
.form-card {
  background: var(--lt-bg-card);
}
</style>
