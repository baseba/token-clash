import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import type { Challenge } from '../domain/challenge.js';

export interface MatchFinished {
  challenge: Challenge;
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
