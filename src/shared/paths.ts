// Where the project lives on disk. The code runs from src/ (tests, tooling) or from dist/src/
// (compiled), so instead of counting "../" we walk up until we find package.json.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

function findRoot(from: string): string {
  let dir = from;
  while (!existsSync(join(dir, 'package.json'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error('No encontré package.json sobre ' + from);
    dir = parent;
  }
  return dir;
}

export const PROJECT_ROOT = findRoot(import.meta.dirname);

/** Static catalog files (PokeAPI and Showdown data), versioned in src/catalog/data/. */
export const catalogFile = (name: string) => join(PROJECT_ROOT, 'src', 'catalog', 'data', name);

export const PUBLIC_DIR = join(PROJECT_ROOT, 'public');
