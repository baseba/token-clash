import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { RateLimit } from '../../shared/http/rate-limit.guard.js';
import type { Trainer } from '../../trainers/domain/trainer.js';
import { Authenticated, CurrentTrainer, MaybeAuthenticated } from '../../trainers/interface/session.guard.js';
import { ArenaViews } from '../application/arena-views.js';
import { ChallengesService } from '../application/challenges.service.js';
import { LobbyService } from '../application/lobby.service.js';
import { HistoryQueryDto } from './dto/history-query.dto.js';
import { NewChallengeDto } from './dto/new-challenge.dto.js';

const NO_SESSION = 'Primero importa tu equipo.';
const ROOM_ID = /^[A-Za-z0-9_-]{4,20}$/;

@Controller('api')
export class ChallengesController {
  constructor(
    private readonly challenges: ChallengesService,
    private readonly lobby: LobbyService,
    private readonly views: ArenaViews,
  ) {}

  @Post('challenges')
  @HttpCode(200)
  @RateLimit({ bucket: 'challenge', by: 'trainer', max: 30, windowMs: 10 * 60_000, message: 'Demasiados desafíos, espera unos minutos.' })
  @Authenticated(NO_SESSION)
  create(@CurrentTrainer() t: Trainer, @Body({ schema: NewChallengeDto }) body: NewChallengeDto) {
    const { challenge, joined } = this.challenges.create(t, body);
    return { challenge: this.views.challenge(challenge, t.id), ...(joined ? { joined } : {}) };
  }

  @Get('challenges/:id')
  @MaybeAuthenticated()
  get(@CurrentTrainer() t: Trainer | undefined, @Param('id') id: string) {
    return { challenge: this.views.challenge(this.challenges.find(checked(id)), t?.id) };
  }

  @Delete('challenges/:id')
  @MaybeAuthenticated()
  close(@CurrentTrainer() t: Trainer | undefined, @Param('id') id: string) {
    return { challenge: this.views.challenge(this.challenges.close(t, checked(id)), t!.id) };
  }

  @Post('challenges/:id/accept')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  accept(@CurrentTrainer() t: Trainer, @Param('id') id: string) {
    return { challenge: this.views.challenge(this.challenges.accept(t, checked(id)), t.id) };
  }

  /** Open rooms and tournaments anyone can join (the lobby list, also pushed over the socket). */
  @Get('rooms')
  @MaybeAuthenticated()
  rooms(@CurrentTrainer() t: Trainer | undefined) {
    return { rooms: this.lobby.list(t?.id ?? null) };
  }

  /** Your 1v1 history (paged) and your tournaments. */
  @Get('me/challenges')
  @Authenticated()
  mine(@CurrentTrainer() t: Trainer, @Query({ schema: HistoryQueryDto }) page: HistoryQueryDto) {
    return this.challenges.history(t, page);
  }
}

/** Ids outside the format can't exist: answer like an unknown room. */
function checked(id: string): string {
  return ROOM_ID.test(id) ? id : '\u0000';
}
