import { Injectable } from '@nestjs/common';
import { CHAT_COOLDOWN_MS, chatText, createChatStore, type ChatMessage } from '../domain/chat.js';

/** The chat of rooms and tournaments. Knows nothing about rooms: callers tell it the channel. */
@Injectable()
export class ChatService {
  private readonly store = createChatStore();

  history(channel: string): ChatMessage[] {
    return this.store.log(channel);
  }

  /**
   * Posts a message if it has text and the sender isn't flooding. Returns the stored message, or
   * null when it was dropped.
   */
  post(channel: string, input: { trainerId: string; name: string; role: ChatMessage['role']; side: number | null; text: string; lastAt?: number; at: number }): ChatMessage | null {
    const text = chatText(input.text);
    if (!text || input.at - (input.lastAt ?? 0) < CHAT_COOLDOWN_MS) return null;
    return this.store.post(channel, { trainerId: input.trainerId, name: input.name, role: input.role, side: input.side, text, at: input.at });
  }
}
