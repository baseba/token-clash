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
import { TowerRun, type RewardChoice } from '../domain/tower-run.js';
import type { FloorScore } from '../domain/score.js';

export interface TowerRecord {
  trainerId: string;
  difficulty: AiLevel;
  length: number | null;
  points: number;
  cleared: number;
  finished: boolean;
  log: FloorScore[];
  at: number;
}

@Injectable()
export class TowerService implements OnModuleInit {
  constructor(
    private readonly runs: TowerRunRepository,
    private readonly trainers: TrainersService,
    private readonly duels: DuelService,
    private readonly arena: ArenaQueries,
    private readonly events: ArenaEvents,
    private readonly skynet: SkynetService,
  ) {}

  onModuleInit(): void {
    this.events.onMatchFinished((event) => this.battleFinished(event));
  }

  current(trainerId: string): TowerRun | undefined {
    return this.runs.all().find((run) => run.trainerId === trainerId && run.open);
  }

  history(trainerId: string): TowerRun[] {
    return this.runs.all().filter((run) => run.trainerId === trainerId && !run.open);
  }

  records(): TowerRecord[] {
    const best = new Map<string, TowerRun>();
    for (const run of this.runs.all()) {
      if (!run.log.length) continue;
      const key = `${run.trainerId}:${run.difficulty}`;
      const known = best.get(key);
      if (!known || run.points > known.points || (run.points === known.points && run.updatedAt < known.updatedAt)) best.set(key, run);
    }
    return [...best.values()]
      .map((run) => ({ trainerId: run.trainerId, difficulty: run.difficulty, length: run.length, points: run.points, cleared: run.cleared, finished: run.status === 'cleared', log: run.log, at: run.finishedAt ?? run.updatedAt }))
      .sort((a, b) => b.points - a.points || a.at - b.at);
  }

  start(trainer: Trainer, input: { difficulty: string; length: number | null }): TowerRun {
    this.skynet.assertOffered(input.difficulty);
    if (this.current(trainer.id)) throw conflict('Ya tienes una subida en curso: termínala o abandónala primero.');
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

  takeReward(trainer: Trainer, input: { reward: string } & RewardChoice): TowerRun {
    return this.change(trainer, (run, at) => run.takeReward(input.reward, input, { at, roster: trainer.roster }));
  }

  reroll(trainer: Trainer): TowerRun {
    return this.change(trainer, (run, at) => run.reroll(at));
  }

  chooseRoom(trainer: Trainer, input: { room: RoomKind; release: string | null }): TowerRun {
    return this.change(trainer, (run, at) => run.chooseRoom(input.room, { at, roster: trainer.roster, releaseUid: input.release }));
  }

  recruit(trainer: Trainer, input: { offer: string; release: string | null }): TowerRun {
    return this.change(trainer, (run, at) => run.recruit(input.offer, input.release, at));
  }

  edit(trainer: Trainer, uid: string, change: { moves?: string[]; ability?: string | null }): TowerRun {
    return this.change(trainer, (run, at) => run.edit(uid, change, at));
  }

  release(trainer: Trainer, uid: string): TowerRun {
    return this.change(trainer, (run, at) => run.release(uid, at));
  }

  holdEvolution(trainer: Trainer, uid: string): TowerRun {
    return this.change(trainer, (run, at) => run.holdEvolution(uid, at));
  }

  moveOn(trainer: Trainer): TowerRun {
    return this.change(trainer, (run, at) => run.moveOn(at));
  }

  private change(trainer: Trainer, apply: (run: TowerRun, at: number) => void): TowerRun {
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
    const run = this.current(trainer.id);
    if (!run) throw notFound('No tienes una subida en curso.');
    return run;
  }

  private battleFinished({ challenge, winnerSide }: MatchFinished): void {
    if (!challenge.staging || challenge.guestId !== aiTrainerId(challenge.ai as AiLevel)) return;
    const run = this.current(challenge.hostId);
    const roster = this.trainers.byId(challenge.hostId)?.roster ?? [];
    if (run?.battleFinished(challenge.id, winnerSide === 0, { at: now(), roster })) this.runs.save(run);
  }
}
