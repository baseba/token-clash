import { Injectable, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class RateLimiter implements OnModuleDestroy {
  private readonly buckets = new Map<string, { hits: number; reset: number }>();
  private readonly sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) if (now > bucket.reset) this.buckets.delete(key);
  }, 60_000).unref();

  limited(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || now > bucket.reset) bucket = { hits: 0, reset: now + windowMs };
    bucket.hits += 1;
    this.buckets.set(key, bucket);
    return bucket.hits > max;
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
  }
}
