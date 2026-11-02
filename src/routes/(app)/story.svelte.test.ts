import type { ShellViewModel } from "#lib/application/shell/types.js";
import { withLocale } from "#lib/i18n/provider.fixture.js";

import ShellStory from "./story.svelte";

import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import "@a-novel-kit/uikit-fonts/fonts.css";
import "@a-novel-kit/uikit-tokens/tokens.css";

const shell: ShellViewModel = { authView: "login", session: { status: "anonymous" } };

describe("fixed visual review controllers", () => {
  it("keeps the login journey open and ready after dismissal, navigation, and submission", async () => {
    render(ShellStory, { initialModel: shell }, withLocale());
    await page.getByRole("link", { name: "Close dialog" }).click();
    await userEvent.keyboard("{Escape}");
    await page.getByRole("link", { name: "Register" }).click();
    await expect.element(page.getByRole("dialog", { name: "Log in" })).toBeVisible();
    await page.getByRole("textbox", { name: "Email address" }).fill("review@example.test");
    await page.getByLabelText(/^Password/).fill("long memorable test password");
    await page.getByRole("dialog").getByRole("button", { name: "Log in", exact: true }).click();
    await expect.element(page.getByRole("textbox", { name: "Email address" })).toBeEnabled();
    await expect.element(page.getByRole("dialog", { name: "Log in" })).toBeVisible();
  });
});
