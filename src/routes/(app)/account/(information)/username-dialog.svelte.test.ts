import type { AccountInformationModel } from "#lib/application/auth/types.js";
import { withLocale } from "#lib/i18n/provider.fixture.js";
import { submitForm } from "#lib/ui/forms.fixture.js";

import { createInformationModel } from "./account-action";
import { createAccountInformationController } from "./controller.svelte";
import UsernameDialog from "./username-dialog.svelte";

import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

import "@a-novel-kit/uikit-fonts/fonts.css";
import "@a-novel-kit/uikit-tokens/tokens.css";

const credentials = { status: "ready", email: "maya.chen@example.test", locationConsent: false } as const;

function controller(patch: Partial<AccountInformationModel> = {}) {
  const profile = { status: "ready", username: "Maya" } as const;
  const { editor, ...model } = { ...createInformationModel(credentials, profile, "username"), ...patch };
  return createAccountInformationController({
    getModel: () => model,
    getEditor: () => editor,
    actions: {
      password: "?edit=password&/password",
      email: "?edit=email&/email",
      username: "?edit=username&/username",
      picture: "?edit=picture&/picture",
      removePicture: "?edit=picture&/removePicture",
    },
    devicesHref: "/account/devices",
    logoutOthersHref: "/account/devices?confirm=others",
    allowNativeSubmission: false,
  });
}

describe("username dialog", () => {
  it("opens on the current username and counts glyphs, not code points, as the visitor types", async () => {
    await render(UsernameDialog, { controller: controller() }, withLocale());

    const field = page.getByRole("dialog", { name: "Choose your username" }).getByLabelText("Username");
    await expect.element(field).toHaveValue("Maya");
    await expect.element(field).toHaveAccessibleDescription("Leave it empty to remove your username. 4 / 32");

    await field.fill("Maya 👩🏽‍💻");
    await expect.element(field).toHaveAccessibleDescription(/6 \/ 32$/);
  });

  it("marks the counter past the limit, and refuses the name before it posts", async () => {
    const information = controller();
    await render(UsernameDialog, { controller: information }, withLocale("fr"));

    const field = page.getByRole("dialog").getByLabelText("Nom d’utilisateur");
    await field.fill("x".repeat(33));
    const counter = page.getByText("33 / 32").element();
    expect(getComputedStyle(counter).color).not.toBe(getComputedStyle(counter.parentElement as Element).color);

    await submitForm("Enregistrer mon nom d’utilisateur");

    await expect.element(field).toHaveAttribute("aria-invalid", "true");
    await expect.element(field).toHaveAccessibleDescription(/Utilisez au maximum 32 caractères\.$/);
    expect(information.state.model.username.state).toEqual({ status: "validation-error", issue: "length" });
  });

  it("saves only a valid name other than the current one, and says why it refuses one as it is typed", async () => {
    const information = controller();
    information.enableScripts();
    await render(UsernameDialog, { controller: information }, withLocale());
    const dialog = page.getByRole("dialog", { name: "Choose your username" });
    const field = dialog.getByLabelText("Username");
    const save = dialog.getByRole("button", { name: "Save username" });

    await expect.element(save).toBeDisabled();
    await field.fill(" Maya ");
    await expect.element(save).toBeDisabled();
    await field.fill("Maya Chen");
    await expect.element(save).toBeEnabled();
    await field.fill("x".repeat(33));
    await expect.element(save).toBeDisabled();
    await expect.element(field).toHaveAttribute("aria-invalid", "true");
    await expect.element(field).toHaveAccessibleDescription(/Use 32 characters or fewer\.$/);
  });

  it("keeps the save off for a name the service refused, until the name changes", async () => {
    const information = controller({
      username: { draft: "Maya Chen", state: { status: "validation-error", issue: "refused" } },
    });
    information.enableScripts();
    await render(UsernameDialog, { controller: information }, withLocale());
    const dialog = page.getByRole("dialog", { name: "Choose your username" });
    const field = dialog.getByLabelText("Username");
    const save = dialog.getByRole("button", { name: "Save username" });

    await expect.element(save).toBeDisabled();
    await expect.element(field).toHaveAccessibleDescription(/This username can’t be used\. Choose another one\.$/);
    await field.fill("Maya Chén");
    await expect.element(save).toBeEnabled();
    await expect.element(field).not.toHaveAttribute("aria-invalid", "true");
  });

  it("keeps the save on without scripts, where the field reports no typing and the service checks the name", async () => {
    await render(UsernameDialog, { controller: controller() }, withLocale());

    await expect.element(page.getByRole("button", { name: "Save username" })).toBeEnabled();
  });

  it("posts an empty name, which removes the username", async () => {
    const information = controller();
    await render(UsernameDialog, { controller: information }, withLocale());

    await page.getByRole("dialog").getByLabelText("Username").fill("");
    const form = await submitForm("Save username");

    expect(form.getAttribute("action")).toBe("?edit=username&/username");
    expect(Object.fromEntries(new FormData(form))).toEqual({ username: "" });
    expect(information.state.model.username).toEqual({ draft: "", state: { status: "submitting" } });
    await expect.element(page.getByRole("button", { name: "Saving username…" })).toBeDisabled();
  });

  it("names the service's refusal on the field, and its outage above the button", async () => {
    await render(
      UsernameDialog,
      {
        controller: controller({
          username: { draft: "Maya", state: { status: "validation-error", issue: "refused" } },
        }),
      },
      withLocale()
    );
    await expect
      .element(page.getByRole("dialog").getByLabelText("Username"))
      .toHaveAccessibleDescription(/This username can’t be used\. Choose another one\.$/);
  });

  it("shows the service's outage in an alert", async () => {
    const editor = { draft: "Maya", state: { status: "service-error", feedback: "serviceUnavailable" } } as const;
    await render(UsernameDialog, { controller: controller({ username: editor }) }, withLocale());

    await expect.element(page.getByRole("alert")).toMatchTextContent(/Temporarily unavailable/);
  });
});
