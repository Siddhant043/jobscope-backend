import { ChatOllama } from "@langchain/ollama";
import { config } from "../config.js";

/**
 * Creates the Ollama chat model for development.
 * Uses OLLAMA_BASE_URL and OLLAMA_MODEL from config (set in dev defaults).
 */
export function createChatModel(): ChatOllama {
  const baseUrl = config.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model = config.OLLAMA_MODEL ?? "gpt-oss";
  return new ChatOllama({
    baseUrl,
    model,
    temperature: 0,
  });
}
