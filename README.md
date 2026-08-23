# Mahdee AI

A private, personal AI workspace. Everything runs locally: the UI is a Next.js
app and the model is `qwen3:8b` served by [Ollama](https://ollama.com) on your
own machine. No accounts, no cloud calls, no data leaving the computer.

## Requirements

- Node.js 20+
- Ollama running locally with the model installed:

```bash
ollama serve
ollama pull qwen3:8b
```

## Running

```bash
npm install
npm run dev
```

Then open the URL printed in the terminal (http://localhost:3000, or the next
free port if 3000 is already taken).

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |

## Configuration

Copy `.env.local.example` to `.env.local` to change any of these:

| Variable | Default |
| --- | --- |
| `OLLAMA_BASE_URL` | `http://localhost:11434` |
| `OLLAMA_MODEL` | `qwen3:8b` |
| `OLLAMA_TIMEOUT_MS` | `180000` |
| `OLLAMA_KEEP_ALIVE` | `30m` |

These are read on the server only — the Ollama endpoint never reaches the browser.

## Speed

Generation speed is set by your hardware. Check what Ollama is using:

```bash
ollama ps
```

`100% CPU` means there is no GPU acceleration available, which for an 8B model
means roughly 3–4 tokens per second. The app is built around that:

- **Replies stream token by token**, so text starts appearing in a few seconds
  instead of after the whole answer is generated.
- **Deep thinking is off by default.** Qwen3 is a reasoning model and will
  otherwise produce several hundred tokens of chain-of-thought before its first
  visible word. Turn it on in Settings when you want a more considered answer.
- **The model is kept loaded** (`keep_alive`, refreshed by each health poll) so
  you don't pay the load time again after a pause.
- **Only the last 16 messages** are sent as context — every token of history has
  to be re-read before the model can answer, so long threads get slower. Start a
  new chat when you change topic.

Measured on an i5-10400, CPU-only, for a short question:

| | first visible text | full reply |
| --- | --- | --- |
| Fast replies (default) | ~3s | ~17s |
| Deep thinking | ~52s | ~67s |

If that is still too slow, a smaller model is the remaining lever —
`ollama pull qwen3:4b` and pick it in Settings.

## How the Ollama connection works

The browser never talks to Ollama directly (that would mean CORS problems and
an exposed endpoint). Instead:

```
Browser  ──POST /api/chat──▶  Next.js route handler  ──POST /api/chat──▶  Ollama
                                                                          qwen3:8b
```

`src/app/api/chat/route.ts` validates the incoming messages, prepends the
Mahdee AI system prompt, forwards the last 16 turns as conversation context, and
calls Ollama with `stream: true`. Tokens are relayed to the browser as
newline-delimited JSON events:

```
{"type":"delta","text":"…"}       visible answer tokens
{"type":"reasoning","text":"…"}   chain-of-thought (deep thinking only)
{"type":"done","durationMs":n}
{"type":"error","error":"…","code":"…"}
```

Reasoning is kept separate from the answer and is never sent back as context.
Failures that happen before the first token are returned as a normal JSON error
response with a real status code, so a stopped Ollama still produces a clear
message rather than an empty stream.

`src/app/api/health/route.ts` polls `/api/tags` so the header can show whether
the local model is reachable.

## Project structure

```
src/
├─ app/
│  ├─ api/chat/route.ts      Chat endpoint → Ollama
│  ├─ api/health/route.ts    Connection status
│  ├─ layout.tsx             Root layout + WorkspaceProvider
│  ├─ globals.css            Theme tokens, Markdown styles
│  └─ page.tsx
├─ components/
│  ├─ chat/                  Message list, bubbles, Markdown, composer
│  ├─ layout/                Sidebar, app shell
│  ├─ ui/                    Icons, model status badge
│  └─ views/                 Settings, roadmap screens
├─ context/WorkspaceProvider.tsx   Conversations, settings, request lifecycle
├─ hooks/                    useModelStatus, useIsHydrated
└─ lib/                      config, ollama client, system prompt, storage, types
```

## Storage

Conversations and settings are kept in this browser's `localStorage`
(`src/lib/storage.ts`). Clearing site data clears the history. The read/write
surface is four functions, so it can be swapped for a database later without
touching any component.

## Not built yet (v1 scope)

Projects and the Knowledge Base are placeholders that say so on screen. Planned
for later versions: PDF upload and analysis, Google Docs integration, RAG over a
vector database, project workspaces, image generation, DOCX/PDF export, and
long-term memory.
