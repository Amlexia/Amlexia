export type ProviderCategory =
  | 'ai'
  | 'payments'
  | 'messaging'
  | 'auth'
  | 'infrastructure'
  | 'internal'
  | 'unknown';

export interface ProviderDefinition {
  name: string;
  category: ProviderCategory;
  hostPatterns: RegExp[];
  headerHints?: string[];
}

export const PROVIDER_REGISTRY: ProviderDefinition[] = [
  { name: 'openai', category: 'ai', hostPatterns: [/api\.openai\.com/i, /openai\.azure\.com/i] },
  { name: 'anthropic', category: 'ai', hostPatterns: [/api\.anthropic\.com/i] },
  { name: 'gemini', category: 'ai', hostPatterns: [/generativelanguage\.googleapis\.com/i] },
  { name: 'groq', category: 'ai', hostPatterns: [/api\.groq\.com/i] },
  { name: 'togetherai', category: 'ai', hostPatterns: [/api\.together\.xyz/i] },
  { name: 'replicate', category: 'ai', hostPatterns: [/api\.replicate\.com/i] },
  { name: 'stripe', category: 'payments', hostPatterns: [/api\.stripe\.com/i] },
  { name: 'razorpay', category: 'payments', hostPatterns: [/api\.razorpay\.com/i] },
  { name: 'paypal', category: 'payments', hostPatterns: [/api\.paypal\.com/i, /api-m\.paypal\.com/i] },
  { name: 'twilio', category: 'messaging', hostPatterns: [/api\.twilio\.com/i] },
  { name: 'resend', category: 'messaging', hostPatterns: [/api\.resend\.com/i] },
  { name: 'sendgrid', category: 'messaging', hostPatterns: [/api\.sendgrid\.com/i] },
  { name: 'clerk', category: 'auth', hostPatterns: [/api\.clerk\.com/i, /\.clerk\.accounts\.dev/i] },
  { name: 'supabase', category: 'infrastructure', hostPatterns: [/\.supabase\.co/i] },
  { name: 'firebase', category: 'infrastructure', hostPatterns: [/firebaseio\.com/i, /googleapis\.com\/.*firebase/i] },
  { name: 'aws', category: 'infrastructure', hostPatterns: [/\.amazonaws\.com/i] },
];

export interface DetectedProvider {
  name: string;
  category: ProviderCategory;
  modelName?: string;
}

export function detectProviderFromUrl(url: string): DetectedProvider | null {
  try {
    const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    return detectProviderFromHost(host);
  } catch {
    return detectProviderFromHost(url);
  }
}

export function detectProviderFromHost(host: string): DetectedProvider | null {
  for (const def of PROVIDER_REGISTRY) {
    if (def.hostPatterns.some((p) => p.test(host))) {
      return { name: def.name, category: def.category };
    }
  }
  return null;
}

export function detectProviderFromHints(input: {
  provider?: string | null;
  endpoint?: string;
  host?: string;
  metadata?: Record<string, unknown>;
}): DetectedProvider {
  if (input.provider) {
    const normalized = input.provider.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = PROVIDER_REGISTRY.find(
      (p) => p.name === normalized || normalized.includes(p.name),
    );
    if (match) {
      return {
        name: match.name,
        category: match.category,
        modelName: extractModelName(input.metadata),
      };
    }
    return { name: normalized, category: 'unknown', modelName: extractModelName(input.metadata) };
  }

  if (input.host) {
    const fromHost = detectProviderFromHost(input.host);
    if (fromHost) return { ...fromHost, modelName: extractModelName(input.metadata) };
  }

  if (input.endpoint) {
    const ep = input.endpoint.toLowerCase();
    for (const def of PROVIDER_REGISTRY) {
      if (ep.includes(def.name)) {
        return { name: def.name, category: def.category, modelName: extractModelName(input.metadata) };
      }
    }
  }

  if (input.endpoint?.startsWith('INTERNAL') || input.endpoint?.includes('internal')) {
    return { name: 'internal', category: 'internal' };
  }

  return { name: 'unknown', category: 'unknown', modelName: extractModelName(input.metadata) };
}

function extractModelName(metadata?: Record<string, unknown>): string | undefined {
  if (!metadata) return undefined;
  const keys = ['model', 'model_name', 'modelName', 'model_id'];
  for (const k of keys) {
    const v = metadata[k];
    if (typeof v === 'string') return v;
  }
  return undefined;
}
