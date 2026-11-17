// The 18 types and their chart. public/types.js is the single source, shared with the browser
// (which loads it as is); this file gives it types for the server. It compiles to
// dist/public/types.js (allowJs), so the relative import works from src/ and from dist/src/.
import * as chart from '../../../public/types.js';

export interface TypeInfo {
  label: string;
  color: string;
}

export const TYPES: Readonly<Record<string, TypeInfo>> = chart.TYPES;

export const typeLabel = (type: string): string => chart.typeLabel(type);

/**
 * How much a move of `moveType` does to a creature with `defTypes`: the product of the chart over
 * each defending type (0, 0.25, 0.5, 1, 2 or 4).
 */
export const effectiveness = (moveType: string | null | undefined, defTypes: string | readonly string[] | null | undefined): number =>
  chart.effectiveness(moveType, defTypes);
