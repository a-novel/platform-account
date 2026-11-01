import type { ShortCodeScreenModel } from "./types";

/** ShortCodePageData is the screen state and the destinations an email-link page loads. */
export interface ShortCodePageData {
  links: {
    continueHref: string;
    restartHref: string;
  };
  model: ShortCodeScreenModel;
}

/** ShortCodeActionData is the screen state a failed link completion returns. */
export interface ShortCodeActionData {
  shortCode?: ShortCodeScreenModel;
}
