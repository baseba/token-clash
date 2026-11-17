// Skynet: the AI level that asks Jev (TypeSafe's decision model) what to do each turn. This
// service wires the pure Jev client to the server's configuration.
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../shared/config/app-config.js';
import { invalid, unavailable } from '../../shared/domain/errors.js';
import { AI_LEVELS, JEV_LEVEL } from '../domain/ai.js';
import type { Action, BattleState } from '../domain/battle.js';
import { chooseJevAction } from '../infrastructure/jev/jev.js';

@Injectable()
export class SkynetService {
  constructor(private readonly config: AppConfig) {}

  /** Skynet exists only when the server has a way to reach Jev (a proxy URL or a key). */
  get enabled(): boolean {
    return this.config.jev.enabled;
  }

  /** The AI difficulties this server offers. */
  get aiLevels(): string[] {
    return AI_LEVELS.filter((level) => level !== JEV_LEVEL || this.enabled);
  }

  /** Throws unless this server offers that AI difficulty. */
  assertOffered(level: string): void {
    if (level === JEV_LEVEL && !this.enabled) throw unavailable('Skynet no está disponible en este servidor.');
    if (!this.aiLevels.includes(level)) throw invalid('Esa dificultad no está disponible.');
  }

  /** Jev's pick for side `s`, or null when it doesn't answer in time (the caller falls back). */
  choose(battle: BattleState, s: number): Promise<Action | null> {
    const { apiKey, url, model } = this.config.jev;
    return chooseJevAction(battle, s, { apiKey, ...(url ? { url } : {}), ...(model ? { model } : {}) });
  }
}
