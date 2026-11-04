import { validateEmailUpdate, validatePasswordChange } from "#lib/application/auth/forms.js";
import type {
  AccountEditor,
  AccountInformationActions,
  AccountInformationModel,
  AccountPasswordField,
} from "#lib/application/auth/types.js";
import type { PictureCrop, PictureSource } from "#lib/application/profile/types.js";
import { usernameIssue } from "#lib/application/profile/username.js";

import { blankEditors } from "./account-action";
import { centeredCrop, panCrop, zoomCrop } from "./crop";
import { type PictureFiles, browserPictureFiles } from "./picture-file";

import {
  type OpenController,
  type PasswordInputController,
  type SliderController,
  createPressedController,
} from "@a-novel-kit/uikit";

/** State rendered by the "My information" tab. */
export interface AccountInformationControllerState {
  model: AccountInformationModel;
  actions: AccountInformationActions;
  /** The devices tab, which a password change's confirmation points to. */
  devicesHref: string;
  /** The devices tab with every other device's logout waiting for confirmation. */
  logoutOthersHref: string;
  /** Whether the page runs its scripts, which framing a picture needs. */
  scripted: boolean;
}

/** Pure state and transitions of the "My information" tab and its editing dialogs. */
export interface AccountInformationController {
  readonly state: AccountInformationControllerState;
  /** Shows or hides each password field's value, the email dialog's included. */
  readonly passwordVisibility: Record<AccountPasswordField | "emailCurrentPassword", PasswordInputController>;
  /** The editing dialogs, open while the URL names them. */
  readonly editors: Record<AccountEditor, OpenController>;
  /** The zoom of the picture being framed, which the picture dialog's slider shows and sets. */
  readonly pictureZoom: SliderController;
  /** Native navigation destination that opens an editor, or closes it for null. */
  editorHref(editor: AccountEditor | null): string;
  /** Reconciles a completed route load or action with the rendered tab. */
  synchronize(model: AccountInformationModel): void;
  /** Records that the page runs its scripts, once it has hydrated. */
  enableScripts(): void;
  /** Validates password fields into state and reports whether native submission may continue. */
  submitPassword(form: FormData): boolean;
  /** Validates the email fields into state and reports whether native submission may continue. */
  submitEmail(form: FormData): boolean;
  /** Keeps the username being typed, which the dialog counts. */
  editUsername(draft: string): void;
  /** Checks the username against the service's rule and reports whether native submission may continue. */
  submitUsername(form: FormData): boolean;
  /** Opens an image file for framing, or reports that the browser cannot open it. */
  choosePicture(file: Blob): Promise<void>;
  /** Moves the image under the frame by a distance given in fractions of the frame's side. */
  panPicture(dx: number, dy: number): void;
  /** Zooms the image around a focus point given in fractions of the frame's side, the center by default. */
  zoomPicture(zoom: number, focusX?: number, focusY?: number): void;
  /** Encodes the framed picture for its form, or returns null when the browser cannot. */
  savePicture(): Promise<Blob | null>;
  /** Starts removing the picture and reports whether native submission may continue. */
  submitPictureRemoval(): boolean;
}

/** Configuration for the default "My information" controller. */
export interface AccountInformationControllerOptions extends Omit<AccountInformationControllerState, "scripted"> {
  /** Allows the browser to submit forms after the controller accepts their transition. */
  allowNativeSubmission?: boolean;
  /** Observes accepted editor changes, which the route mirrors in the URL. */
  onEditorChange?: (editor: AccountEditor | null) => void;
  /** Builds the URL of an editor change, from the current route. */
  editorUrl?: (editor: AccountEditor | null) => string;
  /** Decodes and encodes pictures; the browser's canvas by default. */
  pictures?: PictureFiles;
}

/** Creates a reactive controller for the "My information" tab. */
export function createAccountInformationController({
  model: initialModel,
  actions,
  devicesHref,
  logoutOthersHref,
  allowNativeSubmission = true,
  onEditorChange,
  editorUrl = (editor) => (editor ? `?edit=${editor}` : "?"),
  pictures = browserPictureFiles,
}: AccountInformationControllerOptions): AccountInformationController {
  let model = $state(initialModel);
  let scripted = $state(false);
  // Counts the files chosen, so only the latest one opens once decoded.
  let choices = 0;

  function update(patch: Partial<AccountInformationModel>): boolean {
    model = { ...model, ...patch };
    return allowNativeSubmission;
  }

  /** Frees the image being framed, once the picture dialog shows it no more. */
  function releasePicture() {
    if (model.picture.status === "cropping" || model.picture.status === "saving")
      pictures.release(model.picture.source);
  }

  // Closing a dialog ends its journey, so the next opening starts from a blank form.
  function setEditor(editor: AccountEditor | null) {
    if (model.editor === editor) return;
    releasePicture();
    model = { ...model, editor, ...blankEditors(model.profile) };
    onEditorChange?.(editor);
  }

  function editorController(editor: AccountEditor): OpenController {
    return {
      get state() {
        return { open: model.editor === editor };
      },
      open: () => setEditor(editor),
      close: () => setEditor(null),
      toggle: () => setEditor(model.editor === editor ? null : editor),
    };
  }

  /** Applies a change of framing while the picture is being framed. */
  function reframe(change: (source: PictureSource, crop: PictureCrop) => PictureCrop) {
    const picture = model.picture;
    if (picture.status !== "cropping") return;
    model = { ...model, picture: { ...picture, crop: change(picture.source, picture.crop) } };
  }

  return {
    get state() {
      return { model, actions, devicesHref, logoutOthersHref, scripted };
    },
    passwordVisibility: {
      currentPassword: createPressedController(),
      newPassword: createPressedController(),
      confirmPassword: createPressedController(),
      emailCurrentPassword: createPressedController(),
    },
    editors: {
      email: editorController("email"),
      password: editorController("password"),
      username: editorController("username"),
      picture: editorController("picture"),
    },
    pictureZoom: {
      get state() {
        const picture = model.picture;
        return { value: picture.status === "cropping" || picture.status === "saving" ? picture.crop.zoom : 1 };
      },
      setValue: (zoom) => reframe((source, crop) => zoomCrop(source, crop, zoom)),
    },
    editorHref: editorUrl,
    synchronize(nextModel) {
      model = nextModel;
    },
    enableScripts() {
      scripted = true;
    },
    submitPassword(form) {
      if (model.passwordState.status === "submitting") return false;
      const result = validatePasswordChange(form);
      if (!result.success) {
        update({ passwordState: { status: "validation-error", issues: result.issues } });
        return false;
      }
      return update({ passwordState: { status: "submitting" } });
    },
    submitEmail(form) {
      if (model.emailState.status === "submitting") return false;
      const result = validateEmailUpdate(form);
      if (!result.success) {
        update({ emailState: { status: "validation-error", issues: result.issues } });
        return false;
      }
      return update({ emailState: { status: "submitting" } });
    },
    editUsername(draft) {
      model = { ...model, username: { ...model.username, draft } };
    },
    submitUsername(form) {
      if (model.username.state.status === "submitting") return false;
      const draft = String(form.get("username") ?? "");
      const issue = usernameIssue(draft);
      if (issue) {
        update({ username: { draft, state: { status: "validation-error", issue } } });
        return false;
      }
      return update({ username: { draft, state: { status: "submitting" } } });
    },
    async choosePicture(file) {
      releasePicture();
      const choice = ++choices;
      model = { ...model, picture: { status: "opening" } };

      try {
        const source = await pictures.open(file);
        if (choice !== choices || model.picture.status !== "opening") return pictures.release(source);
        model = { ...model, picture: { status: "cropping", source, crop: centeredCrop(source) } };
      } catch {
        if (choice !== choices || model.picture.status !== "opening") return;
        model = { ...model, picture: { status: "choosing", refusal: "unreadable" } };
      }
    },
    panPicture(dx, dy) {
      reframe((source, crop) => panCrop(source, crop, dx, dy));
    },
    zoomPicture(zoom, focusX, focusY) {
      reframe((source, crop) => zoomCrop(source, crop, zoom, focusX, focusY));
    },
    async savePicture() {
      const picture = model.picture;
      if (picture.status !== "cropping") return null;
      model = { ...model, picture: { ...picture, status: "saving" } };

      try {
        return await pictures.encode(picture.source, picture.crop);
      } catch {
        pictures.release(picture.source);
        model = { ...model, picture: { status: "choosing", refusal: "unreadable" } };
        return null;
      }
    },
    submitPictureRemoval() {
      if (model.picture.status === "removing" || model.picture.status === "saving") return false;
      releasePicture();
      return update({ picture: { status: "removing" } });
    },
  };
}
