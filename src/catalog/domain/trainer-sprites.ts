import * as sprites from '../../../public/trainer-sprites.js';

export const TRAINER_SPRITES: readonly string[] = sprites.TRAINER_SPRITES;
export const STARTER_SPRITES: readonly string[] = sprites.STARTER_SPRITES;
export const GYM_LEADERS: Readonly<Record<string, readonly string[]>> = sprites.GYM_LEADERS;
export const ELITE_FOUR: Readonly<Record<string, string>> = sprites.ELITE_FOUR;
export const CHAMPIONS: readonly string[] = sprites.CHAMPIONS;
export const VILLAINS: Readonly<Record<'admin' | 'boss' | 'legend' | 'star' | 'partner', readonly string[]>> = sprites.VILLAINS;
export const SPECIALS: readonly string[] = sprites.SPECIALS;
export const SHOP_TRAINERS: Readonly<Record<string, string>> = sprites.SHOP_TRAINERS;
export const isShopTrainer = (key: string): boolean => key in sprites.SHOP_TRAINERS;
export const isTrainerSprite = (key: string): boolean => sprites.isTrainerSprite(key);
export const trainerSpriteFor = (seed: string, pool: readonly string[] = TRAINER_SPRITES): string => sprites.trainerSpriteFor(seed, [...pool]);
