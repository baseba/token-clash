import { Injectable } from '@nestjs/common';
import { CHAT_COOLDOWN_MS, chatText, createChatStore, type ChatMessage } from '../domain/chat.js';

@Injectable()
export class ChatService {
  private readonly store = createChatStore();

  history(channel: string): ChatMessage[] {
    return this.store.log(channel);
  }

  post(channel: string, input: { trainerId: string; name: string; role: ChatMessage['role']; side: number | null; text: string; lastAt?: number; at: number }): ChatMessage | null {
    const text = chatText(input.text);
    if (!text || input.at - (input.lastAt ?? 0) < CHAT_COOLDOWN_MS) return null;
    return this.store.post(channel, { trainerId: input.trainerId, name: input.name, role: input.role, side: input.side, text, at: input.at });
  }
}
