<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useProfileStore } from '@/stores/profile'
import { usePlanStore } from '@/stores/plan'
import { usePathInteraction } from '@/composables/usePathInteraction'
import { usePathStages } from '@/composables/usePathStages'
import { typeIcon, typeColor, scopeLabel, depthLabel, scopeTagClass, depthTagClass, moduleStatusLabel } from '@/utils/formatters'
import {
  ArrowRight, Refresh, CircleCheckFilled,
  Lock, Right, ArrowDown, Search,
  DataAnalysis,
} from '@element-plus/icons-vue'
import GenerationCard from '@/components/GenerationCard.vue'
import PathDag from '@/components/PathDag.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import EmptyState from '@/components/EmptyState.vue'

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
  changeLockMode,
} = usePathInteraction()

const { stages, currentStage, remainingHours, totalHours } = usePathStages()

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
async function goToModuleReplan(moduleId: string) {
  try {
    await ElMessageBox.confirm(
      '将清空该模块所有活动的学习进度与资源，并重新规划。确定继续？',
      '重新规划模块',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' },
    )
    planStore.refreshModule(moduleId)
  } catch { /* 用户取消 */ }
}

const lockModes = [
  { value: 'sequential', label: '按顺序解锁', desc: '需按顺序完成，未解锁活动不可学习' },
  { value: 'free',       label: '自由学习',   desc: '所有活动随时可学，无顺序限制' },
] as const


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
        <!-- ===== 仪表盘 + 当前位置条（统一 sticky 容器） ===== -->
        <div class="sticky top-0 z-10 dashboard-bar">
          <div class="max-w-5xl mx-auto">
            <!-- 操作按钮行 -->
            <div class="flex items-center justify-between py-3">
              <div class="flex items-center gap-2">
                <el-button text size="small" :icon="Refresh" @click="planStore.fetchPlan(profile.activeCourseId || '')">
                  刷新
                </el-button>
                <el-button text size="small" :icon="Search" @click="dagExpanded = !dagExpanded">
                  依赖图
                </el-button>
                <el-button text size="small" :icon="DataAnalysis" @click="adjustmentHistoryVisible = !adjustmentHistoryVisible">
                  调整历史
                </el-button>
              </div>
              <div class="mode-switch" v-if="planStore.plan">
                <button
                  v-for="m in lockModes" :key="m.value"
                  class="mode-btn"
                  :class="{ 'is-active': planStore.plan.lockMode === m.value }"
                  :title="m.desc"
                  @click="changeLockMode(m.value)"
                >{{ m.label }}</button>
              </div>
            </div>

            <!-- 3 张仪表盘卡 -->
            <div class="dashboard-grid" :class="{ 'two-cards': !currentStage }">
              <!-- 总进度环 -->
              <div class="dash-card" style="--dash-color: var(--lt-brand);">
                <div class="dash-ring">
                  <svg viewBox="0 0 64 64" role="img" :aria-label="`总进度 ${planStore.overallProgress}%`">
                    <circle cx="32" cy="32" r="27" fill="none" stroke="var(--lt-border)" stroke-width="6"/>
                    <circle
                      class="ring-fg"
                      cx="32" cy="32" r="27" fill="none"
                      stroke="var(--lt-brand)" stroke-width="6" stroke-linecap="round"
                      :stroke-dasharray="169.65"
                      :stroke-dashoffset="169.65 * (1 - planStore.overallProgress / 100)"
                    />
                  </svg>
                  <div class="dash-ring-text">{{ planStore.overallProgress }}%</div>
                </div>
                <div class="dash-info">
                  <div class="dash-label">总进度</div>
                  <div class="dash-big">
                    {{ planStore.completedModules.length }}<span class="dash-sub">/{{ planStore.moduleList.length }}</span>
                  </div>
                  <div class="dash-desc">模块已完成</div>
                </div>
              </div>

              <!-- 当前阶段进度环（全部完成时显示完成态卡） -->
              <div
                v-if="currentStage"
                class="dash-card"
                :style="{ '--dash-color': currentStage.colorVar }"
              >
                <div class="dash-ring">
                  <svg viewBox="0 0 64 64" role="img" :aria-label="`当前阶段进度 ${currentStage.progressPct}%`">
                    <circle cx="32" cy="32" r="27" fill="none" stroke="var(--lt-border)" stroke-width="6"/>
                    <circle
                      class="ring-fg"
                      cx="32" cy="32" r="27" fill="none"
                      :stroke="currentStage.colorVar" stroke-width="6" stroke-linecap="round"
                      :stroke-dasharray="169.65"
                      :stroke-dashoffset="169.65 * (1 - currentStage.progressPct / 100)"
                    />
                  </svg>
                  <div class="dash-ring-text" :style="{ color: currentStage.colorVar }">{{ currentStage.progressPct }}%</div>
                </div>
                <div class="dash-info">
                  <div class="dash-label">当前阶段</div>
                  <div class="dash-big">{{ currentStage.shortLabel }}</div>
                  <div class="dash-desc">{{ currentStage.completedCount }}/{{ currentStage.totalCount }} 模块</div>
                </div>
              </div>
              <!-- 全部完成时的替代卡 -->
              <div v-else class="dash-card" style="--dash-color: var(--lt-success);">
                <div class="dash-ring">
                  <svg viewBox="0 0 64 64" role="img" aria-label="全部完成">
                    <circle cx="32" cy="32" r="27" fill="none" stroke="var(--lt-border)" stroke-width="6"/>
                    <circle class="ring-fg" cx="32" cy="32" r="27" fill="none"
                      stroke="var(--lt-success)" stroke-width="6" stroke-linecap="round"
                      stroke-dasharray="169.65" stroke-dashoffset="0"/>
                  </svg>
                  <div class="dash-ring-text" style="color: var(--lt-success);">✓</div>
                </div>
                <div class="dash-info">
                  <div class="dash-label">全部完成</div>
                  <div class="dash-big" v-if="planStore.overallMastery != null">{{ Math.round(planStore.overallMastery * 100) }}%</div>
                  <div class="dash-desc">平均掌握度</div>
                </div>
              </div>

              <!-- 时长统计 -->
              <div class="dash-card" style="--dash-color: var(--lt-orange);">
                <div class="dash-time-icon">⏱</div>
                <div class="dash-info">
                  <div class="dash-label">预估时长</div>
                  <div class="dash-big">
                    {{ totalHours }}<span class="dash-sub">h</span>
                  </div>
                  <div class="dash-desc">剩余约 {{ remainingHours }}h</div>
                </div>
              </div>
            </div>

            <!-- 总进度条（保留，移到仪表盘下方） -->
            <div class="dashboard-progress-bar">
              <el-progress
                :percentage="planStore.overallProgress"
                :stroke-width="6"
                color="var(--lt-brand)"
                :show-text="false"
              />
              <span v-if="planStore.overallMastery != null" class="dashboard-mastery">
                掌握度 <strong style="color: var(--lt-brand);">{{ Math.round(planStore.overallMastery * 100) }}%</strong>
              </span>
            </div>

            <!-- 当前位置条（移入此 sticky 容器内部） -->
            <div
              v-if="planStore.currentActivity && planStore.status !== 'completed'"
              class="current-position-bar"
            >
              <div class="cp-accent"></div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3 text-sm min-w-0">
                  <span class="cp-badge">当前位置</span>
                  <span class="cp-path truncate">
                    {{ planStore.currentModule?.title }} <span class="cp-sep">·</span> {{ planStore.currentActivity.title }}
                  </span>
                  <span v-if="planStore.currentActivity.result?.score != null" class="cp-score">
                    上次得分 {{ Math.round(planStore.currentActivity.result.score * 100) }}%
                  </span>
                </div>
                <el-button
                  type="primary"
                  size="small"
                  class="flex-shrink-0"
                  @click="goToLearn(planStore.currentActivity!, planStore.currentModule?.moduleId)"
                >
                  继续学习 <el-icon class="ml-1"><ArrowRight /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </div>

        <div class="max-w-5xl mx-auto p-6 pt-4 space-y-4">
          <!-- ===== DAG 缩略图 (可折叠) ===== -->
          <PathDag 
            v-if="dagExpanded && planStore.moduleList.length > 0"
            :modules="planStore.moduleList"
            @node-click="scrollToModule"
          />

          <!-- ===== 阶段分组 + 时间轴 ===== -->
          <div class="stages-container">
            <div
              v-for="(stage, stageIdx) in stages"
              :key="stage.key"
              class="stage-section"
              :class="`stage-${stageIdx + 1}`"
              :style="{ '--stage-color': stage.colorVar, '--stage-color-light': stage.colorLightVar }"
            >
              <!-- 阶段头 -->
              <div class="stage-header">
                <span class="stage-badge">
                  <span class="stage-badge-dot"></span>
                  第{{ ['一','二','三'][stageIdx] }}阶段 · {{ stage.shortLabel }}
                </span>
                <span class="stage-meta">
                  {{ stage.totalCount }}个模块
                  <span class="stage-meta-sep">·</span>
                  {{ stage.totalHours }}h
                </span>
                <div class="stage-progress-mini">
                  <div class="stage-progress-fill" :style="{ width: stage.progressPct + '%' }"></div>
                </div>
                <span class="stage-progress-text">{{ stage.completedCount }}/{{ stage.totalCount }}</span>
              </div>

              <!-- 阶段内模块（时间轴） -->
              <div class="modules-grid">
                <div
                  v-for="(mod, modIdx) in stage.modules"
                  :key="mod.moduleId"
                  :id="`module-${mod.moduleId}`"
                  class="module-card stagger-fade-in"
                  :class="[
                    `status-${mod.status}`,
                    { 'is-expanded': expandedModules.has(mod.moduleId) }
                  ]"
                  :style="{ animationDelay: `${(stageIdx * 3 + modIdx) * 60}ms` }"
                >
                  <!-- Module Header (可点击展开/折叠) -->
                  <div
                    class="module-card-header"
                    @click="toggleModule(mod.moduleId)"
                  >
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                      <el-icon
                        :size="20"
                        class="module-status-icon"
                        :style="{ color: mod.status === 'completed' ? 'var(--lt-success)' : mod.status === 'in_progress' ? 'var(--stage-color)' : 'var(--lt-text-auxiliary)' }"
                      >
                        <CircleCheckFilled v-if="mod.status === 'completed'" />
                        <Right v-else-if="mod.status === 'in_progress'" />
                        <Lock v-else-if="mod.status === 'locked'" />
                        <ArrowDown v-else />
                      </el-icon>
                      <div class="min-w-0">
                        <span class="text-base font-semibold module-title" style="color: var(--lt-text-primary);">
                          {{ mod.title }}
                        </span>
                        <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                          <el-tag :class="scopeTagClass(mod.scope)" size="small" effect="plain" :disable-transitions="true">{{ scopeLabel(mod.scope) }}</el-tag>
                          <el-tag :class="depthTagClass(mod.depth)" size="small" effect="plain" :disable-transitions="true">{{ depthLabel(mod.depth) }}</el-tag>
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
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <el-tag
                        :type="mod.status === 'completed' ? 'success' : mod.status === 'in_progress' ? 'primary' : 'info'"
                        size="small"
                        effect="light"
                      >
                        {{ moduleStatusLabel(mod.status) }}
                      </el-tag>
                      <el-icon :size="16" class="module-arrow">
                        <ArrowRight />
                      </el-icon>
                    </div>
                  </div>

                  <!-- Module Expanded Content -->
                  <Transition name="module-expand">
                  <div v-if="expandedModules.has(mod.moduleId)" class="module-expand-content px-5 pb-4 border-t" style="border-color: var(--lt-border);">
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
                    <div class="space-y-1.5">
                      <div
                        v-for="act in (mod.subPlan?.activities || [])"
                        :key="act.activityId"
                        class="activity-item flex items-center gap-3 px-3 py-2.5 transition-all"
                        :style="{
                          opacity: act.status === 'locked' ? 0.5 : 1,
                        }"
                      >
                        <div
                          class="activity-dot flex-shrink-0"
                          :style="{ background: typeColor(act.type) }"
                        ></div>
                        <span class="text-sm flex-shrink-0">{{ typeIcon(act.type) }}</span>
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
                              v-else-if="act.status === 'locked' && planStore.plan?.lockMode === 'sequential'"
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
                            @click="goToLearn(act, mod.moduleId)"
                          >
                            {{ act.status === 'in_progress' ? '继续' : '开始' }}
                          </el-button>
                          <el-button
                            v-if="act.status === 'failed'"
                            size="small"
                            @click="goToLearn(act, mod.moduleId)"
                          >
                            重试
                          </el-button>
                          <el-button
                            v-if="act.type === 'explore' && act.status !== 'skipped' && act.status !== 'completed'"
                            text
                            size="small"
                            @click="goToLearn(act, mod.moduleId)"
                          >
                            浏览
                          </el-button>
                        </div>
                      </div>
                    </div>

                    <!-- Module 底部统计 -->
                    <div class="flex items-center justify-between mt-3 pt-3 border-t" style="border-color: var(--lt-border);">
                      <span class="text-xs" style="color: var(--lt-text-auxiliary);">
                        进度 {{ mod.subPlan?.activities.filter(a => a.status === 'completed').length || 0 }}/{{ mod.subPlan?.activities.length || 0 }}
                      </span>
                      <el-button text size="small" :icon="Refresh" @click="goToModuleReplan(mod.moduleId)">
                        重新规划此模块
                      </el-button>
                    </div>
                  </div>
                  </Transition>
                </div>
              </div>

              <!-- 阶段里程碑（在 .modules-grid 外部，不参与时间轴竖线） -->
              <div class="milestone" :class="`milestone-stage-${stageIdx + 1}`">
                <div class="milestone-icon">🏁</div>
                <div class="milestone-text">
                  <div class="milestone-title">第{{ ['一','二','三'][stageIdx] }}阶段里程碑</div>
                  <div class="milestone-sub">
                    完成 {{ stage.completedCount }}/{{ stage.totalCount }} 模块后解锁 · 综合测验
                  </div>
                </div>
                <div class="milestone-progress" v-if="stage.progressPct < 100">
                  {{ stage.progressPct }}%
                </div>
                <div class="milestone-done" v-else>✓</div>
              </div>
            </div>
          </div>

          <!-- ===== 完成态提示 ===== -->
          <div
            v-if="planStore.status === 'completed'"
            class="completion-card"
          >
            <div class="completion-circle">
              <span class="completion-check">✓</span>
            </div>
            <h2 class="text-xl font-bold mb-2" style="color: var(--lt-text-primary);">学习计划已完成！</h2>
            <div class="completion-stats">
              <div class="completion-stat">
                <span class="cs-value">{{ planStore.plan?.summary?.totalHours || '-' }}</span>
                <span class="cs-label">总用时(小时)</span>
              </div>
              <div class="completion-stat">
                <span class="cs-value">{{ planStore.overallMastery != null ? Math.round(planStore.overallMastery * 100) + '%' : '-' }}</span>
                <span class="cs-label">平均掌握度</span>
              </div>
              <div class="completion-stat">
                <span class="cs-value">{{ planStore.completedModules.length }}/{{ planStore.moduleList.length }}</span>
                <span class="cs-label">完成模块</span>
              </div>
            </div>
            <p v-if="planStore.overallWeakTags.length" class="completion-weak-tags">
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
/* ── 模块标签配色：范围(scope) 蓝/橙/紫，深度(depth) 灰/绿/红 ── */
.el-tag.tag-core { --el-tag-text-color: var(--lt-brand); --el-tag-border-color: var(--lt-brand-lighter); }
.el-tag.tag-sup { --el-tag-text-color: var(--lt-warning); --el-tag-border-color: var(--lt-warning); }
.el-tag.tag-ext { --el-tag-text-color: var(--lt-ai); --el-tag-border-color: var(--lt-ai-light-5); }
.el-tag.tag-basic { --el-tag-text-color: var(--lt-text-auxiliary); --el-tag-border-color: var(--lt-border); }
.el-tag.tag-std { --el-tag-text-color: var(--lt-success); --el-tag-border-color: var(--lt-success); }
.el-tag.tag-deep { --el-tag-text-color: var(--lt-danger); --el-tag-border-color: var(--lt-danger); }

/* ── 阶段容器 ── */
.stages-container {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* ── 阶段头 ── */
.stage-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 0 4px;
}
.stage-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-weight: 700;
  font-size: 0.85rem;
  padding: 6px 14px;
  border-radius: var(--lt-radius-full);
  background: var(--stage-color-light);
  color: var(--stage-color);
  white-space: nowrap;
}
.stage-badge-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--stage-color);
  box-shadow: 0 0 8px var(--stage-color);
}
.stage-meta {
  font-size: 0.8rem;
  color: var(--lt-text-auxiliary);
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.stage-meta-sep {
  opacity: 0.5;
}
.stage-progress-mini {
  height: 4px;
  border-radius: 2px;
  background: var(--lt-border);
  flex: 1;
  max-width: 120px;
  overflow: hidden;
}
.stage-progress-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--stage-color);
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}
.stage-progress-text {
  font-size: 0.75rem;
  color: var(--lt-text-auxiliary);
  font-weight: 500;
  white-space: nowrap;
}

/* ── 时间轴模块网格 ── */
.modules-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  padding-left: 28px;
}
/* 时间轴竖线（里程碑已移出 .modules-grid，竖线只需覆盖模块区域） */
.modules-grid::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  border-radius: 1px;
  background: linear-gradient(to bottom,
    transparent 0%,
    var(--lt-border) 8%,
    var(--lt-border) 92%,
    transparent 100%);
}
/* 节点圆点 */
.module-card::before {
  content: '';
  position: absolute;
  left: -22px;
  top: 22px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--lt-bg-card);
  border: 2.5px solid var(--lt-border);
  z-index: 2;
  transition: all var(--lt-transition-smooth);
  box-shadow: 0 0 0 4px var(--lt-bg-page);
}
/* 已完成节点 */
.module-card.status-completed::before {
  background: var(--lt-success);
  border-color: var(--lt-success);
  box-shadow: 0 0 0 4px var(--lt-bg-page), 0 0 12px rgba(52, 199, 89, 0.3);
}
/* 进行中节点 - 呼吸动画 */
.module-card.status-in_progress::before {
  background: var(--stage-color);
  border-color: var(--stage-color);
  animation: nodePulse 2s ease-in-out infinite;
}
@keyframes nodePulse {
  0%, 100% {
    box-shadow: 0 0 0 4px var(--lt-bg-page), 0 0 8px var(--stage-color);
  }
  50% {
    box-shadow: 0 0 0 8px var(--stage-color-light), 0 0 18px var(--stage-color);
  }
}
/* 锁定节点 */
.module-card.status-locked::before {
  background: var(--lt-text-placeholder);
  border-color: var(--lt-text-placeholder);
  box-shadow: 0 0 0 4px var(--lt-bg-page);
  opacity: 0.6;
}

/* ── 模块卡片（改造现有） ── */
/* 注意：不设 overflow: hidden，否则会裁剪 ::before 节点圆点（left:-22px 在卡片外部）。
   圆角裁剪改由 header / expand-content 各自的 border-radius 实现 */
.module-card {
  position: relative;
  border: 1.5px solid var(--lt-border);
  background: var(--lt-bg-card);
  border-radius: var(--lt-radius-lg);
  box-shadow: var(--lt-shadow-card);
  transition: box-shadow var(--lt-transition-smooth),
              transform var(--lt-transition-smooth),
              border-color var(--lt-transition-smooth);
}
.module-card:hover {
  box-shadow: var(--lt-shadow-hover);
  transform: translateY(-1px);
  border-color: var(--stage-color, var(--lt-brand-lighter));
}
.module-card.is-expanded {
  box-shadow: var(--lt-shadow-elevated);
}
.module-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  cursor: pointer;
  position: relative;
  transition: background var(--lt-transition-base);
  border-radius: var(--lt-radius-lg);
  overflow: hidden;
}
.module-card.is-expanded .module-card-header {
  border-radius: var(--lt-radius-lg) var(--lt-radius-lg) 0 0;
}
.module-card-header:hover {
  background: var(--stage-color-light, var(--lt-brand-lightest));
}
.module-status-icon {
  flex-shrink: 0;
}
.module-arrow {
  color: var(--lt-text-auxiliary);
  transition: transform var(--lt-transition-smooth), color var(--lt-transition-smooth);
}
.module-card.is-expanded .module-arrow {
  transform: rotate(90deg);
  color: var(--stage-color, var(--lt-brand));
}
.module-expand-content {
  border-radius: 0 0 var(--lt-radius-lg) var(--lt-radius-lg);
}

/* ── locked 模块整体降级 ── */
.module-card.status-locked {
  opacity: 0.7;
  border-style: dashed;
  background: var(--lt-bg-page);
}
.module-card.status-locked .module-title {
  color: var(--lt-text-auxiliary) !important;
}

/* ── 里程碑卡 ── */
.milestone {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  margin: 4px 0 0 0;
  background: linear-gradient(135deg, var(--lt-bg-card), var(--stage-color-light));
  border-radius: var(--lt-radius-lg);
  border: 1.5px dashed var(--lt-border);
  position: relative;
  z-index: 1;
}
.milestone-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  background: var(--stage-color-light);
  flex-shrink: 0;
}
.milestone-text {
  flex: 1;
  min-width: 0;
}
.milestone-title {
  font-weight: 600;
  font-size: 0.88rem;
  color: var(--lt-text-primary);
}
.milestone-sub {
  font-size: 0.75rem;
  color: var(--lt-text-auxiliary);
  margin-top: 2px;
}
.milestone-progress {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--stage-color);
}
.milestone-done {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--lt-success);
}

/* ── Phase 4: 卡片 hover 左侧 accent 条（demo3 风格） ── */
.module-card::after {
  content: '';
  position: absolute;
  top: 6px;
  bottom: 6px;
  left: 0;
  width: 3px;
  background: var(--stage-color, var(--lt-brand));
  transform: scaleY(0);
  transform-origin: top;
  transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1),
              opacity var(--lt-transition-smooth),
              background var(--lt-transition-smooth);
  z-index: 1;
  border-radius: 2px;
}
.module-card:hover::after {
  transform: scaleY(1);
}
.module-card.is-expanded::after {
  transform: scaleY(1);
  opacity: 0.5;
}

/* ── Phase 4: 箭头 hover 位移（demo3 风格） ── */
.module-card:not(.is-expanded) .module-card-header:hover .module-arrow {
  transform: translateX(2px);
  color: var(--stage-color, var(--lt-brand));
}
.module-card.is-expanded .module-card-header:hover .module-arrow {
  transform: rotate(90deg) translateX(2px);
  color: var(--stage-color, var(--lt-brand));
}

/* ── Phase 4: 已完成模块 shimmer 横扫光（demo1 风格） ── */
.module-card.status-completed .module-card-header::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(52, 199, 89, 0.06) 50%,
    transparent 100%);
  transform: translateX(-100%);
  animation: shimmerSweep 3s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
}
@keyframes shimmerSweep {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* ── Phase 5: 状态视觉强化 ── */
/* completed 状态：左侧常驻绿色 accent 条 */
.module-card.status-completed::after {
  transform: scaleY(1);
  background: var(--lt-success);
  opacity: 0.6;
}
.module-card.status-completed:hover::after {
  opacity: 1;
}
/* in_progress 状态：阶段色边框 + 左侧常驻阶段色 accent 条 */
.module-card.status-in_progress {
  border-color: var(--stage-color);
}
.module-card.status-in_progress::after {
  transform: scaleY(1);
  background: var(--stage-color);
  opacity: 0.7;
}

/* ── Stagger fade-in ── */
.stagger-fade-in {
  animation: staggerFadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) both;
}

/* ── Expand transition ── */
.module-expand-enter-active {
  transition: all 0.3s ease;
  overflow: hidden;
}
.module-expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.module-expand-enter-from,
.module-expand-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ── 仪表盘区 ── */
.dashboard-bar {
  background: var(--lt-bg-page);
  padding: 12px 24px 16px;
  border-bottom: 1px solid var(--lt-border);
}
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr 1fr;
  gap: 14px;
}
.dashboard-grid.two-cards {
  grid-template-columns: 1fr 1fr;
}
@media (max-width: 768px) {
  .dashboard-grid,
  .dashboard-grid.two-cards {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 520px) {
  .dashboard-grid,
  .dashboard-grid.two-cards {
    grid-template-columns: 1fr;
  }
}
.dash-card {
  background: var(--lt-bg-card);
  border-radius: var(--lt-radius-lg);
  padding: 16px 18px;
  box-shadow: var(--lt-shadow-card);
  border: 1px solid var(--lt-border);
  border-left: 3px solid var(--dash-color);
  display: flex;
  align-items: center;
  gap: 14px;
  transition: box-shadow var(--lt-transition-smooth), transform var(--lt-transition-smooth);
}
.dash-card:hover {
  box-shadow: var(--lt-shadow-hover);
  transform: translateY(-1px);
}
.dash-ring {
  position: relative;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
}
.dash-ring svg {
  width: 56px;
  height: 56px;
  transform: rotate(-90deg);
}
.ring-fg {
  transition: stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1);
}
.dash-ring-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--lt-text-primary);
}
.dash-info {
  min-width: 0;
}
.dash-label {
  font-size: 0.72rem;
  color: var(--lt-text-auxiliary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.dash-big {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--lt-text-primary);
  line-height: 1.2;
  letter-spacing: -0.02em;
}
.dash-sub {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--lt-text-auxiliary);
}
.dash-desc {
  font-size: 0.78rem;
  color: var(--lt-text-secondary);
  margin-top: 1px;
}
.dash-time-icon {
  font-size: 1.8rem;
  flex-shrink: 0;
  width: 56px;
  text-align: center;
}
.dashboard-progress-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}
.dashboard-mastery {
  font-size: 0.78rem;
  color: var(--lt-text-secondary);
  white-space: nowrap;
}

/* ── Current position bar（已移入 dashboard-bar 内部，不再是独立 sticky 元素） ── */
.current-position-bar {
  margin-top: 12px;
  padding: 10px 16px;
  background: linear-gradient(135deg, rgba(43,111,255,0.04), rgba(124,92,252,0.03));
  border-radius: var(--lt-radius-lg);
  border: 1px solid var(--lt-border);
  position: relative;
  overflow: hidden;
}
.cp-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--lt-brand);
  border-radius: 0 2px 2px 0;
}
.cp-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--lt-brand);
  background: rgba(43,111,255,0.08);
  border-radius: var(--lt-radius-full);
  white-space: nowrap;
  flex-shrink: 0;
}
.cp-path {
  color: var(--lt-text-primary);
  font-weight: 500;
  min-width: 0;
}
.cp-sep {
  color: var(--lt-text-auxiliary);
  margin: 0 2px;
}
.cp-score {
  color: var(--lt-orange);
  white-space: nowrap;
  flex-shrink: 0;
}

/* ── Activity item ── */
.activity-item {
  border-radius: var(--lt-radius-md);
  background: transparent;
}
.activity-item:hover {
  background: rgba(43, 111, 255, 0.03);
}
.activity-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── Completion ── */
.completion-card {
  text-align: center;
  padding: 40px 24px;
  background: linear-gradient(180deg, rgba(43,111,255,0.03), transparent);
  border-radius: var(--lt-radius-lg);
  border: 1px solid var(--lt-border);
  margin-top: 8px;
}
.completion-circle {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--lt-brand), #5B8DFF);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  box-shadow: 0 4px 20px rgba(43,111,255,0.3);
  animation: celebration-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.completion-check {
  font-size: 36px;
  font-weight: 700;
}
@keyframes celebration-pop {
  0% { transform: scale(0); opacity: 0; }
  70% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}
.completion-stats {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin-bottom: 16px;
}
.completion-stat {
  text-align: center;
}
.cs-value {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: var(--lt-text-primary);
}
.cs-label {
  font-size: 12px;
  color: var(--lt-text-auxiliary);
  margin-top: 2px;
}
.completion-weak-tags {
  font-size: 13px;
  color: var(--lt-orange-text);
  margin-bottom: 20px;
}

/* ── Mode switch（锁定模式分段开关） ── */
.mode-switch {
  display: inline-flex;
  background-color: var(--lt-bg-page);
  border-radius: 8px;
  padding: 2px;
  border: 1px solid var(--lt-border);
}
.mode-btn {
  padding: 3px 10px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  color: var(--lt-text-auxiliary);
  transition: all 0.15s ease;
  white-space: nowrap;
}
.mode-btn:hover {
  color: var(--lt-text-primary);
}
.mode-btn.is-active {
  background-color: var(--lt-bg-card);
  color: var(--lt-brand);
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

/* ── 无障碍：减少动效偏好 ── */
@media (prefers-reduced-motion: reduce) {
  .module-card.status-in_progress::before {
    animation: none;
  }
  .module-card.status-completed .module-card-header::after {
    animation: none;
    display: none;
  }
  .stagger-fade-in {
    animation: none;
    opacity: 1;
  }
  .module-card::after,
  .module-arrow {
    transition: none !important;
  }
}
</style>
