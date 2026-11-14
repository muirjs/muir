import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { SourceMap } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { transform } from '../src/transform.ts';

const storyFile = 'D:/project/src/Button.stories.tsx';
const stubbedStory = [
  "import { fn } from 'storybook/test';",
  "export const Checked = { args: { load: fn().mockReturnValue('stubbed') } };",
  '',
].join('\n');

function recordWhile(run: () => void): string {
  const folder = mkdtempSync(join(tmpdir(), 'lz-record-'));
  const recordFile = join(folder, 'records.jsonl');
  writeFileSync(recordFile, '');
  process.env['LZ_STRYKER_STORYBOOK_RECORD'] = recordFile;

  try {
    run();

    return readFileSync(recordFile, 'utf8');
  } finally {
    delete process.env['LZ_STRYKER_STORYBOOK_RECORD'];
    rmSync(folder, { recursive: true });
  }
}

describe('transform records', () => {
  it('appends one line with the project-relative file and the rewrite count when the record variable is set', () => {
    const file = join(process.cwd(), 'src', 'Button.stories.tsx');

    assert.equal(
      recordWhile(() => transform(stubbedStory, `${file}?v=1`)),
      '{"file":"src/Button.stories.tsx","rewritten":1}\n',
    );
  });

  it('appends nothing for a module it leaves alone', () => {
    const file = join(process.cwd(), 'src', 'Button.stories.tsx');

    assert.equal(
      recordWhile(() =>
        transform(
          stubbedStory.replace('mockReturnValue', 'mockReturnValueOnce'),
          file,
        ),
      ),
      '',
    );
  });
});

describe('transform', () => {
  it('leaves a module without a storybook/test import alone', () => {
    assert.equal(
      transform("export const label = 'none';\n", storyFile),
      undefined,
    );
  });

  it('turns a definition-time mockReturnValue into fn with an implementation that returns the value', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      "export const Checked = { args: { load: fn().mockReturnValue('stubbed') } };",
      '',
    ].join('\n');

    assert.equal(
      transform(code, storyFile)?.code,
      [
        "import { fn } from 'storybook/test';",
        "export const Checked = { args: { load: fn(((value) => () => value)('stubbed')) } };",
        '',
      ].join('\n'),
    );
  });

  it('turns a definition-time mockResolvedValue into fn with an async implementation that returns the value', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      'export const meta = { args: { save: fn().mockResolvedValue(42) } };',
      '',
    ].join('\n');

    assert.equal(
      transform(code, storyFile)?.code,
      [
        "import { fn } from 'storybook/test';",
        'export const meta = { args: { save: fn(((value) => async () => value)(42)) } };',
        '',
      ].join('\n'),
    );
  });

  it('turns a definition-time mockRejectedValue into fn with an async implementation that throws the value', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      "const failing = fn().mockRejectedValue(new Error('offline'));",
      '',
    ].join('\n');

    assert.equal(
      transform(code, storyFile)?.code,
      [
        "import { fn } from 'storybook/test';",
        "const failing = fn(((value) => async () => { throw value; })(new Error('offline')));",
        '',
      ].join('\n'),
    );
  });

  it('turns a definition-time mockImplementation into fn with that implementation', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      "export const Story = { args: { onLoad: fn().mockImplementation(() => 'stubbed') } };",
      '',
    ].join('\n');

    assert.equal(
      transform(code, storyFile)?.code,
      [
        "import { fn } from 'storybook/test';",
        "export const Story = { args: { onLoad: fn(() => 'stubbed') } };",
        '',
      ].join('\n'),
    );
  });

  it('turns a mockReturnValue on an optional call of fn into fn with an implementation that returns the value', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      "export const Checked = { args: { load: fn?.().mockReturnValue('stubbed') } };",
      '',
    ].join('\n');

    assert.equal(
      transform(code, storyFile)?.code,
      [
        "import { fn } from 'storybook/test';",
        "export const Checked = { args: { load: fn(((value) => () => value)('stubbed')) } };",
        '',
      ].join('\n'),
    );
  });

  it('leaves a definition-time mockReturnValueOnce alone', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      "export const Once = { args: { load: fn().mockReturnValueOnce('stubbed') } };",
      '',
    ].join('\n');

    assert.equal(transform(code, storyFile), undefined);
  });

  it('leaves a definition-time mockResolvedValueOnce alone', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      'export const Once = { args: { save: fn().mockResolvedValueOnce(42) } };',
      '',
    ].join('\n');

    assert.equal(transform(code, storyFile), undefined);
  });

  it('leaves a definition-time mockRejectedValueOnce alone', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      "export const Once = { args: { save: fn().mockRejectedValueOnce(new Error('offline')) } };",
      '',
    ].join('\n');

    assert.equal(transform(code, storyFile), undefined);
  });

  it('leaves a definition-time mockImplementationOnce alone', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      "export const Once = { args: { onLoad: fn().mockImplementationOnce(() => 'stubbed') } };",
      '',
    ].join('\n');

    assert.equal(transform(code, storyFile), undefined);
  });

  it('leaves a stub chained after a *Once stub alone, so the *Once stub still runs first', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      'export const Chain = { args: { save: fn().mockResolvedValueOnce(1).mockResolvedValue(2) } };',
      '',
    ].join('\n');

    assert.equal(transform(code, storyFile), undefined);
  });

  it('rewrites only the first stub of a chain', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      'export const Chain = { args: { load: fn().mockReturnValue(1).mockReturnValue(2) } };',
      '',
    ].join('\n');

    assert.equal(
      transform(code, storyFile)?.code,
      [
        "import { fn } from 'storybook/test';",
        'export const Chain = { args: { load: fn(((value) => () => value)(1)).mockReturnValue(2) } };',
        '',
      ].join('\n'),
    );
  });

  it('keeps a mockName call before the stub it rewrites', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      "export const Named = { args: { load: fn().mockName('load').mockReturnValue(1) } };",
      '',
    ].join('\n');

    assert.equal(
      transform(code, storyFile)?.code,
      [
        "import { fn } from 'storybook/test';",
        "export const Named = { args: { load: fn(((value) => () => value)(1)).mockName('load') } };",
        '',
      ].join('\n'),
    );
  });

  it('keeps a mockName call before a mockImplementation it rewrites', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      "export const Named = { args: { load: fn().mockName('load').mockImplementation(() => 1) } };",
      '',
    ].join('\n');

    assert.equal(
      transform(code, storyFile)?.code,
      [
        "import { fn } from 'storybook/test';",
        "export const Named = { args: { load: fn(() => 1).mockName('load') } };",
        '',
      ].join('\n'),
    );
  });

  it('removes a stub called through an optional member access, with a comment before its name', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      'export const load = fn()?. /* stub */ mockReturnValue(1);',
      '',
    ].join('\n');

    assert.equal(
      transform(code, storyFile)?.code,
      [
        "import { fn } from 'storybook/test';",
        'export const load = fn(((value) => () => value)(1));',
        '',
      ].join('\n'),
    );
  });

  it('keeps the parentheses around a stub argument', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      'export const load = fn().mockReturnValue((1, 2));',
      '',
    ].join('\n');

    assert.equal(
      transform(code, storyFile)?.code,
      [
        "import { fn } from 'storybook/test';",
        'export const load = fn(((value) => () => value)((1, 2)));',
        '',
      ].join('\n'),
    );
  });

  it('keeps a top-level await in a mockName argument outside any function it adds', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      "export const load = fn().mockName(await Promise.resolve('load')).mockReturnValue(1);",
      '',
    ].join('\n');

    assert.equal(
      transform(code, storyFile)?.code,
      [
        "import { fn } from 'storybook/test';",
        "export const load = fn(((value) => () => value)(1)).mockName(await Promise.resolve('load'));",
        '',
      ].join('\n'),
    );
  });

  it('rewrites fn imported as value, the name of the stubbed value', () => {
    const code = [
      "import { fn as value } from 'storybook/test';",
      'export const load = value().mockReturnValue(1);',
      '',
    ].join('\n');

    assert.equal(
      transform(code, storyFile)?.code,
      [
        "import { fn as value } from 'storybook/test';",
        'export const load = value(((value) => () => value)(1));',
        '',
      ].join('\n'),
    );
  });

  it('keeps the parentheses around a spy call before a mockName call', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      "export const Named = { args: { load: (fn()).mockName('load').mockReturnValue(1) } };",
      '',
    ].join('\n');

    assert.equal(
      transform(code, storyFile)?.code,
      [
        "import { fn } from 'storybook/test';",
        "export const Named = { args: { load: (fn(((value) => () => value)(1))).mockName('load') } };",
        '',
      ].join('\n'),
    );
  });

  it('rewrites a stub inside the argument of a mockName call before the stub it belongs to', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      "export const Named = { args: { load: fn().mockName(fn().mockReturnValue('n')()).mockReturnValue(1) } };",
      '',
    ].join('\n');

    assert.equal(
      transform(code, storyFile)?.code,
      [
        "import { fn } from 'storybook/test';",
        "export const Named = { args: { load: fn(((value) => () => value)(1)).mockName(fn(((value) => () => value)('n'))()) } };",
        '',
      ].join('\n'),
    );
  });

  it('rewrites only the first stub of a chain of three', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      'export const Chain = { args: { load: fn().mockReturnValue(1).mockReturnValueOnce(2).mockReturnValue(3) } };',
      '',
    ].join('\n');

    assert.equal(
      transform(code, storyFile)?.code,
      [
        "import { fn } from 'storybook/test';",
        'export const Chain = { args: { load: fn(((value) => () => value)(1)).mockReturnValueOnce(2).mockReturnValue(3) } };',
        '',
      ].join('\n'),
    );
  });

  it('rewrites only the first stub of a chain split over lines', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      'export const Chain = {',
      '  args: {',
      '    load: fn()',
      '      .mockReturnValue(1)',
      '      .mockReturnValue(2),',
      '  },',
      '};',
      '',
    ].join('\n');

    assert.equal(
      transform(code, storyFile)?.code,
      [
        "import { fn } from 'storybook/test';",
        'export const Chain = {',
        '  args: {',
        '    load: fn(((value) => () => value)(1))',
        '      ',
        '      .mockReturnValue(2),',
        '  },',
        '};',
        '',
      ].join('\n'),
    );
  });

  it('leaves a stub inside a function alone', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      'export const Story = {',
      "  play: () => { fn().mockReturnValue('later'); },",
      '};',
      '',
    ].join('\n');

    assert.equal(transform(code, storyFile), undefined);
  });

  it('rewrites fn imported under another name with that name', () => {
    const code = [
      "import { fn as spy } from 'storybook/test';",
      "export const Checked = { args: { load: spy().mockReturnValue('stubbed') } };",
      '',
    ].join('\n');

    assert.equal(
      transform(code, storyFile)?.code,
      [
        "import { fn as spy } from 'storybook/test';",
        "export const Checked = { args: { load: spy(((value) => () => value)('stubbed')) } };",
        '',
      ].join('\n'),
    );
  });

  it('rewrites fn imported by a string name with its local name', () => {
    const code = [
      "import { 'fn' as spy } from 'storybook/test';",
      "export const Checked = { args: { load: spy().mockReturnValue('stubbed') } };",
      '',
    ].join('\n');

    assert.equal(
      transform(code, storyFile)?.code,
      [
        "import { 'fn' as spy } from 'storybook/test';",
        "export const Checked = { args: { load: spy(((value) => () => value)('stubbed')) } };",
        '',
      ].join('\n'),
    );
  });

  it('leaves a stub on an fn imported from another module alone', () => {
    const code = [
      "import { expect } from 'storybook/test';",
      "import { fn } from './spies';",
      "export const Checked = { args: { load: fn().mockReturnValue('stubbed') } };",
      '',
    ].join('\n');

    assert.equal(transform(code, storyFile), undefined);
  });

  it('leaves a stub on vi.fn alone', () => {
    const code = [
      "import { expect } from 'storybook/test';",
      "import { vi } from 'vitest';",
      "export const Checked = { args: { load: vi.fn().mockReturnValue('stubbed') } };",
      '',
    ].join('\n');

    assert.equal(transform(code, storyFile), undefined);
  });

  it('leaves a stub on a storybook/test import other than fn alone', () => {
    const code = [
      "import { spyOn } from 'storybook/test';",
      'export const Quiet = { args: { log: spyOn(console, "log").mockReturnValue(undefined) } };',
      '',
    ].join('\n');

    assert.equal(transform(code, storyFile), undefined);
  });

  it('leaves a computed member call alone when its key is named like a stub method', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      "const mockReturnValue = 'mockName';",
      "export const Named = { args: { load: fn()[mockReturnValue]('load') } };",
      '',
    ].join('\n');

    assert.equal(transform(code, storyFile), undefined);
  });

  it('leaves a stub on an object that new fn() creates alone', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      "export const Built = { args: { load: new fn().mockReturnValue('stubbed') } };",
      '',
    ].join('\n');

    assert.equal(transform(code, storyFile), undefined);
  });

  it('rewrites a stub with no argument, so the reset keeps it as it keeps one with an argument', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      'export const Empty = { args: { load: fn().mockResolvedValue() } };',
      '',
    ].join('\n');

    assert.equal(
      transform(code, storyFile)?.code,
      [
        "import { fn } from 'storybook/test';",
        'export const Empty = { args: { load: fn(((value) => async () => value)()) } };',
        '',
      ].join('\n'),
    );
  });

  it('rewrites every definition-time stub in a module', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      'export const Both = {',
      "  args: { load: fn().mockReturnValue('a'), save: fn().mockResolvedValue('b') },",
      '};',
      '',
    ].join('\n');

    assert.equal(
      transform(code, storyFile)?.code,
      [
        "import { fn } from 'storybook/test';",
        'export const Both = {',
        "  args: { load: fn(((value) => () => value)('a')), save: fn(((value) => async () => value)('b')) },",
        '};',
        '',
      ].join('\n'),
    );
  });

  it('throws on a module that does not parse, naming the package and the file', () => {
    const code = ["import { fn } from 'storybook/test';", 'const = ;', ''].join(
      '\n',
    );

    assert.throws(() => transform(code, storyFile), {
      message:
        /^@layzee\/storybook-mock-transformer: cannot parse D:\/project\/src\/Button\.stories\.tsx: /,
    });
  });

  it('keeps the parser error as the cause of the error it throws', () => {
    const code = ["import { fn } from 'storybook/test';", 'const = ;', ''].join(
      '\n',
    );

    assert.throws(
      () => transform(code, storyFile),
      (error: unknown) =>
        error instanceof Error &&
        error.cause instanceof SyntaxError &&
        error.message.endsWith(error.cause.message),
    );
  });

  it('parses a .ts module with an angle-bracket type assertion', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      "const label = <string>'stubbed';",
      'export const load = fn().mockReturnValue(label);',
      '',
    ].join('\n');

    assert.equal(
      transform(code, 'D:/project/src/spies.ts')?.code,
      [
        "import { fn } from 'storybook/test';",
        "const label = <string>'stubbed';",
        'export const load = fn(((value) => () => value)(label));',
        '',
      ].join('\n'),
    );
  });

  it('reads the file type from the id without its query', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      "export const load = fn().mockReturnValue(<string>'stubbed');",
      '',
    ].join('\n');

    assert.equal(
      transform(code, 'D:/project/src/spies.ts?v=1')?.code,
      [
        "import { fn } from 'storybook/test';",
        "export const load = fn(((value) => () => value)(<string>'stubbed'));",
        '',
      ].join('\n'),
    );
  });

  it('leaves a file that is not a script alone, even when it names storybook/test', () => {
    const code = [
      "import { Meta } from '@storybook/addon-docs/blocks';",
      '',
      '# Stubs come from `storybook/test`',
      '',
    ].join('\n');

    assert.equal(transform(code, 'D:/project/src/Stubs.mdx'), undefined);
  });

  it('leaves a file that is not a script alone in a folder whose name ends like a script', () => {
    const code = [
      "import { Meta } from '@storybook/addon-docs/blocks';",
      '',
      '# Stubs come from `storybook/test`',
      '',
    ].join('\n');

    assert.equal(
      transform(code, 'D:/project/src/chart.js/Stubs.mdx'),
      undefined,
    );
  });

  it('parses an .mts module with an angle-bracket type assertion', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      "export const load = fn().mockReturnValue(<string>'stubbed');",
      '',
    ].join('\n');

    assert.equal(
      transform(code, 'D:/project/src/spies.mts')?.code,
      [
        "import { fn } from 'storybook/test';",
        "export const load = fn(((value) => () => value)(<string>'stubbed'));",
        '',
      ].join('\n'),
    );
  });

  it('parses JSX in a .tsx module', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      "export const Checked = { args: { load: fn().mockReturnValue('stubbed') }, render: () => <button /> };",
      '',
    ].join('\n');

    assert.equal(
      transform(code, storyFile)?.code,
      [
        "import { fn } from 'storybook/test';",
        "export const Checked = { args: { load: fn(((value) => () => value)('stubbed')) }, render: () => <button /> };",
        '',
      ].join('\n'),
    );
  });

  it('leaves a module that does not name storybook/test alone, even when it does not parse', () => {
    const code = [
      '// @flow',
      'export function label(text: ?string) {}',
      '',
    ].join('\n');

    assert.equal(transform(code, 'D:/project/src/label.js'), undefined);
  });

  it('maps a column inside an unchanged part of a rewritten line back to the same column', () => {
    const line =
      "export const Checked = { args: { load: fn().mockReturnValue('stubbed') } };";
    const code = ["import { fn } from 'storybook/test';", line, ''].join('\n');
    const map = transform(code, storyFile)?.map;

    assert.ok(map);

    const entry = new SourceMap({
      file: storyFile,
      version: map.version,
      sources: map.sources,
      sourcesContent: [],
      names: map.names,
      mappings: map.mappings,
      sourceRoot: '',
    }).findEntry(1, line.indexOf('load'));

    assert.deepEqual(
      'originalLine' in entry && [entry.originalLine, entry.originalColumn],
      [1, line.indexOf('load')],
    );
  });

  it('returns a source map of the file it rewrote', () => {
    const code = [
      "import { fn } from 'storybook/test';",
      "export const Checked = { args: { load: fn().mockReturnValue('stubbed') } };",
      '',
    ].join('\n');

    assert.deepEqual(transform(code, `${storyFile}?v=1`)?.map.sources, [
      storyFile,
    ]);
  });
});

interface RecordedSpy {
  /** What the implementation the spy was made with returns. */
  readonly returns: unknown;
  readonly names: readonly unknown[];
}

/** Runs a rewritten module against an `fn` that records each spy it makes. */
function rewrittenSpies(
  ...declarations: readonly string[]
): readonly RecordedSpy[] {
  const code = [
    "import { fn } from 'storybook/test';",
    ...declarations,
    '',
  ].join('\n');
  const rewritten = transform(code, storyFile)?.code;

  if (rewritten === undefined) {
    throw new Error('The module was not rewritten.');
  }

  const body = rewritten
    .replace("import { fn } from 'storybook/test';", '')
    .replaceAll('export const', 'const');
  const spies: RecordedSpy[] = [];
  const fn = (implementation?: unknown) => {
    const names = new Array<unknown>();
    const spy: RecordedSpy = {
      returns:
        typeof implementation === 'function'
          ? Reflect.apply(implementation, undefined, [])
          : undefined,
      names,
    };
    const chain = {
      mockName: (name: unknown) => {
        names.push(name);

        return chain;
      },
      mockClear: () => chain,
    };
    spies.push(spy);

    return chain;
  };

  Reflect.apply(new Function('fn', body), undefined, [fn]);

  return spies;
}

describe('the rewritten module', () => {
  it('makes a spy whose implementation returns the stubbed value', () => {
    assert.deepEqual(
      rewrittenSpies('export const load = fn().mockReturnValue(42);'),
      [{ returns: 42, names: [] }],
    );
  });

  it('names the spy with the value of the variable that mockName reads, also when the variable is named like the stubbed value', () => {
    assert.deepEqual(
      rewrittenSpies(
        "const value = 'load';",
        'export const load = fn().mockName(value).mockClear().mockReturnValue(1);',
      ),
      [{ returns: 1, names: ['load'] }],
    );
  });

  it('makes a spy with the implementation that a mockImplementation after mockName passes', () => {
    assert.deepEqual(
      rewrittenSpies(
        "const implementation = () => 'loaded';",
        "export const load = fn().mockName('load').mockImplementation(implementation);",
      ),
      [{ returns: 'loaded', names: ['load'] }],
    );
  });
});
