import { run } from './cli.js';

function stdoutHasColor(): boolean {
  const forced = process.env.FORCE_COLOR;
  if (forced !== undefined && forced !== '') return forced !== '0';
  const refused = process.env.NO_COLOR;
  return (refused === undefined || refused === '') && process.stdout.isTTY === true;
}

const result = run(process.argv.slice(2), process.cwd(), stdoutHasColor());
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.code;
