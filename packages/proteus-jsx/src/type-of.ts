import { muirMoiraMutatorsFieldOf } from '@muirjs/moira-mutators';

export function muirProteusJsxTypeOf(node: unknown): unknown {
  return muirMoiraMutatorsFieldOf(node, 'type');
}
