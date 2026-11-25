import { appendFileSync, existsSync } from 'node:fs';
import { relative, sep } from 'node:path';

export const muirMoiraStorybookMockTransformerPluginName =
  'muir-pixie-storybook-vite-mock-transformer';

export const muirMoiraStorybookRecordVariable = 'MUIR_MOIRA_STORYBOOK_RECORD';

export function muirMoiraStorybookAppendRecord(
  file: string,
  rewritten: number,
): void {
  const recordFile = process.env[muirMoiraStorybookRecordVariable];

  if (recordFile === undefined) {
    return;
  }

  const projectFile = relative(process.cwd(), file).split(sep).join('/');
  appendFileSync(
    recordFile,
    `${JSON.stringify({ file: projectFile, rewritten })}\n`,
  );
}

export function muirMoiraStorybookHasRecords(recordFile: string): boolean {
  return existsSync(recordFile);
}
