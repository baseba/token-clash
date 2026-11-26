import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PUBLIC_DIR } from '../../shared/paths.js';

const GENERATED = ['trainers', 'overworlds', 'tiles', 'animated'];
const ICONS = 'icons';

@Injectable()
export class DeployVersion {
  readonly value: string = (() => {
    const hash = createHash('sha256');
    const code = readdirSync(PUBLIC_DIR).filter((f) => /\.(js|css|html|svg|webmanifest)$/.test(f));
    const icons = readdirSync(join(PUBLIC_DIR, ICONS)).map((f) => join(ICONS, f));
    const manifests = readdirSync(join(PUBLIC_DIR, 'upstream')).map((f) => join('upstream', f));
    const generated = GENERATED.flatMap((dir) => (existsSync(join(PUBLIC_DIR, dir)) ? readdirSync(join(PUBLIC_DIR, dir)).filter((f) => f.endsWith('.png')).map((f) => join(dir, f)) : []));
    for (const file of [...code, ...icons, ...manifests, ...generated].sort()) hash.update(file).update(readFileSync(join(PUBLIC_DIR, file)));
    return hash.digest('hex').slice(0, 10);
  })();
}
