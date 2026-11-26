import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app/app.module.js';
import { GameWsAdapter } from './realtime/game-ws.adapter.js';
import { AppConfig } from './platform/config/app-config.js';
import { useJsonBody } from './platform/http/json-body.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const config = app.get(AppConfig);
  app.disable('x-powered-by');
  app.set('etag', false);
  useJsonBody(app);
  app.useWebSocketAdapter(new GameWsAdapter(app));
  app.enableShutdownHooks();
  await app.listen(config.port, config.host);
  new Logger('TokenClash').log(`token-clash escuchando en http://${config.host}:${config.port}`);
}

await bootstrap();
