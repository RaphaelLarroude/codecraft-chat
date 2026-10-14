"use client";
import React from "react";
import { Search, Star, Trash2, Edit2, Download, FileJson, FileText, Plus, MessageSquare } from "lucide-react";
import { Button, Input } from "./ui/primitives";
import type { Conversation } from "@/lib/types";
import { formatCost } from "@/lib/utils";

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onToggleFav,
  onRename,
  onExport,
  search,
  setSearch,
  collapsed,
  setCollapsed,
  totalCostAll,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onToggleFav: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onExport: (id: string, fmt: "json" | "txt" | "pdf") => void;
  search: string;
  setSearch: (v: string) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  totalCostAll: number;
}) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState("");

  const filtered = conversations.filter((c) => !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.model.toLowerCase().includes(search.toLowerCase()));
  const favs = filtered.filter((c) => c.favorite);
  const rest = filtered.filter((c) => !c.favorite);

  const Row = ({ c }: { c: Conversation }) => (
    <div
      onClick={() => onSelect(c.id)}
      className={`group relative rounded-xl px-3 py-2.5 cursor-pointer border transition-colors ${activeId === c.id ? "bg-accent border-border" : "hover:bg-accent/50 border-transparent hover:border-border"}`}
    >
      <div className="flex items-start justify-between gap-2">
        {editingId === c.id ? (
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={() => { if (editTitle.trim()) onRename(c.id, editTitle.trim()); setEditingId(null); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { if (editTitle.trim()) onRename(c.id, editTitle.trim()); setEditingId(null); }
              if (e.key === "Escape") setEditingId(null);
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 rounded-lg border bg-background px-2 py-1 text-sm"
          />
        ) : (
          <p className="text-sm font-medium truncate pr-2 leading-tight">{c.favorite ? "★ " : ""}{c.title}</p>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFav(c.id); }}
          className={`shrink-0 p-1 rounded-lg hover:bg-background ${c.favorite ? "text-amber-500" : "text-muted-foreground opacity-0 group-hover:opacity-100"}`}
          title={c.favorite ? "Desfavoritar" : "Favoritar"}
        >
          <Star className={`h-3.5 w-3.5 ${c.favorite ? "fill-amber-500" : ""}`} />
        </button>
      </div>
      <p className="text-xs text-muted-foreground truncate">{c.model} · {new Date(c.updatedAt).toLocaleDateString("pt-BR")}</p>
      <p className="text-[11px] font-mono text-muted-foreground">{formatCost(c.totalCost)} · {c.messages.length} msgs</p>

      <div className="hidden group-hover:flex items-center gap-1 mt-1.5">
        <button onClick={(e) => { e.stopPropagation(); setEditingId(c.id); setEditTitle(c.title); }} className="p-1 rounded hover:bg-background" title="Renomear"><Edit2 className="h-3 w-3" /></button>
        <button onClick={(e) => { e.stopPropagation(); onExport(c.id, "json"); }} className="p-1 rounded hover:bg-background" title="Exportar JSON"><FileJson className="h-3 w-3" /></button>
        <button onClick={(e) => { e.stopPropagation(); onExport(c.id, "txt"); }} className="p-1 rounded hover:bg-background" title="Exportar TXT"><FileText className="h-3 w-3" /></button>
        <button onClick={(e) => { e.stopPropagation(); onExport(c.id, "pdf"); }} className="p-1 rounded hover:bg-background" title="Exportar PDF"><Download className="h-3 w-3" /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm("Deletar esta conversa?")) onDelete(c.id); }} className="ml-auto p-1 rounded hover:bg-destructive hover:text-destructive-foreground" title="Deletar"><Trash2 className="h-3 w-3" /></button>
      </div>
    </div>
  );

  if (collapsed) {
    return (
      <div className="w-[56px] border-r bg-card flex flex-col items-center py-3 gap-2 shrink-0">
        <Button size="icon" onClick={onNew} title="Nova conversa"><Plus className="h-5 w-5" /></Button>
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(false)} title="Expandir"><MessageSquare className="h-5 w-5" /></Button>
        <div className="mt-auto text-[10px] font-mono text-muted-foreground text-center px-1">{formatCost(totalCostAll)}</div>
      </div>
    );
  }

  return (
    <div className="w-[300px] md:w-[320px] border-r bg-card flex flex-col shrink-0 h-full">
      <div className="p-3 border-b space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-black text-sm">CC</div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm leading-none">CodeCraft Chat</p>
            <p className="text-xs text-muted-foreground">Chat com IA</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCollapsed(true)} title="Recolher">‹</Button>
        </div>
        <Button onClick={onNew} className="w-full justify-center gap-2">
          <Plus className="h-4 w-4" /> Nova conversa
        </Button>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar conversas…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-4">
        {favs.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold tracking-widest text-muted-foreground px-2 mb-1">FAVORITOS</p>
            <div className="space-y-1">{favs.map((c) => <Row key={c.id} c={c} />)}</div>
          </div>
        )}
        <div>
          <p className="text-[11px] font-semibold tracking-widest text-muted-foreground px-2 mb-1">CONVERSAS</p>
          {rest.length === 0 && favs.length === 0 ? (
            <p className="text-sm text-muted-foreground px-2 py-4 text-center">Nenhuma conversa ainda.<br />Crie uma nova!</p>
          ) : (
            <div className="space-y-1">{rest.map((c) => <Row key={c.id} c={c} />)}</div>
          )}
        </div>
      </div>

      <div className="p-3 border-t space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Total de conversas</span><span className="font-mono font-medium text-foreground">{conversations.length}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Custo total</span><span className="font-mono font-bold">{formatCost(totalCostAll)}</span>
        </div>
      </div>
    </div>
  );
}
