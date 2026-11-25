import { parse } from '@babel/parser';

import { muirMoiraStorybookIsRecord } from '../../src/is-record.ts';
import { muirMoiraStorybookEveryRecordIn } from '../../src/node-tree.ts';

/** Moves the value under each `from` key in `program` to `to`, as Babel 8 renames a key Babel 7 parses. */
export function renameKey(program: object, from: string, to: string): void {
  muirMoiraStorybookEveryRecordIn(program)
    .filter(muirMoiraStorybookIsRecord)
    .filter((record) => from in record)
    .forEach((record) => {
      record[to] = record[from];
      Reflect.deleteProperty(record, from);
    });
}

export function programOf(...lines: readonly string[]) {
  return parse(lines.join('\n'), {
    sourceType: 'module',
    plugins: ['typescript'],
  }).program;
}

/** The program of `lines` as Babel 7 parses it by default, then with `import()` as an `ImportExpression`, as Babel 8 parses it by default. */
export function programsOf(...lines: readonly string[]) {
  return [false, true].map(
    (createImportExpressions) =>
      parse(lines.join('\n'), {
        sourceType: 'module',
        plugins: ['typescript'],
        createImportExpressions,
      }).program,
  );
}

export function bodyOf(...lines: readonly string[]) {
  return programOf(...lines).body;
}
