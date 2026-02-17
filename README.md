## x402-payment-compatibility-copilot

Preflight analyzer for x402 payment compatibility.

It evaluates route/payment config before deploy and returns:
- risk score (0–100)
- prioritized breakpoints
- concrete remediation steps
- patch suggestions you can paste into your app

---

## Endpoints + pricing

### 1) `preflight-x402-free` (free)
- **Entrypoint key:** `preflight-x402-free`
- **Invoke path:** `/entrypoints/preflight-x402-free/invoke`
- **Price:** `$0.00`
- **Returns:** compact summary (`riskScore`, `verdict`, severity counts)

### 2) `preflight-x402` (paid)
- **Entrypoint key:** `preflight-x402`
- **Invoke path:** `/entrypoints/preflight-x402/invoke`
- **Price:** `$0.03`
- **Returns:** full deep report (breakpoints, remediation, patch suggestions, local invoke examples)

### 3) Direct local route (no x402 wrapper)
- **Path:** `/api/preflight-x402`
- **Price:** local/dev route, no paid wrapper
- **Returns:** same full report as paid entrypoint

---

## Quick start

```bash
cp .env.example .env
bun install
bun run dev
```

Server runs on `http://localhost:3000`.

---

## Local invoke examples

### Free entrypoint (summary)

```bash
curl -s http://localhost:3000/entrypoints/preflight-x402-free/invoke \
  -H 'Content-Type: application/json' \
  -d '{
    "input": {
      "appName": "demo-api",
      "routes": [
        { "path": "/api/research", "method": "POST", "requiresX402": true, "priceUsd": 0.03 },
        { "path": "/health", "method": "GET", "requiresX402": false }
      ]
    }
  }'
```

### Paid entrypoint (deep report)

```bash
curl -s http://localhost:3000/entrypoints/preflight-x402/invoke \
  -H 'Content-Type: application/json' \
  -d '{
    "input": {
      "appName": "demo-api",
      "network": "base",
      "facilitatorUrl": "https://facilitator.example.com",
      "receivableAddress": "0x1111111111111111111111111111111111111111",
      "routes": [
        { "path": "/api/research", "method": "POST", "requiresX402": true, "priceUsd": 0.03 },
        { "path": "/api/signal", "method": "POST", "requiresX402": true, "priceUsd": 0.05 }
      ]
    }
  }'
```

### Direct local API route

```bash
curl -s http://localhost:3000/api/preflight-x402 \
  -H 'Content-Type: application/json' \
  -d '{
    "appName": "demo-api",
    "routes": [
      { "path": "/api/research", "method": "POST", "requiresX402": true, "priceUsd": 0.03 }
    ]
  }'
```

---

## Sample pricing strategy

Use `$0.03` as baseline and adjust per endpoint value:

- `POST /api/research` → `$0.03`
- `POST /api/signal` → `$0.05`
- `POST /api/premium-report` → `$0.10`

Keep price explicit on every paid route (`requiresX402: true` + `priceUsd > 0`).

---

## Environment

Set these for realistic preflight checks:

- `NETWORK` (example: `base`)
- `FACILITATOR_URL` (example: `https://facilitator.example.com`)
- `PAYMENTS_RECEIVABLE_ADDRESS` (EVM address)

---

## Scripts

- `bun run dev` – run with watch mode
- `bun run start` – run once
- `bun run build` – build to `dist/`
- `bun run type-check` – TypeScript check
