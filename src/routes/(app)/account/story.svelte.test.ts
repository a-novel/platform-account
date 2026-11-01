import type { AccountScreenModel } from "#lib/application/auth/types.js";
import { withLocale } from "#lib/i18n/provider.fixture.js";

import AccountStory from "./story.svelte";

import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

import "@a-novel-kit/uikit-fonts/fonts.css";
import "@a-novel-kit/uikit-tokens/tokens.css";

describe("fixed visual review controllers", () => {
  it("pins account form states while retaining editable native inputs", async () => {
    const initialModel: AccountScreenModel = {
      claims: { status: "loading" },
      credentials: { status: "unavailable" },
      passwordState: { status: "ready" },
      emailState: { status: "ready" },
      logoutState: "ready",
    };
    render(AccountStory, { initialModel }, withLocale());
    const email = page.getByRole("textbox", { name: "New email address" });
    await email.fill("review@example.test");
    const input = email.element() as HTMLInputElement;
    await page.getByRole("button", { name: "Send link", exact: true }).click();
    await expect.element(email).toBeEnabled();
    expect(input.form?.getAttribute("aria-busy")).toBe("false");
  });
});
