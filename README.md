## x402-payment-compatibility-copilot

Preflight analyzer for x402 payment compatibility using a Playbook-aligned **Node + Hono** backend.

Migration status: backend references to Lucid/Daydreams removed.

It evaluates route/payment config before deploy and returns:
- risk score (0–100)
- prioritized breakpoints
- concrete remediation steps
- patch suggestions you can paste into your app

---

## Endpoints

### 1) `preflight-x402-free` (free summary)
- **Invoke path:** `/entrypoints/preflight-x402-free/invoke`
- **Returns:** compact summary (`riskScore`, `verdict`, severity counts)

### 2) `preflight-x402` (deep report)
- **Invoke path:** `/entrypoints/preflight-x402/invoke`
- **Returns:** full report (breakpoints, remediation, patch suggestions, local invoke examples)

### 3) Direct local route
- **Path:** `/api/preflight-x402`
- **Returns:** same full report as deep entrypoint

---

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

Server runs on `http://localhost:3000`.

---

## Local invoke examples

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
        { "path": "/api/research", "method": "POST", "requiresX402": true, "priceUsd": 0.03 }
      ]
    }
  }'
```

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

## Scripts

- `npm run dev` – watch mode
- `npm run build` – compile to `dist/`
- `npm run start` – run compiled server
- `npm run type-check` – TypeScript check
