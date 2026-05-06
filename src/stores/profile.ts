import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ProfileDimension } from '@/types'

export const useProfileStore = defineStore('profile', () => {
  const dimensions = ref<ProfileDimension[]>([
    { name: '代码能力', value: 70, category: 'mastery' },
    { name: '架构设计', value: 45, category: 'weakness' },
    { name: '算法基础', value: 60, category: 'mastery' },
    { name: '产品思维', value: 85, category: 'mastery' },
    { name: '工程规范', value: 30, category: 'weakness' },
    { name: '测试素养', value: 50, category: 'weakness' },
  ])

  const profileVersion = ref('v1.2')
  const updatedAt = ref('刚刚')

  const radarData = computed(() =>
    dimensions.value.map(d => ({ name: d.name, value: d.value }))
  )

  const tags = computed(() => ({
    weakness: dimensions.value.filter(d => d.category === 'weakness').map(d => d.name),
    mastered: dimensions.value.filter(d => d.category === 'mastery' && d.value >= 70).map(d => d.name),
    interest: ['前端工程化', 'Vue 生态', '性能优化'] as string[],
  }))

  const pace = computed(() => '15')
  const preference = computed(() => '代码实操优先')

  function updateDimension(name: string, newValue: number) {
    const dim = dimensions.value.find(d => d.name === name)
    if (dim) {
      dim.value = newValue
      dim.category = newValue >= 70 ? 'mastery' : newValue >= 40 ? 'mastery' : 'weakness'
      updatedAt.value = '刚刚'
    }
  }

  function updateFromDialog(messages: string[]) {
    // 模拟画像更新：从对话中提取维度变化
    profileVersion.value = 'v' + (parseFloat(profileVersion.value.replace('v', '')) + 0.1).toFixed(1)
    updatedAt.value = '刚刚'
  }

  return {
    dimensions, profileVersion, updatedAt,
    radarData, tags, pace, preference,
    updateDimension, updateFromDialog,
  }
})
