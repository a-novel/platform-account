import { expect, onTestFinished } from "vitest";
import { page } from "vitest/browser";

/**
 * Submits the form of the named button through its submit event, and returns that form. A dispatched event
 * runs the form's handlers but never submits it natively, so the test page stays.
 */
export async function submitForm(buttonName: string): Promise<HTMLFormElement> {
  const buttonLocator = page.getByRole("button", { name: buttonName });
  await expect.element(buttonLocator).toBeVisible();
  const button = buttonLocator.element() as HTMLButtonElement;
  const form = button.form;
  expect(form).not.toBeNull();

  form?.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
  return form as HTMLFormElement;
}

/**
 * Stops every native submission until the test ends, since one would navigate the test page away, and
 * returns the forms the page let submit: those whose submit event no handler prevented.
 */
export function interceptNativeSubmissions(): HTMLFormElement[] {
  const submitted: HTMLFormElement[] = [];
  const intercept = (event: SubmitEvent) => {
    if (!event.defaultPrevented && event.target instanceof HTMLFormElement) submitted.push(event.target);
    event.preventDefault();
  };

  document.addEventListener("submit", intercept);
  onTestFinished(() => document.removeEventListener("submit", intercept));
  return submitted;
}
