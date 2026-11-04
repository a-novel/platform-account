import type { AccountDeviceConfirmation } from "#lib/application/auth/types.js";

import { singleValue } from "../../auth-dialog-state";

/** The URL parameter naming the logout waiting for confirmation: a session ID, or `others`. */
export const confirmationParameter = "confirm";

const sessionID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads the logout waiting for confirmation. A duplicate or malformed value asks about none. */
export function readConfirmation(parameters: URLSearchParams): AccountDeviceConfirmation | null {
  const value = singleValue(parameters, confirmationParameter);
  if (value === "others") return { kind: "others" };
  return value && sessionID.test(value) ? { kind: "device", id: value } : null;
}

/** Writes a confirmation as its URL value. */
export function confirmationValue(confirmation: AccountDeviceConfirmation | null): string | null {
  if (!confirmation) return null;
  return confirmation.kind === "others" ? "others" : confirmation.id;
}
