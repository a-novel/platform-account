import { validateEmailRequest, validateInvitationRequest, validateLogin } from "#lib/application/auth/forms.js";
import type { AuthenticationJourney, AuthenticationPanelModel } from "#lib/application/auth/types.js";

import { type PasswordInputController, createPressedController } from "@a-novel-kit/uikit";

const validators = {
  login: validateLogin,
  register: validateInvitationRequest,
  reset: validateEmailRequest,
} satisfies Record<AuthenticationJourney, unknown>;

/** A form in one of these statuses is sending or done, and ignores another submission. */
const lockedStatuses = new Set(["submitting", "pending-email", "recorded"]);

/** State rendered by the authentication form component. */
export interface AuthenticationPanelControllerState {
  model: AuthenticationPanelModel;
  action: string;
}

/** Pure authentication-form state and transitions. */
export interface AuthenticationPanelController {
  readonly state: AuthenticationPanelControllerState;
  /** Shows or hides the password; every synchronization masks it again. */
  readonly passwordVisibility: PasswordInputController;
  /** Reconciles a completed route load or action with the rendered form. */
  synchronize(model: AuthenticationPanelModel, action: string): void;
  /** Validates submitted values, exposes field issues in state, and allows valid native submission. */
  submit(form: FormData): boolean;
}

/** Configuration for the default authentication-form controller. */
export interface AuthenticationPanelControllerOptions extends AuthenticationPanelControllerState {
  /** Allows the browser to submit the form after the controller accepts the transition. */
  allowNativeSubmission?: boolean;
}

/** Creates a reactive controller for a shell authentication form. */
export function createAuthenticationPanelController({
  model: initialModel,
  action: initialAction,
  allowNativeSubmission = true,
}: AuthenticationPanelControllerOptions): AuthenticationPanelController {
  let model = $state(initialModel);
  let action = $state(initialAction);
  const passwordVisibility = createPressedController();

  return {
    get state() {
      return { model, action };
    },
    passwordVisibility,
    synchronize(nextModel, nextAction) {
      passwordVisibility.setPressed(false);
      model = nextModel;
      action = nextAction;
    },
    submit(form) {
      if (lockedStatuses.has(model.state.status)) return false;

      const result = validators[model.journey](form);
      if (!result.success) {
        model = { ...model, state: { status: "validation-error", issues: result.issues } } as AuthenticationPanelModel;
        return false;
      }
      model = { ...model, state: { status: "submitting" } } as AuthenticationPanelModel;
      return allowNativeSubmission;
    },
  };
}
