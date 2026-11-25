export class RunQueue {
  private readonly items: number[];
  private head: number;
  private readonly limit: number;

  constructor(limit: number) {
    this.items = [];
    this.head = 0;
    this.limit = limit;
  }

  full(): boolean {
    return this.items.length - this.head >= this.limit;
  }

  parts(): [number[], number] {
    return [this.items, this.head];
  }

  setHead(head: number): void {
    this.head = head;
  }
}
