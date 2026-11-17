import { Global, Module } from '@nestjs/common';
import { AppConfig } from './app-config.js';

/** AppConfig for everyone, read from the environment once. */
@Global()
@Module({ providers: [{ provide: AppConfig, useFactory: () => AppConfig.fromEnv() }], exports: [AppConfig] })
export class ConfigModule {}
