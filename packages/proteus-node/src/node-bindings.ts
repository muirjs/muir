import type { NodePath, types } from '@babel/core';

import {
  muirMoiraNodeTestCalleeRoot,
  muirMoiraNodeTestImportOf,
} from '@muirjs/moira-node-test';
import { muirProteusNodeBuiltin, muirProteusNodeAssert } from './bindings.ts';

const nodeProcess = muirProteusNodeBuiltin('process');

export function muirProteusNodeIsNodeAssertCall(
  path: NodePath,
  call: types.CallExpression,
): boolean {
  const root = muirMoiraNodeTestCalleeRoot(call.callee);
  const source = root && muirMoiraNodeTestImportOf(path, root.name)?.source;

  return source !== undefined && muirProteusNodeAssert.has(source);
}

/** The global `process`, or the default or namespace import of `node:process`. */
export function muirProteusNodeIsProcess(
  path: NodePath,
  receiver: types.Node,
): boolean {
  if (receiver.type !== 'Identifier') {
    return false;
  }

  const from = muirMoiraNodeTestImportOf(path, receiver.name);

  return from === undefined
    ? receiver.name === 'process' && !path.scope.hasBinding('process')
    : nodeProcess.has(from.source) && from.imported === undefined;
}
