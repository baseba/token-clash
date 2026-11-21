// Events of the arena. A finished match doesn't know about tournaments or the Tower (the dependency
// goes the other way: they use matches), so it announces that it ended and whoever cares — the
// tournament or the climb that scheduled it — reacts.
import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import type { Challenge } from '../domain/challenge.js';

export interface MatchFinished {
  challenge: Challenge;
  /** Battle side that won (0 host, 1 guest), or null for a draw. */
  winnerSide: number | null;
}

@Injectable()
export class ArenaEvents {
  private readonly emitter = new EventEmitter();

  matchFinished(event: MatchFinished): void {
    this.emitter.emit('match-finished', event);
  }

  onMatchFinished(listener: (event: MatchFinished) => void): void {
    this.emitter.on('match-finished', listener);
  }
}
