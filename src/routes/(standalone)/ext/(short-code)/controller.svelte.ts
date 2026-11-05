import { validateNewPassword } from "#lib/application/auth/forms.js";
import type {
  AuthenticationFeedback,
  ShortCodePasswordField,
  ShortCodeScreenModel,
  ShortCodeState,
} from "#lib/application/auth/types.js";

import type { ShortCodeActionData, ShortCodePageData } from "./short-code";

import { type PasswordInputController, createPressedController } from "@a-novel-kit/uikit";

/** A link in one of these statuses is completing, completed or unusable, and ignores another submission. */
const lockedStatuses = new Set(["submitting", "success", "missing", "invalid"]);

/** State rendered by a standalone secure-link component. */
export interface ShortCodeScreenControllerState {
  model: ShortCodeScreenModel;
  action: string;
  restartHref: string;
  continueHref: string;
}

/** Pure secure-link state and form transitions. */
export interface ShortCodeScreenController {
  readonly state: ShortCodeScreenControllerState;
  /** Shows or hides each password field's value. */
  readonly passwordVisibility: Record<ShortCodePasswordField, PasswordInputController>;
  /** Validates password forms into state before submission. Email confirmation needs no form values. */
  submit(form?: FormData): boolean;
  /** Shows a failure the route met while it completed the link, until the route sends another state. */
  fail(feedback: AuthenticationFeedback): void;
}

/** Configuration for the default secure-link controller. */
export interface ShortCodeScreenControllerOptions {
  /** The link's state the route loads, or the result its action returns. */
  getState: () => ShortCodeScreenControllerState;
  /** Allows the browser to submit the form after the controller accepts the transition. */
  allowNativeSubmission?: boolean;
}

/** Creates a reactive controller for a standalone secure-link screen. */
export function createShortCodeScreenController({
  getState,
  allowNativeSubmission = true,
}: ShortCodeScreenControllerOptions): ShortCodeScreenController {
  // A submission shows until the route loads the link again or its action returns.
  let state = $derived(getState());

  function setStatus(status: ShortCodeState) {
    state = { ...state, model: { ...state.model, state: status } };
  }

  return {
    get state() {
      return state;
    },
    passwordVisibility: { newPassword: createPressedController(), confirmPassword: createPressedController() },
    submit(form = new FormData()) {
      if (lockedStatuses.has(state.model.state.status)) return false;

      if (state.model.journey !== "email-update") {
        const result = validateNewPassword(form);
        if (!result.success) {
          setStatus({ status: "validation-error", issues: result.issues });
          return false;
        }
      }
      setStatus({ status: "submitting" });
      return allowNativeSubmission;
    },
    fail: (feedback) => setStatus({ status: "service-error", feedback }),
  };
}

/** Maps sanitized SvelteKit route data into the standalone screen contract. */
export function shortCodeControllerState(
  data: ShortCodePageData,
  form?: ShortCodeActionData | null
): ShortCodeScreenControllerState {
  return { model: form?.shortCode ?? data.model, action: "", ...data.links };
}
