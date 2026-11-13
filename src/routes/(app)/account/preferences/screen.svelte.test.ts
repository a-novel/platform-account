import { withLocale } from "#lib/i18n/provider.fixture.js";

import Screen, { type LanguageChoice } from "./screen.svelte";

import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

import { createSelectController } from "@a-novel-kit/uikit";
import "@a-novel-kit/uikit-fonts/fonts.css";
import "@a-novel-kit/uikit-tokens/tokens.css";

async function screen(initialValue: LanguageChoice, locale?: "en" | "fr") {
  const language = createSelectController<LanguageChoice>({ initialValue });
  await render(Screen, { language, savedLanguage: initialValue, languageAction: "?/language" }, withLocale(locale));
  return language;
}

describe("account preferences screen", () => {
  it("shows the language this device keeps, each named in its own words", async () => {
    await screen("fr", "fr");

    const select = page.getByRole("combobox", { name: "Langue" });
    await expect.element(select).toHaveTextContent("Français");
    await expect.element(page.getByText("Paramètres locaux, uniquement pour l’appareil actuel.")).toBeVisible();

    await select.click();
    const options = page.getByRole("option");
    await expect.element(options.nth(0)).toHaveTextContent("Langue du navigateur");
    await expect.element(options.nth(1)).toHaveTextContent("English");
  });

  it("saves only a language other than the one this device keeps", async () => {
    await screen("fr");
    const save = page.getByRole("button", { name: "Save" });

    await expect.element(save).toBeDisabled();
    await page.getByRole("combobox", { name: "Language" }).click();
    await page.getByRole("option", { name: "English" }).click();
    await expect.element(save).toBeEnabled();
    await page.getByRole("combobox", { name: "Language" }).click();
    await page.getByRole("option", { name: "Français" }).click();
    await expect.element(save).toBeDisabled();
  });

  it("waits for the save button before posting the language", async () => {
    const language = await screen("browser");

    await page.getByRole("combobox", { name: "Language" }).click();
    await page.getByRole("option", { name: "Français" }).click();
    expect(language.state.value).toBe("fr");

    const form = page.getByRole("button", { name: "Save" }).element().closest("form");
    if (!form) throw new Error("The language must belong to its form");
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
