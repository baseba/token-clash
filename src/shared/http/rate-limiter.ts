import { Injectable, OnModuleDestroy } from '@nestjs/common';

/** Fixed-window counters in memory: enough for one small server. */
@Injectable()
export class RateLimiter implements OnModuleDestroy {
  private readonly buckets = new Map<string, { n: number; reset: number }>();
  private readonly sweeper = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of this.buckets) if (now > b.reset) this.buckets.delete(k);
  }, 60_000).unref();

  /** Counts one hit for `key` and says whether it went over `max` in the window. */
  limited(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b || now > b.reset) b = { n: 0, reset: now + windowMs };
    b.n += 1;
    this.buckets.set(key, b);
    return b.n > max;
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
  }
}
