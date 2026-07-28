/**
 * A minimal Anthropic Messages API tool-use loop over Node 20's global `fetch`.
 *
 * No SDK, no runtime dependency — the whole point of the home-grown harness is
 * that a third party can reproduce it from EVAL.md alone, and that we intercept
 * `write_file` ourselves rather than reading an opaque transcript afterwards.
 *
 * Model: a Sonnet-class model, `temperature: 0` for run-to-run reproducibility
 * (`claude-sonnet-4-5` accepts it; the newer thinking-by-default tiers do not).
 * Non-streaming: the tasks are tiny and turns are short, so the streaming
 * threshold never bites.
 */
const ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export interface AgentConfig {
  apiKey: string;
  model: string;
  system: string;
  /** The initial diagnostic framing — the ONLY thing that differs between arms A and B. */
  initialUser: string;
  tools: readonly unknown[];
  /** Executes one tool call; returns the text result and whether it was an error. */
  executeTool(name: string, input: unknown): { text: string; isError: boolean };
  maxTurns: number;
  maxTokens?: number;
}

export interface AgentRun {
  /** Assistant turns taken (one per model response), capped at `maxTurns`. */
  turns: number;
  /** `end_turn`, `max_turns`, or an error label. */
  stop: string;
  /** Summed input + output tokens across the loop, from `usage`. */
  tokens: number;
}

type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: string; [k: string]: unknown };

interface MessagesResponse {
  content: Block[];
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

async function post(apiKey: string, body: unknown): Promise<MessagesResponse> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (response.ok) return (await response.json()) as MessagesResponse;

    // Retry the retryable statuses a few times with linear backoff, then give up.
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= 4) {
      throw new Error(`Anthropic API ${response.status}: ${await response.text()}`);
    }
    const wait = Number(response.headers.get("retry-after")) * 1000 || (attempt + 1) * 2000;
    await new Promise((r) => setTimeout(r, wait));
  }
}

/** Run the tool-use loop to `end_turn` or the hard turn cap. */
export async function runAgent(config: AgentConfig): Promise<AgentRun> {
  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
    { role: "user", content: config.initialUser },
  ];
  let tokens = 0;

  for (let turn = 1; turn <= config.maxTurns; turn += 1) {
    const response = await post(config.apiKey, {
      model: config.model,
      max_tokens: config.maxTokens ?? 4096,
      temperature: 0,
      system: config.system,
      tools: config.tools,
      messages,
    });
    tokens += response.usage.input_tokens + response.usage.output_tokens;
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      return { turns: turn, stop: response.stop_reason, tokens };
    }

    // Execute every tool_use block and return all results in one user message
    // (splitting them trains the model to stop calling tools in parallel).
    const results = response.content
      .filter((block): block is Extract<Block, { type: "tool_use" }> => block.type === "tool_use")
      .map((block) => {
        const { text, isError } = config.executeTool(block.name, block.input);
        return { type: "tool_result", tool_use_id: block.id, content: text, is_error: isError };
      });
    messages.push({ role: "user", content: results });
  }

  return { turns: config.maxTurns, stop: "max_turns", tokens };
}
