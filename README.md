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
| `IMAGE_GENERATION_URL` | `http://localhost:8000` (image generation sidecar; overridable per-request from Settings) |

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

## File upload (PDF, text, Markdown, CSV, JSON)

The composer's paperclip button uploads a document to `POST /api/upload`
(`src/app/api/upload/route.ts`), which accepts `application/pdf`, `text/plain`,
`text/markdown`, `text/csv`, and `application/json` up to 10MB. PDFs are parsed
with `unpdf`; other types are read as UTF-8 text. The extracted text comes back
as `{ text, fileName, pageCount }`, is held client-side as a `fileAttachment`,
and `/api/chat` appends it to the last user message before it reaches Ollama.
This is a plain text-extraction pipeline — it has nothing to do with images.

## Image analysis (vision)

Attach images to a chat message via the composer's image button, paste, or
drag-and-drop (up to 4 per message, PNG/JPEG/WebP/GIF). They're stored as
base64 and forwarded on Ollama's native `images` field.

`qwen3:8b` is text-only, so `src/app/api/chat/route.ts` guards this: if any
message carries images and the selected model's name doesn't contain `vl`,
`vision`, `llava`, or `moondream`, the request is rejected before it reaches
Ollama with a message telling you to install a vision model. To use it:

```bash
ollama pull qwen3-vl:8b
```

then select it in Settings → Local model. This check is a capability gate, not
a content filter — there is no safety/moderation layer in this app.

## Image generation

The composer has a Chat/Image mode toggle, shown once **Settings → Image
generation** is turned on. Prompts in Image mode go to `POST
/api/generate-image` (`src/app/api/generate-image/route.ts`), which proxies to
a separate local Python service — not Ollama — running
[SDXL-Turbo](https://huggingface.co/stabilityai/sdxl-turbo) via HuggingFace
`diffusers`. SDXL-Turbo is fully open and ungated — no HuggingFace account or
access token needed (unlike FLUX.1-schnell, which requires accepting a
license on huggingface.co and is not what this app uses):

```bash
python-server\start.bat
```

The first run downloads the model weights (~7GB) and creates a virtualenv
from `python-server/requirements.txt` (torch, diffusers, transformers,
accelerate, fastapi, uvicorn). SDXL-Turbo is distilled for fast, few-step
generation at 512×512 (requests are capped at 768×768 and rounded to a
multiple of 8); CPU-only generation takes roughly 20-60s per image, a CUDA GPU
brings that down to about a second. The sidecar URL defaults to
`http://localhost:8000` and is configurable per-browser in Settings, which
also shows a live "Image service" status readout.

## Project structure

```
src/
├─ app/
│  ├─ api/chat/route.ts           Chat endpoint → Ollama (text + vision)
│  ├─ api/health/route.ts         Ollama connection status
│  ├─ api/upload/route.ts         PDF/text file → extracted text
│  ├─ api/generate-image/route.ts Proxy to the Python image-generation sidecar
│  ├─ layout.tsx                  Root layout + WorkspaceProvider
│  ├─ globals.css                 Theme tokens, Markdown styles
│  └─ page.tsx
├─ components/
│  ├─ chat/                  Message list, bubbles, Markdown, composer
│  ├─ layout/                Sidebar, app shell
│  ├─ ui/                    Icons, model status badge
│  └─ views/                 Settings, roadmap screens
├─ context/WorkspaceProvider.tsx   Conversations, settings, request lifecycle
├─ hooks/                    useModelStatus, useImageServiceStatus, useIsHydrated
└─ lib/                      config, ollama client, system prompt, storage, types

python-server/    FastAPI + FLUX.1-schnell sidecar for image generation (optional, separate runtime)
```

## Storage

Conversations and settings are kept in this browser's `localStorage`
(`src/lib/storage.ts`). Clearing site data clears the history. The read/write
surface is four functions, so it can be swapped for a database later without
touching any component.

## Not built yet (v1 scope)

Projects and the Knowledge Base are placeholders that say so on screen. Chat,
PDF upload, image analysis (vision), and image generation are all implemented
— see the sections above. Still planned for later versions: Google Docs
integration, RAG over a vector database, project workspaces, DOCX/PDF export,
and long-term memory.
