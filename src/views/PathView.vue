<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useProfileStore } from '@/stores/profile'
import { usePlanStore } from '@/stores/plan'
import { usePathInteraction } from '@/composables/usePathInteraction'
import { typeIcon, typeColor, scopeLabel, depthLabel, moduleStatusLabel } from '@/utils/formatters'
import type { Activity, Module } from '@/types'
import {
  ArrowRight, Refresh, CircleCheckFilled,
  Lock, Right, ArrowDown, Search,
  MagicStick, DataAnalysis,
} from '@element-plus/icons-vue'
import GenerationCard from '@/components/GenerationCard.vue'
import PathDag from '@/components/PathDag.vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const profile = useProfileStore()
const planStore = usePlanStore()

const {
  expandedModules,
  exploreDrawerVisible,
  exploreActivity,
  adjustmentHistoryVisible,
  dagExpanded,
  toggleModule,
  goToLearn,
  scrollToModule,
} = usePathInteraction()

// Auto-expand in-progress module on load
watch(() => planStore.inProgressModule, (newModule) => {
  if (newModule && !expandedModules.value.has(newModule.moduleId)) {
    expandedModules.value.add(newModule.moduleId)
  }
}, { immediate: true })



// ===== 生命周期 =====
onMounted(async () => {
  if (profile.activeCourseId) {
    // 如果已有生成任务在跑，不覆盖状态，让 SSE 回调自行切换到 ready
    if (planStore.status === 'generating') return
    await planStore.fetchPlan(profile.activeCourseId)
  }
})


// ===== 生成 =====
async function handleGenerate() {
  if (!profile.activeCourseId) {
    ElMessage.warning('请先在 Dashboard 选择课程')
    return
  }
  if (!profile.currentProfileVersion) {
    await profile.refreshProfile()
    if (!profile.currentProfileVersion) {
      ElMessage.warning('请先完成画像测评，再生成学习计划')
      return
    }
  }
  const courseId = profile.activeCourseId
  const pv = profile.currentProfileVersion!

  const result = await planStore.generatePlan(courseId, pv)
  if (!result) return

  if (result.alreadyInProgress) {
    try {
      await ElMessageBox.confirm(
        '检测到已有一个学习计划生成任务正在进行中。你可以查看当前进度，或者放弃当前任务并重新规划。',
        '已有学习计划正在生成',
        { confirmButtonText: '重新规划', cancelButtonText: '查看进度', type: 'warning' },
      )
      // 用户选择重新规划
      planStore.generatePlan(courseId, pv, true)
    } catch {
      // 用户选择查看进度（取消/关闭弹窗）
      planStore.generationTaskId = result.taskId
      planStore.subscribeToGeneration(result.taskId, courseId)
    }
  }
}

// ===== 导航 =====
function goToModuleReplan(moduleId: string) {
  planStore.refreshModule(moduleId)
}


</script>

<template>
  <div class="h-full flex flex-col bg-gray-50/50">
    <!-- ==================== 空状态 ==================== -->
    <template v-if="planStore.status === 'empty'">
      <div class="flex-1 flex items-center justify-center p-8">
        <EmptyState
          title="还没有学习计划"
          message="在这里查看为你量身定制的学习路线，<br>跟踪每个知识点的掌握进度。"
          button-text="生成我的学习计划"
          :loading="planStore.loading"
          @action="handleGenerate"
        >
          <template #icon>
            <div class="text-6xl mb-6">📋</div>
          </template>
          <template #footer>
            <p class="mt-4 text-xs text-gray-400">
              也可以去对话页让 AI 帮你规划
            </p>
          </template>
        </EmptyState>
      </div>
    </template>

    <!-- ==================== 生成中 ==================== -->
    <template v-else-if="planStore.status === 'generating'">
      <div class="flex-1 flex items-center justify-center p-8">
        <div class="w-full max-w-lg">
          <GenerationCard
            topic="学习计划生成"
            :task-id="planStore.generationTaskId"
            task-type="plan"
            status="generating"
            :progress="planStore.generationPercent"
            :message="planStore.generationMessage"
          />
          <p class="text-center text-sm mt-4" style="color: var(--lt-text-auxiliary);">
            {{ planStore.generationMessage || '正在分析课程结构与画像...' }}
          </p>
        </div>
      </div>
    </template>

    <!-- ==================== 就绪态 / 完成态 ==================== -->
    <template v-else-if="planStore.plan">
      <div class="flex-1 overflow-auto">
        <!-- ===== 顶部状态栏 ===== -->
        <div class="sticky top-0 z-10" style="background: var(--lt-bg-page); padding: 16px 24px 12px; border-bottom: 1px solid var(--lt-border);">
          <div class="flex items-center justify-between max-w-5xl mx-auto">
            <div class="flex items-center gap-4 text-sm" style="color: var(--lt-text-secondary);">
              <span>
                进度 <strong style="color: var(--lt-text-primary);">{{ planStore.completedModules.length }}/{{ planStore.moduleList.length }}</strong> 模块
              </span>
              <span v-if="planStore.overallMastery != null">
                · 掌握度 <strong style="color: var(--lt-brand);">{{ Math.round(planStore.overallMastery * 100) }}%</strong>
              </span>
              <span v-if="planStore.plan?.summary?.completionEstimate">
                · 预计 {{ planStore.plan.summary.completionEstimate }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <el-button text size="small" :icon="Refresh" @click="planStore.fetchPlan(profile.activeCourseId || '')">
                刷新
              </el-button>
            </div>
          </div>
          <div class="max-w-5xl mx-auto mt-2">
            <el-progress
              :percentage="planStore.overallProgress"
              :stroke-width="6"
              color="var(--lt-brand)"
              :show-text="false"
            />
          </div>
        </div>

        <!-- ===== 当前位置摘要条 (sticky) ===== -->
        <div
          v-if="planStore.currentActivity && planStore.status !== 'completed'"
          class="sticky z-10 px-6 py-3"
          style="top: 88px; background: linear-gradient(135deg, var(--lt-brand-lightest), #F0F5FF); border-bottom: 1px solid var(--lt-brand-lighter);"
        >
          <div class="max-w-5xl mx-auto flex items-center justify-between">
            <div class="flex items-center gap-3 text-sm">
              <span style="color: var(--lt-brand);">📍 当前位置</span>
              <span style="color: var(--lt-text-primary); font-weight: 500;">
                {{ planStore.currentModule?.title }} · {{ planStore.currentActivity.title }}
              </span>
              <span v-if="planStore.currentActivity.result?.score != null" style="color: var(--lt-orange);">
                上次得分 {{ Math.round(planStore.currentActivity.result.score * 100) }}%
              </span>
            </div>
            <el-button
              type="primary"
              size="small"
              @click="goToLearn(planStore.currentActivity!)"
            >
              继续学习 <el-icon class="ml-1"><ArrowRight /></el-icon>
            </el-button>
          </div>
        </div>

        <div class="max-w-5xl mx-auto p-6 pt-4 space-y-4">
          <!-- ===== 操作按钮 ===== -->
          <div class="flex items-center gap-2 mb-2">
            <el-button text size="small" :icon="Search" @click="dagExpanded = !dagExpanded">
              模块依赖图
            </el-button>
            <el-button text size="small" :icon="DataAnalysis" @click="adjustmentHistoryVisible = !adjustmentHistoryVisible">
              调整历史
            </el-button>
          </div>

          <!-- ===== DAG 缩略图 (可折叠) ===== -->
          <PathDag 
            v-if="dagExpanded && planStore.moduleList.length > 0"
            :modules="planStore.moduleList"
            @node-click="scrollToModule"
          />

          <!-- ===== Module 卡片列表 ===== -->
          <div class="space-y-3">
            <div
              v-for="mod in planStore.moduleList"
              :key="mod.moduleId"
              :id="`module-${mod.moduleId}`"
              class="rounded-xl overflow-hidden transition-all"
              style="border: 1px solid var(--lt-border); background: var(--lt-bg-card);"
            >
              <!-- Module Header (可点击展开/折叠) -->
              <div
                class="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                @click="toggleModule(mod.moduleId)"
              >
                <div class="flex items-center gap-3">
                  <el-icon
                    :size="20"
                    :style="{ color: mod.status === 'completed' ? 'var(--lt-success)' : mod.status === 'in_progress' ? 'var(--lt-brand)' : 'var(--lt-text-auxiliary)' }"
                  >
                    <CircleCheckFilled v-if="mod.status === 'completed'" />
                    <Right v-else-if="mod.status === 'in_progress'" />
                    <Lock v-else-if="mod.status === 'locked'" />
                    <ArrowDown v-else />
                  </el-icon>
                  <div>
                    <span class="text-base font-semibold" style="color: var(--lt-text-primary);">
                      {{ mod.title }}
                    </span>
                    <div class="flex items-center gap-2 mt-0.5">
                      <el-tag size="small" effect="plain" :disable-transitions="true">{{ scopeLabel(mod.scope) }}</el-tag>
                      <el-tag size="small" effect="plain" :disable-transitions="true">{{ depthLabel(mod.depth) }}</el-tag>
                      <span class="text-xs" style="color: var(--lt-text-auxiliary);">{{ mod.estimatedHours }}h</span>
                      <span
                        v-if="mod.status === 'locked' && mod.prerequisites?.length"
                        class="text-xs"
                        style="color: var(--lt-text-auxiliary);"
                      >
                        需先完成：{{ mod.prerequisites.map(p => planStore.moduleList.find(m => m.moduleId === p)?.title || p).join('、') }}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <el-tag
                    :type="mod.status === 'completed' ? 'success' : mod.status === 'in_progress' ? 'primary' : 'info'"
                    size="small"
                    effect="light"
                  >
                    {{ moduleStatusLabel(mod.status) }}
                  </el-tag>
                  <el-icon :size="16" style="color: var(--lt-text-auxiliary);" :class="{ 'rotate-180': expandedModules.has(mod.moduleId) }">
                    <ArrowRight />
                  </el-icon>
                </div>
              </div>

              <!-- Module Expanded Content -->
              <div v-if="expandedModules.has(mod.moduleId)" class="px-5 pb-4 border-t" style="border-color: var(--lt-border);">
                <!-- 掌握度 -->
                <div v-if="mod.mastery != null" class="flex items-center gap-3 mt-3 mb-3">
                  <span class="text-xs" style="color: var(--lt-text-auxiliary);">掌握度</span>
                  <el-progress
                    :percentage="Math.round(mod.mastery * 100)"
                    :stroke-width="6"
                    :status="mod.mastery >= 0.7 ? 'success' : 'warning'"
                    style="flex: 1; max-width: 200px;"
                  />
                  <span class="text-xs font-medium" :style="{ color: mod.mastery >= 0.7 ? 'var(--lt-success)' : 'var(--lt-warning)' }">
                    {{ Math.round(mod.mastery * 100) }}%
                  </span>
                </div>

                <!-- Gap 资源生成进度 -->
                <div
                  v-for="gt in planStore.gapTasks.filter(t => t.moduleId === mod.moduleId)"
                  :key="gt.taskId"
                  class="flex items-center gap-2 mt-3 mb-2 px-3 py-2 rounded-lg text-xs"
                  style="background: rgba(124,92,252,0.06); border: 1px solid rgba(124,92,252,0.15);"
                >
                  <span class="text-sm">⚡</span>
                  <span style="color: var(--lt-text-secondary);">资源生成中 ({{ gt.resourceTypes.join(', ') }})</span>
                  <el-button
                    text
                    size="small"
                    @click="router.push(`/studio?taskId=${gt.taskId}`)"
                    style="color: var(--lt-ai);"
                  >查看进度</el-button>
                </div>

                <!-- Activity 列表 -->
                <div class="space-y-2">
                  <div
                    v-for="act in (mod.subPlan?.activities || [])"
                    :key="act.activityId"
                    class="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
                    :style="{
                      borderLeft: `3px solid ${typeColor(act.type)}`,
                      background: act.status === 'failed' ? 'rgba(255,59,48,0.04)' : 'transparent',
                      opacity: act.status === 'locked' ? 0.5 : 1,
                    }"
                  >
                    <span class="text-lg flex-shrink-0">{{ typeIcon(act.type) }}</span>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-medium truncate" style="color: var(--lt-text-primary);">
                          {{ act.title }}
                        </span>
                        <el-tag
                          v-if="act.status === 'completed'"
                          size="small"
                          type="success"
                          effect="plain"
                          :disable-transitions="true"
                        >已完成</el-tag>
                        <el-tag
                          v-else-if="act.status === 'failed'"
                          size="small"
                          type="danger"
                          effect="plain"
                          :disable-transitions="true"
                        >未达标</el-tag>
                        <el-tag
                          v-else-if="act.status === 'locked'"
                          size="small"
                          effect="plain"
                          :disable-transitions="true"
                        >🔒 锁定</el-tag>
                        <el-tag
                          v-else-if="act.status === 'in_progress'"
                          size="small"
                          type="primary"
                          effect="light"
                          :disable-transitions="true"
                        >进行中</el-tag>
                      </div>
                      <div class="flex items-center gap-3 mt-1">
                        <span class="text-xs" style="color: var(--lt-text-auxiliary);">
                          {{ act.type === 'learn' ? '学习' : '拓展' }}
                          · {{ act.estimatedMinutes }}min
                        </span>
                        <!-- 资源类型标签 -->
                        <template v-if="act.resources && act.resources.length > 0">
                          <span
                            v-for="(r, ri) in act.resources"
                            :key="ri"
                            class="text-xs px-1.5 py-0.5 rounded"
                            :style="{
                              background: r.source === 'matched' ? 'rgba(52,199,89,0.1)' : 'rgba(168,168,180,0.12)',
                              color: r.source === 'matched' ? 'var(--lt-success)' : 'var(--lt-text-auxiliary)',
                            }"
                          >{{ r.resourceType }}</span>
                        </template>
                        <!-- 兼容旧数据：回退到单 resource -->
                        <span v-else-if="act.resource" class="text-xs" :style="{ color: act.resource.source === 'matched' ? 'var(--lt-success)' : 'var(--lt-text-auxiliary)' }">
                          {{ act.resource.source === 'matched' ? '📄 已匹配' : '⚡ ' + act.resource.resourceType }}
                        </span>
                        <!-- 得分 (quiz) -->
                        <span v-if="act.result?.score != null" class="text-xs font-medium" :style="{ color: (act.result.score || 0) >= 0.7 ? 'var(--lt-success)' : 'var(--lt-orange)' }">
                          得分 {{ Math.round((act.result.score || 0) * 100) }}%
                        </span>
                        <!-- 薄弱点标签 -->
                        <span
                          v-for="tag in (act.result?.weakTags || [])"
                          :key="tag"
                          class="text-xs px-1.5 py-0.5 rounded"
                          style="background: var(--lt-orange-light-9); color: var(--lt-orange-text);"
                        >
                          {{ tag }}
                        </span>
                      </div>
                    </div>
                    <!-- 操作按钮 -->
                    <div class="flex items-center gap-1 flex-shrink-0">
                      <el-button
                        v-if="act.status === 'ready' || act.status === 'in_progress'"
                        type="primary"
                        size="small"
                        :disabled="act.type === 'explore'"
                        @click="goToLearn(act)"
                      >
                        {{ act.status === 'in_progress' ? '继续' : '开始' }}
                      </el-button>
                      <el-button
                        v-if="act.status === 'failed'"
                        size="small"
                        @click="goToLearn(act)"
                      >
                        重试
                      </el-button>
                      <el-button
                        v-if="act.type === 'explore' && act.status !== 'skipped' && act.status !== 'completed'"
                        text
                        size="small"
                        @click="goToLearn(act)"
                      >
                        浏览
                      </el-button>
                    </div>
                  </div>
                </div>

                <!-- Module 底部统计 -->
                <div class="flex items-center justify-between mt-3 pt-3 border-t" style="border-color: var(--lt-border);">
                  <span class="text-xs" style="color: var(--lt-text-auxiliary);">
                    进度 {{ mod.subPlan?.activities.filter(a => a.status === 'completed').length || 0 }}/{{ mod.subPLan?.activities.length || 0 }}
                  </span>
                  <el-button text size="small" :icon="Refresh" @click="goToModuleReplan(mod.moduleId)">
                    重新规划此模块
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <!-- ===== 完成态提示 ===== -->
          <div
            v-if="planStore.status === 'completed'"
            class="text-center py-8"
          >
            <div class="text-5xl mb-4">🎉</div>
            <h2 class="text-xl font-bold mb-2" style="color: var(--lt-text-primary);">学习计划已完成！</h2>
            <p class="text-sm mb-4" style="color: var(--lt-text-auxiliary);">
              用时 {{ planStore.plan?.summary?.totalHours }} 小时 · 平均掌握度 {{ planStore.overallMastery != null ? Math.round(planStore.overallMastery * 100) : '-' }}%
            </p>
            <p v-if="planStore.overallWeakTags.length" class="text-xs mb-4" style="color: var(--lt-orange-text);">
              薄弱点：{{ planStore.overallWeakTags.join('、') }}
            </p>
            <el-button type="primary" @click="router.push('/report')">
              生成学习报告
            </el-button>
          </div>
        </div>
      </div>

      <!-- ===== Explore Drawer ===== -->
      <el-drawer
        v-model="exploreDrawerVisible"
        :title="exploreActivity?.title || '拓展阅读'"
        direction="rtl"
        size="500px"
      >
        <template v-if="exploreActivity">
          <div class="text-sm mb-6" style="color: var(--lt-text-auxiliary);">
            {{ exploreActivity.description }}
          </div>
          <div class="flex gap-3 pt-4 border-t" style="border-color: var(--lt-border);">
            <el-button type="primary" plain @click="planStore.submitActivity(exploreActivity.activityId, { duration_seconds: 0, interaction_detected: true })">
              标记完成
            </el-button>
            <el-button @click="exploreDrawerVisible = false">
              关闭
            </el-button>
          </div>
        </template>
      </el-drawer>

      <!-- ===== 调整历史 ===== -->
      <el-drawer
        v-model="adjustmentHistoryVisible"
        title="调整历史"
        direction="rtl"
        size="400px"
      >
        <div v-if="planStore.plan" class="space-y-4">
          <template v-for="mod in planStore.moduleList" :key="mod.moduleId">
            <div v-if="mod.subPlan?.adjustments?.length">
              <h4 class="text-sm font-semibold mb-2" style="color: var(--lt-text-primary);">{{ mod.title }}</h4>
              <div v-for="(adj, i) in mod.subPlan.adjustments" :key="i" class="text-sm p-3 rounded-lg mb-2" style="background: var(--lt-orange-light-9);">
                <p style="color: var(--lt-orange-text);">{{ adj.reason }}</p>
                <p class="text-xs mt-1" style="color: var(--lt-text-auxiliary);">{{ adj.at }}</p>
              </div>
            </div>
          </template>
          <p v-if="!planStore.moduleList.some(m => m.subPlan?.adjustments?.length)" class="text-sm" style="color: var(--lt-text-auxiliary);">
            暂无调整记录
          </p>
        </div>
      </el-drawer>
    </template>
  </div>
</template>

<style scoped>
.rotate-180 {
  transform: rotate(180deg);
  transition: transform 0.2s ease;
}
</style>
