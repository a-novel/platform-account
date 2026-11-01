const shortCodeResponseHeaders = {
  "cache-control": "no-store",
  // Referrers carry the origin alone, which keeps the link's secrets private. SvelteKit still reads
  // that origin to check native form posts.
  "referrer-policy": "strict-origin",
  "x-robots-tag": "noindex, nofollow",
} as const;

/** Keeps an email-link response out of caches, search indexes and referrers. */
export function secureShortCodeResponse(response: Response): Response {
  for (const [name, value] of Object.entries(shortCodeResponseHeaders)) {
    response.headers.set(name, value);
  }

  return response;
}
