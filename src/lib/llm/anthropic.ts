import { ChatAnthropic } from "@langchain/anthropic";
import { config } from "../config.js";

/**
 * Creates the Anthropic chat model for production.
 */
export function createChatModel(): ChatAnthropic {
  return new ChatAnthropic({
    modelName: "claude-3-5-haiku-20241022",
    anthropicApiKey: config.ANTHROPIC_API_KEY,
    temperature: 0,
  });
}
