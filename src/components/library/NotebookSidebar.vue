<template>
  <div class="notebook-sidebar" style="height: 100%; display: flex; flex-direction: column;">
    <div class="px-4 py-3 flex items-center justify-between" style="border-bottom: 1px solid var(--lt-border);">
      <span class="text-sm font-semibold" style="color: var(--lt-text-primary);">笔记本</span>
      <el-button text size="small" :icon="Plus" @click="$emit('create')" style="color: var(--lt-brand);" />
    </div>

    <div class="notebook-grid flex-1 overflow-y-auto">
      <!-- 全部笔记卡片 -->
      <div
        class="nb-card"
        :class="{ 'nb-card--active': !activeNotebookId && !filterItemId }"
        @click="$emit('select', null)"
      >
        <div class="nb-card-cover cover-default">
          <div class="nb-card-decor"></div>
          <span class="nb-default-badge">全部</span>
        </div>
        <div class="nb-card-bar">
          <span class="nb-card-name">全部笔记</span>
        </div>
      </div>

      <!-- 各笔记本（3D 书架卡片） -->
      <div
        v-for="nb in notebooks"
        :key="nb.id"
        class="nb-card"
        :class="{ 'nb-card--active': activeNotebookId === nb.id && !filterItemId }"
        :title="nb.description"
        @click="$emit('select', nb.id)"
      >
        <div class="nb-card-cover" :class="`cover-${nb.cover || 'default'}`">
          <div class="nb-card-decor"></div>
          <span v-if="nb.isDefault" class="nb-default-badge">默认</span>
        </div>
        <div class="nb-card-bar">
          <span class="nb-card-name">{{ nb.name }}</span>
        </div>
      </div>

      <!-- 新建笔记本卡片 -->
      <div class="nb-card nb-card-add" @click="$emit('create')">
        <div class="nb-card-cover nb-card-add-cover">
          <el-icon class="nb-add-icon"><Plus /></el-icon>
        </div>
        <div class="nb-card-bar">
          <span class="nb-card-name">新建笔记本</span>
        </div>
      </div>

      <div v-if="notebooks.length === 0 && !loading" class="notebook-empty">
        <span class="text-xs" style="color: var(--lt-text-placeholder);">暂无笔记本</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import type { Notebook } from '@/types'

defineProps<{
  notebooks: Notebook[]
  activeNotebookId: string | null
  filterItemId?: string | null
  totalCount: number
  loading?: boolean
}>()

defineEmits<{
  (e: 'select', notebookId: string | null): void
  (e: 'create'): void
}>()
</script>

<style scoped>
/* ===== Notebook grid (书架) ===== */
.notebook-grid {
  padding: 12px 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 10px;
  align-content: start;
}
.notebook-empty { grid-column: 1 / -1; text-align: center; padding: 16px; }

.nb-card {
  cursor: pointer;
  border-radius: 3px 8px 8px 3px;
  position: relative;
  border: 1px solid var(--lt-border);
  background: var(--lt-bg-card);
  box-shadow:
    1px 1px 0 #ececec, 2px 2px 0 #e4e4e4, 3px 3px 0 #dcdcdc,
    0 4px 10px rgba(0,0,0,0.08);
  transition: transform 0.4s cubic-bezier(0.25,0.8,0.25,1), box-shadow 0.4s ease;
}
.nb-card:hover {
  transform: translateY(-6px);
  box-shadow:
    1px 1px 0 #ececec, 2px 2px 0 #e4e4e4, 3px 3px 0 #dcdcdc, 4px 4px 0 #d4d4d4,
    0 14px 30px rgba(0,0,0,0.16);
}
.nb-card:active { transform: translateY(-2px); }
.nb-card--active {
  border-color: var(--lt-brand);
  box-shadow:
    1px 1px 0 #ececec, 2px 2px 0 #e4e4e4, 3px 3px 0 #dcdcdc, 4px 4px 0 #d4d4d4,
    0 0 0 2px var(--lt-brand), 0 14px 30px rgba(43,111,255,0.2);
}

/* Cover */
.nb-card-cover {
  aspect-ratio: 4 / 5;
  position: relative;
  overflow: hidden;
  border-radius: 2px 7px 0 0;
  border-left: 4px solid rgba(0,0,0,0.22);
  box-shadow: inset 1px 0 0 rgba(0,0,0,0.12);
}
/* Gloss sweep on hover */
.nb-card-cover::before {
  content: '';
  position: absolute;
  top: 0; left: -120%;
  width: 50%; height: 100%;
  background: linear-gradient(to right, transparent, rgba(255,255,255,0.2), transparent);
  transform: skewX(-20deg);
  transition: left 0.6s cubic-bezier(0.25,0.8,0.25,1);
  z-index: 8; pointer-events: none;
}
.nb-card:hover .nb-card-cover::before { left: 160%; }
/* Permanent gloss overlay */
.nb-card-cover::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(155deg,
    rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 25%,
    transparent 40%, rgba(0,0,0,0.03) 70%, rgba(0,0,0,0.08) 100%);
  pointer-events: none;
  z-index: 7; border-radius: inherit;
}
/* Decor layer */
.nb-card-decor { position: absolute; z-index: 2; pointer-events: none; }
.nb-default-badge {
  position: absolute; top: 6px; right: 6px;
  font-size: 9px; font-weight: 500; line-height: 1;
  padding: 2px 6px;
  background: rgba(255,255,255,0.9);
  color: var(--lt-text-secondary);
  border-radius: 8px; z-index: 9;
  backdrop-filter: blur(4px);
}

/* Bottom bar */
.nb-card-bar { padding: 7px 10px 8px; border-radius: 0 0 7px 2px; }
.nb-card-name {
  font-size: 12px; font-weight: 600;
  color: var(--lt-text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  line-height: 1.5;
}

/* Add card */
.nb-card-add .nb-card-add-cover {
  background: var(--lt-bg-page);
  border: 1.5px dashed var(--lt-border);
  border-left: 4px solid transparent;
  box-shadow: none;
  display: flex; align-items: center; justify-content: center;
}
.nb-card-add .nb-card-add-cover::before,
.nb-card-add .nb-card-add-cover::after { display: none; }
.nb-add-icon { font-size: 26px; color: var(--lt-text-placeholder); }
.nb-card-add:hover .nb-card-add-cover {
  border-color: var(--lt-brand);
  background: var(--lt-brand-lightest);
}
.nb-card-add:hover .nb-add-icon { color: var(--lt-brand); }

/* ===== 8 Cover Designs ===== */

/* default - Minimalist cream + gold line */
.cover-default {
  background: #faf8f5;
  border: 1px solid #e8e4de;
}
.cover-default .nb-card-decor {
  left: 28%; top: 15%; bottom: 15%;
  width: 2px;
  background: linear-gradient(to bottom, transparent, #c9a96e, transparent);
}

/* blue - Starry night */
.cover-blue {
  background: linear-gradient(160deg, #0a0e27 0%, #1a1f4b 40%, #2d1b4e 70%, #0f0f23 100%);
}
.cover-blue .nb-card-decor {
  inset: 0;
  background-image:
    radial-gradient(1.5px 1.5px at 20% 25%, #fff, transparent),
    radial-gradient(1px 1px at 55% 65%, rgba(255,255,255,0.6), transparent),
    radial-gradient(2px 2px at 75% 20%, #fff, transparent),
    radial-gradient(1px 1px at 35% 80%, rgba(255,255,255,0.5), transparent),
    radial-gradient(1.5px 1.5px at 65% 45%, rgba(255,255,255,0.7), transparent),
    radial-gradient(1px 1px at 45% 15%, rgba(255,255,255,0.4), transparent),
    radial-gradient(1px 1px at 15% 55%, rgba(255,255,255,0.5), transparent),
    radial-gradient(1.5px 1.5px at 85% 70%, rgba(255,255,255,0.6), transparent),
    radial-gradient(1px 1px at 25% 40%, rgba(255,255,255,0.3), transparent);
}

/* green - Tropical leaves */
.cover-green {
  background:
    linear-gradient(#c9a96e, #c9a96e) no-repeat 50% 8% / 30px 2px,
    linear-gradient(135deg, #0d3328 0%, #1a5c4a 50%, #0d3328 100%);
}
.cover-green .nb-card-decor {
  top: -15%; right: -20%;
  width: 65%; height: 65%;
  background: rgba(74,222,128,0.15);
  border-radius: 0 100% 0 100%;
  transform: rotate(15deg);
}
.cover-green .nb-card-decor::before {
  content: '';
  position: absolute;
  bottom: -50%; left: -40%;
  width: 110%; height: 110%;
  background: rgba(34,197,94,0.12);
  border-radius: 100% 0 100% 0;
  transform: rotate(-20deg);
}
.cover-green .nb-card-decor::after {
  content: '';
  position: absolute;
  top: 45%; right: 15%;
  width: 35%; height: 35%;
  background: rgba(134,239,172,0.1);
  border-radius: 50% 50% 0 50%;
  transform: rotate(45deg);
}

/* orange - Vintage leather */
.cover-orange {
  background:
    radial-gradient(ellipse at 20% 30%, rgba(0,0,0,0.1), transparent 50%),
    radial-gradient(ellipse at 80% 70%, rgba(0,0,0,0.08), transparent 40%),
    linear-gradient(135deg, #3d2817 0%, #5c3d2e 30%, #4a3020 60%, #3d2817 100%);
}
.cover-orange .nb-card-decor {
  inset: 8%;
  border: 1px dashed rgba(201,169,110,0.4);
  border-radius: 3px;
}
.cover-orange .nb-card-decor::before {
  content: '';
  position: absolute;
  inset: 4%;
  border: 1px solid rgba(201,169,110,0.2);
  border-radius: 2px;
}
.cover-orange .nb-card-decor::after {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%,-50%) rotate(45deg);
  width: 15%; aspect-ratio: 1;
  border: 1.2px solid rgba(201,169,110,0.45);
}

/* purple - Watercolor wash */
.cover-purple {
  background: #faf7f4;
}
.cover-purple .nb-card-decor {
  inset: 0;
  background:
    radial-gradient(ellipse 55% 40% at 35% 40%, rgba(210,160,180,0.5), transparent 70%),
    radial-gradient(ellipse 50% 38% at 60% 55%, rgba(150,170,210,0.45), transparent 70%),
    radial-gradient(ellipse 40% 32% at 45% 70%, rgba(200,175,150,0.4), transparent 70%),
    radial-gradient(ellipse 35% 28% at 55% 25%, rgba(180,155,190,0.35), transparent 70%);
  filter: blur(12px);
}

/* grid - Bauhaus geometric */
.cover-grid {
  background: #e8e0d4;
  background-image:
    linear-gradient(#c9a96e, #c9a96e) no-repeat 58% 22% / 28% 3px,
    linear-gradient(#1a1a1a, #1a1a1a) no-repeat 10% 14% / 20% 20%,
    linear-gradient(#1a1a1a, #1a1a1a) no-repeat 20% 58% / 15% 3px,
    linear-gradient(#1a1a1a, #1a1a1a) no-repeat 20% 70% / 15% 3px,
    linear-gradient(#1a1a1a, #1a1a1a) no-repeat 20% 58% / 3px 15%,
    linear-gradient(#1a1a1a, #1a1a1a) no-repeat 35% 58% / 3px 15%;
}
.cover-grid .nb-card-decor { inset: 0; }
.cover-grid .nb-card-decor::before {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 40%; aspect-ratio: 1;
  border: 2px solid #1a1a1a;
  border-radius: 50%;
}
.cover-grid .nb-card-decor::after {
  content: '';
  position: absolute;
  bottom: 20%; right: 22%;
  width: 12%; height: 30%;
  background: #c9a96e;
}

/* dot - Deep space nebula */
.cover-dot {
  background: radial-gradient(ellipse at 55% 30%, #1a1a3a 0%, #0a0a18 40%, #020210 100%);
}
.cover-dot .nb-card-decor {
  inset: 0;
  background:
    radial-gradient(ellipse 55% 35% at 45% 30%, rgba(80,60,180,0.3), transparent 70%),
    radial-gradient(ellipse 40% 28% at 65% 70%, rgba(180,120,60,0.15), transparent 70%);
  filter: blur(6px);
}
.cover-dot .nb-card-decor::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(1.5px 1.5px at 15% 20%, #fff, transparent),
    radial-gradient(1px 1px at 40% 55%, rgba(255,255,255,0.6), transparent),
    radial-gradient(2px 2px at 70% 30%, #fff, transparent),
    radial-gradient(1px 1px at 55% 75%, rgba(255,255,255,0.5), transparent),
    radial-gradient(1.5px 1.5px at 85% 50%, rgba(255,255,255,0.7), transparent),
    radial-gradient(1px 1px at 25% 80%, rgba(255,255,255,0.4), transparent),
    radial-gradient(1px 1px at 80% 10%, rgba(255,255,255,0.5), transparent),
    radial-gradient(1px 1px at 10% 60%, rgba(255,255,255,0.3), transparent);
}

/* wave - Marble with gold frame */
.cover-wave {
  background:
    linear-gradient(90deg, transparent, rgba(80,70,60,0.1), transparent) no-repeat 10% 28% / 70% 2px,
    linear-gradient(90deg, transparent, rgba(80,70,60,0.06), transparent) no-repeat 30% 52% / 50% 2px,
    linear-gradient(135deg, #f5f0eb 0%, #e8e0d8 50%, #f0ebe5 100%);
}
.cover-wave .nb-card-decor {
  inset: 10%;
  border: 1px solid rgba(80,70,60,0.18);
  border-radius: 1px;
}
.cover-wave .nb-card-decor::before {
  content: '';
  position: absolute;
  top: 20%; left: -20%;
  width: 140%; height: 2px;
  background: linear-gradient(90deg, transparent, rgba(80,70,60,0.12), transparent);
  border-radius: 50%;
  filter: blur(1px);
  transform: rotate(-6deg);
}
.cover-wave .nb-card-decor::after {
  content: '';
  position: absolute;
  top: 55%; right: -10%;
  width: 80%; height: 2px;
  background: rgba(80,70,60,0.08);
  border-radius: 50%;
  filter: blur(1px);
  transform: rotate(4deg);
}
</style>
