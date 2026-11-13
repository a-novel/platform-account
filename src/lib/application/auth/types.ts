import type { PictureEditor, ProfileState, ProfileSummary, UsernameEditor } from "../profile/types";

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

/** The journeys the shell authentication dialog offers. */
export type AuthenticationJourney = "login" | "register" | "reset";

/** The fields of the shell authentication forms. */
export type AuthenticationField = "email" | "password";

/** Email delivery acknowledgement that deliberately does not disclose account existence. */
export interface PendingEmailState {
  status: "pending-email";
  targetHint: string;
}

/** What every shell authentication form keeps across a submission the server refused. */
interface AuthenticationPanelDraft {
  /** The address the visitor typed. Passwords are never sent back. */
  email?: string;
}

/** Pure login form state. */
export interface LoginPanelModel extends AuthenticationPanelDraft {
  journey: "login";
  state: Exclude<FormState<AuthenticationField>, { status: "success" }>;
}

/** Pure password-recovery request state. */
export interface EmailRequestPanelModel extends AuthenticationPanelDraft {
  journey: "reset";
  state: Exclude<FormState<"email">, { status: "success" }> | PendingEmailState;
}

/** Invitation requests acknowledge list membership without implying email delivery. */
export interface InvitationRequestPanelModel extends AuthenticationPanelDraft {
  journey: "register";
  state: Exclude<FormState<"email">, { status: "success" }> | { status: "recorded"; email: string };
}

/** Every state rendered inside the shell authentication dialog. */
export type AuthenticationPanelModel = LoginPanelModel | EmailRequestPanelModel | InvitationRequestPanelModel;

/** The fields of the account password form. */
export type AccountPasswordField = "currentPassword" | "newPassword" | "confirmPassword";

/** The fields of the account email form. */
export type AccountEmailField = "currentPassword" | "newEmail";

/** What the account pages' header states about the visitor. */
export interface AccountSummary {
  roles: readonly string[];
  /** The current email, absent while Authentication cannot report it. A pending change stays out. */
  email?: string;
  /** When the visitor must log in again, formatted: the refresh token's expiry. */
  loggedInUntil?: string;
  /** The public profile, absent while the profile service cannot report it. */
  profile?: ProfileSummary;
}

/** The header's state, independent of the tabs below it. */
export type AccountSummaryState = ({ status: "ready" } & AccountSummary) | { status: "loading" };

/** The account's email, its change awaiting confirmation and its location consent, as Authentication reports them. */
export interface AccountCredentialsSummary {
  email: string;
  pendingEmail?: { email: string; expiresAt: string };
  /** Whether the account records the IP address and approximate location of its devices. */
  locationConsent: boolean;
}

/** Credentials availability, independent of the account forms. */
export type AccountCredentialsState = ({ status: "ready" } & AccountCredentialsSummary) | { status: "unavailable" };

/** The account detail a dialog edits. */
export type AccountEditor = "email" | "password" | "username" | "picture";

/** The "My information" tab: the public profile, the account's email and password, and their editing dialogs. */
export interface AccountInformationModel {
  profile: ProfileState;
  credentials: AccountCredentialsState;
  /** The open editing dialog, which the URL owns. */
  editor: AccountEditor | null;
  passwordState: FormState<AccountPasswordField>;
  /** A sent link carries no address: the pending email comes from `credentials` once the page reloads. */
  emailState: Exclude<FormState<AccountEmailField>, { status: "success" }> | { status: "pending-email" };
  /** The address a submission the server refused keeps in its field. Passwords are never sent back. */
  emailDraft: string;
  /** Cancelling the pending email change. Only the service can refuse it: the form has no field. */
  emailCancelState: Extract<FormState<never>, { status: "ready" | "submitting" | "service-error" }>;
  username: UsernameEditor;
  picture: PictureEditor;
}

/** POST destinations of the "My information" tab. */
export interface AccountInformationActions {
  password: string;
  email: string;
  cancelEmail: string;
  username: string;
  picture: string;
  removePicture: string;
}

/** What a device's User-Agent tells: its browser and system when recognized, and its form factor. */
export interface DeviceName {
  browser?: string;
  system?: string;
  form: "desktop" | "phone" | "tablet";
}

/** A device the account logged in on: one session, as the devices tab lists it. */
export interface AccountDevice extends DeviceName {
  /** The session the device holds, which logging it out or removing it names. */
  id: string;
  /** Marks the device showing the page. */
  current: boolean;
  /** Set once the device was logged out or its session ended. */
  loggedOut: boolean;
  /** When the device's latest access token was issued, formatted for the reader. */
  lastActiveAt: string;
  /** The approximate place, formatted for the reader, when the account records locations. */
  place?: string;
  ipAddress?: string;
}

/** A logout waiting for the reader's confirmation: one device, or every device but this one. */
export type AccountDeviceConfirmation = { kind: "device"; id: string } | { kind: "others" };

/** The devices tab: the account's devices and the outcome of the latest change. */
export interface AccountDevicesModel {
  /** Loading while retries run after a failed read, and unavailable once they run out. */
  devices: { status: "ready"; devices: AccountDevice[] } | { status: "loading" } | { status: "unavailable" };
  /** The page each list shows, which the URL owns. The first without one. */
  pages?: { active: number; loggedOut: number };
  /** Whether the account records locations, or null when Authentication cannot tell. */
  locationConsent: boolean | null;
  /** The logout the open confirmation dialog asks about, which the URL owns. */
  confirmation: AccountDeviceConfirmation | null;
  action:
    | { status: "ready" | "submitting" | "logged-out" | "logged-out-others" | "removed" }
    | { status: "service-error"; feedback: AuthenticationFeedback };
}

/** POST destinations of the devices tab. */
export interface AccountDevicesActions {
  logoutDevice: string;
  logoutOtherDevices: string;
  removeDevice: string;
  /** Logs this device out, through the shell's logout. */
  logout: string;
}

/** The account's location consent on the privacy tab, with the outcome of the latest change. */
export type PrivacyAccountState =
  { status: "ready"; locationConsent: boolean; feedback?: AuthenticationFeedback } | { status: "unavailable" };

/** The journeys an email link completes. */
export type ShortCodeJourney = "register" | "email-update" | "password-reset";

/** The fields of an email link's password form. */
export type ShortCodePasswordField = "newPassword" | "confirmPassword";

/** A secure email-link state. No short code or raw target is part of this model. */
export type ShortCodeState = FormState<ShortCodePasswordField> | { status: "missing" } | { status: "invalid" };

/** Pure standalone completion screen driven by a sanitized server model. */
export interface ShortCodeScreenModel {
  journey: ShortCodeJourney;
  state: ShortCodeState;
}
