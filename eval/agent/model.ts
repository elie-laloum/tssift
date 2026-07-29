/**
 * A minimal OpenAI-compatible Chat Completions tool-use loop over Node 20's
 * global `fetch`.
 *
 * No SDK, no runtime dependency — the whole point of the home-grown harness is
 * that a third party can reproduce it from EVAL.md alone, and that we intercept
 * `write_file` ourselves rather than reading an opaque transcript afterwards.
 *
 * OpenAI-compatible endpoint (`POST <baseUrl>/chat/completions`): the `system`
 * prompt is the first message, tools are `{type:"function", function:{…}}`, and
 * the model answers with `tool_calls` whose `arguments` is a JSON string. Config
 * is env-driven (`OPENAI_BASE_URL`, `OPENAI_API_KEY`, `AGENT_MODEL`), so the same
 * harness drives a hosted API or a local server without a code change.
 *
 * `temperature: 0` for run-to-run reproducibility. Non-streaming: the tasks are
 * tiny and turns are short.
 */
export interface ModelEndpoint {
  /** Base URL up to but not including `/chat/completions`, e.g. `https://api.openai.com/v1`. */
  baseUrl: string;
  /** Bearer token; omitted from the request when empty (local servers often need none). */
  apiKey?: string;
  model: string;
}

/** A tool in this harness's neutral shape (`tools.ts`), before provider conversion. */
export interface NeutralTool {
  name: string;
  description: string;
  input_schema: unknown;
}

export interface AgentConfig {
  endpoint: ModelEndpoint;
  system: string;
  /** The initial diagnostic framing — the ONLY thing that differs between arms A and B. */
  initialUser: string;
  tools: readonly NeutralTool[];
  /** Executes one tool call; returns the text result and whether it was an error. */
  executeTool(name: string, input: unknown): { text: string; isError: boolean };
  maxTurns: number;
  maxTokens?: number;
}

export interface AgentRun {
  /** Assistant turns taken (one per model response), capped at `maxTurns`. */
  turns: number;
  /** The final `finish_reason`, `max_turns`, or an error label. */
  stop: string;
  /** Summed `usage.total_tokens` across the loop (0 if the endpoint omits usage). */
  tokens: number;
}

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}
interface AssistantMessage {
  role: "assistant";
  content: string | null;
  tool_calls?: ToolCall[];
}
interface ChatResponse {
  choices: Array<{ message: AssistantMessage; finish_reason: string }>;
  usage?: { total_tokens?: number };
}

/** Convert a neutral tool to the OpenAI function-tool shape. */
function toFunctionTool(tool: NeutralTool): unknown {
  return {
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.input_schema },
  };
}

async function post(endpoint: ModelEndpoint, body: unknown): Promise<ChatResponse> {
  const url = `${endpoint.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (endpoint.apiKey) headers.authorization = `Bearer ${endpoint.apiKey}`;

  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (response.ok) return (await response.json()) as ChatResponse;

    // Retry the retryable statuses with backoff, honouring `retry-after` when
    // present, then give up. Patient enough to ride out a brief shared-pool
    // rate-limit, but not so patient that a sustained one hangs the sweep.
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= 6) {
      throw new Error(`Chat API ${response.status}: ${await response.text()}`);
    }
    const retryAfter = Number(response.headers.get("retry-after")) * 1000;
    const wait = retryAfter || Math.min(30_000, (attempt + 1) * 5_000);
    await new Promise((r) => setTimeout(r, wait));
  }
}

/** Run the tool-use loop to a natural stop or the hard turn cap. */
export async function runAgent(config: AgentConfig): Promise<AgentRun> {
  const messages: unknown[] = [
    { role: "system", content: config.system },
    { role: "user", content: config.initialUser },
  ];
  const tools = config.tools.map(toFunctionTool);
  let tokens = 0;

  for (let turn = 1; turn <= config.maxTurns; turn += 1) {
    const response = await post(config.endpoint, {
      model: config.endpoint.model,
      max_tokens: config.maxTokens ?? 4096,
      temperature: 0,
      tools,
      tool_choice: "auto",
      messages,
    });
    tokens += response.usage?.total_tokens ?? 0;

    const choice = response.choices[0];
    if (!choice) return { turns: turn, stop: "no_choice", tokens };
    messages.push(choice.message);

    const calls = choice.message.tool_calls ?? [];
    if (choice.finish_reason !== "tool_calls" && calls.length === 0) {
      return { turns: turn, stop: choice.finish_reason, tokens };
    }

    // Execute each tool call and append one `tool` message per call. Some
    // endpoints emit tool_calls without setting finish_reason to "tool_calls",
    // so the presence of calls is what drives the loop, not the reason alone.
    for (const call of calls) {
      let input: unknown = {};
      try {
        input = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        // A malformed arguments string is the model's error to recover from, not ours.
      }
      const { text } = config.executeTool(call.function.name, input);
      messages.push({ role: "tool", tool_call_id: call.id, content: text });
    }
    if (calls.length === 0) return { turns: turn, stop: choice.finish_reason, tokens };
  }

  return { turns: config.maxTurns, stop: "max_turns", tokens };
}
