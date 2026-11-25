import { Module } from '@nestjs/common';
import { ChatService } from './application/chat.service.js';

@Module({ providers: [ChatService], exports: [ChatService] })
export class ChatModule {}
