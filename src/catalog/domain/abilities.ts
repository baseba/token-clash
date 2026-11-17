// Abilities as catalog facts: their Spanish name and description (from PokeAPI) and the ones that
// have no effect in Token Clash (INERT) and why. What each ability *does* in battle is a combat rule:
// see combat/domain/ability-effects.ts.
import { readFileSync } from 'node:fs';
import { catalogFile } from '../../shared/paths.js';

export interface AbilityInfo {
  key: string;
  name: string;
  desc: string;
  inert?: string;
}

const CATALOG = JSON.parse(readFileSync(catalogFile('abilities.json'), 'utf8')) as Record<string, { name: string; desc: string }>;

export const INERT_REASONS: Record<string, string> = {
  items: 'Token Clash no tiene objetos ni bayas.',
  doubles: 'Solo actúa sobre aliados, en combates dobles.',
  field: 'Solo actúa fuera del combate.',
  moves: 'Depende de movimientos que no existen en Token Clash.',
  tera: 'Depende de la teracristalización, que no existe en Token Clash.',
};

export const INERT: Record<string, string> = {
  'run-away': 'field', pickup: 'items', plus: 'doubles', minus: 'doubles',
  'sticky-hold': 'items', gluttony: 'items', unburden: 'items', klutz: 'items', 'honey-gather': 'field',
  frisk: 'items', multitype: 'items', pickpocket: 'items', unnerve: 'items', healer: 'doubles',
  'friend-guard': 'doubles', 'heavy-metal': 'moves', 'light-metal': 'moves', harvest: 'items',
  telepathy: 'doubles',
  'cheek-pouch': 'items', magician: 'items', symbiosis: 'items', battery: 'doubles', receiver: 'doubles',
  'power-of-alchemy': 'doubles', 'rks-system': 'items', 'ball-fetch': 'items', 'propeller-tail': 'doubles',
  stalwart: 'doubles', ripen: 'items', 'power-spot': 'doubles',
  'unseen-fist': 'moves', 'curious-medicine': 'doubles', commander: 'doubles',
  'cud-chew': 'items', costar: 'doubles', hospitality: 'doubles',
  'embody-aspect': 'tera', 'teraform-zero': 'tera', 'piercing-drill': 'moves',
};

export function abilityInfo(key: string | null | undefined): AbilityInfo | null {
  if (!key) return null;
  const info = CATALOG[key];
  const inert = INERT[key];
  return {
    key,
    name: info?.name ?? key,
    desc: info?.desc ?? '',
    ...(inert ? { inert: INERT_REASONS[inert] } : {}),
  };
}

export function knownAbility(key: string): boolean {
  return Object.hasOwn(CATALOG, key);
}
