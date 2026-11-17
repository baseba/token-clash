// HTTP entry points of the trainers context. Controllers are thin: read the request, call one use
// case, present the result. Rules live in the domain; orchestration in TrainersService.
import { All, Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { pokedexOf } from '../../catalog/domain/pokedex.js';
import { SkynetService } from '../../combat/application/skynet.service.js';
import { HttpError } from '../../shared/http/http-error.js';
import { RateLimit } from '../../shared/http/rate-limit.guard.js';
import { TrainersService } from '../application/trainers.service.js';
import { byRanking } from '../domain/ranking.js';
import type { Trainer } from '../domain/trainer.js';
import { ImportSaveDto } from './dto/import-save.dto.js';
import { UpdateMonDto } from './dto/update-mon.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
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
  import(@CurrentTrainer() current: Trainer | undefined, @Body({ schema: ImportSaveDto }) body: ImportSaveDto) {
    const { token, trainer } = this.trainers.importSave(current, body);
    return { token, me: myView(trainer, this.skynet.aiLevels) };
  }

  @Get('me')
  @Authenticated()
  me(@CurrentTrainer() trainer: Trainer) {
    return { me: myView(trainer, this.skynet.aiLevels) };
  }

  @Put('me')
  @Authenticated()
  updateMe(@CurrentTrainer() trainer: Trainer, @Body({ schema: UpdateProfileDto }) body: UpdateProfileDto) {
    return { me: myView(this.trainers.updateProfile(trainer, body), this.skynet.aiLevels) };
  }

  @Get('me/mons/:id')
  @Authenticated()
  mon(@CurrentTrainer() trainer: Trainer, @Param('id') id: string) {
    return { mon: monDetail(trainer.entry(id)) };
  }

  @Put('me/mons/:id')
  @Authenticated()
  updateMon(@CurrentTrainer() trainer: Trainer, @Param('id') id: string, @Body({ schema: UpdateMonDto }) body: UpdateMonDto) {
    this.trainers.updateMon(trainer, id, body);
    return { mon: monDetail(trainer.entry(id)) };
  }

  @All('me/mons/:id')
  @Authenticated()
  monOtherMethods(@CurrentTrainer() trainer: Trainer, @Param('id') id: string) {
    trainer.entry(id); // 404 first, like the routes above
    throw new HttpError(405, 'Método no permitido');
  }

  /** Species you have registered (owned, or an earlier form of one you own). */
  @Get('pokedex')
  @Authenticated()
  pokedex(@CurrentTrainer() trainer: Trainer) {
    return { pokedex: pokedexOf(trainer.roster) };
  }

  @Get('leaderboard')
  leaderboard() {
    return { trainers: this.trainers.all().map(trainerSummary).sort(byRanking).slice(0, 50) };
  }
}
