<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'

const prompt = ref('')
const submittedPrompt = ref('')

const canSend = computed(() => prompt.value.trim().length > 0)

function handleSend() {
  if (!canSend.value) return

  submittedPrompt.value = prompt.value.trim()

  ElMessage.success('Prompt submitted locally')
}
</script>

<template>
  <main class="playground">
    <el-card shadow="never">
      <template #header>
        <div class="header">
          <h1>AI Streaming Runtime</h1>
          <el-tag type="info">Playground</el-tag>
        </div>
      </template>

      <el-form label-position="top">
        <el-form-item label="Prompt">
          <el-input v-model="prompt" type="textarea" :rows="5" placeholder="Enter your prompt..." />
        </el-form-item>

        <el-button type="primary" :disabled="!canSend" @click="handleSend"> Send </el-button>
      </el-form>

      <el-divider v-if="submittedPrompt" />

      <el-alert v-if="submittedPrompt" title="Submitted prompt" type="success" :closable="false">
        <p>{{ submittedPrompt }}</p>
      </el-alert>
    </el-card>
  </main>
</template>

<style scoped>
.playground {
  width: min(100% - 32px, 840px);
  margin: 48px auto;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

h1 {
  margin: 0;
  font-size: 20px;
}
</style>
