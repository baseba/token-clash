// What a client may send over /ws: one schema per message, told apart by `t`. GameWsAdapter parses
// every frame with these before the gateway sees it, so the handlers and the use cases get typed
// values. A frame with an unknown `t`, or that isn't an object, is dropped.
//
// A field that is there but malformed reads as the value the use case already turns down with its
// own answer: a room id that isn't a string finds no room ("Ese desafío no existe."), picks that
// aren't a list of indexes are no picks ("Elige 3 Pokémon distintos."), a token that isn't a
// string means no session. So a bad frame gets the same reply a well-formed wrong one gets.
import { z } from 'zod';

const token = z.string().optional().catch(undefined);
const picks = z.array(z.int()).catch([]);

const BattleAction = z.discriminatedUnion('type', [
  z.object({ type: z.literal('move'), move: z.int(), target: z.enum(['foe', 'self']).optional().catch(undefined) }),
  z.object({ type: z.literal('switch'), to: z.int() }),
]);

export const ClientMessage = z.discriminatedUnion('t', [
  /** Follow the list of open rooms. */
  z.object({ t: z.literal('lobby'), token }),
  /** Follow a tournament page. */
  z.object({ t: z.literal('tour'), id: z.string().catch(''), token }),
  /** Enter a room, as a player or a viewer. */
  z.object({ t: z.literal('hello'), room: z.string().catch(''), token }),
  /** The ready check of a 1v1 room. Anything but `false` means ready. */
  z.object({ t: z.literal('set-ready'), ready: z.boolean().catch(true) }),
  /** The guest walks out of the ready check. */
  z.object({ t: z.literal('leave') }),
  /** The client finished animating this turn (AI-vs-AI matches wait for viewers). */
  z.object({ t: z.literal('seen'), turn: z.int().nonnegative().catch(0) }),
  /** The picks a player has marked so far, shown live to viewers. */
  z.object({ t: z.literal('choosing'), picks }),
  /** Confirm the 3 picks. */
  z.object({ t: z.literal('pick'), picks }),
  /** A move or a switch. */
  z.object({ t: z.literal('act'), action: BattleAction.nullable().catch(null) }),
  z.object({ t: z.literal('surrender') }),
  /** A player lets their match, or their tournament, show up in the live list. */
  z.object({ t: z.literal('watch') }),
  /** A message to the room's or the tournament's chat. */
  z.object({ t: z.literal('chat'), text: z.string().catch('') }),
  /** Tune in to a radio station (its owner's id), or out with null. Independent of rooms and the lobby. */
  z.object({ t: z.literal('radio'), station: z.string().nullable().catch(null) }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;
export type ClientMessageOf<T extends ClientMessage['t']> = Extract<ClientMessage, { t: T }>;

/** A raw frame as Nest routes it (`event` is the handler's @SubscribeMessage), or undefined to drop it. */
export function parseClientMessage(frame: string): { event: ClientMessage['t']; data: ClientMessage } | undefined {
  let json: unknown;
  try {
    json = JSON.parse(frame);
  } catch {
    return undefined;
  }
  const parsed = ClientMessage.safeParse(json);
  return parsed.success ? { event: parsed.data.t, data: parsed.data } : undefined;
}
