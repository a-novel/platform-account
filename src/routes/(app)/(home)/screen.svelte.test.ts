import { withLocale } from "#lib/i18n/provider.fixture.js";

import Screen from "./screen.svelte";

import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

describe("Screen", () => {
  it("welcomes an anonymous visitor with the way to log in", async () => {
    render(Screen, { loginHref: "/?auth=login&returnTo=%2Faccount" }, withLocale());

    await expect.element(page.getByRole("heading", { name: "Your Agora account", level: 1 })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: "Log in" }))
      .toHaveAttribute("href", "/?auth=login&returnTo=%2Faccount");
  });
});
