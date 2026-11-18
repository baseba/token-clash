import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import type { Trainer } from '../../trainers/domain/trainer.js';
import { BuyDto, EquipDto } from '../../trainers/interface/dto/shop.dto.js';
import { Authenticated, CurrentTrainer } from '../../trainers/interface/session.guard.js';
import { shopView } from '../../trainers/interface/trainer.presenter.js';
import { AchievementsService } from '../application/achievements.service.js';
import { ChooseLookDto } from './dto/choose-look.dto.js';

@Controller('api')
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  private shop(trainer: Trainer) {
    const view = shopView(trainer);
    const unlocked = this.achievements.available(trainer);
    return { ...view, items: view.items.map((item) => (item.requires ? { ...item, available: unlocked(item.requires) } : item)) };
  }

  @Get('me/achievements')
  @Authenticated()
  list(@CurrentTrainer() trainer: Trainer) {
    return { sprites: this.achievements.progress(trainer) };
  }

  @Put('me/look')
  @Authenticated()
  chooseLook(@CurrentTrainer() trainer: Trainer, @Body({ schema: ChooseLookDto }) body: ChooseLookDto) {
    return { avatar: this.achievements.chooseLook(trainer, body.avatar).look };
  }

  @Get('shop')
  @Authenticated()
  shopFor(@CurrentTrainer() trainer: Trainer) {
    return { shop: this.shop(trainer) };
  }

  @Put('me/equip')
  @Authenticated()
  equip(@CurrentTrainer() trainer: Trainer, @Body({ schema: EquipDto }) body: EquipDto) {
    return { shop: this.shop(this.achievements.equip(trainer, body.kind, body.key)) };
  }

  @Post('shop/buy')
  @HttpCode(200)
  @Authenticated()
  buy(@CurrentTrainer() trainer: Trainer, @Body({ schema: BuyDto }) body: BuyDto) {
    return { shop: this.shop(this.achievements.buy(trainer, body.item)) };
  }
}
