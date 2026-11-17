import { tmpdir } from "node:os";
import { join } from "node:path";

import { serviceTokenSetup } from "@a-novel-kit/nodelib-test/playwright";

/** The account platform's caller, which Authentication admits as the only one serving authorization requests. */
export const accountCaller = "system:serviceaccount:account:web";

const directory = join(tmpdir(), "platform-account-e2e");

/** The file the platform server under test reads its Authentication token from, as a pod reads its projected token. */
export const serviceTokenPath = join(directory, "service-token");

/** The file the platform server under test reads its profile service token from. */
export const profileServiceTokenPath = join(directory, "profile-service-token");

/** Gives the platform server under test the account platform's service token for each service it calls. */
export default serviceTokenSetup([
  { path: serviceTokenPath, subject: accountCaller },
  { path: profileServiceTokenPath, subject: accountCaller, audience: "profile" },
]);
