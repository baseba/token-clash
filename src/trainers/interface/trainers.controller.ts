// HTTP entry points of the trainers context. Controllers are thin: read the request, call one use
// case, present the result. Rules live in the domain; orchestration in TrainersService.
import { All, Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { pokedexOf } from '../../catalog/domain/pokedex.js';
import { SkynetService } from '../../combat/application/skynet.service.js';
import { HttpError } from '../../shared/http/http-error.js';
import { RateLimit } from '../../shared/http/rate-limit.guard.js';
import { TrainersService, type ProfileChanges } from '../application/trainers.service.js';
import type { Trainer } from '../domain/trainer.js';
import { Authenticated, CurrentTrainer, MaybeAuthenticated } from './session.guard.js';
import { monDetail, myView, trainerSummary } from './trainer.presenter.js';

@Controller('api')
export class TrainersController {
  constructor(
    private readonly trainers: TrainersService,
    private readonly skynet: SkynetService,
  ) {}

  /** Upload a save: registers you (first time) or updates your collection. */
  @Post('import')
  @HttpCode(200)
  @RateLimit({ bucket: 'import', by: 'ip', max: 20, windowMs: 10 * 60_000, message: 'Demasiadas importaciones, espera unos minutos.' })
  @MaybeAuthenticated()
  import(@CurrentTrainer() current: Trainer | undefined, @Body() body: { save?: unknown; name?: unknown }) {
    const { token, trainer } = this.trainers.importSave(current, { save: body.save, name: body.name });
    return { token, me: myView(trainer, this.skynet.aiLevels) };
  }

  @Get('me')
  @Authenticated()
  me(@CurrentTrainer() t: Trainer) {
    return { me: myView(t, this.skynet.aiLevels) };
  }

  @Put('me')
  @Authenticated()
  updateMe(@CurrentTrainer() t: Trainer, @Body() body: ProfileChanges) {
    return { me: myView(this.trainers.updateProfile(t, body), this.skynet.aiLevels) };
  }

  @Get('me/mons/:id')
  @Authenticated()
  mon(@CurrentTrainer() t: Trainer, @Param('id') id: string) {
    return { mon: monDetail(t.entry(id)) };
  }

  @Put('me/mons/:id')
  @Authenticated()
  updateMon(@CurrentTrainer() t: Trainer, @Param('id') id: string, @Body() body: { moves?: unknown; ability?: unknown }) {
    this.trainers.updateMon(t, id, body);
    return { mon: monDetail(t.entry(id)) };
  }

  @All('me/mons/:id')
  @Authenticated()
  monOtherMethods(@CurrentTrainer() t: Trainer, @Param('id') id: string) {
    t.entry(id); // 404 first, like the routes above
    throw new HttpError(405, 'Método no permitido');
  }

  /** Species you have registered (owned, or an earlier form of one you own). */
  @Get('pokedex')
  @Authenticated()
  pokedex(@CurrentTrainer() t: Trainer) {
    return { pokedex: pokedexOf(t.roster) };
  }

  @Get('leaderboard')
  leaderboard() {
    const list = this.trainers
      .all()
      .map(trainerSummary)
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.totalTokens - a.totalTokens)
      .slice(0, 50);
    return { trainers: list };
  }
}
