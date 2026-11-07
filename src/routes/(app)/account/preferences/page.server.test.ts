import type { PageServerLoadEvent } from "./$types";
import { load as loadPreferences, actions as preferencesActions } from "./+page.server";

import { describe, expect, it, vi } from "vitest";

import type { RequestEvent } from "@sveltejs/kit";

vi.mock("$app/env/public", () => ({ PUBLIC_PLATFORM_DOMAIN: "storyverse.test" }));

const shared = { path: "/", domain: "storyverse.test" };

function event(cookie?: string, fields: Record<string, string> = {}) {
  const url = new URL("https://account.test/account/preferences?/language");
  return {
    url,
    cookies: { get: vi.fn(() => cookie), set: vi.fn(), delete: vi.fn() },
    request: new Request(url, { method: "POST", body: new URLSearchParams(fields) }),
  };
}

describe("preferences load", () => {
  it.each([
    { name: "reads the language the visitor chose", cookie: "fr", want: "fr" },
    { name: "follows the browser for a visitor who chose none", cookie: undefined, want: "browser" },
    { name: "follows the browser past a language the app does not support", cookie: "de", want: "browser" },
  ])("$name", ({ cookie, want }) => {
    const request = event(cookie);

    expect(loadPreferences(request as unknown as PageServerLoadEvent)).toEqual({ language: want });
    expect(request.cookies.get).toHaveBeenCalledWith("language");
  });
});

describe("language action", () => {
  it("keeps the chosen language for a year on every Agora app, then reloads the tab", async () => {
    const request = event(undefined, { language: "fr" });

    await expect(preferencesActions.language(request as unknown as RequestEvent)).rejects.toMatchObject({
      status: 303,
      location: "/account/preferences",
    });
    expect(request.cookies.set).toHaveBeenCalledWith("language", "fr", { ...shared, maxAge: 31536000 });
  });

  it.each<{ name: string; fields: Record<string, string> }>([
    { name: "forgets the choice to follow the browser again", fields: { language: "browser" } },
    { name: "forgets the choice on a language the app does not support", fields: { language: "de" } },
    { name: "forgets the choice when the form names none", fields: {} },
  ])("$name", async ({ fields }) => {
    const request = event("fr", fields);

    await expect(preferencesActions.language(request as unknown as RequestEvent)).rejects.toMatchObject({
      status: 303,
    });
    expect(request.cookies.delete).toHaveBeenCalledWith("language", shared);
    expect(request.cookies.set).not.toHaveBeenCalled();
  });
});
