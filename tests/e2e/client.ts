import { createServer } from "node:http";

/** The stub client Authentication's registry holds in `builds/compose.e2e.yaml`. */
export const client = {
  id: "client",
  redirectUri: "http://127.0.0.1:4181/auth/callback?tenant=e2e",
  caller: "system:serviceaccount:client:web",
};

/** Serves the stub client's redirect URI, so the browser lands there with the authorization response. */
export default async function serveClient() {
  const server = createServer((_, response) => {
    response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    response.end("Stub client");
  });
  await new Promise<void>((resolve) => server.listen(4181, "127.0.0.1", resolve));
  return () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
