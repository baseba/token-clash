import { All, Body, Controller, Get, Headers, HttpCode, Param, Post, Put } from '@nestjs/common';
import { pokedexOf } from '../../catalog/domain/pokedex.js';
import { SkynetService } from '../../combat/application/skynet.service.js';
import { HttpError } from '../../platform/http/http-error.js';
import { RateLimit } from '../../platform/http/rate-limit.guard.js';
import { AccountsService } from '../application/accounts.service.js';
import { ShopService } from '../application/shop.service.js';
import { TrainersService } from '../application/trainers.service.js';
import { byRanking } from '../domain/ranking.js';
import type { Trainer } from '../domain/trainer.js';
import { LogInDto, SetPasswordDto } from './dto/credentials.dto.js';
import { ImportSaveDto } from './dto/import-save.dto.js';
import { UpdateMonDto } from './dto/update-mon.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { Authenticated, CurrentSessionToken, CurrentTrainer, MaybeAuthenticated } from './session.guard.js';
import { monDetail, myView, recyclingView, trainerSummary } from './trainer.presenter.js';
import { RecycleDto } from './dto/recycle.dto.js';
import { SyncSaveDto } from './dto/sync-save.dto.js';

@Controller('api')
export class TrainersController {
  constructor(
    private readonly trainers: TrainersService,
    private readonly accounts: AccountsService,
    private readonly shop: ShopService,
    private readonly skynet: SkynetService,
  ) {}

  @Post('import')
  @HttpCode(200)
  @RateLimit({ bucket: 'import', by: 'ip', max: 20, windowMs: 10 * 60_000, message: 'Demasiadas importaciones, espera unos minutos.' })
  @MaybeAuthenticated()
  import(@CurrentTrainer() current: Trainer | undefined, @Body({ schema: ImportSaveDto }) body: ImportSaveDto) {
    const { token, trainer } = this.trainers.importSave(current, body);
    return { token, me: myView(trainer, this.skynet.aiLevels) };
  }

  @Post('login')
  @HttpCode(200)
  @RateLimit({ bucket: 'login', by: 'ip', max: 10, windowMs: 10 * 60_000, message: 'Demasiados intentos, espera unos minutos.' })
  logIn(@Body({ schema: LogInDto }) body: LogInDto) {
    const session = this.accounts.logIn(body);
    if (!session) throw new HttpError(401, 'Nombre o contraseña incorrectos.');
    return { token: session.token, me: myView(session.trainer, this.skynet.aiLevels) };
  }

  @Post('sync')
  @HttpCode(200)
  @RateLimit({ bucket: 'sync', by: 'ip', max: 20, windowMs: 10 * 60_000, message: 'Demasiadas subidas, espera unos minutos.' })
  sync(@Headers('authorization') authorization: string | undefined, @Body({ schema: SyncSaveDto }) body: SyncSaveDto) {
    const trainer = this.trainers.syncSave(authorization, JSON.stringify(body));
    if (!trainer) throw new HttpError(401, 'Nombre o contraseña incorrectos.');
    return { rosterSize: trainer.roster.length, shinies: trainer.shinies, totalTokens: trainer.totalTokens };
  }

  @Post('logout')
  @HttpCode(204)
  @Authenticated()
  logOut(@CurrentTrainer() trainer: Trainer, @CurrentSessionToken() token: string) {
    this.accounts.logOut(trainer, token);
  }

  @Put('me/password')
  @RateLimit({ bucket: 'password', by: 'trainer', max: 10, windowMs: 10 * 60_000, message: 'Demasiados intentos, espera unos minutos.' })
  @Authenticated()
  setPassword(@CurrentTrainer() trainer: Trainer, @Body({ schema: SetPasswordDto }) body: SetPasswordDto) {
    return { me: myView(this.accounts.setPassword(trainer, body), this.skynet.aiLevels) };
  }

  @Get('me/recycling')
  @Authenticated()
  recycling(@CurrentTrainer() trainer: Trainer) {
    return { recycling: recyclingView(trainer) };
  }

  @Post('me/recycling')
  @HttpCode(200)
  @RateLimit({ bucket: 'recycle', by: 'trainer', max: 120, windowMs: 60_000, message: 'Más despacio con la trituradora.' })
  @Authenticated()
  recycle(@CurrentTrainer() trainer: Trainer, @Body({ schema: RecycleDto }) body: RecycleDto) {
    const record = this.shop.recycle(trainer, body.entry);
    return { tokens: record.tokens, recycling: recyclingView(trainer) };
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
    trainer.entry(id);
    throw new HttpError(405, 'Método no permitido');
  }

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
