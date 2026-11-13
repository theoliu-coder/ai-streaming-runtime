<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { ElMessage } from 'element-plus';

const MAX_PROMPT_LENGTH = 4000;
// 后端 SDK 超时为 30 秒，额外预留代理和响应传输时间。
const REQUEST_TIMEOUT_MS = 40_000;

const prompt = ref('');
const submittedPrompt = ref('');
const reply = ref('');
const errorMessage = ref('');
const isLoading = ref(false);

let activeController: AbortController | null = null;
let isUnmounted = false;

// 与后端保持一致，使用去除首尾空白后的长度校验。
const promptLength = computed(() => prompt.value.trim().length);

const inputError = computed(() =>
  promptLength.value > MAX_PROMPT_LENGTH
    ? `The prompt must not exceed ${MAX_PROMPT_LENGTH} characters.`
    : '',
);

const canSend = computed(
  () => !isLoading.value && promptLength.value > 0 && promptLength.value <= MAX_PROMPT_LENGTH,
);

/** 收窄未知响应值，排除 null 和数组。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 提取后端约定的错误消息，结构不匹配时交由调用方提供兜底文案。 */
function getApiErrorMessage(data: unknown): string | null {
  if (!isRecord(data) || !isRecord(data.error)) return null;

  const message = data.error.message;

  return typeof message === 'string' && message.trim().length > 0 ? message : null;
}

async function handleSend(): Promise<void> {
  // 按钮禁用不能替代入口校验，程序调用也需要防止重复请求。
  if (!canSend.value) return;

  // 保存本次请求的输入快照，避免后续编辑影响提交记录。
  const requestPrompt = prompt.value.trim();
  const controller = new AbortController();
  let timedOut = false;

  activeController = controller;
  submittedPrompt.value = requestPrompt;
  reply.value = '';
  errorMessage.value = '';
  isLoading.value = true;

  // 单独记录超时原因，以区分超时和组件卸载引起的取消。
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: requestPrompt }),
      signal: controller.signal,
    });

    // JSON 数据来自运行时，不能仅通过类型断言假定其结构正确。
    let data: unknown;

    try {
      data = await response.json();
    } catch {
      // 读取响应体时也可能被取消，保留原因供外层分类处理。
      if (controller.signal.aborted) {
        throw new Error('The request was aborted.');
      }

      throw new Error(
        response.ok
          ? 'The server returned an invalid JSON response.'
          : `The request failed (HTTP ${response.status}): invalid JSON response.`,
      );
    }

    // fetch 不会因为 HTTP 4xx 或 5xx 自动抛错。
    if (!response.ok) {
      throw new Error(
        getApiErrorMessage(data) ??
          `The request failed (HTTP ${response.status}). Please try again later.`,
      );
    }

    // 仅校验当前界面使用的字段，不要求未展示的 usage 必须存在。
    if (!isRecord(data) || typeof data.reply !== 'string' || data.reply.trim().length === 0) {
      throw new Error('The server did not return a valid model response.');
    }

    if (isUnmounted) return;

    // trim 仅用于判空，展示时保留原始换行和缩进。
    reply.value = data.reply;
    ElMessage.success('已收到模型回复');
  } catch (error) {
    // 组件卸载引起的取消不再更新界面或提示错误。
    if (isUnmounted) return;

    if (timedOut) {
      errorMessage.value = 'The request timed out. Please try again later.';
    } else if (controller.signal.aborted) {
      errorMessage.value = 'The request was aborted.';
    } else if (error instanceof TypeError) {
      errorMessage.value =
        'The server could not be reached. Check your network connection and server status.';
    } else {
      errorMessage.value =
        error instanceof Error ? error.message : 'The request failed. Please try again later.';
    }
  } finally {
    // 成功、失败和取消均需清理定时器。
    window.clearTimeout(timeoutId);

    if (activeController === controller) {
      activeController = null;
    }

    if (!isUnmounted) {
      isLoading.value = false;
    }
  }
}

onBeforeUnmount(() => {
  isUnmounted = true;
  // 取消浏览器请求和响应体读取，不代表后端的模型调用也会被取消。
  activeController?.abort();
});
</script>

<template>
  <main class="playground" :aria-busy="isLoading">
    <el-card shadow="never">
      <template #header>
        <div class="header">
          <h1>AI Streaming Runtime</h1>
          <el-tag type="info">Playground</el-tag>
        </div>
      </template>

      <el-form label-position="top" @submit.prevent="handleSend">
        <el-form-item label="Prompt" :error="inputError">
          <el-input
            v-model="prompt"
            type="textarea"
            :rows="5"
            :disabled="isLoading"
            aria-describedby="prompt-hint"
            placeholder="请输入你的问题..."
          />
        </el-form-item>

        <p id="prompt-hint" class="hint">
          去除首尾空白后 {{ promptLength }} / {{ MAX_PROMPT_LENGTH }} 个字符。
        </p>

        <el-button native-type="submit" type="primary" :loading="isLoading" :disabled="!canSend">
          {{ isLoading ? '请求中...' : '发送' }}
        </el-button>
      </el-form>

      <!-- 请求结果变化时，通过礼貌播报通知辅助技术。 -->
      <section class="result" aria-label="请求状态与模型回复" aria-live="polite" aria-atomic="true">
        <p v-if="isLoading" class="hint">正在等待模型回复</p>

        <el-alert
          v-if="errorMessage"
          title="Request failed"
          type="error"
          :closable="false"
          show-icon
        >
          <p class="text-content">{{ errorMessage }}</p>
        </el-alert>
        <template v-if="submittedPrompt">
          <el-divider />

          <h2>本次提交</h2>
          <p class="text-content">{{ submittedPrompt }}</p>
        </template>

        <template v-if="reply">
          <el-divider />

          <h2>模型回复</h2>
          <p class="text-content">{{ reply }}</p>
        </template>
      </section>
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
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

h1 {
  margin: 0;
  font-size: 20px;
}

h2 {
  margin: 0 0 12px;
  font-size: 16px;
}

.hint {
  color: #606266;
  font-size: 13px;
  line-height: 1.6;
}

.result {
  margin-top: 16px;
}

.text-content {
  margin: 0;
  /* 保留多行文本格式，并允许长 URL 等连续内容换行。 */
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.7;
}
</style>
