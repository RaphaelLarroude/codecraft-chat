// Tipos centrais do CodeCraft Chat
export type Role = "user" | "assistant" | "system";

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  // Para imagem: data URL base64 para vision; para doc: texto extraído
  dataUrl?: string; // image/* -> base64
  textContent?: string; // extraído de PDF/TXT/etc
  status: "reading" | "ready" | "error";
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  // attachments ligados à mensagem
  attachments?: Attachment[];
  usage?: TokenUsage;
  cost?: number; // USD
  model?: string;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ModelInfo {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
  // campos extras que a API pode retornar
  name?: string;
  context_length?: number;
  contextLength?: number;
  max_context?: number;
  pricing?: { prompt?: string | number; completion?: string | number; input?: string | number; output?: string | number };
  [k: string]: unknown;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  messages: ChatMessage[];
  favorite?: boolean;
  totalCost: number;
  totalTokens: number;
}

export interface AppSettings {
  apiKey: string;
  apiBaseUrl: string; // ex: https://api.codecraft.example.com
  theme: "light" | "dark" | "system";
  // preço por 1M tokens quando API não retorna pricing
  pricingOverrides: Record<string, { prompt: number; completion: number }>;
  defaultSystemPrompt: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  apiBaseUrl: "https://api.codecraft.ai",
  theme: "dark",
  pricingOverrides: {},
  defaultSystemPrompt: "Você é um assistente útil, preciso e direto.",
  defaultTemperature: 0.7,
  defaultMaxTokens: 2048,
};

export const LS_SETTINGS_KEY = "cc_settings";
export const LS_CONVERSATIONS_KEY = "cc_conversations";
