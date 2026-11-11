# AI Streaming Runtime

A TypeScript-based monorepo for developing a lightweight AI streaming runtime and exploring frontend streaming performance and observability.

The project is currently in its **initial development stage**. The Vue playground and Express server are set up, and the basic HTTP communication between them has been verified.

## Current Features

- **Monorepo setup:** pnpm Workspace with Corepack and shared TypeScript dependency management through pnpm Catalogs.
- **Vue playground:** Vue 3, TypeScript, Vite, and Element Plus with component auto-import configuration.
- **Local prompt interaction:** A prompt input form with validation, local submission feedback, and result display.
- **Express server:** A Node.js and TypeScript HTTP server with a health-check endpoint.
- **Development API proxy:** Vite forwards `/api` requests to the local Express server.
- **Code quality tooling:** Shared ESLint, Prettier, and TypeScript checks.

The playground currently handles prompt submissions locally. It does not send prompts to an AI model.

## Tech Stack

| Category           | Technologies                          |
| ------------------ | ------------------------------------- |
| Frontend           | Vue 3, TypeScript, Vite, Element Plus |
| Backend            | Node.js, Express 5, TypeScript        |
| Package Management | pnpm Workspace, Corepack              |
| Development Tools  | tsx, vue-tsc                          |
| Code Quality       | ESLint, Prettier                      |

## Project Structure

```text
ai-streaming-runtime/
├── apps/
│   ├── playground/          # Vue 3 playground application
│   │   └── src/
│   │       ├── App.vue
│   │       ├── main.ts
│   │       └── styles/
│   │           └── global.css
│   └── server/              # Express HTTP server
│       └── src/
│           └── index.ts
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── eslint.config.mjs
└── README.md
```

## Getting Started

### Prerequisites

- Node.js `22.22.2+` (Node.js 22.x), or another version supported by the workspace's `engines` configuration
- Corepack
- pnpm `10.34.9`

### Install Dependencies

From the repository root:

```bash
corepack enable
pnpm install
```

### Start the Backend

```bash
pnpm --filter @ai-runtime/server dev
```

The Express server listens on `http://127.0.0.1:3000`.

### Start the Playground

In a separate terminal:

```bash
pnpm --filter @ai-runtime/playground dev
```

Open the local URL displayed by Vite (typically `http://localhost:5173`).

### Verify the API

The server currently provides one HTTP endpoint:

**GET `/api/health`**

```bash
curl http://127.0.0.1:3000/api/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "ai-runtime-server"
}
```

With both development servers running, the same endpoint is accessible through the Vite development proxy:

```text
http://localhost:5173/api/health
```

Use the actual Vite port if it differs from `5173`.

## Development Checks

Run the shared checks from the repository root:

```bash
pnpm check
```

To run individual checks:

```bash
# ESLint
pnpm lint

# Prettier
pnpm format:check

# Backend type checking
pnpm --filter @ai-runtime/server type-check

# Frontend type checking
pnpm --filter @ai-runtime/playground type-check

# Frontend production build
pnpm --filter @ai-runtime/playground build
```

## Project Status

**Current stage: Frontend and backend foundation completed.**

The Vue playground, Express health-check endpoint, and Vite development proxy have been configured. Frontend production build, health-check requests, and development proxy connectivity have been verified.

AI model integration and the streaming runtime are not implemented yet.

## License

See [LICENSE](./LICENSE).
