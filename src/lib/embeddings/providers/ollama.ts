import { OllamaEmbeddings } from "@langchain/ollama";
import { config } from "../../config.js";

/** Match production schema so dev and prod use same vector dimensions. */
export const OLLAMA_EMBEDDING_DIM = 1536;

/**
 * Creates Ollama embeddings for development.
 * Uses OLLAMA_BASE_URL and OLLAMA_EMBEDDING_MODEL from config.
 */
export function createEmbeddings(): OllamaEmbeddings {
  const baseUrl = config.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model = config.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text";
  return new OllamaEmbeddings({
    baseUrl,
    model,
    dimensions: OLLAMA_EMBEDDING_DIM,
  });
}
