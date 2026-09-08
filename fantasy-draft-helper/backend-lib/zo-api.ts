import { readFileSync } from "fs";

const API_URL = "https://api.zo.computer/zo/ask";
// Real calls observed completing in 18-40s (occasionally longer). Keeping
// per-attempt timeout generous avoids killing legitimate slow-but-working
// calls, while capping retries to 1 bounds the worst case (~112s) well
// under the original 184s — which is what let a slow-but-successful reply
// complete server-side *after* the client had already given up and shown
// an error (confirmed via chat_history timestamps vs. the abort log).
const REQUEST_TIMEOUT = 55000;
const MAX_RETRIES = 2;
const RETRY_DELAY = 2000;

interface ZoRequestData {
  input: string;
  model_name?: string;
  output_format?: Record<string, unknown>;
  conversation_id?: string;
}

interface ZoResponse {
  output: unknown;
  conversation_id?: string;
  [key: string]: unknown;
}

function resolveToken(override?: string): string {
  if (override) return override;

  const candidates = [
    process.env.ZO_CLIENT_IDENTITY_TOKEN,
    process.env.ZO_API_KEY,
  ];

  for (const c of candidates) {
    if (c && c !== "none" && !c.startsWith("${")) return c;
  }

  // Fall back to reading /root/.zo_secrets directly
  try {
    const secrets = readFileSync("/root/.zo_secrets", "utf-8");
    const match = secrets.match(/export ZO_CLIENT_IDENTITY_TOKEN="([^"]+)"/);
    if (match?.[1] && match[1] !== "none") return match[1];
  } catch { /* ignore */ }

  throw new Error("No valid Zo auth token found. Set ZO_CLIENT_IDENTITY_TOKEN or ZO_API_KEY.");
}

function makeAuthHeader(token: string): string {
  // ZO_API_KEY starts with zo_sk_ and needs Bearer prefix
  return token.startsWith("zo_sk_") ? `Bearer ${token}` : token;
}

export async function callZo(
  input: string,
  options?: {
    outputFormat?: Record<string, unknown>;
    conversationId?: string;
    token?: string;
    model?: string;
  },
): Promise<ZoResponse> {
  const rawToken = resolveToken(options?.token);
  const authHeader = makeAuthHeader(rawToken);

  const data: ZoRequestData = {
    input,
    ...(options?.model ? { model_name: options.model } : {}),
  };
  if (options?.outputFormat) {
    data.output_format = options.outputFormat;
  }
  if (options?.conversationId) {
    data.conversation_id = options.conversationId;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          authorization: authHeader,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return (await response.json()) as ZoResponse;
      }

      const errorText = await response.text();
      lastError = new Error(`HTTP ${response.status}: ${errorText}`);
      console.error(
        `Warning: Status ${response.status} on attempt ${attempt + 1}/${MAX_RETRIES}`,
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `Warning: Request failed on attempt ${attempt + 1}/${MAX_RETRIES}:`,
        error,
      );
    }

    if (attempt < MAX_RETRIES - 1) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
    }
  }

  throw new Error(
    `All ${MAX_RETRIES} retry attempts failed. Last error: ${lastError?.message}`,
  );
}
