import type { AccountCredentialsState, AccountEditor, AccountInformationModel } from "#lib/application/auth/types.js";
import type { PictureEditor, ProfileState, UsernameEditor } from "#lib/application/profile/types.js";

/** AccountActionData is the result an account form action returns to the page. */
export type AccountActionData =
  | { accountAction: { kind: "email"; state: AccountInformationModel["emailState"]; email?: string } }
  | { accountAction: { kind: "cancelEmail"; state: AccountInformationModel["emailCancelState"] } }
  | { accountAction: { kind: "password"; state: AccountInformationModel["passwordState"] } }
  | { accountAction: { kind: "username"; editor: UsernameEditor } }
  | { accountAction: { kind: "picture"; editor: PictureEditor } };

/** Applies an account action's result to the form it came from, ignoring any other data. */
export function mergeAccountAction(model: AccountInformationModel, data: unknown): AccountInformationModel {
  if (!data || typeof data !== "object" || !("accountAction" in data)) return model;

  const action = (data as AccountActionData).accountAction;
  if (action.kind === "password") return { ...model, passwordState: action.state };
  if (action.kind === "email") return { ...model, emailState: action.state, emailDraft: action.email ?? "" };
  if (action.kind === "cancelEmail") return { ...model, emailCancelState: action.state };
  if (action.kind === "username") return { ...model, username: action.editor };
  if (action.kind === "picture") return { ...model, picture: action.editor };

  return model;
}

/** Initializes the tab's forms independently of the credentials' and the profile's availability. */
export function createInformationModel(
  credentials: AccountCredentialsState,
  profile: ProfileState,
  editor: AccountEditor | null
): AccountInformationModel {
  return { profile, credentials, editor, ...blankEditors(profile) };
}

/** The dialogs' forms as they open: the username field holds the current username. */
export function blankEditors(profile: ProfileState) {
  return {
    emailState: { status: "ready" },
    emailDraft: "",
    emailCancelState: { status: "ready" },
    passwordState: { status: "ready" },
    username: { draft: (profile.status === "ready" && profile.username) || "", state: { status: "ready" } },
    picture: { status: "choosing" },
  } satisfies Omit<AccountInformationModel, "profile" | "credentials" | "editor">;
}
