import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ArenaQueries } from '../../arena/application/arena-queries.js';
import { forbidden } from '../../shared/domain/errors.js';
import { TRAINER_SPRITES } from '../../catalog/domain/trainer-sprites.js';
import { hash } from '../../catalog/domain/creatures.js';
import { ShopService } from '../../trainers/application/shop.service.js';
import { TrainersService } from '../../trainers/application/trainers.service.js';
import type { EquipKind, Trainer } from '../../trainers/domain/trainer.js';
import { buyBlocker, isUnlocked, lookBlocker, recordOf, spriteProgress, type PlayerRecord } from '../domain/achievements.js';
import { rankingOf } from './server-stats.js';

@Injectable()
export class AchievementsService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Achievements');

  constructor(
    private readonly trainers: TrainersService,
    private readonly shop: ShopService,
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

  onApplicationBootstrap(): void {
    let relooked = 0;
    for (const trainer of this.trainers.all()) {
      if (!trainer.avatar) continue;
      const record = this.recordFor(trainer);
      if (isUnlocked(record, trainer.avatar)) continue;
      const choices = TRAINER_SPRITES.filter((key) => isUnlocked(record, key));
      this.shop.replaceLook(trainer, choices.length ? choices[hash(`${trainer.id}:look`) % choices.length] : null);
      relooked += 1;
    }
    if (relooked) this.logger.log(`${relooked} entrenador(es) tenían un entrenador que ya no les corresponde: les tocó uno que sí tienen.`);
  }

  progress(trainer: Trainer) {
    return spriteProgress(this.recordFor(trainer));
  }

  available(trainer: Trainer): (key: string) => boolean {
    const record = this.recordFor(trainer);
    return (key) => isUnlocked(record, key);
  }

  buy(trainer: Trainer, itemId: string): Trainer {
    const reason = buyBlocker(this.recordFor(trainer), itemId);
    if (reason) throw forbidden(reason);
    return this.shop.buy(trainer, itemId);
  }

  equip(trainer: Trainer, kind: EquipKind, key: string | null): Trainer {
    return this.shop.equip(trainer, kind, key);
  }

  chooseLook(trainer: Trainer, key: string): Trainer {
    const reason = lookBlocker(this.recordFor(trainer), trainer.avatar, key);
    if (reason) throw forbidden(reason);
    return this.trainers.updateProfile(trainer, { avatar: key });
  }
}
