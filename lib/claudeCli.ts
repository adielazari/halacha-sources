import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Local-dev-only helper: shells out to the developer's own authenticated
// `claude` CLI (print mode) instead of the paid Anthropic API — this repo
// only ever runs on the developer's machine, so there's no separate API key
// to manage or bill. Uses --json-schema for validated structured output.
export async function runClaudeStructured<T>(
  systemPrompt: string,
  userPrompt: string,
  jsonSchema: object
): Promise<T> {
  const { stdout } = await execFileAsync(
    "claude",
    [
      "-p",
      "--system-prompt", systemPrompt,
      "--tools", "",
      "--model", "opus",
      "--output-format", "json",
      "--json-schema", JSON.stringify(jsonSchema),
      userPrompt,
    ],
    { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 }
  );

  const envelope = JSON.parse(stdout) as {
    is_error?: boolean;
    structured_output?: T;
    result?: string;
  };

  if (envelope.is_error) {
    throw new Error("claude CLI reported an error");
  }
  if (envelope.structured_output) {
    return envelope.structured_output;
  }
  if (typeof envelope.result === "string") {
    return JSON.parse(envelope.result) as T;
  }
  throw new Error("claude CLI returned no structured output");
}
