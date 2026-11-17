import { Body, Controller, Get, Put } from '@nestjs/common';
import type { Trainer } from '../../trainers/domain/trainer.js';
import { Authenticated, CurrentTrainer } from '../../trainers/interface/session.guard.js';
import { AchievementsService } from '../application/achievements.service.js';
import { ChooseLookDto } from './dto/choose-look.dto.js';

@Controller('api/me')
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  @Get('achievements')
  @Authenticated()
  list(@CurrentTrainer() trainer: Trainer) {
    return { sprites: this.achievements.progress(trainer) };
  }

  @Put('look')
  @Authenticated()
  chooseLook(@CurrentTrainer() trainer: Trainer, @Body({ schema: ChooseLookDto }) body: ChooseLookDto) {
    return { avatar: this.achievements.chooseLook(trainer, body.avatar).look };
  }
}
