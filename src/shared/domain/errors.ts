// Errors the domain and the use cases throw when a rule says no. They carry *what kind* of no it
// is, never an HTTP status: translating a kind into a status code is the job of the HTTP layer
// (shared/http/domain-error.filter.ts). The message is what the player reads, in Spanish.

export type DomainErrorKind =
  | 'invalid' // the request makes no sense (400)
  | 'not-found' // it does not exist (404)
  | 'forbidden' // it exists, but it is not yours to do (403)
  | 'conflict' // not now: the state does not allow it (409)
  | 'gone' // it existed but was closed for good (410)
  | 'unavailable'; // this server cannot do it (503)

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
