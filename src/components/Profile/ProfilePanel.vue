<script setup lang="ts">
import { ref, computed } from 'vue'
import * as echarts from 'echarts/core'
import { RadarChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'

echarts.use([RadarChart, CanvasRenderer])

const radarOption = computed(() => ({
  radar: {
    indicator: [
      { name: '代码能力', max: 100 },
      { name: '架构设计', max: 100 },
      { name: '算法基础', max: 100 },
      { name: '产品思维', max: 100 },
      { name: '工程规范', max: 100 },
      { name: '测试素养', max: 100 }
    ],
    radius: '65%',
    center: ['50%', '50%'],
    axisName: {
      color: '#64748b',
      fontSize: 12
    },
    splitArea: {
      areaStyle: {
        color: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1']
      }
    }
  },
  series: [
    {
      name: '当前画像',
      type: 'radar',
      data: [
        {
          value: [70, 45, 60, 85, 30, 50],
          name: '掌握度',
          itemStyle: { color: '#3b82f6' },
          areaStyle: { color: 'rgba(59, 130, 246, 0.2)' }
        }
      ]
    }
  ]
}))
</script>

<template>
  <div class="h-full flex flex-col bg-white border-l border-gray-200">
    <div class="p-4 border-b border-gray-200">
      <h2 class="text-lg font-medium text-gray-800">学习画像概览</h2>
      <p class="text-xs text-gray-500 mt-1">最后更新: 刚刚</p>
    </div>
    
    <div class="flex-1 overflow-y-auto p-4 space-y-6">
      <!-- 维度雷达图 -->
      <div>
        <h3 class="text-sm font-semibold text-gray-700 mb-2">能力雷达图</h3>
        <div class="h-64 w-full bg-slate-50 rounded-lg p-2">
          <v-chart class="w-full h-full" :option="radarOption" autoresize />
        </div>
      </div>

      <!-- 薄弱点与掌握点标签 -->
      <div>
        <h3 class="text-sm font-semibold text-gray-700 mb-2">现状分析</h3>
        <div class="space-y-3">
          <div>
            <span class="text-xs text-gray-500 block mb-1">主要薄弱项</span>
            <div class="flex flex-wrap gap-2">
              <el-tag type="danger" effect="plain" class="rounded">工程规范</el-tag>
              <el-tag type="danger" effect="plain" class="rounded">架构设计</el-tag>
            </div>
          </div>
          <div>
            <span class="text-xs text-gray-500 block mb-1">突出优势</span>
            <div class="flex flex-wrap gap-2">
              <el-tag type="success" effect="plain" class="rounded">产品思维</el-tag>
            </div>
          </div>
        </div>
      </div>

      <!-- 偏好与节奏 -->
      <div>
        <h3 class="text-sm font-semibold text-gray-700 mb-2">学习偏好</h3>
        <div class="space-y-2 text-sm text-gray-600 bg-slate-50 p-3 rounded-lg">
          <div class="flex justify-between">
            <span>推荐节奏</span>
            <span class="font-medium text-gray-800">15分钟/天 (速览为主)</span>
          </div>
          <div class="flex justify-between">
            <span>实操要求</span>
            <span class="font-medium text-gray-800">高 (代码案例优先)</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
