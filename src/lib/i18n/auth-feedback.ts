import type { AuthenticationFeedback, AuthenticationValidation, FormIssue } from "#lib/application/auth/types.js";

import type { TFunction } from "i18next";

/** Resolves a stable authentication feedback category through the active locale. */
export function translateAuthenticationFeedback(t: TFunction<"common">, feedback: AuthenticationFeedback): string {
  switch (feedback) {
    case "emailUpdated":
      return t("form.feedback.emailUpdated");
    case "invalidCredentials":
      return t("form.feedback.invalidCredentials");
    case "passwordChanged":
      return t("form.feedback.passwordChanged");
    case "passwordReset":
      return t("form.feedback.passwordReset");
    case "registrationCompleted":
      return t("form.feedback.registrationCompleted");
    case "serviceUnavailable":
      return t("form.feedback.serviceUnavailable");
    case "tooManyAttempts":
      return t("form.feedback.tooManyAttempts");
  }
}

/** Resolves the validation issue reported for one form field, or undefined when the field has none. */
export function translateFieldIssue<Field extends string>(
  t: TFunction<"common">,
  issues: readonly FormIssue<Field>[],
  field: Field
): string | undefined {
  const issue = issues.find((candidate) => candidate.field === field);
  return issue ? translateAuthenticationValidation(t, issue) : undefined;
}

/** Resolves a stable form-validation category through the active locale. */
function translateAuthenticationValidation(t: TFunction<"common">, issue: AuthenticationValidation): string {
  switch (issue.feedback) {
    case "invalidCurrentPassword":
      return t("form.feedback.invalidCurrentPassword");
    case "confirmPassword":
      return t("form.validation.confirmPassword");
    case "currentPassword":
      return t("form.validation.currentPassword");
    case "email":
      return t("form.validation.email");
    case "minLength":
      return t("form.validation.minLength", { count: issue.limit });
    case "maxLength":
      return t("form.validation.maxLength", { count: issue.limit });
    case "password":
      return t("form.validation.password");
    case "passwordMismatch":
      return t("form.validation.passwordMismatch");
  }
}
