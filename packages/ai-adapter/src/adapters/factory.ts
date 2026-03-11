import type { AIAdapter, AIAdapterConfig, AIProvider } from '@web-to-figma/shared';
import { OpenAICompatibleAdapter } from './openai-compatible';
import { AnthropicAdapter } from './anthropic';
import { OllamaAdapter } from './ollama';

export function createAdapter(provider: AIProvider, config: AIAdapterConfig): AIAdapter {
  let adapter: AIAdapter;

  switch (provider) {
    case 'openai-compatible':
      adapter = new OpenAICompatibleAdapter();
      break;
    case 'anthropic':
      adapter = new AnthropicAdapter();
      break;
    case 'ollama':
      adapter = new OllamaAdapter();
      break;
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }

  adapter.configure(config);
  return adapter;
}
