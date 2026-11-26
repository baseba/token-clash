import { Controller, Get } from '@nestjs/common';
import { ArenaQueries } from '../../arena/application/arena-queries.js';
import { TrainersService } from '../../trainers/application/trainers.service.js';
import { leaderboardOf } from '../application/server-stats.js';

@Controller('api')
export class LeaderboardController {
  constructor(
    private readonly trainers: TrainersService,
    private readonly arena: ArenaQueries,
  ) {}

  @Get('leaderboard')
  leaderboard() {
    return { trainers: leaderboardOf(this.trainers.all(), this.arena.allChallenges()) };
  }
}
