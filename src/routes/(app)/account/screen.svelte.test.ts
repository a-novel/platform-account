import type { AccountSummaryState } from "#lib/application/auth/types.js";
import { portraitPicture } from "#lib/application/profile/picture.fixture.js";
import { withLocale } from "#lib/i18n/provider.fixture.js";
import { submitForm } from "#lib/ui/forms.fixture.js";

import { type AccountTab, createAccountLayoutController } from "./controller.svelte";
import Screen from "./screen.svelte";

import { createRawSnippet } from "svelte";

import { beforeEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

import { Badge } from "@a-novel-kit/uikit";
import "@a-novel-kit/uikit-fonts/fonts.css";
import "@a-novel-kit/uikit-tokens/tokens.css";

const children = createRawSnippet(() => ({ render: () => "<p>Tab content</p>" }));

const summary: AccountSummaryState = {
  status: "ready",
  roles: ["auth:user"],
  email: "maya.chen@example.test",
  profile: {},
  loggedInUntil: "Nov 10, 2026, 6:40 PM",
};

function controller(state: AccountSummaryState = summary, currentTab: AccountTab | null = "information") {
  return createAccountLayoutController({
    getSummary: () => state,
    logoutAction: "/auth/logout",
    pictureEditorHref: "/account?edit=picture",
    tabs: {
      information: "/account",
      devices: "/account/devices",
      privacy: "/account/privacy",
      preferences: "/account/preferences",
    },
    getCurrentTab: () => currentTab,
  });
}

/** Mounts the layout in a flex column, as the shell's main content holds it. */
function shellColumn(): HTMLElement {
  const column = document.createElement("div");
  column.style.display = "flex";
  column.style.flexDirection = "column";
  return document.body.appendChild(column);
}

describe("account layout screen", () => {
  beforeEach(async () => {
    await page.viewport(1280, 800);
  });

  it("heads the tabs with the account's picture, email, roles and session end", async () => {
    await render(Screen, { controller: controller(), children }, withLocale());

    await expect.element(page.getByText("MC", { exact: true })).toBeVisible();
    await expect.element(page.getByRole("heading", { level: 1, name: "maya.chen@example.test" })).toBeVisible();
    await expect.element(page.getByRole("list", { name: "Roles" }).getByRole("listitem")).toMatchTextContent("User");
    await expect.element(page.getByText(/^Logged in until\s+Nov 10, 2026, 6:40 PM$/)).toBeVisible();
    await expect.element(page.getByText("Tab content")).toBeVisible();
  });

  it("opens the picture's editor from the header's picture, which shows the uploaded one", async () => {
    const withProfile = { ...summary, profile: { username: "Maya", picture: portraitPicture } };
    await render(Screen, { controller: controller(withProfile), children }, withLocale());

    const picture = page.getByRole("link", { name: "Change picture" });
    await expect.element(picture).toHaveAttribute("href", "/account?edit=picture");
    expect(picture.element().querySelector("img")?.getAttribute("src")).toBe(portraitPicture);
    expect(picture.element().querySelector("svg")).not.toBeNull();
    const bounds = picture.element().getBoundingClientRect();
    expect([bounds.width, bounds.height]).toEqual([96, 96]);
    await expect.element(page.getByRole("heading", { level: 1, name: "Maya" })).toBeVisible();
  });

  it("names the account by its email and shows its initials until a profile is set", async () => {
    await render(Screen, { controller: controller({ ...summary, profile: {} }), children }, withLocale("fr"));

    const picture = page.getByRole("link", { name: "Modifier ma photo" });
    await expect.element(picture).toMatchTextContent("MC");
    expect(picture.element().querySelector("img")).toBeNull();
    await expect.element(page.getByRole("heading", { level: 1, name: "maya.chen@example.test" })).toBeVisible();
  });

  it("lists the tabs in one row and marks the current one", async () => {
    await render(Screen, { controller: controller(summary, "devices"), children }, withLocale("fr"));

    const tabs = page.getByRole("navigation", { name: "Sections du compte" });
    const links = [
      [tabs.getByRole("link", { name: "Mes informations" }), "/account"],
      [tabs.getByRole("link", { name: "Appareils" }), "/account/devices"],
      [tabs.getByRole("link", { name: "Confidentialité" }), "/account/privacy"],
      [tabs.getByRole("link", { name: "Préférences" }), "/account/preferences"],
    ] as const;
    for (const [link, href] of links) await expect.element(link).toHaveAttribute("href", href);

    await expect.element(links[1][0]).toHaveAttribute("aria-current", "page");
    await expect.element(links[0][0]).not.toHaveAttribute("aria-current");
    const tops = links.map(([link]) => link.element().getBoundingClientRect().top);
    expect(new Set(tops).size).toBe(1);
  });

  it("colors each role badge by the role's privilege", async () => {
    const roles = ["auth:superadmin", "auth:admin", "auth:user", "auth:reviewer"];
    await render(Screen, { controller: controller({ ...summary, roles }), children }, withLocale());
    const tones = ["danger", "highlight", "brand", "neutral"] as const;
    for (const tone of tones) await render(Badge, { tone, "data-testid": tone });

    const list = page.getByRole("list", { name: "Roles" });
    const labels = ["Super admin", "Admin", "User", "auth:reviewer"];
    const colors = labels.map(
      (label) => getComputedStyle(list.getByText(label, { exact: true }).element()).backgroundColor
    );
    const references = tones.map((tone) => getComputedStyle(page.getByTestId(tone).element()).backgroundColor);

    expect(colors).toEqual(references);
    expect(new Set(colors).size).toBe(tones.length);
  });

  it("holds the place of a header it cannot read yet, and keeps the tabs and the logout", async () => {
    await render(Screen, { controller: controller({ status: "loading" }), children }, withLocale());

    await expect.element(page.getByRole("heading", { level: 1, name: "Your account" })).toBeVisible();
    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
    await expect.element(page.getByRole("list", { name: "Roles" })).not.toBeInTheDocument();
    await expect.element(page.getByText(/Logged in until/)).not.toBeInTheDocument();
    await expect.element(page.getByRole("link", { name: "Devices" })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Log out" })).toBeEnabled();
  });

  it("logs out through the shell's logout, once", async () => {
    const layout = controller();
    await render(Screen, { controller: layout, children }, withLocale());

    const form = await submitForm("Log out");

    expect(form.getAttribute("action")).toBe("/auth/logout");
    expect(form.getAttribute("method")).toBe("POST");
    expect(layout.state.logoutState).toBe("submitting");
    await expect.element(page.getByRole("button", { name: "Logging out…" })).toBeDisabled();
  });

  it("gives a long email the layout's width in the shell's column", async () => {
    const email = "alexandrine.de.la.bibliotheque@example.test";
    await render(
      Screen,
      { props: { controller: controller({ ...summary, email }), children }, target: shellColumn() },
      withLocale()
    );

    const heading = page.getByRole("heading", { level: 1, name: email }).element();
    const lineHeight = parseFloat(getComputedStyle(heading).lineHeight);
    expect(heading.getBoundingClientRect().width).toBeGreaterThan(400);
    expect(heading.getBoundingClientRect().height).toBeLessThan(lineHeight * 2);
  });

  it("moves the logout under the details on a phone, without overflowing it", async () => {
    await page.viewport(320, 800);
    const email = "alexandrine.de.la.bibliotheque@example.test";
    await render(
      Screen,
      { props: { controller: controller({ ...summary, email }), children }, target: shellColumn() },
      withLocale()
    );

    const details = page
      .getByText(/^Logged in until/)
      .element()
      .getBoundingClientRect();
    const logout = page.getByRole("button", { name: "Log out" }).element().getBoundingClientRect();
    const heading = page.getByRole("heading", { level: 1, name: email }).element().getBoundingClientRect();
    expect(logout.top).toBeGreaterThan(details.bottom);
    expect(logout.width).toBeGreaterThan(heading.width);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
  });
});
