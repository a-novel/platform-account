import type { AccountInformationModel } from "#lib/application/auth/types.js";
import { portraitPicture } from "#lib/application/profile/picture.fixture.js";
import type { ProfileState } from "#lib/application/profile/types.js";
import { withLocale } from "#lib/i18n/provider.fixture.js";

import { createInformationModel } from "./account-action";
import { createAccountInformationController } from "./controller.svelte";
import PictureDialog from "./picture-dialog.svelte";

import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";

import "@a-novel-kit/uikit-fonts/fonts.css";
import "@a-novel-kit/uikit-tokens/tokens.css";

const credentials = { status: "ready", email: "maya.chen@example.test", locationConsent: false } as const;

function controller(profile: ProfileState = { status: "ready" }, patch: Partial<AccountInformationModel> = {}) {
  return createAccountInformationController({
    model: { ...createInformationModel(credentials, profile, "picture"), ...patch },
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("picture dialog", () => {
  it("says framing needs JavaScript until the page runs its scripts, and still removes a picture", async () => {
    const information = controller({ status: "ready", picture: portraitPicture });
    await render(PictureDialog, { controller: information }, withLocale());

    await expect.element(page.getByRole("dialog").getByText(/Framing a picture needs JavaScript/)).toBeVisible();
    await expect.element(page.getByLabelText("Choose an image")).not.toBeInTheDocument();
    const remove = page.getByRole("button", { name: "Remove picture" });
    expect((remove.element() as HTMLButtonElement).form?.getAttribute("action")).toBe("?edit=picture&/removePicture");
  });

  it("frames a chosen image with the keyboard, the wheel and the slider", async () => {
    const information = await frame(await landscapeFile());
    expect(information.state.model.picture).toMatchObject({ crop: { zoom: 1, x: 200, y: 0 } });

    await userEvent.click(page.getByRole("application", { name: "Picture frame" }));
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}+");
    expect(information.state.model.picture).toMatchObject({ crop: { zoom: 1.1 } });
    expect(information.state.model.picture).toMatchObject({ crop: { x: 280 + (800 - 800 / 1.1) / 2 } });

    const stage = page.getByRole("application").element();
    const box = stage.getBoundingClientRect();
    stage.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -500, clientX: box.left, clientY: box.top, cancelable: true })
    );
    expect(information.pictureZoom.state.value).toBeCloseTo(1.1 * Math.E);

    await page.getByRole("slider", { name: "Zoom" }).fill("1");
    expect(information.pictureZoom.state.value).toBe(1);
  });

  it("pans with a drag and zooms with a pinch around the fingers", async () => {
    const information = await frame(await landscapeFile());
    const stage = page.getByRole("application").element() as HTMLElement;
    // Synthetic pointers are not active pointers, which the browser refuses to capture.
    stage.setPointerCapture = () => {};
    const box = stage.getBoundingClientRect();
    const pointer = (type: string, pointerId: number, x: number, y: number) =>
      stage.dispatchEvent(
        new PointerEvent(type, { pointerId, clientX: box.left + x, clientY: box.top + y, bubbles: true })
      );

    pointer("pointerdown", 1, 100, 100);
    pointer("pointermove", 1, 100 + box.width / 10, 100);
    pointer("pointerup", 1, 100 + box.width / 10, 100);
    expect(information.state.model.picture).toMatchObject({ crop: { zoom: 1, x: 120 } });

    pointer("pointerdown", 1, 0, 0);
    pointer("pointerdown", 2, box.width / 2, box.width / 2);
    pointer("pointermove", 2, box.width, box.width);
    expect(information.pictureZoom.state.value).toBeCloseTo(2);
  });

  it("saves a square WebP of at most 512 pixels on an opaque white ground", async () => {
    await frame(await landscapeFile());

    const picture = await save();

    expect(picture.type).toBe("image/webp");
    expect(picture.size).toBeLessThanOrEqual(256 * 1024);
    const bitmap = await createImageBitmap(picture);
    expect([bitmap.width, bitmap.height]).toEqual([512, 512]);
    await expect.element(page.getByRole("button", { name: "Saving picture…" })).toBeDisabled();
  });

  it("saves a JPEG where the browser cannot encode WebP, as Safari", async () => {
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
      this: HTMLCanvasElement,
      done,
      type,
      quality
    ) {
      toBlob.call(this, done, type === "image/webp" ? "image/png" : type, quality);
    });
    await frame(await landscapeFile(300, 200));

    const picture = await save();

    expect(picture.type).toBe("image/jpeg");
    expect((await createImageBitmap(picture)).width).toBe(200);
  });

  it("lowers the quality until the picture fits 256 KiB", async () => {
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    const encode = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
      this: HTMLCanvasElement,
      done,
      type,
      quality
    ) {
      if (quality !== undefined && quality > 0.75) done(new Blob([new Uint8Array(300 * 1024)], { type }));
      else toBlob.call(this, done, type, quality);
    });
    await frame(await landscapeFile());

    const picture = await save();

    expect(picture.size).toBeLessThanOrEqual(256 * 1024);
    expect(encode.mock.calls.map(([, , quality]) => quality)).toEqual([0.9, 0.8, 0.7]);
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
