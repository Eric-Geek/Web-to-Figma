import type { AIAdapter, AIAdapterConfig } from '@web-to-figma/shared';

/**
 * Adapter for locally-deployed Ollama models.
 * Default base URL: http://localhost:11434
 */
export class OllamaAdapter implements AIAdapter {
  readonly name = 'ollama';
  private config: AIAdapterConfig | null = null;

  configure(config: AIAdapterConfig): void {
    this.config = {
      ...config,
      baseUrl: config.baseUrl || 'http://localhost:11434',
    };
  }

  async chat(
    systemPrompt: string,
    userMessage: string,
    options?: { jsonMode?: boolean; stream?: boolean },
  ): Promise<string> {
    if (!this.config) throw new Error('Adapter not configured. Call configure() first.');

    const url = `${this.config.baseUrl.replace(/\/$/, '')}/api/chat`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        stream: false,
        format: options?.jsonMode ? 'json' : undefined,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    return data.message?.content ?? '';
  }
}
