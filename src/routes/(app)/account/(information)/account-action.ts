import type { AccountCredentialsState, AccountEditor, AccountInformationModel } from "#lib/application/auth/types.js";

/** AccountActionData is the result an account form action returns to the page. */
export type AccountActionData =
  | { accountAction: { kind: "email"; state: AccountInformationModel["emailState"] } }
  | { accountAction: { kind: "password"; state: AccountInformationModel["passwordState"] } };

/** Applies an account action's result to the form it came from, ignoring any other data. */
export function mergeAccountAction(model: AccountInformationModel, data: unknown): AccountInformationModel {
  if (!data || typeof data !== "object" || !("accountAction" in data)) return model;

  const action = (data as AccountActionData).accountAction;
  if (action.kind === "password") return { ...model, passwordState: action.state };
  if (action.kind === "email") return { ...model, emailState: action.state };

  return model;
}

/** Initializes the tab's forms independently of the credentials' availability. */
export function createInformationModel(
  credentials: AccountCredentialsState,
  editor: AccountEditor | null
): AccountInformationModel {
  return { credentials, editor, emailState: { status: "ready" }, passwordState: { status: "ready" } };
}
