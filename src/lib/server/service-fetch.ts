import { readFile } from "node:fs/promises";

/** ServiceFetchOptions describes who a platform service call is made for. */
export interface ServiceFetchOptions {
  /** The file of the projected service token that proves the platform's identity, on Kubernetes. */
  serviceTokenPath?: string;
  /** The visitor the call is made for. Health probes, made for nobody, leave it unset. */
  visitorAddress?: string;
  /** The visitor's request, whose browser and estimated location name the device a login opens. */
  visitorRequest?: Request;
}

/**
 * The visitor's headers a service reads, by the name it reads them under. Production's load balancer
 * sets the region and city on every request, over any value the browser sent.
 */
const visitorHeaders = [
  ["User-Agent", "X-Client-User-Agent"],
  ["X-Client-Region", "X-Client-Region"],
  ["X-Client-City", "X-Client-City"],
] as const;

/**
 * Wraps fetch for calls to a platform service. The service rate-limits by the visitor named in
 * `X-Client-IP`, and names their device from the `X-Client-*` headers. It trusts them because it
 * admits only the platform's identity.
 */
export function serviceFetch(options: ServiceFetchOptions, base: typeof fetch = fetch): typeof fetch {
  return async (input, init) => await base(input, { ...init, headers: await serviceHeaders(options, init?.headers) });
}

/** Adds the headers of a platform service call to a request's own, for a client that takes no fetch. */
export async function serviceHeaders(options: ServiceFetchOptions, init?: HeadersInit): Promise<Headers> {
  const headers = new Headers(init);
  if (options.visitorAddress) headers.set("X-Client-IP", options.visitorAddress);
  for (const [from, to] of visitorHeaders) {
    const value = options.visitorRequest?.headers.get(from);
    if (value) headers.set(to, value);
  }
  // The kubelet rotates the projected token in place, so each call reads the current one.
  if (options.serviceTokenPath) {
    headers.set("X-Service-Authorization", await readFile(options.serviceTokenPath, "utf8"));
  }

  return headers;
}
