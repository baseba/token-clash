// Tiny JSON-file store. A handful of colleagues: no database needed.
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const MAX_CHALLENGES = 1000;

export function openStore(dir) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'db.json');
  let db = { trainers: {}, challenges: {} };
  try {
    db = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  db.trainers ??= {};
  db.challenges ??= {};

  // Battles live in memory; anything left mid-fight by a restart is closed.
  for (const c of Object.values(db.challenges)) if (c.status === 'active') c.status = 'abandoned';

  let timer = null;
  const flush = () => {
    timer = null;
    const ids = Object.keys(db.challenges);
    if (ids.length > MAX_CHALLENGES) {
      ids
        .sort((a, b) => db.challenges[a].createdAt - db.challenges[b].createdAt)
        .slice(0, ids.length - MAX_CHALLENGES)
        .forEach((id) => delete db.challenges[id]);
    }
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(db));
    renameSync(tmp, file);
  };
  const save = () => {
    timer ??= setTimeout(flush, 200);
  };
  return {
    db,
    save,
    flushNow() {
      if (timer) clearTimeout(timer);
      flush();
    },
  };
}
