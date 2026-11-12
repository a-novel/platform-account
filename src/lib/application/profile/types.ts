import type { UsernameIssue } from "./username";

import type { PictureCrop, PictureSource } from "@a-novel-kit/uikit";

/** A user's public profile, as the platform shows it. Each part is absent until its owner sets it. */
export interface ProfileSummary {
  username?: string;
  /** The picture's address on this platform, which names its version. */
  picture?: string;
}

/** The visitor's public profile, independent of their credentials. */
export type ProfileState = ({ status: "ready" } & ProfileSummary) | { status: "unavailable" };

/** Why the browser or the profile service refused a picture. */
export type PictureRefusal = "unreadable" | "format" | "ratio" | "dimensions" | "tooLarge";

/** The failures of a profile change that are the service's, which a later try may get past. */
export type ProfileServiceFeedback = "serviceUnavailable" | "tooManyAttempts";

/** The username dialog: the name being typed, and the outcome of its latest submission. */
export interface UsernameEditor {
  draft: string;
  state:
    | { status: "ready" | "submitting" }
    | { status: "validation-error"; issue: UsernameIssue }
    | { status: "service-error"; feedback: ProfileServiceFeedback };
}

/**
 * The picture dialog's step. Choosing shows the latest refusal of a picture, if any; framing names the file the
 * picture came from.
 */
export type PictureEditor =
  | { status: "choosing"; refusal?: PictureRefusal }
  | { status: "opening" }
  | { status: "cropping" | "saving"; name: string; source: PictureSource; crop: PictureCrop }
  | { status: "removing" }
  | { status: "service-error"; feedback: ProfileServiceFeedback };
