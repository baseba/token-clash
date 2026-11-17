import { Module } from '@nestjs/common';
import { WebAssets } from './web-assets.js';

/** Serves the frontend in public/ (no build: plain JS modules). */
@Module({ providers: [WebAssets], exports: [WebAssets] })
export class WebModule {}
