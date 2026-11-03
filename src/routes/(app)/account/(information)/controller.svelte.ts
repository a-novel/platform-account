import { validateEmailUpdate, validatePasswordChange } from "#lib/application/auth/forms.js";
import type {
  AccountEditor,
  AccountInformationActions,
  AccountInformationModel,
  AccountPasswordField,
} from "#lib/application/auth/types.js";

import { type OpenController, type PasswordInputController, createPressedController } from "@a-novel-kit/uikit";

/** State rendered by the "My information" tab. */
export interface AccountInformationControllerState {
  model: AccountInformationModel;
  actions: AccountInformationActions;
  /** The devices tab, which a password change's confirmation points to. */
  devicesHref: string;
  /** The devices tab with every other device's logout waiting for confirmation. */
  logoutOthersHref: string;
}

/** Pure state and transitions of the "My information" tab and its editing dialogs. */
export interface AccountInformationController {
  readonly state: AccountInformationControllerState;
  /** Shows or hides each password field's value, the email dialog's included. */
  readonly passwordVisibility: Record<AccountPasswordField | "emailCurrentPassword", PasswordInputController>;
  /** The email and password editing dialogs, open while the URL names them. */
  readonly editors: Record<AccountEditor, OpenController>;
  /** Native navigation destination that opens an editor, or closes it for null. */
  editorHref(editor: AccountEditor | null): string;
  /** Reconciles a completed route load or action with the rendered tab. */
  synchronize(model: AccountInformationModel): void;
  /** Validates password fields into state and reports whether native submission may continue. */
  submitPassword(form: FormData): boolean;
  /** Validates the email fields into state and reports whether native submission may continue. */
  submitEmail(form: FormData): boolean;
}

/** Configuration for the default "My information" controller. */
export interface AccountInformationControllerOptions extends AccountInformationControllerState {
  /** Allows the browser to submit forms after the controller accepts their transition. */
  allowNativeSubmission?: boolean;
  /** Observes accepted editor changes, which the route mirrors in the URL. */
  onEditorChange?: (editor: AccountEditor | null) => void;
  /** Builds the URL of an editor change, from the current route. */
  editorUrl?: (editor: AccountEditor | null) => string;
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
}: AccountInformationControllerOptions): AccountInformationController {
  let model = $state(initialModel);

  function update(patch: Partial<AccountInformationModel>): boolean {
    model = { ...model, ...patch };
    return allowNativeSubmission;
  }

  // Closing a dialog ends its journey, so the next opening starts from a blank form.
  function setEditor(editor: AccountEditor | null) {
    if (model.editor === editor) return;
    model = { ...model, editor, emailState: { status: "ready" }, passwordState: { status: "ready" } };
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

  return {
    get state() {
      return { model, actions, devicesHref, logoutOthersHref };
    },
    passwordVisibility: {
      currentPassword: createPressedController(),
      newPassword: createPressedController(),
      confirmPassword: createPressedController(),
      emailCurrentPassword: createPressedController(),
    },
    editors: { email: editorController("email"), password: editorController("password") },
    editorHref: editorUrl,
    synchronize(nextModel) {
      model = nextModel;
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
  };
}
