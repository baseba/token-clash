export const CHAT_MAX_LENGTH = 200;
export const CHAT_HISTORY = 80;
export const CHAT_COOLDOWN_MS = 800;
export const CHAT_CHANNELS = 300;

export function chatText(raw) {
  if (typeof raw !== 'string') return null;
  const text = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? [...text].slice(0, CHAT_MAX_LENGTH).join('') : null;
}

export function appendChat(history, message, limit = CHAT_HISTORY) {
  return [...history, message].slice(-limit);
}

export const chatChannel = (challenge) => (challenge.tournamentId ? `t:${challenge.tournamentId}` : `c:${challenge.id}`);
export const tournamentChannel = (tournamentId) => `t:${tournamentId}`;

export function createChatStore({ channels = CHAT_CHANNELS, history = CHAT_HISTORY } = {}) {
  const store = new Map();
  return {
    log: (channel) => store.get(channel)?.messages ?? [],
    post(channel, message) {
      const entry = store.get(channel) ?? { messages: [], seq: 0 };
      store.delete(channel);
      store.set(channel, entry);
      if (store.size > channels) store.delete(store.keys().next().value);
      const full = { ...message, id: ++entry.seq };
      entry.messages = appendChat(entry.messages, full, history);
      return full;
    },
  };
}
