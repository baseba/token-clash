import { join } from 'node:path';
import { z } from 'zod';
import { PROJECT_ROOT } from '../../shared/paths.js';

export interface ArenaTimings {
  turnLimitMs: number;
  pickLimitMs: number;
  diceRollBonusMs: number;
  countdownMs: number;
  revealMs: number;
  diceAnimationMs: number;
  aiPickMs: number;
  bracketDrawMs: number;
  betweenMatchesMs: number;
  aiVsAiPauseMs: number;
  aiVsAiViewerWaitMs: number;
  absentLimitMs: number;
  seatGraceMs: number;
  arrivalWaitMs: number;
}

export interface JevConfig {
  apiKey: string;
  url: string | null;
  model: string | null;
  enabled: boolean;
}

const ms = (fallback: number) => z.coerce.number().int().nonnegative().default(fallback);
const spanish = z.locales.es().localeError;
const origin = z.string().refine((v) => URL.canParse(v) && new URL(v).origin === v, 'debe ser un origen, como https://clash.example.com (sin / al final)');

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
    readonly publicOrigin: string,
    readonly trustCfConnectingIp: boolean,
    readonly jev: JevConfig,
    readonly timings: ArenaTimings,
  ) {}

  static fromEnv(env: Record<string, string | undefined> = process.env): AppConfig {
    const set = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ''));
    const parsed = Env.safeParse(set, { error: spanish });
    if (!parsed.success) {
      const problems = parsed.error.issues.map((issue) => `${issue.path.join('.')}=${JSON.stringify(set[String(issue.path[0])])}: ${issue.message}`);
      throw new Error(`Configuración inválida:\n  ${problems.join('\n  ')}`);
    }
    const vars = parsed.data;
    return new AppConfig(
      vars.PORT,
      vars.HOST,
      vars.DATA_DIR,
      vars.PUBLIC_ORIGIN ?? '',
      vars.TRUST_CF_CONNECTING_IP === '1',
      {
        apiKey: vars.JEV_API_KEY,
        url: vars.JEV_API_URL ?? null,
        model: vars.JEV_MODEL ?? null,
        enabled: Boolean(vars.JEV_API_KEY || vars.JEV_API_URL),
      },
      {
        turnLimitMs: vars.TURN_MS,
        pickLimitMs: vars.PREVIEW_MS,
        diceRollBonusMs: vars.ROLL_MS,
        countdownMs: vars.MATCH_MS,
        revealMs: vars.REVEAL_MS,
        diceAnimationMs: vars.DICE_ANIM_MS,
        aiPickMs: vars.AI_PICK_MS,
        bracketDrawMs: vars.DRAW_MS,
        betweenMatchesMs: vars.BETWEEN_MS,
        aiVsAiPauseMs: vars.AI_PACE_MS,
        aiVsAiViewerWaitMs: vars.AI_WATCH_MS,
        absentLimitMs: vars.ABSENT_MS,
        seatGraceMs: vars.SEAT_GRACE_MS,
        arrivalWaitMs: vars.ARRIVAL_MS,
      },
    );
  }
}
