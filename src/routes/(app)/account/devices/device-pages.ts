import { dialogUrl } from "../url-state";

/** The URL parameter naming the page of each list of devices. */
const pageParameters = { active: "page", loggedOut: "loggedOutPage" } as const;

/** One of the tab's two lists of devices. */
export type DeviceList = keyof typeof pageParameters;

/**
 * The devices one page lists. The service returns 100 sessions at most, so the browser pages through one
 * bounded read. A larger cap in the service calls for paging there instead.
 */
const devicesPerPage = 10;

function readPage(parameters: URLSearchParams, list: DeviceList): number {
  const page = Number(parameters.get(pageParameters[list]));
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

/** Reads the page each list shows. A missing or invalid value shows the first. */
export function readPages(parameters: URLSearchParams): Record<DeviceList, number> {
  return { active: readPage(parameters, "active"), loggedOut: readPage(parameters, "loggedOut") };
}

/** Returns the URL with a list on one page, keeping the rest. The first page leaves no parameter. */
export function devicePageUrl(url: URL, list: DeviceList, page: number): URL {
  return dialogUrl(url, pageParameters[list], page > 1 ? String(page) : null);
}

/** Cuts one page out of a list. A page past the end shows the last one. */
export function pageOf<Item>(items: readonly Item[], requested: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / devicesPerPage));
  const page = Math.min(requested, totalPages);
  return { items: items.slice((page - 1) * devicesPerPage, page * devicesPerPage), page, totalPages };
}
