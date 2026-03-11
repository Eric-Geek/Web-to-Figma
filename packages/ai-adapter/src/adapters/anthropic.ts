import type { AIAdapter, AIAdapterConfig } from '@web-to-figma/shared';

/**
 * Adapter for Anthropic Claude API (Messages API format).
 */
export class AnthropicAdapter implements AIAdapter {
  readonly name = 'anthropic';
  private config: AIAdapterConfig | null = null;

  configure(config: AIAdapterConfig): void {
    this.config = config;
  }

  async chat(
    systemPrompt: string,
    userMessage: string,
    _options?: { jsonMode?: boolean; stream?: boolean },
  ): Promise<string> {
    if (!this.config) throw new Error('Adapter not configured. Call configure() first.');

    const url = `${this.config.baseUrl.replace(/\/$/, '')}/v1/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens ?? 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const block = data.content?.find(
      (b: { type: string }) => b.type === 'text',
    );
    return block?.text ?? '';
  }
}
