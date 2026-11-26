import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import type { Trainer } from '../../trainers/domain/trainer.js';
import { Authenticated, CurrentTrainer, MaybeAuthenticated } from '../../trainers/interface/session.guard.js';
import { TowerRecords } from '../application/tower-records.js';
import { TowerRestService } from '../application/tower-rest.service.js';
import { TowerService } from '../application/tower.service.js';
import { TowerViews } from '../application/tower-views.js';
import { DraftDto, EditMonDto, NewClimbDto, RecruitDto, RewardDto, RoomDto } from './dto/tower.dto.js';

const NO_SESSION = 'Primero importa tu equipo.';

@Controller('api/tower')
export class TowerController {
  constructor(
    private readonly tower: TowerService,
    private readonly rest: TowerRestService,
    private readonly towerRecords: TowerRecords,
    private readonly views: TowerViews,
  ) {}

  @Get()
  @Authenticated(NO_SESSION)
  get(@CurrentTrainer() trainer: Trainer) {
    const run = this.towerRecords.current(trainer.id);
    const last = this.towerRecords.last(trainer.id);
    return {
      run: run ? this.views.run(run) : null,
      last: last ? this.views.run(last) : null,
      records: this.views.records(this.towerRecords.records()),
    };
  }

  @Get('records')
  @MaybeAuthenticated()
  records() {
    return { records: this.views.records(this.towerRecords.records()) };
  }

  @Post()
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  start(@CurrentTrainer() trainer: Trainer, @Body({ schema: NewClimbDto }) body: NewClimbDto) {
    return { run: this.views.run(this.tower.start(trainer, body)) };
  }

  @Post('draft')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  draft(@CurrentTrainer() trainer: Trainer, @Body({ schema: DraftDto }) body: DraftDto) {
    return { run: this.views.run(this.tower.draft(trainer, body.offers)) };
  }

  @Post('fight')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  fight(@CurrentTrainer() trainer: Trainer) {
    const { run, challengeId } = this.tower.fight(trainer);
    return { run: this.views.run(run), challengeId };
  }

  @Post('reward')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  reward(@CurrentTrainer() trainer: Trainer, @Body({ schema: RewardDto }) body: RewardDto) {
    return { run: this.views.run(this.rest.takeReward(trainer, body)) };
  }

  @Post('reroll')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  reroll(@CurrentTrainer() trainer: Trainer) {
    return { run: this.views.run(this.rest.reroll(trainer)) };
  }

  @Post('room')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  room(@CurrentTrainer() trainer: Trainer, @Body({ schema: RoomDto }) body: RoomDto) {
    return { run: this.views.run(this.tower.chooseRoom(trainer, body)) };
  }

  @Post('recruit')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  recruit(@CurrentTrainer() trainer: Trainer, @Body({ schema: RecruitDto }) body: RecruitDto) {
    return { run: this.views.run(this.rest.recruit(trainer, body)) };
  }

  @Post('move-on')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  moveOn(@CurrentTrainer() trainer: Trainer) {
    return { run: this.views.run(this.tower.moveOn(trainer)) };
  }

  @Post('party/:uid/hold')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  hold(@CurrentTrainer() trainer: Trainer, @Param('uid') uid: string) {
    return { run: this.views.run(this.rest.holdEvolution(trainer, uid)) };
  }

  @Put('party/:uid')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  edit(@CurrentTrainer() trainer: Trainer, @Param('uid') uid: string, @Body({ schema: EditMonDto }) body: EditMonDto) {
    return { run: this.views.run(this.rest.edit(trainer, uid, body)) };
  }

  @Delete('party/:uid')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  release(@CurrentTrainer() trainer: Trainer, @Param('uid') uid: string) {
    return { run: this.views.run(this.rest.release(trainer, uid)) };
  }

  @Delete()
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  abandon(@CurrentTrainer() trainer: Trainer) {
    return { run: this.views.run(this.tower.abandon(trainer)) };
  }
}
