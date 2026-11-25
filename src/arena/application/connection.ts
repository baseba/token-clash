export interface ClientConnection {
  trainerId: string | null;
  roomId: string | null;
  tourId: string | null;
  seenTurn?: number;
  lastChatAt?: number;
  readonly open: boolean;
  send(frame: object | string): void;
}
