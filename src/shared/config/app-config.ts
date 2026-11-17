// Every setting the server reads from the environment, parsed once at startup and typed. Nothing
// else in the code touches process.env: it asks for AppConfig instead (dependency injection), so
// tests can build one with whatever values they need. A value that doesn't parse stops the server
// with a message naming the variable, instead of running with NaN timers or a half-read flag.
import { join } from 'node:path';
import { z } from 'zod';
import { PROJECT_ROOT } from '../paths.js';

/** How long each step of a match waits. Production uses the defaults; e2e tests shrink them. */
export interface ArenaTimings {
  turnLimitMs: number;
  /** Time to choose the 3 Pokémon. */
  pickLimitMs: number;
  /** In a random battle the dice animate first: the pick limit grows by this much. */
  diceRollBonusMs: number;
  /** The countdown before the preview. */
  countdownMs: number;
  /** Both teams are shown this long before the battle. */
  revealMs: number;
  /** The AI starts marking its picks once the dice animation is over. */
  diceAnimationMs: number;
  /** How long an AI takes to mark its picks, one by one. */
  aiPickMs: number;
  /** The animation that draws a tournament's bracket. */
  bracketDrawMs: number;
  betweenMatchesMs: number;
  /** Minimum pause between turns when both sides are AIs, so people can watch. */
  aiVsAiPauseMs: number;
  /** An AI-vs-AI match waits at most this long for viewers still animating a turn. */
  aiVsAiViewerWaitMs: number;
  /** The turn and pick limit when a tournament player is not in the room. */
  absentLimitMs: number;
  /** How long a seat (or a room host) may be disconnected before losing it. */
  seatGraceMs: number;
  /** How long a tournament match waits for its players to arrive. */
  arrivalWaitMs: number;
}

export interface JevConfig {
  apiKey: string;
  url: string | null;
  model: string | null;
  /** Skynet needs a way to reach Jev: the egress proxy URL (which holds the key) or a key to call TypeSafe directly. */
  enabled: boolean;
}

const ms = (fallback: number) => z.coerce.number().int().nonnegative().default(fallback);
const spanish = z.locales.es().localeError;
const origin = z.string().refine((v) => URL.canParse(v) && new URL(v).origin === v, 'debe ser un origen, como https://clash.example.com (sin / al final)');

/** The environment as the server reads it. An empty variable counts as unset. */
const Env = z.object({
  PORT: z.coerce.number().int().min(0).max(65_535).default(8080),
  HOST: z.string().default('0.0.0.0'),
  DATA_DIR: z.string().default(join(PROJECT_ROOT, 'data')),
  PUBLIC_ORIGIN: origin.optional(),
  TRUST_CF_CONNECTING_IP: z.enum(['0', '1']).default('0'),
  JEV_API_KEY: z.string().default(''),
  JEV_API_URL: z.url().optional(),
  JEV_MODEL: z.string().optional(),
  TURN_MS: ms(60_000),
  PREVIEW_MS: ms(80_000),
  ROLL_MS: ms(6_000),
  MATCH_MS: ms(5_000),
  REVEAL_MS: ms(4_000),
  DICE_ANIM_MS: ms(4_500),
  AI_PICK_MS: ms(5_000),
  DRAW_MS: ms(6_000),
  BETWEEN_MS: ms(15_000),
  AI_PACE_MS: ms(2_500),
  AI_WATCH_MS: ms(20_000),
  ABSENT_MS: ms(15_000),
  SEAT_GRACE_MS: ms(30_000),
  ARRIVAL_MS: ms(45_000),
});

export class AppConfig {
  constructor(
    readonly port: number,
    readonly host: string,
    readonly dataDir: string,
    /** When set, only this Origin may call the API with side effects or open a socket. */
    readonly publicOrigin: string,
    /** Behind Cloudflare: the client IP comes in CF-Connecting-IP. */
    readonly trustCfConnectingIp: boolean,
    readonly jev: JevConfig,
    readonly timings: ArenaTimings,
  ) {}

  /** Reads the environment, or throws with every variable that is wrong. */
  static fromEnv(env: Record<string, string | undefined> = process.env): AppConfig {
    const set = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ''));
    const parsed = Env.safeParse(set, { error: spanish });
    if (!parsed.success) {
      const problems = parsed.error.issues.map((issue) => `${issue.path.join('.')}=${JSON.stringify(set[String(issue.path[0])])}: ${issue.message}`);
      throw new Error(`Configuración inválida:\n  ${problems.join('\n  ')}`);
    }
    const e = parsed.data;
    return new AppConfig(
      e.PORT,
      e.HOST,
      e.DATA_DIR,
      e.PUBLIC_ORIGIN ?? '',
      e.TRUST_CF_CONNECTING_IP === '1',
      { apiKey: e.JEV_API_KEY, url: e.JEV_API_URL ?? null, model: e.JEV_MODEL ?? null, enabled: Boolean(e.JEV_API_KEY || e.JEV_API_URL) },
      {
        turnLimitMs: e.TURN_MS,
        pickLimitMs: e.PREVIEW_MS,
        diceRollBonusMs: e.ROLL_MS,
        countdownMs: e.MATCH_MS,
        revealMs: e.REVEAL_MS,
        diceAnimationMs: e.DICE_ANIM_MS,
        aiPickMs: e.AI_PICK_MS,
        bracketDrawMs: e.DRAW_MS,
        betweenMatchesMs: e.BETWEEN_MS,
        aiVsAiPauseMs: e.AI_PACE_MS,
        aiVsAiViewerWaitMs: e.AI_WATCH_MS,
        absentLimitMs: e.ABSENT_MS,
        seatGraceMs: e.SEAT_GRACE_MS,
        arrivalWaitMs: e.ARRIVAL_MS,
      },
    );
  }
}
