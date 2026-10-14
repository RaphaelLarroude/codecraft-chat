"use client";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Copy, Check, Volume2, Square } from "lucide-react";
import { Button } from "./ui/primitives";
import type { ChatMessage } from "@/lib/types";
import { formatCost } from "@/lib/utils";

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="relative group my-3 rounded-xl overflow-hidden border border-border bg-zinc-950">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
        <span className="text-xs font-mono text-zinc-400">{lang || "code"}</span>
        <button onClick={copy} className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
        <code className="text-zinc-100 font-mono whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}

export function ChatMessageView({
  message,
  onSpeak,
  speakingId,
  onStopSpeak,
}: {
  message: ChatMessage;
  onSpeak: (id: string, text: string) => void;
  speakingId: string | null;
  onStopSpeak: () => void;
}) {
  const isUser = message.role === "user";
  const isSpeaking = speakingId === message.id;

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} animate-fade-in`}>
      {!isUser && (
        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-1">IA</div>
      )}
      <div className={`max-w-[85%] md:max-w-[78%] rounded-2xl px-4 py-3 ${isUser ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm"}`}>
        {/* Attachments preview */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {message.attachments.map((a) => (
              <div key={a.id} className="rounded-lg border bg-muted/50 px-2.5 py-1.5 text-xs flex items-center gap-2">
                {a.dataUrl ? <img src={a.dataUrl} alt={a.name} className="h-16 w-16 object-cover rounded-md border" /> : null}
                <span className="truncate max-w-[160px]">{a.name}</span>
                <span className="text-muted-foreground">{(a.size / 1024).toFixed(1)} KB</span>
              </div>
            ))}
          </div>
        )}

        {/* Conteúdo */}
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-transparent prose-pre:p-0">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                code(props: { children?: React.ReactNode; className?: string }) {
                  const { children, className } = props;
                  const match = /language-(\w+)/.exec(className || "");
                  const codeText = String(children).replace(/\n$/, "");
                  const isBlock = !!match || codeText.includes("\n");
                  if (isBlock) return <CodeBlock code={codeText} lang={match?.[1]} />;
                  return <code className="bg-muted px-1.5 py-0.5 rounded text-[13px] font-mono">{children}</code>;
                },
                a: (p) => <a {...p} className="text-primary underline underline-offset-2" target="_blank" rel="noreferrer" />,
                table: (p) => <div className="overflow-x-auto"><table {...p} className="w-full text-sm border-collapse" /></div>,
                th: (p) => <th {...p} className="border border-border px-2 py-1 bg-muted text-left" />,
                td: (p) => <td {...p} className="border border-border px-2 py-1" />,
              }}
            >
              {message.content || "▍"}
            </ReactMarkdown>
          </div>
        )}

        {/* Meta */}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] opacity-70">
          <span>{new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
          {message.model && <span className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">{message.model}</span>}
          {message.usage && (
            <span>
              {message.usage.prompt_tokens}↑ {message.usage.completion_tokens}↓ · {message.usage.total_tokens} tokens
            </span>
          )}
          {typeof message.cost === "number" && <span className="font-mono font-medium">{formatCost(message.cost)}</span>}
          {!isUser && message.content && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] ml-auto"
              onClick={() => (isSpeaking ? onStopSpeak() : onSpeak(message.id, message.content))}
              title={isSpeaking ? "Parar" : "Ouvir resposta"}
            >
              {isSpeaking ? <Square className="h-3 w-3 mr-1" /> : <Volume2 className="h-3 w-3 mr-1" />}
              {isSpeaking ? "Parar" : "Ouvir"}
            </Button>
          )}
        </div>
      </div>
      {isUser && <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold shrink-0 mt-1">Você</div>}
    </div>
  );
}
