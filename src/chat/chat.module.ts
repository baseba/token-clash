import { Module } from '@nestjs/common';
import { ChatService } from './application/chat.service.js';

/** Chat context: message rules and the in-memory history per channel. */
@Module({ providers: [ChatService], exports: [ChatService] })
export class ChatModule {}
