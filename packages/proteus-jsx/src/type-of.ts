import { fieldOf } from '@muirjs/moira-mutators';

export function typeOf(node: unknown): unknown {
  return fieldOf(node, 'type');
}
