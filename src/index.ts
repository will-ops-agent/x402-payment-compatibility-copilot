import { serve } from '@hono/node-server';
import { app } from './lib/agent.js';

const port = Number(process.env.PORT ?? 3000);

console.log(`Starting x402 payment compatibility copilot on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
});
