import OpenAI from "openai";

// Lazy initialization to avoid instantiation during tests
let _openrouter: OpenAI | null = null;

export function getOpenRouter(): OpenAI {
  if (!_openrouter) {
    _openrouter = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY || "mock-key",
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "https://cardsboard.app",
        "X-Title": process.env.OPENROUTER_APP_NAME || "Cardsboard",
      },
      dangerouslyAllowBrowser: process.env.NODE_ENV === "test",
    });
  }
  return _openrouter;
}

// Keep export for backward compatibility
export const openrouter = new Proxy({} as OpenAI, {
  get(_, prop) {
    return getOpenRouter()[prop as keyof OpenAI];
  },
});

export const AI_MODELS = [
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google" },
  { id: "google/gemini-2.5-flash-image", name: "Gemini 2.5 Flash Image", provider: "Google", imageGeneration: true },
  { id: "google/gemini-2.5-flash-image-preview", name: "Nano Banana (Gemini 2.5)", provider: "Google", imageGeneration: true },
  { id: "google/gemini-3-pro-image-preview", name: "Gemini 3 Pro Image", provider: "Google", imageGeneration: true },
  { id: "bytedance-seed/seedream-4.5", name: "SeedDream 4.5", provider: "ByteDance", imageGeneration: true },
  { id: "moonshotai/kimi-k2", name: "Kimi K2", provider: "Moonshot" },
  { id: "anthropic/claude-sonnet-4-2025-04-16", name: "Claude Sonnet 4", provider: "Anthropic" },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI" },
  { id: "deepseek/deepseek-chat", name: "DeepSeek Chat", provider: "DeepSeek" },
] as const;

export type AIModel = typeof AI_MODELS[number]["id"];

export type AIModelWithInfo = typeof AI_MODELS[number];
