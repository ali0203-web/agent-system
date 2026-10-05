import Anthropic from "@anthropic-ai/sdk";

// Reads ANTHROPIC_API_KEY from the environment
export const client = new Anthropic();

export const DEFAULT_MODEL = "claude-opus-5-5";

export interface AskClaudeOptions {
  system?: string;
  model?: string;
  maxTokens?: number;
}

/**
 * Sends a single user prompt to POST /v1/messages and returns the text reply
 * along with token usage.
 */
export async function askClaude(
  prompt: string,
  options: AskClaudeOptions = {},
): Promise<{ text: string; usage: Anthropic.Usage }> {
  const response = await client.messages.create({
    model: options.model ?? DEFAULT_MODEL,
    max_tokens: options.maxTokens ?? 16000,
    system: options.system ?? "You are a helpful assistant.",
    messages: [{ role: "user", content: prompt }],
  });

  // response.content is a union of block types, so narrow before reading .text
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return { text, usage: response.usage };
}

/**
 * Sends a prompt and gets back JSON that is constrained to `schema`
 * (structured outputs), parsed into T. Callers should still validate the
 * parsed value before trusting it.
 */
export async function askClaudeJSON<T>(
  prompt: string,
  schema: Record<string, unknown>,
  options: AskClaudeOptions & { effort?: "low" | "medium" | "high" } = {},
): Promise<T> {
  const response = await client.messages.create({
    model: options.model ?? DEFAULT_MODEL,
    max_tokens: options.maxTokens ?? 4096,
    system: options.system,
    output_config: {
      effort: options.effort ?? "low",
      format: { type: "json_schema", schema },
    },
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
    throw new Error(`Claude response not usable (stop_reason: ${response.stop_reason})`);
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return JSON.parse(text) as T;
}

/** True when an API credential is available in the environment. */
export function claudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

async function main() {
  try {
    const { text, usage } = await askClaude("What is the capital of France?");
    console.log(text);
    console.log(usage); // input_tokens / output_tokens
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      console.error("Rate limited, retry later");
    } else if (error instanceof Anthropic.APIError) {
      console.error(`API error ${error.status}:`, error.message);
    } else {
      throw error;
    }
  }
}

// Run the demo only when executed directly (npx tsx src/claude-client.ts)
if (require.main === module) {
  main();
}
