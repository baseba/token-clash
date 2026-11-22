// The Tower's cast (public/tower-cast.js, shared with the browser) with its types.
import * as cast from '../../../public/tower-cast.js';

export type Region = 'kanto' | 'johto' | 'hoenn' | 'sinnoh' | 'unova' | 'kalos' | 'alola' | 'galar' | 'paldea';
export type RoomKind = 'trainer' | 'tough' | 'calm' | 'rest' | 'den' | 'hideout' | 'deal';

export interface RoomInfo {
  label: string;
  icon: string;
  battle: boolean;
  hint: string;
}

export const TOWER_LENGTHS: readonly (number | null)[] = cast.TOWER_LENGTHS;
export const GYM_EVERY: number = cast.GYM_EVERY;
export const LEAGUE_BLOCK: number = cast.LEAGUE_BLOCK;
export const ELITE_FLOORS: number = cast.ELITE_FLOORS;
export const PARTY_LIMIT: number = cast.PARTY_LIMIT;
export const START_LEVEL: number = cast.START_LEVEL;
export const MAX_LEVEL: number = cast.MAX_LEVEL;
export const LAB_OFFERS: number = cast.LAB_OFFERS;
export const STARTERS: number = cast.STARTERS;
export const LAB_SCENE: string = cast.LAB_SCENE;
export const PROFESSOR: { key: string; name: string } = cast.PROFESSOR;
export const TYPE_SCENES: Readonly<Record<string, readonly string[]>> = cast.TYPE_SCENES;
export const ROUTE_SCENES: readonly string[] = cast.ROUTE_SCENES;
export const REGIONS = cast.REGIONS as Readonly<Record<Region, readonly string[]>>;
export const MUSIC = cast.MUSIC as {
  gym: Readonly<Record<Region, string>>;
  elite: Readonly<Record<Region, string>>;
  champion: Readonly<Record<Region, string>>;
  route: string;
  lateRoute: string;
  hideout: string;
};
export const NAMES: Readonly<Record<'m' | 'f', readonly string[]>> = cast.NAMES;
export type Line = readonly [string, string];
export const FEMALE_CLASSES: readonly string[] = cast.FEMALE_CLASSES;
export const PAIR_CLASSES = cast.PAIR_CLASSES as Readonly<Record<string, 'mm' | 'ff' | 'mf' | 'fm'>>;
export const NAMED_CLASSES: Readonly<Record<string, string>> = cast.NAMED_CLASSES;
export const TYPE_LINES = cast.TYPE_LINES as unknown as Readonly<Record<string, readonly Line[]>>;
export const CLASS_LINES = cast.CLASS_LINES as unknown as Readonly<Record<string, readonly Line[]>>;
export const PAIR_LINES = cast.PAIR_LINES as unknown as readonly Line[];
export const ROOM_LINES = cast.ROOM_LINES as unknown as Readonly<Partial<Record<RoomKind, readonly Line[]>>>;
export const VILLAIN_LINES = cast.VILLAIN_LINES as unknown as Readonly<Record<string, readonly Line[]>>;
export const BOSS_LINES = cast.BOSS_LINES as unknown as Readonly<Record<string, Line>>;
export const RECRUIT_LINE: string = cast.RECRUIT_LINE;
export type TwistKey = 'night' | 'market' | 'wild' | 'tutors' | 'sweet' | 'migration' | 'caps';
export const TWIST_KEYS = cast.TWIST_KEYS as TwistKey[];
export const ROOMS = cast.ROOMS as Readonly<Record<RoomKind, RoomInfo>>;
export const ROOM_KINDS = Object.keys(cast.ROOMS) as [RoomKind, ...RoomKind[]];
