const spanSwapRoles: ReadonlySet<string> = new Set(['button', 'link']);

export function muirProteusJsxSwapsToSpan(role: string | undefined): boolean {
  return role !== undefined && spanSwapRoles.has(role);
}

/**
 * The attributes of `a`, `area` and `button` that a span cannot take under @types/react 19.3.0 (TS2322); a span
 * ignores them at run time.
 */
export const muirProteusJsxNotOnSpan: ReadonlySet<string> = new Set([
  'alt',
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
  'shape',
  'target',
  'type',
  'value',
]);
