import { readFileSync } from 'node:fs';

const { engines } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const [needMajor, needMinor = 0] = engines.node.replace(/^>=\s*/, '').split('.').map(Number);
const [major, minor] = process.versions.node.split('.').map(Number);

if (major < needMajor || (major === needMajor && minor < needMinor)) {
  console.error(`Token Clash necesita Node ${engines.node} y estás usando ${process.version}.`);
  console.error('Con nvm: corre «nvm use» en la carpeta del proyecto (lee .nvmrc), o «nvm install» si no la tienes.');
  process.exit(1);
}
