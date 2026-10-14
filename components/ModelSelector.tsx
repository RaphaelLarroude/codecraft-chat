"use client";
import React from "react";
import { ChevronDown, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "./ui/primitives";
import type { ModelInfo } from "@/lib/types";

export function ModelSelector({
  models,
  selected,
  onSelect,
  loading,
  error,
  onRefresh,
}: {
  models: ModelInfo[];
  selected: string;
  onSelect: (id: string) => void;
  loading?: boolean;
  error?: string | null;
  onRefresh: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const current = models.find((m) => m.id === selected);

  const ctxLabel = (m: ModelInfo) => {
    const n = (m.context_length ?? m.contextLength ?? m.max_context) as number | undefined;
    if (typeof n === "number" && n > 0) return `${(n / 1000).toFixed(0)}k ctx`;
    return null;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm hover:bg-accent transition-colors max-w-[min(360px,70vw)]"
      >
        <span className="truncate font-medium">{current ? (current.name as string) || current.id : selected || "Selecione o modelo"}</span>
        {current && ctxLabel(current) && <span className="shrink-0 text-xs bg-secondary px-1.5 py-0.5 rounded-full">{ctxLabel(current)}</span>}
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-2 w-[min(420px,90vw)] rounded-2xl border bg-popover shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <span className="text-xs font-semibold text-muted-foreground">{models.length} modelos</span>
              <Button variant="ghost" size="sm" onClick={onRefresh} disabled={!!loading}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
              </Button>
            </div>
            {error && (
              <div className="m-2 rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-destructive" /> <span>{error}</span>
              </div>
            )}
            <div className="max-h-[320px] overflow-auto p-1">
              {loading && <div className="p-6 text-center text-sm text-muted-foreground">Carregando modelos…</div>}
              {!loading && models.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nenhum modelo encontrado. Verifique API Key e Base URL.</div>}
              {models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { onSelect(m.id); setOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl hover:bg-accent transition-colors ${selected === m.id ? "bg-accent" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{(m.name as string) || m.id}</span>
                    {ctxLabel(m) && <span className="text-[11px] bg-secondary px-1.5 py-0.5 rounded-full shrink-0">{ctxLabel(m)}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{m.id}{m.owned_by ? ` · ${m.owned_by}` : ""}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
