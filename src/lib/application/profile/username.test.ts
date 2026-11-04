import { countGlyphs, trimUsername, usernameGlyphsMax, usernameIssue } from "./username";

import { describe, expect, it } from "vitest";

// The cases mirror the profile service's own username tests. Escapes spell out the invisible characters.
describe("countGlyphs", () => {
  it.each([
    ["Jean Paul", 9],
    [` ${"x".repeat(32)} `, 32],
    ["a​b", 2],
    ["\u{1F468}‍\u{1F469}‍\u{1F467}", 1],
    ["\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}", 1],
    ["می‌خواهم", 7],
    [`e${"́".repeat(31)}`, 1],
    ["؀", 1],
    ["￹", 1],
    ["­a️", 1],
    ["ㅤ", 0],
    ["", 0],
  ])("counts %j as %i glyphs", (username, glyphs) => {
    expect(countGlyphs(username)).toBe(glyphs);
  });
});

describe("usernameIssue", () => {
  it.each(["Jean Paul", "Maya Chen 👩🏽‍💻 storyteller of seas!", "", "   ", "می‌خواهم"])("accepts %j", (username) => {
    expect(usernameIssue(username)).toBeNull();
  });

  it.each([
    ["a carriage return", "a\rb", "characters"],
    ["a line feed", "a\nb", "characters"],
    ["a tab", "a\tb", "characters"],
    ["a no-break space", "a b", "characters"],
    ["an ideographic space", "a　b", "characters"],
    ["a right-to-left override", "a‮b", "characters"],
    ["a first strong isolate", "a⁨b", "characters"],
    ["only a Hangul filler", "ㅤ", "invisible"],
    ["only a soft hyphen", "­", "invisible"],
    ["one glyph too many", "x".repeat(usernameGlyphsMax + 1), "length"],
    ["a glyph over 64 bytes", `e${"́".repeat(32)}`, "size"],
    ["a name over 2048 bytes", `a${"​".repeat(683)}`, "size"],
  ] as const)("refuses %s", (_, username, issue) => {
    expect(usernameIssue(username)).toBe(issue);
  });
});

describe("trimUsername", () => {
  it("trims only the spaces at both ends", () => {
    expect(trimUsername("  Jean Paul \t ")).toBe("Jean Paul \t");
  });
});
