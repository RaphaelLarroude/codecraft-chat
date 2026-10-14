# CodeCraft Chat

Chat com IA moderno e completo conectado à **CodeCraft API** — streaming em tempo real, upload universal de arquivos, voz e histórico persistente.

![Next.js](https://img.shields.io/badge/Next.js-14-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-3-38bdf8) ![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Funcionalidades

- **CodeCraft API** — insira sua API Key nas configurações, detecção automática de modelos via `GET /v1/models`
- **Streaming** — respostas em tempo real via `POST /v1/chat/completions` (SSE)
- **Markdown completo** — syntax highlight, botão copiar código, tabelas, GFM
- **Custo por conversa** — `usage` (prompt/completion/total) + pricing por modelo, exibição em USD com 6 casas decimais
- **Upload universal** — drag & drop de qualquer arquivo (PDF, DOCX, TXT, CSV, XLSX, ZIP, imagens, código .py/.js...), imagens via vision, documentos com extração de texto no front-end
- **Voz** — microfone (Web Speech API) + ouvir resposta (Text-to-Speech)
- **Histórico** — LocalStorage + IndexedDB, favoritar, renomear, buscar, deletar, exportar para JSON / TXT / PDF
- **Design** — moderno, minimalista, Dark/Light Mode, totalmente responsivo

## 🚀 Como rodar

```bash
npm install
npm run dev
# abra http://localhost:3000
```

Configure sua **API Key** e **Base URL** em ⚙️ Configurações (ex: `https://api.codecraft.ai`).

## 🛠️ Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** + **Lucide Icons**
- **react-markdown** + **rehype-highlight**
- **idb** (IndexedDB) + **jspdf**

## 📦 Build

```bash
npm run build
npm start
```

## 📄 Licença

MIT
