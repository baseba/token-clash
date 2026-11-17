import { Controller, Get } from '@nestjs/common';
import { ArenaQueries } from '../../arena/application/arena-queries.js';
import { TrainersService } from '../../trainers/application/trainers.service.js';
import { WebAssets } from '../../web/web-assets.js';
import { serverStats } from '../application/server-stats.js';

const byId = <T extends { id: string }>(list: readonly T[]) => Object.fromEntries(list.map((x) => [x.id, x]));

/** /api/stats: a read model built from what trainers and arena let anyone read. */
@Controller('api/stats')
export class StatsController {
  private readonly startedAt = Date.now();

  constructor(
    private readonly trainers: TrainersService,
    private readonly arena: ArenaQueries,
    private readonly assets: WebAssets,
  ) {}

  @Get()
  stats() {
    const source = { trainers: byId(this.trainers.all()), challenges: byId(this.arena.allChallenges()), tournaments: byId(this.arena.allTournaments()) };
    return { ...serverStats(source), live: { battles: this.arena.liveBattles(), startedAt: this.startedAt, version: this.assets.version } };
  }
}
