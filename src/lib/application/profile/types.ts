import type { UsernameIssue } from "./username";

/** A user's public profile, as the platform shows it. Each part is absent until its owner sets it. */
export interface ProfileSummary {
  username?: string;
  /** The picture's address on this platform, which names its version. */
  picture?: string;
}

/** The visitor's public profile, independent of their credentials. */
export type ProfileState = ({ status: "ready" } & ProfileSummary) | { status: "unavailable" };

/** A decoded image the visitor chose, which the browser shows from `url`. */
export interface PictureSource {
  url: string;
  /** The image's width, in pixels. */
  width: number;
  /** The image's height, in pixels. */
  height: number;
}

/** The square of a source the picture keeps. */
export interface PictureCrop {
  /** 1 fits the source's shorter side in the square; more shows less of the source. */
  zoom: number;
  /** The square's left edge, in source pixels. */
  x: number;
  /** The square's top edge, in source pixels. */
  y: number;
}

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

/** The picture dialog's step. Choosing shows the latest refusal of a picture, if any. */
export type PictureEditor =
  | { status: "choosing"; refusal?: PictureRefusal }
  | { status: "opening" }
  | { status: "cropping" | "saving"; source: PictureSource; crop: PictureCrop }
  | { status: "removing" }
  | { status: "service-error"; feedback: ProfileServiceFeedback };
