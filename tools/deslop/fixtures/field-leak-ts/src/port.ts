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

export interface Desk {
  label: string;
  papers: number[];
  stamp: number;
}

export class Desked implements Desk {
  private secret = 0;
  private labelText = 'a';
  private paperList: number[] = [];
  private stampValue = 0;

  work(): number {
    return this.secret + 1;
  }

  get label(): string {
    return this.labelText;
  }

  set label(label: string) {
    this.labelText = label.trim();
  }

  get papers(): number[] {
    this.secret += 1;
    return this.paperList;
  }

  set papers(papers: number[]) {
    this.paperList = papers;
  }

  get stamp(): number {
    return this.stampValue + this.secret;
  }

  set stamp(stamp: number) {
    this.stampValue = stamp;
  }
}

export interface Tray {
  slots: number[];
}

export class Rack {
  private secret = 0;
  protected readonly slotList: number[] = [];

  work(): number {
    return this.secret + 1;
  }
}

export class TrayRack extends Rack implements Tray {
  get slots(): number[] {
    return this.slotList;
  }
}

export class SpareRack extends Rack {
  refill(tray: Tray): void {
    tray.slots.push(1);
  }
}
