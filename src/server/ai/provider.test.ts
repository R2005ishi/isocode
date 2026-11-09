import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  class APIConnectionTimeoutError extends Error {}
  class Anthropic {
    static APIConnectionTimeoutError = APIConnectionTimeoutError;
    messages = { create: (...a: unknown[]) => create(...a) };
  }
  return { default: Anthropic };
});

import {
  AiNoKeyError,
  AiProviderError,
  AiTimeoutError,
  AnthropicProvider,
  MockProvider,
  getProvider,
  setProviderForTests,
} from "./provider";

afterEach(() => {
  create.mockReset();
  vi.unstubAllEnvs();
  setProviderForTests(null);
});

describe("AnthropicProvider", () => {
  it("sends system + prompt to the configured model and returns the text", async () => {
    create.mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: " hello " }],
    });
    const p = new AnthropicProvider({ apiKey: "test", model: "claude-sonnet-5-5" });
    await expect(p.complete({ system: "S", prompt: "P" })).resolves.toBe("hello");
    const [params, opts] = create.mock.calls[0];
    expect(params).toMatchObject({
      model: "claude-sonnet-5-5",
      system: "S",
      messages: [{ role: "user", content: "P" }],
    });
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it("aborts after the timeout and throws AiTimeoutError", async () => {
    create.mockImplementation(
      (_p: unknown, opts: { signal: AbortSignal }) =>
        new Promise((_, reject) =>
          opts.signal.addEventListener("abort", () => reject(new Error("aborted"))),
        ),
    );
    const p = new AnthropicProvider({ apiKey: "test" });
    await expect(p.complete({ system: "S", prompt: "P", timeoutMs: 20 })).rejects.toBeInstanceOf(
      AiTimeoutError,
    );
  });

  it("maps refusals and HTTP errors to AiProviderError", async () => {
    const p = new AnthropicProvider({ apiKey: "test" });
    create.mockResolvedValueOnce({ stop_reason: "refusal", content: [] });
    await expect(p.complete({ system: "S", prompt: "P" })).rejects.toBeInstanceOf(AiProviderError);
    create.mockRejectedValueOnce(new Error("529 overloaded"));
    await expect(p.complete({ system: "S", prompt: "P" })).rejects.toBeInstanceOf(AiProviderError);
  });
});

describe("getProvider", () => {
  it("uses the no-key mock when ANTHROPIC_API_KEY is empty", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const p = getProvider();
    expect(p.name).toBe("mock");
    await expect(p.complete({ system: "", prompt: "" })).rejects.toBeInstanceOf(AiNoKeyError);
  });

  it("uses Anthropic with AI_MODEL (default claude-sonnet-5-5) when a key is set", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test");
    vi.stubEnv("AI_MODEL", "");
    expect(getProvider()).toMatchObject({ name: "anthropic", model: "claude-sonnet-5-5" });
  });

  it("setProviderForTests overrides", () => {
    const m = new MockProvider(() => "x");
    setProviderForTests(m);
    expect(getProvider()).toBe(m);
  });
});
