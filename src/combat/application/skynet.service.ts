import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../platform/config/app-config.js';
import { invalid, unavailable } from '../../shared/domain/errors.js';
import { AI_LEVELS, JEV_LEVEL, type AiLevel } from '../domain/ai.js';
import type { Action, BattleState } from '../domain/battle.js';
import { chooseJevAction } from '../infrastructure/jev/jev.js';

@Injectable()
export class SkynetService {
  constructor(private readonly config: AppConfig) {}

  get enabled(): boolean {
    return this.config.jev.enabled;
  }

  get aiLevels(): AiLevel[] {
    return AI_LEVELS.filter((level) => level !== JEV_LEVEL || this.enabled);
  }

  assertOffered(level: string): asserts level is AiLevel {
    if (level === JEV_LEVEL && !this.enabled) throw unavailable('Skynet no está disponible en este servidor.');
    if (!this.aiLevels.some((offered) => offered === level)) throw invalid('Esa dificultad no está disponible.');
  }

  choose(battle: BattleState, sideIndex: number): Promise<Action | null> {
    const { apiKey, url, model } = this.config.jev;
    return chooseJevAction(battle, sideIndex, { apiKey, ...(url ? { url } : {}), ...(model ? { model } : {}) });
  }
}
