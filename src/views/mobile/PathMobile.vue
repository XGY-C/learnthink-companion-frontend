<script setup lang="ts">
import { onMounted, watch, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProfileStore } from '@/stores/profile'
import { usePlanStore } from '@/stores/plan'
import { usePathInteraction } from '@/composables/usePathInteraction'
import { usePathStages } from '@/composables/usePathStages'
import { typeIcon, typeColor, scopeLabel, depthLabel, scopeTagClass, depthTagClass, moduleStatusLabel } from '@/utils/formatters'
import { ArrowRight, Refresh, CircleCheckFilled, Lock, Right, ArrowDown, DataAnalysis, Search } from '@element-plus/icons-vue'
import GenerationCard from '@/components/GenerationCard.vue'
import PathDag from '@/components/PathDag.vue'
import EmptyStateVue from '@/components/EmptyState.vue'
import BottomSheet from '@/components/mobile/BottomSheet.vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const profile = useProfileStore()
const planStore = usePlanStore()

const {
  expandedModules,
  exploreDrawerVisible,
  exploreActivity,
  dagExpanded,
  toggleModule,
  goToLearn,
  scrollToModule,
  changeLockMode,
} = usePathInteraction()

const { stages, currentStage, remainingHours, totalHours } = usePathStages()

const showDagSheet = ref(false)
const showAdjustSheet = ref(false)
const showLockSheet = ref(false)

watch(() => planStore.inProgressModule, (newModule) => {
  if (newModule && !expandedModules.value.has(newModule.moduleId)) {
    expandedModules.value.add(newModule.moduleId)
  }
}, { immediate: true })

onMounted(async () => {
  if (profile.activeCourseId) {
    if (planStore.status === 'generating') return
    await planStore.fetchPlan(profile.activeCourseId)
  }
})

async function handleGenerate() {
  if (!profile.activeCourseId) { ElMessage.warning('请先在 Dashboard 选择课程'); return }
  if (!profile.currentProfileVersion) {
    await profile.refreshProfile()
    if (!profile.currentProfileVersion) { ElMessage.warning('请先完成画像测评'); return }
  }
  const courseId = profile.activeCourseId
  const pv = profile.currentProfileVersion!
  const result = await planStore.generatePlan(courseId, pv)
  if (!result) return
  if (result.alreadyInProgress) {
    try {
      await ElMessageBox.confirm('检测到已有一个学习计划生成任务正在进行中。', '已有学习计划正在生成', { confirmButtonText: '重新规划', cancelButtonText: '查看进度', type: 'warning' })
      planStore.generatePlan(courseId, pv, true)
    } catch { planStore.generationTaskId = result.taskId; planStore.subscribeToGeneration(result.taskId, courseId) }
  }
}

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

async function onLockModeSelect(mode: string) {
  await changeLockMode(mode)
  showLockSheet.value = false
}

function typeLabel(type: string): string {
  const map: Record<string, string> = { doc: '讲解文档', mindmap: '思维导图', quiz: '练习题', reading: '拓展阅读', code: '代码案例', video: '讲解视频', html: '交互文档' }
  return map[type] || type
}
</script>

<template>
  <div class="m-path">
    <template v-if="planStore.status === 'empty'">
      <div class="m-path-empty">
        <EmptyStateVue title="还没有学习计划" message="在这里查看为你量身定制的学习路线，跟踪每个知识点的掌握进度。" button-text="生成我的学习计划" :loading="planStore.loading" @action="handleGenerate">
          <template #icon><div class="text-5xl mb-4">📋</div></template>
          <template #footer><p class="mt-3 text-xs" style="color: var(--lt-text-auxiliary);">也可以去对话页让 AI 帮你规划</p></template>
        </EmptyStateVue>
      </div>
    </template>

    <template v-else-if="planStore.status === 'generating'">
      <div class="m-path-gen">
        <GenerationCard topic="学习计划生成" :task-id="planStore.generationTaskId" task-type="plan" status="generating" :progress="planStore.generationPercent" :message="planStore.generationMessage" />
        <p class="m-gen-msg">{{ planStore.generationMessage || '正在分析课程结构与画像...' }}</p>
      </div>
    </template>

    <template v-else-if="planStore.plan">
      <!-- 仪表盘 + 当前位置（统一 sticky 容器） -->
      <div class="m-dashboard m-sticky">
        <!-- 操作按钮行 -->
        <div class="m-dash-actions">
          <button class="m-path-sub-btn" @click="dagExpanded = !dagExpanded"><el-icon :size="14"><Search /></el-icon> 依赖图</button>
          <button class="m-path-sub-btn" @click="showDagSheet = true"><el-icon :size="14"><DataAnalysis /></el-icon> 全屏</button>
          <button class="m-path-sub-btn" @click="showAdjustSheet = true"><el-icon :size="14"><DataAnalysis /></el-icon> 调整历史</button>
          <button class="m-path-sub-btn" @click="planStore.fetchPlan(profile.activeCourseId || '')" aria-label="刷新"><el-icon :size="14"><Refresh /></el-icon> 刷新</button>
          <button class="m-path-sub-btn" :class="{ 'is-on': planStore.plan?.lockMode === 'free' }" @click="showLockSheet = true">
            <el-icon :size="14"><Lock /></el-icon>
            {{ planStore.plan?.lockMode === 'free' ? '自由' : '顺序' }}
          </button>
        </div>

        <!-- 仪表盘卡（单列） -->
        <div class="m-dash-grid" :class="{ 'two-cards': !currentStage }">
          <!-- 总进度环 -->
          <div class="m-dash-card" style="--dash-color: var(--lt-brand);">
            <div class="m-dash-ring">
              <svg viewBox="0 0 64 64" role="img" :aria-label="`总进度 ${planStore.overallProgress}%`">
                <circle cx="32" cy="32" r="27" fill="none" stroke="var(--lt-border)" stroke-width="6"/>
                <circle class="ring-fg" cx="32" cy="32" r="27" fill="none" stroke="var(--lt-brand)" stroke-width="6" stroke-linecap="round" :stroke-dasharray="169.65" :stroke-dashoffset="169.65 * (1 - planStore.overallProgress / 100)" />
              </svg>
              <div class="m-dash-ring-text">{{ planStore.overallProgress }}%</div>
            </div>
            <div class="m-dash-info">
              <div class="m-dash-label">总进度</div>
              <div class="m-dash-big">{{ planStore.completedModules.length }}<span class="m-dash-sub">/{{ planStore.moduleList.length }}</span></div>
              <div class="m-dash-desc">模块已完成</div>
            </div>
          </div>

          <!-- 当前阶段进度环 -->
          <div v-if="currentStage" class="m-dash-card" :style="{ '--dash-color': currentStage.colorVar }">
            <div class="m-dash-ring">
              <svg viewBox="0 0 64 64" role="img" :aria-label="`当前阶段进度 ${currentStage.progressPct}%`">
                <circle cx="32" cy="32" r="27" fill="none" stroke="var(--lt-border)" stroke-width="6"/>
                <circle class="ring-fg" cx="32" cy="32" r="27" fill="none" :stroke="currentStage.colorVar" stroke-width="6" stroke-linecap="round" :stroke-dasharray="169.65" :stroke-dashoffset="169.65 * (1 - currentStage.progressPct / 100)" />
              </svg>
              <div class="m-dash-ring-text" :style="{ color: currentStage.colorVar }">{{ currentStage.progressPct }}%</div>
            </div>
            <div class="m-dash-info">
              <div class="m-dash-label">当前阶段</div>
              <div class="m-dash-big m-dash-big-sm">{{ currentStage.shortLabel }}</div>
              <div class="m-dash-desc">{{ currentStage.completedCount }}/{{ currentStage.totalCount }} 模块</div>
            </div>
          </div>
          <!-- 全部完成时的替代卡 -->
          <div v-else class="m-dash-card" style="--dash-color: var(--lt-success);">
            <div class="m-dash-ring">
              <svg viewBox="0 0 64 64" role="img" aria-label="全部完成">
                <circle cx="32" cy="32" r="27" fill="none" stroke="var(--lt-border)" stroke-width="6"/>
                <circle class="ring-fg" cx="32" cy="32" r="27" fill="none" stroke="var(--lt-success)" stroke-width="6" stroke-linecap="round" stroke-dasharray="169.65" stroke-dashoffset="0" />
              </svg>
              <div class="m-dash-ring-text" style="color: var(--lt-success);">✓</div>
            </div>
            <div class="m-dash-info">
              <div class="m-dash-label">全部完成</div>
              <div class="m-dash-big" v-if="planStore.overallMastery != null">{{ Math.round(planStore.overallMastery * 100) }}%</div>
              <div class="m-dash-desc">平均掌握度</div>
            </div>
          </div>

          <!-- 时长统计 -->
          <div class="m-dash-card" style="--dash-color: var(--lt-orange);">
            <div class="m-dash-time-icon">⏱</div>
            <div class="m-dash-info">
              <div class="m-dash-label">预估时长</div>
              <div class="m-dash-big">{{ totalHours }}<span class="m-dash-sub">h</span></div>
              <div class="m-dash-desc">剩余约 {{ remainingHours }}h</div>
            </div>
          </div>
        </div>

        <!-- 总进度条 -->
        <div class="m-dash-progress-bar">
          <div class="m-progress-bar">
            <div class="m-progress-fill" :style="{ width: planStore.overallProgress + '%' }" />
          </div>
          <span v-if="planStore.overallMastery != null" class="m-dash-mastery">掌握度 <strong style="color: var(--lt-brand);">{{ Math.round(planStore.overallMastery * 100) }}%</strong></span>
        </div>

        <!-- 当前位置条 -->
        <div v-if="planStore.currentActivity && planStore.status !== 'completed'" class="m-path-current">
          <div class="m-current-accent"></div>
          <span class="m-current-label">当前位置</span>
          <span class="m-current-name">{{ planStore.currentModule?.title }} · {{ planStore.currentActivity.title }}</span>
          <span v-if="planStore.currentActivity.result?.score != null" class="m-current-score">上次得分 {{ Math.round(planStore.currentActivity.result.score * 100) }}%</span>
          <button class="m-current-btn" @click="goToLearn(planStore.currentActivity!, planStore.currentModule?.moduleId)">继续 <el-icon :size="14"><ArrowRight /></el-icon></button>
        </div>
      </div>

      <!-- DAG 内联展开 -->
      <div v-if="dagExpanded && planStore.moduleList.length > 0" class="m-dag-inline stagger-fade-in">
        <PathDag :modules="planStore.moduleList" @node-click="scrollToModule" />
      </div>

      <!-- 阶段分组 + 时间轴 -->
      <div class="m-stages-container">
        <div
          v-for="(stage, stageIdx) in stages"
          :key="stage.key"
          class="m-stage-section"
          :style="{ '--stage-color': stage.colorVar, '--stage-color-light': stage.colorLightVar }"
        >
          <!-- 阶段头 -->
          <div class="m-stage-header">
            <span class="m-stage-badge">
              <span class="m-stage-badge-dot"></span>
              第{{ ['一','二','三'][stageIdx] }}阶段 · {{ stage.shortLabel }}
            </span>
            <span class="m-stage-meta">{{ stage.totalCount }}模块 · {{ stage.totalHours }}h</span>
            <div class="m-stage-progress-mini">
              <div class="m-stage-progress-fill" :style="{ width: stage.progressPct + '%' }"></div>
            </div>
            <span class="m-stage-progress-text">{{ stage.completedCount }}/{{ stage.totalCount }}</span>
          </div>

          <!-- 阶段内模块（时间轴） -->
          <div class="m-modules-grid">
            <div
              v-for="(mod, modIdx) in stage.modules" :key="mod.moduleId"
              :id="`module-${mod.moduleId}`"
              class="m-module-card stagger-fade-in"
              :class="[
                `status-${mod.status}`,
                { 'is-expanded': expandedModules.has(mod.moduleId) }
              ]"
              :style="{ animationDelay: `${(stageIdx * 3 + modIdx) * 60}ms` }"
            >
              <!-- 头部 -->
              <div class="m-module-header" @click="toggleModule(mod.moduleId)">
                <div class="m-module-icon">
                  <el-icon :size="18" :style="{ color: mod.status === 'completed' ? 'var(--lt-success)' : mod.status === 'in_progress' ? 'var(--stage-color)' : 'var(--lt-text-auxiliary)' }">
                    <CircleCheckFilled v-if="mod.status === 'completed'" />
                    <Right v-else-if="mod.status === 'in_progress'" />
                    <Lock v-else-if="mod.status === 'locked'" />
                    <ArrowDown v-else />
                  </el-icon>
                </div>
                <div class="m-module-info">
                  <h4 class="m-module-title">{{ mod.title }}</h4>
                  <div class="m-module-tags">
                    <span class="m-tag" :class="scopeTagClass(mod.scope)">{{ scopeLabel(mod.scope) }}</span>
                    <span class="m-tag" :class="depthTagClass(mod.depth)">{{ depthLabel(mod.depth) }}</span>
                    <span class="m-tag-time">{{ mod.estimatedHours }}h</span>
                    <span v-if="mod.status === 'locked' && mod.prerequisites?.length" class="m-tag-prereq">需先完成：{{ mod.prerequisites.map(p => planStore.moduleList.find(m => m.moduleId === p)?.title || p).join('、') }}</span>
                  </div>
                </div>
                <div class="m-module-right">
                  <span class="m-module-status" :class="mod.status">{{ moduleStatusLabel(mod.status) }}</span>
                  <el-icon :size="16" class="m-module-arrow"><ArrowRight /></el-icon>
                </div>
              </div>

              <!-- 展开内容 -->
              <Transition name="m-expand">
              <div v-if="expandedModules.has(mod.moduleId)" class="m-module-body">
                <!-- Gap tasks 查看进度 -->
                <div
                  v-for="gt in planStore.gapTasks.filter(g => g.moduleId === mod.moduleId)"
                  :key="gt.taskId"
                  class="m-gap-banner"
                >
                  <span class="m-gap-icon">⚡</span>
                  <div class="m-gap-info">
                    <span class="m-gap-label">资源生成中</span>
                    <span class="m-gap-types">{{ gt.resourceTypes.map(t => typeLabel(t)).join('、') }}</span>
                  </div>
                  <button class="m-gap-link" @click="router.push(`/studio?taskId=${gt.taskId}`)">查看进度</button>
                </div>

                <div v-if="mod.mastery != null" class="m-mastery-row">
                  <span class="m-mastery-label">掌握度</span>
                  <div class="m-mastery-bar">
                    <div class="m-mastery-fill" :class="{ good: mod.mastery >= 0.7 }" :style="{ width: Math.round(mod.mastery * 100) + '%' }" />
                  </div>
                  <span class="m-mastery-val">{{ Math.round(mod.mastery * 100) }}%</span>
                </div>

                <div class="m-activity-list">
                  <div v-for="act in (mod.subPlan?.activities || [])" :key="act.activityId" class="m-activity-item" :style="{ borderLeftColor: typeColor(act.type), opacity: act.status === 'locked' ? 0.5 : 1 }">
                    <span class="m-act-icon">{{ typeIcon(act.type) }}</span>
                    <div class="m-act-info">
                      <span class="m-act-title">{{ act.title }}</span>
                      <div class="m-act-meta">
                        <span>{{ act.type === 'learn' ? '学习' : '拓展' }} · {{ act.estimatedMinutes }}min</span>
                        <template v-if="act.resources && act.resources.length > 0">
                          <span v-for="(r, ri) in act.resources" :key="ri" class="m-res-tag" :class="r.source === 'matched' ? 'matched' : 'gen'">{{ r.resourceType }}</span>
                        </template>
                        <span v-else-if="act.resource" class="m-res-tag" :class="act.resource.source === 'matched' ? 'matched' : 'gen'">{{ act.resource.source === 'matched' ? '已匹配' : act.resource.resourceType }}</span>
                        <span v-if="act.result?.score != null" class="m-act-score" :class="{ good: (act.result.score || 0) >= 0.7 }">得分 {{ Math.round((act.result.score || 0) * 100) }}%</span>
                        <span v-for="tag in (act.result?.weakTags || [])" :key="tag" class="m-weak-tag">{{ tag }}</span>
                      </div>
                      <div class="m-act-status-tags">
                        <span v-if="act.status === 'completed'" class="m-status-tag success">已完成</span>
                        <span v-else-if="act.status === 'failed'" class="m-status-tag danger">未达标</span>
                        <span v-else-if="act.status === 'locked'" class="m-status-tag locked">🔒 锁定</span>
                        <span v-else-if="act.status === 'in_progress'" class="m-status-tag primary">进行中</span>
                      </div>
                    </div>
                    <div class="m-act-actions">
                      <button v-if="act.status === 'ready' || act.status === 'in_progress'" class="m-act-btn" :class="{ disabled: act.type === 'explore' }" :disabled="act.type === 'explore'" @click="goToLearn(act, mod.moduleId)">{{ act.status === 'in_progress' ? '继续' : '开始' }}</button>
                      <button v-if="act.status === 'failed'" class="m-act-btn retry" @click="goToLearn(act, mod.moduleId)">重试</button>
                      <button v-if="act.type === 'explore' && act.status !== 'skipped' && act.status !== 'completed'" class="m-act-btn outline" @click="goToLearn(act, mod.moduleId)">浏览</button>
                    </div>
                  </div>
                </div>

                <div class="m-module-footer">
                  <span class="m-footer-progress">进度 {{ mod.subPlan?.activities.filter(a => a.status === 'completed').length || 0 }}/{{ mod.subPlan?.activities.length || 0 }}</span>
                  <button class="m-replan-btn" @click="goToModuleReplan(mod.moduleId)">重新规划此模块</button>
                </div>
              </div>
              </Transition>
            </div>
          </div>

          <!-- 阶段里程碑 -->
          <div class="m-milestone">
            <div class="m-milestone-icon">🏁</div>
            <div class="m-milestone-text">
              <div class="m-milestone-title">第{{ ['一','二','三'][stageIdx] }}阶段里程碑</div>
              <div class="m-milestone-sub">完成 {{ stage.completedCount }}/{{ stage.totalCount }} 模块后解锁 · 综合测验</div>
            </div>
            <div class="m-milestone-progress" v-if="stage.progressPct < 100">{{ stage.progressPct }}%</div>
            <div class="m-milestone-done" v-else>✓</div>
          </div>
        </div>
      </div>

      <!-- 完成 -->
      <div v-if="planStore.status === 'completed'" class="m-path-done stagger-fade-in">
        <div class="m-done-circle"><span class="m-done-check">✓</span></div>
        <h2 class="m-done-title">学习计划已完成！</h2>
        <div class="m-done-stats">
          <div class="m-done-stat">
            <span class="m-done-val">{{ planStore.plan?.summary?.totalHours || '-' }}</span>
            <span class="m-done-label">总用时(小时)</span>
          </div>
          <div class="m-done-stat">
            <span class="m-done-val">{{ planStore.overallMastery != null ? Math.round(planStore.overallMastery * 100) + '%' : '-' }}</span>
            <span class="m-done-label">平均掌握度</span>
          </div>
          <div class="m-done-stat">
            <span class="m-done-val">{{ planStore.completedModules.length }}/{{ planStore.moduleList.length }}</span>
            <span class="m-done-label">完成模块</span>
          </div>
        </div>
        <p v-if="planStore.overallWeakTags.length" class="m-done-weak">薄弱点：{{ planStore.overallWeakTags.join('、') }}</p>
        <button class="m-done-btn" @click="router.push('/report')">生成学习报告</button>
      </div>

      <!-- Explore BottomSheet -->
      <BottomSheet v-model="exploreDrawerVisible" height="medium" :title="exploreActivity?.title || '拓展阅读'">
        <template v-if="exploreActivity">
          <div class="m-explore-desc">{{ exploreActivity.description }}</div>
          <div class="m-explore-actions">
            <button class="m-explore-btn primary" @click="planStore.submitActivity(exploreActivity.activityId, { duration_seconds: 0, interaction_detected: true })">标记完成</button>
            <button class="m-explore-btn" @click="exploreDrawerVisible = false">关闭</button>
          </div>
        </template>
      </BottomSheet>

      <!-- DAG BottomSheet -->
      <BottomSheet v-model="showDagSheet" height="large" title="模块依赖图">
        <PathDag v-if="planStore.moduleList.length > 0" :modules="planStore.moduleList" @node-click="(id: string) => { scrollToModule(id); showDagSheet = false }" />
      </BottomSheet>

      <!-- 调整历史 BottomSheet -->
      <BottomSheet v-model="showAdjustSheet" height="large" title="调整历史">
        <template v-if="planStore.plan">
          <div v-for="mod in planStore.moduleList" :key="mod.moduleId">
            <div v-if="mod.subPlan?.adjustments?.length">
              <h4 class="m-adj-title">{{ mod.title }}</h4>
              <div v-for="(adj, i) in mod.subPlan.adjustments" :key="i" class="m-adj-item">
                <p class="m-adj-reason">{{ adj.reason }}</p>
                <p class="m-adj-time">{{ adj.at }}</p>
              </div>
            </div>
          </div>
          <p v-if="!planStore.moduleList.some(m => m.subPlan?.adjustments?.length)" class="m-adj-empty">暂无调整记录</p>
        </template>
      </BottomSheet>

      <!-- 锁定模式 BottomSheet -->
      <BottomSheet v-model="showLockSheet" height="medium" title="学习模式">
        <div class="m-lock-options">
          <button class="m-lock-option"
                  :class="{ 'is-active': planStore.plan?.lockMode === 'sequential' }"
                  @click="onLockModeSelect('sequential')">
            <span class="m-lock-option-title">按顺序解锁</span>
            <span class="m-lock-option-desc">需按顺序完成，未解锁活动不可学习</span>
          </button>
          <button class="m-lock-option"
                  :class="{ 'is-active': planStore.plan?.lockMode === 'free' }"
                  @click="onLockModeSelect('free')">
            <span class="m-lock-option-title">自由学习</span>
            <span class="m-lock-option-desc">所有活动随时可学，无顺序限制</span>
          </button>
        </div>
      </BottomSheet>
    </template>
  </div>
</template>

<style scoped>
.m-path { padding: 16px; background: var(--lt-bg-page); min-height: 100%; }
.m-path-empty { display: flex; align-items: center; justify-content: center; min-height: 60vh; }
.m-path-gen { padding: 40px 16px; text-align: center; }
.m-gen-msg { font-size: 13px; color: var(--lt-text-auxiliary); margin-top: 12px; }

/* ── Sticky ── */
.m-sticky { position: sticky; top: 0; z-index: 10; padding-top: 12px; background: var(--lt-bg-page); }

/* ── Stagger fade-in ── */
.stagger-fade-in {
  animation: staggerFadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) both;
}
@keyframes staggerFadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Module expand transition ── */
.m-expand-enter-active {
  transition: all 0.3s ease;
  overflow: hidden;
}
.m-expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.m-expand-enter-from,
.m-expand-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ── 仪表盘区 ── */
.m-dashboard { margin-bottom: 12px; }
.m-dash-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.m-dash-grid { display: grid; grid-template-columns: 1fr; gap: 8px; }
.m-dash-grid.two-cards { grid-template-columns: 1fr 1fr; }
.m-dash-card { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--lt-bg-card); border: 0.5px solid var(--lt-border); border-left: 3px solid var(--dash-color); border-radius: 10px; }
.m-dash-ring { position: relative; width: 44px; height: 44px; flex-shrink: 0; }
.m-dash-ring svg { width: 44px; height: 44px; transform: rotate(-90deg); }
.ring-fg { transition: stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1); }
.m-dash-ring-text { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem; color: var(--lt-text-primary); }
.m-dash-info { min-width: 0; }
.m-dash-label { font-size: 0.65rem; color: var(--lt-text-auxiliary); font-weight: 500; text-transform: uppercase; letter-spacing: 0.02em; }
.m-dash-big { font-size: 1.15rem; font-weight: 700; color: var(--lt-text-primary); line-height: 1.2; }
.m-dash-big-sm { font-size: 1rem; }
.m-dash-sub { font-size: 0.7rem; font-weight: 500; color: var(--lt-text-auxiliary); }
.m-dash-desc { font-size: 0.7rem; color: var(--lt-text-secondary); margin-top: 1px; }
.m-dash-time-icon { font-size: 1.4rem; flex-shrink: 0; width: 44px; text-align: center; }
.m-dash-progress-bar { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.m-dash-progress-bar .m-progress-bar { flex: 1; margin-bottom: 0; }
.m-dash-mastery { font-size: 0.7rem; color: var(--lt-text-secondary); white-space: nowrap; }
.m-progress-bar { height: 6px; background: var(--lt-bg-card); border-radius: 3px; overflow: hidden; margin-bottom: 10px; }
.m-progress-fill { height: 100%; background: var(--lt-brand); border-radius: 3px; transition: width 0.3s; }
.m-path-sub-btn { display: flex; align-items: center; gap: 4px; padding: 5px 10px; min-height: 44px; border: 0.5px solid var(--lt-border); border-radius: 8px; background: var(--lt-bg-card); font-size: 11px; color: var(--lt-text-secondary); cursor: pointer; touch-action: manipulation; }
.m-path-sub-btn:active { background: var(--lt-brand-lightest); }
.m-path-sub-btn.is-on { color: var(--lt-brand); border-color: var(--lt-brand); }

/* ── DAG inline ── */
.m-dag-inline { padding: 0 0 12px; }

/* ── Current position（在仪表盘容器内部） ── */
.m-path-current { position: relative; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 10px 14px; background: linear-gradient(135deg, rgba(43,111,255,0.04), rgba(124,92,252,0.03)); border: 0.5px solid rgba(43,111,255,0.15); border-radius: 10px; margin-top: 10px; }
.m-current-accent { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--lt-brand); border-radius: 0 2px 2px 0; }
.m-current-label { font-size: 11px; font-weight: 600; color: var(--lt-brand); background: rgba(43,111,255,0.08); padding: 1px 6px; border-radius: 10px; white-space: nowrap; }
.m-current-name { font-size: 13px; color: var(--lt-text-primary); font-weight: 500; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-current-score { font-size: 11px; color: var(--lt-orange); white-space: nowrap; }
.m-current-btn { display: flex; align-items: center; gap: 2px; padding: 6px 14px; min-height: 44px; border: none; border-radius: 8px; background: var(--lt-brand); color: #fff; font-size: 12px; cursor: pointer; touch-action: manipulation; flex-shrink: 0; }
.m-current-btn:active { opacity: 0.85; }

/* ── 阶段容器 ── */
.m-stages-container { display: flex; flex-direction: column; gap: 20px; }

/* ── 阶段头（移动端 flex-wrap） ── */
.m-stage-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; padding: 0 2px; }
.m-stage-badge { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; font-size: 0.78rem; padding: 5px 11px; border-radius: var(--lt-radius-full); background: var(--stage-color-light); color: var(--stage-color); white-space: nowrap; }
.m-stage-badge-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--stage-color); box-shadow: 0 0 6px var(--stage-color); }
.m-stage-meta { font-size: 0.72rem; color: var(--lt-text-auxiliary); white-space: nowrap; }
.m-stage-progress-mini { height: 4px; border-radius: 2px; background: var(--lt-border); flex: 1; width: 100%; order: 5; overflow: hidden; }
.m-stage-progress-fill { height: 100%; border-radius: 2px; background: var(--stage-color); transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
.m-stage-progress-text { font-size: 0.7rem; color: var(--lt-text-auxiliary); font-weight: 500; white-space: nowrap; }

/* ── 时间轴模块网格（移动端 padding-left: 22px） ── */
.m-modules-grid { display: flex; flex-direction: column; gap: 8px; position: relative; padding-left: 22px; }
.m-modules-grid::before { content: ''; position: absolute; left: 8px; top: 8px; bottom: 8px; width: 2px; border-radius: 1px; background: linear-gradient(to bottom, transparent 0%, var(--lt-border) 8%, var(--lt-border) 92%, transparent 100%); }
/* 节点圆点（移动端 8px） */
.m-module-card::before { content: ''; position: absolute; left: -18px; top: 20px; width: 8px; height: 8px; border-radius: 50%; background: var(--lt-bg-card); border: 2px solid var(--lt-border); z-index: 2; transition: all var(--lt-transition-smooth); box-shadow: 0 0 0 3px var(--lt-bg-page); }
.m-module-card.status-completed::before { background: var(--lt-success); border-color: var(--lt-success); box-shadow: 0 0 0 3px var(--lt-bg-page), 0 0 10px rgba(52, 199, 89, 0.3); }
.m-module-card.status-in_progress::before { background: var(--stage-color); border-color: var(--stage-color); animation: mNodePulse 2s ease-in-out infinite; }
@keyframes mNodePulse {
  0%, 100% { box-shadow: 0 0 0 3px var(--lt-bg-page), 0 0 6px var(--stage-color); }
  50% { box-shadow: 0 0 0 6px var(--stage-color-light), 0 0 14px var(--stage-color); }
}
.m-module-card.status-locked::before { background: var(--lt-text-placeholder); border-color: var(--lt-text-placeholder); box-shadow: 0 0 0 3px var(--lt-bg-page); opacity: 0.6; }

/* ── 模块卡片（不设 overflow: hidden，避免裁剪节点圆点） ── */
.m-module-card { position: relative; background: var(--lt-bg-card); border: 0.5px solid var(--lt-border); border-radius: 12px; transition: box-shadow var(--lt-transition-smooth, 0.2s ease), transform var(--lt-transition-smooth, 0.2s ease), border-color var(--lt-transition-smooth); }
.m-module-card:hover { box-shadow: var(--lt-shadow-hover, 0 4px 16px rgba(0,0,0,0.08)); transform: translateY(-1px); border-color: var(--stage-color, var(--lt-brand-lighter)); }
.m-module-card.is-expanded { box-shadow: var(--lt-shadow-elevated); }
.m-module-header { display: flex; align-items: flex-start; gap: 10px; padding: 14px; cursor: pointer; touch-action: manipulation; position: relative; overflow: hidden; border-radius: 12px; }
.m-module-card.is-expanded .m-module-header { border-radius: 12px 12px 0 0; }
.m-module-header:active { background: var(--stage-color-light, var(--lt-brand-lightest)); }
.m-module-icon { padding-top: 1px; flex-shrink: 0; }
.m-module-info { flex: 1; min-width: 0; }
.m-module-title { font-size: 15px; font-weight: 600; color: var(--lt-text-primary); margin: 0 0 4px; }
.m-module-tags { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.m-tag { font-size: 10px; padding: 1px 6px; border-radius: 6px; background: var(--lt-bg-page); color: var(--lt-text-auxiliary); }
.m-tag.tag-core { background: color-mix(in srgb, var(--lt-brand) 10%, transparent); color: var(--lt-brand); }
.m-tag.tag-sup { background: color-mix(in srgb, var(--lt-warning) 12%, transparent); color: var(--lt-warning); }
.m-tag.tag-ext { background: color-mix(in srgb, var(--lt-ai) 12%, transparent); color: var(--lt-ai); }
.m-tag.tag-basic { background: var(--lt-bg-page); color: var(--lt-text-auxiliary); }
.m-tag.tag-std { background: color-mix(in srgb, var(--lt-success) 12%, transparent); color: var(--lt-success); }
.m-tag.tag-deep { background: color-mix(in srgb, var(--lt-danger) 12%, transparent); color: var(--lt-danger); }
.m-tag-time { font-size: 10px; color: var(--lt-text-placeholder); }
.m-tag-prereq { font-size: 10px; color: var(--lt-text-auxiliary); background: var(--lt-bg-page); padding: 1px 6px; border-radius: 6px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-module-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.m-module-status { font-size: 11px; padding: 2px 8px; border-radius: 8px; font-weight: 500; }
.m-module-status.completed { background: rgba(52,199,89,0.1); color: var(--lt-success); }
.m-module-status.in_progress { background: rgba(43,111,255,0.1); color: var(--lt-brand); }
.m-module-status.locked { background: rgba(168,168,180,0.12); color: var(--lt-text-auxiliary); }
.m-module-status.ready { background: var(--lt-bg-page); color: var(--lt-text-secondary); }
.m-module-arrow { color: var(--lt-text-auxiliary); transition: transform var(--lt-transition-smooth), color var(--lt-transition-smooth); }
.m-module-card.is-expanded .m-module-arrow { transform: rotate(90deg); color: var(--stage-color, var(--lt-brand)); }

/* ── 左侧 accent 条（::after） ── */
.m-module-card::after { content: ''; position: absolute; top: 6px; bottom: 6px; left: 0; width: 3px; background: var(--stage-color, var(--lt-brand)); transform: scaleY(0); transform-origin: top; transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), opacity var(--lt-transition-smooth), background var(--lt-transition-smooth); z-index: 1; border-radius: 2px; }
.m-module-card:hover::after { transform: scaleY(1); }
.m-module-card.is-expanded::after { transform: scaleY(1); opacity: 0.5; }

/* ── 状态视觉强化 ── */
.m-module-card.status-locked { opacity: 0.7; border-style: dashed; background: var(--lt-bg-page); }
.m-module-card.status-locked .m-module-title { color: var(--lt-text-auxiliary); }
.m-module-card.status-completed::after { transform: scaleY(1); background: var(--lt-success); opacity: 0.6; }
.m-module-card.status-completed:hover::after { opacity: 1; }
.m-module-card.status-in_progress { border-color: var(--stage-color); }
.m-module-card.status-in_progress::after { transform: scaleY(1); background: var(--stage-color); opacity: 0.7; }

/* ── 已完成 shimmer（移动端 4s 放慢） ── */
.m-module-card.status-completed .m-module-header::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent 0%, rgba(52, 199, 89, 0.06) 50%, transparent 100%); transform: translateX(-100%); animation: mShimmerSweep 4s ease-in-out infinite; pointer-events: none; z-index: 0; }
@keyframes mShimmerSweep {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* ── 里程碑卡（移动端缩小） ── */
.m-milestone { display: flex; align-items: center; gap: 10px; padding: 12px 14px; margin: 4px 0 0 0; background: linear-gradient(135deg, var(--lt-bg-card), var(--stage-color-light)); border-radius: 12px; border: 1px dashed var(--lt-border); position: relative; z-index: 1; }
.m-milestone-icon { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1rem; background: var(--stage-color-light); flex-shrink: 0; }
.m-milestone-text { flex: 1; min-width: 0; }
.m-milestone-title { font-weight: 600; font-size: 0.82rem; color: var(--lt-text-primary); }
.m-milestone-sub { font-size: 0.7rem; color: var(--lt-text-auxiliary); margin-top: 2px; }
.m-milestone-progress { font-size: 1rem; font-weight: 700; color: var(--stage-color); }
.m-milestone-done { font-size: 1.2rem; font-weight: 700; color: var(--lt-success); }

/* ── Module body ── */
.m-module-body { border-top: 1px solid var(--lt-border); padding: 12px 14px 14px; border-radius: 0 0 12px 12px; }

/* ── Gap banner ── */
.m-gap-banner {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; margin-bottom: 12px;
  background: linear-gradient(135deg, rgba(124,92,252,0.06), rgba(124,92,252,0.02));
  border: 0.5px solid rgba(124,92,252,0.2);
  border-radius: 10px;
}
.m-gap-icon { font-size: 16px; flex-shrink: 0; }
.m-gap-info { flex: 1; min-width: 0; }
.m-gap-label { font-size: 12px; font-weight: 600; color: var(--lt-ai); display: block; }
.m-gap-types { font-size: 10px; color: var(--lt-text-auxiliary); }
.m-gap-link { display: flex; align-items: center; font-size: 11px; color: var(--lt-ai, #7C5CFC); background: none; border: none; cursor: pointer; white-space: nowrap; padding: 4px 8px; min-height: 44px; border-radius: 6px; touch-action: manipulation; }
.m-gap-link:active { background: rgba(124,92,252,0.1); }

.m-mastery-row { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.m-mastery-label { font-size: 12px; color: var(--lt-text-auxiliary); flex-shrink: 0; }
.m-mastery-bar { flex: 1; height: 6px; background: var(--lt-bg-page); border-radius: 3px; overflow: hidden; }
.m-mastery-fill { height: 100%; background: var(--lt-warning); border-radius: 3px; transition: width 0.3s; }
.m-mastery-fill.good { background: var(--lt-success); }
.m-mastery-val { font-size: 12px; font-weight: 500; color: var(--lt-text-secondary); }

/* ── Activity list ── */
.m-activity-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.m-activity-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-left: 3px solid var(--lt-border); background: var(--lt-bg-page); border-radius: 0 8px 8px 0; transition: background var(--lt-transition-smooth, 0.15s ease); }
.m-activity-item:hover { background: rgba(43,111,255,0.03); }
.m-act-icon { font-size: 18px; flex-shrink: 0; }
.m-act-info { flex: 1; min-width: 0; }
.m-act-title { font-size: 13px; font-weight: 500; color: var(--lt-text-primary); display: block; margin-bottom: 3px; }
.m-act-meta { display: flex; gap: 6px; flex-wrap: wrap; font-size: 11px; color: var(--lt-text-auxiliary); align-items: center; }
.m-act-score { font-weight: 500; }
.m-act-score.good { color: var(--lt-success); }

/* ── Resource type tags ── */
.m-res-tag { font-size: 10px; padding: 1px 6px; border-radius: 4px; font-weight: 500; }
.m-res-tag.matched { background: rgba(52,199,89,0.1); color: var(--lt-success); }
.m-res-tag.gen { background: rgba(168,168,180,0.12); color: var(--lt-text-auxiliary); }

/* ── Weak point tags ── */
.m-weak-tag { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: rgba(255,159,10,0.12); color: var(--lt-orange-text, #D48806); font-weight: 500; }

/* ── Activity status tags ── */
.m-act-status-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px; }
.m-status-tag { font-size: 10px; padding: 1px 6px; border-radius: 4px; font-weight: 500; }
.m-status-tag.success { background: rgba(52,199,89,0.1); color: var(--lt-success); }
.m-status-tag.danger { background: rgba(245,108,108,0.1); color: var(--lt-danger, #F56C6C); }
.m-status-tag.locked { background: rgba(168,168,180,0.12); color: var(--lt-text-auxiliary); }
.m-status-tag.primary { background: rgba(43,111,255,0.1); color: var(--lt-brand); }

/* ── Activity actions ── */
.m-act-actions { display: flex; gap: 4px; flex-shrink: 0; }
.m-act-btn { display: flex; align-items: center; padding: 6px 12px; min-height: 44px; border: none; border-radius: 8px; background: var(--lt-brand); color: #fff; font-size: 12px; cursor: pointer; touch-action: manipulation; }
.m-act-btn:active { opacity: 0.85; }
.m-act-btn.retry { background: var(--lt-orange); }
.m-act-btn.outline { background: transparent; border: 0.5px solid var(--lt-brand); color: var(--lt-brand); }
.m-act-btn.disabled { opacity: 0.4; pointer-events: none; }

/* ── Module footer ── */
.m-module-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid var(--lt-border); }
.m-footer-progress { font-size: 11px; color: var(--lt-text-auxiliary); }
.m-replan-btn { display: flex; align-items: center; padding: 0 8px; min-height: 44px; font-size: 11px; color: var(--lt-brand); background: none; border: none; cursor: pointer; touch-action: manipulation; }
.m-replan-btn:active { opacity: 0.7; }

/* ── Completion ── */
.m-path-done { text-align: center; padding: 32px 16px; background: linear-gradient(180deg, rgba(43,111,255,0.03), transparent); border-radius: 12px; border: 0.5px solid var(--lt-border); }
.m-done-circle { width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, var(--lt-brand), var(--lt-brand-light)); color: #fff; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px; box-shadow: 0 4px 16px rgba(43,111,255,0.25); animation: celebrationPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
.m-done-check { font-size: 32px; font-weight: 700; }
@keyframes celebrationPop {
  0% { transform: scale(0); opacity: 0; }
  70% { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
}
.m-done-title { font-size: 18px; font-weight: 700; color: var(--lt-text-primary); margin: 0 0 12px; }
.m-done-stats { display: flex; justify-content: center; gap: 24px; margin-bottom: 12px; }
.m-done-stat { text-align: center; }
.m-done-val { display: block; font-size: 18px; font-weight: 700; color: var(--lt-text-primary); }
.m-done-label { font-size: 11px; color: var(--lt-text-auxiliary); }
.m-done-weak { font-size: 12px; color: var(--lt-orange-text, #D48806); margin: 0 0 16px; }
.m-done-btn { padding: 10px 24px; border: none; border-radius: 10px; background: var(--lt-brand); color: #fff; font-size: 14px; cursor: pointer; touch-action: manipulation; }

/* ── Explore BottomSheet ── */
.m-explore-desc { font-size: 14px; color: var(--lt-text-secondary); line-height: 1.6; margin-bottom: 16px; }
.m-explore-actions { display: flex; gap: 12px; padding-top: 12px; border-top: 1px solid var(--lt-border); }
.m-explore-btn { flex: 1; padding: 10px; border: 0.5px solid var(--lt-border); border-radius: 8px; background: var(--lt-bg-card); font-size: 14px; color: var(--lt-text-primary); cursor: pointer; touch-action: manipulation; }
.m-explore-btn.primary { background: var(--lt-brand); color: #fff; border-color: var(--lt-brand); }
.m-explore-btn:active { opacity: 0.85; }

/* ── Adjustments ── */
.m-adj-title { font-size: 13px; font-weight: 600; color: var(--lt-text-primary); margin: 12px 0 8px; }
.m-adj-item { padding: 10px 12px; background: rgba(255,159,10,0.06); border-radius: 8px; margin-bottom: 6px; }
.m-adj-reason { font-size: 12px; color: var(--lt-warning); margin: 0 0 4px; }
.m-adj-time { font-size: 10px; color: var(--lt-text-auxiliary); margin: 0; }
.m-adj-empty { text-align: center; font-size: 13px; color: var(--lt-text-auxiliary); padding: 24px 0; }

/* ── 锁定模式选项 ── */
.m-lock-options { display: flex; flex-direction: column; gap: 10px; padding: 4px 0; }
.m-lock-option { display: flex; flex-direction: column; gap: 4px; min-height: 44px; padding: 14px 16px; border: 0.5px solid var(--lt-border); border-radius: 10px; background: var(--lt-bg-card); cursor: pointer; touch-action: manipulation; transition: transform 0.15s ease; text-align: left; }
.m-lock-option:active { transform: scale(0.97); background: var(--lt-brand-lightest); }
.m-lock-option.is-active { border-color: var(--lt-brand); background: rgba(43,111,255,0.06); }
.m-lock-option-title { font-size: 15px; font-weight: 600; color: var(--lt-text-primary); }
.m-lock-option.is-active .m-lock-option-title { color: var(--lt-brand); }
.m-lock-option-desc { font-size: 12px; color: var(--lt-text-auxiliary); }

/* ── 无障碍：减少动效偏好 ── */
@media (prefers-reduced-motion: reduce) {
  .m-module-card.status-in_progress::before { animation: none; }
  .m-module-card.status-completed .m-module-header::after { animation: none; display: none; }
  .stagger-fade-in { animation: none; opacity: 1; }
  .m-module-card::after,
  .m-module-arrow { transition: none !important; }
}
</style>
