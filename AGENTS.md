# AGENTS.md

## Project
`x402-payment-compatibility-copilot` is a Bun + TypeScript service that analyzes x402 payment-route compatibility.

## Runtime
- HTTP framework: `hono`
- Validation: `zod`
- Package manager/runtime: `bun`

## Commands
```bash
bun install
bun run dev
bun run start
bun run type-check
bun run build
bun run register
bun run verify-registry
```

## API routes
- `POST /entrypoints/preflight-x402-free/invoke`
- `POST /entrypoints/preflight-x402/invoke`
- `POST /api/preflight-x402`
- `GET /health`

## Notes
- Keep project logic focused on x402 preflight analysis.
- Do not introduce Daydreams/Lucid-specific packages or conventions.
