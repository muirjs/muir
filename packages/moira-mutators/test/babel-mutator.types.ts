// Checked by `npm run typecheck` and never run, as no test file imports it.
import type { NodePath, types } from '@babel/core';

import type { MuirMoiraMutatorsBabelMutator } from '../src/babel-mutator.ts';

type Narrowed = (
  path: NodePath<types.CallExpression>,
) => Generator<types.Node, void, undefined>;

// The instrumenter passes every path, not only call expressions, so a mutate that narrows its path is no mutate.
export const narrowedIsRejected: Narrowed extends MuirMoiraMutatorsBabelMutator['mutate']
  ? false
  : true = true;

type Wide = (path: NodePath) => Generator<types.Node, void, undefined>;

export const wideIsAccepted: Wide extends MuirMoiraMutatorsBabelMutator['mutate']
  ? true
  : false = true;
