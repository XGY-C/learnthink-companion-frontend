<script setup lang="ts">
</script>

<template>
  <el-config-provider>
    <div class="app-router-wrap">
      <router-view v-slot="{ Component, route }">
        <transition name="page">
          <div class="page-view" :key="route.fullPath">
            <component :is="Component" />
          </div>
        </transition>
      </router-view>
    </div>
  </el-config-provider>
</template>

<style>
#app {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  text-align: left;
  max-width: none !important;
  background-color: var(--lt-bg-page, #f5f7fb);
}

body {
  margin: 0;
  padding: 0;
  background-color: var(--lt-bg-page, #f5f7fb);
}

/* 路由容器：固定视口高度，防止过渡时两个页面上下堆叠 */
.app-router-wrap {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

/* 每个页面固定为全屏 + 绝对定位，让多个页面重叠而非上下排列 */
.page-view {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

/* 页面切换过渡动画 */
.page-enter-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.page-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.99);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.995);
}
</style>
