import { tick } from "svelte";

/**
 * Lets a controller transition decide whether a form submits natively. A refused submission stays on
 * the page, and the first invalid field takes focus once the errors render.
 */
export async function submitThrough(event: SubmitEvent, transition: (form: FormData) => boolean): Promise<void> {
  const form = event.currentTarget as HTMLFormElement;
  if (transition(new FormData(form))) return;

  event.preventDefault();
  await tick();
  form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}
