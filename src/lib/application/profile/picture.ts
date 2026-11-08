import type { PictureRule } from "@a-novel-kit/uikit";

/** What the profile service accepts of a picture: a square, at most 512 pixels wide and 256 KiB. */
export const profilePicture: PictureRule = { ratio: { width: 1, height: 1 }, maxWidth: 512, maxBytes: 256 * 1024 };
