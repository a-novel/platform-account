import type { AccountInformationModel } from "#lib/application/auth/types.js";
import { portraitPicture } from "#lib/application/profile/picture.fixture.js";
import type { ProfileState } from "#lib/application/profile/types.js";
import { withLocale } from "#lib/i18n/provider.fixture.js";

import { createInformationModel } from "./account-action";
import { createAccountInformationController } from "./controller.svelte";
import PictureDialog from "./picture-dialog.svelte";

import { describe, expect, it, onTestFinished } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import "@a-novel-kit/uikit-fonts/fonts.css";
import "@a-novel-kit/uikit-tokens/tokens.css";

const credentials = { status: "ready", email: "maya.chen@example.test", locationConsent: false } as const;

function controller(profile: ProfileState = { status: "ready" }, patch: Partial<AccountInformationModel> = {}) {
  const { editor, ...model } = { ...createInformationModel(credentials, profile, "picture"), ...patch };
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

/** Draws a wide image with a transparent corner, as a photo a visitor might choose. */
async function landscapeFile(width = 1200, height = 800): Promise<File> {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No 2D canvas");
  context.fillStyle = "#3d3a6b";
  context.fillRect(0, 0, width, height);
  context.clearRect(0, 0, 40, 40);
  context.fillStyle = "#fde7a6";
  context.fillRect(width / 2 - 100, height / 2 - 100, 200, 200);
  return new File([await canvas.convertToBlob({ type: "image/png" })], "landscape.png", { type: "image/png" });
}

/** Opens the dialog with scripts running, and frames a chosen file. */
async function frame(file: File) {
  const information = controller();
  information.enableScripts();
  await render(PictureDialog, { controller: information }, withLocale());
  await userEvent.upload(page.getByLabelText("Choose an image"), file);
  await expect.element(page.getByRole("application", { name: "Picture frame" })).toBeVisible();
  return information;
}

/** Keeps the dialog's native submission in the page, and returns the picture it would send. */
function interceptSubmission(): () => File | undefined {
  let sent: File | undefined;
  const intercept = (event: SubmitEvent) => {
    const field = (event.target as HTMLFormElement).elements.namedItem("picture");
    if (!(field instanceof HTMLInputElement) || !field.files?.length) return;
    event.preventDefault();
    sent = field.files[0];
  };
  document.addEventListener("submit", intercept, { capture: true });
  onTestFinished(() => document.removeEventListener("submit", intercept, { capture: true }));
  return () => sent;
}

/** Saves the framed picture and returns the file the form sends. */
async function save(): Promise<File> {
  const sent = interceptSubmission();
  await page.getByRole("button", { name: "Save picture" }).click();
  await expect.poll(sent).toBeDefined();
  return sent() as File;
}

describe("picture dialog", () => {
  it("says framing needs JavaScript until the page runs its scripts, and still removes a picture", async () => {
    const information = controller({ status: "ready", picture: portraitPicture });
    await render(PictureDialog, { controller: information }, withLocale());

    await expect.element(page.getByRole("dialog").getByText(/Framing a picture needs JavaScript/)).toBeVisible();
    await expect.element(page.getByLabelText("Choose an image")).not.toBeInTheDocument();
    const remove = page.getByRole("button", { name: "Remove picture" });
    expect((remove.element() as HTMLButtonElement).form?.getAttribute("action")).toBe("?edit=picture&/removePicture");
  });

  it("frames a chosen image with the keyboard and the slider", async () => {
    const information = await frame(await landscapeFile());
    expect(information.state.model.picture).toMatchObject({ crop: { zoom: 1, x: 200, y: 0 } });

    await userEvent.click(page.getByRole("application", { name: "Picture frame" }));
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}+");
    expect(information.state.model.picture).toMatchObject({ crop: { zoom: 1.1 } });
    expect(information.state.model.picture).toMatchObject({ crop: { x: 280 + (800 - 800 / 1.1) / 2 } });

    await page.getByRole("slider", { name: "Zoom" }).fill("1");
    expect(information.state.model.picture).toMatchObject({ crop: { zoom: 1 } });
  });

  it("names the file being framed, and drops it with the field's cross", async () => {
    const information = await frame(await landscapeFile());
    await expect.element(page.getByText("landscape.png")).toBeVisible();

    await page.getByRole("button", { name: "Remove landscape.png" }).click();

    await expect.element(page.getByRole("application", { name: "Picture frame" })).not.toBeInTheDocument();
    expect(information.state.model.picture).toEqual({ status: "choosing" });
  });

  it("sends the framed picture as a square WebP of at most 512 pixels and 256 KiB", async () => {
    await frame(await landscapeFile());

    const picture = await save();

    expect(picture.type).toBe("image/webp");
    expect(picture.size).toBeLessThanOrEqual(256 * 1024);
    const bitmap = await createImageBitmap(picture);
    expect([bitmap.width, bitmap.height]).toEqual([512, 512]);
    await expect.element(page.getByRole("button", { name: "Saving picture…" })).toBeDisabled();
  });

  it("reports a file the browser cannot open as an image", async () => {
    const information = controller();
    information.enableScripts();
    await render(PictureDialog, { controller: information }, withLocale());

    await userEvent.upload(
      page.getByLabelText("Choose an image"),
      new File(["not an image"], "notes.txt", { type: "text/plain" })
    );

    await expect
      .element(page.getByLabelText("Choose an image"))
      .toHaveAccessibleDescription("This file can’t be opened as an image. Choose another one.");
  });
});
