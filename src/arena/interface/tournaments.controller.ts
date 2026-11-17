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
  create(@CurrentTrainer() t: Trainer, @Body({ schema: NewTournamentDto }) body: NewTournamentDto) {
    const { tournament, joined } = this.tournaments.create(t, body);
    return { tournament: this.views.tournament(tournament, t.id), ...(joined ? { joined } : {}) };
  }

  @Get(':id')
  @MaybeAuthenticated()
  get(@CurrentTrainer() t: Trainer | undefined, @Param('id') id: string) {
    return { tournament: this.views.tournament(this.tournaments.find(id), t?.id) };
  }

  @Delete(':id')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  close(@CurrentTrainer() t: Trainer, @Param('id') id: string) {
    return this.after(t, id, (T) => this.tournaments.closeByHost(T, t));
  }

  @Post(':id/join')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  join(@CurrentTrainer() t: Trainer, @Param('id') id: string) {
    return this.after(t, id, (T) => this.tournaments.join(T, t));
  }

  @Post(':id/leave')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  leave(@CurrentTrainer() t: Trainer, @Param('id') id: string) {
    return this.after(t, id, (T) => this.tournaments.leave(T, t));
  }

  @Post(':id/ready')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  ready(@CurrentTrainer() t: Trainer, @Param('id') id: string, @Body({ schema: SetReadyDto }) body: SetReadyDto) {
    return this.after(t, id, (T) => this.tournaments.setReady(T, t, body.ready));
  }

  @Post(':id/ai')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  addAi(@CurrentTrainer() t: Trainer, @Param('id') id: string, @Body({ schema: AddAisDto }) body: AddAisDto) {
    return this.after(t, id, (T) => this.tournaments.addAis(T, t, body));
  }

  @Delete(':id/seats/:seat')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  kick(@CurrentTrainer() t: Trainer, @Param('id') id: string, @Param('seat') seat: string) {
    if (!/^\d+$/.test(seat)) throw new HttpError(404, 'No encontrado');
    return this.after(t, id, (T) => this.tournaments.kick(T, t, Number(seat)));
  }

  @All([':id', ':id/join', ':id/leave', ':id/ready', ':id/ai', ':id/seats/:seat'])
  @MaybeAuthenticated()
  otherMethods(@CurrentTrainer() t: Trainer | undefined, @Param('id') id: string) {
    this.tournaments.find(id);
    if (!t) throw new HttpError(401, NO_SESSION);
    throw new HttpError(405, 'Método no permitido');
  }

  /** Runs a change on an existing tournament and answers with how it looks now. */
  private after(t: Trainer, id: string, change: (T: Tournament) => void) {
    const T = this.tournaments.find(id);
    change(T);
    return { tournament: this.views.tournament(T, t.id) };
  }
}
