import { Injectable } from '@nestjs/common';
import { ChallengeRepository, TournamentRepository } from '../domain/arena.repositories.js';
import type { Challenge } from '../domain/challenge.js';
import type { Tournament } from '../domain/tournament.js';
import { Presence } from './presence.js';

/** Read-only questions other contexts (stats, health) may ask the arena. */
@Injectable()
export class ArenaQueries {
  constructor(
    private readonly challenges: ChallengeRepository,
    private readonly tournaments: TournamentRepository,
    private readonly presence: Presence,
  ) {}

  allChallenges(): readonly Challenge[] {
    return this.challenges.all();
  }

  allTournaments(): readonly Tournament[] {
    return this.tournaments.all();
  }

  liveBattles(): number {
    return this.presence.liveBattles();
  }

  busyRooms(): number {
    return this.presence.busyRooms();
  }
}
