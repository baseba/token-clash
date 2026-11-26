import { join } from 'node:path';
import { PROJECT_ROOT } from '../../shared/paths.js';

export const catalogFile = (name: string) => join(PROJECT_ROOT, 'src', 'catalog', 'data', name);
