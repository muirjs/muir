import { parse } from '@babel/parser';

export function programOf(...lines: readonly string[]) {
  return parse(lines.join('\n'), {
    sourceType: 'module',
    plugins: ['typescript'],
  }).program;
}

export function bodyOf(...lines: readonly string[]): readonly unknown[] {
  return programOf(...lines).body;
}
