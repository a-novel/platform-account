import type { ShortCodeState } from "#lib/application/auth/types.js";
import { withLocale } from "#lib/i18n/provider.fixture.js";
import { applyAction } from "$app/forms";
import { goto } from "$app/navigation";

import type { ActionData, PageData } from "./$types";
import EmailPage from "./+page.svelte";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

// SvelteKit 3's $app/forms imports $app/navigation, and the browser mocker cannot resolve one mock
// while loading the other's original, so both are stubbed without importOriginal.
vi.mock("$app/forms", () => ({ applyAction: vi.fn(), deserialize: (text: string) => JSON.parse(text) }));
vi.mock("$app/navigation", () => ({ goto: vi.fn() }));

function data(state: ShortCodeState = { status: "ready" }): PageData {
  return {
    locale: "en",
    downtime: null,
    downtimeStarted: false,
    model: { journey: "email-update", state },
    links: { restartHref: "/account", continueHref: "/account" },
  };
}

afterEach(() => vi.restoreAllMocks());
beforeEach(() => vi.clearAllMocks());

describe("automatic email validation", () => {
  it("posts once to the current URL and replaces the secret-bearing history entry", async () => {
    const result = { type: "redirect", status: 303, location: "/ext/email/validate?result=success" };
    const request = vi.spyOn(window, "fetch").mockResolvedValue(Response.json(result));
    await render(EmailPage, { data: data(), form: null }, withLocale());

    await expect
      .poll(() => vi.mocked(goto).mock.calls)
      .toEqual([[result.location, { replace: true, refreshAll: true }]]);
    expect(request).toHaveBeenCalledOnce();
    const [url, options] = request.mock.calls[0] ?? [];
    expect(url).toBe("");
    expect(options).toMatchObject({ method: "POST", headers: { "x-sveltekit-action": "true" } });
    expect(options?.body).toBeInstanceOf(FormData);
    if (options?.body instanceof FormData) expect(Array.from(options.body.keys())).toEqual([]);
    await expect.element(page.getByRole("status")).toMatchTextContent("Updating email…");
  });

  const settledLinks: { state: ShortCodeState; title: string }[] = [
    { state: { status: "success", feedback: "emailUpdated" }, title: "Email updated" },
    { state: { status: "invalid" }, title: "Confirm email: Invalid link" },
    { state: { status: "missing" }, title: "Confirm email: Incomplete link" },
  ];

  it.each(settledLinks)("does not post a $state.status link", async ({ state, title }) => {
    const request = vi.spyOn(window, "fetch");
    await render(EmailPage, { data: data(state), form: null }, withLocale());
    expect(request).not.toHaveBeenCalled();
    const heading = page.getByRole("heading", { level: 1 });
    await expect.element(heading).toBeVisible();
    expect(page.getByRole("heading").elements()).toHaveLength(1);
    expect(document.title).toBe(`${title} | Agora`);
  });

  it("keeps a failed server action visible without restarting it on mount", async () => {
    const request = vi.spyOn(window, "fetch");
    const form: ActionData = {
      shortCode: data({ status: "service-error", feedback: "serviceUnavailable" }).model,
    };
    await render(EmailPage, { data: data(), form }, withLocale());
    await expect.element(page.getByRole("alert")).toMatchTextContent("Please try again in a few minutes.");
    expect(request).not.toHaveBeenCalled();
  });

  it("shows a sanitized error on network failure without retrying", async () => {
    const request = vi.spyOn(window, "fetch").mockRejectedValue(new Error("private transport detail"));
    await render(EmailPage, { data: data(), form: null }, withLocale());
    await expect.element(page.getByRole("alert")).toMatchTextContent("Please try again in a few minutes.");
    expect(document.body.textContent).not.toContain("private transport detail");
    expect(request).toHaveBeenCalledOnce();
  });

  it("aborts on navigation and ignores a late response", async () => {
    const { promise, resolve } = Promise.withResolvers<Response>();
    const request = vi.spyOn(window, "fetch").mockReturnValue(promise);
    const view = await render(EmailPage, { data: data(), form: null }, withLocale());
    const signal = request.mock.calls[0]?.[1]?.signal;
    await view.unmount();
    expect(signal?.aborted).toBe(true);
    resolve(Response.json({ type: "redirect", status: 303, location: "/ext/email/validate?result=success" }));
    await request.mock.results[0]?.value;
    expect(applyAction).not.toHaveBeenCalled();
    expect(goto).not.toHaveBeenCalled();
  });
});
