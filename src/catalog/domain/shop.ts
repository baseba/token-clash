import * as shop from '../../../public/shop.js';

export type ShopKind = 'ball' | 'window' | 'frame' | 'trainer';
export interface ShopItem {
  id: string;
  kind: ShopKind;
  key: string;
  name: string;
  rarity: keyof typeof shop.RARITIES;
  price: number;
  desc: string;
  requires?: string;
}

export const SHOP_ITEMS = shop.SHOP_ITEMS as readonly ShopItem[];
export const RARITIES = shop.RARITIES;
export const RETIRED_BALLS = shop.RETIRED_BALLS as Readonly<Record<string, keyof typeof shop.RARITIES>>;
export const DEFAULT_BALL: string = shop.DEFAULT_BALL;
export const aiBallFor = shop.aiBallFor as (roll: number) => string;
export const shopItem = shop.shopItem as (id: string) => ShopItem | null;
export const shopItemOf = shop.shopItemOf as (kind: ShopKind, key: string) => ShopItem | null;
export const isFreeItem = shop.isFreeItem as (id: string) => boolean;
