import { muirProteusJsxResolveFromCore } from '../../src/install.ts';
import { exportedFunction } from '../support/exports.ts';

const mode = process.argv[2];
const instrumenter = await muirProteusJsxResolveFromCore();

if (mode === 'taken') {
  instrumenter.allMutators.push({
    name: 'MuirProteusJsxTextLiteral',
    mutate: () => [],
  });
}

const entry = await import('../../src/index.ts');

if (mode === 'install' || mode === 'taken') {
  await entry.muirProteusJsxMutators();
}

if (mode === 'undefined-option') {
  await Reflect.apply(entry.muirProteusJsxMutators, undefined, [
    { extended: undefined },
  ]);
}

const own = Symbol.for('@muirjs/proteus-jsx');

const ignorers = entry.strykerPlugins.map((plugin) => {
  const ignorer: unknown = Reflect.apply(plugin.factory, undefined, [{}]);
  const outcome: unknown = Reflect.apply(
    exportedFunction(ignorer, 'shouldIgnore'),
    ignorer,
    [{}],
  );

  return `${plugin.kind} ${plugin.name} ${String(outcome)}`;
});

console.log(
  JSON.stringify({
    registered: instrumenter.allMutators
      .filter((mutator) => own in mutator)
      .map(({ name }) => name),
    placerWrapped: own in instrumenter.expressionPlacer.target,
    ignorers,
    schema: entry.strykerValidationSchema,
  }),
);
