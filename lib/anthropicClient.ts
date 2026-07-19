import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";

let cachedKey: string | null = null;
let cachedClient: Anthropic | null = null;

function readApiKeyFromKeychain(): string {
  if (cachedKey) return cachedKey;
  const user = process.env.USER || process.env.LOGNAME || "";
  const key = execSync(
    `security find-generic-password -a "${user}" -s "halacha-sources-anthropic-api-key" -w`,
    { encoding: "utf8" }
  ).trim();
  if (!key) throw new Error("Anthropic API key not found in Keychain");
  cachedKey = key;
  return key;
}

export function getAnthropicClient(): Anthropic {
  if (!cachedClient) cachedClient = new Anthropic({ apiKey: readApiKeyFromKeychain() });
  return cachedClient;
}
