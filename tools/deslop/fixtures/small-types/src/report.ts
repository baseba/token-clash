import { Rate, Tally, Window, percent } from './stats.js';

export function summarize(lines: readonly (readonly [number, number, number])[]): string {
  if (lines.length === 0) return 'no lines';
  const tally = new Tally(4);
  const window = new Window(16);
  const rate = new Rate(lines[0][0]);
  for (const [second, level, latency] of lines) {
    tally.record(level);
    window.push(latency);
    rate.observe(second);
  }
  const busiest = tally.busiest();
  const share = percent(tally.count(busiest), tally.total());
  return `level ${busiest} is ${share}% of lines; latency ${window.mean()} ms mean, ${window.worst()} ms worst; ${rate.perSecond()} lines a second`;
}
