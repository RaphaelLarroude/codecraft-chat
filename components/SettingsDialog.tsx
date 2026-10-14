"use client";
import React from "react";
import { X, Eye, EyeOff, Save, RefreshCw } from "lucide-react";
import { Button, Input, Label, Textarea, Separator } from "./ui/primitives";
import type { AppSettings } from "@/lib/types";

export function SettingsDialog({
  open,
  onClose,
  settings,
  onSave,
  onFetchModels,
  modelsCount,
  modelsError,
}: {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onFetchModels: () => void;
  modelsCount: number;
  modelsError: string | null;
}) {
  const [draft, setDraft] = React.useState<AppSettings>(settings);
  const [showKey, setShowKey] = React.useState(false);
  React.useEffect(() => setDraft(settings), [settings, open]);
  if (!open) return null;

  const save = () => { onSave(draft); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl border bg-card shadow-2xl">
        <div className="sticky top-0 bg-card border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Configurações</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>

        <div className="p-6 space-y-6">
          {/* API */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">CodeCraft API</h3>
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input value={draft.apiBaseUrl} onChange={(e) => setDraft({ ...draft, apiBaseUrl: e.target.value })} placeholder="https://api.codecraft.ai" />
              <p className="text-xs text-muted-foreground">Ex: https://api.openai.com ou a URL da sua CodeCraft API</p>
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input type={showKey ? "text" : "password"} value={draft.apiKey} onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} placeholder="sk-..." className="pr-10" />
                  <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent">
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button variant="outline" onClick={onFetchModels}><RefreshCw className="h-4 w-4 mr-2" /> Testar</Button>
              </div>
              {modelsError ? <p className="text-xs text-destructive">{modelsError}</p> : <p className="text-xs text-muted-foreground">{modelsCount ? `${modelsCount} modelos carregados` : "Clique em Testar para buscar modelos"}</p>}
              <p className="text-xs text-muted-foreground">Sua chave fica apenas no seu navegador (LocalStorage), nunca é enviada a terceiros.</p>
            </div>
          </div>

          <Separator />

          {/* Parâmetros padrão */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Parâmetros padrão</h3>
            <div className="space-y-2">
              <Label>System Prompt</Label>
              <Textarea value={draft.defaultSystemPrompt} onChange={(e) => setDraft({ ...draft, defaultSystemPrompt: e.target.value })} rows={3} placeholder="Você é um assistente útil…" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Temperature: {draft.defaultTemperature.toFixed(2)}</Label>
                <input type="range" min={0} max={2} step={0.1} value={draft.defaultTemperature} onChange={(e) => setDraft({ ...draft, defaultTemperature: parseFloat(e.target.value) })} className="w-full" />
              </div>
              <div className="space-y-2">
                <Label>Max Tokens</Label>
                <Input type="number" value={draft.defaultMaxTokens} onChange={(e) => setDraft({ ...draft, defaultMaxTokens: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Preços */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Preços (USD por 1M tokens) — fallback</h3>
            <p className="text-xs text-muted-foreground">Usado quando o modelo não informa pricing na API. Ex: gpt-4o → prompt $2.50 / completion $10.00</p>
            <div className="space-y-2">
              <Label>Formato: modelo = prompt,completion (um por linha)</Label>
              <Textarea
                rows={4}
                value={Object.entries(draft.pricingOverrides).map(([k, v]) => `${k}=${v.prompt},${v.completion}`).join("\n")}
                onChange={(e) => {
                  const overrides: AppSettings["pricingOverrides"] = {};
                  for (const line of e.target.value.split("\n")) {
                    const m = line.trim().match(/^(.+?)\s*=\s*([0-9.]+)\s*,\s*([0-9.]+)/);
                    if (m) overrides[m[1].trim()] = { prompt: parseFloat(m[2]), completion: parseFloat(m[3]) };
                  }
                  setDraft({ ...draft, pricingOverrides: overrides });
                }}
                placeholder={"gpt-4o=2.5,10\ngpt-4o-mini=0.15,0.6\nclaude-3-5-sonnet=3,15"}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">Dica: deixe vazio para usar $0.01 por 1k tokens como fallback genérico.</p>
            </div>
          </div>

          <Separator />

          {/* Tema */}
          <div className="space-y-2">
            <Label>Tema</Label>
            <div className="flex gap-2">
              {(["light", "dark", "system"] as const).map((t) => (
                <Button key={t} variant={draft.theme === t ? "default" : "outline"} size="sm" onClick={() => setDraft({ ...draft, theme: t })} className="capitalize">{t}</Button>
              ))}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-card border-t px-6 py-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}><Save className="h-4 w-4 mr-2" />Salvar</Button>
        </div>
      </div>
    </div>
  );
}
