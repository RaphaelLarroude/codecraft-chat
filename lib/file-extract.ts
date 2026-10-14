// Extração de texto de arquivos no front-end
import type { Attachment } from "./types";

function readAsDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}
function readAsText(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsText(file);
  });
}
function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as ArrayBuffer);
    r.onerror = () => rej(r.error);
    r.readAsArrayBuffer(file);
  });
}

// Tenta extrair texto de CSV/XLSX via parsing simples
async function extractSpreadsheetText(file: File, ext: string): Promise<string> {
  if (ext === "csv") return await readAsText(file);
  if (ext === "xlsx" || ext === "xls") {
    // Sem deps extras: tenta ler como texto; se falhar, retorna aviso
    // Para produção podemos adicionar sheetjs, mas aqui fazemos best-effort
    try {
      const text = await readAsText(file);
      // Se parece binário, avisa
      if (text.includes("\u0000") || text.length < 10) throw new Error("bin");
      return text.slice(0, 20000);
    } catch {
      return `[Arquivo ${ext.toUpperCase()} binário — conteúdo não extraído no front-end. Anexado como referência: ${file.name}]`;
    }
  }
  return "";
}

export async function fileToAttachment(file: File): Promise<Attachment> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const isImage = file.type.startsWith("image/");
  const base: Attachment = { id, name: file.name, type: file.type || "application/octet-stream", size: file.size, status: "reading" };

  try {
    if (isImage) {
      base.dataUrl = await readAsDataURL(file);
      base.status = "ready";
      return base;
    }

    // Tipos de texto direto
    const textExts = new Set(["txt", "md", "json", "csv", "log", "py", "js", "ts", "tsx", "jsx", "html", "css", "yaml", "yml", "toml", "ini", "sh", "sql", "xml", "rs", "go", "java", "c", "cpp", "h", "cs", "php", "rb", "swift", "kt", "dart", "vue", "svelte"]);
    if (textExts.has(ext) || file.type.startsWith("text/") || file.type === "application/json") {
      const text = await readAsText(file);
      base.textContent = text.slice(0, 100000); // limita
      base.status = "ready";
      return base;
    }

    if (ext === "csv" || ext === "xlsx" || ext === "xls") {
      base.textContent = await extractSpreadsheetText(file, ext);
      base.status = "ready";
      return base;
    }

    if (ext === "pdf") {
      // Tentativa best-effort: lê como texto (muitos PDFs têm texto extraível assim)
      // Para PDFs reais com camada de texto, isso funciona parcialmente
      try {
        const buf = await readAsArrayBuffer(file);
        const raw = new TextDecoder("utf-8").decode(buf);
        // Heurística: extrai strings entre parênteses (comum em PDFs)
        const matches = raw.match(/\(([^\)]{3,200})\)/g);
        if (matches && matches.length > 3) {
          base.textContent = matches.map((m) => m.slice(1, -1)).join("\n").slice(0, 50000);
        } else {
          base.textContent = raw.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, " ").replace(/\s{2,}/g, " ").slice(0, 50000);
          if (base.textContent.trim().length < 20) {
            base.textContent = `[PDF ${file.name} — não foi possível extrair texto automaticamente. Tente copiar o conteúdo manualmente.]`;
          }
        }
      } catch {
        base.textContent = `[PDF ${file.name} — falha na extração]`;
      }
      base.status = "ready";
      return base;
    }

    if (ext === "docx") {
      // DOCX é ZIP com XML — extração simples
      try {
        const buf = await readAsArrayBuffer(file);
        const raw = new TextDecoder("utf-8").decode(buf);
        const texts = Array.from(raw.matchAll(/<w:t[^>]*>([^<]+)<\/w:t>/g)).map((m) => m[1]);
        if (texts.length) base.textContent = texts.join(" ").slice(0, 80000);
        else base.textContent = `[DOCX ${file.name} — conteúdo não extraído]`;
      } catch {
        base.textContent = `[DOCX ${file.name} — falha na extração]`;
      }
      base.status = "ready";
      return base;
    }

    // ZIP e outros binários: apenas referencia
    if (ext === "zip" || ext === "rar" || ext === "7z") {
      base.textContent = `[Arquivo ${file.name} (${(file.size / 1024).toFixed(1)} KB) — formato binário, não injetado no contexto.]`;
      base.status = "ready";
      return base;
    }

    // Fallback: tenta ler como texto
    try {
      const t = await readAsText(file);
      if (t.trim().length > 0 && !t.includes("\u0000")) {
        base.textContent = t.slice(0, 80000);
      } else {
        base.textContent = `[Arquivo ${file.name} — binário, não extraído]`;
      }
    } catch {
      base.textContent = `[Arquivo ${file.name} — não foi possível ler]`;
    }
    base.status = "ready";
    return base;
  } catch (e: unknown) {
    base.status = "error";
    base.error = e instanceof Error ? e.message : String(e);
    return base;
  }
}

export function attachmentToContextBlock(a: Attachment): string {
  if (a.dataUrl) return `[Imagem anexada: ${a.name}]`;
  if (a.textContent) return `\n\n--- Arquivo: ${a.name} ---\n${a.textContent}\n--- Fim de ${a.name} ---\n`;
  return `\n[Arquivo: ${a.name}]\n`;
}
