// The profile service's username rule, mirrored for feedback while the visitor types. The service's
// answer decides: a name this module accepts can still be refused.

/** The most glyphs a username holds. */
export const usernameGlyphsMax = 32;

/** The most UTF-8 bytes a username holds, invisible characters included. */
const usernameBytesMax = 2048;

/** The most UTF-8 bytes one glyph holds, which caps a stack of combining marks. */
const glyphBytesMax = 64;

/** The rule a username breaks, or `refused` when only the service could tell. */
export type UsernameIssue = "characters" | "invisible" | "length" | "size" | "refused";

// Control characters, every whitespace but U+0020, and the bidirectional embedding, override and
// isolate controls, which reorder the text after the name.
const refusedCharacter = /[\p{Cc}‪-‮⁦-⁩]|(?! )\p{White_Space}/u;
// A glyph a reader sees holds a code point that is not drawn as nothing.
const visibleCodePoint = /\P{Default_Ignorable_Code_Point}/u;

const glyphs = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const utf8 = new TextEncoder();

/** Trims the spaces at both ends, as the service does. An empty result clears the username. */
export function trimUsername(value: string): string {
  return value.replace(/^ +| +$/g, "");
}

/** Counts the glyphs of a username: the grapheme clusters (UAX #29) holding a visible code point. */
export function countGlyphs(value: string): number {
  let count = 0;
  for (const { segment } of glyphs.segment(trimUsername(value))) {
    if (visibleCodePoint.test(segment)) count++;
  }
  return count;
}

/** Names the rule a username breaks, or returns null when the service would store or clear it. */
export function usernameIssue(value: string): UsernameIssue | null {
  const username = trimUsername(value);
  if (username === "") return null;

  if (refusedCharacter.test(username)) return "characters";
  if (utf8.encode(username).length > usernameBytesMax) return "size";
  for (const { segment } of glyphs.segment(username)) {
    if (utf8.encode(segment).length > glyphBytesMax) return "size";
  }

  const count = countGlyphs(username);
  if (count === 0) return "invisible";
  return count > usernameGlyphsMax ? "length" : null;
}
