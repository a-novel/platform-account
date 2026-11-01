import type { ShortCodeScreenModel } from "#lib/application/auth/types.js";
import { withLocale } from "#lib/i18n/provider.fixture.js";

import ShortCodeStory from "./story.svelte";

import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

import "@a-novel-kit/uikit-fonts/fonts.css";
import "@a-novel-kit/uikit-tokens/tokens.css";

describe("fixed visual review controllers", () => {
  it("pins secure-link completion instead of leaving the review page submitting", async () => {
    const initialModel: ShortCodeScreenModel = { journey: "password-reset", state: { status: "ready" } };
    render(ShortCodeStory, { initialModel }, withLocale());
    await page.getByLabelText(/^New password/).fill("long memorable test password");
    await page.getByLabelText("Confirm new password", { exact: false }).fill("long memorable test password");
    const submit = page.getByRole("button", { name: "Reset password" });
    await submit.click();
    await expect.element(submit).toBeEnabled();
  });
});
