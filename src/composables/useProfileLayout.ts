/**
 * 画像展示响应式布局参数。
 * 详见 docs/画像展示设计方案_v2.md §8。
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'

export function useProfileLayout() {
  const width = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)

  function onResize() {
    width.value = window.innerWidth
  }

  onMounted(() => {
    window.addEventListener('resize', onResize)
  })
  onUnmounted(() => {
    window.removeEventListener('resize', onResize)
  })

  const isSm = computed(() => width.value < 640)
  const isMd = computed(() => width.value >= 640 && width.value < 1024)
  const isLg = computed(() => width.value >= 1024)

  /** 知识树默认展开科目数：sm=0（手动展开）, md=1, lg=Infinity */
  const defaultExpandedSubjects = computed(() => isSm.value ? 0 : isMd.value ? 1 : Infinity)
  /** 标签云每行最大数量 */
  const tagsPerRow = computed(() => isSm.value ? 4 : isMd.value ? 8 : Infinity)

  return {
    width, isSm, isMd, isLg,
    defaultExpandedSubjects, tagsPerRow,
  }
}
