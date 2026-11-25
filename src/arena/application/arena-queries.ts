import { Injectable } from '@nestjs/common';
import { ChallengeRepository, TournamentRepository } from '../domain/arena.repositories.js';
import { isHumanDuel, type BattleMode, type Challenge, type Visibility } from '../domain/challenge.js';
import type { Tournament, TournamentStatus } from '../domain/tournament.js';
import { ArenaViews } from './arena-views.js';
import { Presence } from './presence.js';

export interface SharedTrainer {
  name: string;
  avatar: string;
}

export interface SharedDuel {
  open: boolean;
  mode: BattleMode;
  visibility: Visibility;
  host: SharedTrainer;
}

export interface SharedTournament {
  status: TournamentStatus;
  mode: BattleMode;
  visibility: Visibility;
  size: number;
  host: string;
  seats: SharedTrainer[];
}

@Injectable()
export class ArenaQueries {
  constructor(
    private readonly challenges: ChallengeRepository,
    private readonly tournaments: TournamentRepository,
    private readonly presence: Presence,
    private readonly views: ArenaViews,
  ) {}

  allChallenges(): readonly Challenge[] {
    return this.challenges.all();
  }

  allTournaments(): readonly Tournament[] {
    return this.tournaments.all();
  }

  challengeStatus(id: string): Challenge['status'] | null {
    return this.challenges.findById(id)?.status ?? null;
  }

  sharedDuel(id: string): SharedDuel | null {
    const challenge = this.challenges.findById(id);
    if (!challenge) return null;
    return {
      open: challenge.status === 'open' && isHumanDuel(challenge),
      mode: challenge.mode,
      visibility: challenge.visibility,
      host: { name: this.views.nameOf(challenge.hostId, challenge.hostName) ?? challenge.hostName, avatar: this.views.avatarOf(challenge.hostId, challenge) },
    };
  }

  sharedTournament(id: string): SharedTournament | null {
    const tournament = this.tournaments.findById(id);
    if (!tournament) return null;
    const room = { id: tournament.id, tournamentId: tournament.id };
    const seats = tournament.seats.map((seat) => ({ name: this.views.nameOf(seat.ai ? null : seat.id, seat.name) ?? seat.name, avatar: this.views.avatarOf(seat.id, room) }));
    return {
      status: tournament.status,
      mode: tournament.mode,
      visibility: tournament.visibility,
      size: tournament.size,
      host: this.views.nameOf(tournament.hostId, tournament.seats[0]?.name) ?? '',
      seats,
    };
  }

  liveBattles(): number {
    return this.presence.liveBattles();
  }

  busyRooms(): number {
    return this.presence.busyRooms();
  }
}
