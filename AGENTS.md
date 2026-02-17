# x402-payment-compatibility-copilot

## Backend Stack

This service uses the active Playbook-aligned backend stack:
- Node.js + TypeScript
- Hono (`hono`, `@hono/node-server`)
- Zod for request validation

Service implementation follows the active Playbook backend stack only.

## Service Endpoints

- `GET /health`
- `POST /entrypoints/preflight-x402-free/invoke`
- `POST /entrypoints/preflight-x402/invoke`
- `POST /api/preflight-x402`

## Local Development

```bash
npm install
npm run dev
```

## Validation Checklist

```bash
npm run type-check
npm run build
npm run start
# then curl /health and preflight endpoints
```
