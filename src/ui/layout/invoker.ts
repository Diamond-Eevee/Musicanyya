/**
 * The control that opened the panel now showing, so closing the panel can hand focus back to it (FR-005). It is
 * kept here, and not in `viewState`, because it is a DOM node and the store holds plain data only.
 */
let invoker: HTMLElement | null = null;

/** Called by the control (a menu button) just before it opens a panel. */
export function rememberInvoker(element: HTMLElement | null): void {
  invoker = element;
}

/** True while a control that opened the current panel is remembered; a panel the app opened itself has none. */
export function hasInvoker(): boolean {
  return invoker !== null;
}

/** Called when the last panel closes: gives focus back to the remembered control, once, if it is still on the page. */
export function restoreInvokerFocus(): void {
  const target = invoker;
  invoker = null;
  if (target?.isConnected) target.focus();
}
