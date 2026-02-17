import { Hono } from 'hono';
import { z } from 'zod';

type Severity = 'low' | 'medium' | 'high';

type Breakpoint = {
  severity: Severity;
  code: string;
  finding: string;
  impact: string;
  remediation: string;
  patchSuggestion: string;
  route?: {
    method: string;
    path: string;
  };
};

const routeSchema = z.object({
  path: z.string().min(1),
  method: z.string().default('POST'),
  requiresX402: z.boolean().default(false),
  priceUsd: z.number().min(0).optional(),
  network: z.string().optional(),
  facilitatorUrl: z.string().url().optional(),
  receivableAddress: z.string().optional(),
});

const preflightInputSchema = z.object({
  appName: z.string().min(1).default('unknown-app'),
  network: z.string().optional(),
  facilitatorUrl: z.string().url().optional(),
  receivableAddress: z.string().optional(),
  routes: z.array(routeSchema).min(1),
});

const invokeEnvelopeSchema = z.object({
  input: preflightInputSchema,
});

const DEFAULT_BASELINE_PRICE_USD = 0.03;
const DEFAULT_NETWORK = 'base';
const DEFAULT_FACILITATOR_URL = 'https://facilitator.example.com';

const makePatch = (routePath: string, routeMethod: string, price = DEFAULT_BASELINE_PRICE_USD) => `// Example x402 guard for ${routeMethod.toUpperCase()} ${routePath}
app.${routeMethod.toLowerCase()}("${routePath}", x402({
  network: process.env.NETWORK ?? "${DEFAULT_NETWORK}",
  facilitatorUrl: process.env.FACILITATOR_URL ?? "${DEFAULT_FACILITATOR_URL}",
  payTo: process.env.PAYMENTS_RECEIVABLE_ADDRESS,
  priceUsd: ${price},
}), handler);
`;

const envPatch = `# x402 runtime defaults\nexport NETWORK=${DEFAULT_NETWORK}\nexport FACILITATOR_URL=${DEFAULT_FACILITATOR_URL}\nexport PAYMENTS_RECEIVABLE_ADDRESS=0xYour40HexAddress`;

const validEvmAddress = (value?: string) => !!value && /^0x[a-fA-F0-9]{40}$/.test(value);

function analyzePreflight(input: z.infer<typeof preflightInputSchema>) {
  const breakpoints: Breakpoint[] = [];

  const topLevelNetwork = input.network ?? process.env.NETWORK;
  const topLevelFacilitator = input.facilitatorUrl ?? process.env.FACILITATOR_URL;
  const topLevelReceivable = input.receivableAddress ?? process.env.PAYMENTS_RECEIVABLE_ADDRESS;

  if (!topLevelNetwork) {
    breakpoints.push({
      severity: 'high',
      code: 'MISSING_NETWORK',
      finding: 'No x402 network configured.',
      impact: 'Payment verification may fail across all paid routes.',
      remediation: 'Set NETWORK (e.g. base, base-sepolia, ethereum) and keep it consistent.',
      patchSuggestion: envPatch,
    });
  }

  if (!topLevelFacilitator) {
    breakpoints.push({
      severity: 'high',
      code: 'MISSING_FACILITATOR',
      finding: 'No facilitator URL configured.',
      impact: 'x402 proofs cannot be verified at runtime.',
      remediation: 'Configure FACILITATOR_URL.',
      patchSuggestion: envPatch,
    });
  }

  if (!validEvmAddress(topLevelReceivable)) {
    breakpoints.push({
      severity: 'high',
      code: 'INVALID_RECEIVABLE_ADDRESS',
      finding: 'PAYMENTS_RECEIVABLE_ADDRESS missing or invalid.',
      impact: 'Payments may fail to settle or settle to the wrong target.',
      remediation: 'Set a valid EVM address for receivables.',
      patchSuggestion: envPatch,
    });
  }

  for (const route of input.routes) {
    const method = route.method.toUpperCase();

    if (route.requiresX402 && (route.priceUsd === undefined || route.priceUsd <= 0)) {
      breakpoints.push({
        severity: 'high',
        code: 'PAID_ROUTE_WITHOUT_PRICE',
        finding: `${method} ${route.path} is marked paid but has no positive price.`,
        impact: 'Route policy is ambiguous and may fail closed/open unexpectedly.',
        remediation: 'Set explicit priceUsd > 0 for paid routes.',
        patchSuggestion: makePatch(route.path, route.method, DEFAULT_BASELINE_PRICE_USD),
        route: { method, path: route.path },
      });
    }

    if (!route.requiresX402 && route.priceUsd && route.priceUsd > 0) {
      breakpoints.push({
        severity: 'medium',
        code: 'FREE_ROUTE_WITH_PRICE',
        finding: `${method} ${route.path} has a price but is not marked requiresX402.`,
        impact: 'Developers may assume free access while clients are charged.',
        remediation: 'Either mark route as requiresX402 or remove price.',
        patchSuggestion: `// For ${method} ${route.path}: set requiresX402: true (or remove priceUsd).`,
        route: { method, path: route.path },
      });
    }

    if (route.requiresX402 && !route.facilitatorUrl && !topLevelFacilitator) {
      breakpoints.push({
        severity: 'high',
        code: 'ROUTE_MISSING_FACILITATOR',
        finding: `${method} ${route.path} is paid but has no facilitator configured.`,
        impact: 'Payment proof checks cannot execute.',
        remediation: 'Provide facilitatorUrl at route or top level.',
        patchSuggestion: makePatch(route.path, route.method, route.priceUsd ?? DEFAULT_BASELINE_PRICE_USD),
        route: { method, path: route.path },
      });
    }

    if (route.requiresX402 && !validEvmAddress(route.receivableAddress) && !validEvmAddress(topLevelReceivable)) {
      breakpoints.push({
        severity: 'high',
        code: 'ROUTE_MISSING_RECEIVABLE',
        finding: `${method} ${route.path} is paid but has no valid receivable address.`,
        impact: 'Successful payments cannot be safely settled.',
        remediation: 'Set route.receivableAddress or PAYMENTS_RECEIVABLE_ADDRESS to a valid EVM address.',
        patchSuggestion: makePatch(route.path, route.method, route.priceUsd ?? DEFAULT_BASELINE_PRICE_USD),
        route: { method, path: route.path },
      });
    }
  }

  const high = breakpoints.filter(b => b.severity === 'high').length;
  const medium = breakpoints.filter(b => b.severity === 'medium').length;
  const low = breakpoints.filter(b => b.severity === 'low').length;
  const paidRoutes = input.routes.filter(r => r.requiresX402).length;

  const weighted = high * 22 + medium * 10 + low * 4;
  const exposure = paidRoutes > 0 ? Math.min(12, paidRoutes * 2) : 0;
  const riskScore = Math.max(0, Math.min(100, weighted + exposure));

  const verdict =
    riskScore >= 70
      ? 'high-risk'
      : riskScore >= 35
      ? 'needs-hardening'
      : 'compatible';

  const prioritizedBreakpoints = [...breakpoints].sort((a, b) => {
    const rank = { high: 3, medium: 2, low: 1 } as const;
    return rank[b.severity] - rank[a.severity];
  });

  const remediationSteps = Array.from(new Set([
    'Normalize env: NETWORK, FACILITATOR_URL, PAYMENTS_RECEIVABLE_ADDRESS.',
    ...prioritizedBreakpoints.map(b => b.remediation),
    'Add integration test: unpaid call returns 402; paid call succeeds.',
    `Pin baseline paid endpoint pricing at $${DEFAULT_BASELINE_PRICE_USD.toFixed(2)} unless endpoint-specific override is justified.`,
  ]));

  const patchSuggestions = prioritizedBreakpoints.slice(0, 6).map((bp, idx) => ({
    id: `patch-${idx + 1}`,
    code: bp.code,
    severity: bp.severity,
    route: bp.route,
    suggestion: bp.patchSuggestion,
  }));

  return {
    appName: input.appName,
    baselinePriceUsd: DEFAULT_BASELINE_PRICE_USD,
    riskScore,
    riskModel: {
      formula: 'score = min(100, high*22 + medium*10 + low*4 + paidRouteExposure)',
      paidRouteExposure: exposure,
      paidRoutes,
      totalRoutes: input.routes.length,
    },
    summary: {
      totalBreakpoints: prioritizedBreakpoints.length,
      high,
      medium,
      low,
      verdict,
    },
    breakpoints: prioritizedBreakpoints,
    remediationSteps,
    patchSuggestions,
    localInvokeExamples: {
      freeEntrypoint: {
        endpoint: '/entrypoints/preflight-x402-free/invoke',
        command: `curl -s http://localhost:3000/entrypoints/preflight-x402-free/invoke \\\n  -H 'Content-Type: application/json' \\\n  -d '{\n    "input": {\n      "appName": "demo-api",\n      "routes": [\n        { "path": "/api/research", "method": "POST", "requiresX402": true, "priceUsd": 0.03 },\n        { "path": "/health", "method": "GET", "requiresX402": false }\n      ]\n    }\n  }'`,
      },
      directRoute: {
        endpoint: '/api/preflight-x402',
        command: `curl -s http://localhost:3000/api/preflight-x402 \\\n  -H 'Content-Type: application/json' \\\n  -d '{\n    "appName": "demo-api",\n    "routes": [\n      { "path": "/api/research", "method": "POST", "requiresX402": true, "priceUsd": 0.03 }\n    ]\n  }'`,
      },
    },
  };
}

const app = new Hono();

app.get('/health', c => c.json({ ok: true }));

app.post('/entrypoints/preflight-x402-free/invoke', async c => {
  const body = await c.req.json().catch(() => null);
  const parsed = invokeEnvelopeSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
  }

  const result = analyzePreflight(parsed.data.input);
  return c.json({
    output: {
      baselinePriceUsd: DEFAULT_BASELINE_PRICE_USD,
      riskScore: result.riskScore,
      verdict: result.summary.verdict,
      counts: {
        high: result.summary.high,
        medium: result.summary.medium,
        low: result.summary.low,
      },
    },
  });
});

app.post('/entrypoints/preflight-x402/invoke', async c => {
  const body = await c.req.json().catch(() => null);
  const parsed = invokeEnvelopeSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
  }

  return c.json({ output: analyzePreflight(parsed.data.input) });
});

app.post('/api/preflight-x402', async c => {
  const payload = await c.req.json().catch(() => null);
  const parsed = preflightInputSchema.safeParse(payload);

  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
  }

  return c.json(analyzePreflight(parsed.data));
});

export { app };
