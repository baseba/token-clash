import { MAJOR_STATUSES, type MajorStatus, type Weather } from '../../catalog/domain/creatures.js';

export const isSun = (weather: Weather | null): boolean => weather === 'sun' || weather === 'harshsun';
export const isRain = (weather: Weather | null): boolean => weather === 'rain' || weather === 'heavyrain';
export const isIcy = (weather: Weather | null): boolean => weather === 'snow' || weather === 'hail';

const MAJOR = new Set<string | null>(MAJOR_STATUSES);
export const isMajorStatus = (status: string | null): status is MajorStatus => MAJOR.has(status);
export const poisoned = (status: string | null): status is 'psn' | 'tox' => status === 'psn' || status === 'tox';

export const stageMult = (stage: number): number => (stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage));
