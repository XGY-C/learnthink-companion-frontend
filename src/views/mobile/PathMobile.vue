<script setup lang="ts">
import { onMounted, watch, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProfileStore } from '@/stores/profile'
import { usePlanStore } from '@/stores/plan'
import { usePathInteraction } from '@/composables/usePathInteraction'
import { typeIcon, typeColor, scopeLabel, depthLabel, moduleStatusLabel } from '@/utils/formatters'
import { ArrowRight, Refresh, CircleCheckFilled, Lock, Right, ArrowDown, DataAnalysis } from '@element-plus/icons-vue'
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
  dagExpanded,
  adjustmentHistoryVisible,
  toggleModule,
  goToLearn,
  scrollToModule,
} = usePathInteraction()

const showDagSheet = ref(false)
const showAdjustSheet = ref(false)

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

function goToModuleReplan(moduleId: string) { planStore.refreshModule(moduleId) }

function typeLabel(type: string): string {
  const map: Record<string, string> = { doc: '讲解文档', mindmap: '思维导图', quiz: '练习题', reading: '拓展阅读', code: '代码案例', video: '讲解视频' }
  return map[type] || type
}
</script>

<template>
  <div class="m-path">
    <!-- 空状态 -->
    <template v-if="planStore.status === 'empty'">
      <div class="m-path-empty">
        <EmptyStateVue title="还没有学习计划" message="在这里查看为你量身定制的学习路线，跟踪每个知识点的掌握进度。" button-text="生成我的学习计划" :loading="planStore.loading" @action="handleGenerate">
          <template #icon><div class="text-5xl mb-4">📋</div></template>
          <template #footer><p class="mt-3 text-xs" style="color: var(--lt-text-auxiliary);">也可以去对话页让 AI 帮你规划</p></template>
        </EmptyStateVue>
      </div>
    </template>

    <!-- 生成中 -->
    <template v-else-if="planStore.status === 'generating'">
      <div class="m-path-gen">
        <GenerationCard topic="学习计划生成" :task-id="planStore.generationTaskId" task-type="plan" status="generating" :progress="planStore.generationPercent" :message="planStore.generationMessage" />
        <p class="m-gen-msg">{{ planStore.generationMessage || '正在分析课程结构与画像...' }}</p>
      </div>
    </template>

    <!-- 就绪态 -->
    <template v-else-if="planStore.plan">
      <!-- 顶部进度 -->
      <div class="m-path-top">
        <div class="m-path-top-row">
          <span class="m-path-top-text">进度 {{ planStore.completedModules.length }}/{{ planStore.moduleList.length }} · 掌握度 {{ planStore.overallMastery != null ? Math.round(planStore.overallMastery * 100) : '-' }}%</span>
          <button class="m-path-refresh" @click="planStore.fetchPlan(profile.activeCourseId || '')"><el-icon :size="14"><Refresh /></el-icon></button>
        </div>
        <div class="m-progress-bar">
          <div class="m-progress-fill" :style="{ width: planStore.overallProgress + '%' }" />
        </div>
        <div class="m-path-top-actions">
          <button class="m-path-sub-btn" @click="showDagSheet = true"><el-icon :size="14"><DataAnalysis /></el-icon> 模块依赖图</button>
          <button class="m-path-sub-btn" @click="showAdjustSheet = true"><el-icon :size="14"><DataAnalysis /></el-icon> 调整历史</button>
        </div>
      </div>

      <!-- 当前位置 -->
      <div v-if="planStore.currentActivity && planStore.status !== 'completed'" class="m-path-current">
        <span class="m-current-label">📍 当前位置</span>
        <span class="m-current-name">{{ planStore.currentModule?.title }} · {{ planStore.currentActivity.title }}</span>
        <button class="m-current-btn" @click="goToLearn(planStore.currentActivity!, planStore.currentModule?.moduleId)">继续 <el-icon :size="14"><ArrowRight /></el-icon></button>
      </div>

      <!-- 模块列表 -->
      <div class="m-module-list">
        <div
          v-for="mod in planStore.moduleList" :key="mod.moduleId"
          :id="`module-${mod.moduleId}`"
          class="m-module-card"
          :class="{ in_progress: mod.status === 'in_progress', completed: mod.status === 'completed' }"
        >
          <!-- 头部 -->
          <div class="m-module-header" @click="toggleModule(mod.moduleId)">
            <div class="m-module-icon">
              <el-icon :size="18" :style="{ color: mod.status === 'completed' ? 'var(--lt-success)' : mod.status === 'in_progress' ? 'var(--lt-brand)' : 'var(--lt-text-auxiliary)' }">
                <CircleCheckFilled v-if="mod.status === 'completed'" />
                <Right v-else-if="mod.status === 'in_progress'" />
                <Lock v-else-if="mod.status === 'locked'" />
                <ArrowDown v-else />
              </el-icon>
            </div>
            <div class="m-module-info">
              <h4 class="m-module-title">{{ mod.title }}</h4>
              <div class="m-module-tags">
                <span class="m-tag">{{ scopeLabel(mod.scope) }}</span>
                <span class="m-tag">{{ depthLabel(mod.depth) }}</span>
                <span class="m-tag-time">{{ mod.estimatedHours }}h</span>
              </div>
            </div>
            <div class="m-module-right">
              <span class="m-module-status" :class="mod.status">{{ moduleStatusLabel(mod.status) }}</span>
              <el-icon :size="16" style="color: var(--lt-text-auxiliary); transition: transform 0.2s;" :class="{ 'rotated': expandedModules.has(mod.moduleId) }"><ArrowRight /></el-icon>
            </div>
          </div>

          <!-- 展开内容 -->
          <div v-if="expandedModules.has(mod.moduleId)" class="m-module-body">
            <!-- Gap tasks banner -->
            <div
              v-for="gt in planStore.gapTasks.filter(g => g.moduleId === mod.moduleId)"
              :key="gt.taskId"
              class="m-gap-banner"
            >
              <span class="m-gap-icon">🔧</span>
              <div class="m-gap-info">
                <span class="m-gap-label">缺口资源生成中</span>
                <span class="m-gap-types">{{ gt.resourceTypes.map(t => typeLabel(t)).join('、') }}</span>
              </div>
              <span class="m-gap-badge">生成中</span>
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
                    <span>{{ act.estimatedMinutes }}min</span>
                    <span v-if="act.result?.score != null" class="m-act-score" :class="{ good: (act.result.score || 0) >= 0.7 }">得分 {{ Math.round((act.result.score || 0) * 100) }}%</span>
                  </div>
                </div>
                <button v-if="act.status === 'ready' || act.status === 'in_progress'" class="m-act-btn" @click="goToLearn(act, mod.moduleId)">{{ act.status === 'in_progress' ? '继续' : '开始' }}</button>
                <button v-if="act.status === 'failed'" class="m-act-btn retry" @click="goToLearn(act, mod.moduleId)">重试</button>
              </div>
            </div>
            <div class="m-module-footer">
              <span class="m-footer-progress">进度 {{ mod.subPlan?.activities.filter(a => a.status === 'completed').length || 0 }}/{{ mod.subPlan?.activities.length || 0 }}</span>
              <button class="m-replan-btn" @click="goToModuleReplan(mod.moduleId)">重新规划此模块</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 完成 -->
      <div v-if="planStore.status === 'completed'" class="m-path-done">
        <div class="text-4xl mb-3">🎉</div>
        <h2 class="m-done-title">学习计划已完成！</h2>
        <p class="m-done-sub">用时 {{ planStore.plan?.summary?.totalHours }} 小时 · 掌握度 {{ planStore.overallMastery != null ? Math.round(planStore.overallMastery * 100) : '-' }}%</p>
        <button class="m-done-btn" @click="router.push('/report')">生成学习报告</button>
      </div>

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
    </template>
  </div>
</template>

<style scoped>
.m-path { padding: 16px; background: var(--lt-bg-page); min-height: 100%; }
.m-path-empty { display: flex; align-items: center; justify-content: center; min-height: 60vh; }
.m-path-gen { padding: 40px 16px; text-align: center; }
.m-gen-msg { font-size: 13px; color: var(--lt-text-auxiliary); margin-top: 12px; }

/* Top */
.m-path-top { margin-bottom: 16px; }
.m-path-top-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.m-path-top-text { font-size: 13px; color: var(--lt-text-secondary); }
.m-path-refresh { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border: none; background: transparent; color: var(--lt-brand); cursor: pointer; border-radius: 8px; touch-action: manipulation; }
.m-path-refresh:active { background: var(--lt-brand-lightest); }
.m-progress-bar { height: 6px; background: var(--lt-bg-card); border-radius: 3px; overflow: hidden; margin-bottom: 10px; }
.m-progress-fill { height: 100%; background: var(--lt-brand); border-radius: 3px; transition: width 0.3s; }
.m-path-top-actions { display: flex; gap: 8px; }
.m-path-sub-btn { display: flex; align-items: center; gap: 4px; padding: 6px 12px; border: 0.5px solid var(--lt-border); border-radius: 8px; background: var(--lt-bg-card); font-size: 12px; color: var(--lt-text-secondary); cursor: pointer; touch-action: manipulation; }

/* Current */
.m-path-current { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 14px; background: linear-gradient(135deg, var(--lt-brand-lightest), #F0F5FF); border: 0.5px solid var(--lt-brand-lighter); border-radius: 10px; margin-bottom: 16px; }
.m-current-label { font-size: 12px; color: var(--lt-brand); font-weight: 500; }
.m-current-name { font-size: 13px; color: var(--lt-text-primary); font-weight: 500; flex: 1; min-width: 0; }
.m-current-btn { display: flex; align-items: center; gap: 2px; padding: 6px 14px; border: none; border-radius: 8px; background: var(--lt-brand); color: #fff; font-size: 12px; cursor: pointer; touch-action: manipulation; }

/* Module cards */
.m-module-list { display: flex; flex-direction: column; gap: 12px; }
.m-module-card { background: var(--lt-bg-card); border: 0.5px solid var(--lt-border); border-radius: 12px; overflow: hidden; }
.m-module-card.in_progress { border-color: var(--lt-brand-lighter); }
.m-module-card.completed { border-color: rgba(52,199,89,0.3); }
.m-module-header { display: flex; align-items: flex-start; gap: 10px; padding: 14px; cursor: pointer; touch-action: manipulation; }
.m-module-header:active { background: var(--lt-brand-lightest); }
.m-module-icon { padding-top: 1px; flex-shrink: 0; }
.m-module-info { flex: 1; min-width: 0; }
.m-module-title { font-size: 15px; font-weight: 600; color: var(--lt-text-primary); margin: 0 0 4px; }
.m-module-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.m-tag { font-size: 10px; padding: 1px 6px; border-radius: 6px; background: var(--lt-bg-page); color: var(--lt-text-auxiliary); }
.m-tag-time { font-size: 10px; color: var(--lt-text-placeholder); }
.m-module-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.m-module-status { font-size: 11px; padding: 2px 8px; border-radius: 8px; font-weight: 500; }
.m-module-status.completed { background: rgba(52,199,89,0.1); color: var(--lt-success); }
.m-module-status.in_progress { background: rgba(43,111,255,0.1); color: var(--lt-brand); }
.m-module-status.locked { background: rgba(168,168,180,0.12); color: var(--lt-text-auxiliary); }
.m-module-status.ready { background: var(--lt-bg-page); color: var(--lt-text-secondary); }
.rotated { transform: rotate(180deg); }

/* Module body */
.m-module-body { border-top: 1px solid var(--lt-border); padding: 12px 14px 14px; }
/* Gap banner */
.m-gap-banner {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; margin-bottom: 12px;
  background: linear-gradient(135deg, rgba(124,92,252,0.06), rgba(124,92,252,0.02));
  border: 0.5px solid rgba(124,92,252,0.2);
  border-radius: 10px;
}
.m-gap-icon { font-size: 16px; flex-shrink: 0; }
.m-gap-info { flex: 1; min-width: 0; }
.m-gap-label { font-size: 12px; font-weight: 600; color: #7C5CFC; display: block; }
.m-gap-types { font-size: 10px; color: var(--lt-text-auxiliary); }
.m-gap-badge {
  font-size: 10px; padding: 2px 8px; border-radius: 8px;
  background: rgba(124,92,252,0.1); color: #7C5CFC;
  white-space: nowrap;
}

.m-mastery-row { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.m-mastery-label { font-size: 12px; color: var(--lt-text-auxiliary); flex-shrink: 0; }
.m-mastery-bar { flex: 1; height: 6px; background: var(--lt-bg-page); border-radius: 3px; overflow: hidden; }
.m-mastery-fill { height: 100%; background: var(--lt-warning); border-radius: 3px; transition: width 0.3s; }
.m-mastery-fill.good { background: var(--lt-success); }
.m-mastery-val { font-size: 12px; font-weight: 500; color: var(--lt-text-secondary); }

.m-activity-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.m-activity-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-left: 3px solid var(--lt-border); background: var(--lt-bg-page); border-radius: 0 8px 8px 0; }
.m-act-icon { font-size: 18px; flex-shrink: 0; }
.m-act-info { flex: 1; min-width: 0; }
.m-act-title { font-size: 13px; font-weight: 500; color: var(--lt-text-primary); display: block; margin-bottom: 2px; }
.m-act-meta { display: flex; gap: 8px; font-size: 11px; color: var(--lt-text-auxiliary); }
.m-act-score.good { color: var(--lt-success); }
.m-act-btn { padding: 6px 14px; border: none; border-radius: 8px; background: var(--lt-brand); color: #fff; font-size: 12px; cursor: pointer; flex-shrink: 0; }
.m-act-btn.retry { background: var(--lt-orange); }

.m-module-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid var(--lt-border); }
.m-footer-progress { font-size: 11px; color: var(--lt-text-auxiliary); }
.m-replan-btn { font-size: 11px; color: var(--lt-brand); background: none; border: none; cursor: pointer; }

/* Done */
.m-path-done { text-align: center; padding: 40px 16px; }
.m-done-title { font-size: 18px; font-weight: 600; color: var(--lt-text-primary); margin: 0 0 4px; }
.m-done-sub { font-size: 13px; color: var(--lt-text-auxiliary); margin: 0 0 16px; }
.m-done-btn { padding: 10px 24px; border: none; border-radius: 10px; background: var(--lt-brand); color: #fff; font-size: 14px; cursor: pointer; }

/* Adjustments */
.m-adj-title { font-size: 13px; font-weight: 600; color: var(--lt-text-primary); margin: 12px 0 8px; }
.m-adj-item { padding: 10px 12px; background: rgba(255,159,10,0.06); border-radius: 8px; margin-bottom: 6px; }
.m-adj-reason { font-size: 12px; color: var(--lt-warning); margin: 0 0 4px; }
.m-adj-time { font-size: 10px; color: var(--lt-text-auxiliary); margin: 0; }
.m-adj-empty { text-align: center; font-size: 13px; color: var(--lt-text-auxiliary); padding: 24px 0; }
</style>
