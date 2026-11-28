import { readFile } from 'node:fs/promises';

import { muirDistTags } from './dist-tags.ts';

const [manifestFile] = process.argv.slice(2);

if (manifestFile === undefined) {
  throw new Error(
    'Usage: node tools/eslint-rules/dist-tags.cli.ts <package.json>',
  );
}

const manifest: unknown = JSON.parse(await readFile(manifestFile, 'utf8'));
process.stdout.write(
  muirDistTags(manifest)
    .map((tag) => `${tag}\n`)
    .join(''),
);
