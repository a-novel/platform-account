// DIAGNOSTIC ONLY (do not merge): records the email row's state around the email-change-pending
// screenshot, to find the second layout CI sometimes captures.
import type { Page, TestInfo } from "playwright/test";

/** Logs the page's load events and text writes from the start of every document. */
export async function recordTimeline(page: Page) {
  await page.addInitScript(() => {
    const log: string[] = [];
    const at = (what: string) => log.push(`${performance.now().toFixed(1)} ${what}`);
    Object.assign(window, { __diagnostic: log });
    addEventListener("DOMContentLoaded", () => at("DOMContentLoaded"));
    addEventListener("load", () => at("load"));
    addEventListener("resize", () => at(`resize ${innerWidth}x${innerHeight}`));
    document.fonts.addEventListener("loadingdone", () => at(`fonts ${document.fonts.status}`));
    new MutationObserver((records) => {
      // The parser's own insertions say nothing about the settled page.
      if (document.readyState === "loading") return;
      for (const record of records) {
        const element = record.target instanceof Element ? record.target : record.target.parentElement;
        if (!element?.closest("main, [role=status], [role=alert], dialog")) continue;
        const name = `${element.tagName}.${String(element.className).split(" ")[0]}`;
        at(`${record.type} ${name} +${record.addedNodes.length}-${record.removedNodes.length}`);
      }
    }).observe(document, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["open", "class", "style"],
    });
  });
}

/** Reads the email row, its containers and the page around it. */
export async function emailRowState(page: Page, stage: string) {
  return await page.evaluate((stage) => {
    const box = (element: Element | null | undefined) => {
      if (!element) return null;
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    const value = document.querySelector("dd .row .value");
    const row = value?.parentElement;
    const ancestors: unknown[] = [];
    for (let element = row?.parentElement; element && element !== document.body; element = element.parentElement) {
      ancestors.push({ element: `${element.tagName}.${String(element.className).split(" ")[0]}`, box: box(element) });
    }
    const style = value ? getComputedStyle(value) : null;
    const context = document.createElement("canvas").getContext("2d")!;
    if (style) context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const metrics = context.measureText("account");
    const root = document.documentElement;

    return {
      stage,
      now: performance.now(),
      text: value?.textContent,
      value: box(value),
      button: box(row?.querySelector("a, button")),
      row: box(row),
      ancestors,
      header: box(document.querySelector("main header")),
      tabs: box(document.querySelector("main nav")),
      lineHeight: style?.lineHeight,
      font: context.font,
      ascent: metrics.fontBoundingBoxAscent,
      descent: metrics.fontBoundingBoxDescent,
      fonts: {
        status: document.fonts.status,
        faces: [...document.fonts].map((face) => `${face.family}/${face.weight}/${face.status}`),
      },
      viewport: {
        innerWidth,
        innerHeight,
        clientWidth: root.clientWidth,
        clientHeight: root.clientHeight,
        scrollbar: innerWidth - root.clientWidth,
      },
      visualViewport: visualViewport && {
        width: visualViewport.width,
        height: visualViewport.height,
        scale: visualViewport.scale,
      },
      page: {
        scrollHeight: root.scrollHeight,
        bodyHeight: document.body.getBoundingClientRect().height,
        scrollY,
        readyState: document.readyState,
      },
      above: {
        statuses: [...document.querySelectorAll("[role=status], [role=alert]")].map((element) => ({
          text: element.textContent?.slice(0, 40),
          box: box(element),
        })),
        dialogs: [...document.querySelectorAll("dialog")].map((dialog) => ({ open: dialog.open, box: box(dialog) })),
        active:
          document.activeElement &&
          `${document.activeElement.tagName} ${document.activeElement.getAttribute("aria-label") ?? ""}`,
        hovered: [...document.querySelectorAll(":hover")]
          .map((element) => `${element.tagName}.${String(element.className).split(" ")[0]}`)
          .slice(-3),
      },
      navigation: performance.getEntriesByType("navigation").map((entry) => {
        const navigation = entry as PerformanceNavigationTiming;
        return {
          type: navigation.type,
          domContentLoaded: navigation.domContentLoadedEventEnd,
          load: navigation.loadEventEnd,
        };
      }),
      resources: performance
        .getEntriesByType("resource")
        .filter((entry) => /\.(woff2|css|js)(\?|$)/.test(entry.name))
        .map(
          (entry) =>
            `${entry.name.split("/").pop()} ${entry.startTime.toFixed(1)}-${(entry as PerformanceResourceTiming).responseEnd.toFixed(1)}`
        ),
      timeline: (window as unknown as { __diagnostic?: string[] }).__diagnostic ?? null,
    };
  }, stage);
}

/** Attaches and prints the recorded states when the screenshot did not match. */
export async function reportMismatch(info: TestInfo, states: unknown[]) {
  const body = JSON.stringify(states);
  await info.attach("email-row-diagnostic.json", { body, contentType: "application/json" });
  process.stdout.write(`EMAIL-ROW-DIAGNOSTIC ${info.project.name} ${body}\n`);
}
