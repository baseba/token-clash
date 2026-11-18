import { Injectable } from '@nestjs/common';
import { ArenaQueries } from '../../arena/application/arena-queries.js';
import { forbidden } from '../../shared/domain/errors.js';
import { isShopTrainer } from '../../catalog/domain/trainer-sprites.js';
import { TrainersService } from '../../trainers/application/trainers.service.js';
import type { Trainer } from '../../trainers/domain/trainer.js';
import { isUnlocked, recordOf, spriteProgress, type PlayerRecord } from '../domain/achievements.js';
import { rankingOf } from './server-stats.js';

@Injectable()
export class AchievementsService {
  constructor(
    private readonly trainers: TrainersService,
    private readonly arena: ArenaQueries,
  ) {}

  private recordFor(trainer: Trainer): PlayerRecord {
    const [leader] = rankingOf(this.trainers.all());
    return recordOf({
      trainer,
      team: trainer.teamEntries(),
      challenges: this.arena.allChallenges(),
      tournaments: this.arena.allTournaments(),
      rankedFirst: leader?.id === trainer.id,
    });
  }

  progress(trainer: Trainer) {
    return spriteProgress(this.recordFor(trainer));
  }

  /** @throws {DomainError} the look is still locked, or is not a trainer sprite */
  chooseLook(trainer: Trainer, key: string): Trainer {
    if (key !== trainer.avatar && !isUnlocked(this.recordFor(trainer), key)) throw forbidden(isShopTrainer(key) ? 'Ese entrenador se compra en la tienda.' : 'Todavía no desbloqueas a ese entrenador.');
    return this.trainers.updateProfile(trainer, { avatar: key });
  }
}
