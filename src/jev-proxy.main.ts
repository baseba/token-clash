// Entry point of the Jev egress proxy (its own container: deploy/token-clash-jev.container).
//   node dist/src/jev-proxy.main.js
import { createJevProxy, JEV_UPSTREAM } from './combat/infrastructure/jev/jev-proxy.js';

const port = Number(process.env.PORT || 8081);
createJevProxy({ apiKey: process.env.JEV_API_KEY, upstream: process.env.JEV_UPSTREAM || JEV_UPSTREAM }).listen(port, '0.0.0.0', () =>
  console.log(`jev-proxy escuchando en :${port}`),
);
// As PID 1 in the container, Node has no default SIGTERM handler: without this, stopping waits it out.
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => process.exit(0));
