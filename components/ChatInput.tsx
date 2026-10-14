"use client";
import React from "react";
import { Send, Paperclip, Mic, MicOff, Square, Loader2, Settings2 } from "lucide-react";
import { Button } from "./ui/primitives";
import type { Attachment } from "@/lib/types";
import { fileToAttachment } from "@/lib/file-extract";

export function ChatInput({
  onSend,
  onFiles,
  attachments,
  setAttachments,
  disabled,
  onOpenSettings,
}: {
  onSend: (text: string) => void;
  onFiles: (files: FileList) => void;
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  disabled?: boolean;
  onOpenSettings: () => void;
}) {
  const [text, setText] = React.useState("");
  const [listening, setListening] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const recRef = React.useRef<SpeechRecognition | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const taRef = React.useRef<HTMLTextAreaElement>(null);

  // Web Speech API
  const toggleListen = () => {
    // fallback: check window
    const W = window as unknown as Record<string, unknown>;
    const Ctor = (W.SpeechRecognition || W.webkitSpeechRecognition) as unknown as new () => SpeechRecognition | undefined;
    if (!Ctor) {
      alert("Reconhecimento de voz não suportado neste navegador. Use Chrome/Edge.");
      return;
    }
    if (listening) {
      try { recRef.current?.stop(); } catch {}
      setListening(false);
      return;
    }
    try {
      const rec: SpeechRecognition = new Ctor() as SpeechRecognition;
      rec.lang = "pt-BR";
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (e: SpeechRecognitionEvent) => {
        const transcript = Array.from(e.results).map((r) => r[0].transcript).join("");
        setText(transcript);
        if (taRef.current) { taRef.current.focus(); }
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const submit = () => {
    const t = text.trim();
    if (!t && attachments.length === 0) return;
    onSend(t);
    setText("");
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) {
      const files = Array.from(e.dataTransfer.files);
      const atts = await Promise.all(files.map(fileToAttachment));
      setAttachments((prev) => [...prev, ...atts]);
    }
  };

  return (
    <div
      className={`border-t bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-3 md:p-4 ${dragOver ? "bg-primary/5 border-primary/30" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {dragOver && <div className="mb-2 text-xs text-primary font-medium text-center">Solte os arquivos aqui ✨</div>}

      {/* Preview anexos */}
      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs shadow-sm">
              {a.dataUrl ? <img src={a.dataUrl} alt={a.name} className="h-10 w-10 rounded-lg object-cover border" /> : <Paperclip className="h-4 w-4 text-muted-foreground" />}
              <div className="min-w-0">
                <div className="truncate max-w-[160px] font-medium">{a.name}</div>
                <div className="text-muted-foreground">{a.status === "reading" ? "Lendo..." : a.status === "error" ? a.error : `${(a.size / 1024).toFixed(1)} KB · pronto`}</div>
              </div>
              <button onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))} className="ml-1 rounded-full hover:bg-accent p-1">
                <Square className="h-3 w-3 rotate-45" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && onFiles(e.target.files)} />
        <Button variant="ghost" size="icon" onClick={() => fileRef.current?.click()} title="Anexar arquivos" aria-label="Anexar">
          <Paperclip className="h-5 w-5" />
        </Button>

        <div className="flex-1 relative">
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            placeholder="Digite sua mensagem… (Shift+Enter para nova linha) — arraste arquivos aqui"
            rows={1}
            className="w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[48px] max-h-[160px]"
            style={{ height: "auto" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 160) + "px";
            }}
          />
          <Button variant="ghost" size="icon" className="absolute right-1 bottom-1.5 h-8 w-8" onClick={toggleListen} title={listening ? "Parar gravação" : "Falar"}>
            {listening ? <MicOff className="h-4 w-4 text-destructive animate-pulse" /> : <Mic className="h-4 w-4" />}
          </Button>
        </div>

        <Button onClick={submit} disabled={disabled || (!text.trim() && attachments.length === 0)} size="icon" className="h-12 w-12 rounded-2xl shrink-0" title="Enviar">
          {disabled ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </Button>
        <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl shrink-0 hidden md:inline-flex" onClick={onOpenSettings} title="Configurações">
          <Settings2 className="h-5 w-5" />
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground text-center mt-2">Pressione Enter para enviar · Shift+Enter para nova linha · Arraste qualquer arquivo</p>
    </div>
  );
}

// Tipos para SpeechRecognition (evita any)
type SpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type SpeechRecognitionEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
