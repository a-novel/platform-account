import { validateEmailUpdate, validatePasswordChange } from "#lib/application/auth/forms.js";
import type { AccountFormActions, AccountPasswordField, AccountScreenModel } from "#lib/application/auth/types.js";

import { type PasswordInputController, createPressedController } from "@a-novel-kit/uikit";

/** State rendered by the account-management component. */
export interface AccountScreenControllerState {
  model: AccountScreenModel;
  actions: AccountFormActions;
}

/** Pure account-management state and form transitions. */
export interface AccountScreenController {
  readonly state: AccountScreenControllerState;
  /** Shows or hides each password field's value. */
  readonly passwordVisibility: Record<AccountPasswordField, PasswordInputController>;
  /** Reconciles a completed route load or action with the rendered account state. */
  synchronize(model: AccountScreenModel, actions: AccountFormActions): void;
  /** Validates password fields into state and reports whether native submission may continue. */
  submitPassword(form: FormData): boolean;
  /** Validates the new email into state and reports whether native submission may continue. */
  submitEmail(form: FormData): boolean;
  /** Starts a logout submission. */
  submitLogout(): boolean;
}

/** Configuration for the default account-management controller. */
export interface AccountScreenControllerOptions extends AccountScreenControllerState {
  /** Allows the browser to submit forms after the controller accepts their transition. */
  allowNativeSubmission?: boolean;
}

/** Creates a reactive controller for the account-management screen. */
export function createAccountScreenController({
  model: initialModel,
  actions: initialActions,
  allowNativeSubmission = true,
}: AccountScreenControllerOptions): AccountScreenController {
  let model = $state(initialModel);
  let actions = $state(initialActions);

  function update(patch: Partial<AccountScreenModel>): boolean {
    model = { ...model, ...patch };
    return allowNativeSubmission;
  }

  return {
    get state() {
      return { model, actions };
    },
    passwordVisibility: {
      currentPassword: createPressedController(),
      newPassword: createPressedController(),
      confirmPassword: createPressedController(),
    },
    synchronize(nextModel, nextActions) {
      model = nextModel;
      actions = nextActions;
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
    submitLogout() {
      if (model.logoutState === "submitting") return false;
      return update({ logoutState: "submitting" });
    },
  };
}
