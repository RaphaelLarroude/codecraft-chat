// Storage: LocalStorage (sync) + IndexedDB (conversas grandes)
import { openDB, type DBSchema } from "idb";
import type { Conversation, AppSettings } from "./types";
import { DEFAULT_SETTINGS, LS_SETTINGS_KEY, LS_CONVERSATIONS_KEY } from "./types";

interface CCDB extends DBSchema {
  conversations: { key: string; value: Conversation };
  meta: { key: string; value: unknown };
}

let dbPromise: ReturnType<typeof openDB<CCDB>> | null = null;
function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<CCDB>("codecraft-chat", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("conversations")) db.createObjectStore("conversations");
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      },
    });
  }
  return dbPromise;
}

// ── Settings (LocalStorage) ──
export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(LS_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: AppSettings) {
  localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(s));
}

// ── Conversations ──
// Mantém LS como fallback/mirror, mas fonte principal é IndexedDB
export async function loadConversations(): Promise<Conversation[]> {
  // Tenta IndexedDB primeiro
  try {
    const db = await getDB();
    const all = await db.getAll("conversations");
    if (all.length > 0) return all.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {}
  // Fallback LocalStorage
  try {
    const raw = localStorage.getItem(LS_CONVERSATIONS_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as Conversation[];
      // migra para IndexedDB
      const db = await getDB();
      const tx = db.transaction("conversations", "readwrite");
      for (const c of arr) await tx.store.put(c, c.id);
      await tx.done;
      return arr;
    }
  } catch {}
  return [];
}

export async function saveConversation(c: Conversation) {
  c.updatedAt = Date.now();
  // IndexedDB
  try {
    const db = await getDB();
    await db.put("conversations", c, c.id);
  } catch {}
  // Mirror LS (best-effort, pode estourar quota — ignora erro)
  try {
    const all = await loadConversations();
    const idx = all.findIndex((x) => x.id === c.id);
    if (idx >= 0) all[idx] = c;
    else all.unshift(c);
    localStorage.setItem(LS_CONVERSATIONS_KEY, JSON.stringify(all));
  } catch {}
}

export async function deleteConversation(id: string) {
  try {
    const db = await getDB();
    await db.delete("conversations", id);
  } catch {}
  try {
    const raw = localStorage.getItem(LS_CONVERSATIONS_KEY);
    if (raw) {
      const arr = (JSON.parse(raw) as Conversation[]).filter((c) => c.id !== id);
      localStorage.setItem(LS_CONVERSATIONS_KEY, JSON.stringify(arr));
    }
  } catch {}
}

export async function saveAllConversations(list: Conversation[]) {
  try {
    const db = await getDB();
    const tx = db.transaction("conversations", "readwrite");
    await tx.store.clear();
    for (const c of list) await tx.store.put(c, c.id);
    await tx.done;
  } catch {}
  try {
    localStorage.setItem(LS_CONVERSATIONS_KEY, JSON.stringify(list));
  } catch {}
}
