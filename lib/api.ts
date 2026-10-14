// Cliente CodeCraft API + cálculo de custo

import type { ModelInfo, TokenUsage } from "./types";

// Normaliza base URL (remove trailing slash)
export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

// Busca modelos — tenta /v1/models e /models
export async function fetchModels(apiBaseUrl: string, apiKey: string): Promise<ModelInfo[]> {
  const base = normalizeBaseUrl(apiBaseUrl);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const candidates = [`${base}/v1/models`, `${base}/models`];
  let lastErr = "";
  for (const url of candidates) {
    try {
      const r = await fetch(url, { headers });
      if (!r.ok) {
        lastErr = `${r.status} ${r.statusText} @ ${url}`;
        continue;
      }
      const j = await r.json();
      // OpenAI-style: { data: [...] } ou array direto
      const list: ModelInfo[] = Array.isArray(j) ? j : Array.isArray(j.data) ? j.data : [];
      if (list.length > 0 || j.data) return list;
      lastErr = `Resposta vazia @ ${url}`;
    } catch (e: unknown) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(lastErr || "Falha ao buscar modelos");
}

// Extrai preço por 1M tokens do objeto do modelo (se houver)
export function extractPricing(m: ModelInfo): { prompt: number; completion: number } | null {
  const p = m.pricing as Record<string, unknown> | undefined;
  if (!p) return null;
  const prompt = Number(p.prompt ?? p.input ?? p.prompt_tokens);
  const completion = Number(p.completion ?? p.output ?? p.completion_tokens);
  if (Number.isFinite(prompt) && Number.isFinite(completion)) return { prompt, completion };
  // alguns provedores usam string "$0.50"
  const parsePrice = (v: unknown) => {
    if (typeof v === "string") return parseFloat(v.replace(/[^0-9.]/g, "")) || NaN;
    return Number(v);
  };
  const pr = parsePrice(p.prompt ?? p.input);
  const co = parsePrice(p.completion ?? p.output);
  if (Number.isFinite(pr) && Number.isFinite(co)) return { prompt: pr, completion: co };
  return null;
}

export function calcCost(usage: TokenUsage, pricing: { prompt: number; completion: number }): number {
  // pricing = USD por 1M tokens
  return (usage.prompt_tokens * pricing.prompt) / 1_000_000 + (usage.completion_tokens * pricing.completion) / 1_000_000;
}

// Stream helper: consome SSE de /v1/chat/completions
export type StreamCallbacks = {
  onDelta: (text: string) => void;
  onUsage?: (usage: TokenUsage) => void;
  onDone: () => void;
  onError: (msg: string) => void;
};

export async function streamChatCompletion(opts: {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  messages: { role: string; content: string | unknown }[];
  temperature: number;
  max_tokens: number;
  stream: boolean;
  callbacks: StreamCallbacks;
  signal?: AbortSignal;
}) {
  const base = normalizeBaseUrl(opts.apiBaseUrl);
  const url = `${base}/v1/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature,
      max_tokens: opts.max_tokens,
      stream: opts.stream,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = JSON.parse(txt);
      msg = j.error?.message || j.message || msg;
    } catch {
      if (txt) msg = txt.slice(0, 500);
    }
    opts.callbacks.onError(msg);
    return;
  }

  // Se não stream, lê JSON direto
  if (!opts.stream) {
    const j = await res.json();
    const content: string = j.choices?.[0]?.message?.content ?? "";
    if (content) opts.callbacks.onDelta(content);
    if (j.usage) opts.callbacks.onUsage?.(j.usage);
    opts.callbacks.onDone();
    return;
  }

  // SSE streaming
  const reader = res.body?.getReader();
  if (!reader) {
    opts.callbacks.onError("Sem body na resposta");
    return;
  }
  const decoder = new TextDecoder();
  let buffer = "";
  let usage: TokenUsage | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":")) continue;
      const payload = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
      if (payload === "[DONE]") {
        if (usage) opts.callbacks.onUsage?.(usage);
        opts.callbacks.onDone();
        return;
      }
      try {
        const j = JSON.parse(payload);
        // delta
        const delta: string | undefined = j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content;
        if (typeof delta === "string" && delta) opts.callbacks.onDelta(delta);
        if (j.usage) usage = j.usage as TokenUsage;
        // alguns provedores mandam usage no último chunk
        if (j.usage) opts.callbacks.onUsage?.(j.usage);
      } catch {
        // ignora linha não-JSON
      }
    }
  }
  // flush buffer final
  if (buffer.trim()) {
    const p = buffer.trim().startsWith("data:") ? buffer.trim().slice(5).trim() : buffer.trim();
    if (p && p !== "[DONE]") {
      try {
        const j = JSON.parse(p);
        const delta: string | undefined = j.choices?.[0]?.delta?.content;
        if (delta) opts.callbacks.onDelta(delta);
        if (j.usage) opts.callbacks.onUsage?.(j.usage);
      } catch {}
    }
  }
  opts.callbacks.onDone();
}
