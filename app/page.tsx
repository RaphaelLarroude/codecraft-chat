"use client";
import React from "react";
import { Sidebar } from "@/components/Sidebar";
import { ModelSelector } from "@/components/ModelSelector";
import { ChatMessageView } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { SettingsDialog } from "@/components/SettingsDialog";
import { Button } from "@/components/ui/primitives";
import { loadSettings, saveSettings, loadConversations, saveConversation, deleteConversation } from "@/lib/storage";
import { fetchModels, extractPricing, calcCost, streamChatCompletion } from "@/lib/api";
import { fileToAttachment, attachmentToContextBlock } from "@/lib/file-extract";
import type { Conversation, ChatMessage, ModelInfo, AppSettings, Attachment, TokenUsage } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";
import { formatCost } from "@/lib/utils";
import { Settings2, Sparkles, AlertTriangle, Sun, Moon, Menu } from "lucide-react";

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }

export default function Home() {
  const [settings, setSettings] = React.useState<AppSettings>(DEFAULT_SETTINGS);
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [models, setModels] = React.useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = React.useState(false);
  const [modelsError, setModelsError] = React.useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [streaming, setStreaming] = React.useState(false);
  const [streamError, setStreamError] = React.useState<string | null>(null);
  const [speakingId, setSpeakingId] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const initialized = React.useRef(false);

  const active = conversations.find((c) => c.id === activeId) || null;

  // Init
  React.useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    applyTheme(s.theme);
    loadConversations().then((list) => {
      setConversations(list);
      if (list.length > 0) setActiveId(list[0].id);
      else createNew(s);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!initialized.current && settings.apiKey && settings.apiBaseUrl) {
      initialized.current = true;
      doFetchModels(settings);
    }
  }, [settings.apiKey, settings.apiBaseUrl]);

  function applyTheme(t: AppSettings["theme"]) {
    const root = document.documentElement;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = t === "dark" || (t === "system" && prefersDark);
    root.classList.toggle("dark", isDark);
  }

  async function doFetchModels(s: AppSettings = settings) {
    if (!s.apiBaseUrl) { setModelsError("Configure a Base URL"); return; }
    setModelsLoading(true); setModelsError(null);
    try {
      const list = await fetchModels(s.apiBaseUrl, s.apiKey);
      setModels(list);
      // se modelo ativo não existe mais, seleciona o primeiro
      if (list.length && active && !list.find((m) => m.id === active.model)) {
        // mantém como está para não quebrar
      }
    } catch (e: unknown) {
      setModelsError(e instanceof Error ? e.message : String(e));
    } finally { setModelsLoading(false); }
  }

  function handleSaveSettings(s: AppSettings) {
    setSettings(s); saveSettings(s); applyTheme(s.theme);
    doFetchModels(s);
  }

  function createNew(s: AppSettings = settings) {
    const c: Conversation = {
      id: uid(),
      title: "Nova conversa",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: models[0]?.id || "",
      systemPrompt: s.defaultSystemPrompt,
      temperature: s.defaultTemperature,
      maxTokens: s.defaultMaxTokens,
      messages: [],
      totalCost: 0,
      totalTokens: 0,
    };
    setConversations((prev) => [c, ...prev]);
    setActiveId(c.id);
    saveConversation(c);
    setAttachments([]);
    setStreamError(null);
    setMobileSidebarOpen(false);
  }

  function updateConversation(id: string, patch: Partial<Conversation>) {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c)));
    const c = conversations.find((x) => x.id === id);
    if (c) saveConversation({ ...c, ...patch, updatedAt: Date.now() });
  }

  function handleSelectModel(modelId: string) {
    if (!active) return;
    updateConversation(active.id, { model: modelId });
  }

  // Auto scroll
  React.useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [active?.messages.length, streaming]);

  // TTS
  function speak(id: string, text: string) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.slice(0, 4000));
      u.lang = "pt-BR";
      u.onend = () => setSpeakingId(null);
      u.onerror = () => setSpeakingId(null);
      setSpeakingId(id);
      speechSynthesis.speak(u);
    } catch { setSpeakingId(null); }
  }
  function stopSpeak() { try { speechSynthesis.cancel(); } catch {} setSpeakingId(null); }

  // Enviar mensagem
  async function handleSend(text: string) {
    if (!active) return;
    if (!settings.apiKey) { setSettingsOpen(true); setStreamError("Configure sua API Key em Configurações."); return; }
    if (!active.model) { setStreamError("Selecione um modelo antes de conversar."); return; }
    setStreamError(null);

    // Monta conteúdo com anexos
    const atts = [...attachments];
    setAttachments([]);
    let userContent = text;
    if (atts.length) {
      for (const a of atts) userContent += attachmentToContextBlock(a);
    }

    // Prepara mensagens para API: inclui imagens como vision quando houver
    const hasImage = atts.some((a) => !!a.dataUrl);
    const apiMessages: { role: string; content: string | unknown }[] = [];
    if (active.systemPrompt.trim()) apiMessages.push({ role: "system", content: active.systemPrompt });
    for (const m of active.messages) apiMessages.push({ role: m.role, content: m.content });
    // mensagem atual: se tem imagem, usa formato content array
    if (hasImage && userContent) {
      const parts: unknown[] = [{ type: "text", text: userContent }];
      for (const a of atts) if (a.dataUrl) parts.push({ type: "image_url", image_url: { url: a.dataUrl } });
      apiMessages.push({ role: "user", content: parts });
    } else {
      apiMessages.push({ role: "user", content: userContent });
    }

    const userMsg: ChatMessage = { id: uid(), role: "user", content: text || (atts.length ? `[${atts.length} arquivo(s) anexado(s)]` : ""), createdAt: Date.now(), attachments: atts.length ? atts : undefined, model: active.model };
    const assistantMsg: ChatMessage = { id: uid(), role: "assistant", content: "", createdAt: Date.now(), model: active.model };

    const newMessages = [...active.messages, userMsg, assistantMsg];
    const titlePatch = active.messages.length === 0 ? { title: (text || atts[0]?.name || "Nova conversa").slice(0, 60) } : {};
    const updated: Conversation = { ...active, ...titlePatch, messages: newMessages, updatedAt: Date.now() };
    setConversations((prev) => prev.map((c) => (c.id === active.id ? updated : c)));
    await saveConversation(updated);

    setStreaming(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    let acc = "";
    let usage: TokenUsage | null = null;

    const pricing = extractPricing(models.find((m) => m.id === active.model) || { id: active.model }) || settings.pricingOverrides[active.model] || { prompt: 1, completion: 2 }; // fallback $1/$2 por 1M

    await streamChatCompletion({
      apiBaseUrl: settings.apiBaseUrl,
      apiKey: settings.apiKey,
      model: active.model,
      messages: apiMessages,
      temperature: active.temperature,
      max_tokens: active.maxTokens,
      stream: true,
      signal: ac.signal,
      callbacks: {
        onDelta: (delta) => {
          acc += delta;
          setConversations((prev) => prev.map((c) => c.id === active.id ? { ...c, messages: c.messages.map((m) => m.id === assistantMsg.id ? { ...m, content: acc } : m) } : c));
        },
        onUsage: (u) => { usage = u; },
        onDone: async () => {
          setStreaming(false);
          const cost = usage ? calcCost(usage, pricing) : 0;
          setConversations((prev) => {
            const next = prev.map((c) => {
              if (c.id !== active.id) return c;
              const msgs = c.messages.map((m) => m.id === assistantMsg.id ? { ...m, content: acc, usage: usage || undefined, cost } : m);
              const totalCost = msgs.reduce((s, m) => s + (m.cost || 0), 0);
              const totalTokens = msgs.reduce((s, m) => s + (m.usage?.total_tokens || 0), 0);
              const nc = { ...c, messages: msgs, totalCost, totalTokens, updatedAt: Date.now() };
              saveConversation(nc);
              return nc;
            });
            return next;
          });
        },
        onError: (msg) => {
          setStreaming(false);
          setStreamError(msg);
          // remove mensagem vazia do assistente se falhou
          setConversations((prev) => prev.map((c) => c.id === active.id ? { ...c, messages: c.messages.filter((m) => m.id !== assistantMsg.id || m.content) } : c));
        },
      },
    });
  }

  function handleStop() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  function handleFiles(files: FileList) {
    Promise.all(Array.from(files).map(fileToAttachment)).then((atts) => setAttachments((prev) => [...prev, ...atts]));
  }

  // Export
  async function handleExport(id: string, fmt: "json" | "txt" | "pdf") {
    const c = conversations.find((x) => x.id === id);
    if (!c) return;
    if (fmt === "json") {
      const blob = new Blob([JSON.stringify(c, null, 2)], { type: "application/json" });
      downloadBlob(blob, `${safeName(c.title)}.json`);
    } else if (fmt === "txt") {
      const txt = c.messages.map((m) => `${m.role.toUpperCase()} [${new Date(m.createdAt).toLocaleString("pt-BR")}]:\n${m.content}\n`).join("\n---\n\n");
      downloadBlob(new Blob([txt], { type: "text/plain" }), `${safeName(c.title)}.txt`);
    } else {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 40; let y = 50;
      doc.setFontSize(16); doc.text(c.title, margin, y); y += 18;
      doc.setFontSize(9); doc.setTextColor(100); doc.text(`Modelo: ${c.model} · ${new Date(c.createdAt).toLocaleString("pt-BR")} · ${formatCost(c.totalCost)}`, margin, y); y += 16;
      doc.setTextColor(0);
      for (const m of c.messages) {
        if (y > 760) { doc.addPage(); y = 50; }
        doc.setFontSize(9); doc.setFont("helvetica", "bold");
        doc.text(`${m.role.toUpperCase()}:`, margin, y); y += 12;
        doc.setFont("helvetica", "normal"); doc.setFontSize(9);
        const lines = doc.splitTextToSize(m.content.slice(0, 8000) || "(vazio)", 515);
        for (const line of lines) {
          if (y > 780) { doc.addPage(); y = 50; }
          doc.text(line, margin, y); y += 11;
        }
        y += 8;
      }
      doc.save(`${safeName(c.title)}.pdf`);
    }
  }
  function safeName(s: string) { return s.replace(/[^a-z0-9\-_ ]/gi, "_").slice(0, 40) || "conversa"; }
  function downloadBlob(b: Blob, name: string) {
    const url = URL.createObjectURL(b);
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const totalCostAll = conversations.reduce((s, c) => s + c.totalCost, 0);
  const lastCost = active?.messages.filter((m) => typeof m.cost === "number").slice(-1)[0]?.cost;

  return (
    <div className="h-[100dvh] flex bg-background text-foreground overflow-hidden">
      {/* Sidebar desktop */}
      <div className="hidden md:flex">
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={(id) => { setActiveId(id); setAttachments([]); setStreamError(null); }}
          onNew={() => createNew()}
          onDelete={async (id) => { await deleteConversation(id); setConversations((prev) => prev.filter((c) => c.id !== id)); if (activeId === id) setActiveId(conversations.find((c) => c.id !== id)?.id || null); }}
          onToggleFav={(id) => {
            const c = conversations.find((x) => x.id === id);
            if (!c) return;
            const nc = { ...c, favorite: !c.favorite, updatedAt: Date.now() };
            setConversations((prev) => prev.map((x) => x.id === id ? nc : x));
            saveConversation(nc);
          }}
          onRename={(id, title) => {
            const c = conversations.find((x) => x.id === id);
            if (!c) return;
            const nc = { ...c, title, updatedAt: Date.now() };
            setConversations((prev) => prev.map((x) => x.id === id ? nc : x));
            saveConversation(nc);
          }}
          onExport={handleExport}
          search={search}
          setSearch={setSearch}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          totalCostAll={totalCostAll}
        />
      </div>

      {/* Sidebar mobile drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
          <div className="relative bg-card w-[85vw] max-w-[320px] h-full shadow-xl overflow-hidden flex flex-col">
            <Sidebar
              conversations={conversations}
              activeId={activeId}
              onSelect={(id) => { setActiveId(id); setMobileSidebarOpen(false); setAttachments([]); }}
              onNew={() => createNew()}
              onDelete={async (id) => { await deleteConversation(id); setConversations((prev) => prev.filter((c) => c.id !== id)); if (activeId === id) setActiveId(null); }}
              onToggleFav={(id) => {
                const c = conversations.find((x) => x.id === id);
                if (!c) return;
                const nc = { ...c, favorite: !c.favorite, updatedAt: Date.now() };
                setConversations((prev) => prev.map((x) => x.id === id ? nc : x));
                saveConversation(nc);
              }}
              onRename={(id, title) => {
                const c = conversations.find((x) => x.id === id);
                if (!c) return;
                const nc = { ...c, title, updatedAt: Date.now() };
                setConversations((prev) => prev.map((x) => x.id === id ? nc : x));
                saveConversation(nc);
              }}
              onExport={handleExport}
              search={search}
              setSearch={setSearch}
              collapsed={false}
              setCollapsed={() => {}}
              totalCostAll={totalCostAll}
            />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-14 border-b bg-card/80 backdrop-blur flex items-center gap-2 px-3 md:px-4 shrink-0">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileSidebarOpen(true)}><Menu className="h-5 w-5" /></Button>

          <ModelSelector models={models} selected={active?.model || ""} onSelect={handleSelectModel} loading={modelsLoading} error={modelsError} onRefresh={() => doFetchModels()} />

          {/* Param controls */}
          {active && (
            <div className="hidden lg:flex items-center gap-3 ml-2">
              <label className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground whitespace-nowrap">Temp</span>
                <input type="range" min={0} max={2} step={0.1} value={active.temperature} onChange={(e) => updateConversation(active.id, { temperature: parseFloat(e.target.value) })} className="w-20" />
                <span className="font-mono w-7">{active.temperature.toFixed(1)}</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Max</span>
                <input type="number" value={active.maxTokens} onChange={(e) => updateConversation(active.id, { maxTokens: parseInt(e.target.value) || 0 })} className="w-20 rounded-lg border bg-background px-2 py-1 text-xs" />
              </label>
            </div>
          )}

          <div className="flex-1" />

          {/* Cost pills */}
          <div className="hidden sm:flex items-center gap-1.5">
            {typeof lastCost === "number" && <span className="text-xs font-mono bg-secondary px-2 py-1 rounded-full">Última: {formatCost(lastCost)}</span>}
            {active && <span className="text-xs font-mono bg-secondary px-2 py-1 rounded-full">Conversa: {formatCost(active.totalCost)}</span>}
            <span className="text-xs font-mono bg-primary text-primary-foreground px-2 py-1 rounded-full">Total: {formatCost(totalCostAll)}</span>
          </div>

          <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="Configurações"><Settings2 className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" onClick={() => { const nt = settings.theme === "dark" ? "light" : "dark" as const; applyTheme(nt); handleSaveSettings({ ...settings, theme: nt }); }} title="Tema">
            <span className="dark:hidden"><Moon className="h-4 w-4" /></span><span className="hidden dark:inline"><Sun className="h-4 w-4" /></span>
          </Button>
        </div>

        {/* Mobile cost bar */}
        <div className="sm:hidden flex items-center gap-1.5 px-3 py-2 border-b bg-muted/30 text-xs font-mono overflow-x-auto">
          {typeof lastCost === "number" && <span className="whitespace-nowrap">Última: {formatCost(lastCost)}</span>}
          {active && <><span>·</span><span className="whitespace-nowrap">Conversa: {formatCost(active.totalCost)}</span></>}
          <span>·</span><span className="whitespace-nowrap font-bold">Total: {formatCost(totalCostAll)}</span>
        </div>

        {/* Messages */}
        <div ref={listRef} className="flex-1 overflow-auto">
          {!active ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="h-16 w-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-2xl font-black mb-4">CC</div>
              <h1 className="text-2xl font-bold tracking-tight">CodeCraft Chat</h1>
              <p className="text-muted-foreground mt-2 max-w-md">Conecte sua CodeCraft API em Configurações, escolha um modelo e comece a conversar com streaming, upload universal, voz e histórico.</p>
              <Button onClick={() => setSettingsOpen(true)} className="mt-6"><Settings2 className="h-4 w-4 mr-2" /> Configurar API</Button>
            </div>
          ) : active.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <Sparkles className="h-10 w-10 text-primary mb-3" />
              <h2 className="text-xl font-bold">Como posso ajudar hoje?</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">Digite sua mensagem, arraste arquivos (PDF, imagens, código…) ou use o microfone. O modelo atual é <span className="font-mono font-medium text-foreground">{active.model || "— selecione um modelo —"}</span>.</p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {["Explique este código", "Resuma um PDF", "Crie um componente React", "Analise esta imagem"].map((s) => (
                  <button key={s} onClick={() => { const el = document.querySelector("textarea") as HTMLTextAreaElement | null; if (el) { el.value = s; el.dispatchEvent(new Event("input", { bubbles: true })); el.focus(); } }} className="text-xs rounded-full border bg-card px-3 py-1.5 hover:bg-accent transition-colors">{s}</button>
                ))}
              </div>
              {/* System prompt + params (mobile/colapsado) */}
              <div className="mt-6 w-full max-w-xl text-left rounded-2xl border bg-card p-4 space-y-3">
                <label className="block text-xs font-semibold">System Prompt</label>
                <textarea value={active.systemPrompt} onChange={(e) => updateConversation(active.id, { systemPrompt: e.target.value })} rows={2} className="w-full rounded-xl border bg-background px-3 py-2 text-sm" placeholder="Você é um assistente útil…" />
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs">Temperature: {active.temperature.toFixed(1)}<input type="range" min={0} max={2} step={0.1} value={active.temperature} onChange={(e) => updateConversation(active.id, { temperature: parseFloat(e.target.value) })} className="w-full mt-1" /></label>
                  <label className="text-xs">Max Tokens<input type="number" value={active.maxTokens} onChange={(e) => updateConversation(active.id, { maxTokens: parseInt(e.target.value) || 0 })} className="mt-1 w-full rounded-lg border bg-background px-2 py-1.5 text-sm" /></label>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto px-3 md:px-6 py-6 space-y-6">
              {active.messages.map((m) => (
                <ChatMessageView key={m.id} message={m} onSpeak={speak} speakingId={speakingId} onStopSpeak={stopSpeak} />
              ))}
              {streaming && <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Gerando resposta… <Button variant="outline" size="sm" className="ml-2 h-7" onClick={handleStop}>Parar</Button></div>}
              {streamError && <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm flex gap-2"><AlertTriangle className="h-5 w-5 text-destructive shrink-0" /><span>{streamError}</span></div>}
            </div>
          )}
        </div>

        {/* Input */}
        {active && (
          <ChatInput
            onSend={handleSend}
            onFiles={handleFiles}
            attachments={attachments}
            setAttachments={setAttachments}
            disabled={streaming}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}

        {!active && (
          <div className="border-t p-3 text-center text-xs text-muted-foreground">
            Crie uma nova conversa para começar · Seus dados ficam no seu navegador
          </div>
        )}
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} onSave={handleSaveSettings} onFetchModels={() => doFetchModels()} modelsCount={models.length} modelsError={modelsError} />
    </div>
  );
}
