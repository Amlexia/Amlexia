/** USD per 1M tokens (input / output). Public reference pricing for estimation. */
export interface ModelPrice {
  inputPer1M: number;
  outputPer1M: number;
}

export const MODEL_PRICES: Record<string, ModelPrice> = {
  'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'gpt-4.1': { inputPer1M: 2, outputPer1M: 8 },
  'gpt-4.1-mini': { inputPer1M: 0.4, outputPer1M: 1.6 },
  'gpt-4.1-nano': { inputPer1M: 0.1, outputPer1M: 0.4 },
  'o1': { inputPer1M: 15, outputPer1M: 60 },
  'o1-mini': { inputPer1M: 1.1, outputPer1M: 4.4 },
  'o3-mini': { inputPer1M: 1.1, outputPer1M: 4.4 },
  'claude-3-5-sonnet': { inputPer1M: 3, outputPer1M: 15 },
  'claude-3-5-haiku': { inputPer1M: 0.8, outputPer1M: 4 },
  'claude-sonnet-4': { inputPer1M: 3, outputPer1M: 15 },
  'claude-opus-4': { inputPer1M: 15, outputPer1M: 75 },
  'gemini-2.0-flash': { inputPer1M: 0.1, outputPer1M: 0.4 },
  'gemini-2.5-pro': { inputPer1M: 1.25, outputPer1M: 10 },
  'llama-3.3-70b': { inputPer1M: 0.59, outputPer1M: 0.79 },
  'mixtral-8x7b': { inputPer1M: 0.24, outputPer1M: 0.24 },
  'deepseek-chat': { inputPer1M: 0.14, outputPer1M: 0.28 },
};

export const PROVIDER_DEFAULT_MODEL: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku',
  google: 'gemini-2.0-flash',
  groq: 'llama-3.3-70b',
  deepseek: 'deepseek-chat',
};

export function normalizeModelKey(model?: string | null): string | null {
  if (!model) return null;
  return model.toLowerCase().replace(/^models\//, '').replace(/@.*$/, '');
}

export function resolveModelPrice(model?: string | null, provider?: string | null): ModelPrice | null {
  const key = normalizeModelKey(model);
  if (key) {
    if (MODEL_PRICES[key]) return MODEL_PRICES[key];
    const partial = Object.keys(MODEL_PRICES).find((k) => key.includes(k) || k.includes(key));
    if (partial) return MODEL_PRICES[partial];
  }
  const prov = provider?.toLowerCase();
  if (prov && PROVIDER_DEFAULT_MODEL[prov]) {
    return MODEL_PRICES[PROVIDER_DEFAULT_MODEL[prov]] ?? null;
  }
  return null;
}
