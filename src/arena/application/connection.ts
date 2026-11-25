export interface ClientConnection {
  trainerId: string | null;
  roomId: string | null;
  tourId: string | null;
  readonly open: boolean;
  send(frame: object | string): void;
}
