import { dirname, relative, sep } from 'node:path';
import ts from 'typescript';
import { ToolError } from '../../tool.js';

export const PACKAGE = 'src';

export interface Source {
  path: string;
  syntax: ts.SourceFile;
}

export interface Project {
  checker: ts.TypeChecker;
  sources: Source[];
  isLibrary: (file: ts.SourceFile) => boolean;
}

const TEST_FILE = /\.(spec|test|e2e-spec)\.[cm]?[jt]sx?$/;
const TEST_DIRECTORIES = new Set(['test', 'tests', '__tests__']);

function isTestCode(path: string): boolean {
  const directories = path.split('/').slice(0, -1);
  return TEST_FILE.test(path) || directories.some((directory) => TEST_DIRECTORIES.has(directory));
}

export function loadProject(directory: string): Project {
  const config = ts.findConfigFile(directory, ts.sys.fileExists, 'tsconfig.json');
  if (config === undefined) throw new ToolError('not inside a TypeScript project');
  const refused = (problem: ts.Diagnostic) => new ToolError(`${config}: ${ts.flattenDiagnosticMessageText(problem.messageText, ' ')}`);
  const read = ts.readConfigFile(config, ts.sys.readFile);
  if (read.error !== undefined) throw refused(read.error);
  const root = dirname(config);
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, root);
  if (parsed.errors.length > 0) throw refused(parsed.errors[0]);
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: { ...parsed.options, noEmit: true } });
  const sources = program
    .getSourceFiles()
    .filter((syntax) => !syntax.isDeclarationFile)
    .map((syntax) => ({ path: relative(root, syntax.fileName).split(sep).join('/'), syntax }))
    .filter(({ path }) => path.startsWith(`${PACKAGE}/`) && !isTestCode(path))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  if (sources.length === 0) throw new ToolError(`${config}: no source files under ${PACKAGE}/`);
  return { checker: program.getTypeChecker(), sources, isLibrary: (file) => program.isSourceFileDefaultLibrary(file) };
}
