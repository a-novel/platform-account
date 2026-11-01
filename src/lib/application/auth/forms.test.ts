import {
  validateEmailRequest,
  validateEmailUpdate,
  validateInvitationRequest,
  validateLogin,
  validateNewPassword,
  validatePasswordChange,
} from "./forms";
import { formData } from "./forms.fixture";

import { describe, expect, it } from "vitest";

import {
  CredentialsCreateRequestSchema,
  CredentialsResetPasswordRequestSchema,
  CredentialsUpdatePasswordRequestSchema,
  PasswordSchema,
  ShortCodeCreateEmailUpdateRequestSchema,
  ShortCodeCreatePasswordResetRequestSchema,
  ShortCodeCreateRegisterRequestSchema,
  TokenCreateRequestSchema,
  WaitlistJoinRequestSchema,
} from "@a-novel/service-authentication-rest";

describe("service-derived auth validation", () => {
  const passwordLengths = [
    0,
    Number(PasswordSchema.minLength) - 1,
    Number(PasswordSchema.minLength),
    Number(PasswordSchema.maxLength),
    Number(PasswordSchema.maxLength) + 1,
  ];
  const newPasswordSchemas = [
    CredentialsCreateRequestSchema.pick({ password: true }),
    CredentialsResetPasswordRequestSchema.pick({ password: true }),
  ];

  it.each(passwordLengths)("matches each service password schema at length %i", (length) => {
    expect(PasswordSchema.minLength).toBeGreaterThan(0);
    expect(PasswordSchema.maxLength).toBeGreaterThan(Number(PasswordSchema.minLength));
    const password = "x".repeat(length);
    const values = { email: "creator@example.test", password, currentPassword: password, confirmPassword: password };
    const input = formData(values);
    expect(validateLogin(input).success).toBe(TokenCreateRequestSchema.safeParse(values).success);
    expect(validatePasswordChange(input).success).toBe(
      CredentialsUpdatePasswordRequestSchema.safeParse(values).success
    );
    for (const schema of newPasswordSchemas) {
      expect(validateNewPassword(input).success).toBe(schema.safeParse(values).success);
    }
  });

  const emailRequestSchemas = [
    ShortCodeCreateRegisterRequestSchema,
    ShortCodeCreatePasswordResetRequestSchema,
    ShortCodeCreateEmailUpdateRequestSchema,
  ];
  const longEmail = `${"a".repeat(400)}@example.test`;
  const emails = ["creator@example.test", "a+b@example.test", "not-an-email", "", longEmail];

  it.each(emails)("matches the service email checks for %s", (email) => {
    for (const schema of emailRequestSchemas) {
      const expected = schema.pick({ email: true }).safeParse({ email }).success;
      expect(validateEmailRequest(formData({ email })).success).toBe(expected);
      expect(validateEmailUpdate(formData({ email })).success).toBe(expected);
    }
  });

  const waitlistEmails = ["Creator@Example.test", "a+b@example.test", "not-an-email", "", longEmail];

  it.each(waitlistEmails)("matches the waitlist schema for %s", (email) => {
    expect(validateInvitationRequest(formData({ email })).success).toBe(
      WaitlistJoinRequestSchema.pick({ email: true }).safeParse({ email }).success
    );
  });

  it("trims invitation input without changing case-sensitive membership", () => {
    expect(validateInvitationRequest(formData({ email: " Creator@Example.test " }))).toEqual({
      success: true,
      value: { email: "Creator@Example.test" },
    });
  });

  it("normalizes email and preserves password whitespace", () => {
    expect(validateLogin(formData({ email: "  Creator@Example.com ", password: "  pass  " }))).toEqual({
      success: true,
      value: { email: "creator@example.com", password: "  pass  " },
    });
  });

  it("returns API bounds as translation values without echoing credentials", () => {
    const input = formData({
      password: "s".repeat(Number(PasswordSchema.maxLength) + 1),
      confirmPassword: "different-password",
    });
    const result = validateNewPassword(input);
    expect(result).toEqual({
      success: false,
      issues: [
        { field: "newPassword", feedback: "maxLength", limit: PasswordSchema.maxLength },
        { field: "confirmPassword", feedback: "passwordMismatch" },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("different-password");
    expect(JSON.stringify(result)).not.toContain("ssss");
    expect(
      validateLogin(
        formData({ email: "creator@example.test", password: "x".repeat(Number(PasswordSchema.minLength) - 1) })
      )
    ).toEqual({
      success: false,
      issues: [{ field: "password", feedback: "minLength", limit: PasswordSchema.minLength }],
    });
  });

  it("keeps one error per field and reports missing or non-text controls safely", () => {
    const input = new FormData();
    input.set("email", new Blob(["not-a-text-control"]), "email.txt");
    expect(validateLogin(input)).toEqual({
      success: false,
      issues: [
        { field: "email", feedback: "email" },
        { field: "password", feedback: "password" },
      ],
    });
    expect(validateEmailUpdate(input)).toEqual({ success: false, issues: [{ field: "newEmail", feedback: "email" }] });
    expect(validatePasswordChange(formData({ password: "valid-password" }))).toEqual({
      success: false,
      issues: [
        { field: "currentPassword", feedback: "currentPassword" },
        { field: "confirmPassword", feedback: "confirmPassword" },
      ],
    });
  });

  it("requires confirmation and strips it from valid service input", () => {
    const values = { password: "new-password", confirmPassword: "other-password", currentPassword: "old-password" };
    for (const validate of [validateNewPassword, validatePasswordChange]) {
      expect(validate(formData(values))).toEqual({
        success: false,
        issues: [{ field: "confirmPassword", feedback: "passwordMismatch" }],
      });
    }
    values.confirmPassword = values.password;
    expect(validateNewPassword(formData(values))).toEqual({ success: true, value: { password: values.password } });
    expect(validatePasswordChange(formData(values))).toEqual({
      success: true,
      value: { password: values.password, currentPassword: values.currentPassword },
    });
  });
});
