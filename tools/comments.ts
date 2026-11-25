import ts from 'typescript';

export interface CommentRange {
  start: number;
  end: number;
}

type Language = 'script' | 'stylesheet' | 'markup' | 'raw';

interface Segment {
  language: Language;
  scriptPath: string;
  start: number;
  startsMidLine: boolean;
  text: string;
}

const SCRIPT_EXTENSIONS = ['.ts', '.mts', '.cts', '.tsx', '.js', '.mjs', '.cjs', '.jsx'];
const MARKUP_EXTENSIONS = ['.html', '.svg'];
const OUT_OF_SCOPE = ['deploy/', '.github/', 'drizzle/'];
const JAVASCRIPT_TYPES = ['', 'module', 'text/javascript', 'application/javascript', 'text/ecmascript', 'application/ecmascript', 'application/x-javascript', 'application/x-ecmascript', 'text/x-javascript', 'text/x-ecmascript', 'text/jscript', 'text/livescript'];
const HTML_RAW_TEXT_ELEMENTS = ['script', 'style', 'textarea', 'title'];
const SVG_RAW_TEXT_ELEMENTS = ['script', 'style'];
const CHARACTER_DATA = { open: '<![CDATA[', close: ']]>' };

const hasExtension = (path: string, extensions: string[]) => extensions.some((extension) => path.endsWith(extension));

export function isChecked(path: string): boolean {
  if (OUT_OF_SCOPE.some((prefix) => path.startsWith(prefix))) return false;
  const name = path.slice(path.lastIndexOf('/') + 1);
  return hasExtension(name, SCRIPT_EXTENSIONS) || /^tsconfig.*\.json$/.test(name) || name.endsWith('.css') || hasExtension(name, MARKUP_EXTENSIONS);
}

function scriptKindOf(path: string): ts.ScriptKind {
  if (path.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (path.endsWith('.jsx')) return ts.ScriptKind.JSX;
  return /\.[mc]?ts$/.test(path) ? ts.ScriptKind.TS : ts.ScriptKind.JS;
}

function parse(path: string, text: string): ts.SourceFile {
  return path.endsWith('.json') ? ts.parseJsonText(path, text) : ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKindOf(path));
}

function syntaxErrorCount(path: string, text: string): number {
  if (path.endsWith('.json')) return 0;
  return ts.transpileModule(text, { fileName: path, reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.Preserve } }).diagnostics?.length ?? 0;
}

function scriptComments(path: string, text: string): CommentRange[] {
  const source = parse(path, text);
  const ranges = new Map<number, CommentRange>();
  const collect = (found: ts.CommentRange[] | undefined) => {
    for (const range of found ?? []) ranges.set(range.pos, { start: range.pos, end: range.end });
  };
  const jsxTexts: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) return;
    if (ts.isJsxText(node)) jsxTexts.push(node);
    collect(ts.getLeadingCommentRanges(text, node.pos));
    collect(ts.getTrailingCommentRanges(text, node.end));
    for (const child of node.getChildren(source)) visit(child);
  };
  visit(source);
  for (const jsxText of jsxTexts) for (const start of ranges.keys()) if (start >= jsxText.pos && start < jsxText.end) ranges.delete(start);
  return [...ranges.values()].sort((a, b) => a.start - b.start);
}

function stylesheetComments(text: string): CommentRange[] {
  const ranges: CommentRange[] = [];
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (character === '\\') {
      index += text.startsWith('\r\n', index + 1) ? 3 : 2;
    } else if (character === '"' || character === "'") {
      index += 1;
      while (index < text.length && text[index] !== character && text[index] !== '\n') index += text[index] !== '\\' ? 1 : text.startsWith('\r\n', index + 1) ? 3 : 2;
      index += 1;
    } else if (!/[\w-]/.test(text[index - 1] ?? '') && /^url\(\s*[^\s"')]/i.test(text.slice(index, index + 64))) {
      index += 4;
      while (index < text.length && text[index] !== ')') index += text[index] === '\\' ? 2 : 1;
      index += 1;
    } else if (text.startsWith('/*', index)) {
      const close = text.indexOf('*/', index + 2);
      const end = close === -1 ? text.length : close + 2;
      ranges.push({ start: index, end });
      index = end;
    } else {
      index += 1;
    }
  }
  return ranges;
}

function markupCommentEnd(text: string, index: number): number | undefined {
  if (!text.startsWith('<!--', index)) return undefined;
  if (text.startsWith('>', index + 4)) return index + 5;
  if (text.startsWith('->', index + 4)) return index + 6;
  const closes = [text.indexOf('-->', index + 4), text.indexOf('--!>', index + 4)].filter((close) => close !== -1);
  if (closes.length === 0) return text.length;
  const close = Math.min(...closes);
  return close + (text.startsWith('--!>', close) ? 4 : 3);
}

function delimitedEnd(text: string, index: number, delimiters: { open: string; close: string }): number | undefined {
  if (!text.startsWith(delimiters.open, index)) return undefined;
  const close = text.indexOf(delimiters.close, index + delimiters.open.length);
  return close === -1 ? text.length : close + delimiters.close.length;
}

const opensTag = (text: string, index: number) => text[index] === '<' && /[A-Za-z/!?]/.test(text[index + 1] ?? '');

function tagEnd(text: string, index: number): number {
  let cursor = index + 1;
  while (cursor < text.length && text[cursor] !== '>') {
    if (text[cursor] !== '=') {
      cursor += 1;
      continue;
    }
    cursor += 1;
    while (cursor < text.length && /\s/.test(text[cursor])) cursor += 1;
    const quote = text[cursor];
    if (quote === '"' || quote === "'") {
      const close = text.indexOf(quote, cursor + 1);
      cursor = close === -1 ? text.length : close + 1;
    } else {
      while (cursor < text.length && !/[\s>]/.test(text[cursor])) cursor += 1;
    }
  }
  return Math.min(cursor + 1, text.length);
}

function markupComments(text: string): CommentRange[] {
  const ranges: CommentRange[] = [];
  let index = 0;
  while (index < text.length) {
    const commentEnd = markupCommentEnd(text, index);
    if (commentEnd !== undefined) {
      ranges.push({ start: index, end: commentEnd });
      index = commentEnd;
      continue;
    }
    index = delimitedEnd(text, index, CHARACTER_DATA) ?? (opensTag(text, index) ? tagEnd(text, index) : index + 1);
  }
  return ranges;
}

function attributeOf(tag: string, name: string): string | undefined {
  for (const match of tag.matchAll(/(?<=[\s"'])([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    if (match[1].toLowerCase() === name) return match[2] ?? match[3] ?? match[4] ?? '';
  }
  return undefined;
}

function bodyLanguage(name: string, tag: string): Language {
  if (name === 'style') return 'stylesheet';
  if (name !== 'script') return 'raw';
  const type = (attributeOf(tag, 'type') ?? '').split(';')[0].trim().toLowerCase();
  return JAVASCRIPT_TYPES.includes(type) ? 'script' : 'raw';
}

function closingTagStart(text: string, name: string, from: number): number {
  const closing = new RegExp(`</${name}(?=[\\s/>])`, 'gi');
  closing.lastIndex = from;
  return closing.exec(text)?.index ?? text.length;
}

function segmentsOf(path: string, text: string): Segment[] {
  const whole = (language: Language): Segment[] => [{ language, scriptPath: path, start: 0, startsMidLine: false, text }];
  if (path.endsWith('.css')) return whole('stylesheet');
  if (!hasExtension(path, MARKUP_EXTENSIONS)) return whole('script');
  const segments: Segment[] = [];
  const push = (language: Language, start: number, end: number) => segments.push({ language, scriptPath: language === 'script' ? `${path}.js` : path, start, startsMidLine: start > 0 && text[start - 1] !== '\n', text: text.slice(start, end) });
  const isImage = path.endsWith('.svg');
  const rawTextElements = isImage ? SVG_RAW_TEXT_ELEMENTS : HTML_RAW_TEXT_ELEMENTS;
  let markupStart = 0;
  let index = 0;
  while (index < text.length) {
    const skipped = markupCommentEnd(text, index) ?? delimitedEnd(text, index, CHARACTER_DATA);
    if (skipped !== undefined) {
      index = skipped;
      continue;
    }
    if (!opensTag(text, index)) {
      index += 1;
      continue;
    }
    const end = tagEnd(text, index);
    const tag = text.slice(index, end);
    index = end;
    const name = /^<([A-Za-z][\w-]*)/.exec(tag)?.[1].toLowerCase();
    if (!name || !rawTextElements.includes(name) || (isImage && tag.endsWith('/>'))) continue;
    const bodyEnd = closingTagStart(text, name, index);
    push('markup', markupStart, index);
    push(bodyLanguage(name, tag), index, bodyEnd);
    markupStart = bodyEnd;
    index = bodyEnd;
  }
  push('markup', markupStart, text.length);
  return segments;
}

function commentsIn(segment: Segment): CommentRange[] {
  if (segment.language === 'raw') return [];
  if (segment.language === 'stylesheet') return stylesheetComments(segment.text);
  if (segment.language === 'markup') return markupComments(segment.text);
  return scriptComments(segment.scriptPath, segment.text);
}

export function findComments(path: string, text: string): CommentRange[] {
  return segmentsOf(path, text).flatMap((segment) => commentsIn(segment).map((range) => ({ start: range.start + segment.start, end: range.end + segment.start })));
}

const isBlank = (line: string) => line.trim() === '';
const isSpace = (character: string | undefined) => character === ' ' || character === '\t';
const isWordCharacter = (character: string | undefined) => character !== undefined && /[\w$]/.test(character);
const stylesheetTokensGlue = (left: string | undefined, right: string | undefined) =>
  (isWordCharacter(left) && (isWordCharacter(right) || right === '-')) || (/[\d%]/.test(left ?? '') && (right === '.' || isWordCharacter(right))) || (left === '-' && isWordCharacter(right));
const BLANK_LINE_AT_END = /(^|\n)[ \t\r]*\n$/;

function removeWholeLine(text: string, lineStart: number, newline: number): string {
  let head = text.slice(0, lineStart);
  let rest = text.slice(newline === -1 ? text.length : newline + 1);
  const previousLineBlank = head === '' || BLANK_LINE_AT_END.test(head);
  const nextLineEnd = rest.indexOf('\n');
  if (previousLineBlank && nextLineEnd !== -1 && isBlank(rest.slice(0, nextLineEnd))) rest = rest.slice(nextLineEnd + 1);
  if (previousLineBlank && rest === '' && head !== '') head = head.replace(/\n[ \t\r]*\n$/, '\n');
  return head + rest;
}

function joinerFor(text: string, left: number, right: number, range: CommentRange, language: Language): string {
  const spaced = left < range.start || right > range.end;
  const glues = isWordCharacter(text[left - 1]) && isWordCharacter(text[right]);
  if (language === 'script' && text.slice(range.start, range.end).includes('\n')) return '\n';
  if (language === 'markup') return spaced ? ' ' : '';
  if (language === 'stylesheet') return spaced || stylesheetTokensGlue(text[left - 1], text[right]) ? ' ' : '';
  const tight = '(['.includes(text[left - 1]) || ')],;'.includes(text[right]);
  return !tight && (spaced || glues) ? ' ' : '';
}

function removeOne(text: string, range: CommentRange, segment: Segment): string {
  const lineStart = text.lastIndexOf('\n', range.start - 1) + 1;
  const newline = text.indexOf('\n', range.end);
  const lineEnd = newline === -1 ? text.length : newline;
  const blankBefore = isBlank(text.slice(lineStart, range.start));
  const blankAfter = isBlank(text.slice(range.end, lineEnd));
  const sharesLineWithTag = lineStart === 0 && segment.startsMidLine;
  if (blankBefore && blankAfter && !sharesLineWithTag) return removeWholeLine(text, lineStart, newline);
  const contentEnd = text[lineEnd - 1] === '\r' && lineEnd - 1 >= range.end ? lineEnd - 1 : lineEnd;
  if (blankAfter) return text.slice(0, range.start).trimEnd() + text.slice(contentEnd);
  let left = range.start;
  while (left > lineStart && isSpace(text[left - 1])) left -= 1;
  let right = range.end;
  while (right < text.length && isSpace(text[right])) right += 1;
  if (left === lineStart) return text.slice(0, range.start) + text.slice(right);
  return text.slice(0, left) + joinerFor(text, left, right, range, segment.language) + text.slice(right);
}

const printer = ts.createPrinter({ removeComments: true });

export class UnsafeStrip extends Error {
  constructor(readonly path: string) {
    super(`${path}: borrar sus comentarios cambia el código; bórralos a mano.`);
  }
}

function stripSegment(path: string, segment: Segment): string {
  const stripped = commentsIn(segment)
    .reverse()
    .reduce((current, range) => removeOne(current, range, segment), segment.text);
  if (segment.language !== 'script' || stripped === segment.text) return stripped;
  const sameTree = printer.printFile(parse(segment.scriptPath, stripped)) === printer.printFile(parse(segment.scriptPath, segment.text));
  if (!sameTree || syntaxErrorCount(segment.scriptPath, stripped) > syntaxErrorCount(segment.scriptPath, segment.text)) throw new UnsafeStrip(path);
  return stripped;
}

export function stripComments(path: string, text: string): string {
  return segmentsOf(path, text)
    .map((segment) => stripSegment(path, segment))
    .join('');
}
