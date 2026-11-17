/** A user's public profile, as the platform shows it. Each part is absent until its owner sets it. */
export interface ProfileSummary {
  username?: string;
  /** The picture's address on this platform, which names its version. */
  picture?: string;
}
