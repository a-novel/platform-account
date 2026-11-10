import type { AccountEditor } from "#lib/application/auth/types.js";

import { singleValue } from "../../auth-dialog-state";
import { editorParameter } from "../url-state";

/** Reads the open account editor. A duplicate or unknown value opens none. */
export function readEditor(parameters: URLSearchParams): AccountEditor | null {
  const value = singleValue(parameters, editorParameter);
  return value === "email" || value === "password" || value === "username" || value === "picture" ? value : null;
}
