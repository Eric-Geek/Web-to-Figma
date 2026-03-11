/**
 * Shared types used across modules.
 */

export interface AIAdapterConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIAdapter {
  readonly name: string;

  configure(config: AIAdapterConfig): void;

  chat(
    systemPrompt: string,
    userMessage: string,
    options?: { jsonMode?: boolean; stream?: boolean },
  ): Promise<string | AsyncIterable<string>>;
}

export type AIProvider = 'openai-compatible' | 'anthropic' | 'ollama';

export interface PluginSettings {
  aiEnabled: boolean;
  aiProvider: AIProvider | null;
  aiConfig: AIAdapterConfig | null;
  maxNodes: number;
  maxTokenBudget: number;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  aiEnabled: false,
  aiProvider: null,
  aiConfig: null,
  maxNodes: 2000,
  maxTokenBudget: 50000,
};
