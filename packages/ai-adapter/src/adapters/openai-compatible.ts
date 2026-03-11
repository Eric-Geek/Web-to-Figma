import type { AIAdapter, AIAdapterConfig } from '@web-to-figma/shared';

/**
 * Adapter for OpenAI-compatible APIs (OpenAI, DeepSeek, Groq, Together AI, etc.)
 * Uses the standard /v1/chat/completions endpoint.
 */
export class OpenAICompatibleAdapter implements AIAdapter {
  readonly name = 'openai-compatible';
  private config: AIAdapterConfig | null = null;

  configure(config: AIAdapterConfig): void {
    this.config = config;
  }

  async chat(
    systemPrompt: string,
    userMessage: string,
    options?: { jsonMode?: boolean; stream?: boolean },
  ): Promise<string> {
    if (!this.config) throw new Error('Adapter not configured. Call configure() first.');

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: this.config.maxTokens ?? 4096,
      temperature: this.config.temperature ?? 0.2,
    };

    if (options?.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const url = `${this.config.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }
}
