import express, { type ErrorRequestHandler } from 'express';
import z from 'zod';
import OpenAI from 'openai';
import { createDeepSeekClient, DEEPSEEK_MODEL } from './deepseek.js';

const app = express();

const PORT = 3000;

const chatRequestSchema = z.strictObject({
  prompt: z.string().trim().min(1).max(4000),
});

/** 将缺失或无效的 Token 计数归一为 null，避免误报为零。 */
function normalizeTokenCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

app.use(express.json({ limit: '16kb' }));

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'ai-runtime-server',
  });
});

app.post('/api/chat', async (req, res) => {
  const result = chatRequestSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'A non-empty prompt of at most 4000 characters is required.',
      },
    });

    return;
  }

  try {
    const client = createDeepSeekClient();

    const completion = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: 'user',
          content: result.data.prompt,
        },
      ],
      stream: false,
    });

    const choice = completion.choices?.[0];

    if (!choice) {
      res.status(502).json({
        error: {
          code: 'INVALID_MODEL_RESPONSE',
          message: 'The model service returned an invalid response.',
        },
      });
      return;
    }

    // 当前只接受正常结束的文本回复，避免将截断或工具调用结果视为完整答案。
    if (choice.finish_reason !== 'stop') {
      const truncated = choice.finish_reason === 'length';

      res.status(502).json({
        error: {
          code: truncated ? 'MODEL_RESPONSE_TRUNCATED' : 'MODEL_RESPONSE_INCOMPLETE',
          message: truncated
            ? 'The model response exceeded its output limit.'
            : 'The model did not return a complete text response.',
        },
      });

      return;
    }

    const reply = choice.message?.content;

    // 仅用 trim 判空，返回时保留原文，避免改变 Markdown 和代码块格式。
    if (typeof reply !== 'string' || reply.trim().length === 0) {
      res.status(502).json({
        error: {
          code: 'EMPTY_MODEL_RESPONSE',
          message: 'The model did not return a valid text response.',
        },
      });
      return;
    }

    res.status(200).json({
      reply,
      model: completion.model,
      usage: {
        promptTokens: normalizeTokenCount(completion.usage?.prompt_tokens),
        completionTokens: normalizeTokenCount(completion.usage?.completion_tokens),
        totalTokens: normalizeTokenCount(completion.usage?.total_tokens),
      },
    });
  } catch (error: unknown) {
    // 仅记录错误分类和状态码，避免日志包含密钥、Prompt 或上游响应正文。
    console.error('DeepSeek chat request failed:', {
      type: error instanceof Error ? error.name : 'UnknownError',
      status: error instanceof OpenAI.APIError ? error.status : undefined,
    });

    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'The chat request could not be completed.';

    // 超时错误继承自连接错误，必须先匹配更具体的类型。
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      status = 504;
      code = 'UPSTREAM_TIMEOUT';
      message = 'The model request timed out.';
    } else if (error instanceof OpenAI.APIConnectionError) {
      status = 502;
      code = 'UPSTREAM_CONNECTION_ERROR';
      message = 'The model service could not be reached.';
    } else if (error instanceof OpenAI.APIError) {
      const rateLimited = error.status === 429;

      // 上游认证等错误不代表调用方认证失败，统一映射为网关错误。
      status = rateLimited ? 429 : 502;
      code = rateLimited ? 'UPSTREAM_RATE_LIMITED' : 'UPSTREAM_ERROR';
      message = rateLimited
        ? 'The model service is busy. Please try again later.'
        : 'The model service could not complete the request.';
    }

    res.status(status).json({
      error: {
        code,
        message,
      },
    });

    return;
  }
});

const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  // 响应头已发送时交给后续错误处理器，避免再次写入响应。
  if (res.headersSent) {
    next(error);
    return;
  }

  // JSON 解析错误发生在路由之前，按解析器错误类型转换为统一响应。
  const type =
    typeof error === 'object' && error !== null && 'type' in error ? error.type : undefined;

  if (type === 'entity.parse.failed') {
    res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'The request body must contain valid JSON.',
      },
    });
    return;
  }

  if (type === 'entity.too.large') {
    res.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'The request body exceeds the 16 KB limit.',
      },
    });
    return;
  }

  if (type === 'encoding.unsupported' || type === 'charset.unsupported') {
    res.status(415).json({
      error: {
        code: 'UNSUPPORTED_ENCODING',
        message: 'The request body uses an unsupported encoding or charset.',
      },
    });
    return;
  }

  console.error('Unhandled request error:', {
    type: error instanceof Error ? error.name : 'UnknownError',
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred.',
    },
  });
};

// 错误中间件必须在 JSON 解析器和所有路由之后注册。
app.use(errorHandler);

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
