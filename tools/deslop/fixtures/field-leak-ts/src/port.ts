export interface Port {
  room: string | null;
  seat: string | null;
  queue: number[];
  view: number[];
}

export interface WidePort extends Port {
  wide: number[];
}

export class Ported implements WidePort {
  private secret = 0;
  room: string | null = null;
  seat: string | null = null;
  queue: number[] = [];
  wide: number[] = [];
  private readonly viewList: number[] = [];

  work(): number {
    return this.secret + 1;
  }

  get view(): number[] {
    return this.viewList;
  }
}

export class Unported {
  private secret = 0;
  room: string | null = null;
  queue: number[] = [];

  work(): number {
    return this.secret + 1;
  }
}
