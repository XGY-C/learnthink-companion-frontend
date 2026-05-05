<script setup lang="ts"></script>
<template>
  <div class="h-screen w-screen flex items-center justify-center bg-gray-50">
    <div class="bg-white p-8 rounded-lg shadow-md w-96 text-center">
      <h1 class="text-2xl font-bold text-blue-600 mb-2">LearnThink</h1>
      <p class="text-gray-500 text-sm mb-6">画像驱动的多智能体学习助手</p>
      
      <el-form class="text-left space-y-4">
        <el-form-item>
          <el-input placeholder="用户名" size="large" />
        </el-form-item>
        <el-form-item>
          <el-input type="password" placeholder="密码" size="large" show-password />
        </el-form-item>
        <div class="pt-2">
          <el-button type="primary" size="large" class="w-full" @click="$router.push('/')">登 录</el-button>
        </div>
      </el-form>
      <div class="mt-4 text-xs text-gray-400 cursor-pointer">仅供演示，点击登录即可进入</div>
    </div>
  </div>
</template>
