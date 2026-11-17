import { singleValue } from "../../url-state";
import { editorParameter } from "../url-state";
import type { AccountEditor } from "./controller.svelte";

/** Reads the open account editor. A duplicate or unknown value opens none. */
export function readEditor(parameters: URLSearchParams): AccountEditor | null {
  const value = singleValue(parameters, editorParameter);
  return value === "email" || value === "password" || value === "username" || value === "picture" ? value : null;
}
