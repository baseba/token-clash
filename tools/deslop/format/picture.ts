import { HELD_IN_MIND, type Picture, type SpreadModule, type Step } from '../lint/report.js';

const BAR = 40;

export interface Paint {
  error(text: string): string;
  gutter(text: string): string;
  ok(text: string): string;
  bold(text: string): string;
}

interface Row {
  name: string;
  length: number;
  judged: boolean;
}

const width = (text: string): number => [...text].length;

function shortSites(steps: Step[]): string[] {
  const directory = (step: Step) => step.site.file.split('/').slice(0, -1);
  let common = steps.length === 0 ? [] : directory(steps[0]);
  for (const step of steps) {
    const parts = directory(step);
    const differs = common.findIndex((part, index) => part !== parts[index]);
    if (differs !== -1) common = common.slice(0, differs);
  }
  const skip = common.reduce((sum, part) => sum + part.length + 1, 0);
  return steps.map((step) => `${step.site.file.slice(skip)}:${step.site.line}`);
}

function circle(steps: Step[], rest: string | undefined, paint: Paint): string[] {
  const sites = shortSites(steps);
  const widest = Math.max(0, ...sites.map((site) => site.length));
  const lines: string[] = [];
  steps.forEach((step, index) => {
    const cheapest = index === 0;
    lines.push(`${cheapest ? '┌─▶ ' : '│   '}${paint.bold(step.member)}`);
    lines.push(`│     ${cheapest ? paint.error('┃') : '│'} ${sites[index].padEnd(widest)}  ${step.uses}`);
    if (index + 1 < steps.length) lines.push(`│     ${cheapest ? paint.error('▼') : '▼'}`);
  });
  lines.push('└─────┘');
  if (rest !== undefined) lines.push(rest);
  return lines;
}

function spread(owner: string, field: string, modules: SpreadModule[], others: string[], paint: Paint): string[] {
  const digits = Math.max(0, ...modules.map((module) => String(module.places).length));
  const under = ' '.repeat(width(field) + 3);
  const arms = modules.map(({ places, module }, index) => {
    const first = index === 0;
    const last = index + 1 === modules.length;
    const arm = first ? (last ? '◀━━━' : '◀━┳━') : last ? '  ┗━' : '  ┣━';
    return `${first ? `  ${paint.bold(field)} ` : under}${paint.error(arm)} ${String(places).padStart(digits)}  ${module}`;
  });
  return [owner, ...arms, ...others.map((other) => `  ${other}`)];
}

function bars(rows: Row[], most: number, paint: Paint): string[] {
  const unit = Math.max(1, Math.ceil(most / (BAR / 2)));
  const line = Math.ceil(most / unit);
  const widest = Math.max(0, ...rows.map((row) => width(row.name)));
  const header = `${' '.repeat(widest)}  ${String(most).padStart(line + 1)}`;
  return [
    header,
    ...rows.map(({ name, length, judged }) => {
      const cells = Math.ceil(length / unit);
      const inside = Math.min(cells, line);
      const past = cells - inside;
      const beyond = `${'█'.repeat(Math.min(past, BAR - line))}${past > BAR - line ? '⋯' : ''}`;
      const within = `${'█'.repeat(inside)}${' '.repeat(line - inside)}`;
      return `${name}${' '.repeat(widest - width(name))}  ${within}│${judged && past > 0 ? paint.error(beyond) : beyond} ${length}`;
    }),
  ];
}

function lines(picture: Picture, paint: Paint): string[] {
  switch (picture.kind) {
    case 'circle':
      return circle(picture.steps, picture.rest, paint);
    case 'spread':
      return spread(picture.owner, picture.field, picture.modules, picture.others, paint);
    case 'lists':
      return bars(
        [
          { name: 'shows', length: picture.shown, judged: true },
          { name: 'hides', length: picture.hidden, judged: false },
          ...picture.lists.map((list) => ({ ...list, judged: true })),
        ],
        HELD_IN_MIND,
        paint,
      );
    case 'bar':
      return bars([{ name: picture.label, length: picture.length, judged: true }], picture.most, paint);
  }
}

export function draw(picture: Picture, paint: Paint): string[] {
  return lines(picture, paint).map((line) => `    ${line}`);
}
