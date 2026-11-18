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
export const DEFAULT_BALL: string = shop.DEFAULT_BALL;
export const shopItem = (id: string): ShopItem | null => shop.shopItem(id) as ShopItem | null;
export const shopItemOf = (kind: ShopKind, key: string): ShopItem | null => shop.shopItemOf(kind, key) as ShopItem | null;
