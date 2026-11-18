// Use cases of the trainers context. This is the context's public face: other contexts (arena,
// stats, realtime) talk to trainers only through this service, never through its repository or
// its tables. TrainersModule exports this class and nothing else.

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { newId, newToken, now, sha256 } from '../../shared/domain/clock.js';
import { invalid } from '../../shared/domain/errors.js';
import type { RecycledRecord } from '../domain/recycling.js';
import { parseSave } from '../domain/save-file.js';
import { cleanName, Trainer, type EquipKind } from '../domain/trainer.js';
import { TrainerRepository } from '../domain/trainer.repository.js';

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{20,100}$/;

export interface ProfileChanges {
  name?: string;
  avatar?: string;
  team?: string[];
  nickname?: { id: string; name: string } | null;
}

@Injectable()
export class TrainersService implements OnModuleInit {
  private readonly logger = new Logger(TrainersService.name);

  constructor(private readonly trainers: TrainerRepository) {}

  onModuleInit(): void {
    // Saves imported by older versions kept repeated species: tidy them once at startup.
    let fixed = 0;
    let relooked = 0;
    for (const trainer of this.trainers.all()) {
      const dropped = trainer.dropRepeatedSpecies();
      const released = trainer.releaseShopLook();
      if (dropped || released) this.trainers.save(trainer);
      if (dropped) fixed += 1;
      if (released) relooked += 1;
    }
    if (fixed) this.logger.log(`Quité especies repetidas de ${fixed} entrenador(es).`);
    if (relooked) this.logger.log(`${relooked} entrenador(es) tenían un entrenador que ahora se vende en la tienda: les tocó otro.`);
  }

  byId(id: string | null | undefined): Trainer | undefined {
    return id ? this.trainers.findById(id) : undefined;
  }

  all(): Trainer[] {
    return this.trainers.all();
  }

  /** Who owns a session token, without marking them as seen (the lobby list does this). */
  peekToken(token: string | undefined): Trainer | undefined {
    return token === undefined ? undefined : this.trainers.findByTokenHash(sha256(token));
  }

  /** Who owns a session token, and mark them as seen now (feeds "active now" in the stats). */
  authenticate(token: string): Trainer | undefined {
    const trainer = this.peekToken(token);
    if (trainer) {
      trainer.lastSeen = now();
      this.trainers.saveLastSeen(trainer);
    }
    return trainer;
  }

  /** Same, from an `Authorization: Bearer <token>` header. */
  authenticateHeader(header: string | undefined): Trainer | undefined {
    const match = /^Bearer (.+)$/.exec(header ?? '');
    return match && TOKEN_FORMAT.test(match[1]) ? this.authenticate(match[1]) : undefined;
  }

  /**
   * Imports a save. Without a session it registers a new trainer and returns their token (shown
   * once: only its hash is stored). With a session it updates that trainer's collection.
   */
  importSave(current: Trainer | undefined, input: { save: string; name?: string }): { token: string | null; trainer: Trainer } {
    const parsed = parseSave(input.save);
    const name = cleanName(input.name ?? '');
    let trainer = current;
    let token: string | null = null;
    if (!trainer) {
      if (!name) throw invalid('Ponte un nombre de entrenador.');
      token = newToken();
      trainer = Trainer.register({ id: newId(), name, tokenHash: sha256(token), at: now() });
    } else if (name) trainer.rename(name);
    trainer.importSave(parsed, now());
    this.trainers.save(trainer);
    return { token, trainer };
  }

  /** @throws {DomainError} the chosen look is not a trainer sprite */
  updateProfile(trainer: Trainer, changes: ProfileChanges): Trainer {
    if (changes.name !== undefined) trainer.rename(changes.name);
    if (changes.avatar !== undefined) trainer.chooseAvatar(changes.avatar);
    if (changes.team) trainer.chooseTeam(changes.team);
    if (changes.nickname) trainer.setNickname(changes.nickname.id, changes.nickname.name);
    trainer.touch(now());
    this.trainers.save(trainer);
    return trainer;
  }

  /** @throws {DomainError} the item doesn't exist, is already owned, or the balance is short */
  buy(trainer: Trainer, itemId: string): Trainer {
    trainer.buy(itemId);
    trainer.touch(now());
    this.trainers.save(trainer);
    return trainer;
  }

  /** @throws {DomainError} the Pokémon is not a repeated one, or it was already recycled */
  recycle(trainer: Trainer, entryId: string): RecycledRecord {
    const record = trainer.recycle(entryId, now());
    trainer.touch(now());
    this.trainers.save(trainer);
    return record;
  }

  /** @throws {DomainError} the item doesn't exist or wasn't bought */
  equip(trainer: Trainer, kind: EquipKind, key: string | null): Trainer {
    trainer.equip(kind, key);
    trainer.touch(now());
    this.trainers.save(trainer);
    return trainer;
  }

  updateMon(trainer: Trainer, entryId: string, changes: { moves?: string[]; ability?: string }): Trainer {
    trainer.entry(entryId); // 404 before anything else
    if (changes.moves !== undefined) trainer.chooseMoves(entryId, changes.moves);
    if (changes.ability !== undefined) trainer.chooseAbility(entryId, changes.ability);
    trainer.touch(now());
    this.trainers.save(trainer);
    return trainer;
  }

  /** A ranked 1v1 ended. The arena decides whether a match is ranked; trainers keep the score. */
  recordRankedResult(winnerId: string, loserId: string): void {
    const winner = this.trainers.findById(winnerId);
    const loser = this.trainers.findById(loserId);
    if (winner) {
      winner.recordWin();
      this.trainers.save(winner);
    }
    if (loser) {
      loser.recordLoss();
      this.trainers.save(loser);
    }
  }
}
