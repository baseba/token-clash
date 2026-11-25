import * as chart from '../../../public/types.js';

export interface TypeInfo {
  label: string;
  color: string;
}

export const TYPES: Readonly<Record<string, TypeInfo>> = chart.TYPES;

export const effectiveness = (moveType: string | null | undefined, defTypes: string | readonly string[] | null | undefined): number =>
  chart.effectiveness(moveType, defTypes);
