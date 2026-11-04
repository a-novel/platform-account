import { editorParameter, readEditor } from "./editor-state";

import { describe, expect, it } from "vitest";

describe("readEditor", () => {
  it.each([
    ["edit=email", "email"],
    ["edit=password", "password"],
    ["edit=username", "username"],
    ["edit=picture", "picture"],
    ["", null],
    ["edit=", null],
    ["edit=name", null],
    ["edit=Email", null],
    ["edit=email&edit=email", null],
    ["edit=email&edit=password", null],
  ])("reads ?%s as the %s editor", (query, editor) => {
    expect(readEditor(new URLSearchParams(query))).toBe(editor);
  });

  it("reads the parameter its links write", () => {
    expect(readEditor(new URLSearchParams({ [editorParameter]: "password" }))).toBe("password");
  });
});
