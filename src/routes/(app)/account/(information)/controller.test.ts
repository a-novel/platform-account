import { validForm } from "#lib/application/auth/forms.fixture.js";
import { validateEmailUpdate, validatePasswordChange } from "#lib/application/auth/forms.js";
import type { AccountEditor, AccountInformationModel } from "#lib/application/auth/types.js";

import { createInformationModel } from "./account-action";
import { type AccountInformationControllerOptions, createAccountInformationController } from "./controller.svelte";

import { describe, expect, it, vi } from "vitest";

import type { PictureSource } from "@a-novel-kit/uikit";

const ready = createInformationModel(
  { status: "ready", email: "creator@example.test", locationConsent: false },
  { status: "ready", username: "Maya" },
  null
);

/** A controller whose editor changes reach its URL, as the page's do. */
function controller(
  model: AccountInformationModel = ready,
  options: Partial<AccountInformationControllerOptions> = {}
) {
  let editor = model.editor;
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
    ...options,
    onEditorChange: (next) => {
      editor = next;
      options.onEditorChange?.(next);
    },
  });
}

describe("createAccountInformationController", () => {
  it("opens one editor at a time and reports each change once", () => {
    const onEditorChange = vi.fn();
    const information = controller(ready, { onEditorChange });

    information.editors.email.open();
    information.editors.email.open();
    expect(information.state.model.editor).toBe("email");
    expect(information.editors.email.state.open).toBe(true);
    expect(information.editors.password.state.open).toBe(false);

    information.editors.password.toggle();
    expect(information.state.model.editor).toBe("password");
    information.editors.password.toggle();
    expect(information.state.model.editor).toBeNull();
    information.editors.email.toggle();
    information.editors.email.close();

    expect(onEditorChange.mock.calls).toEqual([["email"], ["password"], [null], ["email"], [null]]);
  });

  it("starts a reopened editor from a blank form", () => {
    const information = controller({
      ...ready,
      editor: "password",
      passwordState: { status: "success", feedback: "passwordChanged" },
      emailState: { status: "validation-error", issues: [{ field: "newEmail", feedback: "email" }] },
    });

    information.editors.password.close();

    expect(information.state.model).toEqual(ready);
  });

  it("links each editor from the route's URL", () => {
    expect(controller().editorHref("email")).toBe("?edit=email");
    expect(controller().editorHref(null)).toBe("?");

    const editorUrl = (editor: string | null) => (editor ? `/account?menu=open&edit=${editor}` : "/account?menu=open");
    expect(controller(ready, { editorUrl }).editorHref("password")).toBe("/account?menu=open&edit=password");
    expect(controller(ready, { editorUrl }).editorHref(null)).toBe("/account?menu=open");
  });

  const forms = [
    ["password", "submitPassword", "passwordState", validatePasswordChange],
    ["email", "submitEmail", "emailState", validateEmailUpdate],
  ] as const;

  it.each(forms)("validates the %s form before it submits, once", (_, submit, key, validate) => {
    const information = controller();
    const invalid = new FormData();
    const expected = validate(invalid);
    if (expected.success) throw new Error("Expected an invalid form");

    expect(information[submit](invalid)).toBe(false);
    expect(information.state.model).toEqual({
      ...ready,
      [key]: { status: "validation-error", issues: expected.issues },
    });

    expect(information[submit](validForm())).toBe(true);
    expect(information.state.model[key]).toEqual({ status: "submitting" });
    expect(information[submit](validForm())).toBe(false);
    expect(JSON.stringify(information.state)).not.toContain("new-password");
  });

  it.each(forms)("keeps the %s submission in place when the route sends it", (_, submit, key) => {
    const information = controller(ready, { allowNativeSubmission: false });

    expect(information[submit](validForm())).toBe(false);
    expect(information.state.model[key]).toEqual({ status: "submitting" });
  });

  it("opens the editor the URL names and shows the route's action result in it", () => {
    let model = ready;
    let editor: AccountEditor | null = null;
    const information = controller(ready, { getModel: () => model, getEditor: () => editor });

    model = { ...ready, emailState: { status: "pending-email" } };
    editor = "email";
    expect(information.state.model).toEqual({ ...model, editor: "email" });
    expect(information.editors.email.state.open).toBe(true);

    editor = null;
    expect(information.editors.email.state.open).toBe(false);
    expect(information.state.model.emailState).toEqual({ status: "pending-email" });
  });

  it("shows each password field on its own", () => {
    const { passwordVisibility } = controller();

    passwordVisibility.emailCurrentPassword.toggle();

    expect(passwordVisibility.emailCurrentPassword.state.pressed).toBe(true);
    expect(passwordVisibility.currentPassword.state.pressed).toBe(false);
    expect(passwordVisibility.newPassword.state.pressed).toBe(false);
    expect(passwordVisibility.confirmPassword.state.pressed).toBe(false);
  });
});

/** Pictures the browser would decode and encode, as plain spies. */
function pictureFiles() {
  return {
    open: vi.fn(async () => ({ url: "blob:landscape", width: 1600, height: 900 })),
    encode: vi.fn(async () => new Blob(["picture"], { type: "image/webp" })),
    release: vi.fn(),
  };
}

describe("username editor", () => {
  it("opens on the current username and counts what the visitor types", () => {
    const information = controller();

    information.editors.username.open();
    expect(information.state.model.username).toEqual({ draft: "Maya", state: { status: "ready" } });

    information.editUsername("Maya Chen");
    expect(information.state.model.username.draft).toBe("Maya Chen");
  });

  it("refuses a name the service would refuse, and submits any other once", () => {
    const information = controller(ready, { allowNativeSubmission: true });
    const form = (username: string) => {
      const data = new FormData();
      data.set("username", username);
      return data;
    };

    expect(information.submitUsername(form("x".repeat(33)))).toBe(false);
    expect(information.state.model.username.state).toEqual({ status: "validation-error", issue: "length" });

    expect(information.submitUsername(form("  "))).toBe(true);
    expect(information.state.model.username).toEqual({ draft: "  ", state: { status: "submitting" } });
    expect(information.submitUsername(form("Maya"))).toBe(false);
  });
});

describe("picture editor", () => {
  it("frames a chosen image from its center, then pans and zooms it within the image", async () => {
    const pictures = pictureFiles();
    const information = controller({ ...ready, editor: "picture" }, { pictures });

    await information.choosePicture(new Blob(["image"]));
    expect(information.state.model.picture).toEqual({
      status: "cropping",
      source: { url: "blob:landscape", width: 1600, height: 900 },
      crop: { zoom: 1, x: 350, y: 0 },
    });

    expect(information.pictureFrame?.state.ratio).toEqual({ width: 1, height: 1 });
    information.pictureFrame?.zoom(2);
    information.pictureFrame?.pan(0.5, 0);
    information.pictureFrame?.zoom(9, 0, 0);
    expect(information.state.model.picture).toMatchObject({ crop: { zoom: 4, x: 350, y: 225 } });
    expect(information.pictureFrame?.state.crop).toEqual({ zoom: 4, x: 350, y: 225 });
  });

  it("reports a file the browser cannot open", async () => {
    const pictures = { ...pictureFiles(), open: vi.fn(async () => Promise.reject(new Error("not an image"))) };
    const information = controller({ ...ready, editor: "picture" }, { pictures });

    await information.choosePicture(new Blob(["text"]));

    expect(information.state.model.picture).toEqual({ status: "choosing", refusal: "unreadable" });
  });

  it("frames only the latest of two files chosen in a row, and frees the other", async () => {
    const pictures = pictureFiles();
    let finishFirst: (source: PictureSource) => void = () => {};
    pictures.open
      .mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)))
      .mockImplementationOnce(async () => ({ url: "blob:second", width: 400, height: 400 }));
    const information = controller({ ...ready, editor: "picture" }, { pictures });

    const first = information.choosePicture(new Blob(["first"]));
    await information.choosePicture(new Blob(["second"]));
    finishFirst({ url: "blob:first", width: 800, height: 600 });
    await first;

    expect(information.state.model.picture).toMatchObject({ source: { url: "blob:second" } });
    expect(pictures.release).toHaveBeenCalledExactlyOnceWith({ url: "blob:first", width: 800, height: 600 });
  });

  it("encodes the framed square once, under the profile service's rule, and keeps it still while it saves", async () => {
    const pictures = pictureFiles();
    const information = controller({ ...ready, editor: "picture" }, { pictures });
    await information.choosePicture(new Blob(["image"]));

    const saving = information.savePicture();
    expect(information.state.model.picture.status).toBe("saving");
    information.pictureFrame?.pan(0.5, 0);
    expect(information.pictureFrame?.state.crop).toEqual({ zoom: 1, x: 350, y: 0 });
    await expect(information.savePicture()).resolves.toBeNull();
    await expect(saving).resolves.toEqual(new Blob(["picture"], { type: "image/webp" }));
    expect(pictures.encode).toHaveBeenCalledExactlyOnceWith(
      { url: "blob:landscape", width: 1600, height: 900 },
      { zoom: 1, x: 350, y: 0 },
      { ratio: { width: 1, height: 1 }, maxWidth: 512, maxBytes: 262144 }
    );
  });

  it("frees the framed image when the dialog closes or the picture is removed", async () => {
    const pictures = pictureFiles();
    const information = controller({ ...ready, editor: "picture" }, { pictures });
    await information.choosePicture(new Blob(["image"]));

    information.editors.picture.close();
    expect(pictures.release).toHaveBeenCalledOnce();
    expect(information.state.model.picture).toEqual({ status: "choosing" });
    expect(information.pictureFrame).toBeNull();

    information.editors.picture.open();
    await information.choosePicture(new Blob(["image"]));
    expect(information.submitPictureRemoval()).toBe(true);
    expect(information.submitPictureRemoval()).toBe(false);
    expect(pictures.release).toHaveBeenCalledTimes(2);
  });

  it("waits for its scripts before it frames a picture", () => {
    const information = controller();

    expect(information.state.scripted).toBe(false);
    information.enableScripts();
    expect(information.state.scripted).toBe(true);
  });
});
