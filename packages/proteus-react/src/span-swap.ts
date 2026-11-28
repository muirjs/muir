const spanSwapRoles: ReadonlySet<string> = new Set(['button', 'link']);

export function muirProteusReactSwapsToSpan(role: string | undefined): boolean {
  return role !== undefined && spanSwapRoles.has(role);
}

/**
 * The attributes of `a`, `area` and `button` that a span cannot take under some @types/react from 16.14.0 to 19.3.3
 * (TS2322); a span ignores them at run time. Typings from before April 2023 reject `autoFocus` and `rel`, later ones
 * allow them.
 */
export const muirProteusReactNotOnSpan: ReadonlySet<string> = new Set([
  'alt',
  'autoFocus',
  'coords',
  'disabled',
  'download',
  'form',
  'formAction',
  'formEncType',
  'formMethod',
  'formNoValidate',
  'formTarget',
  'href',
  'hrefLang',
  'media',
  'name',
  'ping',
  'referrerPolicy',
  'rel',
  'shape',
  'target',
  'type',
  'value',
]);
