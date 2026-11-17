// Facts about weather, status and stat stages that the engine, the ability rules and the AI all read.
// It imports nothing from the engine: ability-effects.ts hands these to its rule builders while it loads.
import { MAJOR_STATUSES, type MajorStatus, type Weather } from '../../catalog/domain/creatures.js';

/** Harsh sun counts as sun, and heavy rain as rain, for every rule that reads the weather. */
export const isSun = (weather: Weather | null): boolean => weather === 'sun' || weather === 'harshsun';
export const isRain = (weather: Weather | null): boolean => weather === 'rain' || weather === 'heavyrain';
export const isIcy = (weather: Weather | null): boolean => weather === 'snow' || weather === 'hail';

const MAJOR = new Set<string | null>(MAJOR_STATUSES);
/** Rules that block a status also hear about volatile ones ('confusion'), so they take any string. */
export const isMajorStatus = (status: string | null): status is MajorStatus => MAJOR.has(status);
export const poisoned = (status: string | null): status is 'psn' | 'tox' => status === 'psn' || status === 'tox';

/** How much a stat stage (-6 to +6) multiplies the stat by. */
export const stageMult = (stage: number): number => (stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage));
