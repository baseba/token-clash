import { Injectable } from '@nestjs/common';
import type { Trainer } from '../../trainers/domain/trainer.js';
import type { RewardChoice, TowerRun } from '../domain/tower-run.js';
import { TowerService } from './tower.service.js';

@Injectable()
export class TowerRestService {
  constructor(private readonly tower: TowerService) {}

  takeReward(trainer: Trainer, input: { reward: string } & RewardChoice): TowerRun {
    return this.tower.change(trainer, (run, at) => run.takeReward(input.reward, input, { at, roster: trainer.roster }));
  }

  reroll(trainer: Trainer): TowerRun {
    return this.tower.change(trainer, (run, at) => run.reroll(at));
  }

  recruit(trainer: Trainer, input: { offer: string; release: string | null }): TowerRun {
    return this.tower.change(trainer, (run, at) => run.recruit(input.offer, input.release, at));
  }

  edit(trainer: Trainer, uid: string, change: { moves?: string[]; ability?: string | null }): TowerRun {
    return this.tower.change(trainer, (run, at) => run.edit(uid, change, at));
  }

  release(trainer: Trainer, uid: string): TowerRun {
    return this.tower.change(trainer, (run, at) => run.release(uid, at));
  }

  holdEvolution(trainer: Trainer, uid: string): TowerRun {
    return this.tower.change(trainer, (run, at) => run.holdEvolution(uid, at));
  }
}
