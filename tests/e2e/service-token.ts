import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The account platform's caller, which Authentication admits as the only one serving authorization requests. */
export const accountCaller = "system:serviceaccount:account:web";

const directory = join(tmpdir(), "platform-account-e2e");

/** The file the platform server under test reads its Authentication token from, as a pod reads its projected token. */
export const serviceTokenPath = join(directory, "service-token");

/** The file the platform server under test reads its profile service token from. */
export const profileServiceTokenPath = join(directory, "profile-service-token");

/** Draws a token for a caller from the stack's local issuer, which signs one for anyone who asks. */
async function serviceToken(subject: string, audience = "authentication"): Promise<string> {
  const response = await fetch(`http://127.0.0.1:14101/token?${new URLSearchParams({ subject, audience })}`);
  if (!response.ok) throw new Error(`The service-token issuer answered ${response.status}: ${await response.text()}`);
  return await response.text();
}

/** Calls Authentication as a caller, which every route but the ping requires. */
export function callerFetch(subject: string): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("X-Service-Authorization", await serviceToken(subject));
    return await fetch(input, { ...init, headers });
  };
}

/** Gives the platform server under test the account platform's service token for each service it calls. */
export default async function writeServiceToken() {
  await mkdir(directory, { recursive: true });
  await writeFile(serviceTokenPath, await serviceToken(accountCaller));
  await writeFile(profileServiceTokenPath, await serviceToken(accountCaller, "profile"));
  return () => rm(directory, { recursive: true, force: true });
}
