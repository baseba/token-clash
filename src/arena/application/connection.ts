export interface ClientConnection {
  readonly trainerId: string | null;
  readonly roomId: string | null;
  readonly tourId: string | null;
  readonly open: boolean;
  send(frame: object | string): void;
  signIn(trainer: { readonly id: string } | undefined): void;
  enterRoom(roomId: string): boolean;
  follow(tourId: string): boolean;
}
