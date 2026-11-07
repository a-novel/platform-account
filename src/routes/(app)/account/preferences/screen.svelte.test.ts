import { withLocale } from "#lib/i18n/provider.fixture.js";

import Screen, { type LanguageChoice } from "./screen.svelte";

import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

import { createValueController } from "@a-novel-kit/uikit";
import "@a-novel-kit/uikit-fonts/fonts.css";
import "@a-novel-kit/uikit-tokens/tokens.css";

async function screen(initialValue: LanguageChoice, locale?: "en" | "fr") {
  const language = createValueController<LanguageChoice | undefined>({ initialValue });
  await render(Screen, { language, languageAction: "?/language" }, withLocale(locale));
  return language;
}

describe("account preferences screen", () => {
  it("names each language in its own words and marks the one this device keeps", async () => {
    await screen("fr", "fr");

    const languages = page.getByRole("group", { name: "Langue" });
    await expect.element(languages.getByRole("radio", { name: "Langue du navigateur" })).not.toBeChecked();
    await expect.element(languages.getByRole("radio", { name: "English" })).not.toBeChecked();
    await expect.element(languages.getByRole("radio", { name: "Français" })).toBeChecked();
    await expect
      .element(page.getByText("Toutes les applications Agora suivent ces préférences sur cet appareil."))
      .toBeVisible();
  });

  it("waits for the save button before posting the language", async () => {
    const language = await screen("browser");

    await page.getByRole("radio", { name: "Français" }).click();
    expect(language.state.value).toBe("fr");

    const form = (page.getByRole("radio", { name: "Français" }).element() as HTMLInputElement).form;
    if (!form) throw new Error("The languages must belong to their form");
    const submitted = new Promise<FormData>((resolve) =>
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        resolve(new FormData(form));
      })
    );
    await page.getByRole("button", { name: "Save" }).click();

    expect(form.getAttribute("action")).toBe("?/language");
    expect((await submitted).get("language")).toBe("fr");
  });
});
