// Chat rules: what a message may contain, which channel a room talks in, and the bounded history
// each channel keeps. Chat is deliberately ephemeral: it lives in memory and a restart clears it.

export const CHAT_MAX_LENGTH = 200;
export const CHAT_HISTORY = 80;
export const CHAT_COOLDOWN_MS = 800;
export const CHAT_CHANNELS = 300;

export interface ChatMessage {
  id: number;
  trainerId: string;
  name: string;
  role: 'player' | 'watcher';
  side: number | null;
  text: string;
  at: number;
}

/** Cleans a message (control characters, extra spaces, length), or null if nothing is left. */
export function chatText(raw: string): string | null {
  const text = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? [...text].slice(0, CHAT_MAX_LENGTH).join('') : null;
}

export function appendChat<T>(history: T[], message: T, limit = CHAT_HISTORY): T[] {
  return [...history, message].slice(-limit);
}

/** All matches of a tournament share the tournament's channel; a duel room has its own. */
export const chatChannel = (challenge: { id: string; tournamentId?: string }) => (challenge.tournamentId ? `t:${challenge.tournamentId}` : `c:${challenge.id}`);
export const tournamentChannel = (tournamentId: string) => `t:${tournamentId}`;

/** In-memory history: the last messages of the most recently used channels. */
export function createChatStore({ channels = CHAT_CHANNELS, history = CHAT_HISTORY } = {}) {
  const store = new Map<string, { messages: ChatMessage[]; seq: number }>();
  return {
    log: (channel: string): ChatMessage[] => store.get(channel)?.messages ?? [],
    post(channel: string, message: Omit<ChatMessage, 'id'>): ChatMessage {
      const entry = store.get(channel) ?? { messages: [], seq: 0 };
      store.delete(channel);
      store.set(channel, entry);
      if (store.size > channels) store.delete(store.keys().next().value!);
      const full = { ...message, id: ++entry.seq };
      entry.messages = appendChat(entry.messages, full, history);
      return full;
    },
  };
}

export type ChatStore = ReturnType<typeof createChatStore>;
