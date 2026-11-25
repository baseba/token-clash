import type { CodeFile, Model } from '../model/model.js';
import type { NodeId } from '../model/tree.js';
import { type Diagnostic, compareText, declaringFile, inScope, listed } from './report.js';

const MOST_MEMBERS = 15;
const MOST_LINES = 2_000;

export interface Holder {
  directory: string;
  member: string;
}

export function holders(path: string): Holder[] {
  const parts = path.split('/');
  return parts.map((part, index) => ({ directory: parts.slice(0, index).join('/'), member: index === parts.length - 1 ? part : `${part}/` }));
}

function longFile(file: CodeFile): Diagnostic {
  return {
    lint: 'long-file',
    key: file.path,
    message: `\`${file.path}\` is long: it has ${file.lines} lines, more than ${MOST_LINES}`,
    location: { file: file.path, line: 1 },
    notes: [],
    picture: { kind: 'bar', label: 'lines', length: file.lines, most: MOST_LINES },
  };
}

function wideDirectory(model: Model, directory: string, members: string[]): Diagnostic {
  const shown = directory === '' ? './' : `${directory}/`;
  const files = members.filter((member) => !member.endsWith('/'));
  const directories = members.filter((member) => member.endsWith('/'));
  const notes = [
    { names: files, one: 'file', many: 'files' },
    { names: directories, one: 'directory', many: 'directories' },
  ]
    .filter(({ names }) => names.length > 0)
    .map(({ names, one, many }) => `${names.length} ${names.length === 1 ? one : many}: ${listed(names)}`);
  const beside = model.files.find((file) => directory !== '' && file.path === `${directory}.ts`)?.path;
  const declaring = declaringFile(model, directory) ?? beside;
  return {
    lint: 'wide-directory',
    key: shown,
    message: `\`${shown}\` is wide: it holds ${members.length} files and directories, more than ${MOST_MEMBERS}`,
    location: declaring === undefined ? undefined : { file: declaring, line: 1 },
    notes,
    picture: { kind: 'bar', label: 'holds', length: members.length, most: MOST_MEMBERS },
  };
}

export function checkLayout(model: Model, scope: NodeId | undefined): Diagnostic[] {
  const concerned = (file: CodeFile) => inScope(model.tree, scope, file.module);
  const members = new Map<string, Set<string>>();
  const below = new Set<string>();
  for (const file of model.files) {
    for (const { directory, member } of holders(file.path)) {
      members.set(directory, (members.get(directory) ?? new Set<string>()).add(member));
      if (concerned(file)) below.add(directory);
    }
  }
  const wide = [...members.keys()]
    .sort(compareText)
    .filter((directory) => below.has(directory) && (members.get(directory)?.size ?? 0) > MOST_MEMBERS)
    .map((directory) => wideDirectory(model, directory, [...(members.get(directory) ?? [])].sort(compareText)));
  return [...model.files.filter((file) => file.lines > MOST_LINES && concerned(file)).map(longFile), ...wide];
}
