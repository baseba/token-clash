import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PROJECT_ROOT } from '../src/shared/paths.js';

export const FAST_TIMINGS = {
  TURN_MS: '1500',
  PREVIEW_MS: '1500',
  ROLL_MS: '0',
  MATCH_MS: '300',
  REVEAL_MS: '200',
  DICE_ANIM_MS: '0',
  AI_PICK_MS: '60',
  DRAW_MS: '100',
  BETWEEN_MS: '100',
  AI_PACE_MS: '20',
  AI_WATCH_MS: '0',
  ARRIVAL_MS: '0',
  ABSENT_MS: '1500',
};

export interface AppProcess {
  readonly base: string;
  readonly port: number;
  readonly dataDir: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  kill(): void;
}

export function appProcess(env: Record<string, string>, ports: number): AppProcess {
  const port = ports + Math.floor(Math.random() * 1000);
  const base = `http://127.0.0.1:${port}`;
  const dataDir = mkdtempSync(join(tmpdir(), 'tc-'));
  let proc: ChildProcess;
  return {
    base,
    port,
    dataDir,
    async start() {
      proc = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'dist/src/main.js'], {
        cwd: PROJECT_ROOT,
        env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir, ...env },
        stdio: ['ignore', 'ignore', 'inherit'],
      });
      for (let i = 0; i < 100; i++) {
        try {
          if ((await fetch(`${base}/healthz`)).ok) return;
        } catch {}
        await new Promise<any>((r) => setTimeout(r, 100));
      }
      throw new Error('server did not start');
    },
    async stop() {
      const exited = new Promise<any>((r) => proc.once('exit', r));
      proc.kill('SIGTERM');
      await exited;
    },
    kill() {
      proc?.kill();
    },
  };
}
