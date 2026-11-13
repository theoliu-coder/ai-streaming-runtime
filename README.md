# AI Streaming Runtime + Observability

A TypeScript monorepo for developing an AI streaming runtime and exploring frontend streaming performance and observability.

**Stage 1 is complete:** a Vue playground sends single-turn, non-streaming chat requests through an Express server to the DeepSeek API. Streaming transport, SSE parsing, runtime state management, observability, and reusable SDK packages are planned, not implemented.

## Implemented Features

- Prompt validation: non-empty text after trimming, up to 4,000 UTF-16 code units; extra request fields are rejected by the server.
- Playground interaction: loading feedback, duplicate-submission prevention, plain-text model replies, and persistent error messages.
- Server validation: JSON parsing, a 16 KB request-body limit, normalized errors, and rejection of empty or incomplete model replies.
- Timeouts: a 30-second upstream SDK timeout with retries disabled, and a 40-second browser timeout.
- Cancellation: the browser request is aborted when the component unmounts. This does not automatically cancel the server's upstream request; there is no user-facing cancel button yet.
- Development foundation: pnpm Workspace, shared TypeScript versions through Catalogs, ESLint, Prettier, and a Vite API proxy.

Each request contains one user message. Conversation history is not retained or sent to the model.

## Tech Stack

| Area                   | Technologies                                                         |
| ---------------------- | -------------------------------------------------------------------- |
| Frontend               | Vue 3, TypeScript, Vite, Element Plus                                |
| Backend                | Node.js, Express 5, TypeScript, Zod                                  |
| Model integration      | DeepSeek Chat Completions API via the OpenAI-compatible `openai` SDK |
| Workspace              | Corepack, pnpm Workspace, pnpm Catalogs                              |
| Development and checks | tsx, vue-tsc, ESLint, Prettier                                       |

## Getting Started

### Prerequisites

- Node.js matching the applications' engines: `^22.22.2 || ^24.15.0 || >=26.0.0`.
- Corepack and pnpm `10.34.9`, as pinned in the root `packageManager` field.
- A DeepSeek API key with access to the configured model. Requests may incur API charges.

### Install Dependencies

Run from the repository root:

```bash
corepack enable
pnpm install --frozen-lockfile
```

### Configure the Server

Create `apps/server/.env` with your own key:

```dotenv
DEEPSEEK_API_KEY=your_deepseek_api_key
```

The server development script loads this file using Node.js `--env-file=.env`; the file must exist before startup. It is ignored by Git. Keep the key on the server and never put it in a `VITE_*` variable or frontend source file.

The base URL (`https://api.deepseek.com`) and model (`deepseek-flash`) are configured in `apps/server/src/deepseek.ts`, not through environment variables.

### Start the Applications

Start the backend from the repository root:

```bash
pnpm dev:server
```

The server listens on `http://127.0.0.1:3000`.

In a second terminal, start the playground:

```bash
pnpm dev:web
```

Open the URL printed by Vite, typically `http://localhost:5173`. Enter a prompt and select the submit button (currently labeled in Chinese).

The playground calls the relative `/api/chat` endpoint. Vite forwards `/api` requests to `http://127.0.0.1:3000` without changing the path. This development proxy is not a production deployment configuration.

## API Usage

These examples call Express directly. With both development servers running, the same paths are available through the Vite origin; use the actual port printed by Vite.

### GET `/api/health`

```bash
curl http://127.0.0.1:3000/api/health
```

Returns HTTP `200`:

```json
{
  "status": "ok",
  "service": "ai-runtime-server"
}
```

This endpoint checks server availability, not API-key validity or DeepSeek connectivity.

### POST `/api/chat`

Send a JSON object containing only `prompt`. The server trims leading and trailing whitespace and requires a length between 1 and 4,000 UTF-16 code units. The entire JSON body must also fit within 16 KB.

```bash
curl --request POST http://127.0.0.1:3000/api/chat \
  --header 'Content-Type: application/json' \
  --data '{"prompt":"Explain server-sent events in one sentence."}'
```

Returns HTTP `200` with the following structure. Reply text, model identifiers, and token counts depend on the upstream response; these values are illustrative:

```json
{
  "reply": "Server-sent events let a server push updates to a client over an HTTP connection.",
  "model": "deepseek-flash",
  "usage": {
    "promptTokens": 12,
    "completionTokens": 19,
    "totalTokens": 31
  }
}
```

Each usage field is a non-negative safe integer or `null` when unavailable or invalid. The server accepts only non-empty text with `finish_reason: "stop"`; truncated and other incomplete replies are returned as errors. The playground displays replies as plain text.

### Error Responses

Handled API errors use English codes and messages:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "A non-empty prompt of at most 4000 characters is required."
  }
}
```

| HTTP status | Error codes                                                                                               | Meaning                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `400`       | `INVALID_REQUEST`, `INVALID_JSON`                                                                         | Invalid prompt, extra fields, or malformed JSON                      |
| `413`       | `PAYLOAD_TOO_LARGE`                                                                                       | Request body exceeds 16 KB                                           |
| `415`       | `UNSUPPORTED_ENCODING`                                                                                    | Unsupported body encoding or charset                                 |
| `429`       | `UPSTREAM_RATE_LIMITED`                                                                                   | Upstream rate limit                                                  |
| `500`       | `INTERNAL_ERROR`                                                                                          | Local configuration or unexpected error, including a missing API key |
| `502`       | `UPSTREAM_CONNECTION_ERROR`, `UPSTREAM_ERROR`                                                             | Connection failure or another upstream API error                     |
| `502`       | `INVALID_MODEL_RESPONSE`, `EMPTY_MODEL_RESPONSE`, `MODEL_RESPONSE_TRUNCATED`, `MODEL_RESPONSE_INCOMPLETE` | Missing, empty, truncated, or incomplete model output                |
| `504`       | `UPSTREAM_TIMEOUT`                                                                                        | Upstream SDK timeout                                                 |

Clients must check the HTTP status and handle network failures or non-JSON responses separately. Upstream authentication failures map to `502`, not client authentication errors. Browser-side timeout and cancellation are handled locally rather than as API error responses.

## Project Structure

```text
ai-streaming-runtime/
├── apps/
│   ├── playground/
│   │   ├── src/
│   │   │   ├── App.vue              # Prompt submission and response UI
│   │   │   ├── main.ts
│   │   │   ├── auto-imports.d.ts    # Generated API import declarations
│   │   │   ├── components.d.ts      # Generated component declarations
│   │   │   └── styles/global.css
│   │   └── vite.config.ts          # Vue plugins and development API proxy
│   └── server/
│       └── src/
│           ├── index.ts             # Routes, validation, and error handling
│           └── deepseek.ts          # SDK client and model configuration
├── package.json
├── pnpm-workspace.yaml              # Workspace patterns and TypeScript Catalog
├── pnpm-lock.yaml
├── eslint.config.mjs
└── README.md
```

No SDK packages exist yet. The `packages/*` workspace pattern is reserved for future work.

## Development Checks

Run from the repository root:

```bash
# Lint, formatting, and frontend/backend type checks
pnpm check

# Individual checks
pnpm lint
pnpm format:check
pnpm typecheck:web
pnpm typecheck:server

# Frontend production build, including type checking
pnpm --filter @ai-runtime/playground build
```

Frontend type checking can write incremental `.tsbuildinfo` files under `node_modules/.tmp`. The production build writes `apps/playground/dist`. Vite plugins generate the import and component declarations in `src`.

## Roadmap

Stage 1 is implemented. Stages 2–8 are unimplemented; their scopes below are provisional and may evolve as the runtime develops.

| Stage | Status   | Scope                                                         |
| ----- | -------- | ------------------------------------------------------------- |
| 1     | Complete | Single-turn, non-streaming Vue → Express → DeepSeek chat flow |
| 2     | Planned  | Streaming transport and incremental SSE parsing               |
| 3     | Planned  | Runtime lifecycle and finite-state machine (FSM)              |
| 4     | Planned  | Session state and request lifecycle management                |
| 5     | Planned  | Vue integration for runtime state and streaming output        |
| 6     | Planned  | Streaming rendering and performance optimization              |
| 7     | Planned  | Observability, performance metrics, and tracing               |
| 8     | Planned  | Reusable SDK packaging, documentation, and release readiness  |

## License

[MIT](./LICENSE).
