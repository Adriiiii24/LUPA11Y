/** Edición mínima de fragmentos HTML sin parser: solo toca la etiqueta de apertura. */

const OPEN_TAG = /^<([a-z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/i;

const escapeAttribute = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Nombre de la etiqueta de apertura del fragmento, en minúsculas. */
export function openingTagName(html: string): string | null {
  return OPEN_TAG.exec(html.trim())?.[1]?.toLowerCase() ?? null;
}

/**
 * Convierte un botón simulado (`<div role="button" tabindex="0">`) en un `<button>` nativo,
 * que ya responde a Enter y Espacio. null si el fragmento está incompleto o no es un botón.
 */
export function toNativeButton(html: string): string | null {
  const source = html.trim();
  const open = OPEN_TAG.exec(source);
  const tag = open?.[1]?.toLowerCase();
  if (!open || !tag || tag === 'button' || !source.toLowerCase().endsWith(`</${tag}>`)) return null;
  const attributes = (open[2] ?? '')
    .replace(/\s(?:role|tabindex)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?(?=\s|$)/gi, '')
    .trimEnd();
  const inner = source.slice(open[0].length, source.length - `</${tag}>`.length);
  return `<button type="button"${attributes}>${inner}</button>`;
}

/** Añade o sustituye un atributo en la etiqueta de apertura. Si no reconoce la etiqueta, devuelve el fragmento intacto. */
export function setAttribute(html: string, name: string, value: string): string {
  const source = html.trim();
  const open = OPEN_TAG.exec(source);
  if (!open) return html;
  const [whole, tag = '', rawAttributes = '', selfClosing = ''] = open;
  const attribute = new RegExp(`(\\s${escapeRegExp(name)})(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s"'=<>\`]+))?(?=\\s|$)`, 'i');
  const rendered = `$1="${escapeAttribute(value).replace(/\$/g, '$$$$')}"`;
  const attributes = attribute.test(rawAttributes)
    ? rawAttributes.replace(attribute, rendered)
    : `${rawAttributes} ${name}="${escapeAttribute(value)}"`;
  return `<${tag}${attributes}${selfClosing ? ' /' : ''}>${source.slice(whole.length)}`;
}
