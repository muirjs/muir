import { muirMoiraMutatorsFieldOf } from '@muirjs/moira-mutators';

export function muirProteusReactTypeOf(node: unknown): unknown {
  return muirMoiraMutatorsFieldOf(node, 'type');
}
