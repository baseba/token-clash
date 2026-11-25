import { z } from 'zod';

const token = z.string().optional().catch(undefined);
const picks = z.array(z.int()).catch([]);

const BattleAction = z.discriminatedUnion('type', [
  z.object({ type: z.literal('move'), move: z.int(), target: z.enum(['foe', 'self']).optional().catch(undefined) }),
  z.object({ type: z.literal('switch'), to: z.int() }),
]);

export const ClientMessage = z.discriminatedUnion('t', [
  z.object({ t: z.literal('lobby'), token }),
  z.object({ t: z.literal('tour'), id: z.string().catch(''), token }),
  z.object({ t: z.literal('hello'), room: z.string().catch(''), token }),
  z.object({ t: z.literal('set-ready'), ready: z.boolean().catch(true) }),
  z.object({ t: z.literal('leave') }),
  z.object({ t: z.literal('seen'), turn: z.int().nonnegative().catch(0) }),
  z.object({ t: z.literal('choosing'), picks }),
  z.object({ t: z.literal('reroll'), index: z.int().catch(-1) }),
  z.object({ t: z.literal('pick'), picks }),
  z.object({ t: z.literal('act'), action: BattleAction.nullable().catch(null) }),
  z.object({ t: z.literal('surrender') }),
  z.object({ t: z.literal('watch') }),
  z.object({ t: z.literal('chat'), text: z.string().catch('') }),
  z.object({ t: z.literal('radio'), station: z.string().nullable().catch(null) }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;
export type ClientMessageOf<T extends ClientMessage['t']> = Extract<ClientMessage, { t: T }>;

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
