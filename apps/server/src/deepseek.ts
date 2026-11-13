import OpenAI from 'openai';

export const DEEPSEEK_MODEL = 'deepseek-flash';

export function createDeepSeekClient(): OpenAI {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();

  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not configured.');

  return new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey,
    timeout: 30000,
    maxRetries: 0,
  });
}
