import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import type { Trainer } from '../../trainers/domain/trainer.js';
import { Authenticated, CurrentTrainer } from '../../trainers/interface/session.guard.js';
import { RadioService } from '../application/radio.service.js';
import { OpenStationDto, StationQueueDto } from './dto/station.dto.js';

const NO_SESSION = 'Primero importa tu equipo para abrir una estación.';

@Controller('api/radio')
export class RadioController {
  constructor(private readonly radio: RadioService) {}

  @Get('stations')
  list() {
    return { stations: this.radio.list() };
  }

  @Get('stations/:ownerId')
  get(@Param('ownerId') ownerId: string) {
    return { station: this.radio.byOwner(ownerId) };
  }

  @Put('station')
  @Authenticated(NO_SESSION)
  open(@CurrentTrainer() trainer: Trainer, @Body({ schema: OpenStationDto }) body: OpenStationDto) {
    return { station: this.radio.open(trainer.id, body.name) };
  }

  @Delete('station')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  close(@CurrentTrainer() trainer: Trainer) {
    this.radio.close(trainer.id);
    return { station: null };
  }

  @Put('station/queue')
  @Authenticated(NO_SESSION)
  setQueue(@CurrentTrainer() trainer: Trainer, @Body({ schema: StationQueueDto }) body: StationQueueDto) {
    return { station: this.radio.setQueue(trainer.id, body.queue, body.playing) };
  }

  @Post('station/skip')
  @HttpCode(200)
  @Authenticated(NO_SESSION)
  skip(@CurrentTrainer() trainer: Trainer) {
    return { station: this.radio.skip(trainer.id) };
  }
}
