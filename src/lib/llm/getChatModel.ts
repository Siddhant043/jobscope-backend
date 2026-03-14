import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

let cached: Promise<BaseChatModel> | null = null;

/**
 * Returns the chat model for the current environment.
 * In development: Ollama (local, no API key).
 * In production: Anthropic.
 * Uses dynamic import so only the chosen provider is loaded at runtime.
 */
export async function getChatModel(): Promise<BaseChatModel> {
  if (cached !== null) {
    return cached;
  }
  if (process.env.NODE_ENV === "production") {
    const { createChatModel } = await import("./anthropic.js");
    cached = Promise.resolve(createChatModel());
  } else {
    const { createChatModel } = await import("./ollama.js");
    cached = Promise.resolve(createChatModel());
  }
  return cached;
}
