// Every setting the server reads from the environment, read once and typed. Nothing else in the
// code touches process.env: it asks for AppConfig instead (dependency injection), so tests can
// build one with whatever values they need.
import { join } from 'node:path';
import { PROJECT_ROOT } from '../paths.js';

const num = (v: string | undefined, fallback: number) => (v === undefined || v === '' ? fallback : Number(v));

/** How long each step of a match waits. Production uses the defaults; e2e tests shrink them. */
export interface ArenaTimings {
  /** Time to choose an action each turn. */
  turnMs: number;
  /** Time to choose the 3 Pokémon. */
  previewMs: number;
  /** Extra preview time while the dice animate in a random battle. */
  rollMs: number;
  /** Countdown before the preview. */
  matchMs: number;
  /** Both teams are shown this long before the battle. */
  revealMs: number;
  diceAnimMs: number;
  /** How long an AI takes to mark its picks. */
  aiPickMs: number;
  /** Bracket draw animation of a tournament. */
  drawMs: number;
  /** Pause between tournament matches. */
  betweenMs: number;
  /** Minimum pause between turns of an AI-vs-AI match. */
  aiPaceMs: number;
  /** Turn time when a tournament player is not in the room. */
  absentMs: number;
  /** How long a seat (or a room host) may be disconnected before losing it. */
  seatGraceMs: number;
  /** How long a tournament match waits for its players to arrive. */
  arrivalMs: number;
  /** An AI-vs-AI match waits at most this long for viewers to catch up. */
  aiWatchMs: number;
}

export class AppConfig {
  constructor(
    readonly port: number,
    readonly host: string,
    readonly dataDir: string,
    /** When set, only this Origin may call the API with side effects or open a socket. */
    readonly publicOrigin: string,
    /** Behind Cloudflare: the client IP comes in CF-Connecting-IP. */
    readonly trustCfConnectingIp: boolean,
    readonly jev: { apiKey: string; url: string | null; model: string | null; enabled: boolean },
    readonly timings: ArenaTimings,
  ) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): AppConfig {
    return new AppConfig(
      num(env.PORT, 8080),
      env.HOST || '0.0.0.0',
      env.DATA_DIR || join(PROJECT_ROOT, 'data'),
      env.PUBLIC_ORIGIN || '',
      env.TRUST_CF_CONNECTING_IP === '1',
      {
        apiKey: env.JEV_API_KEY || '',
        url: env.JEV_API_URL || null,
        model: env.JEV_MODEL || null,
        // Skynet needs a way to reach Jev: JEV_API_URL (the egress proxy, which holds the key) or a
        // key to call TypeSafe directly. Without either, the level is neither offered nor accepted.
        enabled: Boolean(env.JEV_API_KEY || env.JEV_API_URL),
      },
      {
        turnMs: num(env.TURN_MS, 60_000),
        previewMs: num(env.PREVIEW_MS, 80_000),
        rollMs: num(env.ROLL_MS, 6_000),
        matchMs: num(env.MATCH_MS, 5_000),
        revealMs: num(env.REVEAL_MS, 4_000),
        diceAnimMs: num(env.DICE_ANIM_MS, 4_500),
        aiPickMs: num(env.AI_PICK_MS, 5_000),
        drawMs: num(env.DRAW_MS, 6_000),
        betweenMs: num(env.BETWEEN_MS, 15_000),
        aiPaceMs: num(env.AI_PACE_MS, 2_500),
        absentMs: num(env.ABSENT_MS, 15_000),
        seatGraceMs: num(env.SEAT_GRACE_MS, 30_000),
        arrivalMs: num(env.ARRIVAL_MS, 45_000),
        aiWatchMs: num(env.AI_WATCH_MS, 20_000),
      },
    );
  }
}
