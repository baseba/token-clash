/**
 * Port: a connected client, as the arena sees it. The realtime gateway wraps each WebSocket in
 * one of these, so the use cases can talk to players without knowing about WebSockets.
 */
export interface ClientConnection {
  /** Who is connected (null for an anonymous viewer). */
  trainerId: string | null;
  /** The room (challenge id) this connection is in, if any. */
  roomId: string | null;
  /** The tournament this connection follows, if any. */
  tourId: string | null;
  /** Last battle turn this client finished animating (AI-vs-AI matches wait for viewers). */
  seenTurn?: number;
  lastChatAt?: number;
  readonly open: boolean;
  /** Sends a frame: objects as JSON, strings as they are. */
  send(frame: object | string): void;
}
