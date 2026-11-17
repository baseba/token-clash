import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { GameWsAdapter } from './realtime/game-ws.adapter.js';
import { AppConfig } from './shared/config/app-config.js';
import { explainBodyErrors, MAX_BODY_MB } from './shared/http/json-body.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const config = app.get(AppConfig);
  app.disable('x-powered-by');
  app.set('etag', false);
  // Every request body is JSON (the frontend always sends JSON), whatever its Content-Type says.
  app.useBodyParser('json', { limit: `${MAX_BODY_MB}mb`, type: () => true });
  app.use(explainBodyErrors);
  // A request without a body reads as {} (the handlers never have to check for undefined).
  app.use((req: { body?: unknown }, _res: unknown, next: () => void) => {
    req.body ??= {};
    next();
  });
  app.useWebSocketAdapter(new GameWsAdapter(app));
  // SIGTERM (podman stop, systemd) closes the app: sockets, timers and the database.
  app.enableShutdownHooks();
  await app.listen(config.port, config.host);
  new Logger('TokenClash').log(`token-clash escuchando en http://${config.host}:${config.port}`);
}

await bootstrap();
