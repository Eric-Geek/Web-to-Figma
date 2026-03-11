import type { IntermediateDocument, AutoLayoutData } from '@web-to-figma/shared';
import type { AIProvider, AIAdapterConfig } from '@web-to-figma/shared';
import { createAdapter } from './adapters/factory';
import { preprocess } from './preprocessor';
import { mergeAutoLayout, mergeSemanticNames } from './postprocess';
import { AUTO_LAYOUT_SYSTEM_PROMPT, SEMANTIC_NAMING_SYSTEM_PROMPT } from './prompts/index';

export interface PipelineOptions {
  /** Run AI-powered Auto Layout inference. Default: true */
  runAutoLayout?: boolean;
  /** Run AI-powered semantic layer naming. Default: true */
  runSemanticNaming?: boolean;
  /** Max characters for the context sent to LLM. Default: 200000 */
  maxContextChars?: number;
}

export interface PipelineResult {
  autoLayoutApplied: boolean;
  semanticNamingApplied: boolean;
  errors: string[];
}

function extractJSON(text: string): string {
  if (!text?.trim()) throw new Error('Empty AI response');
  let s = text.trim();

  const fenceMatch = s.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) s = fenceMatch[1].trim();

  const startObj = s.indexOf('{');
  const startArr = s.indexOf('[');
  let start = -1;
  let end = -1;

  if (startObj >= 0 && (startArr < 0 || startObj < startArr)) {
    start = startObj;
    end = s.lastIndexOf('}');
  } else if (startArr >= 0) {
    start = startArr;
    end = s.lastIndexOf(']');
  }

  if (start >= 0 && end > start) {
    return s.slice(start, end + 1);
  }
  return s;
}

export async function runAIPipeline(
  doc: IntermediateDocument,
  provider: AIProvider,
  config: AIAdapterConfig,
  options: PipelineOptions = {},
): Promise<PipelineResult> {
  const result: PipelineResult = {
    autoLayoutApplied: false,
    semanticNamingApplied: false,
    errors: [],
  };

  const adapter = createAdapter(provider, config);
  const slimTree = preprocess(doc.tree);
  const fullContext = JSON.stringify(slimTree);

  const maxChars = options.maxContextChars ?? 200000;
  const userContext = fullContext.length > maxChars
    ? fullContext.slice(0, maxChars) + '...(truncated)'
    : fullContext;

  if (options.runAutoLayout !== false) {
    try {
      const response = await adapter.chat(
        AUTO_LAYOUT_SYSTEM_PROMPT,
        `Analyze this DOM tree and return Auto Layout settings for each container node:\n${userContext}`,
        { jsonMode: true },
      );
      const text = typeof response === 'string' ? response : '';
      const json = extractJSON(text);
      const parsed = JSON.parse(json) as Record<string, Partial<AutoLayoutData>>;
      mergeAutoLayout(doc.tree, parsed);
      result.autoLayoutApplied = true;
    } catch (err) {
      result.errors.push(`Auto Layout AI failed: ${(err as Error).message}`);
    }
  }

  if (options.runSemanticNaming !== false) {
    try {
      const response = await adapter.chat(
        SEMANTIC_NAMING_SYSTEM_PROMPT,
        `Generate semantic Figma layer names for each node in this DOM tree:\n${userContext}`,
        { jsonMode: true },
      );
      const text = typeof response === 'string' ? response : '';
      const json = extractJSON(text);
      const parsed = JSON.parse(json) as Record<string, string>;
      mergeSemanticNames(doc.tree, parsed);
      result.semanticNamingApplied = true;
    } catch (err) {
      result.errors.push(`Semantic naming AI failed: ${(err as Error).message}`);
    }
  }

  return result;
}
