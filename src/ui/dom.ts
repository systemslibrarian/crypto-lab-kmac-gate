/** Tiny DOM helpers. No framework; the page is small enough to build by hand. */

type Attrs = Record<string, string | number | boolean | undefined>
type Child = Node | string | null | undefined

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue
    if (key === 'class') node.className = String(value)
    else if (key === 'text') node.textContent = String(value)
    else if (value === true) node.setAttribute(key, '')
    else node.setAttribute(key, String(value))
  }
  append(node, children)
  return node
}

export function svgEl(tag: string, attrs: Attrs = {}, ...children: Child[]): SVGElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue
    node.setAttribute(key, String(value))
  }
  append(node, children)
  return node
}

function append(node: Node, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined) continue
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child)
  }
}

export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild)
}

export function replace(node: Element, ...children: Child[]): void {
  clear(node)
  append(node, children)
}

/** A labelled form control, with a real <label for>. */
export function field(
  id: string,
  labelText: string,
  control: HTMLElement,
  hint?: string,
  extraClass = '',
): HTMLElement {
  control.id = id
  const parts: Child[] = [el('label', { for: id, text: labelText })]
  const isSelect = control.tagName === 'SELECT'
  parts.push(isSelect ? el('span', { class: 'select-wrap' }, control) : control)
  if (hint) parts.push(el('span', { class: 'hint', text: hint }))
  return el('div', { class: `field ${extraClass}`.trim() }, ...parts)
}

export function select(options: { value: string; label: string }[], value: string): HTMLSelectElement {
  const node = el('select')
  for (const option of options) {
    node.appendChild(el('option', { value: option.value, text: option.label }))
  }
  node.value = value
  return node
}

/** A live region for computed output — async results must announce themselves. */
export function liveRegion(className = ''): HTMLElement {
  return el('div', { class: className, role: 'status', 'aria-live': 'polite' })
}

/**
 * A horizontally scrollable container. Anything that scrolls must be keyboard
 * reachable and named, or it is a 2.1.1 keyboard trap for anyone not using a
 * mouse (WCAG 2.1.1 / 1.3.1).
 */
export function scrollRegion(label: string, className: string, ...children: Child[]): HTMLElement {
  return el(
    'div',
    { class: className, role: 'region', 'aria-label': label, tabindex: '0' },
    ...children,
  )
}
