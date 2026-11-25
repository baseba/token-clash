export class Window {
  private readonly latencies: number[];
  private readonly size: number;

  constructor(size: number) {
    this.latencies = [];
    this.size = size;
  }

  push(latency: number): void {
    if (this.latencies.length === this.size) this.latencies.shift();
    this.latencies.push(latency);
  }

  mean(): number {
    const sum = this.latencies.reduce((total, latency) => total + latency, 0);
    return Math.floor(sum / Math.max(this.latencies.length, 1));
  }

  worst(): number {
    return Math.max(0, ...this.latencies);
  }
}
