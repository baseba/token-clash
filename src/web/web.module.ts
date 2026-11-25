import { Module } from '@nestjs/common';
import { WebAssets } from './web-assets.js';

@Module({ providers: [WebAssets], exports: [WebAssets] })
export class WebModule {}
