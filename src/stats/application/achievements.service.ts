import { Injectable } from '@nestjs/common';
import { ArenaQueries } from '../../arena/application/arena-queries.js';
import { forbidden } from '../../shared/domain/errors.js';
import { isShopTrainer } from '../../catalog/domain/trainer-sprites.js';
import { shopItem } from '../../catalog/domain/shop.js';
import { TrainersService } from '../../trainers/application/trainers.service.js';
import type { EquipKind, Trainer } from '../../trainers/domain/trainer.js';
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

  available(trainer: Trainer): (key: string) => boolean {
    const record = this.recordFor(trainer);
    return (key) => isUnlocked(record, key);
  }

  /** @throws {DomainError} the item needs a trainer not unlocked yet, doesn't exist, is owned, or the balance is short */
  buy(trainer: Trainer, itemId: string): Trainer {
    const requires = shopItem(itemId)?.requires;
    if (requires && !isUnlocked(this.recordFor(trainer), requires)) throw forbidden('Primero desbloquea al entrenador original.');
    return this.trainers.buy(trainer, itemId);
  }

  /** @throws {DomainError} the item doesn't exist or wasn't bought */
  equip(trainer: Trainer, kind: EquipKind, key: string | null): Trainer {
    return this.trainers.equip(trainer, kind, key);
  }

  /** @throws {DomainError} the look is still locked, or is not a trainer sprite */
  chooseLook(trainer: Trainer, key: string): Trainer {
    if (key !== trainer.avatar && !isUnlocked(this.recordFor(trainer), key)) throw forbidden(isShopTrainer(key) ? 'Ese entrenador se compra en tu perfil.' : 'Todavía no desbloqueas a ese entrenador.');
    return this.trainers.updateProfile(trainer, { avatar: key });
  }
}
