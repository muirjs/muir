import { muirMoiraMutatorsFieldOf } from '@muirjs/moira-mutators';

export function muirShadowcatJsTypeOf(node: unknown): unknown {
  return muirMoiraMutatorsFieldOf(node, 'type');
}
