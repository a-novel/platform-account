/** Tells whether a click asks for another tab or window, which the browser opens from the link itself. */
function opensElsewhere(event: MouseEvent): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

/** Runs a transition in place of a plain link click. The link's own URL serves every other click. */
export function followInPlace(event: MouseEvent, transition: () => void) {
  if (event.defaultPrevented || opensElsewhere(event)) return;
  event.preventDefault();
  transition();
}
