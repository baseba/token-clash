import { Injectable } from '@nestjs/common';
import { newId, newToken, now, sha256 } from '../../shared/domain/clock.js';
import { conflict, forbidden } from '../../shared/domain/errors.js';
import { checkPassword, hashPassword, passwordMatches } from '../domain/credentials.js';
import { cleanName, nameKey, Trainer } from '../domain/trainer.js';
import { TrainerRepository } from '../domain/trainer.repository.js';
import { bearerToken } from './auth-headers.js';

const DECOY_PASSWORD_HASH = hashPassword(newToken());

export interface Credentials {
  name: string;
  password: string;
}

@Injectable()
export class AccountsService {
  constructor(private readonly trainers: TrainerRepository) {}

  peekToken(token: string | undefined): Trainer | undefined {
    return token === undefined ? undefined : this.trainers.findByTokenHash(sha256(token));
  }

  authenticate(token: string): Trainer | undefined {
    const trainer = this.peekToken(token);
    if (trainer) {
      trainer.lastSeen = now();
      this.trainers.saveLastSeen(trainer);
    }
    return trainer;
  }

  authenticateHeader(header: string | undefined): Trainer | undefined {
    const token = bearerToken(header);
    return token ? this.authenticate(token) : undefined;
  }

  register(name: string, password: string): { token: string; trainer: Trainer } {
    this.ensureNameFree(name);
    checkPassword(password);
    const token = newToken();
    const trainer = Trainer.register({ id: newId(), name, tokenHash: sha256(token), passwordHash: hashPassword(password), at: now() });
    return { token, trainer };
  }

  verify(credentials: Credentials): Trainer | undefined {
    const key = nameKey(credentials.name);
    const trainer = this.trainers.all().find((candidate) => candidate.hasPassword && nameKey(candidate.name) === key);
    const matches = passwordMatches(credentials.password, trainer?.passwordHash ?? DECOY_PASSWORD_HASH);
    return trainer && matches ? trainer : undefined;
  }

  logIn(credentials: Credentials): { token: string; trainer: Trainer } | undefined {
    const trainer = this.verify(credentials);
    if (!trainer) return undefined;
    const token = newToken();
    trainer.openSession(sha256(token), now());
    this.trainers.save(trainer);
    return { token, trainer };
  }

  logOut(trainer: Trainer, token: string): void {
    trainer.closeSession(sha256(token), sha256(newToken()));
    this.trainers.save(trainer);
  }

  setPassword(trainer: Trainer, input: { password: string; currentPassword?: string }): Trainer {
    if (trainer.passwordHash && !passwordMatches(input.currentPassword ?? '', trainer.passwordHash)) throw forbidden('Tu contraseña actual no coincide.');
    if (this.namesake(trainer.name, trainer)) throw conflict(`Otro entrenador también se llama ${trainer.name}: cámbiate el nombre antes de agregar una contraseña, porque con él entras.`);
    checkPassword(input.password);
    trainer.setPassword(hashPassword(input.password));
    this.trainers.save(trainer);
    return trainer;
  }

  ensureNameFree(name: string, owner?: Trainer): void {
    if (this.namesake(name, owner)) throw conflict(`Ya hay un entrenador que se llama ${cleanName(name)}, elige otro nombre.`);
  }

  private namesake(name: string, owner?: Trainer): Trainer | undefined {
    const key = nameKey(name);
    return this.trainers.all().find((other) => other !== owner && nameKey(other.name) === key);
  }
}
