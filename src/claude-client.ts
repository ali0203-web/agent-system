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
