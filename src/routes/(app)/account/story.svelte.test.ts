import type { AccountDevicesModel, AccountSummaryState } from "#lib/application/auth/types.js";
import { withLocale } from "#lib/i18n/provider.fixture.js";

import { createInformationModel } from "./(information)/account-action";
import AccountStory from "./story.svelte";

import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import "@a-novel-kit/uikit-fonts/fonts.css";
import "@a-novel-kit/uikit-tokens/tokens.css";

const summary: AccountSummaryState = { status: "ready", roles: ["auth:user"], email: "maya.chen@example.test" };
const credentials = { status: "ready", email: "maya.chen@example.test", locationConsent: false } as const;

describe("fixed visual review controllers", () => {
  it("keeps an editor open and its form usable after dismissal and submission", async () => {
    const information = createInformationModel(credentials, { status: "ready" }, "email");
    await render(AccountStory, { summary, tab: "information", information }, withLocale());

    const dialog = page.getByRole("dialog", { name: "Change your email" });
    await dialog.getByRole("link", { name: "Close dialog" }).click();
    await userEvent.keyboard("{Escape}");
    await dialog.getByLabelText(/^New email address/).fill("review@example.test");
    await dialog.getByRole("button", { name: "Send link" }).click();

    await expect.element(dialog).toBeVisible();
    await expect.element(dialog.getByLabelText(/^New email address/)).not.toHaveAttribute("readonly");
  });

  it("keeps a logout confirmation open after cancelling and submitting", async () => {
    const devices: AccountDevicesModel = {
      devices: {
        status: "ready",
        devices: [
          {
            id: "0c6f2bde-3d1e-4f5b-9a57-61f4c3e1b0a1",
            current: true,
            loggedOut: false,
            form: "desktop",
            lastActiveAt: "2026-11-03T18:40:00Z",
          },
        ],
      },
      locationConsent: false,
      confirmation: { kind: "others" },
      action: { status: "ready" },
    };
    await render(AccountStory, { summary, tab: "devices", devices }, withLocale());

    const dialog = page.getByRole("dialog", { name: "Log out all devices?" });
    await dialog.getByRole("link", { name: "Cancel" }).click();
    await userEvent.keyboard("{Escape}");
    await dialog.getByRole("button", { name: "Log out all devices" }).click();

    await expect.element(dialog).toBeVisible();
    await expect.element(dialog.getByRole("button", { name: "Log out all devices" })).toBeEnabled();
  });
});
