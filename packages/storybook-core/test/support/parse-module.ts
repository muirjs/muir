import { parse } from '@babel/parser';

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
