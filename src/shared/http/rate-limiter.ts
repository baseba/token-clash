import { Injectable, OnModuleDestroy } from '@nestjs/common';

/** Fixed-window counters in memory: enough for one small server. */
@Injectable()
export class RateLimiter implements OnModuleDestroy {
  private readonly buckets = new Map<string, { n: number; reset: number }>();
  private readonly sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) if (now > bucket.reset) this.buckets.delete(key);
  }, 60_000).unref();

  /** Counts one hit for `key` and says whether it went over `max` in the window. */
  limited(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || now > bucket.reset) bucket = { n: 0, reset: now + windowMs };
    bucket.n += 1;
    this.buckets.set(key, bucket);
    return bucket.n > max;
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
  }
}
