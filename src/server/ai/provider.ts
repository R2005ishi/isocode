import Anthropic from "@anthropic-ai/sdk";

/**
 * LLM provider abstraction. Everything in src/server/ai talks to an AiProvider, never to the SDK
 * directly, so tests can swap in deterministic fakes and the app keeps working without a key.
 */
export interface AiProvider {
  name: string;
  /** Model id recorded in AiOutput.model. */
  model?: string;
  complete(req: {
    system: string;
    prompt: string;
    maxTokens?: number;
    timeoutMs?: number;
  }): Promise<string>;
}

export const DEFAULT_TIMEOUT_MS = 8000;
export const DEFAULT_MODEL = "claude-sonnet-5-5";

/** The provider did not answer within the time budget. Callers fall back to a template. */
export class AiTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`AI provider timed out after ${timeoutMs} ms`);
    this.name = "AiTimeoutError";
  }
}

/** No ANTHROPIC_API_KEY configured. Callers fall back to a template — never fake AI text. */
export class AiNoKeyError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set");
    this.name = "AiNoKeyError";
  }
}

/** Any other provider failure (HTTP error, refusal, empty response). */
export class AiProviderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiProviderError";
  }
}

export class AnthropicProvider implements AiProvider {
  name = "anthropic";
  model: string;
  private client: Anthropic;

  constructor(opts: { apiKey: string; model?: string }) {
    this.model = opts.model || DEFAULT_MODEL;
    // One SDK retry for transient 429/5xx; the AbortController below caps total wall time anyway.
    this.client = new Anthropic({ apiKey: opts.apiKey, maxRetries: 1 });
  }

  async complete(req: {
    system: string;
    prompt: string;
    maxTokens?: number;
    timeoutMs?: number;
  }): Promise<string> {
    const timeoutMs = req.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.client.messages.create(
        {
          model: this.model,
          // Headroom for adaptive thinking tokens plus a short answer.
          max_tokens: req.maxTokens ?? 2048,
          system: req.system,
          messages: [{ role: "user", content: req.prompt }],
          // Short, well-specified tasks: low effort keeps latency inside the 8 s budget.
          output_config: { effort: "low" },
        },
        { signal: controller.signal, timeout: timeoutMs },
      );
      if (response.stop_reason === "refusal") {
        throw new AiProviderError("Model declined the request (refusal)");
      }
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      return text;
    } catch (err) {
      if (err instanceof AiProviderError) throw err;
      if (controller.signal.aborted || err instanceof Anthropic.APIConnectionTimeoutError) {
        throw new AiTimeoutError(timeoutMs);
      }
      throw new AiProviderError(err instanceof Error ? err.message : "Unknown provider error", {
        cause: err,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Deterministic provider.
 * - `new MockProvider()` (what the app uses when no key is set) throws AiNoKeyError, so callers
 *   return status FALLBACK / reason "no_api_key" with a template — we never present canned text as AI.
 * - `new MockProvider(respond)` returns whatever `respond` returns; used in tests.
 */
export class MockProvider implements AiProvider {
  name = "mock";
  model = "mock";
  calls: { system: string; prompt: string }[] = [];

  constructor(
    private respond?: (req: {
      system: string;
      prompt: string;
      call: number;
    }) => string | Promise<string>,
  ) {}

  async complete(req: { system: string; prompt: string; maxTokens?: number; timeoutMs?: number }) {
    this.calls.push({ system: req.system, prompt: req.prompt });
    if (!this.respond) throw new AiNoKeyError();
    return this.respond({ system: req.system, prompt: req.prompt, call: this.calls.length });
  }
}

let override: AiProvider | null = null;
let cached: AiProvider | null = null;

export function getProvider(): AiProvider {
  if (override) return override;
  if (!cached) {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    cached = apiKey
      ? new AnthropicProvider({ apiKey, model: process.env.AI_MODEL?.trim() || DEFAULT_MODEL })
      : new MockProvider();
  }
  return cached;
}

/** Pass null to restore the environment-based provider. */
export function setProviderForTests(p: AiProvider | null): void {
  override = p;
  cached = null;
}
