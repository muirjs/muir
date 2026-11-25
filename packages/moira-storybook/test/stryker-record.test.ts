import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, type TestContext } from 'node:test';

import {
  muirMoiraStorybookAppendRecord,
  muirMoiraStorybookRecordVariable,
} from '../src/stryker-record.ts';

function setup(t: TestContext) {
  const folder = mkdtempSync(join(tmpdir(), 'muir-record-'));
  const recordFile = join(folder, 'records.jsonl');
  const previousRecord = process.env[muirMoiraStorybookRecordVariable];
  writeFileSync(recordFile, '');
  process.env[muirMoiraStorybookRecordVariable] = recordFile;
  t.after(() => {
    if (previousRecord === undefined) {
      delete process.env[muirMoiraStorybookRecordVariable];
    } else {
      process.env[muirMoiraStorybookRecordVariable] = previousRecord;
    }

    rmSync(folder, { recursive: true });
  });

  return { recordFile };
}

describe('appendRecord', () => {
  it('appends one line with the project-relative file and the rewrite count', (t) => {
    const { recordFile } = setup(t);

    muirMoiraStorybookAppendRecord(
      join(process.cwd(), 'src', 'Button.stories.tsx'),
      2,
    );

    assert.equal(
      readFileSync(recordFile, 'utf8'),
      '{"file":"src/Button.stories.tsx","rewritten":2}\n',
    );
  });
});
