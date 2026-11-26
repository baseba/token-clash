import { Injectable, type OnModuleInit } from '@nestjs/common';
import { aiTrainerId, type AiLevel } from '../../combat/domain/ai.js';
import { SkynetService } from '../../combat/application/skynet.service.js';
import { ArenaEvents, type MatchFinished } from '../../arena/application/arena-events.js';
import { ArenaQueries } from '../../arena/application/arena-queries.js';
import { DuelService } from '../../arena/application/duel.service.js';
import { newId, now } from '../../shared/domain/clock.js';
import { conflict, notFound } from '../../shared/domain/errors.js';
import type { RoomKind } from '../../catalog/domain/tower-cast.js';
import { TrainersService } from '../../trainers/application/trainers.service.js';
import type { Trainer } from '../../trainers/domain/trainer.js';
import { TowerRunRepository } from '../domain/tower-run.repository.js';
import { TowerRun } from '../domain/tower-run.js';
import { TowerRecords } from './tower-records.js';

@Injectable()
export class TowerService implements OnModuleInit {
  constructor(
    private readonly runs: TowerRunRepository,
    private readonly records: TowerRecords,
    private readonly trainers: TrainersService,
    private readonly duels: DuelService,
    private readonly arena: ArenaQueries,
    private readonly events: ArenaEvents,
    private readonly skynet: SkynetService,
  ) {}

  onModuleInit(): void {
    this.events.onMatchFinished((event) => this.battleFinished(event));
  }

  start(trainer: Trainer, input: { difficulty: string; length: number | null }): TowerRun {
    this.skynet.assertOffered(input.difficulty);
    if (this.records.current(trainer.id)) throw conflict('Ya tienes una subida en curso: termínala o abandónala primero.');
    const run = TowerRun.start({ id: newId(), trainerId: trainer.id, difficulty: input.difficulty, length: input.length, roster: trainer.roster, at: now() });
    this.runs.save(run);
    return run;
  }

  draft(trainer: Trainer, offerIds: string[]): TowerRun {
    const run = this.open(trainer);
    run.draft(offerIds, now());
    this.runs.save(run);
    return run;
  }

  fight(trainer: Trainer): { run: TowerRun; challengeId: string } {
    const run = this.open(trainer);
    if (run.challengeId && this.arena.challengeStatus(run.challengeId) === 'active') return { run, challengeId: run.challengeId };
    const floor = run.currentFloor();
    if (!floor.foe) throw conflict('En este piso no hay pelea.');
    const challenge = this.duels.startStaged(trainer, {
      level: run.difficulty,
      hostTeam: run.battleTeam(),
      aiName: `${floor.foe.title} ${floor.foe.name}`,
      aiTeam: run.foeTeam(),
      staging: { scene: floor.scene, music: floor.music, guestAvatar: floor.foe.key, returnTo: '/torre', label: `Torre · Piso ${floor.number}`, aiPicks: run.foePicks(), guestSays: { lose: floor.lines.lose, win: floor.lines.win } },
    });
    run.enterBattle(challenge.id, now());
    this.runs.save(run);
    return { run, challengeId: challenge.id };
  }

  chooseRoom(trainer: Trainer, input: { room: RoomKind; release: string | null }): TowerRun {
    return this.change(trainer, (run, at) => run.chooseRoom(input.room, { at, roster: trainer.roster, releaseUid: input.release }));
  }

  moveOn(trainer: Trainer): TowerRun {
    return this.change(trainer, (run, at) => run.moveOn(at));
  }

  change(trainer: Trainer, apply: (run: TowerRun, at: number) => void): TowerRun {
    const run = this.open(trainer);
    apply(run, now());
    this.runs.save(run);
    return run;
  }

  abandon(trainer: Trainer): TowerRun {
    const run = this.open(trainer);
    run.abandon(now());
    this.runs.save(run);
    return run;
  }

  private open(trainer: Trainer): TowerRun {
    const run = this.records.current(trainer.id);
    if (!run) throw notFound('No tienes una subida en curso.');
    return run;
  }

  private battleFinished({ challenge, winnerSide }: MatchFinished): void {
    if (!challenge.staging || challenge.guestId !== aiTrainerId(challenge.ai as AiLevel)) return;
    const run = this.records.current(challenge.hostId);
    const roster = this.trainers.byId(challenge.hostId)?.roster ?? [];
    if (run?.battleFinished(challenge.id, winnerSide === 0, { at: now(), roster })) this.runs.save(run);
  }
}
