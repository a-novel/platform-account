import type { AccountClaimsState, AccountCredentialsState, AccountScreenModel } from "./types";

/** AccountActionData is the result an account form action returns to the page. */
export type AccountActionData =
  | {
      accountAction: {
        kind: "email";
        state: AccountScreenModel["emailState"];
      };
    }
  | { accountAction: { kind: "password"; state: AccountScreenModel["passwordState"] } };

/** Applies an account action's result to the form it came from, ignoring any other data. */
export function mergeAccountAction(model: AccountScreenModel, data: unknown): AccountScreenModel {
  if (!data || typeof data !== "object" || !("accountAction" in data)) return model;

  const action = (data as AccountActionData).accountAction;
  if (action.kind === "password") return { ...model, passwordState: action.state };
  if (action.kind === "email") return { ...model, emailState: action.state };

  return model;
}

/** Initializes account actions independently of session recap and email availability. */
export function createAccountModel(
  claims: AccountClaimsState,
  credentials: AccountCredentialsState
): AccountScreenModel {
  return {
    claims,
    credentials,
    emailState: { status: "ready" },
    logoutState: "ready",
    passwordState: { status: "ready" },
  };
}
