/** Stable product feedback categories translated only at the rendering boundary. */
export type AuthenticationFeedback =
  | "emailUpdated"
  | "invalidCredentials"
  | "passwordChanged"
  | "passwordReset"
  | "registrationCompleted"
  | "serviceUnavailable"
  | "tooManyAttempts";

/** Stable validation categories translated only at the rendering boundary. */
export type AuthenticationValidation =
  | {
      feedback:
        "confirmPassword" | "currentPassword" | "email" | "invalidCurrentPassword" | "password" | "passwordMismatch";
    }
  | { feedback: "minLength" | "maxLength"; limit: number };

/** A validation problem tied to one named form control. */
export type FormIssue<Field extends string> = AuthenticationValidation & {
  field: Field;
};

/** Serializable states shared by progressively enhanced forms. */
export type FormState<Field extends string> =
  | { status: "ready" }
  | { status: "submitting" }
  | { status: "validation-error"; issues: readonly FormIssue<Field>[] }
  | { status: "service-error"; feedback: AuthenticationFeedback }
  | { status: "success"; feedback: AuthenticationFeedback };
