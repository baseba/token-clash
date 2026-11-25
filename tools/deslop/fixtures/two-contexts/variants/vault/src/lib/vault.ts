export interface Plain {
  width: number;
  height: number;
}

export class Vault {
  private readonly secret: number;
  leaked: number;

  constructor() {
    this.secret = 1;
    this.leaked = 2;
  }

  next(): number {
    return this.secret + 1;
  }
}
