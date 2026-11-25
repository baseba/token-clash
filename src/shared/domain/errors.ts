export type DomainErrorKind =
  | 'invalid'
  | 'not-found'
  | 'forbidden'
  | 'conflict'
  | 'gone'
  | 'unavailable';

export class DomainError extends Error {
  constructor(
    readonly kind: DomainErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const invalid = (message: string) => new DomainError('invalid', message);
export const notFound = (message: string) => new DomainError('not-found', message);
export const forbidden = (message: string) => new DomainError('forbidden', message);
export const conflict = (message: string) => new DomainError('conflict', message);
export const gone = (message: string) => new DomainError('gone', message);
export const unavailable = (message: string) => new DomainError('unavailable', message);
