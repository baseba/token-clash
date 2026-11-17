import { All, Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { HttpError } from '../../shared/http/http-error.js';
import { RateLimit } from '../../shared/http/rate-limit.guard.js';
import type { Trainer } from '../../trainers/domain/trainer.js';
import { Authenticated, CurrentTrainer, MaybeAuthenticated } from '../../trainers/interface/session.guard.js';
import { ArenaViews } from '../application/arena-views.js';
import { TournamentsService } from '../application/tournaments.service.js';
import type { Tournament } from '../domain/tournament.js';
import { NewTournamentDto } from './dto/new-tournament.dto.js';
import { AddAisDto, SetReadyDto } from './dto/tournament-actions.dto.js';

const NO_SESSION = 'Primero importa tu equipo.';

@Controller('api/tournaments')
export class TournamentsController {
  constructor(
    private readonly tournaments: TournamentsService,
    private readonly views: ArenaViews,
  ) {}

  @Post()
  @HttpCode(200)
  @RateLimit({ bucket: 'challenge', by: 'trainer', max: 30, windowMs: 10 * 60_000, message: 'Demasiados desafíos, espera unos minutos.' })
  @Authenticated(NO_SESSION)
  create(@CurrentTrainer() trainer: Trainer, @Body({ schema: NewTournamentDto }) body: NewTournamentDto) {
    const { tournament, joined } = this.tournaments.create(trainer, body);
    return { tournament: this.views.tournament(tournament, trainer.id), ...(joined ? { joined } : {}) };
  }

  @Get(':id')
  @MaybeAuthenticated()
  get(@CurrentTrainer() trainer: Trainer | undefined, @Param('id') id: string) {
    return { tournament: this.views.tournament(this.tournaments.find(id), trainer?.id) };
  }

  @Delete(':id')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  close(@CurrentTrainer() trainer: Trainer, @Param('id') id: string) {
    return this.after(trainer, id, (T) => this.tournaments.closeByHost(T, trainer));
  }

  @Post(':id/join')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  join(@CurrentTrainer() trainer: Trainer, @Param('id') id: string) {
    return this.after(trainer, id, (T) => this.tournaments.join(T, trainer));
  }

  @Post(':id/leave')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  leave(@CurrentTrainer() trainer: Trainer, @Param('id') id: string) {
    return this.after(trainer, id, (T) => this.tournaments.leave(T, trainer));
  }

  @Post(':id/ready')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  ready(@CurrentTrainer() trainer: Trainer, @Param('id') id: string, @Body({ schema: SetReadyDto }) body: SetReadyDto) {
    return this.after(trainer, id, (T) => this.tournaments.setReady(T, trainer, body.ready));
  }

  @Post(':id/ai')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  addAi(@CurrentTrainer() trainer: Trainer, @Param('id') id: string, @Body({ schema: AddAisDto }) body: AddAisDto) {
    return this.after(trainer, id, (T) => this.tournaments.addAis(T, trainer, body));
  }

  @Delete(':id/seats/:seat')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  kick(@CurrentTrainer() trainer: Trainer, @Param('id') id: string, @Param('seat') seat: string) {
    if (!/^\d+$/.test(seat)) throw new HttpError(404, 'No encontrado');
    return this.after(trainer, id, (T) => this.tournaments.kick(T, trainer, Number(seat)));
  }

  @All([':id', ':id/join', ':id/leave', ':id/ready', ':id/ai', ':id/seats/:seat'])
  @MaybeAuthenticated()
  otherMethods(@CurrentTrainer() trainer: Trainer | undefined, @Param('id') id: string) {
    this.tournaments.find(id);
    if (!trainer) throw new HttpError(401, NO_SESSION);
    throw new HttpError(405, 'Método no permitido');
  }

  /** Runs a change on an existing tournament and answers with how it looks now. */
  private after(trainer: Trainer, id: string, change: (tournament: Tournament) => void) {
    const tournament = this.tournaments.find(id);
    change(tournament);
    return { tournament: this.views.tournament(tournament, trainer.id) };
  }
}
