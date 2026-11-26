import { Injectable } from '@nestjs/common';
import { now } from '../../shared/domain/clock.js';
import type { RecycledRecord } from '../domain/recycling.js';
import type { EquipKind, Trainer } from '../domain/trainer.js';
import { TrainerRepository } from '../domain/trainer.repository.js';

@Injectable()
export class ShopService {
  constructor(private readonly trainers: TrainerRepository) {}

  buy(trainer: Trainer, itemId: string): Trainer {
    trainer.buy(itemId);
    trainer.touch(now());
    this.trainers.save(trainer);
    return trainer;
  }

  equip(trainer: Trainer, kind: EquipKind, key: string | null): Trainer {
    trainer.equip(kind, key);
    trainer.touch(now());
    this.trainers.save(trainer);
    return trainer;
  }

  recycle(trainer: Trainer, entryId: string): RecycledRecord {
    const record = trainer.recycle(entryId, now());
    trainer.touch(now());
    this.trainers.save(trainer);
    return record;
  }

  replaceLook(trainer: Trainer, key: string | null): void {
    trainer.replaceLook(key);
    this.trainers.save(trainer);
  }
}
