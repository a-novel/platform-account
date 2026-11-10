import { withParameter } from "../auth-dialog-state";

/** The URL parameter naming the open account editor. */
export const editorParameter = "edit";

/** The address bar's URL in the browser, and the request's while the server renders. */
export function addressBar(requestUrl: Pick<URL, "href">): URL {
  return new URL(typeof window === "undefined" ? requestUrl.href : window.location.href);
}

/**
 * Returns the URL with one dialog parameter set, or removed for null, keeping the rest. A form action's name
 * leaves with it, so a dialog closed after a submission never names an action.
 */
export function dialogUrl(url: URL, name: string, value: string | null): URL {
  const next = withParameter(url, name, value);
  for (const key of [...next.searchParams.keys()]) if (key.startsWith("/")) next.searchParams.delete(key);
  return next;
}

/** A URL as a link's destination on this site. */
export function localHref(url: URL): string {
  return url.pathname + url.search + url.hash;
}
